// models/QuizQuestionResponse.js

const mongoose = require("mongoose");

const applauseResponseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Applause", // Adjust to your actual model name
      required: true,
    },
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
    },
    selectedOptionIndex: {
      type: Number,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deductCoin: {
      type: Boolean,
      default: false,
    },
    magicCoinDeducted: {
      type: Number,
      default: 0,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
    },
    isNoResponseGiven: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ApplauseResponse", applauseResponseSchema);
