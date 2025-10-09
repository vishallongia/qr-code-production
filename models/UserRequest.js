const mongoose = require("mongoose");

const userRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // what type of request user is making
    type: {
      type: String,
      enum: ["affiliate", "tvstation"],
      required: true,
    },

    // to be approved by admin
    isApprovedByAdmin: {
      type: Boolean,
      default: false,
    },

    // optional: user might withdraw or cancel request
    isCancelledByUser: {
      type: Boolean,
      default: false,
    },

    // optional: allow admin to decline
    isDeclined: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserRequest", userRequestSchema);
