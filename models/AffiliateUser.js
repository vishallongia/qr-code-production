const mongoose = require("mongoose");

const affiliateUserSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  role: { type: String, default: "affiliate" },
  walletBalance: { type: Number, default: 0 }, // Total earned commission
  createdAt: { type: Date, default: Date.now },
  resetTokenExpiration: {
    type: Date, // This field stores the expiration time for the reset token
  },
  userPasswordKey: {
    type: String,
    minlength: [6, "Password must be at least 6 characters long"],
  },
  isActive: {
    type: Boolean,
    required: true,
    default: true,
  },
  resetToken: {
    type: String, // This field stores the reset token
  },
  resetTokenExpiration: {
    type: Date, // This field stores the expiration time for the reset token
  },
});

module.exports = mongoose.model("AffiliateUser", affiliateUserSchema);
