const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY); // Use your Stripe secret key
const Plan = require("../models/Plan");
const Payment = require("../models/Payment");
const {
  encryptPassword,
  decryptPassword,
} = require("../public/js/cryptoUtils");
const { client } = require("../config/paypal");

const { authMiddleware } = require("../middleware/auth");
const bodyParser = require("body-parser");

// Route to render subscription plans with encrypted IDs
router.get("/plans", authMiddleware, async (req, res) => {
  try {
    // Fetch all active plans from the database
    const plans = await Plan.find({ active: true }).sort({ durationInDays: 1 });

    // Encrypt the plan IDs
    const encryptedPlans = plans.map((plan) => {
      // Encrypt the plan ID before sending it to the client
      return {
        ...plan.toObject(), // Convert the Mongoose document to a plain object
        encryptedId: encryptPassword(plan._id.toString()), // Encrypt the plan ID
      };
    });

    const userId = req.user._id; // Assuming user is authenticated and req.user contains user info
    const latestPayment = await Payment.findOne({
      user_id: userId,
      paymentStatus: "completed",
      isActive: true,
    }).sort({ validUntil: -1 });

    let userSubscription = {
      validUntil: latestPayment ? latestPayment.validUntil : null,
      name: req.user.fullName, // Assuming req.user contains user data like name
      email: req.user.email, // Assuming req.user contains user data like email
    };

    // Render the 'plans' EJS page and pass the encrypted plans data to it
    res.render("dashboardnew", {
      plans: encryptedPlans,
      user: userSubscription,
      activeSection: "plans",
    });
  } catch (error) {
    console.error("Error fetching plans:", error);
    res.status(500).send("Error fetching plans.");
  }
});

// Route to create Stripe checkout session for a plan
router.post(
  "/stripe/create-checkout-session",
  authMiddleware,
  async (req, res) => {
    try {
      const { planId, couponCode } = req.body;
      console.log(couponCode, "watch me");

      // Decrypt the plan ID
      const decryptedPlanId = decryptPassword(planId);

      // Find the plan by decrypted ID
      const plan = await Plan.findById(decryptedPlanId);
      if (!plan) {
        return res.status(404).json({
          message: "Plan not found.",
          type: "error",
          data: null,
        });
      }

      // Check if user already used the same coupon for this plan
      if (couponCode) {
        const existingPayment = await Payment.findOne({
          user_id: req.user._id,
          plan_id: plan._id,
          isCouponUsed: true,
        });

        if (existingPayment) {
          return res.status(400).json({
            message: "You have already used this coupon for this plan.",
            type: "error",
            data: null,
          });
        }
      }

      // Check if coupon is valid (single coupon)
      let finalPrice = plan.price;

      if (couponCode) {
        const validCoupon = process.env.COUPON_CODE;
        if (couponCode.toUpperCase() !== validCoupon) {
          return res.status(400).json({
            message: "Invalid coupon code.",
            type: "error",
            data: null,
          });
        }

        // Determine price based on plan durationInDays
        const durationKey = `COUPON_PRICE_${plan.durationInDays}`;
        const couponPrice = process.env[durationKey];

        if (couponPrice !== undefined) {
          finalPrice = parseFloat(couponPrice);
        } else {
          return res.status(400).json({
            message: "Coupon not applicable for this plan.",
            type: "error",
            data: null,
          });
        }
      }

      // Create Stripe session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: plan.currency,
              product_data: {
                name: plan.name,
                description: plan.description || "",
              },
              unit_amount: Math.round(finalPrice * 100),
            },
            quantity: 1,
          },
        ],
        metadata: {
          user_id: req.user._id.toString(),
          plan_id: plan._id.toString(),
          coupon: couponCode || "",
        },
        mode: "payment",
        success_url: `${process.env.FRONTEND_URL}/successpayment?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      });

      // Send structured response
      res.status(200).json({
        message: "Checkout session created successfully",
        type: "success",
        data: {
          sessionId: session.id,
        },
      });
    } catch (error) {
      console.error("Stripe session error:", error);
      res.status(500).json({
        message: "An error occurred while creating the Stripe session",
        type: "error",
        data: null,
      });
    }
  }
);

router.get("/successpayment", async (req, res) => {
  try {
    const session = req.query.session_id;
    const payment = await Payment.findOne({ transactionId: session });

    res.render("paymentsuccess", {
      paymentStatus: payment?.paymentStatus || "pending",
      amount: payment?.amount,
      errorMessage: null, // no error
    });
  } catch (error) {
    console.error("Error fetching session:", error);
    res.render("paymentsuccess", {
      paymentStatus: "failed",
      amount: 0,
      errorMessage:
        "There was an error retrieving your payment. Please wait while we confirm the status.",
    });
  }
});

// Route to create PayPal order
router.post("/paypal/create-order", authMiddleware, async (req, res) => {
  try {
    const { planId } = req.body;
    const decryptedPlanId = decryptPassword(planId);
    const plan = await Plan.findById(decryptedPlanId);

    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const request =
      new (require("@paypal/checkout-server-sdk").orders.OrdersCreateRequest)();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: plan.currency,
            value: plan.price.toFixed(2),
          },
          custom_id: req.user._id.toString(),
          description: plan.name,
        },
      ],
    });

    const order = await client().execute(request);
    res.json({ id: order.result.id });
  } catch (err) {
    console.error("PayPal Create Order Error:", err.message);
    res.status(500).json({ error: "Unable to create PayPal order" });
  }
});

// Route to capture PayPal order
router.post("/paypal/capture-order", authMiddleware, async (req, res) => {
  try {
    const { orderID, planId } = req.body;
    const decryptedPlanId = decryptPassword(planId);
    const plan = await Plan.findById(decryptedPlanId);

    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const request =
      new (require("@paypal/checkout-server-sdk").orders.OrdersCaptureRequest)(
        orderID
      );
    request.requestBody({});

    const capture = await client().execute(request);
    const captureData = capture.result;

    const captureDetails = captureData.purchase_units[0].payments.captures[0];
    const amount = parseFloat(captureDetails.amount.value);

    await Payment.create({
      user_id: req.user._id,
      plan_id: plan._id,
      paymentMethod: "paypal",
      paymentStatus: captureDetails.status.toLowerCase(),
      amount: amount,
      currency: captureDetails.amount.currency_code,
      transactionId: captureDetails.id,
      paymentDetails: captureData,
    });

    res.json({
      message: "Payment successful",
      status: captureDetails.status,
      transactionId: captureDetails.id,
    });
  } catch (err) {
    console.error("PayPal Capture Error:", err.message);
    res.status(500).json({ error: "Capture failed" });
  }
});

module.exports = router;
