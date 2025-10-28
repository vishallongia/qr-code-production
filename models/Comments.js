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
    type: String,
    default: null,
  },
  link: {
    type: String, // store the URL
    default: null,
  },
});

const commentSchema = new mongoose.Schema(
  {
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
    },

    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      // optional
    },

    question: {
      type: String,
      trim: true,
    },

    questionDescription: {
      type: String,
      default: "",
      trim: true,
    },

    options: {
      type: [optionSchema],
      validate: {
        validator: (val) => val.length >= 1,
        message: "At least 1 option is required.",
      },
    },

    questionImage: {
      type: String,
      default: null,
    },

    questionImageLink: {
      type: String,
      default: null,
    },

    logo: {
      type: String,
      default: null,
    },

    logoTitle: {
      type: String,
      default: "",
    },

    logoDescription: {
      type: String,
      default: "",
    },

    logoLink: {
      type: String,
      default: null,
    },

    linkedQRCode: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QRCodeData",
      default: null,
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

module.exports = mongoose.model("Comment", commentSchema);
