// models/QuizQuestionResponse.js

const mongoose = require("mongoose");

const quizQuestionResponseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuizQuestion", // Adjust to your actual model name
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
    isCorrect: {
      type: Boolean,
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
    jackpotCoinDeducted: {
      type: Number,
      default: 0,
    },
    digitalCoinDeducted: {
      type: Number,
      default: 0,
    },

    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
    },
    isJackpotWinnerDeclared: {
      type: Boolean,
      default: false,
    },
    isDigitalWinnerDeclared: {
      type: Boolean,
      default: false,
    },
    isNoResposneGiven: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "QuizQuestionResponse",
  quizQuestionResponseSchema
);
