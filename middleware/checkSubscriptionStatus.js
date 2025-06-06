const Payment = require("../models/Payment");
const QRCodeData = require("../models/QRCODEDATA"); // Adjust the path as necessary

const checkSubscriptionMiddleware = async (req, res, next) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized: User not found",
        type: "error",
      });
    }
    if (req.path.startsWith("/update/")) {
      if (req.user?.subscription?.isVip === true) {
        return next();
      }
      const qrCodeId = req.params.id;

      const isFirstQr = await QRCodeData.exists({
        code: qrCodeId,
        isFirstQr: true,
        $or: [{ user_id: userId }, { assignedTo: userId }],
      });

      if (isFirstQr) {
        // If this QR code is a free "first QR", allow update without subscription check
        return next();
      }
    }

    const existingFirstQr = await QRCodeData.exists({
      $or: [{ user_id: userId }, { assignedTo: userId }],
      isFirstQr: true,
    });

    if (!existingFirstQr) {
      return next();
    }

    if (req.user.role === "super-admin") {
      return next();
    }

    if (req.user?.subscription?.isVip === true) {
      return next();
    }

    const latestPayment = await Payment.findOne({
      user_id: userId,
      paymentStatus: "completed",
      isActive: true,
      validUntil: { $gt: new Date() }, // Ensure validUntil is greater than the current date
    }).sort({ validUntil: -1 });

    if (!latestPayment) {
      return res.status(403).json({
        message: "No subscription found. Please purchase a plan.",
        type: "hidden",
        redirectUrl: "/dashboard?showPlans=true",
      });
    }

    if (!latestPayment.isActive) {
      return res.status(403).json({
        message: "Your subscription is inactive.",
        type: "error",
        redirectUrl: "/dashboard?showPlans=true",
      });
    }

    if (
      !latestPayment.validUntil ||
      isNaN(new Date(latestPayment.validUntil).getTime())
    ) {
      return res.status(500).json({
        message: "Invalid subscription data. Please contact support.",
        type: "error",
        redirectUrl: "/dashboard?showPlans=true",
      });
    }

    const now = new Date();
    const expiry = new Date(latestPayment.validUntil);
    if (expiry < now) {
      return res.status(403).json({
        message: "Your subscription has expired. Please renew.",
        type: "error",
        redirectUrl: "/dashboard?showPlans=true",
      });
    }

    next(); // Continue to route
  } catch (err) {
    console.error("Subscription middleware error:", err);
    return res.status(500).json({
      message: "Error verifying subscription. Try again later.",
      type: "error",
    });
  }
};

module.exports = { checkSubscriptionMiddleware };
