require("dotenv").config(); // Load environment variables
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcrypt");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const { authMiddleware } = require("../middleware/auth"); // Import the middleware
const {
  checkSubscriptionMiddleware,
} = require("../middleware/checkSubscriptionStatus"); // Import the middleware
const QRCodeData = require("../models/QRCODEDATA"); // Adjust the path as necessary
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

    // Render the assign QR code page with the QR code data
    res.render("assignqrcode-new", {
      qrCode, // Send the QR code data to the EJS template
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
  const { email, encId } = req.body;

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
    if (
      qrCodeData.assignedTo &&
      qrCodeData.isQrActivated &&
      qrCodeData.isDemo
    ) {
      return res.status(400).json({
        message: "QR code is already assigned and activated",
        type: "error",
      });
    }

    let user;

    // Find the user by email
    user = await User.findOne({ email });

    if (!user) {
      // Create a new user if the user does not exist
      const randomPassword = Math.random().toString(36).slice(-8); // Generate a random password
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

    if (qrCodeData.assignedTo !== user._id) {
      qrCodeData.assignedTo = user._id; // Assign the user._id directly
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
      email: "textildruckschweiz.com@gmail.com",
      name: "Magic Code - Login Link",
    };

    const content = `
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
        <p>After Login SET YOUR PASSWORD under My Profile.</p>
        <p class="footer">&copy; 2025 Magic Code | All rights reserved.</p>
    </div>
</body>
</html>
    `;

    // Send the magic link email
    SendEmail(sender, user.email, "Your Magic Link to Login", content);

    //Clear cookies (if needed)
    res.clearCookie("token", { httpOnly: false });
    res.clearCookie("userId", { httpOnly: false });

    res
      .status(200)
      .json({ message: "Magic link sent to your email", type: "success" });
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
      .select("qrName type code url")
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
    console.log(currentPage, totalPages);
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

// Admin Dashboard Page with Pagination and Decryption for Visible Users
router.get("/admindashboard", authMiddleware, async (req, res) => {
  try {
    // Get current page from query params, default to 1 if not provided
    const currentPage = parseInt(req.query.page) || 1;
    const recordsPerPage = Number(process.env.USER_PER_PAGE) || 1;

    // Fetch total number of non-admin users to calculate total pages
    const totalUsers = await User.countDocuments({ role: { $ne: "admin" } });

    // Calculate total pages (ceil to the nearest whole number)
    const totalPages = Math.ceil(totalUsers / recordsPerPage);

    // Calculate the number of users to skip
    const skip = (currentPage - 1) * recordsPerPage;

    const users = await User.aggregate([
      { $match: { role: { $ne: "admin" } } }, // Exclude admin users
      {
        $lookup: {
          from: "qrcodedatas",
          let: { userId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$user_id", "$$userId"] }, // Count QR codes the user created
                    { $eq: ["$assignedTo", "$$userId"] }, // Count QR codes assigned to them (direct equality), // Count QR codes assigned to them
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
          qrCount: { $size: "$qrData" }, // Total count (created + assigned)
        },
      },
    ])
      .skip(skip)
      .limit(recordsPerPage);
    // Decrypt passwords only for the users on the current page
    users.forEach((user) => {
      if (user.userPasswordKey) {
        user.userPasswordKey = decryptPassword(user.userPasswordKey); // Decrypt the password
      }
      user.encryptedId = encryptPassword(user._id.toString()); // Encrypt the ObjectId string
    });
    // Render the dashboard with the users data and pagination info
    res.render("admindashboard", {
      users,
      currentPage,
      totalPages,
      totalUsers,
      FRONTEND_URL: process.env.FRONTEND_URL,
    });
  } catch (error) {
    console.error("Error loading Admin Dashboard:", error);
    res.status(500).render("login", {
      message: "Failed to load Admin Dashboard",
      type: "error", // Send type as 'error'
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
  const { email, password } = req.body;

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
      email: "textildruckschweiz.com@gmail.com",
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
router.post("/register", async (req, res) => {
  const { fullName, email, password } = req.body;

  try {
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

    res.cookie("token", token, {
      httpOnly: true, // More secure — prevents JavaScript access
      secure: true, // Required for iOS/Safari under HTTPS
      sameSite: "Lax", // Works well for same-domain setups
      maxAge: Number(process.env.COOKIE_EXPIRATION),
    });

    // Send success response with token
    res.status(201).json({
      message: "Registration successful!",
      token,
      type: "success",
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
  const { email, encId } = req.body;

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
      if (!user) {
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

    // Email configuration
    const sender = {
      email: "textildruckschweiz.com@gmail.com",
      name: "Magic Code - Login Link",
    };

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
        <p>After Login SET YOUR PASSWORD under My Profile.</p>
        <p class="footer">&copy; 2025 Magic Code | All rights reserved.</p>
    </div>
</body>
</html>

      `;

    SendEmail(sender, user.email, "Your Magic Link to Login", content);
    // Clear cookies
    res.clearCookie("token", { httpOnly: false });
    res.clearCookie("userId", { httpOnly: false });

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

      if (qrCode) {
        return res.redirect(
          `${process.env.FRONTEND_URL}/dashboard?magiccode=${decryptedQrCodeId}&showPopup=true`
        );
      }
    }

    // Redirect user to dashboard
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
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

        return res.redirect(`/dashboard`);
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
        console.log("i am in 2");
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

// My User Control
router.get("/usercontrol", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    // Fetch only the showEditOnScan field, excluding other sensitive data
    const user = await User.findById(userId).select("showEditOnScan role");

    if (!user) {
      return res.status(404).json({ message: "User not found", type: "error" });
    }
    res.render("dashboardnew", { user, activeSection: "usercontrol" });
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
          // { assignedTo: user.id }, // QR codes assigned to the user
        ],
      });

      // Check if user has already created 5 or more QR codes
      if (qrCodes.length >= 5) {
        return res.status(400).json({
          message: "You can only create a maximum of 5 QR codes.",
          type: "error",
        });
      }
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
      console.log(mediaFilePath, "new here");
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

      // Check if QR trial has expired

      // Check if QR trial has expired
      // if (
      //   qrCode.isTrial &&
      //   qrCode.activatedUntil &&
      //   new Date() > new Date(qrCode.activatedUntil)
      // ) {
      //   return res
      //     .status(400)
      //     .json({ message: "QR code has expired", type: "error" });
      // }

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
router.get("/:alphanumericCode([a-zA-Z0-9]{6,7})", async (req, res) => {
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

    if (!codeData) {
      // If no data found for the alphanumeric code
      return res.status(404).render("error", {
        message: "Magic Code not found.",
        type: "error", // Used for toast or error notification
      });
    }

    if (
      codeData.isTrial &&
      codeData.activatedUntil &&
      new Date() > new Date(codeData.activatedUntil)
    ) {
      res.render("expired-code");
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

    // Check the type of the code and handle accordingly
    if (codeData.type === "url") {
      console.log("I am working");
      // Redirect to the URL found in the database if type is 'url'
      return res.redirect(codeData.url); // Redirects to the URL
    } else if (codeData.type === "media") {
      // Redirect to the media URL if type is 'media'
      return res.redirect(
        `${req.protocol}://${req.get("host")}/${codeData.media_url}`
      ); // Assuming media_url is a relative path (e.g., uploads/)
    } else if (codeData.type === "text") {
      // Send plain HTML response to display the text content
      let isLoggedIn = false;
      if (token) {
        isLoggedIn = true;
      }

      res.render("content", { content: codeData.text, isLoggedIn });
    } else {
      // If the type is not valid, return an error
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

module.exports = router;
