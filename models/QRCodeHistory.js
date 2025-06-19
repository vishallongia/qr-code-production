const mongoose = require("mongoose");

const changeSchema = new mongoose.Schema(
  {
    oldType: {
      type: String,
      enum: ["text", "media", "url"],
      required: true,
    },
    newType: {
      type: String,
      enum: ["text", "media", "url"],
      required: true,
    },
    contentValue: {
      type: String, // You can change to Mixed if value types vary
      required: true,
    },
  },
  { _id: false }
);

const qrCodeHistorySchema = new mongoose.Schema(
  {
    qrCodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QRCodeData",
      required: true,
      index: true,
    },
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    modifiedAt: {
      type: Date,
      default: Date.now,
    },
    change: {
      type: changeSchema,
      required: true,
    },
    context: {
      type: String,
      default: "user_edit",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const QRCodeHistory = mongoose.model("QRCodeHistory", qrCodeHistorySchema);
module.exports = QRCodeHistory;
