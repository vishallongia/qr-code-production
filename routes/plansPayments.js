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
const Coupon = require("../models/Coupon");

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

router.post(
  "/stripe/create-checkout-session",
  authMiddleware,
  async (req, res) => {
    try {
      const { planId, couponCode } = req.body;
      const decryptedPlanId = decryptPassword(planId);
      const plan = await Plan.findById(decryptedPlanId);
      if (!plan) {
        return res.status(404).json({
          message: "Plan not found.",
          type: "error",
          data: null,
        });
      }

      let finalPrice = plan.price;
      let isCouponUsed = false;
      let discountAmount = 0;
      let coupon = null;

      if (couponCode) {
        // Check if coupon exists in DB
        coupon = await Coupon.findOne({
          code: couponCode.toUpperCase(),
          isActive: true,
        });

        if (!coupon) {
          return res.status(400).json({
            message: "Invalid coupon code.",
            type: "error",
            data: null,
          });
        }

        // Check 15-day plan uniqueness
        if (plan.durationInDays === 15) {
          const existingFree15Day = await Payment.findOne({
            user_id: req.user._id,
            isCouponUsed: true,
            amount: 0,
          });

          if (existingFree15Day) {
            return res.status(400).json({
              message: "You have already used a coupon for a free 15-day plan.",
              type: "error",
              data: null,
            });
          }

          // Make finalPrice = 0 for 15-day plan
          finalPrice = 0;
          discountAmount = plan.price;
          isCouponUsed = true;
        } else {
          // For other plans apply percentage discount
          discountAmount = (coupon.discountPercent / 100) * plan.price;
          finalPrice = parseFloat((plan.price - discountAmount).toFixed(2));
          isCouponUsed = true;

          // Calculate commission from final (discounted) price
          commissionAmount = 0;
          if (coupon.commissionPercent) {
            commissionAmount = parseFloat(
              ((coupon.commissionPercent / 100) * finalPrice).toFixed(2)
            );
          }
        }
      }

      // Handle free plan logic
      if (finalPrice === 0) {
        const paymentRecord = await Payment.create({
          user_id: req.user._id,
          plan_id: plan._id,
          paymentMethod: "manual",
          paymentStatus: "completed",
          amount: 0,
          currency: plan.currency,
          transactionId: "manual_zero_txn_" + Date.now(),
          paymentDetails: {
            mode: "manual-stripe",
            reason: "Free plan or full discount coupon",
          },
          isActive: true,
          coupon: couponCode || null,
          coupon_id: coupon?._id || null,
          isCouponUsed,
          paymentDate: new Date(),
          originalAmount: plan.price,
          discountAmount: discountAmount || 0,
          commissionAmount: 0,
          coupon_id: coupon._id,
        });

        return res.status(200).json({
          message: "Free Plan activated",
          type: "success",
          data: {
            sessionId: null,
          },
        });
      }

      // Stripe session creation
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
              unit_amount: Math.round(finalPrice * 100), // cents
            },
            quantity: 1,
          },
        ],
        metadata: {
          user_id: req.user._id.toString(),
          plan_id: plan._id.toString(),
          coupon: couponCode || "",
          coupon_id: coupon?._id?.toString() || "",
          original_price: plan.price,
          discount_amount: discountAmount,
          commission_amount: commissionAmount,
        },
        mode: "payment",
        success_url: `${process.env.FRONTEND_URL}/successpayment?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      });

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
    const { planId, couponCode } = req.body;
    const decryptedPlanId = decryptPassword(planId);
    const plan = await Plan.findById(decryptedPlanId);

    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
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

    // Apply the coupon code if available
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

      // Check and apply discount based on plan's durationInDays
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

    // Check if the price is 0 (zero-dollar transaction)
    if (finalPrice === 0) {
      const paymentRecord = await Payment.create({
        user_id: req.user._id,
        plan_id: plan._id,
        paymentMethod: "manual",
        paymentStatus: "completed",
        amount: 0,
        currency: plan.currency,
        transactionId: "manual_zero_txn_" + Date.now(),
        paymentDetails: {
          mode: "manual-paypal",
          reason: "Free plan or full discount coupon",
        },
        isActive: true,
        coupon: couponCode || null,
        isCouponUsed: !!couponCode,
        paymentDate: new Date(),
      });

      return res.status(200).json({
        message: "Free Plan activated",
        type: "success",
        data: { paymentId: paymentRecord._id },
      });
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
            value: finalPrice.toFixed(2), // The discounted price or the original price,
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

router.post("/stripe/validate-coupon", authMiddleware, async (req, res) => {
  try {
    let { planId, couponCode, is15DayPlan } = req.body;

    if (!couponCode) {
      return res.status(400).json({
        message: "Coupon code is required.",
        type: "error",
        data: null,
      });
    }

    let plan;
    if (is15DayPlan) {
      plan = await Plan.findOne({ durationInDays: 15 });
    } else {
      if (!planId) {
        return res.status(400).json({
          message: "Plan ID is required.",
          type: "error",
          data: null,
        });
      }
      const decryptedPlanId = decryptPassword(planId);
      plan = await Plan.findById(decryptedPlanId);
    }

    if (!plan) {
      return res.status(404).json({
        message: "Plan not found.",
        type: "error",
        data: null,
      });
    }

    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      isActive: true,
    });

    if (!coupon) {
      return res.status(400).json({
        message: "Invalid coupon code.",
        type: "error",
        data: null,
      });
    }

    // Special logic for 15-day plan
    if (plan.durationInDays === 15) {
      const existingCouponUsage = await Payment.findOne({
        user_id: req.user._id,
        isCouponUsed: true,
        amount: 0,
      });

      if (existingCouponUsage) {
        return res.status(400).json({
          message: "You have already used a coupon for the 15-day plan.",
          type: "error",
          data: null,
        });
      }

      // No previous coupon used on 15-day plan → Activate for free
      const paymentRecord = await Payment.create({
        user_id: req.user._id,
        plan_id: plan._id,
        paymentMethod: "manual",
        paymentStatus: "completed",
        amount: 0,
        currency: plan.currency,
        transactionId: "manual_zero_txn_" + Date.now(),
        paymentDetails: {
          mode: "manual",
          reason: "Free plan activated via coupon",
        },
        isActive: true,
        coupon: coupon.code,
        isCouponUsed: true,
        paymentDate: new Date(),
        originalAmount: plan.price,
        discountAmount: 5, // fixed for 15-day free plan
        commissionAmount: 0, // always 0 for free plan
        coupon_id: coupon._id,
      });

      return res.status(200).json({
        message: "Free 15-day Plan activated",
        type: "success",
        data: {
          paymentId: paymentRecord._id,
          originalPrice: plan.price,
          discountedPrice: 0,
        },
        reload: true,
      });
    }

    // For other plans: allow same/different coupon multiple times
    const discountAmount = (coupon.discountPercent / 100) * plan.price;
    const discountedPrice = parseFloat(
      (plan.price - discountAmount).toFixed(2)
    );

    return res.status(200).json({
      message: "Coupon applied.",
      type: "success",
      data: {
        originalPrice: plan.price,
        discountedPrice,
        affiliateId: coupon.assignedToAffiliate || null,
      },
    });
  } catch (error) {
    console.error("Coupon validation error:", error);
    return res.status(500).json({
      message: "An error occurred while validating the coupon.",
      type: "error",
      data: null,
    });
  }
});

module.exports = router;
