const mongoose = require("mongoose");

const optionSchema = new mongoose.Schema({
  text: {
    type: String,
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

const safeIdVariantSchema = new mongoose.Schema(
  {
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

    questionMessage: {
      type: String,
      default: "",
      trim: true,
    },

    linkedQRCode: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QRCodeData",
      default: null,
    },

    showSafeIdProfile: {
      type: Boolean,
      default: false,
    },

    // ⭐ REFERENCE TO MAIN SafeId MODEL ⭐
    safeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SafeId", // <-- your older model
      required: true,
    },
    generalPhoneNumber: {
      type: String,
      default: "",
      trim: true,
    },

    emergencyPhoneNumber: {
      type: String,
      default: "",
      trim: true,
    },

    otherPhoneNumber: {
      type: String,
      default: "",
      trim: true,
    },

    email: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("SafeIdVariant", safeIdVariantSchema);
