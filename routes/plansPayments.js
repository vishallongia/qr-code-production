const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY); // Use your Stripe secret key
const Plan = require("../models/Plan");
const Payment = require("../models/Payment");
const MagicCoinPlan = require("../models/MagicCoinPlan");
const User = require("../models/User");
const {
  encryptPassword,
  decryptPassword,
} = require("../public/js/cryptoUtils");
const { client } = require("../config/paypal");
const {
  createSubscription,
  ensurePaypalPlan,
  getAccessToken,
} = require("../utils/paypalSubscription");

const { authMiddleware } = require("../middleware/auth");
const Coupon = require("../models/Coupon");
const jwt = require("jsonwebtoken");

// Route to render subscription plans with encrypted IDs
router.get("/plans", authMiddleware, async (req, res) => {
  try {
    const allowedCurrencies = ["EUR", "CHF", "HUF"];
    const queryCurrency = req.query.currency;

    // Determine active currency
    let activeCurrency = req.user?.userPreferences?.currency || null;

    if (!activeCurrency) {
      // Use query string currency if valid
      activeCurrency = allowedCurrencies.includes(queryCurrency)
        ? queryCurrency
        : "EUR";
    }
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

    const subscription = req.user.subscription || {};

    const validUntilVip = subscription.validTill
      ? new Date(subscription.validTill)
      : null;
    const isVip =
      subscription.isVip === true &&
      validUntilVip &&
      validUntilVip > new Date();

    let userSubscription = {
      validUntil: latestPayment ? latestPayment.validUntil : null,
      name: req.user.fullName, // Assuming req.user contains user data like name
      email: req.user.email, // Assuming req.user contains user data like email
      role: req.user.role,
      subscription: {
        isVip,
        validTill: validUntilVip,
      },
      isTvStation: req.user.isTvStation,
      userPreferences: req.user.userPreferences,
    };

    const needsCurrencySelection =
      !req.user.userPreferences ||
      !req.user.userPreferences.currency ||
      req.user.userPreferences.currency.trim() === "";

    res.render("dashboardnew", {
      plans: encryptedPlans,
      user: userSubscription,
      activeSection: "plans",
      needsCurrencySelection, // 👈 pass flag to frontend
      activeCurrency,
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
      let commissionAmount;

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
  const sessionId = req.query.session_id;
  const type = req.query.type || "subscription";

  try {
    // Find payment by transactionId OR subscriptionId (latest if multiple)
    let payment = await Payment.findOne({
      $or: [
        { transactionId: sessionId },
        ...(type === "subscription" ? [{ subscriptionId: sessionId }] : []),
      ],
    }).sort({ createdAt: -1 });

    res.render("paymentsuccess", {
      paymentStatus: payment?.paymentStatus || "pending",
      transactionId: sessionId,
      amount: payment?.amount || 0,
      type,
      errorMessage: null,
    });
  } catch (error) {
    console.error("Error fetching payment:", error);
    res.render("paymentsuccess", {
      paymentStatus: "failed",
      amount: 0,
      type,
      errorMessage:
        "There was an error retrieving your payment. Please wait while we confirm the status.",
    });
  }
});

// Polling endpoint for payment status
router.get("/payment/status/:sessionId", async (req, res) => {
  const sessionId = req.params.sessionId;

  try {
    // Find payment by transactionId OR subscriptionId (latest if multiple)
    const payment = await Payment.findOne({
      $or: [{ transactionId: sessionId }, { subscriptionId: sessionId }],
    }).sort({ createdAt: -1 });

    if (payment) {
      return res.status(200).json({
        status: payment.paymentStatus,
        transactionId: payment.transactionId || null,
        subscriptionId: payment.subscriptionId || null,
        amount: payment.amount || 0,
      });
    }

    res.status(404).json({ status: "not_found" });
  } catch (error) {
    console.error("Error fetching payment status:", error);
    res.status(500).json({ status: "error" });
  }
});

router.post("/paypal/create-subscription", authMiddleware, async (req, res) => {
  try {
    const {
      planId,
      couponCode,
      isMagicPlan = false,
      currency: selectedCurrency,
    } = req.body;
    const decryptedPlanId = decryptPassword(planId);

    let plan = isMagicPlan
      ? await MagicCoinPlan.findById(decryptedPlanId)
      : await Plan.findById(decryptedPlanId);

    if (!plan) return res.status(404).json({ error: "Plan not found" });

    // Validate the selected currency
    const availableCurrencies = plan.prices.map((p) => p.currency);
    if (!selectedCurrency || !availableCurrencies.includes(selectedCurrency)) {
      return res.status(400).json({
        error: `Invalid currency selected. Available currencies: ${availableCurrencies.join(
          ", "
        )}`,
      });
    }
    // Save user currency preference if not already set
    req.user.userPreferences = req.user.userPreferences || {};
    if (!req.user.userPreferences.currency) {
      req.user.userPreferences.currency = selectedCurrency;
      await req.user.save();
    }

    const currency = req.user.userPreferences.currency;

    // Get the price object for the selected currency
    const priceObj = plan.prices.find((p) => p.currency === currency);
    if (!priceObj) {
      return res
        .status(400)
        .json({ error: `Price not found for currency: ${currency}` });
    }
    let finalPrice = priceObj.amount;
    let isCouponUsed = false;
    let discountAmount = 0;
    let commissionAmount = 0;
    let coupon = null;

    // Coupon logic
    if (couponCode) {
      coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isActive: true,
      });
      if (!coupon)
        return res.status(400).json({ message: "Invalid coupon code." });

      if (plan.durationInDays === 15) {
        const existingFree15Day = await Payment.findOne({
          user_id: req.user._id,
          isCouponUsed: true,
          amount: 0,
        });
        if (existingFree15Day)
          return res
            .status(400)
            .json({ message: "Coupon already used for free plan." });

        finalPrice = 0;
        discountAmount = priceObj.amount;
        isCouponUsed = true;
      } else {
        isCouponUsed = true;
        discountAmount = coupon.discountPercent
          ? (coupon.discountPercent / 100) * priceObj.amount
          : 0;
        finalPrice = parseFloat((priceObj.amount - discountAmount).toFixed(2));
        commissionAmount = coupon.commissionPercent
          ? (coupon.commissionPercent / 100) * priceObj.amount
          : 0;
      }
    }

    // Free plan
    if (finalPrice === 0) {
      const paymentRecord = await Payment.create({
        user_id: req.user._id,
        plan_id: plan._id,
        paymentMethod: "manual",
        paymentStatus: "completed",
        amount: 0,
        currency,
        transactionId: "manual_zero_txn_" + Date.now(),
        paymentDetails: {
          mode: "manual-paypal",
          reason: "Free plan or coupon",
        },
        isActive: true,
        coupon: couponCode || null,
        coupon_id: coupon?._id || null,
        isCouponUsed,
        paymentDate: new Date(),
        originalAmount: priceObj.amount,
        discountAmount,
        commissionAmount,
      });

      return res.status(200).json({
        message: "Free Plan activated",
        type: "success",
        data: { paymentId: paymentRecord._id },
      });
    }

    const token = await getAccessToken();
    const paypalPlanId = await ensurePaypalPlan(
      plan,
      currency,
      token,
      finalPrice
    );
    const subscription = await createSubscription(
      paypalPlanId,
      req.user,
      `${process.env.FRONTEND_URL}/successpayment`,
      `${process.env.FRONTEND_URL}/cancel`,
      token,
      finalPrice,
      currency
    );

    const metaToken = jwt.sign(
      {
        originalAmount: priceObj.amount,
        discountAmount,
        commissionAmount,
        couponCode,
        coupon_id: coupon?._id,
        isCouponUsed,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ id: subscription.id, metaToken });
  } catch (err) {
    console.error("PayPal Create Order Error:", err.message);
    res.status(500).json({ error: "Unable to create PayPal order" });
  }
});

// Route to capture PayPal subscription
router.post(
  "/paypal/capture-subscription",
  authMiddleware,
  async (req, res) => {
    try {
      const {
        subscriptionID,
        planId,
        metaToken,
        isMagicPlan = false,
      } = req.body;
      const decryptedPlanId = decryptPassword(planId);

      // Pick correct model
      const planModel = isMagicPlan ? MagicCoinPlan : Plan;
      const plan = await planModel.findById(decryptedPlanId);
      if (!plan) {
        return res.status(404).json({ error: "Plan not found" });
      }

      // Verify JWT metaToken
      let metaData;
      try {
        metaData = jwt.verify(metaToken, process.env.JWT_SECRET);
      } catch (err) {
        return res.status(400).json({
          message: "Invalid token. Please refresh and try again.",
          type: "error",
        });
      }

      const {
        originalAmount = plan.price,
        discountAmount = 0,
        commissionAmount = 0,
        couponCode = null,
        coupon_id = null,
        isCouponUsed = false,
      } = metaData;

      // ✅ Fetch subscription details from PayPal
      const token = await getAccessToken();
      const response = await fetch(
        `https://api-m.sandbox.paypal.com/v1/billing/subscriptions/${subscriptionID}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const subscriptionData = await response.json();
      if (!response.ok) {
        console.error("PayPal Subscription Fetch Error:", subscriptionData);
        return res
          .status(400)
          .json({ error: "Failed to fetch PayPal subscription" });
      }

      const status = subscriptionData.status; // e.g., ACTIVE, APPROVED
      const amount =
        subscriptionData.billing_info?.last_payment?.amount?.value || 0;
      const currency =
        req.user.userPreferences?.currency ||
        subscriptionData.billing_info?.last_payment?.amount?.currency_code ||
        "EUR";

      const priceObj =
        plan.prices.find((p) => p.currency === currency) ||
        plan.prices.find((p) => p.currency === "EUR");

      if (!priceObj)
        return res
          .status(400)
          .json({ error: `Price not found for currency: ${currency}` });

      // 3️⃣ Calculate VAT from plan VAT rates
      const vatRate =
        plan.vatRates?.find((v) => v.currency === currency)?.rate || 0;
      const vatAmount = parseFloat(
        ((originalAmount * vatRate) / 100).toFixed(2)
      );
      const totalPrice = parseFloat((originalAmount + vatAmount).toFixed(2));

      // Save payment
      const paymentData = {
        user_id: req.user._id,
        plan_id: plan._id,
        planRef: isMagicPlan ? "MagicCoinPlan" : "Plan",
        type: isMagicPlan ? "coin" : "subscription",
        paymentMethod: "paypal",
        paymentStatus: "pending",
        amount: Number(amount),
        currency,
        subscriptionId: subscriptionData.id,
        transactionId: null, // will be updated via webhook later
        vatRate,
        vatAmount,
        ...(!isMagicPlan && {
          coupon: couponCode,
          isCouponUsed,
          originalAmount: Number(originalAmount),
          discountAmount: Number(discountAmount),
          commissionAmount: Number(commissionAmount),
          ...(coupon_id && { coupon_id }),
        }),
      };

      const payment = await Payment.create(paymentData);

      res.json({
        message: "Subscription captured successfully",
        status,
        subscriptionId: subscriptionData.id,
        transactionId: subscriptionData.id,
      });
    } catch (err) {
      console.error("PayPal Capture Subscription Error:", err.message);
      res
        .status(500)
        .json({ error: "Capture subscription failed", message: err.message });
    }
  }
);

// Route to create PayPal order
router.post("/paypal/create-order", authMiddleware, async (req, res) => {
  try {
    const { planId, couponCode, isMagicPlan = false, currency } = req.body;
    const decryptedPlanId = decryptPassword(planId);
    let plan;

    if (isMagicPlan) {
      plan = await MagicCoinPlan.findById(decryptedPlanId);
    } else {
      plan = await Plan.findById(decryptedPlanId);
    }

    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const allowedCurrencies = ["EUR", "CHF", "HUF"];
    let userCurrency = req.user?.userPreferences?.currency || null;

    // 1️⃣ Validate incoming currency
    if (!allowedCurrencies.includes(currency)) {
      return res.status(400).json({
        message: `Invalid currency "${currency}". Allowed: ${allowedCurrencies.join(
          ", "
        )}.`,
        type: "error",
      });
    }

    // 2️⃣ If user already has a currency, check match
    if (userCurrency && userCurrency !== currency) {
      return res.status(400).json({
        message: `Currency mismatch. Your account currency is ${userCurrency}, but you sent ${currency}.`,
        type: "error",
      });
    }

    // 3️⃣ If user has no currency, set it to incoming currency
    if (!userCurrency) {
      userCurrency = currency;
      await User.findByIdAndUpdate(req.user._id, {
        "userPreferences.currency": currency,
      });
    }

    // 4️⃣ Make sure plan matches user currency
    if (plan.currency !== userCurrency) {
      return res.status(400).json({
        message: `Plan currency is ${plan.currency}, but your account currency is ${userCurrency}.`,
        type: "error",
      });
    }

    let finalPrice = plan.price;
    let isCouponUsed = false;
    let discountAmount = 0;
    let commissionAmount = 0;
    let coupon = null;

    // Coupon logic from DB (not env)
    if (couponCode) {
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

      // Check if the user already used this coupon for a free 15-day plan
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

        finalPrice = 0;
        discountAmount = plan.price;
        isCouponUsed = true;
      } else {
        isCouponUsed = true;

        if (coupon.commissionPercent) {
          // Step 1: Calculate full commission from plan price
          commissionAmount = (coupon.commissionPercent / 100) * plan.price;

          // Step 2: Discount is a percentage of the commission
          discountAmount = (coupon.discountPercent / 100) * plan.price;

          // Step 3: Final price user pays
          finalPrice = parseFloat((plan.price - discountAmount).toFixed(2));
          console.log(finalPriceUpdated);
        } else {
          // Fallback: if no commissionPercent, calculate discount normally
          discountAmount = (coupon.discountPercent / 100) * plan.price;
          finalPrice = parseFloat((plan.price - discountAmount).toFixed(2));
          commissionAmount = 0;
        }
      }
    }

    // If the plan is free (due to coupon or by default)
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
        coupon_id: coupon?._id || null,
        isCouponUsed,
        paymentDate: new Date(),
        originalAmount: plan.price,
        discountAmount,
        commissionAmount,
      });

      return res.status(200).json({
        message: "Free Plan activated",
        type: "success",
        data: { paymentId: paymentRecord._id },
      });
    }

    const vatRate = plan.vatRate || 0;
    const vatAmount = parseFloat(((finalPrice * vatRate) / 100).toFixed(2));

    // Paid order creation with PayPal
    const request =
      new (require("@paypal/checkout-server-sdk").orders.OrdersCreateRequest)();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: plan.currency,
            value: (finalPrice + vatAmount).toFixed(2), // total = subtotal + tax
            breakdown: {
              item_total: {
                value: finalPrice.toFixed(2),
                currency_code: plan.currency,
              },
              tax_total: {
                value: vatAmount.toFixed(2),
                currency_code: plan.currency,
              },
            },
          },
          custom_id: req.user._id.toString(),
          description: plan.name,
        },
      ],
    });

    const order = await client().execute(request);
    // Create JWT token with metadata
    const metaToken = jwt.sign(
      {
        originalAmount: plan.price,
        discountAmount,
        commissionAmount,
        couponCode: couponCode || null,
        coupon_id: coupon?._id || null,
        isCouponUsed,
        vatRate,
        vatAmount,
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    // Attach extra data in metadata if needed for capture phase
    res.json({
      id: order.result.id,
      metaToken,
    });
  } catch (err) {
    console.error("PayPal Create Order Error:", err.message);
    res.status(500).json({ error: "Unable to create PayPal order" });
  }
});

// Route to capture PayPal order
router.post("/paypal/capture-order", authMiddleware, async (req, res) => {
  try {
    const { orderID, planId, metaToken, isMagicPlan = false } = req.body;
    const decryptedPlanId = decryptPassword(planId);
    // Dynamically select model
    const planModel = isMagicPlan ? MagicCoinPlan : Plan;
    const plan = await planModel.findById(decryptedPlanId);
    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    // Verify JWT metaToken
    let metaData;
    try {
      metaData = jwt.verify(metaToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({
        message: "Invalid token. Please refresh and try again.",
        type: "error",
      });
    }

    const {
      originalAmount = plan.price,
      discountAmount = 0,
      commissionAmount = 0,
      couponCode = null,
      coupon_id = null,
      isCouponUsed = false,
      vatRate = 0,
      vatAmount = 0,
    } = metaData;

    const request =
      new (require("@paypal/checkout-server-sdk").orders.OrdersCaptureRequest)(
        orderID
      );
    request.requestBody({});

    const capture = await client().execute(request);
    const captureData = capture.result;

    const captureDetails = captureData.purchase_units[0].payments.captures[0];
    const amount = parseFloat(captureDetails.amount.value);

    const paymentData = {
      user_id: req.user._id,
      plan_id: plan._id,
      planRef: isMagicPlan ? "MagicCoinPlan" : "Plan",
      type: isMagicPlan ? "coin" : "subscription",
      paymentMethod: "paypal",
      paymentStatus: "pending",
      amount,
      vatRate,
      vatAmount,
      currency: captureDetails.amount.currency_code,
      transactionId: captureDetails.id,
      paymentDetails: captureData,
      ...(!isMagicPlan && {
        coupon: couponCode,
        isCouponUsed,
        originalAmount: Number(originalAmount),
        discountAmount: Number(discountAmount),
        commissionAmount: Number(commissionAmount),
        ...(coupon_id && { coupon_id }),
      }),
    };

    // 1️⃣ Save Payment first
    const payment = await Payment.create(paymentData);

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

router.post("/validate-coupon", authMiddleware, async (req, res) => {
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

      if (discountAmount > commissionAmount) {
        return res.status(400).json({
          message: "Discount exceeds affiliate commission. Not allowed.",
          type: "error",
          data: null,
        });
      }

      // // No previous coupon used on 15-day plan → Activate for free
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

    // ⚠️ Affiliate-Funded Discount Logic
    // In this model, the discount given to the user is funded from the affiliate's commission.
    // - commissionAmount: Full commission based on the plan price.
    // - discountAmount: A portion of the commission used as a discount for the user.
    // - discountedPrice: Final amount user pays after discount.
    // Note: This ensures the site owner keeps full revenue, and the affiliate sacrifices part of their commission to offer a discount.

    // For recurring plans, pick the price based on a selected currency (default EUR)
    let selectedCurrency = req.body.currency || "EUR"; // frontend can send currency
    let planPriceObj = plan.prices?.find(
      (p) => p.currency === selectedCurrency
    );
    const planPrice = planPriceObj
      ? planPriceObj.amount
      : plan.prices[0].amount;

    // Calculate commission & discount based on selected currency price
    const commissionAmount = (coupon.commissionPercent / 100) * planPrice;
    const discountAmount = (coupon.discountPercent / 100) * planPrice;
    const discountedPrice = parseFloat((planPrice - discountAmount).toFixed(2));

    return res.status(200).json({
      message: "Coupon applied.",
      type: "success",
      data: {
        originalPrice: plan.price,
        discountedPrice,
        affiliateId: coupon.assignedToAffiliate || null,
        currency: req.user?.userPreferences?.currency || "CHF", // ✅ fallback to USD if missing
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

// GET /magic-coin-wallet
router.get("/magic-coin-wallet", authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5; // default 5
    const skip = parseInt(req.query.skip) || 0; // default 0

    const allowedCurrencies = ["EUR", "CHF", "HUF"];
    const queryCurrency = req.query.currency;

    // Determine active currency
    let activeCurrency = req.user?.userPreferences?.currency || null;

    if (!activeCurrency) {
      // Use query string currency if valid
      activeCurrency = allowedCurrencies.includes(queryCurrency)
        ? queryCurrency
        : "EUR";
    }

    const userCurrency = req.user?.userPreferences?.currency?.trim() || "CHF"; // fallback to CHF

    // 1️⃣ Fetch all active MagicCoinPlans
    const plans = await MagicCoinPlan.find({
      active: true,
      currency: activeCurrency,
    }).sort({ price: 1 });
    const encryptedPlans = plans.map((plan) => ({
      ...plan.toObject(),
      encryptedId: encryptPassword(plan._id.toString()),
    }));

    // 2️⃣ Aggregation pipeline for transactions + quiz/vote coin deductions
    const pipeline = [
      // Wallet recharge transactions
      {
        $match: { user_id: req.user._id, type: "coin" },
      },
      {
        $lookup: {
          from: "magiccoinplans",
          localField: "plan_id",
          foreignField: "_id",
          as: "planDetails",
        },
      },
      { $unwind: "$planDetails" },
      {
        $project: {
          _id: 0,
          paymentStatus: "$paymentStatus",
          coinsOffered: "$planDetails.coinsOffered",
          createdAt: "$paymentDate",
        },
      },

      // Merge quiz coin deductions
      {
        $unionWith: {
          coll: "quizquestionresponses",
          pipeline: [
            { $match: { userId: req.user._id } },
            {
              $project: {
                _id: 0,
                paymentStatus: { $literal: "deducted" },
                coinsOffered: {
                  $add: ["$jackpotCoinDeducted", "$digitalCoinDeducted"],
                },
                createdAt: "$createdAt",
              },
            },
            { $match: { coinsOffered: { $gt: 0 } } },
          ],
        },
      },

      // Merge voting coin deductions
      {
        $unionWith: {
          coll: "votequestionresponses",
          pipeline: [
            { $match: { userId: req.user._id } },
            {
              $project: {
                _id: 0,
                paymentStatus: { $literal: "deducted" },
                coinsOffered: {
                  $add: ["$jackpotCoinDeducted", "$digitalCoinDeducted"],
                },
                createdAt: "$createdAt",
              },
            },
            { $match: { coinsOffered: { $gt: 0 } } },
          ],
        },
      },
      {
        $unionWith: {
          coll: "applauseresponses",
          pipeline: [
            { $match: { userId: req.user._id, isActive: true } },
            {
              $project: {
                _id: 0,
                paymentStatus: { $literal: "deducted" },
                coinsOffered: "$magicCoinDeducted",
                createdAt: "$createdAt",
              },
            },
            { $match: { coinsOffered: { $gt: 0 } } },
          ],
        },
      },

      // Sort by date descending
      { $sort: { createdAt: -1 } },
    ];

    // --- Execute the main aggregation with pagination ---
    const transactionHistory = await Payment.aggregate([
      ...pipeline,
      { $skip: skip },
      { $limit: limit },
    ]);

    // --- Get total count of filtered transactions for hasMore ---
    const totalTransactionsAgg = await Payment.aggregate([
      ...pipeline,
      { $count: "total" },
    ]);
    const totalTransactions = totalTransactionsAgg[0]
      ? totalTransactionsAgg[0].total
      : 0;

    // --- Respond ---
    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res.json({
        plans: encryptedPlans,
        user: req.user,
        activeSection: "magic-coin",
        totalMagicCoins: req.user.walletCoins || 0,
        transactionHistory,
        hasMore: totalTransactions > skip + limit,
      });
    }

    const needsCurrencySelection =
      !req.user.userPreferences ||
      !req.user.userPreferences.currency ||
      req.user.userPreferences.currency.trim() === "";

    res.render("dashboardnew", {
      plans: encryptedPlans,
      user: req.user,
      activeSection: "magic-coin",
      totalMagicCoins: req.user.walletCoins || 0,
      transactionHistory,
      hasMore: totalTransactions > skip + limit,
      needsCurrencySelection,
      currency: userCurrency, // ✅ send currency to EJS as well
      activeCurrency,
    });
  } catch (error) {
    console.error("Error fetching magic coin wallet:", error);
    res.status(500).send("Failed to load magic coin wallet.");
  }
});

module.exports = router;
