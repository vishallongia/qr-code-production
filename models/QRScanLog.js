const mongoose = require("mongoose");

const qrScanLogSchema = new mongoose.Schema(
  {
    qrCodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QRCodeData", // Reference to QR code document
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
    ip: {
      type: String,
    },
    language: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    timeZone: {
      type: String,
    },
    city: {
      type: String,
    },
    region: {
      type: String,
    },
    country: {
      type: String,
    },
    scannedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const QRScanLog = mongoose.model("QRScanLog", qrScanLogSchema);
module.exports = QRScanLog;
