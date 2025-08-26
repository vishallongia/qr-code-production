const mongoose = require("mongoose");

const optionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
  },
  image: {
    type: String, // URL or path to the option image
    default: null,
  },
});

const voteQuestionSchema = new mongoose.Schema(
  {
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
    },

    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      // required: true,
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [optionSchema],
      validate: {
        validator: (val) => val.length >= 2,
        message: "At least 2 options are required.",
      },
    },
    // correctAnswerIndex: {
    //   type: Number,
    //   required: true,
    //   min: 0,
    // },
    questionImage: {
      type: String, // Optional image URL or path
      default: null,
    },
    questionImageLink: {
      type: String, // Optional clickable link for the image
      default: null,
    },
    questionLogo: {
      type: String, // Optional logo image
      default: null,
    },
    mode: {
      type: String,
      enum: ["jackpot", "digital", "both", "none"], // 🎯 New option "none" added here
      default: "none", // ✅ Updated default value
      required: true,
    },
    magicCoinDeducted: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    jackpotCoinDeducted: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    digitalCoinDeducted: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    // 🎯 New Jackpot Reward Fields
    jackpotRewardName: { type: String, default: "" },
    jackpotRewardImage: { type: String, default: null },
    jackpotRewardDescription: { type: String, default: "" },
    jackpotRewardLink: { type: String, default: null },

    // 🎯 New Digital Reward Fields
    digitalRewardName: { type: String, default: "" },
    digitalRewardImage: { type: String, default: null },
    digitalRewardDescription: { type: String, default: "" },
    digitalRewardLink: { type: String, default: null },

    logo: {
      type: String,
      default: null, // Path or URL to main session logo
    },
    logoTitle: {
      type: String,
      default: "", // Optional title shown near/under the logo
    },
    logoDescription: {
      type: String,
      default: "", // Session description
    },
    logoLink: {
      type: String,
      default: null, // External or internal session link
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("VoteQuestion", voteQuestionSchema);
