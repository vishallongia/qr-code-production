const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  discountPercent: { type: Number, required: true }, // Discount for user
  commissionPercent: { type: Number, required: true }, // Commission for affiliate
  assignedToAffiliate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  isActive: { type: Boolean, default: true },
  usageCount: { type: Number, default: 0 },
  specialOffer: {
    type: {
      type: String,
      enum: ["text", "url", "media"],
    },
    text: { type: String },
    url: { type: String },
    media_url: { type: String },
  },
  createdAt: { type: Date, default: Date.now },
});

couponSchema.pre("save", function (next) {
  if (this.discountPercent !== undefined) {
    this.discountPercent = Math.round(this.discountPercent * 100) / 100;
  }
  if (this.commissionPercent !== undefined) {
    this.commissionPercent = Math.round(this.commissionPercent * 100) / 100;
  }
  next();
});

module.exports = mongoose.model("Coupon", couponSchema);
