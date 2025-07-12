const mongoose = require("mongoose");

const generateCode = require("../utils/codeGenerator");
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
    code: {
      type: String,
      required: true,
      unique: true,
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

// Pre-validate hook to ensure unique code across Channel and QRCodeData
tvChannelSchema.pre("validate", async function (next) {
  if (this.code) return next();

  let unique = false;
  while (!unique) {
    const newCode = generateCode();

    const channelExists = await mongoose.models.Channel.findOne({
      code: newCode,
    });
    const qrExists = await mongoose.models.QRCodeData?.findOne({
      code: newCode,
    });

    if (!channelExists && !qrExists) {
      this.code = newCode;
      unique = true;
    }
  }

  next();
});

module.exports = mongoose.model("Channel", tvChannelSchema);
