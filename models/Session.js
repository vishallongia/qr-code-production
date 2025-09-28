const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    logo: { type: String, default: null },
    logoTitle: { type: String, default: "" },
    description: { type: String, default: "" },
    link: { type: String, default: null },
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Session", sessionSchema);
