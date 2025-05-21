const mongoose = require("mongoose");

const payoutSchema = new mongoose.Schema(
  {
    affiliate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    payoutDate: {
      type: Date,
      default: Date.now,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "cheque", "manual", "other"],
      default: "manual",
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed", // Since admin records after payment, usually 'completed'
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Payout", payoutSchema);
