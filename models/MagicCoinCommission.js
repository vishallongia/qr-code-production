const mongoose = require("mongoose");

const magicCoinCommissionSchema = new mongoose.Schema(
  {
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "appType", // dynamic reference based on appType
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // user who spent the coins
    },
    coinsUsed: {
      type: Number,
      required: true, // how many coins were spent
    },
    commissionPercent: {
      type: Number,
      default: 70, // % of coins or value to calculate commission
    },
    commissionAmount: {
      type: Number,
      default: 0, // calculated commission value
    },
    beneficiaryUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // who receives the commission
    },
    totalCoins: {
      type: Number,
      default: 0, // user’s total coins after this commission
    },
    appType: {
      type: String,
      enum: ["Quiz", "Vote", "Applause"], // matches model names
      required: true, // type of commission
    },
    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
  },
  { timestamps: true } // auto-manage createdAt & updatedAt
);

// Create the model
const MagicCoinCommission = mongoose.model(
  "MagicCoinCommission",
  magicCoinCommissionSchema
);

module.exports = MagicCoinCommission;
