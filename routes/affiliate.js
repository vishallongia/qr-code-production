const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
require("dotenv").config();
const User = require("../models/User");
const Coupon = require("../models/Coupon");
const Payment = require("../models/Payment");
const AffiliatePayment = require("../models/AffiliatePayment");
const jwt = require("jsonwebtoken");
const {
  encryptPassword,
  decryptPassword,
  generateCode,
} = require("../public/js/cryptoUtils");

// create affiliate user
router.get("/create-affiliate-user", async (req, res) => {
  try {
    res.render("createaffiliateuser"); // Send type as 'success'
  } catch (error) {
    console.error("Error generating Magic code:", error);
    res.status(500).render("login", {
      message: "Failed to load login page",
      type: "error", // Send type as 'error'
    });
  }
});

router.get("/affiliate-users", async (req, res) => {
  try {
    const currentPage = parseInt(req.query.page) || 1;
    const recordsPerPage = Number(process.env.USER_PER_PAGE) || 1;
    const search = req.query.search ? req.query.search.trim() : "";

    const baseMatch = { role: "affiliate" };

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

    const totalAffiliates = await User.countDocuments(baseMatch);
    const totalPages = Math.ceil(totalAffiliates / recordsPerPage);
    const skip = (currentPage - 1) * recordsPerPage;

    // 🟩 Use aggregation to preserve structure and include QR count
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
        $addFields: {
          qrCount: { $size: "$qrData" },
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
          createdAt: 1,
          qrCount: 1,
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

      const magicToken = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.MAGIC_LINK_JWT_EXPIRATION || "24h" }
      );

      user.magicLink = `${process.env.FRONTEND_URL}/verify-magiclink/${magicToken}`;
    });

    res.render("affiliateusers", {
      users,
      currentPage,
      totalPages,
      totalUsers: totalAffiliates,
      FRONTEND_URL: process.env.FRONTEND_URL,
      search,
    });
  } catch (error) {
    console.error("Error loading Affiliate Dashboard:", error);
    res.status(500).render("login", {
      message: "Failed to load Affiliate Dashboard",
      type: "error",
    });
  }
});

// // create affiliate user
// router.get("/affiliate-users", async (req, res) => {
//   try {
//     const currentPage = parseInt(req.query.page) || 1;
//     const recordsPerPage = Number(process.env.USER_PER_PAGE) || 1;

//     // Fetch total number of affiliate users
//     const totalAffiliates = await User.countDocuments({ role: "affiliate" });
//     const totalPages = Math.ceil(totalAffiliates / recordsPerPage);
//     const skip = (currentPage - 1) * recordsPerPage;

//     // Fetch paginated affiliate users
//     const users = await User.find({ role: "affiliate" })
//       .skip(skip)
//       .limit(recordsPerPage);

//     // Add encrypted ID if needed
//     users.forEach((user) => {
//       if (user.userPasswordKey) {
//         user.userPasswordKey = decryptPassword(user.userPasswordKey); // Decrypt the password
//       }
//       user.encryptedId = encryptPassword(user._id.toString()); // Encrypt the ObjectId string
//     });

//     // Render the affiliate dashboard with data
//     res.render("affiliateusers", {
//       users,
//       currentPage,
//       totalPages,
//       totalUsers: totalAffiliates,
//       FRONTEND_URL: process.env.FRONTEND_URL,
//     });
//   } catch (error) {
//     console.error("Error loading Affiliate Dashboard:", error);
//     res.status(500).render("login", {
//       message: "Failed to load Affiliate Dashboard",
//       type: "error",
//     });
//   }
// });

// create affiliate user
// router.get("/affiliate-users", async (req, res) => {
//   try {
//     const currentPage = parseInt(req.query.page) || 1;
//     const recordsPerPage = Number(process.env.USER_PER_PAGE) || 1;

//     // Fetch total number of affiliate users
//     const totalAffiliates = await User.countDocuments({ role: "affiliate" });
//     const totalPages = Math.ceil(totalAffiliates / recordsPerPage);
//     const skip = (currentPage - 1) * recordsPerPage;

//     // Fetch paginated affiliate users
//     const users = await User.find({ role: "affiliate" })
//       .skip(skip)
//       .limit(recordsPerPage);

//     // Add encrypted ID if needed
//     users.forEach((user) => {
//       if (user.userPasswordKey) {
//         user.userPasswordKey = decryptPassword(user.userPasswordKey); // Decrypt the password
//       }
//       user.encryptedId = encryptPassword(user._id.toString()); // Encrypt the ObjectId string
//     });

//     // Render the affiliate dashboard with data
//     res.render("affiliateusers", {
//       users,
//       currentPage,
//       totalPages,
//       totalUsers: totalAffiliates,
//       FRONTEND_URL: process.env.FRONTEND_URL,
//     });
//   } catch (error) {
//     console.error("Error loading Affiliate Dashboard:", error);
//     res.status(500).render("login", {
//       message: "Failed to load Affiliate Dashboard",
//       type: "error",
//     });
//   }
// });

router.get("/affiliate-user/:userId", async (req, res) => {
  const { userId } = req.params;
  const currentPage = parseInt(req.query.page) || 1;
  const recordsPerPage = Number(process.env.USER_PER_PAGE) || 1;
  // Fetch total number of affiliate users
  const totalCoupons = await Coupon.countDocuments({
    assignedToAffiliate: userId,
  });
  const totalPages = Math.ceil(totalCoupons / recordsPerPage);
  const skip = (currentPage - 1) * recordsPerPage;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).render("viewaffiliateuser", {
      message: "Invalid Affiliate ID",
      type: "error",
      user: null,
      FRONTEND_URL: process.env.FRONTEND_URL,
    });
  }

  try {
    // Find affiliate user by ID and role
    const user = await User.findOne({ _id: userId, role: "affiliate" });

    if (!user) {
      return res.status(404).render("viewaffiliateuser", {
        message: "Affiliate user not found",
        type: "error",
        user: null,
        FRONTEND_URL: process.env.FRONTEND_URL,
        currentPage: null,
        totalPages: null,
      });
    }
    // Find all coupons assigned to this affiliate
    const coupons = await Coupon.find({ assignedToAffiliate: userId })
      .sort({ createdAt: -1 }) // optional sorting
      .skip(skip)
      .limit(recordsPerPage);
    // Render affiliate user detail view
    res.render("viewaffiliateuser", {
      message: "Affiliate user fetched successfully",
      type: "success",
      user,
      FRONTEND_URL: process.env.FRONTEND_URL,
      coupons,
      currentPage,
      totalPages,
    });
  } catch (error) {
    console.error("Error fetching affiliate user:", error);
    res.status(500).render("login", {
      message: "An error occurred while fetching affiliate user",
      type: "error",
      user: null,
      coupon: null,
      FRONTEND_URL: process.env.FRONTEND_URL,
    });
  }
});

//Create Coupon Render Page
router.get("/create-coupon/:affiliateId", async (req, res) => {
  const { affiliateId } = req.params;
  // Validate affiliateId format first
  if (!mongoose.Types.ObjectId.isValid(affiliateId)) {
    return res.status(400).render("createcoupon", {
      message: "Invalid Affiliate ID",
      type: "error",
      affiliate: null,
    });
  }

  try {
    const affiliate = await User.findById(affiliateId);
    if (!affiliate) {
      return res.status(404).render("createcoupon", {
        message: "Affiliate not found",
        type: "error",
        affiliate: null,
      });
    }

    res.render("createcoupon", {
      affiliate,
    });
  } catch (error) {
    console.error("Error loading coupon form:", error);
    res.status(500).render("error", {
      message: "Server error while loading coupon form",
      type: "error",
    });
  }
});

// Create Coupon api endpoint
router.post("/create-coupon/:affiliateId", async (req, res) => {
  const { code, discountPercent, commissionPercent } = req.body;
  const { affiliateId } = req.params;

  // Individual field validations
  if (!code) {
    return res.status(400).json({
      message: "Coupon code is required",
      type: "error",
    });
  }

  if (discountPercent === undefined || discountPercent === null) {
    return res.status(400).json({
      message: "Discount percent is required",
      type: "error",
    });
  }

  if (commissionPercent === undefined || commissionPercent === null) {
    return res.status(400).json({
      message: "Commission percent is required",
      type: "error",
    });
  }

  if (
    typeof discountPercent !== "number" ||
    discountPercent < 0 ||
    discountPercent > 100
  ) {
    return res.status(400).json({
      message:
        "Discount percent must be a positive number between 0 and 100",
      type: "error",
    });
  }

  if (
    typeof commissionPercent !== "number" ||
    commissionPercent < 0 ||
    commissionPercent > 100
  ) {
    return res.status(400).json({
      message:
        "Commission percent must be a number between 0 and 100 and cannot be negative",
      type: "error",
    });
  }

  if (!affiliateId) {
    return res.status(400).json({
      message: "Affiliate ID is required in the URL",
      type: "error",
    });
  }

  try {
    // Check for duplicate code
    const existingCoupon = await Coupon.findOne({
      code: code.trim().toUpperCase(),
    });
    if (existingCoupon) {
      return res.status(400).json({
        message: "Coupon code already exists",
        type: "error",
      });
    }

    // Validate affiliate user
    const isValidAffiliate = await User.findById(affiliateId);
    if (!isValidAffiliate) {
      return res.status(404).json({
        message: "Affiliate user not found",
        type: "error",
      });
    }

    // Create and save the new coupon
    const newCoupon = new Coupon({
      code: code.trim().toUpperCase(),
      discountPercent,
      commissionPercent,
      assignedToAffiliate: affiliateId,
    });

    await newCoupon.save();

    res.status(201).json({
      message: "Coupon created successfully",
      type: "success",
      coupon: newCoupon,
    });
  } catch (error) {
    console.error("Error creating coupon:", error);
    res.status(500).json({
      message: "Internal server error while creating coupon",
      type: "error",
    });
  }
});

// Render Update Coupon Page
router.get("/update-coupon/:couponId", async (req, res) => {
  const { couponId } = req.params;

  // Validate coupon ID format
  if (!mongoose.Types.ObjectId.isValid(couponId)) {
    return res.status(400).render("updatecoupon", {
      message: "Invalid Coupon ID",
      type: "error",
      coupon: null,
      affiliate: null,
    });
  }

  try {
    // Find coupon by ID and populate affiliate with only fullName
    const coupon = await Coupon.findById(couponId).populate({
      path: "assignedToAffiliate",
      select: "fullName",
    });

    if (!coupon) {
      return res.status(404).render("updatecoupon", {
        message: "Coupon not found",
        type: "error",
        coupon: null,
        affiliate: null,
      });
    }

    res.render("updatecoupon", {
      coupon,
      affiliate: coupon.assignedToAffiliate || null,
    });
  } catch (error) {
    console.error("Error loading update coupon form:", error);
    res.status(500).render("error", {
      message: "Server error while loading update coupon form",
      type: "error",
    });
  }
});

// Update Coupon API endpoint
router.put("/update-coupon/:couponId", async (req, res) => {
  const { code, discountPercent, commissionPercent } = req.body;
  const { couponId } = req.params;

  // Validate coupon ID
  if (!couponId) {
    return res.status(400).json({
      message: "Coupon ID is required in the URL",
      type: "error",
    });
  }

  // Field validations
  if (!code) {
    return res.status(400).json({
      message: "Coupon code is required",
      type: "error",
    });
  }

  if (discountPercent === undefined || discountPercent === null) {
    return res.status(400).json({
      message: "Discount percent is required",
      type: "error",
    });
  }

  if (commissionPercent === undefined || commissionPercent === null) {
    return res.status(400).json({
      message: "Commission percent is required",
      type: "error",
    });
  }

  if (
    typeof discountPercent !== "number" ||
    discountPercent <= 0 ||
    discountPercent > 100
  ) {
    return res.status(400).json({
      message:
        "Discount percent must be a positive number between 0.01 and 100",
      type: "error",
    });
  }

  if (
    typeof commissionPercent !== "number" ||
    commissionPercent < 0 ||
    commissionPercent > 100
  ) {
    return res.status(400).json({
      message:
        "Commission percent must be a number between 0 and 100 and cannot be negative",
      type: "error",
    });
  }

  try {
    // Check if the coupon exists
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({
        message: "Coupon not found",
        type: "error",
      });
    }

    // Check if new code is already used by another coupon
    const existingCode = await Coupon.findOne({
      code: code.trim().toUpperCase(),
      _id: { $ne: couponId }, // Exclude current coupon from match
    });

    if (existingCode) {
      return res.status(400).json({
        message: "Coupon code already in use by another coupon",
        type: "error",
      });
    }

    // Update the coupon fields
    coupon.code = code.trim().toUpperCase();
    coupon.discountPercent = discountPercent;
    coupon.commissionPercent = commissionPercent;

    await coupon.save();

    res.status(200).json({
      message: "Coupon updated successfully",
      type: "success",
      coupon,
    });
  } catch (error) {
    console.error("Error updating coupon:", error);
    res.status(500).json({
      message: "Internal server error while updating coupon",
      type: "error",
    });
  }
});

// Delete Coupon API endpoint
router.delete("/delete-coupon/:couponId", async (req, res) => {
  const { couponId } = req.params;

  // Validate coupon ID
  if (!couponId) {
    return res.status(400).json({
      message: "Coupon ID is required in the URL",
      type: "error",
    });
  }

  try {
    // Check if the coupon exists
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({
        message: "Coupon not found",
        type: "error",
      });
    }

    // Delete the coupon
    await Coupon.findByIdAndDelete(couponId);

    res.status(200).json({
      message: "Coupon deleted successfully",
      type: "success",
    });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    res.status(500).json({
      message: "Internal server error while deleting coupon",
      type: "error",
    });
  }
});

// Wallet (Commission Balance)
router.get("/pay-affiliate/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).render("pay-affiliate", {
        message: "User not found",
        type: "error",
        user: {},
      });
    }

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
          ],
          as: "validPayments",
        },
      },
      {
        $addFields: {
          totalCommission: {
            $sum: "$validPayments.commissionAmount",
          },
          salesCount: {
            $size: "$validPayments",
          },
        },
      },
      {
        $group: {
          _id: null,
          totalCommissionBalance: { $sum: "$totalCommission" },
          numberOfSales: { $sum: "$salesCount" },
        },
      },
    ]);

    const totalCommissionBalance = result[0]?.totalCommissionBalance || 0;
    const numberOfSales = result[0]?.numberOfSales || 0;

    res.render("pay-affiliate", {
      user,
      totalCommissionBalance,
      numberOfSales,
      user,
    });
  } catch (error) {
    console.error("Error retrieving wallet balance:", error);
    res.status(500).render("pay-affiliate", {
      message: error.message,
      type: "error",
      user: {},
    });
  }
});

router.post("/pay-now", async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { affiliateId, amount } = req.body;

    if (!affiliateId || isNaN(amount)) {
      return res.status(400).json({ message: "Invalid affiliateId or amount" });
    }

    const numericAmount = Number(amount);
    const affiliateObjectId = new mongoose.Types.ObjectId(affiliateId);

    session.startTransaction();

    // Step 1: Get all coupon IDs assigned to this affiliate
    const coupons = await Coupon.find(
      { assignedToAffiliate: affiliateObjectId },
      { _id: 1 }
    ).session(session);

    const couponIds = coupons.map((c) => c._id);

    if (couponIds.length === 0) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ message: "No coupons found for this affiliate." });
    }

    // Step 2: Get unpaid, completed, used payments sorted by oldest and add cumulative sum
    const payments = await Payment.aggregate([
      {
        $match: {
          coupon_id: { $in: couponIds },
          isCouponUsed: true,
          paymentStatus: "completed",
          isPaidToAffiliate: false,
        },
      },
      { $sort: { createdAt: 1 } },
      {
        $setWindowFields: {
          sortBy: { createdAt: 1 },
          output: {
            cumulativeSum: {
              $sum: "$commissionAmount",
              window: { documents: ["unbounded", "current"] },
            },
          },
        },
      },
      {
        $match: {
          cumulativeSum: { $lte: numericAmount },
        },
      },
    ]).session(session);

    if (!payments.length) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "No eligible payments found to match the amount." });
    }

    // Calculate total of selected commissionAmount
    const totalCommission = payments.reduce(
      (sum, p) => sum + p.commissionAmount,
      0
    );

    // Strict check: must match the amount exactly
    if (totalCommission !== numericAmount) {
      await session.abortTransaction();
      return res.status(400).json({
        message: `Mismatch: Sent amount ₹${numericAmount} ≠ eligible commissions ₹${totalCommission}`,
      });
    }

    const selectedIds = payments.map((p) => p._id);

    // Step 3: Mark selected payments as paid
    const updateResult = await Payment.updateMany(
      { _id: { $in: selectedIds } },
      { $set: { isPaidToAffiliate: true } },
      { session }
    );

    if (updateResult.modifiedCount !== selectedIds.length) {
      await session.abortTransaction();
      return res
        .status(500)
        .json({ message: "Mismatch while updating payment records." });
    }

    // Step 4: Record the payout
    await AffiliatePayment.create(
      [
        {
          affiliateId: affiliateObjectId,
          amount: numericAmount,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Affiliate payment completed successfully.",
      totalPaid: numericAmount,
      transactionsMarked: selectedIds.length,
    });
  } catch (err) {
    console.error("Affiliate payout error:", err);
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ message: "Internal server error." });
  }
});

router.get("/sales/:id", async (req, res) => {
  const currentPage = parseInt(req.query.page) || 1;
  const recordsPerPage = Number(process.env.USER_PER_PAGE) || 10;

  try {
    const userId = req.params.id;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).render("admin-affiliate-sales.ejs", {
        message: "Invalid user ID.",
        type: "error",
        activeSection: "sales",
        user: {},
        usedByUsers: [],
        totalUsedUsers: 0,
        currentPage,
        totalPages: 0,
        totalUsedUsersWithoutPagination: 0,
      });
    }

    // Check user existence
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).render("admin-affiliate-sales.ejs", {
        message: "User not found.",
        type: "error",
        activeSection: "sales",
        user: {},
        usedByUsers: [],
        totalUsedUsers: 0,
        currentPage,
        totalPages: 0,
        totalUsedUsersWithoutPagination: 0,
      });
    }

    // Optional: Check if user is an affiliate
    if (user.role !== "affiliate") {
      return res.status(403).render("admin-affiliate-sales.ejs", {
        message: "User is not an affiliate.",
        type: "error",
        activeSection: "sales",
        user,
        usedByUsers: [],
        totalUsedUsers: 0,
        currentPage,
        totalPages: 0,
        totalUsedUsersWithoutPagination: 0,
      });
    }

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
      {
        $sort: { paymentDate: -1 },
      },
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

    res.render("admin-affiliate-sales.ejs", {
      user,
      activeSection: "sales",
      usedByUsers,
      totalUsedUsers,
      totalUsedUsersWithoutPagination,
      currentPage,
      totalPages,
      message: null,
    });
  } catch (error) {
    console.error("Error in /sales/:id route:", error);
    res.status(500).render("admin-affiliate-sales.ejs", {
      message: "Server error occurred.",
      type: "error",
      activeSection: "sales",
      user: {},
      usedByUsers: [],
      totalUsedUsers: 0,
      currentPage,
      totalPages: 0,
      totalUsedUsersWithoutPagination: 0,
    });
  }
});

module.exports = router;
