const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
require("dotenv").config();
const {
  upload,
  cleanupUploadedFiles,
  deleteFileIfExists,
} = require("../middleware/multerQuizUploader");
const QuizQuestion = require("../models/QuizQuestion");
const VoteQuestion = require("../models/VoteQuestion");
const Applause = require("../models/Applause");
const MagicScreen = require("../models/MagicScreen");
const Channel = require("../models/Channel");
const WinnerRequest = require("../models/WinnerRequest"); // adjust path
const UserRequest = require("../models/UserRequest");
const User = require("../models/User");
const QuizQuestionResponse = require("../models/QuizQuestionResponse");
const VoteQuestionResponse = require("../models/VoteQuestionResponse");
const ApplauseResponse = require("../models/ApplauseResponse");
const MagicScreenResponse = require("../models/MagicScreenResponse");
const MagicCoinCommission = require("../models/MagicCoinCommission");
const QRCodeData = require("../models/QRCODEDATA"); // adjust path as needed
const QRScanLog = require("../models/QRScanLog"); // Adjust path if needed
const Session = require("../models/Session"); // adjust path if needed
const BASE_URL = process.env.FRONTEND_URL; // update if needed
const { addUploadPath } = require("../utils/selectUploadDestination");
const { cascadeDelete } = require("../utils/cascadeDelete"); // adjust path
const SendEmail = require("../Messages/SendEmail");

// GET /channels - paginated list
router.get("/channels", async (req, res) => {
  try {
    // Filter channels created by the logged-in user
    const filter = { createdBy: req.user._id };
    const currentPage = parseInt(req.query.page) || 1;
    const recordsPerPage = Number(process.env.USER_PER_PAGE) || 10;
    const skip = (currentPage - 1) * recordsPerPage;

    const totalChannels = await Channel.countDocuments(filter);
    const totalPages = Math.ceil(totalChannels / recordsPerPage);

    const channels = await Channel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(recordsPerPage)
      .lean();

    res.render("dashboardnew", {
      activeSection: "channel",
      channels,
      currentPage,
      totalPages,
      totalChannels,
      user: req.user,
    });
  } catch (error) {
    console.error("Error fetching channels:", error);
    res.status(500).render("dashboardnew", {
      message: "Server error",
      type: "error",
      activeSection: "usercontrol",
      channels: [],
      currentPage: 1,
      totalPages: 0,
      totalChannels: 0,
      user: null,
    });
  }
});

router.post(
  "/create-channel",
  addUploadPath("uploads"),
  upload.fields([{ name: "logo", maxCount: 1 }]),
  async (req, res) => {
    try {
      const user = req.user;
      const { name, description, link, logoTitle } = req.body;

      if (!name || typeof name !== "string" || !name.trim()) {
        cleanupUploadedFiles(req.files, "uploads");
        return res.status(400).json({
          message: "Show name is required",
          type: "error",
        });
      }

      const channelName = name.trim();

      // Check for duplicates
      const duplicate = await Channel.findOne({
        channelName: new RegExp(`^${channelName}$`, "i"),
        createdBy: user._id,
      });

      if (duplicate) {
        cleanupUploadedFiles(req.files, "uploads");
        return res.status(400).json({
          message: "Channel with this name already exists",
          type: "error",
        });
      }

      // Handle logo file
      const logoFile = req.files["logo"]?.[0];
      const logoPath = logoFile ? `/uploads/${logoFile.filename}` : null;

      // Create channel document
      const newChannel = new Channel({
        channelName,
        createdBy: user._id,
        logo: logoPath || null,
        description: description?.trim() || "",
        link: link?.trim() || "",
        logoTitle: logoTitle?.trim() || "",
      });

      await newChannel.save();

      return res.status(201).json({
        message: "Show created successfully",
        type: "success",
        channel: newChannel,
      });
    } catch (err) {
      console.error("Error creating channel:", err.message);
      cleanupUploadedFiles(req.files, "uploads");
      return res.status(500).json({
        message: "Internal server error while creating show",
        type: "error",
      });
    }
  }
);

router.delete("/channels/:id", async (req, res) => {
  try {
    const channelId = req.params.id;
    const user = req.user;

    if (!channelId) {
      return res.status(400).json({
        message: "Channel ID is required",
        type: "error",
      });
    }

    // Optional: Check if the channel exists and if the user is allowed to delete
    const channel = await Channel.findById(channelId);

    if (!channel) {
      return res.status(404).json({
        message: "Channel not found",
        type: "error",
      });
    }

    // Optional: Only allow the creator or an admin to delete
    if (!channel.createdBy.equals(user._id)) {
      return res.status(403).json({
        message: "You are not authorized to delete this channel",
        type: "error",
      });
    }

    // await Channel.findByIdAndDelete(channelId);
    // ✅ Cascading delete
    await cascadeDelete("channel", channelId);

    return res.status(200).json({
      message: "Channel deleted successfully",
      type: "success",
    });
  } catch (err) {
    console.error("Error deleting channel:", err.message);
    return res.status(500).json({
      message: "Internal server error while deleting channel",
      type: "error",
    });
  }
});

// PATCH: Toggle isRunning and typeOfRunning
router.patch("/channels/:channelId/toggle", async (req, res) => {
  try {
    const { channelId } = req.params;
    const { isRunning, typeOfRunning } = req.body;

    if (
      typeof isRunning !== "boolean" ||
      !["voting", "quiz"].includes(typeOfRunning)
    ) {
      return res.status(400).json({ type: "error", message: "Invalid input" });
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res
        .status(404)
        .json({ type: "error", message: "Channel not found" });
    }

    // Ensure the current user owns the channel
    if (String(channel.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ type: "error", message: "Not authorized" });
    }

    // Stop the channel if it's already running with same type
    if (channel.isRunning && channel.typeOfRunning === typeOfRunning) {
      channel.isRunning = false;
      channel.typeOfRunning = undefined;
      await channel.save();

      return res.json({
        type: "success",
        message: `App stopped successfully.`,
        channel,
      });
    }

    // Stop any other running channels for the same user
    await Channel.updateMany(
      {
        _id: { $ne: channelId },
        createdBy: req.user._id,
        isRunning: true,
      },
      {
        $set: { isRunning: false, typeOfRunning: undefined },
      }
    );

    // Start the current channel
    channel.isRunning = true;
    channel.typeOfRunning = typeOfRunning;
    await channel.save();

    // 🧠 QR Creation/Update Logic (ONLY if quiz)
    if (typeOfRunning === "quiz") {
      const channelCode = channel.code;
      const qrUrl = `${BASE_URL}/tvstation/channels/${channelId}/quiz-play`;

      let qr = await QRCodeData.findOne({ code: channelCode });

      if (qr) {
        // Update URL if not set or wrong
        if (!qr.url || qr.url !== qrUrl) {
          qr.url = qrUrl;
          await qr.save();
        }
      } else {
        // Create new QR code
        await QRCodeData.create({
          qrName: channelCode,
          type: "url",
          url: qrUrl,
          text: "",
          code: channelCode,
          qrDotColor: "#000000",
          backgroundColor: "#FFFFFF",
          dotStyle: "rounded",
          cornerStyle: "dot",
          applyGradient: "none",
          ColorList: "first",
          isDemo: false,
          isQrActivated: true,
          isFirstQr: false,
          usedId: null,
        });
      }
    }

    res.json({
      type: "success",
      message: `App started successfully.`,
      channel,
    });
  } catch (err) {
    console.error("Toggle Channel Error:", err);
    res.status(500).json({ type: "error", message: "Server error" });
  }
});

router.put(
  "/channels/:id",
  addUploadPath("uploads"),
  upload.fields([{ name: "logo", maxCount: 1 }]),
  async (req, res) => {
    try {
      const channelId = req.params.id;
      const user = req.user;
      const { name, description, link, logoTitle, removeLogo } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        cleanupUploadedFiles(req.files, "uploads");
        return res.status(400).json({
          message: "Channel name is required",
          type: "error",
        });
      }

      const updatedName = name.trim();

      // Fetch channel
      const channel = await Channel.findById(channelId);
      if (!channel) {
        cleanupUploadedFiles(req.files, "uploads");
        return res.status(404).json({
          message: "Channel not found",
          type: "error",
        });
      }

      // Authorization
      if (!channel.createdBy.equals(user._id)) {
        cleanupUploadedFiles(req.files, "uploads");
        return res.status(403).json({
          message: "You are not authorized to edit this channel",
          type: "error",
        });
      }

      // Duplicate name check
      const duplicate = await Channel.findOne({
        _id: { $ne: channelId },
        channelName: new RegExp(`^${updatedName}$`, "i"),
      });

      if (duplicate) {
        cleanupUploadedFiles(req.files, "uploads");
        return res.status(400).json({
          message: "Another channel with this name already exists",
          type: "error",
        });
      }

      // Logo logic
      const newLogoFile = req.files["logo"]?.[0];
      const shouldRemoveLogo = removeLogo === "true";
      let logoPath = channel.logo;

      if (newLogoFile) {
        // Replace existing logo
        if (channel.logo) deleteFileIfExists(channel.logo);
        logoPath = `/uploads/${newLogoFile.filename}`;
      } else if (shouldRemoveLogo && channel.logo) {
        deleteFileIfExists(channel.logo);
        logoPath = null;
      }

      // Update channel
      channel.channelName = updatedName;
      channel.logo = logoPath;
      channel.description = description?.trim() || "";
      channel.link = link?.trim() || "";
      channel.logoTitle = logoTitle?.trim() || "";

      await channel.save();

      return res.status(200).json({
        message: "Channel updated successfully",
        type: "success",
        channel,
      });
    } catch (err) {
      console.error("Error updating channel:", err);
      cleanupUploadedFiles(req.files, "uploads");
      return res.status(500).json({
        message: "Internal server error while updating channel",
        type: "error",
      });
    }
  }
);

router.get("/channels/:id/session/:sessionId?", async (req, res) => {
  const channelId = req.params.id;
  const sessionId = req.params.sessionId;

  // Validate channelId
  if (!mongoose.Types.ObjectId.isValid(channelId)) {
    return res.render("dashboardnew", {
      channel: null,
      error: "Invalid Channel ID",
      activeSection: "channel-details",
      user: req.user,
    });
  }

  try {
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.render("dashboardnew", {
        channel: null,
        error: "Channel not found",
        activeSection: "channel-details",
        user: req.user,
      });
    }

    // Check ownership
    if (!channel.createdBy.equals(req.user._id)) {
      return res.render("dashboardnew", {
        channel: null,
        error: "Access denied",
        activeSection: "channel-details",
        user: req.user,
      });
    }

    let session = null;

    if (sessionId) {
      // Validate sessionId
      if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        return res.render("dashboardnew", {
          channel,
          sessionId: null,
          error: "Invalid Session ID",
          activeSection: "channel-details",
          user: req.user,
        });
      }

      session = await Session.findOne({
        _id: sessionId,
        channelId: channelId,
      });

      if (!session) {
        return res.render("dashboardnew", {
          channel,
          sessionId: null,
          error: "Session not found or does not belong to this channel",
          activeSection: "channel-details",
          user: req.user,
        });
      }
    }

    // Success: render with both channel and (optional) session
    res.render("dashboardnew", {
      channel,
      sessionId,
      error: null,
      activeSection: "channel-details",
      user: req.user,
    });
  } catch (err) {
    console.error("Error fetching channel or session details:", err);
    res.render("login", {
      channel: null,
      session: null,
      error: "Server error, please try again later.",
      activeSection: "channel-details",
      user: req.user,
    });
  }
});

router.get("/channels/:channelId/session/:sessionId/quiz", async (req, res) => {
  const { channelId, sessionId } = req.params;

  // Validate ObjectIds
  if (
    !mongoose.Types.ObjectId.isValid(channelId) ||
    !mongoose.Types.ObjectId.isValid(sessionId)
  ) {
    return res.render("dashboardnew", {
      channel: null,
      error: "Invalid Channel or Session ID",
      activeSection: "channel-quiz",
      user: req.user,
      sessionId: null,
      channelId: null,
      session: null,
    });
  }

  try {
    const channel = await Channel.findById(channelId);
    const session = await Session.findById(sessionId);

    if (!channel || !session) {
      return res.render("dashboardnew", {
        channel: null,
        error: "Channel or session not found",
        activeSection: "channel-quiz",
        user: req.user,
        sessionId: null,
        session: null,
        channelId: null,
      });
    }

    // Check ownership
    if (!channel.createdBy.equals(req.user._id)) {
      return res.render("dashboardnew", {
        channel: channel,
        error: "Access denied",
        activeSection: "channel-quiz",
        user: req.user,
        sessionId: null,
        channelId: null,
        session: null,
      });
    }

    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 5;

    const quizQuestions = await QuizQuestion.find({
      channelId,
      sessionId,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await QuizQuestion.countDocuments({ channelId, sessionId });
    const hasMore = skip + quizQuestions.length < total;

    if (req.xhr || req.headers.accept.includes("json")) {
      return res.json({ type: "success", data: quizQuestions, hasMore });
    }

    return res.render("dashboardnew", {
      channel,
      error: null,
      activeSection: "channel-quiz",
      user: req.user,
      quizQuestions,
      hasMore,
      sessionId,
      channelId,
      session,
    });
  } catch (err) {
    console.error("Error fetching quiz for session:", err);
    return res.render("dashboardnew", {
      channel: null,
      error: "Server error. Please try again later.",
      activeSection: "channel-quiz",
      user: req.user,
      quizQuestions: null,
      hasMore: false,
    });
  }
});

router.delete("/quiz-question/:id", async (req, res) => {
  try {
    const questionId = req.params.id;
    const { channelId } = req.body;
    const userId = req.user?._id; // Assumes auth middleware adds user

    if (!channelId || !userId) {
      return res.status(400).json({
        message: "channelId and userId are required",
        type: "error",
      });
    }

    // 🔐 1. Verify the channel belongs to the user
    const channel = await Channel.findOne({
      _id: channelId,
      createdBy: userId,
    });
    if (!channel) {
      return res.status(403).json({
        message: "Unauthorized channel access",
        type: "error",
      });
    }

    // 📦 2. Find the quiz question within the channel
    const quiz = await QuizQuestion.findOne({ _id: questionId, channelId });
    if (!quiz) {
      return res.status(404).json({
        message: "Quiz not found",
        type: "error",
      });
    }

    // 🧹 Use cascadeDelete to remove quiz question + all related data
    await cascadeDelete("quizQuestion", questionId);

    return res.status(200).json({
      message: "Quiz question deleted successfully",
      type: "success",
    });
  } catch (err) {
    console.error("Delete Error:", err);
    return res.status(500).json({
      message: "Server error",
      type: "error",
    });
  }
});

router.get(
  "/channels/:channelId/session/:sessionId/addquestion",
  async (req, res) => {
    const { channelId, sessionId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(channelId) ||
      !mongoose.Types.ObjectId.isValid(sessionId)
    ) {
      return res.render("add-questions", {
        channel: null,
        session: null,
        error: "Invalid Channel or Session ID",
        user: req.user,
      });
    }

    try {
      const channel = await Channel.findById(channelId);
      const session = await Session.findById(sessionId);

      if (!channel || !session) {
        return res.render("add-questions", {
          channel: null,
          session: null,
          error: "Channel or Session not found",
          user: req.user,
        });
      }

      // Check if user owns the channel
      if (!channel.createdBy.equals(req.user._id)) {
        return res.render("add-questions", {
          channel: null,
          session: null,
          error: "Access denied",
          user: req.user,
        });
      }

      // Optional: check if session belongs to the channel
      if (!session.channelId.equals(channel._id)) {
        return res.render("add-questions", {
          channel: null,
          session: null,
          error: "Session does not belong to this channel",
          user: req.user,
        });
      }

      // ✅ Check if a question already exists for the session
      const existingQuestion = await QuizQuestion.findOne({ sessionId });

      if (existingQuestion) {
        return res.render("add-questions", {
          channel,
          session,
          error: "Only one question is allowed per session.",
          user: req.user,
          sessionId,
        });
      }

      return res.render("add-questions", {
        channel,
        session,
        error: null,
        user: req.user,
        sessionId,
      });
    } catch (err) {
      console.error(
        "Error in GET /channels/:channelId/session/:sessionId/addquestion:",
        err
      );
      return res.render("add-questions", {
        channel: null,
        session: null,
        error: "Server error, please try again later.",
        user: req.user,
      });
    }
  }
);

router.get(
  "/channels/:channelId/session/:sessionId/editquestion/:questionId",
  async (req, res) => {
    const { channelId, questionId, sessionId } = req.params;

    // Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(channelId) ||
      !mongoose.Types.ObjectId.isValid(questionId) ||
      !mongoose.Types.ObjectId.isValid(sessionId)
    ) {
      return res.render("edit-question", {
        error: "Invalid Channel ID or Question ID or Session ID",
        channel: null,
        question: null,
        user: req.user,
      });
    }

    try {
      const channel = await Channel.findById(channelId);

      if (!channel) {
        return res.render("edit-question", {
          error: "Channel not found",
          channel: null,
          question: null,
          user: req.user,
        });
      }

      if (!channel.createdBy.equals(req.user._id)) {
        return res.render("edit-question", {
          error: "Access denied",
          channel: null,
          question: null,
          user: req.user,
        });
      }

      const question = await QuizQuestion.findOne({
        _id: questionId,
        channelId,
      }).lean();

      if (!question) {
        return res.render("edit-question", {
          error: "Quiz question not found",
          channel,
          question: null,
          user: req.user,
        });
      }

      return res.render("edit-question", {
        error: null,
        channel,
        question,
        user: req.user,
        sessionId,
      });
    } catch (err) {
      console.error("Error fetching question for edit:", err);
      return res.render("edit-question", {
        error: "Server error. Try again later.",
        channel: null,
        question: null,
        user: req.user,
      });
    }
  }
);

router.post(
  "/quiz-question/create",
  upload.fields([
    { name: "questionImage", maxCount: 1 },
    { name: "questionLogo", maxCount: 1 },
    { name: "logo", maxCount: 1 },
    { name: "optionsImages" },
    { name: "jackpotRewardImage", maxCount: 1 }, // ✅ new
    { name: "digitalRewardImage", maxCount: 1 }, // ✅ new
  ]),
  async (req, res) => {
    try {
      const {
        channelId,
        sessionId,
        question,
        options,
        correctAnswerIndex,
        questionImageLink,
        mode = "jackpot",
        jackpotCoinDeducted = 0,
        digitalCoinDeducted = 0,
        logoTitle,
        logoDescription,
        logoLink,

        // 🎯 New Jackpot Reward fields
        jackpotRewardName,
        jackpotRewardDescription,
        jackpotRewardLink,

        // 🎯 New Digital Reward fields
        digitalRewardName,
        digitalRewardDescription,
        digitalRewardLink,
      } = req.body;

      // ✅ Validate ObjectId format
      if (
        !mongoose.Types.ObjectId.isValid(channelId) ||
        !mongoose.Types.ObjectId.isValid(sessionId)
      ) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({
          message: "Invalid channelId or sessionId.",
          type: "error",
        });
      }

      // ✅ Validate required fields
      if (
        !channelId ||
        !sessionId ||
        !question ||
        !options ||
        correctAnswerIndex === undefined
      ) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({
          message: "Missing required fields.",
          type: "error",
        });
      }

      const channel = await Channel.findById(channelId);
      const session = await Session.findById(sessionId);

      if (!channel || !session) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({
          message: "Channel or Session not found",
          type: "error",
        });
      }

      if (!channel.createdBy.equals(req.user._id)) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({
          message: "Access denied",
          type: "error",
        });
      }

      // ✅ Validate coins (must be numbers, not negative)
      let jCoin = Math.max(0, parseInt(jackpotCoinDeducted) || 0);
      let dCoin = Math.max(0, parseInt(digitalCoinDeducted) || 0);

      // Enforce mode-specific logic
      if (mode === "jackpot") {
        dCoin = 0; // 👈 ignore digital
        if (jCoin < 0) {
          cleanupUploadedFiles(req.files);
          return res.status(400).json({
            message: "Jackpot coin cannot be negative",
            type: "error",
          });
        }
      } else if (mode === "digital") {
        jCoin = 0; // 👈 ignore jackpot
        if (dCoin < 0) {
          cleanupUploadedFiles(req.files);
          return res.status(400).json({
            message: "Digital coin cannot be negative",
            type: "error",
          });
        }
      } else if (mode === "both") {
        if (jCoin < 0 || dCoin < 0) {
          cleanupUploadedFiles(req.files);
          return res.status(400).json({
            message: "Both jackpot and digital cannot be negative",
            type: "error",
          });
        }
      }

      const magicCoinDeducted =
        mode === "jackpot" ? jCoin : mode === "digital" ? dCoin : jCoin + dCoin;

      // ✅ Validate & parse options
      let parsedOptions;
      try {
        parsedOptions = JSON.parse(options);
      } catch (err) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({
          message: "Invalid options format.",
          type: "error",
        });
      }

      if (!Array.isArray(parsedOptions) || parsedOptions.length < 2) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({
          message: "At least 2 options are required.",
          type: "error",
        });
      }

      const formattedOptions = parsedOptions.map((opt) => {
        const imageFile = req.files["optionsImages"]?.find(
          (file) => file.originalname === opt.imageName
        );

        return {
          text: opt.text?.trim(),
          description: opt.description?.trim() || "", // ✅ NEW
          image: imageFile ? `/questions-image/${imageFile.filename}` : null,
        };
      });

      // ✅ Extract file paths
      const questionImagePath = req.files["questionImage"]?.[0]?.filename;
      const questionLogoPath = req.files["questionLogo"]?.[0]?.filename;
      const logoPath = req.files["logo"]?.[0]?.filename;
      const jackpotRewardImagePath =
        req.files["jackpotRewardImage"]?.[0]?.filename; // ✅ new
      const digitalRewardImagePath =
        req.files["digitalRewardImage"]?.[0]?.filename; // ✅ new

      // ✅ Create and save quiz
      const quizData = new QuizQuestion({
        channelId,
        sessionId,
        question: question.trim(),
        options: formattedOptions,
        correctAnswerIndex: parseInt(correctAnswerIndex),
        questionImage: questionImagePath
          ? `/questions-image/${questionImagePath}`
          : null,
        questionImageLink: questionImageLink?.trim() || null,
        questionLogo: questionLogoPath
          ? `/questions-image/${questionLogoPath}`
          : null,
        logo: logoPath ? `/questions-image/${logoPath}` : null,
        logoTitle: logoTitle?.trim() || null,
        logoDescription: logoDescription?.trim() || null,
        logoLink: logoLink?.trim() || null,
        jackpotCoinDeducted: jCoin,
        digitalCoinDeducted: dCoin,
        mode,
        magicCoinDeducted,

        // 🎯 New Jackpot Reward fields
        jackpotRewardName: jackpotRewardName?.trim() || "",
        jackpotRewardImage: jackpotRewardImagePath
          ? `/questions-image/${jackpotRewardImagePath}`
          : null,
        jackpotRewardDescription: jackpotRewardDescription?.trim() || "",
        jackpotRewardLink: jackpotRewardLink?.trim() || null,

        // 🎯 New Digital Reward fields
        digitalRewardName: digitalRewardName?.trim() || "",
        digitalRewardImage: digitalRewardImagePath
          ? `/questions-image/${digitalRewardImagePath}`
          : null,
        digitalRewardDescription: digitalRewardDescription?.trim() || "",
        digitalRewardLink: digitalRewardLink?.trim() || null,
      });

      await quizData.save();

      return res.status(201).json({
        message: "Quiz question saved successfully.",
        type: "success",
        data: quizData,
      });
    } catch (err) {
      console.error("Error saving quiz question:", err);
      cleanupUploadedFiles(req.files);
      return res.status(500).json({
        message: "Failed to save quiz question.",
        type: "error",
      });
    }
  }
);

router.post(
  "/quiz-question/update",
  upload.fields([
    { name: "questionImage", maxCount: 1 },
    { name: "questionLogo", maxCount: 1 },
    { name: "logo", maxCount: 1 },
    { name: "optionsImages" },
    { name: "jackpotRewardImage", maxCount: 1 },
    { name: "digitalRewardImage", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        questionId,
        channelId,
        sessionId,
        question,
        options,
        correctAnswerIndex,
        questionImageLink,
        mode = "jackpot",
        jackpotCoinDeducted = 0,
        digitalCoinDeducted = 0,
        logoTitle,
        logoDescription,
        logoLink,
        clearedImages,
        // Rewards
        jackpotRewardName,
        jackpotRewardDescription,
        jackpotRewardLink,
        digitalRewardName,
        digitalRewardDescription,
        digitalRewardLink,
      } = req.body;

      // ✅ Validate IDs
      if (
        !mongoose.Types.ObjectId.isValid(channelId) ||
        !mongoose.Types.ObjectId.isValid(sessionId)
      ) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({ message: "Invalid IDs", type: "error" });
      }

      // ✅ Fetch quiz
      const quiz = await QuizQuestion.findById(questionId);
      if (!quiz) {
        cleanupUploadedFiles(req.files);
        return res
          .status(404)
          .json({ message: "Quiz not found", type: "error" });
      }

      // ✅ Channel & session
      const channel = await Channel.findById(channelId);
      const session = await Session.findById(sessionId);
      if (!channel || !session) {
        cleanupUploadedFiles(req.files);
        return res
          .status(400)
          .json({ message: "Channel or Session not found", type: "error" });
      }

      // ✅ Ownership check
      if (!channel.createdBy.equals(req.user._id)) {
        cleanupUploadedFiles(req.files);
        return res
          .status(403)
          .json({ message: "Access denied", type: "error" });
      }

      // ✅ Required fields
      if (!question || !options || correctAnswerIndex === undefined) {
        cleanupUploadedFiles(req.files);
        return res
          .status(400)
          .json({ message: "Missing required fields", type: "error" });
      }

      // ✅ Coins
      let jCoin = Math.max(0, parseInt(jackpotCoinDeducted) || 0);
      let dCoin = Math.max(0, parseInt(digitalCoinDeducted) || 0);
      if (mode === "jackpot") dCoin = 0;
      else if (mode === "digital") jCoin = 0;
      else if (mode === "none") {
        jCoin = 0;
        dCoin = 0;
      }

      const magicCoinDeducted =
        mode === "jackpot"
          ? jCoin
          : mode === "digital"
          ? dCoin
          : mode === "none"
          ? 0
          : jCoin + dCoin;

      // ✅ Parse options
      let parsedOptions;
      try {
        parsedOptions = JSON.parse(options);
      } catch (err) {
        cleanupUploadedFiles(req.files);
        return res
          .status(400)
          .json({ message: "Invalid options format", type: "error" });
      }

      if (!Array.isArray(parsedOptions) || parsedOptions.length < 2) {
        cleanupUploadedFiles(req.files);
        return res
          .status(400)
          .json({ message: "At least 2 options required", type: "error" });
      }

      // ✅ Cleared images list
      let cleared = [];
      if (clearedImages) {
        if (Array.isArray(clearedImages)) {
          cleared = clearedImages.flatMap((c) =>
            c.split(",").map((s) => s.trim())
          );
        } else if (typeof clearedImages === "string") {
          cleared = clearedImages.split(",").map((s) => s.trim());
        }
      }

      // ✅ Handle main images
      const handleImageUpdate = (field, uploadedFile) => {
        if (cleared.includes(field)) {
          deleteFileIfExists(quiz[field]);
          return null;
        } else if (uploadedFile) {
          deleteFileIfExists(quiz[field]);
          return `/questions-image/${uploadedFile.filename}`;
        }
        return quiz[field];
      };

      quiz.logo = handleImageUpdate("logo", req.files["logo"]?.[0]);
      quiz.questionImage = handleImageUpdate(
        "questionImage",
        req.files["questionImage"]?.[0]
      );
      quiz.questionLogo = handleImageUpdate(
        "questionLogo",
        req.files["questionLogo"]?.[0]
      );
      quiz.jackpotRewardImage = handleImageUpdate(
        "jackpotRewardImage",
        req.files["jackpotRewardImage"]?.[0]
      );
      quiz.digitalRewardImage = handleImageUpdate(
        "digitalRewardImage",
        req.files["digitalRewardImage"]?.[0]
      );

      // ✅ Map option files to IDs
      const files = req.files["optionsImages"] || [];
      const optionIdsRaw = req.body.optionIds || [];
      const optionIds = Array.isArray(optionIdsRaw)
        ? optionIdsRaw
        : [optionIdsRaw];
      const fileByOptionId = new Map();

      files.forEach((file, k) => {
        const id = optionIds[k];
        if (id) fileByOptionId.set(id, file);
      });

      if (req.body.clearedOptions) {
        const fullyClearedOptionIds = req.body.clearedOptions.split(",");
        fullyClearedOptionIds.forEach((id) => {
          const existingOpt = quiz.options.find((o) => o._id.toString() === id);
          if (existingOpt) deleteFileIfExists(existingOpt.image);
        });
        quiz.options = quiz.options.filter(
          (o) => !fullyClearedOptionIds.includes(o._id.toString())
        );
      }

      // ✅ Format updated options
      const formattedOptions = parsedOptions.map((opt) => {
        let optId = null;

        if (opt._id && mongoose.Types.ObjectId.isValid(opt._id)) {
          optId = opt._id;
        } else {
          optId = new mongoose.Types.ObjectId();
        }

        let oldImage = null;
        if (opt._id && mongoose.Types.ObjectId.isValid(opt._id)) {
          const found = quiz.options.find(
            (o) => o._id && o._id.toString() === opt._id.toString()
          );
          oldImage = found ? found.image : null;
        }

        let newImage = oldImage;

        if (fileByOptionId.has(opt._id)) {
          deleteFileIfExists(oldImage);
          newImage = `/questions-image/${fileByOptionId.get(opt._id).filename}`;
        } else if (
          cleared.includes(opt._id) ||
          cleared.includes(`optionImage-${opt._id}`)
        ) {
          deleteFileIfExists(oldImage);
          newImage = null;
        } else if (opt.imageName && !oldImage) {
          newImage = `/questions-image/${opt.imageName}`;
        }

        return {
          _id: optId,
          text: opt.text?.trim() || "",
          description: opt.description?.trim() || "", // ✅ save description
          image: newImage,
        };
      });

      // ✅ Update quiz fields
      quiz.channelId = channelId;
      quiz.sessionId = sessionId;
      quiz.question = question.trim();
      quiz.options = formattedOptions;
      quiz.correctAnswerIndex = parseInt(correctAnswerIndex);
      quiz.questionImageLink = questionImageLink?.trim() || null;
      quiz.logoTitle = logoTitle?.trim() || null;
      quiz.logoDescription = logoDescription?.trim() || null;
      quiz.logoLink = logoLink?.trim() || null;
      quiz.jackpotCoinDeducted = jCoin;
      quiz.digitalCoinDeducted = dCoin;
      quiz.mode = mode;
      quiz.magicCoinDeducted = magicCoinDeducted;

      // ✅ Reward fields
      if (mode === "jackpot") {
        quiz.digitalRewardName = "";
        quiz.digitalRewardDescription = "";
        quiz.digitalRewardLink = null;
        deleteFileIfExists(quiz.digitalRewardImage);
        quiz.digitalRewardImage = null;

        quiz.jackpotRewardName = jackpotRewardName?.trim() || "";
        quiz.jackpotRewardDescription = jackpotRewardDescription?.trim() || "";
        quiz.jackpotRewardLink = jackpotRewardLink?.trim() || null;
      } else if (mode === "digital") {
        quiz.jackpotRewardName = "";
        quiz.jackpotRewardDescription = "";
        quiz.jackpotRewardLink = null;
        deleteFileIfExists(quiz.jackpotRewardImage);
        quiz.jackpotRewardImage = null;

        quiz.digitalRewardName = digitalRewardName?.trim() || "";
        quiz.digitalRewardDescription = digitalRewardDescription?.trim() || "";
        quiz.digitalRewardLink = digitalRewardLink?.trim() || null;
      } else if (mode === "both") {
        quiz.jackpotRewardName = jackpotRewardName?.trim() || "";
        quiz.jackpotRewardDescription = jackpotRewardDescription?.trim() || "";
        quiz.jackpotRewardLink = jackpotRewardLink?.trim() || null;
        quiz.digitalRewardName = digitalRewardName?.trim() || "";
        quiz.digitalRewardDescription = digitalRewardDescription?.trim() || "";
        quiz.digitalRewardLink = digitalRewardLink?.trim() || null;
      } else if (mode === "none") {
        quiz.jackpotRewardName = "";
        quiz.jackpotRewardDescription = "";
        quiz.jackpotRewardLink = null;
        deleteFileIfExists(quiz.jackpotRewardImage);
        quiz.jackpotRewardImage = null;

        quiz.digitalRewardName = "";
        quiz.digitalRewardDescription = "";
        quiz.digitalRewardLink = null;
        deleteFileIfExists(quiz.digitalRewardImage);
        quiz.digitalRewardImage = null;
      }

      await quiz.save();

      return res.status(200).json({
        message: "Quiz question updated successfully.",
        type: "success",
        data: quiz,
      });
    } catch (err) {
      console.error("Error updating quiz question:", err);
      cleanupUploadedFiles(req.files);
      return res
        .status(500)
        .json({ message: "Failed to update quiz question", type: "error" });
    }
  }
);

router.delete("/quiz-question/:id", async (req, res) => {
  try {
    const questionId = req.params.id;
    const { channelId } = req.body;
    const userId = req.user?._id; // Assumes you're using auth middleware that sets req.user

    if (!channelId || !userId) {
      return res
        .status(400)
        .json({ message: "channelId and userId are required", type: "error" });
    }

    // 🔐 1. Check if the channel belongs to the user
    const channel = await Channel.findOne({
      _id: channelId,
      createdBy: userId,
    });
    if (!channel) {
      return res
        .status(403)
        .json({ message: "Unauthorized channel access", type: "error" });
    }

    // 📦 2. Find the quiz question within this channel
    const quiz = await QuizQuestion.findOne({ _id: questionId, channelId });
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found", type: "error" });
    }

    // 🧹 3. Delete related files
    if (quiz.questionImage) deleteFileIfExists(quiz.questionImage);
    if (quiz.questionLogo) deleteFileIfExists(quiz.questionLogo);
    for (const option of quiz.options) {
      if (option.image) deleteFileIfExists(option.image);
    }

    // ❌ 4. Delete quiz from DB
    await QuizQuestion.deleteOne({ _id: questionId });

    res
      .status(200)
      .json({ message: "Question deleted successfully", type: "success" });
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ message: "Server error", type: "error" });
  }
});

router.get(
  "/channels/:channelId/session/:sessionId/quiz-play",
  async (req, res) => {
    const { channelId, sessionId } = req.params;

    try {
      // Validate Channel ID
      if (
        !mongoose.Types.ObjectId.isValid(channelId) ||
        !mongoose.Types.ObjectId.isValid(sessionId)
      ) {
        return res.render("user-quiz", {
          channel: null,
          error: "Invalid Channel ID or Session ID",
          user: req.user,
          currentQuestion: null,
          index: 0,
          total: 0,
          availableCoins: 0,
        });
      }

      const channel = await Channel.findById(channelId);
      const session = await Session.findById(sessionId);

      if (!channel) {
        return res.render("user-quiz", {
          channel: null,
          error: "Channel not found",
          user: req.user,
          currentQuestion: null,
          index: 0,
          total: 0,
          availableCoins: 0,
        });
      }

      if (!session) {
        return res.render("user-quiz", {
          channel: null,
          error: "Session not found",
          user: req.user,
          currentQuestion: null,
          index: 0,
          total: 0,
          availableCoins: 0,
        });
      }

      if (!channel.isRunning) {
        return res.render("user-quiz", {
          channel: null,
          error: "Quiz is not currently running or does not exist",
          user: req.user,
          currentQuestion: null,
          index: 0,
          total: 0,
          availableCoins: 0,
        });
      }

      const index =
        req.query.index !== undefined ? parseInt(req.query.index) : 0;

      const quizQuestions = await QuizQuestion.find({ sessionId })
        .sort({ createdAt: 1 })
        .skip(index)
        .limit(1)
        .lean();

      const total = await QuizQuestion.countDocuments({ sessionId });
      const currentQuestion = quizQuestions[0] || null;
      const hasNext = index + 1 < total;

      const availableCoins = req.user?.walletCoins || 0;

      if (req.xhr || req.headers.accept.includes("json")) {
        return res.json({
          type: "success",
          data: currentQuestion,
          currentIndex: index,
          total,
          hasNext,
          availableCoins: req.user.walletCoins,
          sessionId,
        });
      }

      return res.render("user-quiz", {
        channel,
        error: null,
        user: req.user,
        currentQuestion,
        index,
        total,
        availableCoins,
        sessionId,
      });
    } catch (err) {
      console.error("Error loading quiz question:", err);
      return res.render("user-quiz", {
        channel: null,
        error: "Server error. Please try again later.",
        user: req.user,
        currentQuestion: null,
        index: 0,
        total: 0,
        availableCoins: 0,
      });
    }
  }
);

router.post("/quiz-response", async (req, res) => {
  const {
    questionId,
    channelId,
    sessionId,
    selectedOptionIndex,
    deductCoin = false,
    jackpotCoinDeducted = false,
    digitalCoinDeducted = false,
    appType = "Quiz",
  } = req.body;

  const userId = req.user?._id;

  if (!questionId || !channelId || selectedOptionIndex === undefined) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const question = await QuizQuestion.findById(questionId).session(session);
    if (!question) throw new Error("Question not found");

    const isCorrect =
      question.correctAnswerIndex === Number(selectedOptionIndex);

    const jackpotSnapshot =
      deductCoin && jackpotCoinDeducted ? question.jackpotCoinDeducted || 0 : 0;
    const digitalSnapshot =
      deductCoin && digitalCoinDeducted ? question.digitalCoinDeducted || 0 : 0;

    const totalSnapshot = jackpotSnapshot + digitalSnapshot;
    const actualDeductCoin = totalSnapshot > 0 ? deductCoin : false;

    // 🪙 Deduct user coins
    const user = req.user;
    if (!user) throw new Error("User not found");

    if (actualDeductCoin) {
      if ((user.walletCoins || 0) < totalSnapshot) {
        await session.abortTransaction();
        session.endSession();
        return res.status(200).json({
          success: false,
          notEnoughCoins: true,
          availableCoins: user.walletCoins || 0,
          requiredCoins: totalSnapshot,
          correctOptionIndex: question.correctAnswerIndex,
        });
      }
    }

    // 🧾 Record quiz response
    await QuizQuestionResponse.create(
      [
        {
          userId,
          questionId,
          channelId,
          selectedOptionIndex,
          isCorrect,
          deductCoin: actualDeductCoin,
          jackpotCoinDeducted: jackpotSnapshot,
          digitalCoinDeducted: digitalSnapshot,
          sessionId,
        },
      ],
      { session }
    );

    // 💸 Commission logic
    if (actualDeductCoin && totalSnapshot > 0) {
      const channel = await Channel.findById(question.channelId).session(
        session
      );
      if (channel) {
        const beneficiaryUserId = channel.createdBy;
        const commissionPercent = question.commissionPercent ?? 70;
        const commissionAmount = Math.floor(
          (totalSnapshot * commissionPercent) / 100
        );

        let totalCoinsAfterCommission;

        if (String(beneficiaryUserId) === String(userId)) {
          // ✅ Same user: combine deduction + commission in one update
          user.walletCoins -= totalSnapshot;
          user.walletCoins += commissionAmount; // just add commission after deduction
          await user.save({ session });
          totalCoinsAfterCommission = user.walletCoins || 0;
        } else {
          // ✅ Different users: save both separately
          user.walletCoins -= totalSnapshot;
          await user.save({ session });
          const updatedBeneficiary = await User.findByIdAndUpdate(
            beneficiaryUserId,
            { $inc: { walletCoins: commissionAmount } },
            { new: true, session }
          );
          totalCoinsAfterCommission = updatedBeneficiary?.walletCoins || 0;
        }

        await MagicCoinCommission.create(
          [
            {
              channelId: channel._id,
              sessionId,
              questionId,
              userId,
              coinsUsed: totalSnapshot,
              commissionPercent,
              commissionAmount,
              beneficiaryUserId,
              appType,
              status: "completed",
              totalCoins: totalCoinsAfterCommission,
            },
          ],
          { session }
        );
      }
    }

    // ✅ Commit all DB operations
    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      isCorrect,
      correctOptionIndex: question.correctAnswerIndex,
      jackpotCoinDeducted: jackpotSnapshot > 0,
      digitalCoinDeducted: digitalSnapshot > 0,
      availableCoins: user.walletCoins || 0,
      jackpotReward: {
        name: question.jackpotRewardName,
        image: question.jackpotRewardImage,
        description: question.jackpotRewardDescription,
        link: question.jackpotRewardLink,
      },
      digitalReward: {
        name: question.digitalRewardName,
        image: question.digitalRewardImage,
        description: question.digitalRewardDescription,
        link: question.digitalRewardLink,
      },
    });
  } catch (err) {
    console.error("Transaction failed:", err);
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// Draw Winner Route
router.get(
  "/channels/:channelId/session/:sessionId/quiz/drawwinner",
  async (req, res) => {
    const { channelId, sessionId } = req.params;

    // Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(channelId) ||
      !mongoose.Types.ObjectId.isValid(sessionId)
    ) {
      return res.render("draw-winner", {
        channel: null,
        error: "Invalid Channel or Session ID",
        user: req.user,
      });
    }

    try {
      const channel = await Channel.findById(channelId);
      const session = await Session.findById(sessionId);

      if (!channel || !session) {
        return res.render("draw-winner", {
          channel: null,
          error: "Channel or session not found",
          user: req.user,
        });
      }

      // Check ownership
      if (!channel.createdBy.equals(req.user._id)) {
        return res.render("draw-winner", {
          channel: channel,
          error: "Access denied",
          user: req.user,
          sessionId,
        });
      }
      const now = new Date();

      // Jackpot Participants
      // Jackpot Participants
      const jackpotParticipants = await QuizQuestionResponse.aggregate([
        {
          $match: {
            channelId: channel._id,
            sessionId: session._id,
            $or: [
              { isNoResponseGiven: false },
              { isNoResponseGiven: { $exists: false } },
            ],
          },
        },

        // Join with QuizQuestion to get mode
        {
          $lookup: {
            from: "quizquestions",
            localField: "questionId",
            foreignField: "_id",
            as: "question",
          },
        },
        { $unwind: "$question" },

        // Exclude already declared & restrict to jackpot/both modes
        {
          $match: {
            $and: [
              {
                $or: [
                  { isJackpotWinnerDeclared: false },
                  { isJackpotWinnerDeclared: { $exists: false } },
                ],
              },
              {
                $or: [
                  { "question.mode": "jackpot" },
                  { "question.mode": "both" },
                ],
              },
            ],
          },
        },

        // Join with users
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userInfo",
          },
        },
        { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: false } },

        // Only VIPs or coin-deducted
        {
          $match: {
            $or: [
              {
                $expr: {
                  $and: [
                    { $eq: ["$userInfo.subscription.isVip", true] },
                    { $gte: ["$userInfo.subscription.validTill", now] },
                  ],
                },
              },
              { jackpotCoinDeducted: { $gt: 0 } },
            ],
          },
        },

        // Final projection
        {
          $project: {
            _id: 1,
            user: "$userInfo.fullName",
            userId: "$userInfo._id",
            email: "$userInfo.email",
            coins: "$jackpotCoinDeducted",
            isVip: "$userInfo.subscription.isVip",
            vipValidTill: "$userInfo.subscription.validTill",
          },
        },
      ]);

      // Digital Reward Participants
      // Digital Reward Participants
      const digitalRewardParticipants = await QuizQuestionResponse.aggregate([
        {
          $match: {
            channelId: channel._id,
            sessionId: session._id,
            $or: [
              { isNoResponseGiven: false },
              { isNoResponseGiven: { $exists: false } },
            ],
          },
        },

        // Join with QuizQuestion to get mode
        {
          $lookup: {
            from: "quizquestions",
            localField: "questionId",
            foreignField: "_id",
            as: "question",
          },
        },
        { $unwind: "$question" },

        // Exclude already declared & restrict to digital/both modes
        {
          $match: {
            $and: [
              {
                $or: [
                  { isDigitalWinnerDeclared: false },
                  { isDigitalWinnerDeclared: { $exists: false } },
                ],
              },
              {
                $or: [
                  { "question.mode": "digital" },
                  { "question.mode": "both" },
                ],
              },
            ],
          },
        },

        // Join with users
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userInfo",
          },
        },
        { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: false } },

        // Only VIPs or coin-deducted
        {
          $match: {
            $or: [
              {
                $expr: {
                  $and: [
                    { $eq: ["$userInfo.subscription.isVip", true] },
                    { $gte: ["$userInfo.subscription.validTill", now] },
                  ],
                },
              },
              { digitalCoinDeducted: { $gt: 0 } },
            ],
          },
        },

        // Final projection
        {
          $project: {
            _id: 1,
            user: "$userInfo.fullName",
            userId: "$userInfo._id",
            email: "$userInfo.email",
            coins: "$digitalCoinDeducted",
            isVip: "$userInfo.subscription.isVip",
            vipValidTill: "$userInfo.subscription.validTill",
          },
        },
      ]);

      return res.render("draw-winner", {
        channel,
        error: null,
        user: req.user,
        sessionId,
        jackpotParticipants,
        digitalRewardParticipants,
      });
    } catch (err) {
      console.error("Error loading draw winner page:", err);
      return res.render("draw-winner", {
        channel: null,
        error: "Server error. Please try again later.",
        activeSection: "channel-quiz",
        user: req.user,
      });
    }
  }
);

// POST /channels/:channelId/session/:sessionId/quiz/draw

router.post(
  "/channels/:channelId/session/:sessionId/quiz/draw",
  async (req, res) => {
    const { channelId, sessionId } = req.params;
    const { type, mode, userId, responseId } = req.body; // include responseId

    if (type !== "quiz") {
      return res.status(400).json({ message: "Invalid type", type: "error" });
    }

    if (!["jackpot", "digital"].includes(mode)) {
      return res.status(400).json({
        message: "Invalid draw type",
        type: "error",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(channelId) ||
      !mongoose.Types.ObjectId.isValid(sessionId) ||
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(responseId)
    ) {
      return res.status(400).json({
        message: "Invalid channel or session ID or user ID or response ID",
        type: "error",
      });
    }

    try {
      const channel = await Channel.findById(channelId);
      const session = await Session.findById(sessionId);

      if (!channel || !session) {
        return res.status(404).json({
          message: "Channel or session not found",
          type: "error",
        });
      }

      // Check ownership
      if (!channel.createdBy.equals(req.user._id)) {
        return res.status(403).json({
          message: "Access denied",
          type: "error",
        });
      }

      // ✅ Fetch the QuizQuestion by channel + session and get mode
      const question = await QuizQuestion.findOne(
        { channelId, sessionId },
        { mode: 1, linkedQRCode: 1 } // only fetch mode
      );
      if (!question) {
        return res.status(404).json({
          message: "Quiz question not found for this channel and session",
          type: "error",
        });
      }
      const questionCurrentMode = question.mode;

      // Validate user
      const user = await User.findById(userId);
      if (!user) {
        return res
          .status(404)
          .json({ message: "User not found", type: "error" });
      }

      const coinField =
        mode === "jackpot" ? "jackpotCoinDeducted" : "digitalCoinDeducted";

      // Validate participant
      const now = new Date();

      const participant = await QuizQuestionResponse.aggregate([
        {
          $match: {
            _id: new mongoose.Types.ObjectId(responseId), // 👈 response must match
            channelId: channel._id,
            sessionId: session._id,
            userId: new mongoose.Types.ObjectId(userId),
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userInfo",
          },
        },
        { $unwind: "$userInfo" },
        {
          $match: {
            $or: [
              { [coinField]: { $gt: 0 } }, // user has coins deducted
              {
                $and: [
                  { "userInfo.subscription.isVip": true }, // VIP
                  { "userInfo.subscription.validTill": { $gte: now } }, // still valid
                ],
              },
            ],
          },
        },
        { $limit: 1 },
      ]);

      if (!participant.length) {
        return res.status(404).json({
          message: "This user did not participate or has no eligible coins",
          type: "error",
        });
      }

      // Use the channel owner’s rules (req.user already loaded by auth middleware)
      const isApprovedByUser =
        req.user.isTvStation &&
        req.user.tvStationRules?.isApprovedByAdminToDrawWinner === false
          ? false
          : true;
      const winnerDoc = await WinnerRequest.create({
        sessionId: session._id,
        channelId: channel._id,
        questionId: participant[0].questionId, // add questionId if needed
        type,
        mode: mode === "jackpot" ? "jackpot" : "digital",
        userId: participant[0].userId,
        isApprovedByUser,
        isApprovedByAdmin: false,
        isActive: true,
        createdBy: req.user._id,
      });

      const sender = {
        email: "arnoldschmidt@magic-code.net",
        name: "Magic Code - Plan Update",
      };

      if (isApprovedByUser) {
        // Handle Digital Winner
        if (mode === "digital") {
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

          const subject =
            "🎉 Congratulations! Your Digital Reward is Activated";
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
              <b>Valid Till:</b> ${validTill.toDateString()}</p>
              <p>Enjoy your exclusive benefits 🎁</p>
              <div style="margin-top:20px;font-size:12px;color:#777;">© 2025 Magic Code | All rights reserved.</div>
            </div>
          </body>
          </html>
        `;

          SendEmail(sender, user.email, subject, htmlContent);
          await QuizQuestionResponse.updateMany(
            {
              sessionId: session._id,
              channelId: channel._id,
              $or: [
                { isDigitalWinnerDeclared: false }, // exists and is false
                { isDigitalWinnerDeclared: { $exists: false } }, // field not present
              ],
            },
            { $set: { isDigitalWinnerDeclared: true } }
          );
        }

        // Handle Jackpot Winner
        if (mode === "jackpot") {
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
          await QuizQuestionResponse.updateMany(
            {
              sessionId: session._id,
              channelId: channel._id,
              $or: [
                { isJackpotWinnerDeclared: false }, // exists and is false
                { isJackpotWinnerDeclared: { $exists: false } }, // field not present
              ],
            },
            { $set: { isJackpotWinnerDeclared: true } }
          );
        }
      } else {
        // 🚨 User NOT approved yet → only update DB flags
        if (mode === "digital") {
          await QuizQuestionResponse.updateMany(
            {
              sessionId: session._id,
              channelId: channel._id,
              $or: [
                { isDigitalWinnerDeclared: false },
                { isDigitalWinnerDeclared: { $exists: false } },
              ],
            },
            { $set: { isDigitalWinnerDeclared: true } }
          );
        }

        if (mode === "jackpot") {
          await QuizQuestionResponse.updateMany(
            {
              sessionId: session._id,
              channelId: channel._id,
              $or: [
                { isJackpotWinnerDeclared: false },
                { isJackpotWinnerDeclared: { $exists: false } },
              ],
            },
            { $set: { isJackpotWinnerDeclared: true } }
          );
        }
      }
      // ✅ After declaring winners and before sending response
      if (mode === questionCurrentMode || questionCurrentMode === "both") {
        let shouldDelete = false;

        if (questionCurrentMode === "both") {
          const winnerCheck = await QuizQuestionResponse.findOne({
            sessionId: session._id,
            channelId: channel._id,
            isJackpotWinnerDeclared: true,
            isDigitalWinnerDeclared: true,
          });

          if (winnerCheck) shouldDelete = true;
        } else {
          shouldDelete = true;
        }

        if (shouldDelete) {
          const qrRecord = await QRCodeData.findOne({
            _id: question.linkedQRCode,
          });
          if (qrRecord) {
            await QRScanLog.deleteMany({ qrCodeId: qrRecord._id });
            console.log(`Deleted all scan logs for QR ID ${qrRecord._id}`);
          }
        }
      }

      const message = isApprovedByUser
        ? `${
            type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
          } winner selected successfully.`
        : `${
            type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
          } winner request forwarded to admin.`;

      const coinsUsed =
        mode === "jackpot"
          ? participant[0].jackpotCoinDeducted
          : participant[0].digitalCoinDeducted;
      return res.status(200).json({
        message,
        type: "success",
        data: {
          winner: {
            user: user.fullName,
            email: user.email,
            coins: coinsUsed,
            winnerId: winnerDoc._id,
          },
          type: type,
          sessionId: session._id,
          channelId: channel._id,
        },
      });
    } catch (err) {
      console.error("Error drawing winner:", err);
      return res.status(500).json({
        message: "Failed to draw winner",
        type: "error",
      });
    }
  }
);

router.get(
  "/channel/:channelId/session/:sessionId/quiz-response-tracker",
  async (req, res) => {
    const currentPage = parseInt(req.query.page) || 1;
    const recordsPerPage = parseInt(process.env.USER_PER_PAGE) || 10;
    const skip = (currentPage - 1) * recordsPerPage;
    const { sessionId, channelId } = req.params;

    const channel = await Channel.findById(channelId);
    if (!channel || !channel.createdBy.equals(req.user._id)) {
      return res.render("dashboardnew", {
        quizResponses: [],
        totalResponsesWithoutPagination: 0,
        currentPage: 1,
        totalPages: 0,
        activeSection: "quiz-response-tracker",
        user: req.user,
        error: "Access denied",
        sessionId,
        channelId,
      });
    }

    // ✅ Step 2: Validate session exists for this channel
    const session = await Session.findOne({ _id: sessionId, channelId });
    if (!session) {
      return res.render("dashboardnew", {
        quizResponses: [],
        totalResponsesWithoutPagination: 0,
        currentPage: 1,
        totalPages: 0,
        activeSection: "quiz-response-tracker",
        user: req.user,
        error: "Session not found",
        sessionId,
        channelId,
      });
    }

    // ✅ Step 3: Extract quiz code from channel.code array

    const question = await QuizQuestion.findOne(
      { sessionId },
      "linkedQRCode"
    ).lean();
    const quizQrCodeId = question?.linkedQRCode || null;

    // Step 4: Find QR in qrcodedatas by code (if exists)
    let qrScanCount = 0;
    if (quizQrCodeId) {
      const qrDoc = await QRCodeData.findById(quizQrCodeId);
      if (qrDoc) {
        // Step 5: Count total qrscanlogs for this QR
        qrScanCount = await QRScanLog.countDocuments({ qrCodeId: qrDoc._id });
      }
    }

    try {
      const result = await QuizQuestionResponse.aggregate([
        {
          $lookup: {
            from: "quizquestions",
            localField: "questionId",
            foreignField: "_id",
            as: "question",
          },
        },
        { $unwind: "$question" },
        {
          $match: {
            $expr: {
              $and: [
                // ✅ Restrict to current session
                {
                  $eq: [
                    "$question.sessionId",
                    new mongoose.Types.ObjectId(sessionId),
                  ],
                },

                // ✅ Exclude based on winner + mode
                {
                  $not: {
                    $or: [
                      {
                        $and: [
                          { $eq: ["$question.mode", "jackpot"] },
                          { $eq: ["$isJackpotWinnerDeclared", true] },
                        ],
                      },
                      {
                        $and: [
                          { $eq: ["$question.mode", "digital"] },
                          { $eq: ["$isDigitalWinnerDeclared", true] },
                        ],
                      },
                      {
                        $and: [
                          { $eq: ["$question.mode", "both"] },
                          { $eq: ["$isJackpotWinnerDeclared", true] },
                          { $eq: ["$isDigitalWinnerDeclared", true] },
                        ],
                      },
                      // { $eq: ["$question.mode", "none"] },
                    ],
                  },
                },
              ],
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $project: {
            questionText: "$question.question",
            mode: "$question.mode",
            selectedOptionIndex: 1,
            isCorrect: 1,
            deductCoin: 1,
            jackpotCoinDeducted: 1,
            digitalCoinDeducted: 1,
            isNoResponseGiven: 1,
            coinsDeducted: {
              $cond: [
                { $eq: ["$deductCoin", true] },
                "$question.magicCoinDeducted",
                0,
              ],
            },
            createdAt: 1,
            userName: "$user.fullName",
            userEmail: "$user.email",
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $facet: {
            data: [{ $skip: skip }, { $limit: recordsPerPage }],
            totalCount: [{ $count: "total" }],
            totalCountExcludingNoResponse: [
              { $match: { isNoResponseGiven: { $ne: true } } },
              { $count: "total" },
            ],
          },
        },
      ]);

      const quizResponses = result[0].data;
      const totalResponses = result[0].totalCount[0]?.total || 0;
      const totalPages = Math.ceil(totalResponses / recordsPerPage);
      const totalResponsesExcludingNoResponse =
        result[0].totalCountExcludingNoResponse[0]?.total || 0;

      res.render("dashboardnew", {
        quizResponses,
        totalResponsesWithoutPagination: totalResponses,
        totalResponsesExcludingNoResponse,
        qrScanCount,
        currentPage,
        totalPages,
        error: null,
        activeSection: "quiz-response-tracker", // ✅ Added here
        user: req.user,
        sessionId,
        channelId,
      });
    } catch (error) {
      console.error("Error fetching quiz responses:", error);
      res.status(500).render("dashboardnew", {
        quizResponses: [],
        totalResponsesWithoutPagination: 0,
        error: "Server Error",
        currentPage: 1,
        totalPages: 0,
        activeSection: "quiz-response-tracker", // ✅ Added here
        user: req.user,
        sessionId,
        channelId,
      });
    }
  }
);

// POST /api/channel/:channelId/session/:sessionId/qr
router.post("/channel/:channelId/session/:sessionId/qr", async (req, res) => {
  try {
    const { channelId, sessionId } = req.params;
    const {
      backgroundColor,
      qrDotColor,
      type,
      lang = "en",
      logo = `/images/logo1.jpg`,
    } = req.body;

    if (
      !type ||
      ![
        "quiz",
        "voting",
        "shopping",
        "brand",
        "applause",
        "magicscreen",
      ].includes(type)
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid app type" });
    }

    // Step 1: Find the channel
    const channel = await Channel.findById(channelId);
    if (!channel)
      return res
        .status(404)
        .json({ success: false, message: "Channel not found" });

    // Step 2: Find the session
    const session = await Session.findById(sessionId);
    if (!session)
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });

    // Step 3: Find the first question of the given type to get linked QR
    let questionModel = null;

    switch (type) {
      case "quiz":
        questionModel = QuizQuestion;
        break;
      case "voting":
        questionModel = VoteQuestion;
        break;
      case "shopping":
        questionModel = ProductQuestion;
        break;
      case "brand":
        questionModel = BrandQuestion;
        break;
      case "applause":
        questionModel = Applause;
      case "magicscreen":
        questionModel = MagicScreen;
        break;
    }

    if (!questionModel)
      return res
        .status(400)
        .json({ success: false, message: "Invalid question type" });

    const question = await questionModel
      .findOne({ sessionId })
      .populate("linkedQRCode")
      .lean();

    let qr = question?.linkedQRCode || null;

    if (!qr) {
      const defaultUrl =
        type === "applause"
          ? `${BASE_URL}/tvstation/applause/channels/${channelId}/session/${sessionId}/applause-play/?lang=${encodeURIComponent(
              lang
            )}`
          : type === "magicscreen"
          ? `${BASE_URL}/tvstation/magicscreen/channels/${channelId}/session/${sessionId}/magicscreen-play/?lang=${encodeURIComponent(
              lang
            )}`
          : `${BASE_URL}/tvstation/channels/${channelId}/session/${sessionId}/${type}-play/?lang=${encodeURIComponent(
              lang
            )}`;

      return res.status(200).json({
        success: true,
        message: "No linked QR found for this session",
        url: defaultUrl,
      });
    }

    let qrUrl;
    if (type === "applause") {
      qrUrl = `${BASE_URL}/tvstation/applause/channels/${channelId}/session/${sessionId}/applause-play/?lang=${encodeURIComponent(
        lang
      )}`;
    } else if (type === "magicscreen") {
      qrUrl = `${BASE_URL}/tvstation/magicscreen/channels/${channelId}/session/${sessionId}/magicscreen-play/?lang=${encodeURIComponent(
        lang
      )}`;
    } else {
      qrUrl = `${BASE_URL}/tvstation/channels/${channelId}/session/${sessionId}/${type}-play/?lang=${encodeURIComponent(
        lang
      )}`;
    }

    qr.url = qrUrl;

    if (backgroundColor) qr.backgroundColor = backgroundColor;
    if (qrDotColor) qr.qrDotColor = qrDotColor;
    if (logo) qr.logo = logo;

    // Save updates
    await QRCodeData.findByIdAndUpdate(qr._id, qr, { new: true });

    // No toObject() needed since qr is already plain object
    qr.redirectUrl = `${BASE_URL}/${qr.code || qr.qrName}`;

    res.json({ success: true, qr });
  } catch (error) {
    console.error("QR update error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /api/session/:sessionId/qr/:type
router.get("/session/:sessionId/qr/:type", async (req, res) => {
  try {
    const { sessionId, type } = req.params;

    // ✅ Validate type
    if (
      ![
        "quiz",
        "voting",
        "shopping",
        "brand",
        "applause",
        "magicscreen",
      ].includes(type)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid app type",
      });
    }

    // ✅ Only fetch fields needed for validation
    const session = await Session.findById(
      sessionId,
      "name logo logoTitle description link code channelId"
    );

    const channelId = session.channelId;

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    let qr = null;

    // ✅ Handle type-specific QR lookup
    if (type === "quiz") {
      const question = await QuizQuestion.findOne({ sessionId }, "linkedQRCode")
        .populate("linkedQRCode")
        .lean();

      qr = question?.linkedQRCode || null;
    } else if (type === "voting") {
      const voteQuestion = await VoteQuestion.findOne(
        { sessionId },
        "linkedQRCode"
      )
        .populate("linkedQRCode")
        .lean();

      qr = voteQuestion?.linkedQRCode || null;
    }

    if (type === "applause") {
      const applauseQuestion = await Applause.findOne(
        { sessionId },
        "linkedQRCode"
      )
        .populate("linkedQRCode")
        .lean();

      qr = applauseQuestion?.linkedQRCode || null;
    }

    if (type === "magicscreen") {
      const magicscreenQuestion = await MagicScreen.findOne(
        { sessionId },
        "linkedQRCode"
      )
        .populate("linkedQRCode")
        .lean();

      qr = magicscreenQuestion?.linkedQRCode || null;
    }

    // ⚠️ Later: add for shopping, brand

    const defaultUrl =
      type === "applause"
        ? `${BASE_URL}/tvstation/applause/channels/${channelId}/session/${sessionId}/applause-play/?lang=en`
        : type === "magicscreen"
        ? `${BASE_URL}/tvstation/magicscreen/channels/${channelId}/session/${sessionId}/magicscreen-play/?lang=en`
        : `${BASE_URL}/tvstation/channels/${channelId}/session/${sessionId}/${type}-play/?lang=en`;

    if (!qr) {
      return res.status(200).json({
        success: false,
        message: "No linked Magic Code found for this session",
        isNoQrLinked: true,
        url: defaultUrl,
      });
    }

    // ✅ Response only contains QR and session meta
    res.json({
      success: true,
      data: {
        type,
        code: qr.code,
        qr: {
          ...qr,
          redirectUrl: `${BASE_URL}/${qr.code}`,
        },
      },
    });
  } catch (err) {
    console.error("Error fetching QR details:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Session Api

router.get("/channels/:id/sessions", async (req, res) => {
  const channelId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(channelId)) {
    return res.render("dashboardnew", {
      channel: null,
      error: "Invalid Channel ID",
      activeSection: "channel-sessions",
      user: req.user,
      sessions: [],
    });
  }

  try {
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.render("dashboardnew", {
        channel: null,
        error: "Channel not found",
        activeSection: "channel-sessions",
        user: req.user,
        sessions: [],
      });
    }

    if (!channel.createdBy.equals(req.user._id)) {
      return res.render("dashboardnew", {
        channel: null,
        error: "Access denied",
        activeSection: "channel-sessions",
        user: req.user,
        sessions: [],
      });
    }

    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 5;

    const sessions = await Session.find({ channelId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Session.countDocuments({ channelId });
    const hasMore = skip + sessions.length < total;

    if (req.xhr || req.headers.accept.includes("json")) {
      return res.json({ type: "success", data: sessions, hasMore });
    }
    return res.render("dashboardnew", {
      channel,
      error: null,
      activeSection: "channel-sessions",
      user: req.user,
      sessions,
      hasMore,
    });
  } catch (err) {
    console.error("Error fetching sessions:", err);
    return res.render("dashboardnew", {
      channel: null,
      error: "Server error. Please try again later.",
      activeSection: "channel-sessions",
      user: req.user,
      sessions: [],
      hasMore: false,
    });
  }
});

router.post(
  "/session/:channelId/create",
  addUploadPath("uploads"),
  upload.fields([{ name: "logo", maxCount: 1 }]),
  async (req, res) => {
    try {
      const { name, logoTitle, description, link } = req.body;
      const { channelId } = req.params;

      if (!name || !channelId) {
        cleanupUploadedFiles(req.files, "uploads");
        return res.status(400).json({
          message: "Name and channelId are required.",
          type: "error",
        });
      }

      const logoFile = req.files["logo"]?.[0];
      const logoPath = logoFile ? `/uploads/${logoFile.filename}` : null;

      // Ensure channel exists
      const channel = await Channel.findById(channelId);
      if (!channel) {
        cleanupUploadedFiles(req.files, "uploads");
        return res.status(404).json({
          message: "Channel not found",
          type: "error",
        });
      }

      // Create session
      const newSession = await Session.create({
        name: name.trim(),
        logo: logoPath,
        logoTitle: logoTitle?.trim() || "",
        description: description?.trim() || "",
        link: link?.trim() || null,
        channelId,
      });

      return res.status(201).json({
        message: "Session created successfully.",
        type: "success",
        data: newSession,
      });
    } catch (err) {
      console.error("Error creating session:", err);
      cleanupUploadedFiles(req.files, "uploads");

      return res.status(500).json({
        message: "Failed to create session.",
        type: "error",
      });
    }
  }
);

// DELETE session route
router.delete("/session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    // ✅ Find the session first
    const session = await Session.findById(sessionId);
    if (!session) {
      return res
        .status(404)
        .json({ message: "Session not found", type: "error" });
    }

    // // ✅ Delete logo file if exists
    // if (session.logo) {
    //   deleteFileIfExists(session.logo);
    // }

    // // ✅ Delete the session document
    // await Session.findByIdAndDelete(sessionId);

    // ✅ Use cascadeDelete to remove session + related data
    await cascadeDelete("session", sessionId);

    return res.status(200).json({
      message: "Session deleted successfully",
      type: "success",
    });
  } catch (err) {
    console.error("Error deleting session:", err);
    return res.status(500).json({
      message: "Failed to delete session",
      type: "error",
    });
  }
});

router.post(
  "/session/:sessionId/update",
  addUploadPath("uploads"),
  upload.fields([{ name: "logo", maxCount: 1 }]),
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { name, logoTitle, description, link, removeLogo } = req.body;

      const session = await Session.findById(sessionId);
      if (!session) {
        cleanupUploadedFiles(req.files, "uploads");
        return res
          .status(404)
          .json({ message: "Session not found", type: "error" });
      }

      const newLogoFile = req.files["logo"]?.[0];
      const shouldRemoveLogo = removeLogo === "true"; // comes as string from form

      // ✅ Handle logo logic
      let logoPath = session.logo;

      if (newLogoFile) {
        // Replace with new logo
        if (session.logo) {
          deleteFileIfExists(session.logo);
        }
        logoPath = `/uploads/${newLogoFile.filename}`;
      } else if (shouldRemoveLogo && session.logo) {
        // Remove existing logo only if flagged
        deleteFileIfExists(session.logo);
        logoPath = null;
      }

      // ✅ Update fields
      session.name = name?.trim() || session.name;
      session.logo = logoPath;
      session.logoTitle = logoTitle?.trim() || "";
      session.description = description?.trim() || "";
      session.link = link?.trim() || null;

      await session.save();

      return res.status(200).json({
        message: "Session updated successfully.",
        type: "success",
        data: session,
      });
    } catch (err) {
      console.error("Error updating session:", err);
      cleanupUploadedFiles(req.files, "uploads");
      return res.status(500).json({
        message: "Failed to update session.",
        type: "error",
      });
    }
  }
);

// Session Api End Here

// Voting Api Start Here

router.get(
  "/channels/:channelId/session/:sessionId/voting",
  async (req, res) => {
    const { channelId, sessionId } = req.params;

    // Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(channelId) ||
      !mongoose.Types.ObjectId.isValid(sessionId)
    ) {
      return res.render("dashboardnew", {
        channel: null,
        error: "Invalid Channel or Session ID",
        activeSection: "channel-vote",
        user: req.user,
        channelId: null,
        sessionId: null,
        session: null,
      });
    }

    try {
      const channel = await Channel.findById(channelId);
      const session = await Session.findById(sessionId);

      if (!channel || !session) {
        return res.render("dashboardnew", {
          channel: null,
          error: "Channel or session not found",
          activeSection: "channel-vote",
          user: req.user,
          channelId: null,
          sessionId: null,
          session: null,
        });
      }

      // Check ownership
      if (!channel.createdBy.equals(req.user._id)) {
        return res.render("dashboardnew", {
          channel,
          error: "Access denied",
          activeSection: "channel-vote",
          user: req.user,
          sessionId,
          channelId: null,
          sessionId: null,
          session: null,
        });
      }

      const skip = parseInt(req.query.skip) || 0;
      const limit = parseInt(req.query.limit) || 5;

      let voteQuestions = await VoteQuestion.find({ channelId, sessionId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      // Calculate vote percentages for each question
      for (let q of voteQuestions) {
        const stats = await VoteQuestionResponse.aggregate([
          {
            $match: {
              questionId: q._id,
              $or: [
                { isNoResponseGiven: { $exists: false } },
                { isNoResponseGiven: false },
              ],
            },
          },
          { $group: { _id: "$selectedOptionIndex", votes: { $sum: 1 } } },
        ]);

        const totalVotes = stats.reduce((acc, s) => acc + s.votes, 0) || 1;

        const votesMap = {};
        stats.forEach((s) => {
          votesMap[s._id] = s.votes;
        });

        q.options = q.options.map((opt, idx) => {
          const count = votesMap[idx] || 0;
          const percentage = ((count / totalVotes) * 100).toFixed(1);
          return { ...opt, votes: count, percentage };
        });
      }

      const total = await VoteQuestion.countDocuments({ channelId, sessionId });
      const hasMore = skip + voteQuestions.length < total;

      if (req.xhr || req.headers.accept.includes("json")) {
        return res.json({ type: "success", data: voteQuestions, hasMore });
      }

      return res.render("dashboardnew", {
        channel,
        error: null,
        activeSection: "channel-vote",
        user: req.user,
        voteQuestions,
        hasMore,
        sessionId,
        channelId,
        sessionId,
        session,
      });
    } catch (err) {
      console.error("Error fetching vote for session:", err);
      return res.render("dashboardnew", {
        channel: null,
        error: "Server error. Please try again later.",
        activeSection: "channel-vote",
        user: req.user,
        voteQuestions: null,
        hasMore: false,
      });
    }
  }
);

router.get(
  "/channels/:channelId/session/:sessionId/addvotingquestion",
  async (req, res) => {
    const { channelId, sessionId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(channelId) ||
      !mongoose.Types.ObjectId.isValid(sessionId)
    ) {
      return res.render("add-voting-question", {
        channel: null,
        session: null,
        error: "Invalid Channel or Session ID",
        user: req.user,
        sessionId,
      });
    }

    try {
      const channel = await Channel.findById(channelId);
      const session = await Session.findById(sessionId);

      if (!channel || !session) {
        return res.render("add-voting-question", {
          channel: null,
          session: null,
          error: "Channel or Session not found",
          user: req.user,
          sessionId,
        });
      }

      // Check if user owns the channel
      if (!channel.createdBy.equals(req.user._id)) {
        return res.render("add-voting-question", {
          channel: null,
          session: null,
          error: "Access denied",
          user: req.user,
          sessionId,
        });
      }

      // Optional: check if session belongs to the channel
      if (!session.channelId.equals(channel._id)) {
        return res.render("add-voting-question", {
          channel: null,
          session: null,
          error: "Session does not belong to this channel",
          user: req.user,
          sessionId,
        });
      }

      // Check if a voting question already exists for the session
      const existingQuestion = await VoteQuestion.findOne({ sessionId });

      if (existingQuestion) {
        return res.render("add-voting-question", {
          channel,
          session,
          error: "Only one question is allowed per session.",
          user: req.user,
          sessionId,
        });
      }

      return res.render("add-voting-question", {
        channel,
        session,
        error: null,
        user: req.user,
        sessionId,
      });
    } catch (err) {
      console.error(
        "Error in GET /channels/:channelId/session/:sessionId/add-voting-question:",
        err
      );
      return res.render("add-voting-questions", {
        channel: null,
        session: null,
        error: "Server error, please try again later.",
        user: req.user,
      });
    }
  }
);

router.post(
  "/voting-question/create",
  upload.fields([
    { name: "questionImage", maxCount: 1 },
    { name: "questionLogo", maxCount: 1 },
    { name: "logo", maxCount: 1 },
    { name: "optionsImages" },
    { name: "jackpotRewardImage", maxCount: 1 },
    { name: "digitalRewardImage", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        channelId,
        sessionId,
        question,
        options,
        questionImageLink,
        mode = "none",
        jackpotCoinDeducted = 0,
        digitalCoinDeducted = 0,
        logoTitle,
        logoDescription,
        logoLink,
        jackpotRewardName,
        jackpotRewardDescription,
        jackpotRewardLink,
        digitalRewardName,
        digitalRewardDescription,
        digitalRewardLink,
      } = req.body;

      // ✅ Validate ObjectId
      if (
        !mongoose.Types.ObjectId.isValid(channelId) ||
        !mongoose.Types.ObjectId.isValid(sessionId)
      ) {
        cleanupUploadedFiles(req.files);
        return res
          .status(400)
          .json({ message: "Invalid channelId or sessionId", type: "error" });
      }

      // ✅ Required fields for voting
      if (!channelId || !sessionId || !question || !options) {
        cleanupUploadedFiles(req.files);
        return res
          .status(400)
          .json({ message: "Missing required fields.", type: "error" });
      }

      const channel = await Channel.findById(channelId);
      const session = await Session.findById(sessionId);

      if (!channel || !session) {
        cleanupUploadedFiles(req.files);
        return res
          .status(400)
          .json({ message: "Channel or Session not found", type: "error" });
      }

      if (!channel.createdBy.equals(req.user._id)) {
        cleanupUploadedFiles(req.files);
        return res
          .status(400)
          .json({ message: "Access denied", type: "error" });
      }

      // ✅ Coins validation
      let jCoin = Math.max(0, parseInt(jackpotCoinDeducted) || 0);
      let dCoin = Math.max(0, parseInt(digitalCoinDeducted) || 0);

      if (mode === "jackpot") {
        dCoin = 0;
      } else if (mode === "digital") {
        jCoin = 0;
      }

      const magicCoinDeducted =
        mode === "jackpot" ? jCoin : mode === "digital" ? dCoin : jCoin + dCoin;

      // ✅ Parse options
      let parsedOptions;
      try {
        parsedOptions = JSON.parse(options);
      } catch (err) {
        cleanupUploadedFiles(req.files);
        return res
          .status(400)
          .json({ message: "Invalid options format.", type: "error" });
      }

      if (!Array.isArray(parsedOptions) || parsedOptions.length < 2) {
        cleanupUploadedFiles(req.files);
        return res
          .status(400)
          .json({ message: "At least 2 options are required.", type: "error" });
      }

      const formattedOptions = parsedOptions.map((opt) => {
        const imageFile = req.files["optionsImages"]?.find(
          (file) => file.originalname === opt.imageName
        );
        return {
          text: opt.text?.trim(),
          description: opt.description?.trim() || "",
          image: imageFile ? `/questions-image/${imageFile.filename}` : null,
        };
      });

      // ✅ File extraction
      const questionImagePath = req.files["questionImage"]?.[0]?.filename;
      const questionLogoPath = req.files["questionLogo"]?.[0]?.filename;
      const logoPath = req.files["logo"]?.[0]?.filename;
      const jackpotRewardImagePath =
        req.files["jackpotRewardImage"]?.[0]?.filename;
      const digitalRewardImagePath =
        req.files["digitalRewardImage"]?.[0]?.filename;

      // ✅ Save Voting Question (no correctAnswerIndex)
      const votingData = new VoteQuestion({
        channelId,
        sessionId,
        question: question.trim(),
        options: formattedOptions,
        questionImage: questionImagePath
          ? `/questions-image/${questionImagePath}`
          : null,
        questionImageLink: questionImageLink?.trim() || null,
        questionLogo: questionLogoPath
          ? `/questions-image/${questionLogoPath}`
          : null,
        logo: logoPath ? `/questions-image/${logoPath}` : null,
        logoTitle: logoTitle?.trim() || null,
        logoDescription: logoDescription?.trim() || null,
        logoLink: logoLink?.trim() || null,
        jackpotCoinDeducted: jCoin,
        digitalCoinDeducted: dCoin,
        mode,
        magicCoinDeducted,
        jackpotRewardName: jackpotRewardName?.trim() || "",
        jackpotRewardImage: jackpotRewardImagePath
          ? `/questions-image/${jackpotRewardImagePath}`
          : null,
        jackpotRewardDescription: jackpotRewardDescription?.trim() || "",
        jackpotRewardLink: jackpotRewardLink?.trim() || null,
        digitalRewardName: digitalRewardName?.trim() || "",
        digitalRewardImage: digitalRewardImagePath
          ? `/questions-image/${digitalRewardImagePath}`
          : null,
        digitalRewardDescription: digitalRewardDescription?.trim() || "",
        digitalRewardLink: digitalRewardLink?.trim() || null,
      });

      await votingData.save();

      return res.status(201).json({
        message: "Voting question saved successfully.",
        type: "success",
        data: votingData,
      });
    } catch (err) {
      console.error("Error saving voting question:", err);
      cleanupUploadedFiles(req.files);
      return res.status(500).json({
        message: "Failed to save voting question.",
        type: "error",
      });
    }
  }
);

router.get(
  "/channels/:channelId/session/:sessionId/edit-voting-question/:questionId",
  async (req, res) => {
    const { channelId, questionId, sessionId } = req.params;

    // Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(channelId) ||
      !mongoose.Types.ObjectId.isValid(questionId) ||
      !mongoose.Types.ObjectId.isValid(sessionId)
    ) {
      return res.render("edit-voting-question", {
        error: "Invalid Channel ID, Question ID, or Session ID",
        channel: null,
        question: null,
        user: req.user,
      });
    }

    try {
      const channel = await Channel.findById(channelId);

      if (!channel) {
        return res.render("edit-voting-question", {
          error: "Channel not found",
          channel: null,
          question: null,
          user: req.user,
        });
      }

      if (!channel.createdBy.equals(req.user._id)) {
        return res.render("edit-voting-question", {
          error: "Access denied",
          channel: null,
          question: null,
          user: req.user,
        });
      }

      const question = await VoteQuestion.findOne({
        _id: questionId,
        channelId,
      }).lean();

      if (!question) {
        return res.render("edit-voting-question", {
          error: "Voting question not found",
          channel,
          question: null,
          user: req.user,
        });
      }

      return res.render("edit-voting-question", {
        error: null,
        channel,
        question,
        user: req.user,
        sessionId,
      });
    } catch (err) {
      console.error("Error fetching voting question for edit:", err);
      return res.render("edit-voting-question", {
        error: "Server error. Try again later.",
        channel: null,
        question: null,
        user: req.user,
      });
    }
  }
);

router.post(
  "/voting-question/update",
  upload.fields([
    { name: "questionImage", maxCount: 1 },
    { name: "questionLogo", maxCount: 1 },
    { name: "logo", maxCount: 1 },
    { name: "optionsImages" },
    { name: "jackpotRewardImage", maxCount: 1 },
    { name: "digitalRewardImage", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        questionId,
        channelId,
        sessionId,
        question,
        options,
        questionImageLink,
        mode = "jackpot",
        jackpotCoinDeducted = 0,
        digitalCoinDeducted = 0,
        logoTitle,
        logoDescription,
        logoLink,
        clearedImages,
        jackpotRewardName,
        jackpotRewardDescription,
        jackpotRewardLink,
        digitalRewardName,
        digitalRewardDescription,
        digitalRewardLink,
      } = req.body;

      // ✅ Validate IDs
      if (
        !mongoose.Types.ObjectId.isValid(channelId) ||
        !mongoose.Types.ObjectId.isValid(sessionId)
      ) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({ message: "Invalid IDs", type: "error" });
      }

      // ✅ Fetch voting question
      const votingQuestion = await VoteQuestion.findById(questionId);
      if (!votingQuestion) {
        cleanupUploadedFiles(req.files);
        return res
          .status(404)
          .json({ message: "Voting question not found", type: "error" });
      }

      // ✅ Channel & session
      const channel = await Channel.findById(channelId);
      const session = await Session.findById(sessionId);
      if (!channel || !session) {
        cleanupUploadedFiles(req.files);
        return res
          .status(400)
          .json({ message: "Channel or Session not found", type: "error" });
      }

      // ✅ Ownership check
      if (!channel.createdBy.equals(req.user._id)) {
        cleanupUploadedFiles(req.files);
        return res
          .status(403)
          .json({ message: "Access denied", type: "error" });
      }

      // ✅ Required fields
      if (!question || !options) {
        cleanupUploadedFiles(req.files);
        return res
          .status(400)
          .json({ message: "Missing required fields", type: "error" });
      }

      // ✅ Coins
      let jCoin = Math.max(0, parseInt(jackpotCoinDeducted) || 0);
      let dCoin = Math.max(0, parseInt(digitalCoinDeducted) || 0);
      if (mode === "jackpot") dCoin = 0;
      else if (mode === "digital") jCoin = 0;
      else if (mode === "none") {
        jCoin = 0;
        dCoin = 0;
      }

      const magicCoinDeducted =
        mode === "jackpot"
          ? jCoin
          : mode === "digital"
          ? dCoin
          : mode === "none"
          ? 0
          : jCoin + dCoin;

      // ✅ Parse options
      let parsedOptions;
      try {
        parsedOptions = JSON.parse(options);
      } catch (err) {
        cleanupUploadedFiles(req.files);
        return res
          .status(400)
          .json({ message: "Invalid options format", type: "error" });
      }

      if (!Array.isArray(parsedOptions) || parsedOptions.length < 2) {
        cleanupUploadedFiles(req.files);
        return res
          .status(400)
          .json({ message: "At least 2 options required", type: "error" });
      }

      // ✅ Cleared images list
      let cleared = [];
      if (clearedImages) {
        if (Array.isArray(clearedImages)) {
          cleared = clearedImages.flatMap((c) =>
            c.split(",").map((s) => s.trim())
          );
        } else if (typeof clearedImages === "string") {
          cleared = clearedImages.split(",").map((s) => s.trim());
        }
      }

      // ✅ Handle main images
      const handleImageUpdate = (field, uploadedFile) => {
        if (cleared.includes(field)) {
          deleteFileIfExists(votingQuestion[field]);
          return null;
        } else if (uploadedFile) {
          deleteFileIfExists(votingQuestion[field]);
          return `/questions-image/${uploadedFile.filename}`;
        }
        return votingQuestion[field];
      };

      votingQuestion.logo = handleImageUpdate("logo", req.files["logo"]?.[0]);
      votingQuestion.questionImage = handleImageUpdate(
        "questionImage",
        req.files["questionImage"]?.[0]
      );
      votingQuestion.jackpotRewardImage = handleImageUpdate(
        "jackpotRewardImage",
        req.files["jackpotRewardImage"]?.[0]
      );
      votingQuestion.digitalRewardImage = handleImageUpdate(
        "digitalRewardImage",
        req.files["digitalRewardImage"]?.[0]
      );

      // ✅ Map option files to IDs
      const files = req.files["optionsImages"] || [];
      const optionIdsRaw = req.body.optionIds || [];
      const optionIds = Array.isArray(optionIdsRaw)
        ? optionIdsRaw
        : [optionIdsRaw];
      const fileByOptionId = new Map();

      files.forEach((file, k) => {
        const id = optionIds[k];
        if (id) fileByOptionId.set(id, file);
      });

      // Delete images of fully removed options
      if (req.body.clearedOptions) {
        const fullyClearedOptionIds = req.body.clearedOptions.split(",");
        fullyClearedOptionIds.forEach((id) => {
          const existingOpt = votingQuestion.options.find(
            (o) => o._id.toString() === id
          );
          if (existingOpt) deleteFileIfExists(existingOpt.image);
        });
        // Remove these options from DB
        votingQuestion.options = votingQuestion.options.filter(
          (o) => !fullyClearedOptionIds.includes(o._id.toString())
        );
      }

      const formattedOptions = parsedOptions.map((opt, idx) => {
        let optId = null;

        // Use existing ObjectId if valid
        if (opt._id && mongoose.Types.ObjectId.isValid(opt._id)) {
          optId = opt._id;
        } else {
          // Otherwise generate a fresh one (new option)
          optId = new mongoose.Types.ObjectId();
        }

        let oldImage = null;
        if (opt._id && mongoose.Types.ObjectId.isValid(opt._id)) {
          const found = votingQuestion.options.find(
            (o) => o._id && o._id.toString() === opt._id.toString()
          );
          oldImage = found ? found.image : null;
        }

        let newImage = oldImage;

        if (fileByOptionId.has(opt._id)) {
          deleteFileIfExists(oldImage);
          newImage = `/questions-image/${fileByOptionId.get(opt._id).filename}`;
        } else if (
          cleared.includes(opt._id) ||
          cleared.includes(`optionImage-${opt._id}`)
        ) {
          deleteFileIfExists(oldImage);
          newImage = null;
        } else if (opt.imageName && !oldImage) {
          newImage = `/questions-image/${opt.imageName}`;
        }

        return {
          _id: optId,
          text: opt.text?.trim() || "",
          description: opt.description?.trim() || "",
          image: newImage,
        };
      });

      // ✅ Update main fields
      votingQuestion.channelId = channelId;
      votingQuestion.sessionId = sessionId;
      votingQuestion.question = question.trim();
      votingQuestion.options = formattedOptions;
      votingQuestion.questionImageLink = questionImageLink?.trim() || null;
      votingQuestion.logoTitle = logoTitle?.trim() || null;
      votingQuestion.logoDescription = logoDescription?.trim() || null;
      votingQuestion.logoLink = logoLink?.trim() || null;
      votingQuestion.jackpotCoinDeducted = jCoin;
      votingQuestion.digitalCoinDeducted = dCoin;
      votingQuestion.mode = mode;
      votingQuestion.magicCoinDeducted = magicCoinDeducted;

      // ✅ Reward fields
      if (mode === "jackpot") {
        votingQuestion.digitalRewardName = "";
        votingQuestion.digitalRewardDescription = "";
        votingQuestion.digitalRewardLink = null;
        deleteFileIfExists(votingQuestion.digitalRewardImage);
        votingQuestion.digitalRewardImage = null;

        votingQuestion.jackpotRewardName = jackpotRewardName?.trim() || "";
        votingQuestion.jackpotRewardDescription =
          jackpotRewardDescription?.trim() || "";
        votingQuestion.jackpotRewardLink = jackpotRewardLink?.trim() || null;
      } else if (mode === "digital") {
        votingQuestion.jackpotRewardName = "";
        votingQuestion.jackpotRewardDescription = "";
        votingQuestion.jackpotRewardLink = null;
        deleteFileIfExists(votingQuestion.jackpotRewardImage);
        votingQuestion.jackpotRewardImage = null;

        votingQuestion.digitalRewardName = digitalRewardName?.trim() || "";
        votingQuestion.digitalRewardDescription =
          digitalRewardDescription?.trim() || "";
        votingQuestion.digitalRewardLink = digitalRewardLink?.trim() || null;
      } else if (mode === "both") {
        votingQuestion.jackpotRewardName = jackpotRewardName?.trim() || "";
        votingQuestion.jackpotRewardDescription =
          jackpotRewardDescription?.trim() || "";
        votingQuestion.jackpotRewardLink = jackpotRewardLink?.trim() || null;
        votingQuestion.digitalRewardName = digitalRewardName?.trim() || "";
        votingQuestion.digitalRewardDescription =
          digitalRewardDescription?.trim() || "";
        votingQuestion.digitalRewardLink = digitalRewardLink?.trim() || null;
      } else if (mode === "none") {
        votingQuestion.jackpotRewardName = "";
        votingQuestion.jackpotRewardDescription = "";
        votingQuestion.jackpotRewardLink = null;
        deleteFileIfExists(votingQuestion.jackpotRewardImage);
        votingQuestion.jackpotRewardImage = null;

        votingQuestion.digitalRewardName = "";
        votingQuestion.digitalRewardDescription = "";
        votingQuestion.digitalRewardLink = null;
        deleteFileIfExists(votingQuestion.digitalRewardImage);
        votingQuestion.digitalRewardImage = null;
      }

      await votingQuestion.save();

      return res.status(200).json({
        message: "Voting question updated successfully.",
        type: "success",
        data: votingQuestion,
      });
    } catch (err) {
      console.error("Error updating voting question:", err);
      cleanupUploadedFiles(req.files);
      return res
        .status(500)
        .json({ message: "Failed to update voting question", type: "error" });
    }
  }
);

router.delete("/voting-question/:id", async (req, res) => {
  try {
    const voteId = req.params.id;
    const { channelId } = req.body;
    const userId = req.user?._id; // Assumes auth middleware adds user

    if (!channelId || !userId) {
      return res.status(400).json({
        message: "channelId and userId are required",
        type: "error",
      });
    }

    // 🔐 1. Verify the channel belongs to the user
    const channel = await Channel.findOne({
      _id: channelId,
      createdBy: userId,
    });
    if (!channel) {
      return res.status(403).json({
        message: "Unauthorized channel access",
        type: "error",
      });
    }

    // 📦 2. Find the voting question within the channel
    const voteQuestion = await VoteQuestion.findOne({ _id: voteId, channelId });
    if (!voteQuestion) {
      return res.status(404).json({
        message: "Voting question not found",
        type: "error",
      });
    }

    // 🧹 Use cascadeDelete to remove voting question + all related data
    await cascadeDelete("voteQuestion", voteId);

    // // Optional: Delete related file assets (if exist)
    // const fileFieldsToCheck = [
    //   voteQuestion.questionImage,
    //   voteQuestion.questionLogo,
    //   voteQuestion.logo,
    // ];
    // fileFieldsToCheck.forEach((filePath) => {
    //   if (filePath) deleteFileIfExists(filePath);
    // });
    // if (Array.isArray(voteQuestion.options)) {
    //   voteQuestion.options.forEach((option) => {
    //     if (option.image) deleteFileIfExists(option.image);
    //   });
    // }

    // // ❌ Optional: Delete the voting question directly
    // await VoteQuestion.deleteOne({ _id: voteId });

    return res.status(200).json({
      message: "Voting question deleted successfully",
      type: "success",
    });
  } catch (err) {
    console.error("Delete Error:", err);
    return res.status(500).json({
      message: "Server error",
      type: "error",
    });
  }
});

router.get(
  "/channel/:channelId/session/:sessionId/voting-response-tracker",
  async (req, res) => {
    const currentPage = parseInt(req.query.page) || 1;
    const recordsPerPage = parseInt(process.env.USER_PER_PAGE) || 10;
    const skip = (currentPage - 1) * recordsPerPage;
    const { sessionId, channelId } = req.params;

    const channel = await Channel.findById(channelId);
    if (!channel || !channel.createdBy.equals(req.user._id)) {
      return res.render("dashboardnew", {
        quizResponses: [],
        totalResponsesWithoutPagination: 0,
        currentPage: 1,
        totalPages: 0,
        activeSection: "voting-response-tracker",
        user: req.user,
        error: "Access denied",
        sessionId,
        channelId,
      });
    }

    // ✅ Step 2: Validate session exists for this channel
    const session = await Session.findOne({ _id: sessionId, channelId });
    if (!session) {
      return res.render("dashboardnew", {
        quizResponses: [],
        totalResponsesWithoutPagination: 0,
        currentPage: 1,
        totalPages: 0,
        activeSection: "voting-response-tracker",
        user: req.user,
        error: "Session not found",
        sessionId,
        channelId,
      });
    }
    // Step 3: Find first vote question for this session and get linkedQRCode
    const question = await VoteQuestion.findOne(
      { sessionId },
      "linkedQRCode"
    ).lean();
    const voteQrCodeId = question?.linkedQRCode || null;

    // Step 4 & 5: Find QR and count scan logs (if exists)
    let qrScanCount = 0;
    if (voteQrCodeId) {
      const qrDoc = await QRCodeData.findById(voteQrCodeId);
      if (qrDoc) {
        qrScanCount = await QRScanLog.countDocuments({ qrCodeId: qrDoc._id });
      }
    }
    // If no voteQrCodeId or QR not found, qrScanCount remains 0

    try {
      const result = await VoteQuestionResponse.aggregate([
        {
          $lookup: {
            from: "votequestions",
            localField: "questionId",
            foreignField: "_id",
            as: "question",
          },
        },
        { $unwind: "$question" },
        {
          $match: {
            $expr: {
              $and: [
                // ✅ Restrict to current session
                {
                  $eq: [
                    "$question.sessionId",
                    new mongoose.Types.ObjectId(sessionId),
                  ],
                },

                // ✅ Exclude records based on winner + mode
                {
                  $not: {
                    $or: [
                      {
                        $and: [
                          { $eq: ["$question.mode", "jackpot"] },
                          { $eq: ["$isJackpotWinnerDeclared", true] },
                        ],
                      },
                      {
                        $and: [
                          { $eq: ["$question.mode", "digital"] },
                          { $eq: ["$isDigitalWinnerDeclared", true] },
                        ],
                      },
                      {
                        $and: [
                          { $eq: ["$question.mode", "both"] },
                          { $eq: ["$isJackpotWinnerDeclared", true] },
                          { $eq: ["$isDigitalWinnerDeclared", true] },
                        ],
                      },
                      // { $eq: ["$question.mode", "none"] },
                    ],
                  },
                },
              ],
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $project: {
            questionText: "$question.question",
            mode: "$question.mode",
            selectedOptionIndex: 1,
            deductCoin: 1,
            jackpotCoinDeducted: 1,
            digitalCoinDeducted: 1,
            coinsDeducted: {
              $cond: [
                { $eq: ["$deductCoin", true] },
                "$question.magicCoinDeducted",
                0,
              ],
            },
            isNoResponseGiven: 1,
            createdAt: 1,
            userName: "$user.fullName",
            userEmail: "$user.email",
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $facet: {
            data: [{ $skip: skip }, { $limit: recordsPerPage }],
            totalCount: [{ $count: "total" }],
            totalCountExcludingNoResponse: [
              { $match: { isNoResponseGiven: { $ne: true } } },
              { $count: "total" },
            ],
          },
        },
      ]);

      const quizResponses = result[0].data;
      const totalResponses = result[0].totalCount[0]?.total || 0;
      const totalPages = Math.ceil(totalResponses / recordsPerPage);
      const totalResponsesExcludingNoResponse =
        result[0].totalCountExcludingNoResponse[0]?.total || 0;

      res.render("dashboardnew", {
        quizResponses,
        totalResponsesWithoutPagination: totalResponses,
        totalResponsesExcludingNoResponse,
        qrScanCount,
        currentPage,
        totalPages,
        error: null,
        activeSection: "voting-response-tracker", // ✅ Added here
        user: req.user,
        sessionId,
        channelId,
      });
    } catch (error) {
      console.error("Error fetching quiz responses:", error);
      res.status(500).render("dashboardnew", {
        quizResponses: [],
        totalResponsesWithoutPagination: 0,
        error: "Server Error",
        currentPage: 1,
        totalPages: 0,
        activeSection: "voting-response-tracker", // ✅ Added here
        user: req.user,
        sessionId,
        channelId,
      });
    }
  }
);

router.get(
  "/channels/:channelId/session/:sessionId/voting-play",
  async (req, res) => {
    const { channelId, sessionId } = req.params;

    try {
      // Validate Channel ID
      if (
        !mongoose.Types.ObjectId.isValid(channelId) ||
        !mongoose.Types.ObjectId.isValid(sessionId)
      ) {
        return res.render("user-voting", {
          channel: null,
          error: "Invalid Channel ID or Session ID",
          user: req.user,
          currentQuestion: null,
          index: 0,
          total: 0,
          availableCoins: 0,
        });
      }

      const channel = await Channel.findById(channelId);
      const session = await Session.findById(sessionId);

      if (!channel) {
        return res.render("user-voting", {
          channel: null,
          error: "Channel not found",
          user: req.user,
          currentQuestion: null,
          index: 0,
          total: 0,
          availableCoins: 0,
        });
      }

      if (!session) {
        return res.render("user-voting", {
          channel: null,
          error: "Session not found",
          user: req.user,
          currentQuestion: null,
          index: 0,
          total: 0,
          availableCoins: 0,
        });
      }

      if (!channel.isRunning) {
        return res.render("user-voting", {
          channel: null,
          error: "Voting Quiz is not currently running or does not exist",
          user: req.user,
          currentQuestion: null,
          index: 0,
          total: 0,
          availableCoins: 0,
        });
      }

      const index =
        req.query.index !== undefined ? parseInt(req.query.index) : 0;

      const quizQuestions = await VoteQuestion.find({ sessionId })
        .sort({ createdAt: 1 })
        .skip(index)
        .limit(1)
        .lean();

      const total = await QuizQuestion.countDocuments({ sessionId });
      const currentQuestion = quizQuestions[0] || null;
      const hasNext = index + 1 < total;

      const availableCoins = req.user?.walletCoins || 0;

      if (currentQuestion) {
        const stats = await VoteQuestionResponse.aggregate([
          {
            $match: {
              questionId: currentQuestion._id,
              $or: [
                { isNoResponseGiven: { $exists: false } },
                { isNoResponseGiven: false },
              ],
            },
          },
          { $group: { _id: "$selectedOptionIndex", votes: { $sum: 1 } } },
        ]);

        const totalVotes = stats.reduce((acc, s) => acc + s.votes, 0) || 1;

        // Build lookup map once
        const votesMap = {};
        stats.forEach((s) => {
          votesMap[s._id] = s.votes;
        });

        // Map options with percentage
        currentQuestion.options = currentQuestion.options.map((opt, idx) => {
          const count = votesMap[idx] || 0;
          const percentage = ((count / totalVotes) * 100).toFixed(1);
          return { ...opt, votes: count, percentage };
        });
      }

      if (req.xhr || req.headers.accept.includes("json")) {
        return res.json({
          type: "success",
          data: currentQuestion,
          currentIndex: index,
          total,
          hasNext,
          availableCoins: req.user.walletCoins,
          sessionId,
        });
      }

      return res.render("user-voting", {
        channel,
        error: null,
        user: req.user,
        currentQuestion,
        index,
        total,
        availableCoins,
        sessionId,
      });
    } catch (err) {
      console.error("Error loading quiz question:", err);
      return res.render("user-quiz", {
        channel: null,
        error: "Server error. Please try again later.",
        user: req.user,
        currentQuestion: null,
        index: 0,
        total: 0,
        availableCoins: 0,
      });
    }
  }
);
router.post("/voting-response", async (req, res) => {
  const {
    questionId,
    channelId,
    sessionId,
    selectedOptionIndex,
    deductCoin = false,
    jackpotCoinDeducted = false,
    digitalCoinDeducted = false,
    appType = "Vote",
  } = req.body;

  const userId = req.user?._id;

  if (!questionId || !channelId || selectedOptionIndex === undefined) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const question = await VoteQuestion.findById(questionId).session(session);
    if (!question) throw new Error("Question not found");

    // Snapshot values
    const jackpotSnapshot =
      deductCoin && jackpotCoinDeducted ? question.jackpotCoinDeducted || 0 : 0;
    const digitalSnapshot =
      deductCoin && digitalCoinDeducted ? question.digitalCoinDeducted || 0 : 0;

    const totalSnapshot = jackpotSnapshot + digitalSnapshot;
    const actualDeductCoin = totalSnapshot > 0 ? deductCoin : false;

    // Deduct coins if needed
    const user = await User.findById(userId).session(session);
    if (!user) throw new Error("User not found");

    if (actualDeductCoin && (user.walletCoins || 0) < totalSnapshot) {
      await session.abortTransaction();
      session.endSession();
      return res.status(200).json({
        success: false,
        notEnoughCoins: true,
        availableCoins: user.walletCoins || 0,
        requiredCoins: totalSnapshot,
      });
    }

    // Save vote response
    await VoteQuestionResponse.create(
      [
        {
          userId,
          questionId,
          channelId,
          selectedOptionIndex,
          deductCoin: actualDeductCoin,
          jackpotCoinDeducted: jackpotSnapshot,
          digitalCoinDeducted: digitalSnapshot,
          sessionId,
        },
      ],
      { session }
    );

    // ----- Commission logic -----
    if (actualDeductCoin && totalSnapshot > 0) {
      const channel = await Channel.findById(channelId).session(session);
      if (channel) {
        const beneficiaryUserId = channel.createdBy;
        const commissionPercent = question.commissionPercent ?? 70;
        const commissionAmount = Math.floor(
          (totalSnapshot * commissionPercent) / 100
        );

        let totalCoinsAfterCommission;

        if (String(beneficiaryUserId) === String(userId)) {
          // Same user: deduct & add commission in one step
          user.walletCoins -= totalSnapshot;
          user.walletCoins += commissionAmount;
          await user.save({ session });
          totalCoinsAfterCommission = user.walletCoins || 0;
        } else {
          // Different users: deduct & give commission separately
          user.walletCoins -= totalSnapshot;
          await user.save({ session });
          const updatedBeneficiary = await User.findByIdAndUpdate(
            beneficiaryUserId,
            { $inc: { walletCoins: commissionAmount } },
            { new: true, session }
          );
          totalCoinsAfterCommission = updatedBeneficiary?.walletCoins || 0;
        }

        await MagicCoinCommission.create(
          [
            {
              channelId,
              sessionId,
              questionId,
              userId,
              coinsUsed: totalSnapshot,
              commissionPercent,
              commissionAmount,
              beneficiaryUserId,
              appType,
              status: "completed",
              totalCoins: totalCoinsAfterCommission,
            },
          ],
          { session }
        );
      }
    }
    // -----------------------------

    await session.commitTransaction();
    session.endSession();

    // Get vote stats
    const stats = await VoteQuestionResponse.aggregate([
      { $match: { questionId: question._id } },
      {
        $group: {
          _id: "$selectedOptionIndex",
          votes: { $sum: 1 },
        },
      },
    ]);

    const totalVotes = stats.reduce((acc, s) => acc + s.votes, 0) || 1;
    const voteResults = question.options.map((_, idx) => {
      const found = stats.find((s) => s._id === idx);
      const count = found ? found.votes : 0;
      return {
        optionIndex: idx,
        votes: count,
        percentage: ((count / totalVotes) * 100).toFixed(1),
      };
    });

    return res.status(200).json({
      success: true,
      voteResults,
      jackpotCoinDeducted: jackpotSnapshot > 0,
      digitalCoinDeducted: digitalSnapshot > 0,
      availableCoins: user.walletCoins || 0,
      selectedOptionIndex,
    });
  } catch (err) {
    console.error("Voting transaction failed:", err);
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// router.post("/voting-response", async (req, res) => {
//   const {
//     questionId,
//     channelId,
//     sessionId,
//     selectedOptionIndex,
//     deductCoin = false,
//     jackpotCoinDeducted = false, // flags to decide snapshot
//     digitalCoinDeducted = false,
//   } = req.body;

//   const userId = req.user?._id;

//   if (!questionId || !channelId || selectedOptionIndex === undefined) {
//     return res
//       .status(400)
//       .json({ success: false, message: "Missing required fields" });
//   }

//   try {
//     const question = await VoteQuestion.findById(questionId);
//     if (!question) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Question not found" });
//     }

//     // Determine snapshot values
//     const jackpotSnapshot =
//       deductCoin && jackpotCoinDeducted ? question.jackpotCoinDeducted || 0 : 0;
//     const digitalSnapshot =
//       deductCoin && digitalCoinDeducted ? question.digitalCoinDeducted || 0 : 0;

//     // Total sum of both
//     const totalSnapshot = jackpotSnapshot + digitalSnapshot;

//     // If totalSnapshot is 0, override deductCoin to false
//     const actualDeductCoin = totalSnapshot > 0 ? deductCoin : false;
//     let updateResult;
//     if (actualDeductCoin) {
//       const user = await User.findById(userId);
//       if ((user.walletCoins || 0) < totalSnapshot) {
//         return res.status(200).json({
//           success: false,
//           notEnoughCoins: true,
//           availableCoins: user.walletCoins || 0,
//           requiredCoins: totalSnapshot,
//         });
//       }

//       updateResult = await User.findByIdAndUpdate(
//         userId,
//         { $inc: { walletCoins: -totalSnapshot } },
//         { new: true }
//       );
//     } else {
//       // No deduction, just get current wallet coins
//       updateResult = await User.findById(userId);
//     }

//     // Create quiz response with coin snapshot and correct deductCoin
//     const response = await VoteQuestionResponse.create({
//       userId,
//       questionId,
//       channelId,
//       selectedOptionIndex,
//       deductCoin: actualDeductCoin,
//       jackpotCoinDeducted: jackpotSnapshot,
//       digitalCoinDeducted: digitalSnapshot,
//       sessionId,
//     });

//     // ✅ Optimized aggregation to get vote counts
//     const stats = await VoteQuestionResponse.aggregate([
//       { $match: { questionId: question._id } },
//       {
//         $group: {
//           _id: "$selectedOptionIndex",
//           votes: { $sum: 1 },
//         },
//       },
//     ]);

//     // Build results for all options
//     const totalVotes = stats.reduce((acc, s) => acc + s.votes, 0) || 1;
//     const voteResults = question.options.map((_, idx) => {
//       const found = stats.find((s) => s._id === idx);
//       const count = found ? found.votes : 0;
//       return {
//         optionIndex: idx,
//         votes: count,
//         percentage: ((count / totalVotes) * 100).toFixed(1),
//       };
//     });

//     return res.status(200).json({
//       success: true,
//       voteResults,
//       jackpotCoinDeducted: jackpotSnapshot > 0,
//       digitalCoinDeducted: digitalSnapshot > 0,
//       availableCoins: updateResult.walletCoins || 0, // ✅ include coins here
//       jackpotReward: {
//         name: question.jackpotRewardName,
//         image: question.jackpotRewardImage,
//         description: question.jackpotRewardDescription,
//         link: question.jackpotRewardLink,
//       },
//       digitalReward: {
//         name: question.digitalRewardName,
//         image: question.digitalRewardImage,
//         description: question.digitalRewardDescription,
//         link: question.digitalRewardLink,
//       },
//       selectedOptionIndex,
//     });
//   } catch (err) {
//     console.error("Error saving quiz response:", err);
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// });

// Draw Winner Route for Voting
router.get(
  "/channels/:channelId/session/:sessionId/voting/drawwinner",
  async (req, res) => {
    const { channelId, sessionId } = req.params;

    // Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(channelId) ||
      !mongoose.Types.ObjectId.isValid(sessionId)
    ) {
      return res.render("draw-winner-voting", {
        channel: null,
        error: "Invalid Channel or Session ID",
        user: req.user,
      });
    }

    try {
      const channel = await Channel.findById(channelId);
      const session = await Session.findById(sessionId);

      if (!channel || !session) {
        return res.render("draw-winner-voting", {
          channel: null,
          error: "Channel or session not found",
          user: req.user,
        });
      }

      // Check ownership
      if (!channel.createdBy.equals(req.user._id)) {
        return res.render("draw-winner-voting", {
          channel: channel,
          error: "Access denied",
          user: req.user,
          sessionId,
        });
      }

      const now = new Date();

      // Jackpot Participants (Voting)
      const jackpotParticipants = await VoteQuestionResponse.aggregate([
        {
          $match: {
            channelId: channel._id,
            sessionId: session._id,
            $or: [
              { isNoResponseGiven: false },
              { isNoResponseGiven: { $exists: false } },
            ],
          },
        },

        // Join with votequestions to get mode
        {
          $lookup: {
            from: "votequestions",
            localField: "questionId",
            foreignField: "_id",
            as: "question",
          },
        },
        { $unwind: "$question" },

        // Exclude already declared & restrict to jackpot/both modes
        {
          $match: {
            $and: [
              {
                $or: [
                  { isJackpotWinnerDeclared: false },
                  { isJackpotWinnerDeclared: { $exists: false } },
                ],
              },
              {
                $or: [
                  { "question.mode": "jackpot" },
                  { "question.mode": "both" },
                ],
              },
            ],
          },
        },

        // Join with users
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userInfo",
          },
        },
        { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: false } },

        // Only include eligible VIPs or coin-deducted users
        {
          $match: {
            $or: [
              {
                $expr: {
                  $and: [
                    { $eq: ["$userInfo.subscription.isVip", true] },
                    { $gte: ["$userInfo.subscription.validTill", now] },
                  ],
                },
              },
              { jackpotCoinDeducted: { $gt: 0 } },
            ],
          },
        },

        // Final projection
        {
          $project: {
            _id: 1,
            user: "$userInfo.fullName",
            userId: "$userInfo._id",
            email: "$userInfo.email",
            coins: "$jackpotCoinDeducted",
            isVip: "$userInfo.subscription.isVip",
            vipValidTill: "$userInfo.subscription.validTill",
          },
        },
      ]);

      // Digital Reward Participants (Voting)
      const digitalRewardParticipants = await VoteQuestionResponse.aggregate([
        {
          $match: {
            channelId: channel._id,
            sessionId: session._id,
            $or: [
              { isNoResponseGiven: false },
              { isNoResponseGiven: { $exists: false } },
            ],
          },
        },

        // Join with votequestions to get mode
        {
          $lookup: {
            from: "votequestions",
            localField: "questionId",
            foreignField: "_id",
            as: "question",
          },
        },
        { $unwind: "$question" },

        // Exclude already declared & restrict to digital/both modes
        {
          $match: {
            $and: [
              {
                $or: [
                  { isDigitalWinnerDeclared: false },
                  { isDigitalWinnerDeclared: { $exists: false } },
                ],
              },
              {
                $or: [
                  { "question.mode": "digital" },
                  { "question.mode": "both" },
                ],
              },
            ],
          },
        },

        // Join with users
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userInfo",
          },
        },
        { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: false } },

        // Only include eligible VIPs or coin-deducted users
        {
          $match: {
            $or: [
              {
                $expr: {
                  $and: [
                    { $eq: ["$userInfo.subscription.isVip", true] },
                    { $gte: ["$userInfo.subscription.validTill", now] },
                  ],
                },
              },
              { digitalCoinDeducted: { $gt: 0 } },
            ],
          },
        },

        // Final projection
        {
          $project: {
            _id: 1,
            user: "$userInfo.fullName",
            userId: "$userInfo._id",
            email: "$userInfo.email",
            coins: "$digitalCoinDeducted",
            isVip: "$userInfo.subscription.isVip",
            vipValidTill: "$userInfo.subscription.validTill",
          },
        },
      ]);

      return res.render("draw-winner-voting", {
        channel,
        error: null,
        user: req.user,
        sessionId,
        jackpotParticipants,
        digitalRewardParticipants,
      });
    } catch (err) {
      console.error("Error loading voting draw winner page:", err);
      return res.render("draw-winner-voting", {
        channel: null,
        error: "Server error. Please try again later.",
        activeSection: "channel-voting",
        user: req.user,
      });
    }
  }
);

// Draw Winner Route for Voting
router.post(
  "/channels/:channelId/session/:sessionId/voting/draw",
  async (req, res) => {
    const { channelId, sessionId } = req.params;
    const { type, mode, userId, responseId } = req.body; // type = "voting" | mode = "jackpot" | "digital"

    if (type !== "voting") {
      return res.status(400).json({ message: "Invalid type", type: "error" });
    }

    // ✅ Fetch the VoteQuestion by channel + session and get mode
    const question = await VoteQuestion.findOne(
      { channelId, sessionId },
      { mode: 1, linkedQRCode: 1 } // only fetch mode
    );

    if (!question) {
      return res.status(404).json({
        message: "Voting question not found for this channel and session",
        type: "error",
      });
    }

    const questionCurrentMode = question.mode; // 🎯 safely get mode

    if (!["jackpot", "digital"].includes(mode)) {
      return res.status(400).json({
        message: "Invalid draw type",
        type: "error",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(channelId) ||
      !mongoose.Types.ObjectId.isValid(sessionId) ||
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(responseId)
    ) {
      return res.status(400).json({
        message: "Invalid channel or session ID or user ID or response ID",
        type: "error",
      });
    }

    try {
      const channel = await Channel.findById(channelId);
      const session = await Session.findById(sessionId);

      if (!channel || !session) {
        return res.status(404).json({
          message: "Channel or session not found",
          type: "error",
        });
      }

      // Check ownership
      if (!channel.createdBy.equals(req.user._id)) {
        return res.status(403).json({
          message: "Access denied",
          type: "error",
        });
      }

      // Validate user
      const user = await User.findById(userId);
      if (!user) {
        return res
          .status(404)
          .json({ message: "User not found", type: "error" });
      }

      const coinField =
        mode === "jackpot" ? "jackpotCoinDeducted" : "digitalCoinDeducted";

      const now = new Date();

      const participant = await VoteQuestionResponse.aggregate([
        {
          $match: {
            _id: new mongoose.Types.ObjectId(responseId),
            channelId: channel._id,
            sessionId: session._id,
            userId: new mongoose.Types.ObjectId(userId),
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userInfo",
          },
        },
        { $unwind: "$userInfo" },
        {
          $match: {
            $or: [
              { [coinField]: { $gt: 0 } }, // user has coins deducted
              {
                $and: [
                  { "userInfo.subscription.isVip": true }, // VIP
                  { "userInfo.subscription.validTill": { $gte: now } }, // still valid
                ],
              },
            ],
          },
        },
        { $limit: 1 },
      ]);

      if (!participant.length) {
        return res.status(404).json({
          message: "This user did not participate or has no eligible coins",
          type: "error",
        });
      }
      // Apply approval rules
      const isApprovedByUser =
        req.user.isTvStation &&
        req.user.tvStationRules?.isApprovedByAdminToDrawWinner === false
          ? false
          : true;

      // Save winner request
      const winnerDoc = await WinnerRequest.create({
        sessionId: session._id,
        channelId: channel._id,
        questionId: participant[0].questionId,
        type, // "voting"
        mode: mode === "jackpot" ? "jackpot" : "digital",
        userId: participant[0].userId,
        isApprovedByUser,
        isApprovedByAdmin: false,
        isActive: true,
        createdBy: req.user._id,
      });

      // Use existing sender and reward logic
      const sender = {
        email: "arnoldschmidt@magic-code.net",
        name: "Magic Code - Plan Update",
      };

      if (isApprovedByUser) {
        // Handle Digital Winner
        if (mode === "digital") {
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

          const subject =
            "🎉 Congratulations! Your Digital Reward is Activated";
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
          await VoteQuestionResponse.updateMany(
            {
              sessionId: session._id,
              channelId: channel._id,
              $or: [
                { isDigitalWinnerDeclared: false },
                { isDigitalWinnerDeclared: { $exists: false } },
              ],
            },
            { $set: { isDigitalWinnerDeclared: true } }
          );
        }

        // Handle Jackpot Winner
        if (mode === "jackpot") {
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
          await VoteQuestionResponse.updateMany(
            {
              sessionId: session._id,
              channelId: channel._id,
              $or: [
                { isJackpotWinnerDeclared: false },
                { isJackpotWinnerDeclared: { $exists: false } },
              ],
            },
            { $set: { isJackpotWinnerDeclared: true } }
          );
        }
      }

      // Only proceed if user hasn't been approved yet
      else {
        // Handle Digital Winner
        if (mode === "digital") {
          await VoteQuestionResponse.updateMany(
            {
              sessionId: session._id,
              channelId: channel._id,
              $or: [
                { isDigitalWinnerDeclared: false },
                { isDigitalWinnerDeclared: { $exists: false } },
              ],
            },
            { $set: { isDigitalWinnerDeclared: true } }
          );
        }

        // Handle Jackpot Winner
        if (mode === "jackpot") {
          await VoteQuestionResponse.updateMany(
            {
              sessionId: session._id,
              channelId: channel._id,
              $or: [
                { isJackpotWinnerDeclared: false },
                { isJackpotWinnerDeclared: { $exists: false } },
              ],
            },
            { $set: { isJackpotWinnerDeclared: true } }
          );
        }
      }

      const coinsUsed =
        mode === "jackpot"
          ? participant[0].jackpotCoinDeducted
          : participant[0].digitalCoinDeducted;

      const message = isApprovedByUser
        ? `${
            type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
          } winner selected successfully.`
        : `${
            type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
          } winner request forwarded to admin.`;

      // ✅ After declaring winners and before sending response
      if (mode === questionCurrentMode || questionCurrentMode === "both") {
        let shouldDelete = false;

        if (questionCurrentMode === "both") {
          // Check if both winners are declared
          const winnerCheck = await VoteQuestionResponse.findOne({
            sessionId: session._id,
            channelId: channel._id,
            isJackpotWinnerDeclared: true,
            isDigitalWinnerDeclared: true,
          });

          if (winnerCheck) {
            shouldDelete = true;
          }
        } else {
          // Normal case: request mode matches question mode
          shouldDelete = true;
        }

        if (shouldDelete) {
          const qrRecord = await QRCodeData.findOne({
            _id: question.linkedQRCode,
          });
          if (qrRecord) {
            await QRScanLog.deleteMany({ qrCodeId: qrRecord._id });
            console.log(`Deleted all scan logs for QR ID ${qrRecord._id}`);
          }
        }
      }

      return res.status(200).json({
        message,
        type: "success",
        data: {
          winner: {
            user: user.fullName,
            email: user.email,
            coins: coinsUsed,
            winnerId: winnerDoc._id,
          },
          type: type,
          sessionId: session._id,
          channelId: channel._id,
        },
      });
    } catch (err) {
      console.error("Error drawing voting winner:", err);
      return res.status(500).json({
        message: "Failed to draw winner",
        type: "error",
      });
    }
  }
);

// Voting Api End Here

router.post("/quiz-viewed", async (req, res) => {
  const { questionId, channelId, sessionId, type } = req.body;
  const userId = req.user?._id;

  // Validate type first
  if (!type || !["quiz", "voting", "applause", "magicscreen"].includes(type)) {
    return res.status(400).json({
      success: false,
      message: "Invalid type. Must be 'quiz', 'voting' or 'applause'.",
    });
  }

  if (!channelId || !sessionId || !questionId) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }

  try {
    if (type === "quiz") {
      await QuizQuestionResponse.create({
        userId,
        questionId,
        channelId,
        sessionId,
        selectedOptionIndex: 0,
        isCorrect: false, // Not answered
        deductCoin: false,
        jackpotCoinDeducted: 0,
        digitalCoinDeducted: 0,
        isNoResponseGiven: true,
      });
    } else if (type === "voting") {
      await VoteQuestionResponse.create({
        userId,
        questionId,
        channelId,
        sessionId,
        selectedOptionIndex: 0,
        deductCoin: false,
        jackpotCoinDeducted: 0,
        digitalCoinDeducted: 0,
        isNoResponseGiven: true,
      });
    } else if (type === "applause") {
      await ApplauseResponse.create({
        userId,
        questionId,
        channelId,
        sessionId,
        selectedOptionIndex: 0,
        deductCoin: false,
        magicCoinDeducted: 0,
        isNoResponseGiven: true,
      });
    } else if (type === "magicscreen") {
      await MagicScreenResponse.create({
        userId,
        questionId,
        channelId,
        sessionId,
        selectedOptionIndex: 0,
        selectedLink: null, // Not answered
        isNoResponseGiven: true,
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error recording viewed event:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/link-magic-code", async (req, res) => {
  try {
    const userId = req.user._id;
    const { sessionId, type } = req.query; // type = "quiz" | "voting"
    const { qrCodeId } = req.body; // QR code ID from request body
    // ✅ Ensure req.user is populated (authentication middleware required)

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized. User not logged in.",
        type: "error",
      });
    }

    if (!sessionId || !qrCodeId || !type) {
      return res.status(400).json({
        message: "sessionId, qrCodeId, and type (quiz|voting) are required",
        type: "error",
      });
    }

    const Model =
      type === "quiz"
        ? QuizQuestion
        : type === "voting"
        ? VoteQuestion
        : type === "applause"
        ? Applause
        : type === "magicscreen"
        ? MagicScreen
        : null;

    if (!Model) {
      return res.status(400).json({
        message:
          "Invalid type. Must be 'quiz' or 'voting' or 'applause' or 'magicscreen'.",
        type: "error",
      });
    }

    // 1️⃣ Find the Question and channel
    const question = await Model.findOne({ sessionId })
      .populate({ path: "channelId", select: "createdBy" })
      .lean();

    if (!question) {
      return res.status(404).json({
        message: `No ${type} question found for the provided sessionId`,
        type: "error",
      });
    }

    // 2️⃣ Validate channel ownership
    if (
      !question.channelId ||
      question.channelId.createdBy.toString() !== userId.toString()
    ) {
      return res.status(403).json({
        message: "You are not authorized to link a Magic Code to this question",
        type: "error",
      });
    }

    // 3️⃣ Find the QR code by ID
    const qrCode = await QRCodeData.findById(qrCodeId).select(
      "user_id assignedTo"
    );
    if (!qrCode) {
      return res
        .status(404)
        .json({ message: "QR code not found", type: "error" });
    }

    const isOwner = qrCode.user_id?.toString() === userId.toString();
    const isAssigned = qrCode.assignedTo?.toString() === userId.toString();

    if (!isOwner && !isAssigned) {
      return res.status(403).json({
        message: "You are not authorized to use this QR code",
        type: "error",
      });
    }

    await Promise.all([
      QuizQuestion.updateMany(
        { linkedQRCode: qrCode._id },
        { $unset: { linkedQRCode: "" } }
      ),
      VoteQuestion.updateMany(
        { linkedQRCode: qrCode._id },
        { $unset: { linkedQRCode: "" } }
      ),
      Applause.updateMany(
        { linkedQRCode: qrCode._id },
        { $unset: { linkedQRCode: "" } }
      ),
      MagicScreen.updateMany(
        { linkedQRCode: qrCode._id },
        { $unset: { linkedQRCode: "" } }
      ),
    ]);

    // 5️⃣ Link QR code to this question
    let playUrl;

    if (type === "applause") {
      playUrl = `${process.env.FRONTEND_URL}/tvstation/applause/channels/${question.channelId._id}/session/${sessionId}/applause-play/?lang=en`;
    } else if (type === "magicscreen") {
      playUrl = `${process.env.FRONTEND_URL}/tvstation/magicscreen/channels/${question.channelId._id}/session/${sessionId}/magicscreen-play/?lang=en`;
    } else {
      playUrl = `${process.env.FRONTEND_URL}/tvstation/channels/${question.channelId._id}/session/${sessionId}/${type}-play/?lang=en`;
    }

    await Promise.all([
      Model.updateOne(
        { _id: question._id },
        { $set: { linkedQRCode: qrCode._id } }
      ),
      QRCodeData.updateOne(
        { _id: qrCode._id },
        { $set: { type: "url", url: playUrl } }
      ),
      // 6️⃣ Set showEditOnScan to false
      User.updateOne({ _id: userId }, { $set: { showEditOnScan: false } }),
    ]);

    return res.status(200).json({
      message: "Magic Code linked successfully",
      type: "success",
      link:
        type === "applause"
          ? `${process.env.FRONTEND_URL}/tvstation/applause/channels/${question.channelId._id}/session/${sessionId}/applause`
          : type === "magicscreen"
          ? `${process.env.FRONTEND_URL}/tvstation/magicscreen/channels/${question.channelId._id}/session/${sessionId}/magicscreen`
          : `${process.env.FRONTEND_URL}/tvstation/channels/${question.channelId._id}/session/${sessionId}/${type}`,
    });
  } catch (err) {
    console.error("Error linking Magic Code:", err);
    return res
      .status(500)
      .json({ message: "Internal server error", type: "error" });
  }
});

router.post("/unlink-magic-code", async (req, res) => {
  try {
    const userId = req.user._id;
    const { sessionId, type } = req.query; // type = "quiz" | "voting" | "applause"

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized. User not logged in.",
        type: "error",
      });
    }

    if (!sessionId || !type) {
      return res.status(400).json({
        message: "sessionId and type (quiz|voting|applause) are required",
        type: "error",
      });
    }

    const Model =
      type === "quiz"
        ? QuizQuestion
        : type === "voting"
        ? VoteQuestion
        : type === "applause"
        ? Applause
        : type === "magicscreen"
        ? MagicScreen
        : null;

    if (!Model) {
      return res.status(400).json({
        message: "Invalid type. Must be 'quiz', 'voting', or 'applause'.",
        type: "error",
      });
    }

    // 1️⃣ Find the Question and channel
    const question = await Model.findOne({ sessionId })
      .populate({ path: "channelId", select: "createdBy" })
      .lean();

    if (!question) {
      return res.status(404).json({
        message: `No ${type} question found for the provided sessionId`,
        type: "error",
      });
    }

    // 2️⃣ Validate channel ownership
    if (
      !question.channelId ||
      question.channelId.createdBy.toString() !== userId.toString()
    ) {
      return res.status(403).json({
        message:
          "You are not authorized to unlink a Magic Code from this question",
        type: "error",
      });
    }

    // 3️⃣ Get linked QR code
    if (!question.linkedQRCode) {
      return res.status(400).json({
        message: "This question has no linked Magic Code",
        type: "error",
      });
    }

    const qrCodeId = question.linkedQRCode;

    // 4️⃣ Unlink QR from this question
    await Model.updateOne(
      { _id: question._id },
      { $unset: { linkedQRCode: "" } }
    );

    // 5️⃣ Reset QR code data (optional — set back to default)
    await QRCodeData.updateOne(
      { _id: qrCodeId },
      {
        $unset: { url: "" },
        $set: { type: "text", text: "Your Message" }, // optional marker
      }
    );

    return res.status(200).json({
      message: "Magic Code unlinked successfully",
      type: "success",
    });
  } catch (err) {
    console.error("Error unlinking Magic Code:", err);
    return res
      .status(500)
      .json({ message: "Internal server error", type: "error" });
  }
});

router.get("/:sessionId/apps", async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user?._id;

  if (!sessionId) {
    return res
      .status(400)
      .json({ success: false, message: "Session ID is required" });
  }

  try {
    // 1️⃣ Fetch the session
    const session = await Session.findById(sessionId);
    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });
    }

    // 2️⃣ Fetch the channel for this session
    const channel = await Channel.findById(session.channelId);
    if (!channel || channel.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized for this session",
      });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}/tvstation/channels/${
      channel._id
    }/session/${session._id}`;

    // 3️⃣ Fetch one record from each model for this session
    const quizQuestion = await QuizQuestion.findOne({ sessionId })
      .sort({ createdAt: 1 })
      .select("question questionImage");
    const voteQuestion = await VoteQuestion.findOne({ sessionId })
      .sort({ createdAt: 1 })
      .select("question questionImage");
    const applauseQuestion = await Applause.findOne({ sessionId })
      .sort({ createdAt: 1 })
      .select("question questionImage");

    // 4️⃣ Attach respective links
    const data = {
      quizQuestion: quizQuestion
        ? {
            name: "Quiz",
            ...quizQuestion.toObject(),
            link: `${baseUrl}/quiz-play/`,
          }
        : null,
      voteQuestion: voteQuestion
        ? {
            name: "Vote",
            ...voteQuestion.toObject(),
            link: `${baseUrl}/voting-play/`,
          }
        : null,
      applauseQuestion: applauseQuestion
        ? {
            name: "Applause",
            ...applauseQuestion.toObject(),
            link: `${req.protocol}://${req.get(
              "host"
            )}/tvstation/applause/channels/${channel._id}/session/${
              session._id
            }/applause-play/`,
          }
        : null,
    };

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Error fetching session apps:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});


// Create a new affiliate or tvstation request
router.post("/user/request", async (req, res) => {
  try {
    const { type } = req.body;

    if (!type) {
      return res.status(400).json({
        message: "Request type is required.",
        type: "error",
        data: null,
      });
    }

    if (!["affiliate", "tvstation"].includes(type)) {
      return res.status(400).json({
        message: "Invalid request type.",
        type: "error",
        data: null,
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized. User not found.",
        type: "error",
        data: null,
      });
    }

    // Check if a pending request already exists
    const existingRequest = await UserRequest.findOne({
      userId,
      type,
      isApprovedByAdmin: false,
      isDeclined: false,
      isCancelledByUser: false,
    });

    if (existingRequest) {
      return res.status(400).json({
        message: `You already have a pending ${type} request.`,
        type: "error",
        data: null,
      });
    }

    // Create new request
    const newRequest = await UserRequest.create({
      userId,
      type,
    });

    return res.status(200).json({
      message: `${type === "affiliate" ? "Affiliate" : "TV Station"} request submitted successfully.`,
      type: "success",
      data: {
        requestId: newRequest._id,
        type: newRequest.type,
        createdAt: newRequest.createdAt,
      },
    });
  } catch (error) {
    console.error("User request creation error:", error);
    return res.status(500).json({
      message: "An error occurred while submitting the request.",
      type: "error",
      data: null,
    });
  }
});

module.exports = router;
