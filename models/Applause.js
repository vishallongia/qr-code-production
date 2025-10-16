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
  description: {
    type: String, // URL or path to the option image
    default: null,
  },
  magicCoinDeducted: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
});

const applauseSchema = new mongoose.Schema(
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

    questionDescription: {
      // ✅ Added field
      type: String,
      default: "", // Optional
      trim: true,
    },
    options: {
      type: [optionSchema],
      validate: {
        validator: (val) => val.length >= 1,
        message: "At least 1 options are required.",
      },
    },

    questionImage: {
      type: String, // Optional image URL or path
      default: null,
    },
    questionImageLink: {
      type: String, // Optional clickable link for the image
      default: null,
    },
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
    linkedQRCode: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QRCodeData", // Reference to the QRCodeData model
      default: null, // Optional
    },
    // ✅ New Commission Field
    commissionPercent: {
      type: Number,
      default: 70, // default commission percentage
      min: 0,
    },

    // ⬇️ Updated from single enum to array of enums
    logoMediaProfile: {
      type: [String],
      enum: ["broadcaster", "project", "episode", "custom"],
      default: [],
    },
    showLogoSection: {
      type: Boolean,
      default: true, // by default, the logo section will be shown
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Applause", applauseSchema);
