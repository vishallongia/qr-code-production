const mongoose = require("mongoose");

const productResponseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product", // ✅ Reference to the Product model
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
    selectedLink: {
      type: String, // Store the link of the selected option
      default: null,
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

module.exports = mongoose.model("ProductResponse", productResponseSchema);
