const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Reference to the User schema
    required: [true, "User ID is required"],
  },
  plan_id: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "planRef", // dynamic reference
    required: [true, "Plan ID is required"],
  },
  planRef: {
    type: String,
    enum: ["Plan", "MagicCoinPlan"],
    default: "Plan", // 👈 default to Plan for backward compatibility
  },
  type: {
    type: String,
    enum: ["subscription", "coin"],
    default: "subscription", // 👈 helps identify purpose
  },
  paymentMethod: {
    type: String,
    enum: ["stripe", "paypal", "manual"], // Only Stripe and PayPal are valid payment methods
    required: [true, "Payment method is required"],
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "completed", "failed", "refunded"], // Payment status
    default: "pending",
  },
  amount: {
    type: Number,
    required: [true, "Amount is required"],
  },
  currency: {
    type: String,
    default: "USD", // Default currency is USD
  },
  transactionId: {
    type: String, // Transaction ID from payment gateway (Stripe/PayPal)
    required: [true, "Transaction ID is required"],
    unique: true,
  },
  paymentDate: {
    type: Date,
    default: Date.now, // Timestamp of when payment occurred
  },
  paymentDetails: {
    type: mongoose.Schema.Types.Mixed, // Stores additional data from payment gateway (Stripe/PayPal)
  },
  validUntil: {
    type: Date, // Date the user's subscription ends
  },
  isActive: {
    type: Boolean,
    default: true, // If the subscription is still active
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  coupon: {
    type: String,
  },
  isCouponUsed: {
    type: Boolean,
    default: false,
  },
  isPaidToAffiliate: {
    type: Boolean,
    default: false, // If the subscription is still active
  },
  coupon_id: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon" },
  originalAmount: { type: Number }, // Plan price before discount
  discountAmount: { type: Number }, // Discount given to the user
  commissionAmount: { type: Number },
});

paymentSchema.pre("save", async function (next) {
  if (this.paymentStatus === "completed" && this.type === "subscription") {
    const plan = await mongoose.model("Plan").findById(this.plan_id);
    if (!plan) return next(new Error("Plan not found"));

    // Get user's latest active payment
    const latestPayment = await mongoose
      .model("Payment")
      .findOne({
        user_id: this.user_id,
        paymentStatus: "completed",
        isActive: true,
      })
      .sort({ validUntil: -1 });

    const now = new Date();
    const baseDate =
      latestPayment && latestPayment.validUntil > now
        ? latestPayment.validUntil
        : now;

    // Add plan duration
    this.validUntil = new Date(
      baseDate.getTime() + plan.durationInDays * 24 * 60 * 60 * 1000
    );
  }
  next();
});

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
