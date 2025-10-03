const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const Payment = require("../models/Payment");
const User = require("../models/User");
const MagicCoinPlan = require("../models/MagicCoinPlan");
const { client } = require("../config/paypal");
const axios = require("axios");
require("dotenv").config();

const ignoredSubscriptionEvents = [
  "BILLING.SUBSCRIPTION.CREATED",
  "BILLING.SUBSCRIPTION.ACTIVATED",
];
router.post(
  "/paypal/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    console.log("Webhook hit at", new Date().toISOString());
    try {
      const transmissionId = req.headers["paypal-transmission-id"];
      const timestamp = req.headers["paypal-transmission-time"];
      const webhookId = process.env.PAYPAL_WEBHOOK_ID;
      const transmissionSig = req.headers["paypal-transmission-sig"];
      const certUrl = req.headers["paypal-cert-url"];
      const authAlgo = req.headers["paypal-auth-algo"];
      const rawBody = req.body.toString("utf8");

      if (
        !transmissionId ||
        !timestamp ||
        !transmissionSig ||
        !certUrl ||
        !authAlgo
      ) {
        console.warn("Missing required PayPal headers.");
        return res.status(400).send("Missing required PayPal headers.");
      }
      console.log("Using PayPal client ID:", process.env.PAYPAL_CLIENT_ID);
      console.log(
        "Using PayPal client SECRET:",
        process.env.PAYPAL_CLIENT_SECRET ? "SET" : "NOT SET"
      );
      // 1️⃣ Get PayPal access token
      const { data: authData } = await axios({
        method: "post",
        url: "https://api-m.sandbox.paypal.com/v1/oauth2/token",
        auth: {
          username: process.env.PAYPAL_CLIENT_ID,
          password: process.env.PAYPAL_CLIENT_SECRET,
        },
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        data: "grant_type=client_credentials",
      });
      console.log(
        "PayPal access token obtained:",
        authData.access_token ? "YES" : "NO"
      );
      const accessToken = authData.access_token;

      const eventBody = JSON.parse(rawBody);

      // 2️⃣ Verify webhook signature
      const { data: verification } = await axios.post(
        "https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature",
        {
          transmission_id: transmissionId,
          transmission_time: timestamp,
          cert_url: certUrl,
          auth_algo: authAlgo,
          transmission_sig: transmissionSig,
          webhook_id: webhookId,
          webhook_event: eventBody, // reuse parsed object
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (verification.verification_status !== "SUCCESS") {
        return res.status(400).send("Invalid webhook signature.");
      }

      const eventType = eventBody.event_type;
      const resource = eventBody.resource;

      // Ignore subscription events we don't care about
      if (ignoredSubscriptionEvents.includes(eventType)) {
        console.log(`Ignoring PayPal webhook event: ${eventType}`);
        return res.sendStatus(200); // acknowledge the webhook
      }
      // 🔹 Determine identifier
      let transactionId = resource.id; // default for one-time payments
      let subscriptionId = null;

      if (resource.billing_agreement_id) {
        subscriptionId = resource.billing_agreement_id;
        transactionId = resource.id; // use subscription ID as main key
      }

      console.log("Transaction ID:", transactionId);
      console.log("Subscription ID:", subscriptionId || "N/A");

      // 🔹 Try to fetch payment
      let payment = await Payment.findOne({
        transactionId,
      });

      // Call appropriate handler
      if (subscriptionId || (payment && payment.type === "subscription")) {
        await handleSubscription(
          payment,
          eventType,
          resource,
          subscriptionId,
          transactionId
        );
      } else if (payment) {
        await handleOneTimePayment(payment, resource, eventType);
      } else {
        console.warn(
          `Payment not found for transaction ${transactionId}, ignoring.`
        );
      }
      res.sendStatus(200);
    } catch (err) {
      console.error("Webhook error:", err?.response?.data || err.message);
      res.status(500).send("Webhook processing error");
    }
  }
);

// ------------------ Subscription handler ------------------
async function handleSubscription(
  payment,
  eventType,
  resource,
  subscriptionId,
  transactionId
) {
  // 🔹 1️⃣ Fetch the original subscription Payment if needed
  if (!payment && subscriptionId) {
    const originalPayment = await Payment.findOne({ subscriptionId }).sort({
      createdAt: 1,
    });

    if (!originalPayment) {
      return console.warn(
        `Original subscription payment not found for ${subscriptionId}`
      );
    }

    if (!originalPayment.transactionId) {
      // First payment: just update the existing record
      payment = originalPayment;
      console.log(`Updating first subscription payment: ${payment._id}`);
    } else {
      // 🔹 NEW: Check if this transaction already exists
      const existing = await Payment.findOne({ transactionId: resource.id });
      if (existing) {
        console.log(
          `Payment already exists for transaction ${resource.id}, skipping creation`
        );
        return; // skip processing, no duplicate
      }
      console.log(originalPayment, "how");
      // Renewal: create a new Payment record
      payment = new Payment({
        user_id: originalPayment.user_id,
        plan_id: originalPayment.plan_id,
        planRef: originalPayment.planRef,
        type: originalPayment.type,
        paymentMethod: originalPayment.paymentMethod,
        coupon: originalPayment.coupon,
        isCouponUsed: originalPayment.isCouponUsed,
        originalAmount: originalPayment.originalAmount,
        discountAmount: originalPayment.discountAmount,
        commissionAmount: originalPayment.commissionAmount,
        amount: parseFloat(
          resource.amount?.value ?? originalPayment.amount ?? 0
        ),
        currency: resource.amount?.currency_code ?? originalPayment.currency,
        transactionId: transactionId || null,
        subscriptionId,
        paymentStatus: "pending",
        paymentDate: new Date(),
        paymentDetails: resource,
        vatAmount: originalPayment.vatAmount || 0,
        vatRate: originalPayment.vatRate || 0,
      });
      console.log(`Created new subscription payment: ${payment._id}`);
    }
  }

  if (!payment) {
    return console.warn(
      `Payment not found and no subscriptionId provided. Ignoring webhook.`
    );
  }

  switch (eventType) {
    case "PAYMENT.SALE.COMPLETED":
      payment.transactionId = resource.id; // ✅ Always update with PayPal's real
      payment.paymentStatus = "completed";
      payment.isActive = true;
      break;
    case "PAYMENT.SALE.DENIED":
      payment.paymentStatus = "failed";
      break;
    case "PAYMENT.SALE.PENDING":
      payment.paymentStatus = "pending";
      break;
    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.EXPIRED":
      payment.paymentStatus = "cancelled";
      payment.isActive = false;
      break;
    default:
      console.log(`Unhandled subscription event: ${eventType}`);
  }

  // 🔹 Final save only once
  payment.paymentDetails = resource;
  await payment.save();
  console.log(`Payment processed: ${payment._id} [${payment.paymentStatus}]`);
}

// ------------------ One-time payment handler (event-based) ------------------
async function handleOneTimePayment(payment, resource, eventType) {
  if (!payment) return;

  const user = await User.findById(payment.user_id);
  const plan = await MagicCoinPlan.findById(payment.plan_id);
  if (!user || !plan) {
    console.warn(`User or plan not found for payment ${payment.transactionId}`);
    return;
  }

  switch (eventType) {
    case "PAYMENT.CAPTURE.COMPLETED":
      payment.paymentStatus = "completed";
      if (!payment.coinsAdded) {
        user.walletCoins = (user.walletCoins || 0) + plan.coinsOffered;
        payment.totalCoins = user.walletCoins;
        payment.coinsAdded = true;
        await user.save();
        console.log(`Added ${plan.coinsOffered} coins to user ${user._id}`);
      }
      break;

    case "PAYMENT.CAPTURE.DENIED":
      payment.paymentStatus = "failed";
      break;

    case "PAYMENT.CAPTURE.PENDING":
      payment.paymentStatus = "pending";
      break;

    default:
      console.log(`Unhandled one-time payment event: ${eventType}`);
  }

  payment.paymentDetails = resource;
  await payment.save();
}

module.exports = router;
