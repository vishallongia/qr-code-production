const mongoose = require("mongoose");

const winnerRequestSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
    },
    type: {
      type: String,
      enum: ["quiz", "voting"],
      required: true,
    },

    mode: {
      type: String,
      enum: ["jackpot", "digital"],
      required: true,
    },

    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "typeRef", // dynamic reference
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // WInner One
    isApprovedByAdmin: {
      type: Boolean,
      default: false,
    },
    isApprovedByUser: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeclined: {
      type: Boolean,
      default: false,
    },

    // Virtual field to determine which model to use for questionId
    typeRef: {
      type: String,
      required: true,
      enum: ["QuizQuestion", "VotingQuestion"], // add all possible ref models
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Optional: automatically set typeRef based on type
winnerRequestSchema.pre("validate", function (next) {
  if (this.type === "quiz") this.typeRef = "QuizQuestion";
  else if (this.type === "voting") this.typeRef = "VotingQuestion";
  next();
});

module.exports = mongoose.model("WinnerRequest", winnerRequestSchema);
