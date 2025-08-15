const mongoose = require("mongoose");

const tvChannelSchema = new mongoose.Schema(
  {
    channelName: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isRunning: {
      type: Boolean,
      default: true,
      immutable: true,
    },
    typeOfRunning: {
      type: String,
      enum: ["voting", "quiz"],
    },
    logo: {
      type: String, // path to uploaded logo
      default: null,
    },
    logoTitle: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    link: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Channel", tvChannelSchema);
