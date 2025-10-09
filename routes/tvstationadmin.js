const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
require("dotenv").config();
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const {
  encryptPassword,
  decryptPassword,
  generateCode,
} = require("../public/js/cryptoUtils");
const WinnerRequest = require("../models/WinnerRequest"); // your Mongoose model
const SendEmail = require("../Messages/SendEmail");
const QuizQuestion = require("../models/QuizQuestion");
const VoteQuestion = require("../models/VoteQuestion");
const Applause = require("../models/Applause");
const Channel = require("../models/Channel");


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
          tvStationRules: 1,
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

// GET /requests
router.get("/requests", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    const page = parseInt(req.query.page) || 1;
    const type = req.query.type; // for XHR "Load More"

    // Filters
    const queryMap = {
      pending: {
        isApprovedByAdmin: false,
        isApprovedByUser: false,
        isDeclined: { $ne: true }, // matches false or missing
      },
      history: {
        $or: [
          { isApprovedByAdmin: true },
          { isApprovedByUser: true },
          { isDeclined: true },
        ],
      },
    };

    // Helper to fetch requests with status + user populated
    const fetchRequests = async (filter, skip = 0, limit = 6) => {
      const [requests, totalCount] = await Promise.all([
        WinnerRequest.aggregate([
          { $match: filter },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "users", // collection name in MongoDB
              localField: "userId",
              foreignField: "_id",
              as: "user",
            },
          },
          {
            $unwind: {
              path: "$user",
              preserveNullAndEmptyArrays: true, // optional: keeps request even if user is missing
            },
          },

          {
            $lookup: {
              from: "users",
              localField: "createdBy",
              foreignField: "_id",
              as: "createdByUser",
            },
          },
          {
            $unwind: {
              path: "$createdByUser",
              preserveNullAndEmptyArrays: true,
            },
          },

          // Populate channel
          {
            $lookup: {
              from: "channels",
              localField: "channelId",
              foreignField: "_id",
              as: "channel",
            },
          },
          { $unwind: { path: "$channel", preserveNullAndEmptyArrays: true } },

          // Populate session
          {
            $lookup: {
              from: "sessions",
              localField: "sessionId",
              foreignField: "_id",
              as: "session",
            },
          },
          { $unwind: { path: "$session", preserveNullAndEmptyArrays: true } },

          {
            $project: {
              sessionId: 1,
              type: 1,
              mode: 1,
              questionId: 1,
              isApprovedByAdmin: 1,
              isApprovedByUser: 1,
              isActive: 1,
              isDeclined: 1,
              createdAt: 1,
              updatedAt: 1,
              winnerName: "$user.fullName",
              winnerEmail: "$user.email",
              requesterName: "$createdByUser.fullName",
              requesterEmail: "$createdByUser.email",
              channelName: "$channel.channelName",
              sessionName: "$session.name",
              status: {
                $switch: {
                  branches: [
                    { case: { $eq: ["$isDeclined", true] }, then: "Declined" },
                    {
                      case: { $eq: ["$isApprovedByAdmin", true] },
                      then: "Approved by Admin",
                    },
                    {
                      case: { $eq: ["$isApprovedByUser", true] },
                      then: "Approved by TV Station User",
                    },
                  ],
                  default: "Pending",
                },
              },
            },
          },
        ]),
        WinnerRequest.countDocuments(filter),
      ]);

      return { requests, totalCount };
    };

    // --- XHR / Load More ---
    if (req.xhr || type) {
      if (!queryMap[type]) {
        return res.status(400).json({ message: "Invalid type" });
      }
      const skip = (page - 1) * limit;
      const data = await fetchRequests(queryMap[type], skip, limit);

      return res.json({
        requests: data.requests, // already contains status
        totalCount: data.totalCount,
        currentPage: page,
      });
    }

    // --- Initial page render ---
    const [pending, history] = await Promise.all([
      fetchRequests(queryMap.pending, 0, limit),
      fetchRequests(queryMap.history, 0, limit),
    ]);

    res.render("requests", {
      pendingRequests: pending.requests, // already contain status
      historyRequests: history.requests, // already contain status
      limit,
      totalCounts: {
        pending: pending.totalCount,
        history: history.totalCount,
      },
    });
  } catch (err) {
    console.error("Error fetching requests:", err);
    res.status(500).render("error", { message: "Failed to load requests" });
  }
});

// Approve request
router.post("/requests/:id/approve", async (req, res) => {
  try {
    const sender = {
      email: "arnoldschmidt@magic-code.net",
      name: "Magic Code - Plan Update",
    };

    const request = await WinnerRequest.findById(req.params.id);
    if (request.isApprovedByAdmin) {
      return res.status(400).json({ message: "Request already approved" });
    }
    if (!request) return res.status(404).json({ message: "Request not found" });

    const user = await User.findById(request.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (request.mode === "jackpot") {
      const subject = "🎉 Congratulations! You are our Jackpot Winner!";
      const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head><meta charset="UTF-8"><title>Jackpot Winner</title></head>
          <body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
            <div style="max-width:600px;margin:auto;background:#fff;padding:20px;border-radius:8px;">
              <h2 style="color:#333;">Hi ${user.fullName || "User"},</h2>
              <p>We are excited to announce that you have won the <b>Jackpot Reward</b> 🎊</p>
              <p>Our team will contact you soon with further details.</p>
              <div style="margin-top:20px;font-size:12px;color:#777;">© 2025 Magic Code | All rights reserved.</div>
            </div>
          </body>
          </html>
        `;

      SendEmail(sender, user.email, subject, htmlContent);
    }

    if (request.mode === "digital") {
      const now = new Date();
      const validTill = new Date();
      validTill.setMonth(validTill.getMonth() + 3);

      user.subscription = {
        isVip: true,
        qrLimit: 5,
        subscriptionCreatedAt: now,
        validTill: validTill,
      };
      await user.save();
      const subject = "🎉 Congratulations! Your Digital Reward is Activated";
      const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="UTF-8">
                  <title>Digital Reward Activated</title>
                </head>
                <body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
                  <div style="max-width:600px;margin:auto;background:#fff;padding:20px;border-radius:8px;">
                    <h2 style="color:#333;">Congratulations ${
                      user.fullName || "User"
                    }!</h2>
                    <p>Your VIP subscription has been activated as part of your <b>Digital Reward</b>.</p>
                 <p><b>Valid Till:</b> ${validTill.toDateString()}</p>
                    <p>Enjoy your exclusive benefits 🎁</p>
                    <div style="margin-top:20px;font-size:12px;color:#777;">© 2025 Magic Code | All rights reserved.</div>
                  </div>
                </body>
                </html>
              `;

      SendEmail(sender, user.email, subject, htmlContent);
    }

    request.isApprovedByAdmin = true; // or set appropriate flag
    await request.save();

    return res.json({
      success: true,
      message: "Request approved successfully",
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to approve request" });
  }
});

// Decline request
router.post("/requests/:id/decline", async (req, res) => {
  try {
    const request = await WinnerRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    request.isDeclined = true; // optional: add a flag in schema
    await request.save();

    return res.json({
      success: true,
      message: "Request declined successfully",
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to decline request" });
  }
});

// Approve or disapprove user to declare winner
router.post("/approve-to-draw-winner/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { allow } = req.body; // comes from frontend: true/false

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Ensure tvStationRules object exists
    if (!user.tvStationRules) {
      user.tvStationRules = {};
    }

    // Toggle based on request body
    user.tvStationRules.isApprovedByAdminToDrawWinner = !!allow;

    await user.save();

    return res.json({
      success: true,
      message: allow
        ? "User approved to declare winner successfully"
        : "User approval revoked successfully",
    });
  } catch (err) {
    console.error("Error approving to draw winner:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update user approval" });
  }
});

router.get("/magic-coin-commission/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    // 1️⃣ Validate User ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).render("magic-coin-commission/update", {
        message: "Invalid User ID",
        type: "error",
        user: null,
        channels: [],
        quizQuestions: [],
        voteQuestions: [],
        applauseQuestions: [],
      });
    }

    // 2️⃣ Find User
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).render("magic-coin-commission/update", {
        message: "User not found",
        type: "error",
        user: null,
        channels: [],
        quizQuestions: [],
        voteQuestions: [],
        applauseQuestions: [],
      });
    }

    // 3️⃣ Ensure user is a TV Station
    if (!user.isTvStation) {
      return res.status(403).render("magic-coin-commission/update", {
        message: "Access denied — User is not a TV Station",
        type: "error",
        user,
        channels: [],
        quizQuestions: [],
        voteQuestions: [],
        applauseQuestions: [],
      });
    }

    // 4️⃣ Get all channels for this user
    const channels = await Channel.find({ createdBy: user._id }).select(
      "_id channelName"
    );
    const channelIds = channels.map((ch) => ch._id);

    // 5️⃣ Fetch all questions linked to these channels
    const [quizQuestions, voteQuestions, applauseQuestions] = await Promise.all(
      [
        QuizQuestion.find({ channelId: { $in: channelIds } })
          .select("question channelId commissionPercent")
          .populate("channelId", "channelName"),
        VoteQuestion.find({ channelId: { $in: channelIds } })
          .select("question channelId commissionPercent")
          .populate("channelId", "channelName"),
        Applause.find({ channelId: { $in: channelIds } })
          .select("question channelId commissionPercent")
          .populate("channelId", "channelName"),
      ]
    );

    // 6️⃣ Render the update page
    res.render("magic-coin-commission/update", {
      user,
      channels,
      quizQuestions,
      voteQuestions,
      applauseQuestions,
      message: null,
      type: "success",
    });
  } catch (error) {
    console.error("Error loading magic coin commission update page:", error);
    res.status(500).render("magic-coin-commission/update", {
      message: "Server error while loading page",
      type: "error",
      user: null,
      channels: [],
      quizQuestions: [],
      voteQuestions: [],
      applauseQuestions: [],
    });
  }
});

router.post("/update-magic-coin-commission", async (req, res) => {
  try {
    const { userId, commissions } = req.body;

    // Validate User
    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ message: "Invalid User ID" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.isTvStation)
      return res
        .status(403)
        .json({ message: "Access denied — User is not a TV Station" });

    // Validate commissions
    if (!commissions || typeof commissions !== "object")
      return res.status(400).json({ message: "Invalid commissions data" });

    const validatePercent = (v) => typeof v === "number" && v >= 0 && v <= 100;

    for (const [key, value] of Object.entries(commissions)) {
      if (value !== undefined && !validatePercent(value)) {
        return res.status(400).json({
          message: `Invalid commission value for ${key}. Must be 0–100.`,
        });
      }
    }

    // Get all channels once
    const channelIds = await Channel.distinct("_id", { createdBy: user._id });
    if (!channelIds.length)
      return res
        .status(404)
        .json({ message: "No channels found for this user" });

    // Dynamic model mapping
    const modelMap = {
      quiz: QuizQuestion,
      vote: VoteQuestion,
      applause: Applause,
    };

    // Build update promises dynamically
    const updates = Object.entries(commissions)
      .filter(([key, val]) => modelMap[key] && val !== undefined)
      .map(([key, val]) =>
        modelMap[key].updateMany(
          { channelId: { $in: channelIds } },
          { $set: { commissionPercent: val } }
        )
      );

    // Execute all at once
    if (updates.length > 0) await Promise.all(updates);

    res.json({
      success: true,
      message: "Magic coin commissions updated successfully",
      updated: commissions,
    });
  } catch (err) {
    console.error("Commission update error:", err);
    res.status(500).json({
      success: false,
      message: "Server error while updating commissions",
    });
  }
});



module.exports = router;
