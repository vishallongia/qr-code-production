const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
require("dotenv").config();
const User = require("../models/User");
const Coupon = require("../models/Coupon");
const Payment = require("../models/Payment");
const MagicCoinPlan = require("../models/MagicCoinPlan");
const AffiliatePayment = require("../models/AffiliatePayment");
const jwt = require("jsonwebtoken");
const {
  encryptPassword,
  decryptPassword,
  generateCode,
} = require("../public/js/cryptoUtils");

// Set user as TV Station
router.post("/make-tvstation", async (req, res) => {
  const { userId } = req.body;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found", type: "error" });
    }

    user.isTvStation = true;
    await user.save();

    res.json({ message: "User marked as TV Station", type: "success" });
  } catch (error) {
    console.error("TV Station update error:", error);
    res.status(500).json({
      message: "Internal server error",
      type: "error",
    });
  }
});

router.get("/tvstation-users", async (req, res) => {
  try {
    const currentPage = parseInt(req.query.page) || 1;
    const recordsPerPage = Number(process.env.USER_PER_PAGE) || 1;
    const search = req.query.search ? req.query.search.trim() : "";

    const baseMatch = {
      isTvStation: true, // Only filter by isTvStation now
    };

    if (search) {
      baseMatch.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const totalTvUsers = await User.countDocuments(baseMatch);
    const totalPages = Math.ceil(totalTvUsers / recordsPerPage);
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
        $addFields: {
          qrCount: { $size: "$qrData" },
        },
      },
      {
        $project: {
          _id: 1,
          fullName: 1,
          email: 1,
          userPasswordKey: 1,
          subscription: 1,
          createdAt: 1,
          qrCount: 1,
          role: 1,
          isTvStation: 1,
        },
      },
      { $skip: skip },
      { $limit: recordsPerPage },
    ]);

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

    res.render("tvstationusers", {
      users,
      currentPage,
      totalPages,
      totalUsers: totalTvUsers,
      FRONTEND_URL: process.env.FRONTEND_URL,
      search,
    });
  } catch (error) {
    console.error("Error loading TV Station Users:", error);
    res.status(500).render("login", {
      message: "Failed to load TV Station Users",
      type: "error",
    });
  }
});

module.exports = router;
