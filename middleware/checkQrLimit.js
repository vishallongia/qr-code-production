const QRCodeData = require("../models/QRCODEDATA"); // Adjust path as per your structure
const User = require("../models/User"); // Optional if not already attached via auth

const checkQrLimit = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized", type: "error" });
    }

    // Count QR codes created or assigned to user
    const qrCount = await QRCodeData.countDocuments({
      $or: [{ user_id: user._id }, { assignedTo: user._id }],
    });

    // Default QR code limit
    let allowedQrLimit = 3;

    if (
      user.subscription?.isVip &&
      user.subscription.validTill &&
      new Date(user.subscription.validTill) > new Date()
    ) {
      allowedQrLimit = user.subscription.qrLimit || 3;
    }

    if (qrCount >= allowedQrLimit && user.role !== "super-admin") {
      return res.status(400).json({
        message: `You have reached your Magic Code limit (${allowedQrLimit}).`,
        type: "error",
      });
    }

    next(); // Allow further processing
  } catch (error) {
    console.error("Error in checkQrLimit middleware:", error);
    return res.status(500).json({
      message: "Internal Server Error while checking QR limit",
      type: "error",
    });
  }
};

module.exports = {checkQrLimit};
