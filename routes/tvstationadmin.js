const express = require("express");
const router = express.Router();
require("dotenv").config();
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const {
  encryptPassword,
  decryptPassword,
  generateCode,
} = require("../public/js/cryptoUtils");
const WinnerRequest = require("../models/WinnerRequest"); // your Mongoose model

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
              "user.fullName": 1,
              "user.email": 1,
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
    const request = await WinnerRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });

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

// Approve user to declare winner
router.post("/approve-to-draw-winner/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Find the user
    const user = await User.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    // Ensure tvStationRules object exists
    if (!user.tvStationRules) {
      user.tvStationRules = {};
    }

    // Set the flag
    user.tvStationRules.isApprovedByAdminToDrawWinner = true;

    await user.save();

    return res.json({
      success: true,
      message: "User approved to declare winner successfully",
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to approve user" });
  }
});

module.exports = router;
