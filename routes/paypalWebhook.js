const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const Payment = require("../models/Payment");
const User = require("../models/User");
const MagicCoinPlan = require("../models/MagicCoinPlan");
const { client } = require("../config/paypal");
const axios = require("axios");
require("dotenv").config();

// // Use raw body parser ONLY for this route (needed for signature verification)
// router.post(
//   "/paypal/webhook",
//   bodyParser.raw({ type: "application/json" }),
//   async (req, res) => {
//     try {
//       const transmissionId = req.headers["paypal-transmission-id"];
//       const timestamp = req.headers["paypal-transmission-time"];
//       const webhookId = process.env.PAYPAL_WEBHOOK_ID;
//       const transmissionSig = req.headers["paypal-transmission-sig"];
//       const certUrl = req.headers["paypal-cert-url"];
//       const authAlgo = req.headers["paypal-auth-algo"];
//       const rawBody = req.body.toString("utf8");

//       if (
//         !transmissionId ||
//         !timestamp ||
//         !transmissionSig ||
//         !certUrl ||
//         !authAlgo
//       ) {
//         return res.status(400).send("Missing required PayPal headers.");
//       }

//       const { data: authData } = await axios({
//         method: "post",
//         url: "https://api-m.paypal.com/v1/oauth2/token",
//         auth: {
//           username: process.env.PAYPAL_CLIENT_ID,
//           password: process.env.PAYPAL_CLIENT_SECRET,
//         },
//         headers: {
//           "Content-Type": "application/x-www-form-urlencoded",
//         },
//         data: "grant_type=client_credentials",
//       });

//       const accessToken = authData.access_token;

//       const { data: verification } = await axios.post(
//         "https://api-m.paypal.com/v1/notifications/verify-webhook-signature",
//         {
//           transmission_id: transmissionId,
//           transmission_time: timestamp,
//           cert_url: certUrl,
//           auth_algo: authAlgo,
//           transmission_sig: transmissionSig,
//           webhook_id: webhookId,
//           webhook_event: JSON.parse(rawBody),
//         },
//         {
//           headers: {
//             Authorization: `Bearer ${accessToken}`,
//             "Content-Type": "application/json",
//           },
//         }
//       );

//       console.log("Verification Response:", verification);

//       if (verification.verification_status !== "SUCCESS") {
//         return res.status(400).send("Invalid webhook signature.");
//       }

//       const eventBody = JSON.parse(rawBody);
//       if (eventBody.event_type === "PAYMENT.CAPTURE.COMPLETED") {
//         console.log("💰 Payment capture completed event received");
//         const capture = eventBody.resource;
//         const transactionId = capture.id;
//         const status = capture.status;
//         const amount = parseFloat(capture.amount.value);
//         const currency = capture.amount.currency_code;

//         console.log(`Looking for Payment with transactionId: ${transactionId}`);

//         const updated = await Payment.findOneAndUpdate(
//           { transactionId },
//           { paymentStatus: status.toLowerCase(), amount, currency }
//         );

//         if (!updated) {
//           console.warn(
//             `Payment with transaction ID ${transactionId} not found.`
//           );
//         } else {
//           // 2️⃣ Payment exists and updated ✅
//           // Now fetch the corresponding plan
//           console.log(
//             `✅ Payment updated: ${updated._id}, status: ${updated.paymentStatus}`
//           );
//           const plan = await MagicCoinPlan.findById(updated.plan_id);
//           if (!plan) {
//             console.warn(
//               `Plan with ID ${updated.plan_id} not found (means can be subscription plan).`
//             );
//           } else {
//             // 3️⃣ Add coinsOffered from plan to user's wallet
//             const user = await User.findById(updated.user_id);
//             if (!user) {
//               console.warn(`User with ID ${updated.user_id} not found.`);
//             } else {
//               user.walletCoins = (user.walletCoins || 0) + plan.coinsOffered;
//               await user.save();
//               console.log(
//                 `Added ${plan.coinsOffered} coins to user ${user._id}. Total coins: ${user.walletCoins}`
//               );
//               // ✅ Update totalCoins in Payment for history
//               updated.totalCoins = user.walletCoins;
//               await updated.save();
//             }
//           }
//         }
//       } else if (eventBody.event_type === "PAYMENT.CAPTURE.DENIED") {
//         console.log("❌ Payment capture denied event received");
//         const capture = eventBody.resource;
//         const transactionId = capture.id;
//         const status = capture.status;

//         const updated = await Payment.findOneAndUpdate(
//           { transactionId },
//           {
//             paymentStatus: status.toLowerCase(),
//           }
//         );

//         if (updated) {
//           console.log(`❌ Payment status for ${updated._id} set to declined.`);
//         } else {
//           console.warn(
//             `Payment with transaction ID ${transactionId} not found.`
//           );
//         }
//       } else if (eventBody.event_type === "PAYMENT.CAPTURE.PENDING") {
//         console.log("⏳ Payment capture pending event received");
//         const capture = eventBody.resource;
//         const transactionId = capture.id;
//         const status = capture.status;

//         const updated = await Payment.findOneAndUpdate(
//           { transactionId },
//           {
//             paymentStatus: status.toLowerCase(),
//           }
//         );

//         if (updated) {
//           console.log(`⏳ Payment status for ${updated._id} set to pending.`);
//         } else {
//           console.warn(
//             `Payment with transaction ID ${transactionId} not found.`
//           );
//         }
//       }

//       res.sendStatus(200);
//     } catch (err) {
//       console.error("Webhook error:", err?.response?.data || err.message);
//       res.status(500).send("Webhook processing error");
//     }
//   }
// );

// module.exports = router;

// Use raw body parser ONLY for this route (needed for signature verification)
router.post(
  "/paypal/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
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
        return res.status(400).send("Missing required PayPal headers.");
      }

      // 1️⃣ Get PayPal access token
      const { data: authData } = await axios({
        method: "post",
        url: "https://api-m.paypal.com/v1/oauth2/token",
        auth: {
          username: process.env.PAYPAL_CLIENT_ID,
          password: process.env.PAYPAL_CLIENT_SECRET,
        },
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        data: "grant_type=client_credentials",
      });
      const accessToken = authData.access_token;

      // 2️⃣ Verify webhook signature
      const { data: verification } = await axios.post(
        "https://api-m.paypal.com/v1/notifications/verify-webhook-signature",
        {
          transmission_id: transmissionId,
          transmission_time: timestamp,
          cert_url: certUrl,
          auth_algo: authAlgo,
          transmission_sig: transmissionSig,
          webhook_id: webhookId,
          webhook_event: JSON.parse(rawBody),
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

      const eventBody = JSON.parse(rawBody);
      const eventType = eventBody.event_type;

      // 3️⃣ Find payment in database
      const transactionId = eventBody.resource.id;
      const payment = await Payment.findOne({ transactionId });

      if (!payment) {
        console.warn(`Payment with transaction ID ${transactionId} not found.`);
        return res.sendStatus(200);
      }

      const isSubscription =
        payment.planRef === "Plan" && payment.type === "subscription";

      if (isSubscription) {
        await handleSubscription(payment, eventType, eventBody);
      } else {
        await handleOneTimePayment(payment, eventType, eventBody);
      }

      res.sendStatus(200);
    } catch (err) {
      console.error("Webhook error:", err?.response?.data || err.message);
      res.status(500).send("Webhook processing error");
    }
  }
);

/**
 * Handles one-time MagicCoinPlan payments
 */
async function handleOneTimePayment(payment, eventType, eventBody) {
  const capture = eventBody.resource;
  const status = capture.status.toLowerCase();
  const amount = parseFloat(capture.amount.value);
  const currency = capture.amount.currency_code;

  // Update payment status, amount, currency
  payment.paymentStatus = status;
  payment.amount = amount;
  payment.currency = currency;

  const plan = await MagicCoinPlan.findById(payment.plan_id);
  if (!plan)
    return console.warn(`Coin plan with ID ${payment.plan_id} not found`);

  const user = await User.findById(payment.user_id);
  if (!user) return console.warn(`User with ID ${payment.user_id} not found`);

  if (status === "completed") {
    user.walletCoins = (user.walletCoins || 0) + plan.coinsOffered;
    await user.save();
    payment.totalCoins = user.walletCoins;
    console.log(
      `Added ${plan.coinsOffered} coins to user ${user._id}. Total: ${user.walletCoins}`
    );
  }

  await payment.save();
}

/**
 * Handles subscription payments
 */
async function handleSubscription(payment, eventType, eventBody) {
  const user = await User.findById(payment.user_id);
  if (!user) return console.warn(`User with ID ${payment.user_id} not found`);

  if (
    ["BILLING.SUBSCRIPTION.ACTIVATED", "PAYMENT.SALE.COMPLETED"].includes(
      eventType
    )
  ) {
    payment.paymentStatus = "completed";
    console.log(`Subscription payment successful for user ${user._id}`);
  } else if (eventType === "PAYMENT.SALE.DENIED") {
    payment.paymentStatus = "failed";
    console.log(`Subscription payment declined for ${payment._id}`);
  } else if (eventType === "PAYMENT.SALE.PENDING") {
    payment.paymentStatus = "pending";
    console.log(`Subscription payment pending for ${payment._id}`);
  }

  await payment.save();
}

module.exports = router;
