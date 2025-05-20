const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Payment = require("../models/Payment");

async function recordPayment(session, status) {
  try {
    const existingPayment = await Payment.findOne({
      transactionId: session.id,
    });
    if (existingPayment) {
      console.log("Come for update");
      // Update existing record
      existingPayment.paymentStatus = status;
      existingPayment.paymentDetails = session;
      await existingPayment.save();
      console.log(`🔄 Payment updated successfully with status: ${status}`);
    } else {
      // Create new record
      console.log("Creating New Payment");

      await Payment.create({
        user_id: session.metadata.user_id,
        plan_id: session.metadata.plan_id,
        paymentMethod: "stripe",
        paymentStatus: status,
        amount: session.amount_total / 100,
        currency: session.currency.toUpperCase(),
        transactionId: session.id,
        paymentDetails: session,
        coupon: session.metadata.coupon || null,
        isCouponUsed: !!session.metadata.coupon, // ✅ set true if a coupon was use
        ...(session.metadata.coupon_id && {
          coupon_id: session.metadata.coupon_id,
        }),
        originalAmount: Number(session.metadata.original_price) || null,
        discountAmount: Number(session.metadata.discount_amount) || null,
        commissionAmount: Number(session.metadata.commission_amount) || null,
      });
      console.log(`✅ Payment created successfully with status: ${status}`);
    }
  } catch (err) {
    console.error(
      `❌ Error saving payment with status ${status}:`,
      err.message
    );
  }
}

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature verification failed.", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Log the received event type
    // console.log("📩 Received Stripe event:", event.type);

    // Log the entire session or object (pretty printed)
    // console.log(
    //   "🔍 Event data object:",
    //   JSON.stringify(event.data.object, null, 2)
    // );

    const session = event.data.object;

    try {
      // Handle checkout session completion
      if (event.type === "checkout.session.completed") {
        const paymentStatus = session.payment_status;

        // Handle payment statuses: paid, unpaid, pending
        if (paymentStatus === "paid") {
          await recordPayment(session, "completed");
        } else if (paymentStatus === "unpaid") {
          await recordPayment(session, "pending");
        } else if (paymentStatus === "pending") {
          await recordPayment(session, "pending");
        } else {
          await recordPayment(session, "failed");
        }
      }

      // Handle async payment statuses
      if (event.type === "checkout.session.async_payment_succeeded") {
        await recordPayment(session, "completed");
      }

      if (event.type === "checkout.session.async_payment_failed") {
        await recordPayment(session, "failed");
      }

      // Respond to acknowledge receipt of the event
      console.log("webhook hitted");
      res.status(200).send("Webhook received");
    } catch (err) {
      console.error("Error processing webhook event:", err.message);
      res.status(500).send(`Internal Server Error: ${err.message}`);
    }
  }
);

module.exports = router;
