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
      default: false,
    },
    typeOfRunning: {
      type: String,
      enum: ["voting", "quiz"],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Channel", tvChannelSchema);
