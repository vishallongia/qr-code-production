require("dotenv").config(); // Load environment variables
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcrypt");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const { authMiddleware } = require("../middleware/auth"); // Import the middleware
const { verifyAdminUser } = require("../middleware/verifyAdminUser"); // Import the middleware
const {
  checkSubscriptionMiddleware,
} = require("../middleware/checkSubscriptionStatus"); // Import the middleware
const { checkQrLimit } = require("../middleware/checkQrLimit"); // Import the middleware
const QRCodeData = require("../models/QRCODEDATA"); // Adjust the path as necessary
const Payment = require("../models/Payment");
const QRCodeHistory = require("../models/QRCodeHistory"); // Adjust path as per your folder structure
const QRScanLog = require("../models/QRScanLog"); // Adjust path if needed
const fetch = require("node-fetch");
const AffiliatePayment = require("../models/AffiliatePayment");
const Coupon = require("../models/Coupon");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const ExcelJS = require("exceljs");
// const { sendResetPasswordEmail } = require("../public/js/email-service");
const SendEmail = require("../Messages/SendEmail");
const {
  encryptPassword,
  decryptPassword,
  generateCode,
} = require("../public/js/cryptoUtils");
const MAX_FILE_SIZE = 50 * 1024 * 1024; // Max Size of media file 50 MB in bytes
// Set up multer for file uploads with custom storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Destination folder
  },
  filename: (req, file, cb) => {
    // Generate a unique ID for the filename
    const uniqueId = generateUniqueId(); // Call your unique ID function
    const ext = path.extname(file.originalname); // Extract the file extension
    const newFilename = `${uniqueId}${ext}`; // Combine unique ID and extension
    cb(null, newFilename); // Save with new filename
  },
});

// Initialize multer with custom storage and file size limit
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE }, // Set file size limit
});

// Error handler middleware to catch multer errors
const multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res
      .status(400)
      .json({ message: "File size should not exceed 50 MB", type: "error" });
  } else if (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "File upload error", type: "error" });
  }
  next();
};

// Function to generate a unique ID
function generateUniqueId() {
  return Math.random().toString(36).substring(2, 8) + Date.now().toString(36);
}

//All Routes

// Home route
router.get("/", authMiddleware, async (req, res) => {
  try {
    res.render("login"); // Send type as 'success'
  } catch (error) {
    console.error("Error generating Magic code:", error);
    res.status(500).render("login", {
      message: "Failed to load login page",
      type: "error", // Send type as 'error'
    });
  }
});

// Home route
router.get("/affiliate-login", async (req, res) => {
  try {
    res.render("affiliate-login"); // Send type as 'success'
  } catch (error) {
    console.error("Error generating Magic code:", error);
    res.status(500).render("affiliate-login", {
      message: "Failed to load login page",
      type: "error", // Send type as 'error'
    });
  }
});

// Home route
router.get("/cancel", authMiddleware, async (req, res) => {
  try {
    res.render("paymentfailed"); // Send type as 'success'
  } catch (error) {
    console.error("Error generating Magic code:", error);
    res.status(500).render("error", {
      message: "Failed to load login page",
      type: "error", // Send type as 'error'
    });
  }
});

// Home route
router.get("/scanner", authMiddleware, async (req, res) => {
  try {
    res.render("dashboardnew", { user: null, activeSection: "scanner" });
  } catch (error) {
    console.error("Error generating Magic code:", error);
    res.status(500).render("error", {
      message: "Failed to load login page",
      type: "error", // Send type as 'error'
    });
  }
});

// Register route
router.get("/register", async (req, res) => {
  try {
    res.render("register"); // Send type as 'success'
  } catch (error) {
    console.error("Error generating QR code:", error);
    res.status(500).render("login", {
      message: "Failed to generate Magic code",
      type: "error", // Send type as 'error'
    });
  }
});

// Register route
router.get("/new", async (req, res) => {
  try {
    res.render("dashboardnew"); // Send type as 'success'
  } catch (error) {
    console.error("Error generating QR code:", error);
    res.status(500).render("login", {
      message: "Failed to generate Magic code",
      type: "error", // Send type as 'error'
    });
  }
});

router.get(
  "/admindashboard/generateusers",
  authMiddleware,
  async (req, res) => {
    try {
      // Get the largest existing qrNo
      const latestQR = await QRCodeData.findOne({
        qrNo: { $regex: /^[0-9]{7}$/ }, // Only 7-digit numeric values
      })
        .sort({ qrNo: -1 }) // Get the highest one
        .limit(1);

      // Determine the next qrNo
      let startNumber = "0000001"; // Default if none exist
      if (latestQR) {
        startNumber = String(parseInt(latestQR.qrNo, 10) + 1).padStart(7, "0");
      }
      res.render("generateusers", { startNumber }); // Send type as 'success'
    } catch (error) {
      console.error("Error generating QR code:", error);
      res.status(500).render("login", {
        message: "Failed to generate Magic code",
        type: "error", // Send type as 'error'
      });
    }
  }
);

router.get(
  "/admindashboard/generatetrialusers",
  authMiddleware,
  async (req, res) => {
    try {
      // Get the largest existing user number
      const largestUser = await User.findOne(
        { email: { $regex: /^[0-9]+@magic-code\.net$/ } } // Filter only relevant emails
      )
        .sort({ email: -1 }) // Sort numerically
        .limit(1);
      // Determine the next user number
      let startNumber = "0000001"; // Default if no users exist
      if (largestUser) {
        startNumber = String(
          parseInt(largestUser.email.split("@")[0], 10) + 1
        ).padStart(7, "0");
      }
      res.render("generatetrialusers", { startNumber }); // Send type as 'success'
    } catch (error) {
      console.error("Error generating QR code:", error);
      res.status(500).render("login", {
        message: "Failed to generate Magic code",
        type: "error", // Send type as 'error'
      });
    }
  }
);

// Forgot password page
router.get("/forgotpassword/:token?", async (req, res) => {
  try {
    res.render("forgotpasswordnew"); // Send type as 'success'
  } catch (error) {
    console.error("Error generating forgotpassword page:", error);
    res.status(500).render("login", {
      message: "Error generating forgotpassword page:",
      type: "error", // Send type as 'error'
    });
  }
});

// Update User Details page prefetch
router.get("/update-user-details/:userid?", async (req, res) => {
  try {
    const { userid } = req.params;

    // Check if userid exists in the request parameters
    if (!userid) {
      return res.status(400).send("User ID is required");
    }

    // Decrypt the user ID using the decryptPassword function
    const decryptedUserId = decryptPassword(userid.toString());

    // Find the user by the decrypted ID using findOne
    const user = await User.findOne({ _id: decryptedUserId });

    // Check if user exists
    if (!user) {
      return res.status(404).send("User not found");
    }

    user.decryptPassword = decryptPassword(user.userPasswordKey);
    // Render the updateuser page with the user data
    res.render("updateuser", {
      user, // Send the user data to the EJS template
    });
  } catch (error) {
    console.error("Error generating update user page", error);
    res.status(500).render("login", {
      message: error.message,
      type: "error", // Send type as 'error'
    });
  }
});

router.get("/assign-qr-code/:qrCodeId?", async (req, res) => {
  try {
    const { qrCodeId } = req.params;

    // Check if qrCodeId exists in the request parameters
    if (!qrCodeId) {
      return res.status(400).send("Magic Code ID is required");
    }

    // Decrypt the qr ID using the decryptPassword function
    const decryptedQrId = decryptPassword(qrCodeId.toString());
    // Find the QR code by its ID using findOne
    const qrCode = await QRCodeData.findOne({ _id: decryptedQrId });

    // Check if QR code exists
    if (!qrCode) {
      return res.status(404).send("QR Code not found");
    }

    // Check if QR code is already assigned and isQrActivated is true
    if (qrCode.assignedTo && qrCode.isDemo) {
      // Render the assign QR code page with the QR code data
      return res.render("assignqrcode", {
        qrCode, // Send the QR code data to the EJS template
        showPopup: true,
      });
    }

    // Render the assign QR code page with the QR code data
    return res.render("assignqrcode", {
      qrCode, // Send the QR code data to the EJS template
      showPopup: false,
    });
  } catch (error) {
    console.error("Error generating assign Magic code page", error);
    res.status(500).render("login", {
      message: error.message,
      type: "error", // Send type as 'error'
    });
  }
});

router.get("/assign-mc-to-your/:qrCodeId?", async (req, res) => {
  try {
    const { qrCodeId } = req.params;

    // Check if qrCodeId exists in the request parameters
    if (!qrCodeId) {
      return res.status(400).send("Magic Code ID is required");
    }

    // Decrypt the qr ID using the decryptPassword function
    const decryptedQrId = decryptPassword(qrCodeId.toString());
    // Find the QR code by its ID using findOne
    const qrCode = await QRCodeData.findOne({ _id: decryptedQrId });

    // Check if QR code exists
    if (!qrCode) {
      return res.status(404).send("QR Code not found");
    }

    // Check if QR code is already assigned and isQrActivated is true
    if (qrCode.assignedTo && qrCode.isDemo) {
      // Render the assign QR code page with the QR code data
      return res.render("assignqrcode-new", {
        qrCode, // Send the QR code data to the EJS template
        showPopup: true,
      });
    }

    // Render the assign QR code page with the QR code data
    return res.render("assignqrcode-new", {
      qrCode, // Send the QR code data to the EJS template
      showPopup: false,
    });
  } catch (error) {
    console.error("Error generating assign Magic code page", error);
    res.status(500).render("login", {
      message: error.message,
      type: "error", // Send type as 'error'
    });
  }
});

//Assignment of QRCode
router.post("/assign-qr-code", async (req, res) => {
  const { email, encId, couponCode, checkFreeCoupon } = req.body;

  try {
    if (!email) {
      return res
        .status(400)
        .json({ message: "Please provide an email", type: "error" });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ message: "Please provide a valid email", type: "error" });
    }

    // Decrypt the encrypted QR code ID (encId)
    const decryptedQrCodeId = decryptPassword(encId);

    // Find the QR code using the decrypted QR code ID
    const qrCodeData = await QRCodeData.findById(decryptedQrCodeId);

    if (!qrCodeData) {
      return res
        .status(404)
        .json({ message: "Magic Code not found", type: "error" });
    }

    // Check if QR code is already assigned and isQrActivated is true
    if (qrCodeData.assignedTo && qrCodeData.isDemo) {
      return res.status(400).json({
        message: "QR code is already assigned and activated",
        type: "error",
      });
    }

    let user;

    // Find the user by email
    user = await User.findOne({ email });

    if (user) {
      // Count QR codes created or assigned to this user
      const qrCount = await QRCodeData.countDocuments({
        $or: [{ user_id: user._id }, { assignedTo: user._id }],
      });

      // Default allowed QR limit
      let allowedQrLimit = 3;

      if (
        user.subscription?.isVip &&
        user.subscription.validTill &&
        new Date(user.subscription.validTill) > new Date()
      ) {
        allowedQrLimit = user.subscription.qrLimit || 3;
      }

      // If limit reached, prevent assignment
      if (qrCount >= allowedQrLimit) {
        return res.status(400).json({
          message: `QR Code limit of ${allowedQrLimit} reached for this user.`,
          type: "error",
        });
      }
    } else {
      // Create a new user if the user does not exist
      const randomPassword = Math.random().toString(36).slice(-8); // Generate a random password
      let usernameAsPW = email.split("@")[0];
      const hashedPassword = await bcrypt.hash(usernameAsPW, 10);
      const encryptedPassword = encryptPassword(usernameAsPW);

      user = new User({
        fullName: "New User",
        email,
        password: hashedPassword,
        userPasswordKey: encryptedPassword,
      });

      await user.save();
    }

    //Check if user has any isFirstQr: true QR code assigned
    const hasFirstQr = await QRCodeData.exists({
      $or: [{ user_id: user._id }, { assignedTo: user._id }],
      isFirstQr: true,
    });

    if (hasFirstQr && checkFreeCoupon) {
      return res.status(200).json({
        message: "Popup Shown",
        type: "hidden",
        hasFirstQr: Boolean(hasFirstQr),
      });
    }

    if (qrCodeData.assignedTo !== user._id) {
      const existingFirstQr = await QRCodeData.findOne({
        $or: [{ user_id: user._id }, { assignedTo: user._id }],
        isFirstQr: true,
      });

      if (!existingFirstQr) {
        qrCodeData.isFirstQr = true;
      }

      qrCodeData.assignedTo = user._id; // Assign the user._id directly
      qrCodeData.isQrActivated = true;

      // Update desired fields
      qrCodeData.set({
        type: "text",
        text: "Your Message",
        isQrActivated: true,
      });

      // Remove the 'url' field if it exists
      if ("url" in qrCodeData) {
        qrCodeData.set("url", undefined);
      }
      await qrCodeData.save();
    }

    // Generate JWT token valid for 10 minutes
    const magicToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.MAGIC_LINK_JWT_EXPIRATION }
    );

    const encryptedQrCodeId = encryptPassword(decryptedQrCodeId); // re-encrypt to pass in link safely
    const magicLink = `${process.env.FRONTEND_URL}/verify-magiclink/${magicToken}?qid=${encryptedQrCodeId}`;

    // Email configuration
    const sender = {
      email: "arnoldschmidt@magic-code.net",
      name: "Magic Code - Login Link",
    };
    if (couponCode) {
      const normalizedCode = couponCode.trim().toUpperCase();

      await User.updateOne(
        { _id: user._id },
        { $addToSet: { couponCodes: normalizedCode } }
      );

      // Re-fetch updated user
      user = await User.findById(user._id);
    }

    const coupons = user.couponCodes || [];

    // If no coupons, show a single message box
    const couponBoxesHtml =
      coupons.length > 0
        ? coupons
            .map((code) => `<div class="code-box">${code}</div>`)
            .join("\n")
        : `<div class="code-box">No coupon codes used yet.</div>`;

    const couponSection = couponCode
      ? `
  <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
  <h2>Claim Your Free 15-Day Premium Plan!</h2>
  <p>Enjoy <strong>15 days of our premium plan — completely free!</strong> Use the coupon code below at checkout:</p>
  <p>Coupons which you can use:</p>
  ${couponBoxesHtml}
  <p>Don’t miss out — this offer is limited!</p>
  `
      : "";

    const contentCoupon = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login with Magic Link</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 30px auto;
      background: #ffffff;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      text-align: center;
    }
    h2 {
      color: #333;
    }
    p {
      color: #555;
      font-size: 16px;
      line-height: 1.5;
    }
    .btn {
      display: inline-block;
      background: #007bff;
      color: #ffffff;
      padding: 12px 20px;
      text-decoration: none;
      border-radius: 5px;
      font-size: 16px;
      margin-top: 20px;
    }
    .code-box {
      font-size: 18px;
      background-color: #f0f0f0;
      padding: 10px 15px;
      border-radius: 5px;
      display: inline-block;
      margin-top: 10px;
      font-weight: bold;
      color: #d63384;
    }
    .footer {
      margin-top: 30px;
      font-size: 14px;
      color: #888;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2>Activate Your Magic Code</h2>
    <p>Hi ${user.fullName},</p>
    <p>Click the Magic Link below to securely log In to your account. </p>
    <a href="${magicLink}" class="btn">ACTIVATE</a>
    <p>Your Password is the characters before the @ in your e-mail address. You can change this any time.</p>
    ${couponSection}
    <p class="footer">&copy; 2025 Magic Code | All rights reserved.</p>
  </div>
</body>
</html>
`;

    // Send the magic link email
    SendEmail(sender, user.email, "Your Magic Link to Login", contentCoupon);

    //Clear cookies (if needed)
    res.clearCookie("token", { httpOnly: false });
    res.clearCookie("userId", { httpOnly: false });

    res.status(200).json({
      message: "Magic link sent to your email",
      type: "success",
    });
  } catch (error) {
    console.error("Error processing magic link:", error);
    res.status(500).json({ message: "An error occurred", type: "error" });
  }
});

// User's QR View By Admin with Pagination
router.get("/admindashboard/qr/:userId", authMiddleware, async (req, res) => {
  const { userId } = req.params;
  const currentPage = parseInt(req.query.page) || 1; // Default to page 1 if not provided
  const recordsPerPage = Number(process.env.USER_QR_PER_PAGE) || 5; // Adjust the number of records per page as needed

  try {
    // Count total QR codes for the given user
    const totalQRCodes = await QRCodeData.countDocuments({
      $or: [
        { user_id: userId }, // QR codes created by the user
        { assignedTo: userId }, // QR codes assigned to the user (array check)f
      ],
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalQRCodes / recordsPerPage);

    // Calculate records to skip
    const skip = (currentPage - 1) * recordsPerPage;

    // Fetch paginated QR details for the user (created by or assigned to them)
    const qrDetails = await QRCodeData.find({
      $or: [
        { user_id: userId }, // QR codes created by the user
        { assignedTo: userId }, // QR codes assigned to the user (array check)f
      ],
    })
      .select("qrName type code url text")
      .skip(skip)
      .limit(recordsPerPage);

    if (!qrDetails || qrDetails.length === 0) {
      return res.status(404).render("usersqr", {
        message: "No QR details found for the specified user",
        type: "success", // Changed to 'empty' type for clarity
        data: [],
        currentPage,
        totalPages: 1,
      });
    }
    // Render the QR details view with pagination
    res.render("usersqr", {
      message: "Magic Code details fetched successfully",
      qrDetails,
      currentPage,
      totalPages,
      FRONTEND_URL: process.env.FRONTEND_URL,
    });
  } catch (error) {
    console.error("Error fetching QR details:", error);

    // Render error page with an error message
    res.status(500).render("usersqr", {
      message: "An error occurred while fetching Magic Code details",
      type: "error",
      data: [],
      currentPage: 1,
      totalPages: 0,
    });
  }
});

// Update user active status
router.post("/admindashboard/toggle-status", async (req, res) => {
  const { userId } = req.body;
  const { isActive } = req.body;

  try {
    // Find the user by ID and update their 'isActive' status
    const user = await User.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found", type: "error" });
    }

    // Send the updated user back in the response
    res.json({ message: "User status updated", user, type: "success" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error changing status", type: "error" });
  }
});

// Toggle VIP status
router.post("/admindashboard/assign-vip", async (req, res) => {
  const { userId, validTill, qrLimit } = req.body;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found", type: "error" });
    }

    // If trying to set VIP and user is already VIP
    if (user.subscription.isVip) {
      return res.status(400).json({
        message: "User is already a VIP",
        type: "error",
      });
    }

    // Update VIP-related fields
    user.subscription.isVip = true;
    if (validTill) {
      user.subscription.validTill = new Date(validTill);
    } else {
      user.subscription.validTill = null;
    }

    // ✅ Set QR limit inside subscription
    user.subscription.qrLimit = qrLimit ? parseInt(qrLimit, 10) : 3;

    await user.save();

    res.json({ message: "VIP status updated", user, type: "success" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error updating VIP status", type: "error" });
  }
});

// Set user role to affiliate
router.post("/admindashboard/make-affiliate", async (req, res) => {
  const { userId } = req.body;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found", type: "error" });
    }

    user.role = "affiliate";
    await user.save();

    res.json({ message: "User role updated to affiliate", type: "success" });
  } catch (error) {
    console.error("Affiliate role update error:", error);
    res.status(500).json({
      message: "Internal server error",
      type: "error",
    });
  }
});

// Update existing VIP details
router.post("/admindashboard/update-vip", async (req, res) => {
  const { userId, validTill, qrLimit } = req.body;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found", type: "error" });
    }

    // Update only if user is already VIP
    if (!user.subscription.isVip) {
      return res.status(400).json({
        message: "User is not currently a VIP",
        type: "error",
      });
    }

    // Update VIP-related fields
    user.subscription.validTill = validTill ? new Date(validTill) : null;
    user.subscription.qrLimit = qrLimit
      ? parseInt(qrLimit, 10)
      : user.subscription.qrLimit;

    await user.save();

    res.json({ message: "VIP details updated", user, type: "success" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error updating VIP details", type: "error" });
  }
});

// Admin Dashboard Page with Pagination and Decryption for Visible Users
// router.get("/admindashboard", authMiddleware, async (req, res) => {
//   try {
//     // Get current page from query params, default to 1 if not provided
//     const currentPage = parseInt(req.query.page) || 1;
//     const recordsPerPage = Number(process.env.USER_PER_PAGE) || 1;

//     const totalUsers = await User.countDocuments({
//       role: "user",
//       $or: [
//         { "subscription.isVip": { $exists: false } },
//         { "subscription.isVip": false },
//       ],
//     });

//     // Calculate total pages (ceil to the nearest whole number)
//     const totalPages = Math.ceil(totalUsers / recordsPerPage);

//     // Calculate the number of users to skip
//     const skip = (currentPage - 1) * recordsPerPage;

//     const users = await User.aggregate([
//       {
//         $match: {
//           role: "user",
//           $or: [
//             { "subscription.isVip": { $exists: false } },
//             { "subscription.isVip": false },
//           ],
//         },
//       }, // Exclude admin users
//       {
//         $lookup: {
//           from: "qrcodedatas",
//           let: { userId: "$_id" },
//           pipeline: [
//             {
//               $match: {
//                 $expr: {
//                   $or: [
//                     { $eq: ["$user_id", "$$userId"] }, // Count QR codes the user created
//                     { $eq: ["$assignedTo", "$$userId"] }, // Count QR codes assigned to them (direct equality), // Count QR codes assigned to them
//                   ],
//                 },
//               },
//             },
//           ],
//           as: "qrData",
//         },
//       },
//       {
//         $project: {
//           _id: 1,
//           fullName: 1,
//           email: 1,
//           role: 1,
//           isActive: 1,
//           userPasswordKey: 1,
//           qrCount: { $size: "$qrData" }, // Total count (created + assigned)
//         },
//       },
//     ])
//       .skip(skip)
//       .limit(recordsPerPage);
//     // Decrypt passwords only for the users on the current page
//     users.forEach((user) => {
//       if (user.userPasswordKey) {
//         user.userPasswordKey = decryptPassword(user.userPasswordKey); // Decrypt the password
//       }
//       user.encryptedId = encryptPassword(user._id.toString()); // Encrypt the ObjectId string
//     });
//     // Render the dashboard with the users data and pagination info
//     res.render("admindashboard", {
//       users,
//       currentPage,
//       totalPages,
//       totalUsers,
//       FRONTEND_URL: process.env.FRONTEND_URL,
//     });
//   } catch (error) {
//     console.error("Error loading Admin Dashboard:", error);
//     res.status(500).render("login", {
//       message: "Failed to load Admin Dashboard",
//       type: "error", // Send type as 'error'
//     });
//   }
// });

router.get("/admindashboard", authMiddleware, async (req, res) => {
  try {
    const currentPage = parseInt(req.query.page) || 1;
    const recordsPerPage = Number(process.env.USER_PER_PAGE) || 1;
    const search = req.query.search ? req.query.search.trim() : "";

    // Base match conditions
    const baseMatch = {
      role: "user",
      $or: [
        { "subscription.isVip": { $exists: false } },
        { "subscription.isVip": false },
      ],
    };

    // If search query exists, add regex filter on fullName or email
    if (search) {
      baseMatch.$and = [
        {
          $or: [
            { fullName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        },
      ];
    }

    const totalUsers = await User.countDocuments(baseMatch);
    const totalPages = Math.ceil(totalUsers / recordsPerPage);
    const skip = (currentPage - 1) * recordsPerPage;

    const users = await User.aggregate([
      { $match: baseMatch },
      {
        $lookup: {
          from: "qrcodedatas",
          let: { userId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$user_id", "$$userId"] },
                    { $eq: ["$assignedTo", "$$userId"] },
                  ],
                },
              },
            },
          ],
          as: "qrData",
        },
      },
      {
        $project: {
          _id: 1,
          fullName: 1,
          email: 1,
          role: 1,
          isActive: 1,
          userPasswordKey: 1,
          qrCount: { $size: "$qrData" },
        },
      },
    ])
      .skip(skip)
      .limit(recordsPerPage);

    users.forEach((user) => {
      if (user.userPasswordKey) {
        user.userPasswordKey = decryptPassword(user.userPasswordKey);
      }
      user.encryptedId = encryptPassword(user._id.toString());

      // Generate a JWT token for each user
      const magicToken = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.MAGIC_LINK_JWT_EXPIRATION || "24h" }
      );

      // Append magic link to the user object
      user.magicLink = `${process.env.FRONTEND_URL}/verify-magiclink/${magicToken}`;
    });

    res.render("admindashboard", {
      users,
      currentPage,
      totalPages,
      totalUsers,
      FRONTEND_URL: process.env.FRONTEND_URL,
      search,
    });
  } catch (error) {
    console.error("Error loading Admin Dashboard:", error);
    res.status(500).render("login", {
      message: "Failed to load Admin Dashboard",
      type: "error",
    });
  }
});

router.get(
  "/admindashboard/demo-user-dashboard",
  authMiddleware,
  async (req, res) => {
    try {
      // Get current page from query params, default to 1 if not provided
      const currentPage = parseInt(req.query.page) || 1;
      const recordsPerPage = Number(process.env.USER_PER_PAGE) || 1;

      const totalQrCodes = await QRCodeData.countDocuments({
        isDemo: true,
        assignedTo: { $exists: false },
      });

      // Calculate total pages (ceil to the nearest whole number)
      const totalPages = Math.ceil(totalQrCodes / recordsPerPage);

      // Calculate the number of users to skip
      const skip = (currentPage - 1) * recordsPerPage;

      // Fetch demo-users and count their QR codes in a single query
      const qrCodes = await QRCodeData.find({
        isDemo: true,
        assignedTo: { $exists: false },
      })
        .skip(skip)
        .limit(recordsPerPage);

      // Decrypt passwords only for the users on the current page
      qrCodes.forEach((user) => {
        user.encryptedId = encryptPassword(user._id.toString()); // Encrypt the ObjectId string

        // Encrypt the QR code ID
        user.encryptedQrId = encryptPassword(user._id.toString());
        user.code = user.code;
      });

      // Render the dashboard with the demo-users data and pagination info
      res.render("demouserdashboard", {
        qrCodes,
        currentPage,
        totalPages,
        totalQrCodes,
        FRONTEND_URL: process.env.FRONTEND_URL,
      });
    } catch (error) {
      console.error("Error loading Demo User Dashboard:", error);
      res.status(500).render("login", {
        message: "Failed to load Demo User Dashboard",
        type: "error", // Send type as 'error'
      });
    }
  }
);

//Export Demo Users
router.get("/admindashboard/export-users", authMiddleware, async (req, res) => {
  try {
    const qrCodes = await QRCodeData.aggregate([
      {
        $match: { isDemo: true }, // Only demo QR codes
      },
      {
        $project: {
          _id: 0,
          qrCode: "$code",
          qrCodeLink: {
            $concat: ["https://analog-magic-code.netlify.app/?code=", "$code"],
          },
          qrName: 1, // Include qrName
          qrNo: 1, // Include qrNo
        },
      },
    ]);

    // users.forEach((user) => {
    //   if (user.userPasswordKey) {
    //     user.userPasswordKey = decryptPassword(user.userPasswordKey);
    //   }
    //   if (user.qrCode) {
    //     user.qrCodeLink = `https://analog-magic-code.netlify.app/?code=${user.qrCode}`;
    //   }
    // });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Users");
    worksheet.columns = [
      // { header: "Full Name", key: "fullName", width: 20 },
      // { header: "Email", key: "email", width: 25 },
      // { header: "Password", key: "userPasswordKey", width: 20 },
      // { header: "QR Count", key: "qrCount", width: 10 },
      // { header: "Active", key: "isActive", width: 10 },
      { header: "No.", key: "qrNo", width: 10 },
      { header: "Name", key: "qrName", width: 10 },
      { header: "Code", key: "qrCode", width: 10 },
      { header: "Link", key: "qrCodeLink", width: 30 },
    ];

    qrCodes.forEach((qr) => {
      worksheet.addRow(qr);
    });

    // users.forEach((user) => {
    //   worksheet.addRow(user);
    // });

    res.setHeader("Content-Disposition", "attachment; filename=users.xlsx");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting users:", error);
    res.status(500).json({ message: "Failed to export users", type: "error" });
  }
});

// Login route
router.post("/login", async (req, res) => {
  const { email, password, avoidAffiliate } = req.body;

  try {
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid email or password", type: "error" });
    }

    // Check if the user is active
    if (!user.isActive) {
      return res.status(403).json({
        message: "Account inactive. Please contact the administrator.",
        type: "error",
      });
    }

    // if (avoidAffiliate && user.role === "affiliate") {
    //   return res.status(403).json({
    //     message: "Please go to affiliate login page",
    //     type: "error",
    //   });
    // }

    // if (!avoidAffiliate && user.role !== "affiliate") {
    //   return res.status(403).json({
    //     message: "Please go to the user login page",
    //     type: "error",
    //   });
    // }
    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ message: "Invalid email or password", type: "error" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION }
    );
    // Set token and user ID in cookies

    // res.cookie("token", token, {
    //   httpOnly: false,
    //   maxAge: Number(process.env.COOKIE_EXPIRATION),
    // }); // Expires in 1 hour
    // res.cookie("userId", user._id.toString(), {
    //   httpOnly: false,
    //   maxAge: 3600000,
    // });

    res.cookie("token", token, {
      httpOnly: true, // More secure — prevents JavaScript access
      secure: true, // Required for iOS/Safari under HTTPS
      sameSite: "Lax", // Works well for same-domain setups
      maxAge: Number(process.env.COOKIE_EXPIRATION),
    });

    let qrCodeDataId = null;

    // If user is a demo-user, fetch QRCodeData matching user ID
    if (user.role === "demo-user") {
      const qrCodeData = await QRCodeData.findOne({ user_id: user._id }).select(
        "_id"
      );

      if (qrCodeData) {
        qrCodeDataId = qrCodeData._id.toString(); // Convert to plain string
      }
    }

    res.status(200).json({
      message: "Login successful",
      token,
      type: "success",
      role: user.role,
      qrCodeDataId,
    });
  } catch (error) {
    console.error("Error during login:", error);
    res
      .status(500)
      .json({ message: "An error occurred during login", type: "error" });
  }
});

// Token verification endpoint
router.get("/verify-token/:token", async (req, res) => {
  const { token } = req.params;

  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if the user exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(400).json({ message: "User not found", type: "error" });
    }

    // Check if the token has expired
    if (user.resetTokenExpiration < Date.now()) {
      return res
        .status(400)
        .json({ message: "Token has expired", type: "error" });
    }

    // If the token is valid, no message is returned
    res.status(200).send({ email: user.email }); // Send an empty response for valid tokens
  } catch (error) {
    console.error("Error during token verification:", error.name);
    if (error.name === "JsonWebTokenError") {
      // Handle expired token error specifically
      return res.status(400).json({
        message: "Token has expired or Invalid",
        type: "error",
      });
    }
    if (error.name === "TokenExpiredError") {
      // Handle expired token error specifically
      return res.status(400).json({
        message: "Token has expired or Invalid",
        type: "error",
      });
    } else {
      res.status(500).json({
        message: "An error occurred during token verification",
        type: "error",
      });
    }
  }
});

// Forgot Password or Reset Password
// Reset Password Request API (Send Reset Link)
router.post("/reset-password", async (req, res) => {
  const { email } = req.body;

  try {
    // Check if user exists
    if (!email) {
      return res
        .status(400)
        .json({ message: "Please provide email", type: "error" });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ message: "No user found with this email", type: "error" });
    }

    // Generate a secure token for password reset
    const resetToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.Reset_Password_JWT_EXPIRATION } // Token expires in 1 hour
    );

    // Store the token in the database (optional, for additional validation)
    user.resetToken = resetToken;
    user.resetTokenExpiration = Date.now() + 60 * 60 * 1000; // Token expires in 1 hour
    await user.save();

    // Generate the reset link (replace process.env.FRONTEND_URL with your frontend URL)
    const resetLink = `${process.env.FRONTEND_URL}/forgotpassword/${resetToken}`;

    // Send the reset link via email using Brevo
    // await sendResetPasswordEmail(user.email, resetLink);

    const sender = {
      email: "arnoldschmidt@magic-code.net",
      name: `Magic Code - Password Reset`,
    };

    let content = `
        <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
            }
            .container {
                max-width: 600px;
                margin: 30px auto;
                background: #ffffff;
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                text-align: center;
            }
            h2 {
                color: #333;
            }
            p {
                color: #555;
                font-size: 16px;
                line-height: 1.5;
            }
            .btn {
                display: inline-block;
                background: #007bff;
                color: #ffffff;
                padding: 12px 20px;
                text-decoration: none;
                border-radius: 5px;
                font-size: 16px;
                margin-top: 20px;
            }
            .footer {
                margin-top: 20px;
                font-size: 14px;
                color: #888;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Reset Your Password</h2>
            <p>Hi ${user.fullName},</p>
            <p>We received a request to reset your password for the account associated with ${user.email}.</p>
            <p>Click the button below to set a new password:</p>
            <a href="${resetLink}" class="btn">Reset Password</a>
            <p>If you did not request this change, you can safely ignore this email.</p>
            <p class="footer">&copy; 2025 Magic Code | All rights reserved.</p>
        </div>
    </body>
    </html>
    
        `;

    SendEmail(
      sender,
      user.email,
      "Password Reset of your Magic Code Account",
      content
    );

    res.status(200).json({
      message: "Password reset link sent to your email",
      type: "success",
    });
  } catch (error) {
    console.error("Error during password reset:", error);
    res.status(500).json({
      message: "An error occurred during password reset",
      type: "error",
    });
  }
});

// Handle the password reset form submission
router.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(400).json({ message: "User not found", type: "error" });
    }

    // Check if the resetToken is present
    if (!user.resetToken) {
      return res
        .status(400)
        .json({ message: "Invalid or missing reset token", type: "error" });
    }

    // Check if the token has expired
    if (user.resetTokenExpiration < Date.now()) {
      return res
        .status(400)
        .json({ message: "Token has expired", type: "error" });
    }

    // Hash the new password and update it
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const encryptedPassword = encryptPassword(newPassword);
    user.userPasswordKey = encryptedPassword;
    user.password = hashedPassword;
    user.resetToken = undefined; // Clear reset token after successful use
    user.resetTokenExpiration = undefined; // Clear token expiration
    await user.save();

    // Set token in cookies
    res.cookie("token", token, {
      httpOnly: false,
      maxAge: Number(process.env.COOKIE_EXPIRATION),
    }); // Expires in 1 hour

    res.status(200).json({
      message: "Password reset successful",
      type: "success",
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      // Handle expired token error specifically
      return res.status(400).json({
        message: "Token has expired",
        type: "error",
      });
    } else {
      res.status(500).json({
        message: "An error occurred during password reset",
        type: "error",
      });
    }
  }
});

// Registration Route
router.post("/register", verifyAdminUser, async (req, res) => {
  const { fullName, email, password, role = "user" } = req.body;
  const currentUser = req.user || null; // Authenticated user who is trying to register someone
  // Only set cookie and return token if it's self-registration (non-admin creating own account)
  const isSelfRegistration = !currentUser || currentUser.role !== "admin";

  try {
    // ✅ Only admin can create affiliate users
    if (role === "affiliate" && currentUser.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can create affiliate users.",
        type: "error",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "Email already in use",
        type: "error",
      });
    }

    // Hash the password and save user
    const hashedPassword = await bcrypt.hash(password, 10);
    // Encrypt the password for frontend display or admin use
    const encryptedPassword = encryptPassword(password);
    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      userPasswordKey: encryptedPassword,
      role,
    });
    await newUser.save();

    // Generate JWT token for the new user
    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION }
    );

    // Set token in cookies
    // res.cookie("token", token, {
    //   httpOnly: false,
    //   maxAge: Number(process.env.COOKIE_EXPIRATION),
    // }); // Expires in 1 Year

    if (isSelfRegistration) {
      res.cookie("token", token, {
        httpOnly: true, // More secure — prevents JavaScript access
        secure: true, // Required for iOS/Safari under HTTPS
        sameSite: "Lax", // Works well for same-domain setups
        maxAge: Number(process.env.COOKIE_EXPIRATION),
      });
    }

    // Send success response with token
    res.status(201).json({
      message: "Registration successful!",
      token,
      type: "success",
      redirect:
        role === "affiliate"
          ? `/admindashboard/affiliate/affiliate-user/${newUser._id}`
          : null,
    });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({
      message: "An error occurred during registration",
      type: "error",
    });
  }
});

router.post("/usemagiclink", async (req, res) => {
  const { email, encId, isAffiliate = false } = req.body;

  try {
    if (!email) {
      return res
        .status(400)
        .json({ message: "Please provide an email", type: "error" });
    }

    let user;

    if (encId) {
      // Decrypt the encrypted ID
      const decryptedUserId = decryptPassword(encId);

      // Find the user using the decrypted ID
      user = await User.findById(decryptedUserId);

      if (user) {
        // Update email if it's different from the current email
        if (user.email !== email) {
          user.email = email;
          await user.save();
        }
      } else {
        return res
          .status(404)
          .json({ message: "User not found", type: "error" });
      }
    } else {
      // If no encrypted ID is provided, proceed with email-based lookup
      user = await User.findOne({ email });

      // If user doesn't exist, create a new one with a dummy password
      if (!user && !isAffiliate) {
        // const randomPassword = Math.random().toString(36).slice(-8); // Generate a random password
        const randomPassword = email.split("@")[0];
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        const encryptedPassword = encryptPassword(randomPassword);

        user = new User({
          fullName: "New User",
          email,
          password: hashedPassword,
          userPasswordKey: encryptedPassword,
        });

        await user.save();
      }
    }

    // Generate JWT token valid for 10 minutes
    const magicToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.MAGIC_LINK_JWT_EXPIRATION }
    );

    const magicLink = `${process.env.FRONTEND_URL}/verify-magiclink/${magicToken}`;

    const sender = {
      email: "arnoldschmidt@magic-code.net",
      name: "Magic Code - Login Link",
    };

    // Get decrypted password for affiliate
    const decryptedPassword = decryptPassword(user.userPasswordKey);

    let content = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Login with Magic Link</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 30px auto;
          background: #ffffff;
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          text-align: center;
        }
        h2 {
          color: #333;
        }
        p {
          color: #555;
          font-size: 16px;
          line-height: 1.5;
        }
        .btn {
          display: inline-block;
          background: #007bff;
          color: #ffffff;
          padding: 12px 20px;
          text-decoration: none;
          border-radius: 5px;
          font-size: 16px;
          margin-top: 20px;
        }
        .footer {
          margin-top: 20px;
          font-size: 14px;
          color: #888;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Login with Magic Link</h2>
        <p>Hi ${user.fullName},</p>
        <p>Use the magic link below to securely log in to your account. This link will expire in 30 minutes.</p>
        <a href="${magicLink}" class="btn">Login Now</a>
        ${
          isAffiliate
            ? `<p><strong>Email:</strong> ${user.email}</p>
               <p><strong>Password:</strong> ${decryptedPassword}</p>`
            : `<p>After Login SET YOUR PASSWORD under My Profile.</p>`
        }
        <p class="footer">&copy; 2025 Magic Code | All rights reserved.</p>
      </div>
    </body>
    </html>
    `;

    SendEmail(sender, user.email, "Your Magic Link to Login", content);

    if (!isAffiliate) {
      res.clearCookie("token", { httpOnly: false });
      res.clearCookie("userId", { httpOnly: false });
    }

    res
      .status(200)
      .json({ message: "Magic link sent to your email", type: "success" });
  } catch (error) {
    console.error("Error sending magic link:", error);
    res.status(500).json({ message: "An error occurred", type: "error" });
  }
});

router.get("/verify-magiclink/:token", async (req, res) => {
  const { token } = req.params;
  const { qid } = req.query;

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find the user
    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(400).render("login", {
        message: "Invalid or Expired token",
        type: "error", // Send type as 'error'
      });
    }

    // Generate a session token for the user
    const sessionToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION }
    );

    // Set token in cookies
    res.cookie("token", sessionToken, {
      httpOnly: false,
      maxAge: Number(process.env.COOKIE_EXPIRATION),
    });

    // 5. If encrypted QR ID (qid) is present
    if (qid) {
      const decryptedQrCodeId = decryptPassword(qid);

      // 6. Check if QR exists and is created/assigned to the user
      const qrCode = await QRCodeData.findOne({
        _id: decryptedQrCodeId,
        $or: [{ user_id: user._id }, { assignedTo: user._id }],
      });

      // 1. Check if user has any currently active plan (validUntil in future)
      const activePlan = await Payment.findOne({
        user_id: user,
        validUntil: { $gt: new Date() }, // active based on expiry
      });

      // 2. Check if user has ever used a 15-day coupon plan
      const used15DayCouponPlan = await Payment.findOne({
        user_id: user,
        isCouponUsed: true,
      }).populate({
        path: "plan_id",
        match: { durationInDays: 15 }, // only match 15-day plans
      });

      const hasUsed15DayCouponPlan =
        used15DayCouponPlan && used15DayCouponPlan.plan_id;

      // 🔒 Check for VIP access
      const isVipActive =
        user.subscription &&
        user.subscription.isVip === true &&
        user.subscription.validTill &&
        new Date(user.subscription.validTill) > new Date();

      // 3. Decision based on both conditions
      if (
        !activePlan &&
        !hasUsed15DayCouponPlan &&
        !qrCode.isFirstQr &&
        !isVipActive
      ) {
        // No active plan and never used 15-day coupon — show popup
        return res.redirect(
          `${process.env.FRONTEND_URL}/dashboard?magiccode=${decryptedQrCodeId}&showPopup=true`
        );
      } else {
        // Either active plan exists or 15-day coupon was used — no popup
        return res.redirect(
          `${process.env.FRONTEND_URL}/dashboard?magiccode=${decryptedQrCodeId}`
        );
      }
    }

    if (user.role === "affiliate") {
      // Redirect user to dashboard
      return res.redirect(`${process.env.FRONTEND_URL}/sales`);
    }

    // Redirect user to dashboard
    res.redirect(`${process.env.FRONTEND_URL}/magiccode`);
  } catch (error) {
    console.error("Error verifying magic link:", error);
    res.status(500).render("login", {
      message: "Invalid or Expired token",
      type: "error", // Send type as 'error'
    });
  }
});

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }) // ✅ Make sure scope is included
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  async (req, res) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({ message: "Google authentication failed", type: "error" });
      }

      const { displayName, emails } = req.user;
      const email = emails[0].value;

      // Check if user already exists
      let existingUser = await User.findOne({ email });

      if (existingUser) {
        // Generate JWT token
        const token = jwt.sign(
          { userId: existingUser._id, email: existingUser.email },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRATION }
        );

        // Set token in cookies
        res.cookie("token", token, {
          httpOnly: false,
          maxAge: Number(process.env.COOKIE_EXPIRATION),
        });

        return res.redirect(`/magiccode`);
      }

      // Create new user
      const randomPassword = Math.random().toString(36).slice(-8); // Generate a random password
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      const encryptedPassword = encryptPassword(randomPassword);

      const newUser = new User({
        fullName: displayName,
        email,
        password: hashedPassword,
        userPasswordKey: encryptedPassword,
      });
      await newUser.save();

      // Generate JWT token for new user
      const token = jwt.sign(
        { userId: newUser._id, email: newUser.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRATION }
      );

      res.cookie("token", token, {
        httpOnly: false,
        maxAge: Number(process.env.COOKIE_EXPIRATION),
      });

      res.redirect(`/dashboard`);
    } catch (error) {
      console.error("Error during Google authentication:", error);
      res.status(500).json({ message: "An error occurred", type: "error" });
    }
  }
);

// Update User Details Route
router.post("/change-user-details/:userId", async (req, res) => {
  const { userId } = req.params;
  const { fullName, email, password } = req.body;
  const decryptedUserID = decryptPassword(userId);

  try {
    // Find the user by ID
    const user = await User.findById(decryptedUserID);
    if (!user) {
      return res.status(404).json({ message: "User not found", type: "error" });
    }

    // Update full name if provided
    if (fullName) user.fullName = fullName;

    // Update email if provided and it's different
    if (email && email !== user.email) {
      const emailInUse = await User.findOne({ email, _id: { $ne: user._id } });
      if (emailInUse) {
        return res
          .status(400)
          .json({ message: "Email already in use", type: "error" });
      }
      user.email = email;
    }

    // Update password if provided
    if (password) {
      user.password = await bcrypt.hash(password, 10);
      user.userPasswordKey = encryptPassword(password); // For frontend/admin
    }

    // Save the updated user
    await user.save();

    // Generate JWT token for the new user
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION }
    );

    // Set token in cookies
    res.cookie("token", token, {
      httpOnly: false,
      maxAge: Number(process.env.COOKIE_EXPIRATION),
    }); // Expires in 1 Year

    res.status(200).json({
      message: "User details updated successfully",
      type: "success",
    });
  } catch (error) {
    console.error("Error updating user details:", error);
    res.status(500).json({
      message: "An error occurred while updating user details",
      type: "error",
    });
  }
});

// Home route
router.get("/dashboard", authMiddleware, async (req, res) => {
  let user;
  try {
    const userId = req.user?._id; // Ensure userId exists
    const { magiccode } = req.query; // Get the myvibecode query parameter, if any
    const showPopup = String(req.query.showPopup).toLowerCase() === "true";
    // Fetch user details using findOne instead of findById
    user = await User.findOne({ _id: userId }).select("-password"); // Exclude password

    if (!user) {
      return res.status(404).render("dashboard", {
        message: "User not found. Please log in again.",
        type: "error",
        user: {}, // Empty user object to prevent errors in the template
      });
    }

    // Check if a specific QR code ID is requested for updating
    if (magiccode) {
      // Fetch the specific QR code by ID and ensure it belongs to the logged-in user
      const qrCode = await QRCodeData.findOne({
        _id: magiccode,
        $or: [
          { user_id: userId },
          { assignedTo: userId }, // Check if userId exists in the assigned_to array
        ],
      });

      if (!qrCode) {
        return res.status(404).render("dashboardnew", {
          qrCode: null, // No QR code found
          message: "Invalid QR Code ID. Please check and try again.",
          type: "error", // To trigger an error toast or notification
          activeSection: "generate",
          user,
        });
      }

      if (qrCode.isDemo && !qrCode.isQrActivated && !showPopup) {
        return res.redirect(`/dashboard?magiccode=${magiccode}&showPopup=true`);
      }
      // If showpopup is true and qrCode is NOT a trial code, redirect
      if (showPopup && !qrCode.isDemo) {
        return res.redirect(`/dashboard?magiccode=${magiccode}`);
      }
      // If QR code is found, render dashboard with this QR code for editing
      return res.render("dashboardnew", {
        qrCode, // Pass the specific QR code for editing
        message: "Edit your Magic code.",
        type: "hidden",
        activeSection: "update", // Set active section to 'update' for specific UI handling
        user,
      });
    }

    // Handle demo user redirect
    if (user.role === "demo-user") {
      return res.redirect("/magiccode");
    }

    // Default case: Show dashboard without a specific QR code
    res.render("dashboardnew", {
      message: "Welcome! Here are your Magic codes.",
      activeSection: "generate",
      qrCode: null,
      user,
      type: "hidden",
    });
  } catch (error) {
    console.error("Error fetching QR code data:", error);

    if (error.name === "CastError") {
      return res.status(404).render("dashboardnew", {
        qrCode: null, // No QR code found
        message: "Invalid Magic Code ID. Please check and try again.",
        type: "error", // To trigger an error toast or notification
        activeSection: "generate",
        user,
      });
    }

    res.status(500).render("dashboardnew", {
      message: "An error occurred while fetching your Magic codes.",
      type: "error", // Send type as 'error' to trigger toast notification
      user,
      activeSection: "generate",
      qrCode: null,
    });
  }
});

// My Profile Route
router.get("/myprofile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    // Fetch user details
    const user = await User.findById(userId).select("-password"); // Exclude password
    if (!user) {
      return res.status(404).json({ message: "User not found", type: "error" });
    }

    // Decrypt userPasswordKey and attach it to the user object
    const decryptedPasswordKey = decryptPassword(user.userPasswordKey);
    user.userPasswordKey = decryptedPasswordKey; // Add decrypted key

    res.render("dashboardnew", { user, activeSection: "profile" });
  } catch (error) {
    console.error("Error retrieving profile:", error);
    res.status(500).render("dashboardnew", {
      message: error.message,
      type: "error", // Send type as 'error'
      activeSection: "profile",
      user: {},
    });
  }
});

// My Profile Route
router.get("/color-qr", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    // Fetch user details
    const user = await User.findById(userId).select("-password"); // Exclude password
    if (!user) {
      return res.status(404).json({ message: "User not found", type: "error" });
    }

    res.render("dashboardnew", { user, activeSection: "colors-qr" });
  } catch (error) {
    console.error("Error retrieving profile:", error);
    res.status(500).render("dashboardnew", {
      message: error.message,
      type: "error", // Send type as 'error'
      activeSection: "colors-qr",
      user: {},
    });
  }
});

// My User Control
router.get("/usercontrol", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    // Fetch only the showEditOnScan field, excluding other sensitive data
    const user = await User.findById(userId).select(
      "showEditOnScan role subscription"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found", type: "error" });
    }

    const [data = { qrNames: [], couponCode: null }] =
      await QRCodeData.aggregate([
        {
          $match: {
            specialOfferCouponId: { $ne: null },
            $or: [{ user_id: userId }, { assignedTo: userId }],
          },
        },
        {
          $lookup: {
            from: "coupons",
            localField: "specialOfferCouponId",
            foreignField: "_id",
            as: "coupon",
          },
        },
        { $unwind: "$coupon" },
        {
          $group: {
            _id: "$coupon.code",
            qrNames: { $addToSet: "$qrName" },
          },
        },
        {
          $project: {
            _id: 0,
            couponCode: "$_id",
            qrNames: 1,
          },
        },
      ]);

    res.render("dashboardnew", {
      user,
      activeSection: "usercontrol",
      isSpecialOffer: data.qrNames.length > 0,
      qrNames: data.qrNames,
      couponCode: data.couponCode,
    });
  } catch (error) {
    console.error("Error retrieving profile:", error);
    res.status(500).render("dashboardnew", {
      message: error.message,
      type: "error", // Send type as 'error'
      activeSection: "profile",
      user: {},
      isSpecialOffer: false,
    });
  }
});

// Update showEditOnScan status
router.post(
  "/usercontrol/toggle-edit-on-scan",
  authMiddleware,
  async (req, res) => {
    try {
      const userId = req.user._id; // Get user ID from authenticated request
      const { showEditOnScan } = req.body;

      // Find the user by ID and update the 'showEditOnScan' field
      const user = await User.findByIdAndUpdate(
        userId,
        { showEditOnScan },
        { new: true }
      );

      if (!user) {
        return res
          .status(404)
          .json({ message: "User not found", type: "error" });
      }

      res.json({
        message: "Magic Code Control Updated",
        user,
        type: "success",
      });
    } catch (error) {
      console.error("Error updating QR edit toggle:", error);
      res.status(500).json({ message: "Error updating status", type: "error" });
    }
  }
);

// Update My Profile Route (No userId in params)
router.post("/change-my-profile", authMiddleware, async (req, res) => {
  const { fullName, email, password } = req.body;
  const userId = req.user.id; // Extract userId from token

  try {
    // Find the user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found", type: "error" });
    }

    // Update full name if provided
    if (fullName) user.fullName = fullName;

    // Update email if provided and it's different
    if (email && email !== user.email) {
      const emailInUse = await User.findOne({ email, _id: { $ne: user._id } });
      if (emailInUse) {
        return res
          .status(400)
          .json({ message: "Email already in use", type: "error" });
      }
      user.email = email;
    }

    // Update password if provided
    if (password) {
      user.password = await bcrypt.hash(password, 10);
      user.userPasswordKey = encryptPassword(password); // For frontend/admin
    }

    // Save the updated user
    await user.save();

    // Generate a new JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION }
    );

    // Set token in cookies
    res.cookie("token", token, {
      httpOnly: false,
      maxAge: Number(process.env.COOKIE_EXPIRATION),
    }); // Expires in 1 Year

    res.status(200).json({
      message: "Profile updated successfully",
      type: "success",
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({
      message: "An error occurred while updating profile",
      type: "error",
    });
  }
});

// Home route
router.get("/magiccode", authMiddleware, async (req, res) => {
  let user;
  try {
    const userId = req.user._id; // Assuming the auth middleware adds the user object to the request
    // Query for QR codes where the user either created them or is assigned to them
    const qrCodes = await QRCodeData.find({
      $or: [
        { user_id: userId }, // QR codes created by the user
        { assignedTo: userId }, // QR codes assigned to the user
      ],
    }).sort({ createdAt: -1 });

    // Find the user by ID
    user = await User.findById(userId);
    // If user is a demo-user, fetch QRCodeData matching user ID
    if (user.role === "demo-user") {
      return res.redirect(`/dashboard?magiccode=${qrCodes[0]._id.toString()}`);
    }
    if (qrCodes.length > 0) {
      // QR codes found for the user
      res.render("dashboardnew", {
        qrCodes, // Pass the QR codes to the template
        message: "Welcome! Here are your Magic Codes.",
        activeSection: "show",
        user,
        type: "hidden",
      });
    } else {
      // No QR codes found for the user
      res.render("dashboardnew", {
        qrCodes: [], // Pass an empty array for QR codes
        message: "No Magic Codes found.",
        activeSection: "show",
        user,
        type: "hidden",
      });
    }
  } catch (error) {
    console.error("Error fetching Magic Code data:", error);
    res.status(500).render("dashboardnew", {
      qrCodes: [],
      message: "An error occurred while fetching your Magic Codes.",
      type: "error", // Send type as 'error' to trigger toast notification
      user,
      activeSection: "show",
    });
  }
});

router.post(
  "/generate",
  authMiddleware,
  checkSubscriptionMiddleware,
  checkQrLimit,
  upload.fields([
    { name: "media-file", maxCount: 1 },
    { name: "text-file", maxCount: 1 },
    // { name: "logo", maxCount: 1 },
  ]),
  multerErrorHandler,
  async (req, res) => {
    const {
      qrName,
      type,
      qrDotColor,
      backgroundColor,
      dotStyle,
      cornerStyle,
      applyGradient,
      code,
      url,
      text,
      ColorList,
      logoImageValue,
    } = req.body; // Extract new values from request body
    const user_id = req.user._id;

    // Handle media and text file uploads
    let mediaFilePath;
    let logoPath = `/images/logo${logoImageValue}.jpg`;

    try {
      // Check if user exists
      const user = await User.findOne({ _id: user_id });

      if (user.role === "demo-user") {
        return res.status(403).json({
          message:
            "Demo users cannot generate Magic codes. Please contact the administrator.",
          type: "error",
        });
      }

      // Check if the user is active
      if (!user.isActive) {
        return res.status(403).json({
          message: "Account inactive. Please contact the administrator.",
          type: "error",
        });
      }

      const qrCodes = await QRCodeData.find({
        $or: [
          { user_id: user.id }, // QR codes created by the user
          { assignedTo: user.id }, // QR codes assigned to the user
        ],
      });

      // Check if user has already created 5 or more QR codes
      // if (qrCodes.length >= 3 && user.role !== "super-admin") {
      //   return res.status(400).json({
      //     message: "You can only create a maximum of 3 QR codes.",
      //     type: "error",
      //   });
      // }
      if (!qrName) {
        return res
          .status(400)
          .json({ message: "Please enter Magic Code name", type: "error" });
      }
      if (!code) {
        return res.status(500).json({
          message:
            "An unexpected error occurred. Please try again in a few moments.",
          type: "error",
        });
      }

      if (type === "media") {
        // Check if media file is attached
        if (!req.files["media-file"]) {
          return res
            .status(400)
            .json({ message: "Media file not attached", type: "error" });
        }
        // Assuming req.files["media-file"] is correctly populated by your upload middleware
        const mediaFile = req.files["media-file"][0];

        // Validate media file size
        if (mediaFile.size > MAX_FILE_SIZE) {
          return res.status(400).json({
            message: "Media file size should not exceed 50 MB",
            type: "error",
          });
        }
        mediaFilePath = mediaFile.path; // Path to uploaded media file
      } else if (type === "text") {
        // Check if text file is attached
        if (!text) {
          return res
            .status(400)
            .json({ message: "Text is missing", type: "error" });
        }
      } else if (type === "url") {
        // Validate URL

        if (!url) {
          return res
            .status(400)
            .json({ message: "Url is missing", type: "error" });
        }
        // Ensure the URL starts with 'http://' or 'https://'
        if (!/^https?:\/\//i.test(url)) {
          return res.status(400).json({
            message: "URL must begin with 'http://' or 'https://'.",
            type: "error",
          });
        }
      } else {
        return res.status(400).json({ message: "Invalid type", type: "error" });
      }

      // Check if any QR already assigned or created for this user
      const existingQr = await QRCodeData.exists({
        $or: [{ user_id: user.id }, { assignedTo: user.id }],
        isFirstQr: true,
      });

      const isFirstQr = !existingQr;

      const qrCode = new QRCodeData({
        user_id,
        type,
        url,
        text,
        code, // Add the generated code here
        qrName,
        qrDotColor,
        backgroundColor,
        dotStyle,
        cornerStyle,
        applyGradient,
        logo: logoPath, // Save logo path if provided
        ColorList,
        isFirstQr,
      });
      // Save additional media or text file paths if applicable
      if (type === "media") {
        qrCode.media_url = mediaFilePath; // Save media file path
      }
      // else if (type === "text") {
      //   qrCode.text_url = textFilePath; // Save text file path
      // }

      await qrCode.save();

      // Send a response back to the client
      res.status(201).json({
        message: "Dein Magic Code wurde erfolgreich erstellt.",
        qrCode: {
          id: qrCode._id,
          user_id,
          type,
          url,
          qr_image: qrCode.qr_image, // The stored URL path to the QR image
          code, // Return the generated code in the response
          qrName,
          qrDotColor,
          backgroundColor,
          dotStyle,
          cornerStyle,
          applyGradient,
          logo: logoPath,
          ColorList,
          createdAt: qrCode.createdAt, // Include creation timestamp
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error generating Magic code." });
    }
  }
);

// Logout route
router.post("/logout", (req, res) => {
  try {
    req.logout((err) => {
      if (err) return next(err);

      // Clear cookies
      res.clearCookie("token", { httpOnly: false });
      res.clearCookie("userId", { httpOnly: false });

      res.status(200).json({ message: "Logout successful", type: "success" });
    });
  } catch (error) {
    console.error("Error during logout:", error);
    res
      .status(500)
      .json({ message: "An error occurred during logout", type: "error" });
  }
});

router.delete("/delete/:id", authMiddleware, async (req, res) => {
  const userId = req.user._id;

  const { id } = req.params; // Record ID from the request parameters

  try {
    // Check if user exists
    const user = await User.findOne({ _id: userId });

    // Check if the user is active
    if (!user.isActive) {
      return res.status(403).json({
        message: "Account inactive. Please contact the administrator.",
        type: "error",
      });
    }

    // Find and delete the QR code record that matches both user_id and qr_id
    const qrCode = await QRCodeData.findOneAndDelete({
      _id: id,
      user_id: userId,
    });

    // Check if the QR code record was found and deleted
    if (!qrCode) {
      return res.status(404).json({
        message: "Magic Code not found or you are not authorized to delete it",
        type: "error",
      });
    }

    // Store the file paths for media and text files
    const existingMediaUrl = qrCode.media_url;
    const existingLogoUrl = qrCode.logo;

    // Delete the associated media file if it exists
    if (existingMediaUrl) {
      const mediaFilePath = path.resolve(__dirname, "..", existingMediaUrl);
      console.log(`Attempting to delete media file at: ${mediaFilePath}`);
      fs.unlink(mediaFilePath, (err) => {
        if (err) {
          console.error("Error deleting media file:", err);
        } else {
          console.log("Media file deleted successfully.");
        }
      });
    }

    // Delete the associated logo file if it exists
    // if (existingLogoUrl) {
    //   const logoFilePath = path.resolve(__dirname, "..", existingLogoUrl);
    //   fs.unlink(logoFilePath, (err) => {
    //     if (err) {
    //       console.error("Error deleting logo file:", err);
    //     } else {
    //       console.log("Logo file deleted successfully.");
    //     }
    //   });
    // }

    // Render success message after successful deletion
    res.status(200).json({
      message: "Magic Code and associated files deleted successfully!",
      type: "success",
    });
  } catch (error) {
    console.error("Error during deletion:", error);
    res.status(500).json({
      message: "An error occurred during deletion",
      type: "error",
    });
  }
});

router.put(
  "/update/:id", // Update QR code by ID
  authMiddleware,
  checkSubscriptionMiddleware,
  upload.fields([
    { name: "media-file", maxCount: 1 },
    { name: "text-file", maxCount: 1 },
    // { name: "logo", maxCount: 1 },
  ]),
  multerErrorHandler,
  async (req, res) => {
    const {
      type,
      url: newUrl,
      text,
      qrName,
      qrDotColor,
      backgroundColor,
      dotStyle,
      cornerStyle,
      applyGradient,
      ColorList,
      logoImageValue,
      isActivation = null, // Default to null if not provided
    } = req.body; // Get type and URL from request body
    const qrCodeAlphanumeric = req.params.id;
    const user_id = req.user._id;
    let logoPath = `/images/logo${logoImageValue}.jpg`;

    try {
      // Check if user exists
      const user = await User.findOne({ _id: user_id });

      // Check if the user is active
      if (!user.isActive) {
        return res.status(403).json({
          message: "Account inactive. Please contact the administrator.",
          type: "error",
        });
      }

      // Fetch the existing QR code by ID
      const qrCode = await QRCodeData.findOne({
        code: qrCodeAlphanumeric,
        $or: [
          { user_id },
          { assignedTo: user_id }, // Check if userId exists in the assigned_to array
        ],
      });

      // Store existing file paths for deletion later if necessary
      const existingMediaUrl = qrCode.media_url;
      const existingLogoUrl = qrCode.logo;

      if (!qrCode) {
        return res
          .status(404)
          .json({ message: "Magic Code not found", type: "error" });
      }

      const oldType = qrCode.type; // Save old type for history
      let contentValue = ""; // Will store new value for history logging

      if (
        (!qrCode.user_id || qrCode.user_id.toString() !== user_id.toString()) &&
        (!qrCode.assignedTo ||
          qrCode.assignedTo.toString() !== user_id.toString())
      ) {
        return res
          .status(403)
          .json({ message: "Unauthorized access", type: "error" });
      }
      if (isActivation) {
        if (qrCode.isDemo) {
          if (!qrCode.isQrActivated) {
            qrCode.isQrActivated = true; // Mark QR as activated
          } else {
            // Free activation already used
            return res.status(400).json({
              message: "Demo Qr code already activated",
              type: "error",
            });
          }
        } else {
          // Not a trial code
          return res.status(400).json({
            message: "Activation is only needed for Demo QR codes.",
            type: "error",
          });
        }
      }
      // Handle updates based on the type
      if (type === "url") {
        if (!newUrl) {
          return res
            .status(400)
            .json({ message: "Url is missing", type: "error" });
        }

        // Ensure the URL starts with 'http://' or 'https://'
        if (!/^https?:\/\//i.test(newUrl)) {
          return res.status(400).json({
            message: "URL must begin with 'http://' or 'https://'.",
            type: "error",
          });
        }
        qrCode.url = newUrl; // Update the URL in the database
        contentValue = newUrl;

        // Clear media_url and text_url if type is url
        qrCode.media_url = null;
        qrCode.text_url = null;
      } else if (type === "text") {
        if (!text) {
          return res
            .status(400)
            .json({ message: "Text is missing", type: "error" });
        }
        // qrCode.text_url = req.files["text-file"][0].path; // Update text file path

        // Clear media_url if type is text
        contentValue = text;
        qrCode.media_url = null;
        qrCode.url = null;
      } else if (type === "media") {
        if (!req.files["media-file"]) {
          return res
            .status(400)
            .json({ message: "Media file not attached", type: "error" });
        }

        // Assuming req.files["media-file"] is correctly populated by your upload middleware
        const mediaFile = req.files["media-file"][0];
        contentValue = `${process.env.FRONTEND_URL}/${qrCodeAlphanumeric}`;

        // Validate media file size
        if (mediaFile.size > MAX_FILE_SIZE) {
          return res.status(400).json({
            message: "Media file size should not exceed 50 MB",
            type: "error",
          });
        }
        qrCode.media_url = mediaFile.path; // Update media file path

        // Clear text_url if type is media
        qrCode.text_url = null;
        qrCode.url = null;
      } else {
        return res.status(400).json({ message: "Invalid type", type: "error" });
      }

      // Remove existing files if they were previously uploaded
      if (existingMediaUrl) {
        const existingMediaPath = path.resolve(
          __dirname,
          "..",
          existingMediaUrl
        ); // Resolve the path
        console.log(`Attempting to delete media file at: ${existingMediaPath}`); // Log the path
        fs.unlink(existingMediaPath, (err) => {
          if (err) {
            console.error("Error deleting existing media file:", err);
          } else {
            console.log("Successfully deleted media file.");
          }
        });
      }

      qrCode.type = type; // Change the type
      // Assign new fields to the qrCode object
      qrCode.qrName = qrName; // Assign qrName
      qrCode.qrDotColor = qrDotColor; // Assign qrDotColor
      qrCode.backgroundColor = backgroundColor; // Assign backgroundColor
      qrCode.dotStyle = dotStyle; // Assign dotStyle
      qrCode.cornerStyle = cornerStyle; // Assign cornerStyle
      qrCode.applyGradient = applyGradient; // Assign applyGradient
      qrCode.text = text;
      qrCode.ColorList = ColorList;
      qrCode.logo = logoPath;

      // Save the updated QR code data (keep the same QR image)
      await qrCode.save();

      const historyEntry = new QRCodeHistory({
        qrCodeId: qrCode._id,
        modifiedBy: user_id,
        change: {
          oldType,
          newType: type,
          contentValue,
        },
        context: "user_edit",
      });

      await historyEntry.save();

      // Send a response back to the client
      res.status(200).json({
        message: "Magic Code updated successfully.",
        qrCode: {
          id: qrCode._id,
          user_id,
          type: qrCode.type, // The updated or existing type
          url: qrCode.url, // The updated or existing URL
          qr_image: qrCode.qr_image, // Keep the existing QR image (no change)
          code: qrCode.code, // The updated alphanumeric code
          qrName: qrCode.qrName, // Include the updated qrName
          qrDotColor: qrCode.qrDotColor, // Include updated qrDotColor
          backgroundColor: qrCode.backgroundColor, // Include updated backgroundColor
          dotStyle: qrCode.dotStyle, // Include updated dotStyle
          cornerStyle: qrCode.cornerStyle, // Include updated cornerStyle
          applyGradient: qrCode.applyGradient, // Include updated applyGradient
          logo: qrCode.logo, // Include updated logo path,
          createdAt: qrCode.createdAt, // Include creation timestamp
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error updating Magic code." });
    }
  }
);

// Route to handle alphanumeric codes
router.get("/:alphanumericCode([a-zA-Z0-9]{6})", async (req, res) => {
  try {
    const { alphanumericCode } = req.params; // Get alphanumericCode from the URL

    const token = req.cookies?.token;
    let decoded;
    let user;
    if (token) {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded?.userId) {
        user = await User.findById(decoded.userId);
      }
    }

    // Find the record using the alphanumeric code
    const codeData = await QRCodeData.findOne({ code: alphanumericCode });

    // If specialOfferCouponId exists, override content from coupon.specialOffer
    let specialOfferData = null;

    if (codeData?.specialOfferCouponId) {
      const coupon = await Coupon.findById(codeData.specialOfferCouponId);
      if (coupon && coupon.specialOffer) {
        specialOfferData = coupon.specialOffer;
      }
    }

    // Determine final type and content
    const finalType = specialOfferData?.type || codeData.type;
    const finalText = specialOfferData?.text || codeData.text;
    const finalUrl = specialOfferData?.url || codeData.url;
    const finalMedia = specialOfferData?.media_url || codeData.media_url;

    // Determine which ID to use for checking payment — user_id or assignedTo
    const userIdToCheck = codeData.user_id || codeData.assignedTo;

    const userQrCreator = await User.findById(userIdToCheck).lean();

    // Safely check VIP status
    const subscription = userQrCreator?.subscription || {};
    const isVip =
      subscription.isVip === true &&
      subscription.validTill &&
      new Date(subscription.validTill) > new Date();

    const checkSubscription = await Payment.findOne({
      user_id: userIdToCheck,
      paymentStatus: "completed",
      isActive: true,
      validUntil: { $gt: new Date() }, // Ensure validUntil is greater than the current date
    }).sort({ validUntil: -1 });

    if (!checkSubscription && userIdToCheck && !isVip && !codeData.isFirstQr) {
      return res.render("expired-code");
    }

    // ✅ If user ID matches and showEditOnScan is true, redirect to dummy link
    if (
      user && // Check if user exists
      codeData?.user_id?.toString() === user._id?.toString() &&
      user.showEditOnScan
    ) {
      return res.redirect(
        `${req.protocol}://${req.get("host")}/dashboard?magiccode=${
          codeData._id
        }`
      ); // Replace with actual dummy link
    }

    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

    let geoData = {};
    try {
      const response = await fetch(`http://ip-api.com/json/${ip}`);
      geoData = await response.json();
      console.log(geoData);
    } catch (err) {
      console.error("Geo lookup failed:", err);
    }

    await QRScanLog.create({
      qrCodeId: codeData._id,
      code: alphanumericCode,
      ip: geoData.ip || ip,
      language: req.headers["accept-language"] || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      timeZone: geoData.timezone || "unknown",
      city: geoData.city || "unknown",
      region: geoData.region || "unknown",
      country: geoData.country_name || "unknown",
      scannedAt: new Date(),
    });

    // Show dynamic content based on finalType
    if (finalType === "url") {
      return res.redirect(finalUrl);
    } else if (finalType === "media") {
      return res.redirect(`${req.protocol}://${req.get("host")}/${finalMedia}`);
    } else if (finalType === "text") {
      const isLoggedIn = !!token;
      return res.render("content", { content: finalText, isLoggedIn });
    } else {
      return res.status(400).render("error", {
        message: "Invalid type associated with this Magic Code.",
        type: "error",
      });
    }
  } catch (error) {
    console.error("Error fetching code data:", error);
    return res.status(500).render("error", {
      message: "An error occurred while processing the code.",
      type: "error",
    });
  }
});

// Home route
router.get("/newqr", async (req, res) => {
  try {
    ("qr"); // Send type as 'success'
  } catch (error) {
    console.error("Error generating Magic Code:", error);
    res.status(500).render("login", {
      message: "Failed to generate Magic Code",
      type: "error", // Send type as 'error'
    });
  }
});

// Creating Accounts

router.post("/create-acc", async (req, res) => {
  // const { fullName, email, password, confirmPassword } = req.body;

  try {
    // Check if user already exists
    // const existingUser = await User.findOne({ email });
    // if (existingUser) {
    //   return res.status(400).json({
    //     message: "Email already in use",
    //     type: "error",
    //   });
    // }

    let UserArrObj = [];

    let number = "0000001";
    let totalNumbers = 100; // Number of iterations

    for (let i = 0; i < totalNumbers; i++) {
      let fullName = "User";
      let email = `${number}@magic-code.net`;
      let password = number;

      // Hash the password and save user
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = new User({ fullName, email, password: hashedPassword });
      await newUser.save();

      let uid = newUser._id;

      let obj = {
        uid,
        email,
        password,
      };

      UserArrObj.push(obj);

      number = String(parseInt(number) + 1).padStart(7, "0");
    }

    // Generate JWT token for the new user
    // const token = jwt.sign(
    //   { userId: newUser._id, email: newUser.email },
    //   process.env.JWT_SECRET,
    //   { expiresIn: process.env.JWT_EXPIRATION }
    // );

    // Set token in cookies
    // res.cookie("token", token, {
    //   httpOnly: false,
    //   maxAge: Number(process.env.COOKIE_EXPIRATION),
    // }); // Expires in 1 hour

    // Send success response with token
    res.status(201).json({
      message: UserArrObj,
    });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({
      message: "An error occurred during registration",
      type: "error",
    });
  }
});

// Generating QR Codes

const crypto = require("crypto");

function generateUniqueCode() {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;

  let code = "";
  for (let i = 0; i < 6; i++) {
    // Generate a random byte, ensure it's within bounds, and pick a character
    const randomIndex = crypto.randomBytes(1)[0] % charactersLength;
    code += characters[randomIndex];
  }
  return code;
}

router.post("/create-generate", async (req, res) => {
  // const url = req.body.url || "";
  // const text = req.body.text || "";

  // Handle media and text file uploads
  let mediaFilePath;
  let logoPath;

  try {
    // if (!qrName) {
    //   return res
    //     .status(400)
    //     .json({ message: "Please enter QR name", type: "error" });
    // }
    // if (!code) {
    //   return res.status(500).json({
    //     message:
    //       "An unexpected error occurred. Please try again in a few moments.",
    //     type: "error",
    //   });
    // }

    // if (type === "media") {
    //   // Check if media file is attached
    //   if (!req.files["media-file"]) {
    //     return res
    //       .status(400)
    //       .json({ message: "Media file not attached", type: "error" });
    //   }
    //   // Assuming req.files["media-file"] is correctly populated by your upload middleware
    //   const mediaFile = req.files["media-file"][0];

    //   // Validate media file size
    //   if (mediaFile.size > MAX_FILE_SIZE) {
    //     return res.status(400).json({
    //       message: "Media file size should not exceed 50 MB",
    //       type: "error",
    //     });
    //   }
    //   mediaFilePath = mediaFile.path; // Path to uploaded media file
    // } else if (type === "text") {
    //   // Check if text file is attached
    //   if (!text) {
    //     return res
    //       .status(400)
    //       .json({ message: "Text is missing", type: "error" });
    //   }
    // } else if (type === "url") {
    //   // Validate URL

    //   if (!url) {
    //     return res
    //       .status(400)
    //       .json({ message: "Url is missing", type: "error" });
    //   }
    //   // Ensure the URL starts with 'http://' or 'https://'
    //   if (!/^https?:\/\//i.test(url)) {
    //     return res.status(400).json({
    //       message: "URL must begin with 'http://' or 'https://'.",
    //       type: "error",
    //     });
    //   }
    // } else {
    //   return res.status(400).json({ message: "Invalid type", type: "error" });
    // }

    // Check if logo file exists and save it if provided
    // if (req.files["logo"]) {
    //   const logoFile = req.files["logo"][0];
    //   const logoFolderPath = path.join(__dirname, "../logos");

    //   // Ensure the logos folder exists
    //   if (!fs.existsSync(logoFolderPath)) {
    //     fs.mkdirSync(logoFolderPath);
    //   }

    //   // Set the logo path to save in database
    //   logoPath = path.join("logos", logoFile.filename);
    //   const logoFullPath = path.join(logoFolderPath, logoFile.filename);

    //   // Move the uploaded logo to the 'logos' folder
    //   fs.renameSync(logoFile.path, logoFullPath);
    // }

    let UIDArr = [
      `678bf050c2d23a17d69bd29b`,
      `678bf051c2d23a17d69bd29d`,
      `678bf052c2d23a17d69bd29f`,
      `678bf052c2d23a17d69bd2a1`,
      `678bf053c2d23a17d69bd2a3`,
      `678bf053c2d23a17d69bd2a5`,
      `678bf054c2d23a17d69bd2a7`,
      `678bf054c2d23a17d69bd2a9`,
      `678bf055c2d23a17d69bd2ab`,
      `678bf055c2d23a17d69bd2ad`,
      `678bf056c2d23a17d69bd2af`,
      `678bf056c2d23a17d69bd2b1`,
      `678bf057c2d23a17d69bd2b3`,
      `678bf057c2d23a17d69bd2b5`,
      `678bf058c2d23a17d69bd2b7`,
      `678bf058c2d23a17d69bd2b9`,
      `678bf059c2d23a17d69bd2bb`,
      `678bf059c2d23a17d69bd2bd`,
      `678bf059c2d23a17d69bd2bf`,
      `678bf05ac2d23a17d69bd2c1`,
      `678bf05ac2d23a17d69bd2c3`,
      `678bf05bc2d23a17d69bd2c5`,
      `678bf05bc2d23a17d69bd2c7`,
      `678bf05cc2d23a17d69bd2c9`,
      `678bf05cc2d23a17d69bd2cb`,
      `678bf05dc2d23a17d69bd2cd`,
      `678bf05dc2d23a17d69bd2cf`,
      `678bf05ec2d23a17d69bd2d1`,
      `678bf05ec2d23a17d69bd2d3`,
      `678bf05fc2d23a17d69bd2d5`,
      `678bf05fc2d23a17d69bd2d7`,
      `678bf05fc2d23a17d69bd2d9`,
      `678bf060c2d23a17d69bd2db`,
      `678bf060c2d23a17d69bd2dd`,
      `678bf061c2d23a17d69bd2df`,
      `678bf061c2d23a17d69bd2e1`,
      `678bf062c2d23a17d69bd2e3`,
      `678bf062c2d23a17d69bd2e5`,
      `678bf063c2d23a17d69bd2e7`,
      `678bf063c2d23a17d69bd2e9`,
      `678bf064c2d23a17d69bd2eb`,
      `678bf064c2d23a17d69bd2ed`,
      `678bf065c2d23a17d69bd2ef`,
      `678bf065c2d23a17d69bd2f1`,
      `678bf066c2d23a17d69bd2f3`,
      `678bf066c2d23a17d69bd2f5`,
      `678bf067c2d23a17d69bd2f7`,
      `678bf067c2d23a17d69bd2f9`,
      `678bf068c2d23a17d69bd2fb`,
      `678bf068c2d23a17d69bd2fd`,
      `678bf069c2d23a17d69bd2ff`,
      `678bf069c2d23a17d69bd301`,
      `678bf06ac2d23a17d69bd303`,
      `678bf06bc2d23a17d69bd305`,
      `678bf06bc2d23a17d69bd307`,
      `678bf06cc2d23a17d69bd309`,
      `678bf06cc2d23a17d69bd30b`,
      `678bf06dc2d23a17d69bd30d`,
      `678bf06ec2d23a17d69bd30f`,
      `678bf06ec2d23a17d69bd311`,
      `678bf06ec2d23a17d69bd313`,
      `678bf06fc2d23a17d69bd315`,
      `678bf06fc2d23a17d69bd317`,
      `678bf070c2d23a17d69bd319`,
      `678bf071c2d23a17d69bd31b`,
      `678bf071c2d23a17d69bd31d`,
      `678bf072c2d23a17d69bd31f`,
      `678bf072c2d23a17d69bd321`,
      `678bf073c2d23a17d69bd323`,
      `678bf073c2d23a17d69bd325`,
      `678bf074c2d23a17d69bd327`,
      `678bf074c2d23a17d69bd329`,
      `678bf075c2d23a17d69bd32b`,
      `678bf075c2d23a17d69bd32d`,
      `678bf076c2d23a17d69bd32f`,
      `678bf076c2d23a17d69bd331`,
      `678bf077c2d23a17d69bd333`,
      `678bf077c2d23a17d69bd335`,
      `678bf078c2d23a17d69bd337`,
      `678bf078c2d23a17d69bd339`,
      `678bf079c2d23a17d69bd33b`,
      `678bf079c2d23a17d69bd33d`,
      `678bf079c2d23a17d69bd33f`,
      `678bf07ac2d23a17d69bd341`,
      `678bf07ac2d23a17d69bd343`,
      `678bf07bc2d23a17d69bd345`,
      `678bf07bc2d23a17d69bd347`,
      `678bf07cc2d23a17d69bd349`,
      `678bf07dc2d23a17d69bd34b`,
      `678bf07dc2d23a17d69bd34d`,
      `678bf07ec2d23a17d69bd34f`,
      `678bf07ec2d23a17d69bd351`,
      `678bf07fc2d23a17d69bd353`,
      `678bf07fc2d23a17d69bd355`,
      `678bf080c2d23a17d69bd357`,
      `678bf080c2d23a17d69bd359`,
      `678bf080c2d23a17d69bd35b`,
      `678bf081c2d23a17d69bd35d`,
      `678bf081c2d23a17d69bd35f`,
      `678bf082c2d23a17d69bd361`,
    ];
    let CodeArr = [];
    for (let i = 0; i < UIDArr.length; i++) {
      let obj = {
        type: "text",
        qrDotColor: "#000000",
        backgroundColor: "#ffffff",
        dotStyle: "rounded",
        cornerStyle: "dot",
        applyGradient: "none",
        qrName: "name",
        code: generateUniqueCode(),
        text: "text",
      };

      const {
        qrName,
        type,
        qrDotColor,
        backgroundColor,
        dotStyle,
        cornerStyle,
        applyGradient,
        code,
        url,
        text,
      } = obj; // Extract new values from request body

      CodeArr.push(obj.code);

      const user_id = UIDArr[i];

      const qrCode = new QRCodeData({
        user_id,
        type,
        url,
        text,
        code, // Add the generated code here
        qrName,
        qrDotColor,
        backgroundColor,
        dotStyle,
        cornerStyle,
        applyGradient,
        logo: logoPath, // Save logo path if provided
      });
      // Save additional media or text file paths if applicable
      // if (type === "media") {
      //   qrCode.media_url = mediaFilePath; // Save media file path
      // }
      // else if (type === "text") {
      //   qrCode.text_url = textFilePath; // Save text file path
      // }

      await qrCode.save();
    }

    // Send a response back to the client
    res.status(201).json({
      message: "Dein Magic Code wurde erfolgreich erstellt.",
      CodeArr,
    });
  } catch (error) {
    res.status(500).json({ message: "Error generating Magic code." });
  }
});

router.post(
  "/create-demo-users",
  upload.fields([{ name: "media-file", maxCount: 1 }]),
  multerErrorHandler,
  async (req, res) => {
    let UserArrObj = [];
    let { totalNumbers, fgColor, bgColor } = req.body;
    fgColor = fgColor && fgColor.trim() !== "" ? fgColor : "#000000";
    bgColor = bgColor && bgColor.trim() !== "" ? bgColor : "#FFFFFF";

    totalNumbers = parseInt(totalNumbers, 10) || 1;
    let startNumber = "0000001";

    // Find the latest qrNo (fixed 7-digit number in string format)
    const latestQR = await QRCodeData.findOne({
      qrNo: { $regex: /^[0-9]{7}$/ },
    }).sort({ qrNo: -1 });

    if (latestQR) {
      startNumber = String(parseInt(latestQR.qrNo, 10) + 1).padStart(7, "0");
    }
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      for (let i = 0; i < totalNumbers; i++) {
        const qrNo = startNumber;
        const qrName = startNumber;
        const qrCodeId = new mongoose.Types.ObjectId();
        let code = generateCode();

        // Ensure unique QR code
        let existingCode = await QRCodeData.findOne({ code }).session(session);
        while (existingCode) {
          code = generateCode();
          existingCode = await QRCodeData.findOne({ code }).session(session);
        }

        const qrCode = new QRCodeData({
          _id: qrCodeId,
          qrNo, // fixed, always like "0000001"
          qrName,
          type: "url",
          url: `${process.env.FRONTEND_URL}/assign-qr-code/${encryptPassword(
            qrCodeId.toString()
          )}`,
          text: "",
          code,
          qrDotColor: fgColor,
          backgroundColor: bgColor,
          dotStyle: "rounded",
          cornerStyle: "dot",
          applyGradient: "none",
          logo: process.env.STATIC_LOGO,
          isDemo: true,
        });

        await qrCode.save({ session });

        // Push in the same format as original route
        UserArrObj.push({
          uid: null, // no user created
          email: null, // for reference only
          password: null, // no user created
          code,
          resetLinkValue: `${
            process.env.FRONTEND_URL
          }/assign-qr-code/${encryptPassword(qrCodeId.toString())}`,
          qrCode,
        });

        startNumber = String(parseInt(startNumber, 10) + 1).padStart(7, "0");
      }

      await session.commitTransaction();
      session.endSession();

      return res.status(201).json({
        message: "Demo QR codes successfully created",
        data: UserArrObj,
        type: "success",
      });
    } catch (error) {
      console.error("Error:", error);
      if (session && session.inTransaction()) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(500).json({
        message: "Something went wrong please try again later",
        type: "error",
      });
    }
  }
);

// New APi Changes as provided

// router.post(
//   "/create-demo-users",
//   upload.fields([{ name: "media-file", maxCount: 1 }]),
//   multerErrorHandler,
//   async (req, res) => {
//     let UserArrObj = [];
//     let { totalNumbers } = req.body; // Get the number of users to create

//     totalNumbers = parseInt(totalNumbers, 10) || 1; // Default to 1 if not provided
//     let startNumber = "0000001"; // Starting point

//     // Get the largest existing user number
//     const largestUser = await User.findOne(
//       { email: { $regex: /^[0-9]+@magic-code\.net$/ } } // Filter only relevant emails
//     )
//       .sort({ email: -1 }) // Sort numerically
//       .limit(1);

//     if (largestUser) {
//       startNumber = String(
//         parseInt(largestUser.email.split("@")[0], 10) + 1
//       ).padStart(7, "0");
//     }
//     const session = await mongoose.startSession(); // Start a session
//     session.startTransaction(); // Start a transaction
//     try {
//       for (let i = 0; i < totalNumbers; i++) {
//         let fullName = "User";
//         let email = `${startNumber}@magic-code.net`;
//         let password = startNumber;
//         let qrName = startNumber;
//         let type = "url";
//         let qrDotColor = "#000000";
//         let backgroundColor = "#FFFFFF";
//         let dotStyle = "rounded";
//         let cornerStyle = "dot";
//         let text = "";
//         let url = "";

//         const existingUser = await User.findOne({ email }).session(session);
//         if (existingUser) {
//           await session.abortTransaction();
//           return res
//             .status(400)
//             .json({ message: "Email already in use", type: "error" });
//         }

//         const hashedPassword = await bcrypt.hash(password, 10);
//         const encryptedPassword = encryptPassword(password);
//         const newUser = new User({
//           fullName,
//           email,
//           password: hashedPassword,
//           role: "demo-user",
//           isActive: true,
//           userPasswordKey: encryptedPassword,
//         });

//         await newUser.save({ session });

//         const code = generateCode();

//         // Ensure unique code
//         let existingCode = await QRCodeData.findOne({ code }).session(session);

//         while (existingCode) {
//           code = generateCode(); // Generate new code
//           existingCode = await QRCodeData.findOne({ code }).session(session); // Check again
//         }

//         const qrCodeId = new mongoose.Types.ObjectId(); // Generate _id manually

//         let qrCode = new QRCodeData({
//           _id: qrCodeId, // Assign generated _id
//           user_id: newUser._id,
//           type,
//           url: `${process.env.FRONTEND_URL}/assign-qr-code/${encryptPassword(
//             qrCodeId.toString()
//           )}`,
//           text,
//           code,
//           qrName,
//           qrDotColor,
//           backgroundColor,
//           dotStyle,
//           cornerStyle,
//           applyGradient: "none",
//           logo: process.env.STATIC_LOGO,
//           // isTrial: true,
//           // isFirstActivationFree: true,
//           // isQrActivated: false,
//         });

//         // Save only once
//         await qrCode.save({ session });

//         UserArrObj.push({
//           uid: newUser._id,
//           email,
//           password,
//           code,
//           resetLinkValue: `${
//             process.env.FRONTEND_URL
//           }/assign-qr-code/${encryptPassword(qrCode._id.toString())}`,
//           qrCode,
//         });

//         // Increment number
//         startNumber = String(parseInt(startNumber, 10) + 1).padStart(7, "0");
//       }
//       await session.commitTransaction();
//       session.endSession();
//     } catch (error) {
//       console.error("Error during registration:", error);
//       // Check if session is defined before using it
//       // Check if session exists and is still active before aborting
//       if (session && session.inTransaction()) {
//         await session.abortTransaction();
//         session.endSession();
//       }
//       return res.status(500).json({
//         message: "Something went wrong please try again later",
//         type: "error",
//       });
//     }
//     res.status(201).json({
//       message: "Demo users successfully registered",
//       data: UserArrObj,
//       type: "success",
//     });
//   }
// );

router.post(
  "/create-trial-users",
  upload.fields([{ name: "media-file", maxCount: 1 }]),
  multerErrorHandler,
  async (req, res) => {
    let UserArrObj = [];
    let { totalNumbers } = req.body; // Get the number of users to create

    totalNumbers = parseInt(totalNumbers, 10) || 1; // Default to 1 if not provided
    let startNumber = "0000001"; // Starting point

    // Get the largest existing user number
    const largestUser = await User.findOne(
      { email: { $regex: /^[0-9]+@magic-code\.net$/ } } // Filter only relevant emails
    )
      .sort({ email: -1 }) // Sort numerically
      .limit(1);

    if (largestUser) {
      startNumber = String(
        parseInt(largestUser.email.split("@")[0], 10) + 1
      ).padStart(7, "0");
    }
    const session = await mongoose.startSession(); // Start a session
    session.startTransaction(); // Start a transaction
    try {
      for (let i = 0; i < totalNumbers; i++) {
        let fullName = "User";
        let email = `${startNumber}@magic-code.net`;
        let password = startNumber;
        let qrName = startNumber;
        let type = "url";
        let qrDotColor = "#000000";
        let backgroundColor = "#FFFFFF";
        let dotStyle = "rounded";
        let cornerStyle = "dot";
        let text = "";
        let url = "";

        const existingUser = await User.findOne({ email }).session(session);
        if (existingUser) {
          await session.abortTransaction();
          return res
            .status(400)
            .json({ message: "Email already in use", type: "error" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const encryptedPassword = encryptPassword(password);
        const newUser = new User({
          fullName,
          email,
          password: hashedPassword,
          role: "demo-user",
          isActive: true,
          userPasswordKey: encryptedPassword,
        });

        await newUser.save({ session });

        const code = generateCode(7);

        // Ensure unique code
        let existingCode = await QRCodeData.findOne({ code }).session(session);

        while (existingCode) {
          code = generateCode(); // Generate new code
          existingCode = await QRCodeData.findOne({ code }).session(session); // Check again
        }

        const qrCodeId = new mongoose.Types.ObjectId(); // Generate _id manually

        let qrCode = new QRCodeData({
          _id: qrCodeId, // Assign generated _id
          user_id: newUser._id,
          type,
          url: `${process.env.FRONTEND_URL}/assign-qr-code/${encryptPassword(
            qrCodeId.toString()
          )}`,
          text,
          code,
          qrName,
          qrDotColor,
          backgroundColor,
          dotStyle,
          cornerStyle,
          applyGradient: "none",
          logo: process.env.STATIC_LOGO,
          isTrial: true,
          isFirstActivationFree: true,
          isQrActivated: false,
        });

        // Save only once
        await qrCode.save({ session });

        UserArrObj.push({
          uid: newUser._id,
          email,
          password,
          code,
          resetLinkValue: `${
            process.env.FRONTEND_URL
          }/assign-qr-code/${encryptPassword(qrCode._id.toString())}`,
          qrCode,
        });

        // Increment number
        startNumber = String(parseInt(startNumber, 10) + 1).padStart(7, "0");
      }
      await session.commitTransaction();
      session.endSession();
    } catch (error) {
      console.error("Error during registration:", error);
      // Check if session is defined before using it
      // Check if session exists and is still active before aborting
      if (session && session.inTransaction()) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(500).json({
        message: "Something went wrong please try again later",
        type: "error",
      });
    }
    res.status(201).json({
      message: "Trial users successfully registered",
      data: UserArrObj,
      type: "success",
    });
  }
);

// Affiliate Users Routes

// Sales
router.get("/sales", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found", type: "error" });
    }

    const currentPage = parseInt(req.query.page) || 1;
    const recordsPerPage = Number(process.env.USER_PER_PAGE) || 1;
    const skip = (currentPage - 1) * recordsPerPage;

    const result = await Coupon.aggregate([
      {
        $match: {
          assignedToAffiliate: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "payments",
          let: {
            couponId: "$_id",
            couponCode: "$code",
            discountPercent: "$discountPercent",
            commissionPercent: "$commissionPercent",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$coupon_id", "$$couponId"] },
                    { $eq: ["$isCouponUsed", true] },
                    { $eq: ["$paymentStatus", "completed"] },
                  ],
                },
              },
            },
            {
              $lookup: {
                from: "users",
                localField: "user_id",
                foreignField: "_id",
                as: "user",
              },
            },
            { $unwind: "$user" },
            {
              $project: {
                fullName: "$user.fullName",
                email: "$user.email",
                amount: 1,
                commissionAmount: 1,
                paymentDate: 1,
                couponCode: "$$couponCode",
                discountPercent: "$$discountPercent",
                commissionPercent: "$$commissionPercent",
                isPaidToAffiliate: 1,
              },
            },
          ],
          as: "usedUsers",
        },
      },
      { $unwind: "$usedUsers" },
      { $replaceRoot: { newRoot: "$usedUsers" } },
      { $sort: { paymentDate: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: recordsPerPage }],
          paginatedCount: [{ $count: "total" }],
          fullCount: [{ $count: "total" }],
        },
      },
    ]);

    const usedByUsers = result[0].data;
    const totalUsedUsers = result[0].paginatedCount[0]?.total || 0;
    const totalUsedUsersWithoutPagination = result[0].fullCount[0]?.total || 0;
    const totalPages = Math.ceil(totalUsedUsers / recordsPerPage);

    res.render("dashboardnew", {
      user,
      activeSection: "sales",
      usedByUsers,
      totalUsedUsers,
      totalUsedUsersWithoutPagination,
      currentPage,
      totalPages,
    });
  } catch (error) {
    console.error("Error retrieving profile:", error);
    res.status(500).render("dashboardnew", {
      message: error.message,
      type: "error",
      activeSection: "sales",
      user: {},
    });
  }
});

// Wallet (Commission Balance + Transaction History with Queries)
router.get("/walletstatus", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    const limit = parseInt(req.query.limit) || 5; // Default to 5 items
    const skip = parseInt(req.query.skip) || 0;

    if (!user) {
      return res.status(404).render("dashboardnew", {
        message: "User not found",
        type: "error",
        user: {},
        activeSection: "wallet",
      });
    }

    if (user.role !== "affiliate") {
      return res.status(403).render("dashboardnew", {
        message: "Access denied. Only affiliates can view wallet.",
        type: "error",
        user,
        activeSection: "wallet",
      });
    }

    // === Existing logic to get unpaid commission balance ===
    const result = await Coupon.aggregate([
      {
        $match: {
          assignedToAffiliate: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "payments",
          let: { couponId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$coupon_id", "$$couponId"] },
                    { $eq: ["$isCouponUsed", true] },
                    { $eq: ["$paymentStatus", "completed"] },
                    { $eq: ["$isPaidToAffiliate", false] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                totalCommission: { $sum: "$commissionAmount" },
              },
            },
          ],
          as: "commissionData",
        },
      },
      { $unwind: "$commissionData" },
      {
        $group: {
          _id: null,
          totalCommissionBalance: { $sum: "$commissionData.totalCommission" },
        },
      },
    ]);

    const totalCommissionBalance = result[0]?.totalCommissionBalance || 0;

    // === Get paid commissions (isPaidToAffiliate = true) from Payment ===
    const paidCommissions = await Payment.aggregate([
      {
        $match: {
          isCouponUsed: true,
          paymentStatus: "completed",
        },
      },
      {
        $lookup: {
          from: "coupons",
          localField: "coupon_id",
          foreignField: "_id",
          as: "couponData",
        },
      },
      { $unwind: "$couponData" },
      {
        $match: {
          "couponData.assignedToAffiliate": new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $project: {
          _id: 0,
          amount: "$commissionAmount",
          createdAt: "$paymentDate",
          type: { $literal: "commission_paid" },
        },
      },
    ]);

    // === Get admin payments to affiliate from AffiliatePayment ===
    const affiliatePayments = await AffiliatePayment.aggregate([
      {
        $match: {
          affiliateId: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $project: {
          _id: 0,
          amount: "$amount",
          createdAt: "$createdAt",
          type: { $literal: "admin_payment" },
        },
      },
    ]);

    const allTransactions = [...paidCommissions, ...affiliatePayments];
    allTransactions.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const paginatedTransactions = allTransactions.slice(skip, skip + limit);

    // === Render to dashboard ===
    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res.json({
        transactionHistory: paginatedTransactions,
        hasMore: skip + limit < allTransactions.length,
      });
    }

    // === Render to dashboard ===
    res.render("dashboardnew", {
      user,
      activeSection: "wallet",
      totalCommissionBalance: totalCommissionBalance.toFixed(2),
      transactionHistory: paginatedTransactions,
      hasMore: skip + limit < allTransactions.length,
    });
  } catch (error) {
    console.error("Error retrieving wallet balance:", error);
    res.status(500).render("dashboardnew", {
      message: error.message,
      type: "error",
      user: {},
      activeSection: "wallet",
    });
  }
});

router.get("/coupons", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch user with minimal fields (e.g., role)
    const user = await User.findById(userId).select(
      "role showEditOnScan subscription"
    );

    if (!user || user.role !== "affiliate") {
      return res.status(403).render("viewaffiliateuser", {
        message: "Access denied or user is not an affiliate",
        type: "error",
        user: null,
        FRONTEND_URL: process.env.FRONTEND_URL,
        coupons: [],
        currentPage: null,
        totalPages: null,
      });
    }

    const currentPage = parseInt(req.query.page) || 1;
    const recordsPerPage = Number(process.env.USER_PER_PAGE) || 1;

    const totalCoupons = await Coupon.countDocuments({
      assignedToAffiliate: userId,
    });

    const totalPages = Math.ceil(totalCoupons / recordsPerPage);
    const skip = (currentPage - 1) * recordsPerPage;

    const coupons = await Coupon.find({ assignedToAffiliate: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(recordsPerPage);

    res.render("dashboardnew", {
      user,
      FRONTEND_URL: process.env.FRONTEND_URL,
      coupons,
      currentPage,
      totalPages,
      activeSection: "coupon",
    });
  } catch (error) {
    console.error("Error fetching affiliate coupons:", error);
    res.status(500).render("dashboardnew", {
      message: "An error occurred while fetching affiliate coupons",
      type: "error",
      user: null,
      coupons: [],
      FRONTEND_URL: process.env.FRONTEND_URL,
    });
  }
});

// Send Admin Notification Email
router.post("/send-admin-email", authMiddleware, async (req, res) => {
  const { remarks, purpose, accountNumber } = req.body;

  try {
    if (!remarks || !purpose || !accountNumber) {
      return res.status(400).json({
        message: "Remarks, purpose, and account number are required",
        type: "error",
      });
    }

    const userId = req.user._id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        type: "error",
      });
    }

    // If user is an affiliate and accountNo is not already set
    if (user.role === "affiliate") {
      const trimmedAccount = accountNumber.trim();

      if (!user.accountNo || user.accountNo.trim() !== trimmedAccount) {
        user.accountNo = trimmedAccount;
        await user.save();
      }
    }

    const adminEmail = process.env.ADMIN_EMAIL || "arnoldschmidt.com@gmail.com";

    const sender = {
      email: "arnoldschmidt@magic-code.net",
      name: "Magic Code - Admin Notification",
    };

    const emailContent = `
    <!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Admin Notification</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 30px auto;
      background: #ffffff;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      text-align: center;
    }
    h2 {
      color: #333;
    }
    p {
      color: #555;
      font-size: 16px;
      line-height: 1.5;
    }
    .info-box {
      font-size: 16px;
      background-color: #f0f0f0;
      padding: 10px 15px;
      border-radius: 5px;
      display: inline-block;
      margin: 10px 0;
      font-weight: bold;
      color: #007bff;
    }
    .footer {
      margin-top: 30px;
      font-size: 14px;
      color: #888;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2>Admin Alert: New Submission</h2>
    <p><strong>User Email:</strong> ${user.email || "Not Provided"}</p>

    <p><strong>Account Number:</strong></p>
    <div class="info-box">${accountNumber}</div>

    <p><strong>Purpose:</strong></p>
    <div class="info-box">${purpose}</div>

    <p><strong>Remarks:</strong></p>
    <div class="info-box">${remarks}</div>

    <p class="footer">&copy; 2025 Magic Code | Admin Notification System</p>
  </div>
</body>
</html>
    `;

    // Send the email
    SendEmail(sender, adminEmail, "New Payment Request", emailContent);

    res
      .status(200)
      .json({ message: "Admin email sent successfully", type: "success" });
  } catch (error) {
    console.error("Error sending admin email:", error);
    res
      .status(500)
      .json({ message: "Failed to send admin email", type: "error" });
  }
});

router.post("/mc-details", authMiddleware, async (req, res) => {
  try {
    const { SixDigitCode } = req.body;

    if (!SixDigitCode) {
      return res.status(400).json({ error: "SixDigitCode is required." });
    }

    const qrCode = await QRCodeData.findOne({ code: SixDigitCode });

    if (!qrCode) {
      return res
        .status(404)
        .json({ error: "QR code not associated with Any Account yet." });
    }

    let QRCodeName = qrCode.qrName;
    let QRCodeType = qrCode.type;
    let QRCodeURL = qrCode.url;
    let QRCodeDemo = qrCode.isDemo;
    let QRUserID = qrCode.user_id;

    if (QRCodeDemo) {
      QRUserID = qrCode.assignedTo;
    }

    if (!QRUserID) {
      return res.status(400).json({
        error: `MC not assigned to anyone, btw it's name is ${QRCodeName}`,
      });
    }

    let user = await User.findOne({
      _id: new mongoose.Types.ObjectId(QRUserID),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const UserName = user.fullName;
    const UserEmail = user.email;

    const UserPassword = decryptPassword(user.userPasswordKey);

    return res.json({
      QRCodeName,
      QRCodeType,
      QRCodeURL,
      QRCodeDemo,
      QRUserID,
      UserName,
      UserEmail,
      UserPassword,
    });
  } catch (error) {
    console.error("Error in /mc-details:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

router.get("/admindashboard/scanner", authMiddleware, async (req, res) => {
  res.render("MCDeatilsByScanner");
});

router.get("/mc-addon-login", async (req, res) => {
  try {
    res.render("addon-login"); // Send type as 'success'
  } catch (error) {
    console.error("Error generating Magic code:", error);
    res.status(500).render("login", {
      message: "Failed to load login page",
      type: "error", // Send type as 'error'
    });
  }
});

router.get("/admindashboard/vip-users", async (req, res) => {
  try {
    const currentPage = parseInt(req.query.page) || 1;
    const recordsPerPage = Number(process.env.USER_PER_PAGE) || 1;
    const search = req.query.search ? req.query.search.trim() : "";

    // Base query
    const baseMatch = {
      "subscription.isVip": true,
    };

    // If search query exists, apply regex filters
    if (search) {
      baseMatch.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Count total matching VIP users
    const totalVipUsers = await User.countDocuments(baseMatch);
    const totalPages = Math.ceil(totalVipUsers / recordsPerPage);
    const skip = (currentPage - 1) * recordsPerPage;

    // Fetch paginated VIP users
    const users = await User.find(baseMatch).skip(skip).limit(recordsPerPage);

    // Process user data
    users.forEach((user) => {
      if (user.userPasswordKey) {
        user.userPasswordKey = decryptPassword(user.userPasswordKey);
      }
      user.encryptedId = encryptPassword(user._id.toString());
      // Generate a JWT token for each user
      const magicToken = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.MAGIC_LINK_JWT_EXPIRATION || "24h" }
      );

      // Append magic link to the user object
      user.magicLink = `${process.env.FRONTEND_URL}/verify-magiclink/${magicToken}`;
    });

    // Render the VIP users view
    res.render("vipusers", {
      users,
      currentPage,
      totalPages,
      totalUsers: totalVipUsers,
      FRONTEND_URL: process.env.FRONTEND_URL,
      search, // ✅ Pass search back to EJS for displaying in input and keeping pagination context
    });
  } catch (error) {
    console.error("Error loading VIP Users:", error);
    res.status(500).render("login", {
      message: "Failed to load VIP Users",
      type: "error",
    });
  }
});

// router.get("/admindashboard/vip-users", async (req, res) => {
//   try {
//     const currentPage = parseInt(req.query.page) || 1;
//     const recordsPerPage = Number(process.env.USER_PER_PAGE) || 1;

//     // Count users with subscription.isVip = true
//     const totalVipUsers = await User.countDocuments({
//       "subscription.isVip": true,
//     });
//     const totalPages = Math.ceil(totalVipUsers / recordsPerPage);
//     const skip = (currentPage - 1) * recordsPerPage;

//     // Fetch paginated VIP users
//     const users = await User.find({ "subscription.isVip": true })
//       .skip(skip)
//       .limit(recordsPerPage);

//     // Process user data (decrypt password and encrypt ID)
//     users.forEach((user) => {
//       if (user.userPasswordKey) {
//         user.userPasswordKey = decryptPassword(user.userPasswordKey);
//       }
//       user.encryptedId = encryptPassword(user._id.toString());
//     });

//     // Render a separate view or reuse affiliateusers with updated context
//     res.render("vipusers", {
//       users,
//       currentPage,
//       totalPages,
//       totalUsers: totalVipUsers,
//       FRONTEND_URL: process.env.FRONTEND_URL,
//     });
//   } catch (error) {
//     console.error("Error loading VIP Users:", error);
//     res.status(500).render("login", {
//       message: "Failed to load VIP Users",
//       type: "error",
//     });
//   }
// });

router.post("/set-first-qr", authMiddleware, async (req, res) => {
  try {
    const user_id = req.user._id;
    const { qrId } = req.body;

    if (!qrId) {
      return res
        .status(400)
        .json({ message: "QR code ID is required", type: "error" });
    }

    const targetQr = await QRCodeData.findOne({
      _id: qrId,
      $or: [{ user_id }, { assignedTo: user_id }],
    });

    if (!targetQr) {
      return res
        .status(404)
        .json({ message: "QR code not found or access denied", type: "error" });
    }

    await QRCodeData.updateMany(
      { $or: [{ user_id }, { assignedTo: user_id }] },
      { $set: { isFirstQr: false } }
    );

    targetQr.isFirstQr = true;
    await targetQr.save();

    res.json({
      message: "Successfully updated the primary QR code.",
      type: "success",
    });
  } catch (error) {
    console.error("Error setting first QR:", error);
    res.status(500).json({ message: "Internal server error", type: "error" });
  }
});

router.get("/qrhistory/:qrCodeId", authMiddleware, async (req, res) => {
  try {
    const qrCodeId = req.params.qrCodeId;
    const limit = parseInt(req.query.limit) || 5;
    const skip = parseInt(req.query.skip) || 0;

    // Step 1: Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(qrCodeId)) {
      const errorResponse = {
        type: "error",
        message: "Invalid QR Code ID",
        histories: [],
        hasMore: false,
        qrCodeId,
      };

      if (req.xhr || req.headers.accept.indexOf("json") > -1) {
        return res.status(400).json(errorResponse);
      }

      return res.status(400).render("qr-history", errorResponse);
    }

    const query = { qrCodeId: new mongoose.Types.ObjectId(qrCodeId) };

    const totalCount = await QRCodeHistory.countDocuments(query);
    const histories = await QRCodeHistory.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("change qrCodeId createdAt")
      .lean();

    // Step 2: Handle not found
    if (totalCount === 0) {
      const notFoundResponse = {
        type: "error",
        message: "No history found for this QR code.",
        histories: [],
        hasMore: false,
        qrCodeId,
      };

      if (req.xhr || req.headers.accept.indexOf("json") > -1) {
        return res.status(404).json(notFoundResponse);
      }

      return res.status(404).render("qr-history", notFoundResponse);
    }

    const hasMore = skip + limit < totalCount;

    // Step 3: Return valid response
    const successResponse = {
      type: "success",
      message: "",
      histories,
      hasMore,
      skip: skip + limit,
      qrCodeId,
    };

    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res.json(successResponse);
    }

    res.render("qr-history", successResponse);
  } catch (error) {
    console.error("Error fetching QR Code history:", error);

    const errorResponse = {
      type: "error",
      message: "Internal server error while loading QR code history",
      histories: [],
      hasMore: false,
      qrCodeId: req.params.qrCodeId,
    };

    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res.status(500).json(errorResponse);
    }

    res.status(500).render("qr-history", errorResponse);
  }
});

// Special Offer Info Page with couponId as a URL param
router.get(
  "/special-offer-info/:couponId",
  authMiddleware,
  async (req, res) => {
    try {
      const { couponId } = req.params;
      // You can use couponId to fetch related data if needed

      res.render("dashboardnew", {
        couponId, // Pass couponId to the view if needed
        type: "success",
        activeSection: "special-offer-info",
        user: req.user,
      });
    } catch (error) {
      console.error("Error loading Special Offer Info page:", error);
      res.status(500).render("login", {
        message: "Failed to load login page",
        type: "error",
      });
    }
  }
);

//Post Data in special Offer
router.post(
  "/special-offer-info/:couponId",
  authMiddleware,
  upload.fields([{ name: "media-file", maxCount: 1 }]),
  multerErrorHandler,
  async (req, res) => {
    try {
      const { couponId } = req.params;
      const { type, text, url } = req.body;

      // ✅ Validate MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(couponId)) {
        return res.status(400).json({ message: "Invalid Coupon ID" });
      }

      if (!["text", "url", "media"].includes(type)) {
        return res.status(400).json({ message: "Invalid specialOffer type" });
      }

      const existingCoupon = await Coupon.findById(couponId);

      if (!existingCoupon) {
        return res.status(404).json({ message: "Coupon not found" });
      }

      // ✅ Always delete old media file if it exists
      const oldOffer = existingCoupon.specialOffer;
      if (oldOffer?.type === "media" && oldOffer.media_url) {
        const fullPath = path.resolve(oldOffer.media_url);
        fs.unlink(fullPath, (err) => {
          if (err) {
            console.warn("Failed to delete old media file:", err.message);
          }
        });
      }

      const specialOffer = { type };

      if (type === "text") {
        if (!text) {
          return res
            .status(400)
            .json({ message: "Text is required for type 'text'" });
        }
        specialOffer.text = text;
      }

      if (type === "url") {
        if (!url) {
          return res
            .status(400)
            .json({ message: "URL is required for type 'url'" });
        }
        if (!/^https?:\/\//i.test(url)) {
          return res
            .status(400)
            .json({ message: "URL must begin with http:// or https://" });
        }
        specialOffer.url = url;
      }

      if (type === "media") {
        const mediaFile = req.files?.["media-file"]?.[0];

        if (!mediaFile) {
          return res
            .status(400)
            .json({ message: "Media file is required for type 'media'" });
        }

        if (mediaFile.size > MAX_FILE_SIZE) {
          return res
            .status(400)
            .json({ message: "Media file should not exceed 50MB" });
        }

        specialOffer.media_url = mediaFile.path;
      }

      const updatedCoupon = await Coupon.findByIdAndUpdate(
        couponId,
        { specialOffer },
        { new: true }
      );

      res.status(200).json({
        message: "Special offer saved successfully",
        coupon: updatedCoupon,
      });
    } catch (error) {
      console.error("Error saving special offer:", error);
      res.status(500).json({ message: "Failed to save special offer" });
    }
  }
);

//Get Data in Special Offer

router.get(
  "/special-offer-info-data/:couponId",
  authMiddleware,
  async (req, res) => {
    try {
      const { couponId } = req.params;

      // ✅ Validate MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(couponId)) {
        return res.status(400).json({ message: "Invalid Coupon ID" });
      }

      const coupon = await Coupon.findById(couponId);

      if (!coupon) {
        return res.status(404).json({ message: "Coupon not found" });
      }

      const { specialOffer } = coupon;

      if (!specialOffer || !specialOffer.type) {
        return res
          .status(200)
          .json({ message: "No special offer found", data: null });
      }

      res.status(200).json({
        message: "Special offer retrieved successfully",
        data: specialOffer,
      });
    } catch (error) {
      console.error("Error fetching special offer:", error);
      res.status(500).json({ message: "Failed to retrieve special offer" });
    }
  }
);

router.post("/validate-coupon-code", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { code } = req.body;

    if (!code || typeof code !== "string") {
      return res.status(400).json({ message: "Coupon code is required" });
    }

    // ✅ Find coupon by code (adjust field name if needed)
    const coupon = await Coupon.findOne({ code: code.trim().toUpperCase() });

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    const qrCodes = await QRCodeData.find({
      $or: [
        { user_id: userId }, // QR codes created by the user
        { assignedTo: userId }, // QR codes assigned to the user
      ],
    }).sort({ createdAt: -1 });
    const hasSpecialOffer =
      coupon.specialOffer &&
      Object.values(coupon.specialOffer).some(
        (val) => val !== undefined && val !== null && val !== ""
      );

    return res.status(200).json({
      message: "Coupon validated",
      valid: true,
      hasSpecialOffer,
      qrCodes,
      couponId: coupon._id,
    });
  } catch (error) {
    console.error("Error validating coupon code:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/set-special-offer-qrs", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { couponId, qrCodeIds } = req.body;

    if (!couponId || !Array.isArray(qrCodeIds) || qrCodeIds.length === 0) {
      return res
        .status(400)
        .json({ message: "Coupon ID and QR Code IDs are required" });
    }

    // ✅ Check if couponId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      return res.status(400).json({ message: "Invalid coupon ID" });
    }

    // ✅ Validate coupon existence
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    // ✅ Optional: Check if coupon has a special offer
    const hasSpecialOffer =
      coupon.specialOffer &&
      Object.values(coupon.specialOffer).some(
        (val) => val !== undefined && val !== null && val !== ""
      );

    if (!hasSpecialOffer) {
      return res
        .status(400)
        .json({ message: "This coupon does not have a special offer" });
    }

    // ✅ Update only QR codes that belong to the user
    const result = await QRCodeData.updateMany(
      {
        _id: { $in: qrCodeIds },
        $or: [{ user_id: userId }, { assignedTo: userId }],
      },
      { $set: { specialOfferCouponId: couponId } }
    );

    return res.status(200).json({
      message: `${result.modifiedCount} QR code(s) updated with special offer coupon`,
      success: true,
    });
  } catch (error) {
    console.error("Error assigning coupon to QR codes:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/disconnect-special-offer", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;

    // Remove `specialOfferCouponId` from all QR documents owned by or assigned to the user
    const result = await QRCodeData.updateMany(
      {
        $or: [{ user_id: userId }, { assignedTo: userId }],
        specialOfferCouponId: { $exists: true },
      },
      {
        $unset: { specialOfferCouponId: "" },
      }
    );

    res.json({
      success: true,
      message: "Disconnected successfully.",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error disconnecting:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
