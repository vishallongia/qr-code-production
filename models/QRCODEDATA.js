const mongoose = require("mongoose");
const generateCode = require("../utils/codeGenerator");



const qrCodeSchema = new mongoose.Schema(
  {
    qrName: {
      type: String,
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the User schema
    },
    type: {
      type: String,
      enum: ["media", "text", "url"], // Types of QR codes
      required: true,
    },
    url: {
      type: String,
      // required: true, // The URL of the uploaded file or provided URL
    },

    media_url: {
      type: String, // URL to the media file if applicable
    },
    text: {
      type: String, // URL to the text file if applicable
    },
    code: {
      type: String,
      required: true,
      unique: true,
    },
    qrDotColor: {
      type: String,
      required: true,
    },
    backgroundColor: {
      type: String,
      required: true,
    },
    dotStyle: {
      type: String,
      required: true,
    },
    cornerStyle: {
      type: String,
      required: true, // Make it optional
      default: "square", // Default value if not provided
    },
    applyGradient: {
      type: String,
      required: false, // Make it optional
      default: "none", // Default value if not provided
    },
    logo: {
      type: String,
    },
    ColorList: {
      type: String,
      // required: true, // Make it optional
      default: "first", // Default value if not provided
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId, // Single ObjectId
      ref: "User", // Reference to the User schema
      required: false, // Not mandatory
    },
    isDemo: {
      type: Boolean,
      default: false, // Defaults to false for user-created QR codes
    },
    isQrActivated: {
      type: Boolean,
      default: false, // QR code is not activated by default
    },
    qrNo: {
      type: String,
    },

    isFirstQr: {
      type: Boolean,
      default: false, // Defaults to false for user-created QR codes
    },
    specialOfferCouponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon", // Assuming you are referencing the Coupon model
      default: null, // Optional and defaults to empty
    },
  },
  { timestamps: true }
);

qrCodeSchema.pre("validate", async function (next) {
  if (this.code) return next();

  let unique = false;
  while (!unique) {
    const newCode = generateCode();

    const qrExists = await mongoose.models.QRCodeData.findOne({
      code: newCode,
    });
    const channelExists = await mongoose.models.Channel?.findOne({
      code: newCode,
    });

    if (!qrExists && !channelExists) {
      this.code = newCode;
      unique = true;
    }
  }

  next();
});

const QRCodeData = mongoose.models.QRCodeData || mongoose.model("QRCodeData", qrCodeSchema);
module.exports = QRCodeData;