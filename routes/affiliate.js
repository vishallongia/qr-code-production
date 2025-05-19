const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
require("dotenv").config();
const User = require("../models/User");
const Coupon = require("../models/Coupon");
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

// create affiliate user
router.get("/affiliate-users", async (req, res) => {
  try {
    const currentPage = parseInt(req.query.page) || 1;
    const recordsPerPage = Number(process.env.USER_PER_PAGE) || 1;

    // Fetch total number of affiliate users
    const totalAffiliates = await User.countDocuments({ role: "affiliate" });
    const totalPages = Math.ceil(totalAffiliates / recordsPerPage);
    const skip = (currentPage - 1) * recordsPerPage;

    // Fetch paginated affiliate users
    const users = await User.find({ role: "affiliate" })
      .skip(skip)
      .limit(recordsPerPage);

    // Add encrypted ID if needed
    users.forEach((user) => {
      if (user.userPasswordKey) {
        user.userPasswordKey = decryptPassword(user.userPasswordKey); // Decrypt the password
      }
      user.encryptedId = encryptPassword(user._id.toString()); // Encrypt the ObjectId string
    });

    // Render the affiliate dashboard with data
    res.render("affiliateusers", {
      users,
      currentPage,
      totalPages,
      totalUsers: totalAffiliates,
      FRONTEND_URL: process.env.FRONTEND_URL,
    });
  } catch (error) {
    console.error("Error loading Affiliate Dashboard:", error);
    res.status(500).render("login", {
      message: "Failed to load Affiliate Dashboard",
      type: "error",
    });
  }
});

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

module.exports = router;
