const mongoose = require("mongoose");

const qrCodeSchema = new mongoose.Schema(
  {
    qrName: {
      type: String,
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the User schema
      required: true,
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
    // qr_image: {
    //   type: String,
    //   required: true, // Path to the generated QR code image
    // },
    media_url: {
      type: String, // URL to the media file if applicable
    },
    text: {
      type: String, // URL to the text file if applicable
    },
    code: {
      type: String,
      required: true,
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
      type: [mongoose.Schema.Types.ObjectId], // Array of ObjectIds
      ref: "User", // Reference to the User schema
      required: false, // Not mandatory
    },
  },
  { timestamps: true }
);

const QRCodeData = mongoose.model("QRCodeData", qrCodeSchema);
module.exports = QRCodeData;
