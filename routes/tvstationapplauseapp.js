const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
require("dotenv").config();
const {
  upload,
  cleanupUploadedFiles,
  deleteFileIfExists,
} = require("../middleware/multerQuizUploader");
const Channel = require("../models/Channel");
const User = require("../models/User");
const ApplauseResponse = require("../models/ApplauseResponse");
const QRCodeData = require("../models/QRCODEDATA"); // adjust path as needed
const QRScanLog = require("../models/QRScanLog"); // Adjust path if needed
const MagicCoinCommission = require("../models/MagicCoinCommission");
const Session = require("../models/Session"); // adjust path if needed
const { cascadeDelete } = require("../utils/cascadeDelete"); // adjust path
const Applause = require("../models/Applause");

router.get(
  "/channels/:channelId/session/:sessionId/applause",
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
        activeSection: "applause",
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
          activeSection: "applause",
          user: req.user,
          sessionId: null,
          channelId: null,
          session: null,
        });
      }

      // Check ownership
      if (!channel.createdBy.equals(req.user._id)) {
        return res.render("dashboardnew", {
          channel: channel,
          error: "Access denied",
          activeSection: "applause",
          user: req.user,
          sessionId: null,
          channelId: null,
          session: null,
        });
      }

      const skip = parseInt(req.query.skip) || 0;
      const limit = parseInt(req.query.limit) || 5;

      const quizQuestions = await Applause.find({
        channelId,
        sessionId,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Applause.countDocuments({ channelId, sessionId });
      const hasMore = skip + quizQuestions.length < total;

      if (req.xhr || req.headers.accept.includes("json")) {
        return res.json({ type: "success", data: quizQuestions, hasMore });
      }
      return res.render("dashboardnew", {
        channel,
        error: null,
        activeSection: "applause",
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
        activeSection: "applause",
        user: req.user,
        quizQuestions: null,
        hasMore: false,
      });
    }
  }
);

router.get(
  "/channels/:channelId/session/:sessionId/addapplausequestion",
  async (req, res) => {
    const { channelId, sessionId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(channelId) ||
      !mongoose.Types.ObjectId.isValid(sessionId)
    ) {
      return res.render("applause/add-question", {
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
        return res.render("applause/add-question", {
          channel: null,
          session: null,
          error: "Channel or Session not found",
          user: req.user,
        });
      }

      // Check if user owns the channel
      if (!channel.createdBy.equals(req.user._id)) {
        return res.render("applause/add-question", {
          channel: null,
          session: null,
          error: "Access denied",
          user: req.user,
        });
      }

      // Optional: check if session belongs to the channel
      if (!session.channelId.equals(channel._id)) {
        return res.render("applause/add-question", {
          channel: null,
          session: null,
          error: "Session does not belong to this channel",
          user: req.user,
        });
      }

      // ✅ Check if a question already exists for the session
      const existingQuestion = await Applause.findOne({ sessionId });

      if (existingQuestion) {
        return res.render("applause/add-question", {
          channel,
          session,
          error: "Only one question is allowed per session.",
          user: req.user,
          sessionId,
        });
      }

      return res.render("applause/add-question", {
        channel,
        session,
        error: null,
        user: req.user,
        sessionId,
      });
    } catch (err) {
      console.error(
        "Error in GET /channels/:channelId/session/:sessionId/addapplausequestion:",
        err
      );
      return res.render("applause/add-question", {
        channel: null,
        session: null,
        error: "Server error, please try again later.",
        user: req.user,
      });
    }
  }
);

router.post(
  "/applause-question/create",
  upload.fields([
    { name: "questionImage", maxCount: 1 },
    { name: "logo", maxCount: 1 },
    { name: "optionsImages" },
  ]),
  async (req, res) => {
    try {
      const {
        channelId,
        sessionId,
        question,
        options,
        questionImageLink,
        questionDescription,
        logoTitle,
        logoDescription,
        logoLink,
        logoMediaProfile = [],
        showLogoSection = true,
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
      if (!channelId || !sessionId || !question || !options) {
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
        return res.status(403).json({
          message: "Access denied",
          type: "error",
        });
      }

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

      if (!Array.isArray(parsedOptions) || parsedOptions.length < 1) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({
          message: "At least 1 applause product are required.",
          type: "error",
        });
      }

      const formattedOptions = parsedOptions.map((opt) => {
        const imageFile = req.files["optionsImages"]?.find(
          (file) => file.originalname === opt.imageName
        );

        return {
          text: opt.text?.trim(),
          description: opt.description?.trim() || "",
          image: imageFile ? `/questions-image/${imageFile.filename}` : null,
          magicCoinDeducted: Math.max(0, parseInt(opt.magicCoinDeducted) || 0),
        };
      });

      // ✅ Extract file paths
      const questionImagePath = req.files["questionImage"]?.[0]?.filename;
      const logoPath = req.files["logo"]?.[0]?.filename;

      // Allowed enum values
      const allowedProfiles = ["broadcaster", "project", "episode", "custom"];

      // Ensure it's an array (safeguard)
      let logoProfiles = Array.isArray(logoMediaProfile)
        ? logoMediaProfile
        : [];

      // Filter valid values and remove duplicates
      logoProfiles = [
        ...new Set(logoProfiles.filter((p) => allowedProfiles.includes(p))),
      ];

      // ✅ Create and save Applause question
      const applauseData = new Applause({
        channelId,
        sessionId,
        question: question.trim(),
        options: formattedOptions,
        questionImage: questionImagePath
          ? `/questions-image/${questionImagePath}`
          : null,
        questionImageLink: questionImageLink?.trim() || null,
        logo: logoPath ? `/questions-image/${logoPath}` : null,
        logoTitle: logoTitle?.trim() || "",
        logoDescription: logoDescription?.trim() || "",
        logoLink: logoLink?.trim() || null,
        questionDescription: questionDescription.trim(),
        logoMediaProfile: logoProfiles,
        showLogoSection: showLogoSection === "true" || showLogoSection === true,
      });

      await applauseData.save();

      return res.status(201).json({
        message: "Applause question saved successfully.",
        type: "success",
        data: applauseData,
      });
    } catch (err) {
      console.error("Error saving applause question:", err);
      cleanupUploadedFiles(req.files);
      return res.status(500).json({
        message: "Failed to save applause question.",
        type: "error",
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
      return res.render("applause/edit-question", {
        error: "Invalid Channel ID, Question ID, or Session ID",
        channel: null,
        question: null,
        user: req.user,
      });
    }

    try {
      const channel = await Channel.findById(channelId);

      if (!channel) {
        return res.render("applause/edit-question", {
          error: "Channel not found",
          channel: null,
          question: null,
          user: req.user,
        });
      }

      if (!channel.createdBy.equals(req.user._id)) {
        return res.render("applause/edit-question", {
          error: "Access denied",
          channel: null,
          question: null,
          user: req.user,
        });
      }

      const question = await Applause.findOne({
        _id: questionId,
        channelId,
      }).lean();

      if (!question) {
        return res.render("applause/edit-question", {
          error: "Applause question not found",
          channel,
          question: null,
          user: req.user,
        });
      }

      return res.render("applause/edit-question", {
        error: null,
        channel,
        question,
        user: req.user,
        sessionId,
      });
    } catch (err) {
      console.error("Error fetching applause question for edit:", err);
      return res.render("applause/edit-question", {
        error: "Server error. Try again later.",
        channel: null,
        question: null,
        user: req.user,
      });
    }
  }
);

router.post(
  "/applause-question/update",
  upload.fields([
    { name: "questionImage", maxCount: 1 },
    { name: "questionLogo", maxCount: 1 },
    { name: "logo", maxCount: 1 },
    { name: "optionsImages" },
  ]),
  async (req, res) => {
    try {
      const {
        questionId,
        channelId,
        sessionId,
        question,
        options,
        logoTitle,
        logoDescription,
        logoLink,
        questionImageLink,
        clearedImages,
        clearedOptions,
        questionDescription,
        logoMediaProfile = [],
        showLogoSection = true,
      } = req.body;

      if (
        !mongoose.Types.ObjectId.isValid(channelId) ||
        !mongoose.Types.ObjectId.isValid(sessionId)
      ) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({ message: "Invalid IDs", type: "error" });
      }

      const applause = await Applause.findById(questionId);
      if (!applause) {
        cleanupUploadedFiles(req.files);
        return res
          .status(404)
          .json({ message: "Applause question not found", type: "error" });
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
          .status(403)
          .json({ message: "Access denied", type: "error" });
      }

      if (!question || !options) {
        cleanupUploadedFiles(req.files);
        return res
          .status(400)
          .json({ message: "Missing required fields", type: "error" });
      }

      let parsedOptions;
      try {
        parsedOptions = JSON.parse(options);
      } catch {
        cleanupUploadedFiles(req.files);
        return res
          .status(400)
          .json({ message: "Invalid options format", type: "error" });
      }

      if (!Array.isArray(parsedOptions) || parsedOptions.length < 1) {
        cleanupUploadedFiles(req.files);
        return res
          .status(400)
          .json({ message: "At least 2 options required", type: "error" });
      }

      // Cleared images
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

      const handleImageUpdate = (field, uploadedFile) => {
        if (cleared.includes(field)) {
          deleteFileIfExists(applause[field]);
          return null;
        } else if (uploadedFile) {
          deleteFileIfExists(applause[field]);
          return `/questions-image/${uploadedFile.filename}`;
        }
        return applause[field];
      };

      applause.logo = handleImageUpdate("logo", req.files["logo"]?.[0]);
      applause.questionImage = handleImageUpdate(
        "questionImage",
        req.files["questionImage"]?.[0]
      );
      applause.questionLogo = handleImageUpdate(
        "questionLogo",
        req.files["questionLogo"]?.[0]
      );

      // Option files mapping
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

      // Remove cleared options
      if (clearedOptions) {
        const fullyClearedOptionIds = clearedOptions.split(",");
        fullyClearedOptionIds.forEach((id) => {
          const existingOpt = applause.options.find(
            (o) => o._id.toString() === id
          );
          if (existingOpt) deleteFileIfExists(existingOpt.image);
        });
        applause.options = applause.options.filter(
          (o) => !fullyClearedOptionIds.includes(o._id.toString())
        );
      }

      const formattedOptions = parsedOptions.map((opt) => {
        let optId =
          opt._id && mongoose.Types.ObjectId.isValid(opt._id)
            ? opt._id
            : new mongoose.Types.ObjectId();

        let oldImage = null;
        if (opt._id) {
          const found = applause.options.find(
            (o) => o._id.toString() === opt._id.toString()
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
          magicCoinDeducted: parseInt(opt.magicCoinDeducted) || 0,
          image: newImage,
        };
      });

      // ✅ Validate logoMediaProfile (must be array of allowed enum values)
      const allowedProfiles = ["broadcaster", "project", "episode", "custom"];
      let logoProfiles = [];

      if (Array.isArray(logoMediaProfile)) {
        logoProfiles = logoMediaProfile
          .map((p) => p.trim())
          .filter((p) => allowedProfiles.includes(p));
      } else if (typeof logoMediaProfile === "string") {
        // single value sent as string
        if (allowedProfiles.includes(logoMediaProfile.trim())) {
          logoProfiles = [logoMediaProfile.trim()];
        }
      }

      // Remove duplicates
      logoProfiles = [...new Set(logoProfiles)];

      applause.channelId = channelId;
      applause.sessionId = sessionId;
      applause.question = question.trim();
      applause.options = formattedOptions;
      applause.logoTitle = logoTitle?.trim() || null;
      applause.logoDescription = logoDescription?.trim() || null;
      applause.logoLink = logoLink?.trim() || null;
      applause.questionImageLink = questionImageLink?.trim() || null;
      applause.questionDescription = questionDescription?.trim() || null;
      applause.logoMediaProfile = logoProfiles;
      applause.showLogoSection =
        showLogoSection === "true" || showLogoSection === true;

      await applause.save();

      return res.status(200).json({
        message: "Applause question updated successfully.",
        type: "success",
        data: applause,
      });
    } catch (err) {
      console.error("Error updating applause question:", err);
      cleanupUploadedFiles(req.files);
      return res
        .status(500)
        .json({ message: "Failed to update applause question", type: "error" });
    }
  }
);

router.delete("/applause-question/:id", async (req, res) => {
  try {
    const questionId = req.params.id;
    const { channelId } = req.body;
    const userId = req.user?._id;

    if (!channelId || !userId) {
      return res.status(400).json({
        message: "channelId and userId are required",
        type: "error",
      });
    }

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

    const applause = await Applause.findOne({ _id: questionId, channelId });
    if (!applause) {
      return res.status(404).json({
        message: "Applause question not found",
        type: "error",
      });
    }

    await cascadeDelete("applauseQuestion", questionId);

    return res.status(200).json({
      message: "Applause question deleted successfully",
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
  "/channels/:channelId/session/:sessionId/applause-play",
  async (req, res) => {
    const { channelId, sessionId } = req.params;

    try {
      // ✅ Validate IDs
      if (
        !mongoose.Types.ObjectId.isValid(channelId) ||
        !mongoose.Types.ObjectId.isValid(sessionId)
      ) {
        return res.render("applause/user-applause", {
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
        return res.render("applause/user-applause", {
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
        return res.render("applause/user-applause", {
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
        return res.render("applause/user-applause", {
          channel: null,
          error: "Applause session is not currently running",
          user: req.user,
          currentQuestion: null,
          index: 0,
          total: 0,
          availableCoins: 0,
        });
      }

      const index =
        req.query.index !== undefined ? parseInt(req.query.index) : 0;

      // ✅ Fetch Applause questions instead of QuizQuestions
      const applauseQuestions = await Applause.find({ sessionId })
        .sort({ createdAt: 1 })
        .skip(index)
        .limit(1)
        .lean();

      const total = await Applause.countDocuments({ sessionId });
      const currentQuestion = applauseQuestions[0] || null;
      const hasNext = index + 1 < total;

      const availableCoins = req.user?.walletCoins || 0;

      // ✅ JSON response for AJAX requests
      if (req.xhr || req.headers.accept.includes("json")) {
        return res.json({
          type: "success",
          data: currentQuestion,
          currentIndex: index,
          total,
          hasNext,
          availableCoins,
          sessionId,
        });
      }

      // ✅ Render EJS page
      return res.render("applause/user-applause", {
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
      console.error("Error loading applause question:", err);
      return res.render("applause/user-applause", {
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

router.post("/applause-response", async (req, res) => {
  const {
    questionId,
    channelId,
    sessionId,
    selectedOptionIndex,
    deductCoin = false,
    magicCoinDeducted = 0, // ✅ matches schema
    appType = "Applause", // ✅ for commission tracking
  } = req.body;

  const userId = req.user?._id;

  if (!questionId || !channelId || selectedOptionIndex === undefined) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const question = await Applause.findById(questionId).session(session);
    if (!question) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    // 🪙 Deduct user coins
    const user = req?.user;
    if (!user) throw new Error("User not found");

    if (deductCoin && magicCoinDeducted > 0) {
      if ((user.walletCoins || 0) < magicCoinDeducted) {
        await session.abortTransaction();
        session.endSession();
        return res.status(200).json({
          success: false,
          notEnoughCoins: true,
          availableCoins: user.walletCoins || 0,
          requiredCoins: magicCoinDeducted,
          correctOptionIndex: question.correctAnswerIndex,
        });
      }
    }

    // 💾 Save applause response
    const response = await ApplauseResponse.create(
      [
        {
          userId,
          questionId,
          channelId,
          sessionId,
          selectedOptionIndex,
          deductCoin,
          magicCoinDeducted: deductCoin ? magicCoinDeducted : 0,
        },
      ],
      { session }
    );

    // 💸 Commission logic (same pattern as quiz-response)
    if (deductCoin && magicCoinDeducted > 0) {
      const channel = await Channel.findById(channelId).session(session);
      if (channel) {
        const beneficiaryUserId = channel.createdBy;
        const commissionPercent = question.commissionPercent ?? 70;
        const commissionAmount = Math.floor(
          (magicCoinDeducted * commissionPercent) / 100
        );

        let totalCoinsAfterCommission;

        if (String(beneficiaryUserId) === String(userId)) {
          // ✅ Same user: combine deduction + commission in one update
          user.walletCoins -= magicCoinDeducted;
          user.walletCoins += commissionAmount; // just add commission after deduction
          await user.save({ session });
          totalCoinsAfterCommission = user.walletCoins || 0;
        } else {
          // ✅ Different users: give commission to channel owner
          user.walletCoins -= magicCoinDeducted;
          await user.save({ session });
          const updatedBeneficiary = await User.findByIdAndUpdate(
            beneficiaryUserId,
            { $inc: { walletCoins: commissionAmount } },
            { new: true, session }
          );
          totalCoinsAfterCommission = updatedBeneficiary?.walletCoins || 0;
        }

        // 💾 Record commission
        await MagicCoinCommission.create(
          [
            {
              channelId: channel._id,
              sessionId,
              questionId,
              userId,
              coinsUsed: magicCoinDeducted,
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

    // ✅ Commit all operations
    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      correctOptionIndex: question.correctAnswerIndex,
      availableCoins: user.walletCoins || 0,
      responseId: response[0]._id,
    });
  } catch (err) {
    console.error("Error saving applause response:", err);
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// router.post("/applause-response", async (req, res) => {
//   const {
//     questionId,
//     channelId,
//     sessionId,
//     selectedOptionIndex,
//     deductCoin = false,
//     magicCoinDeducted = 0, // ✅ matches schema
//   } = req.body;

//   const userId = req.user?._id;

//   if (!questionId || !channelId || selectedOptionIndex === undefined) {
//     return res.status(400).json({
//       success: false,
//       message: "Missing required fields",
//     });
//   }

//   try {
//     const question = await Applause.findById(questionId);
//     if (!question) {
//       return res.status(404).json({
//         success: false,
//         message: "Question not found",
//       });
//     }

//     // If deductCoin true → check wallet and deduct coins
//     let updateResult;
//     if (deductCoin && magicCoinDeducted > 0) {
//       const user = await User.findById(userId);

//       if ((user.walletCoins || 0) < magicCoinDeducted) {
//         return res.status(200).json({
//           success: false,
//           notEnoughCoins: true,
//           availableCoins: user.walletCoins || 0,
//           requiredCoins: magicCoinDeducted,
//           correctOptionIndex: question.correctAnswerIndex, // ✅ still useful for frontend
//         });
//       }

//       updateResult = await User.findByIdAndUpdate(
//         userId,
//         { $inc: { walletCoins: -magicCoinDeducted } },
//         { new: true }
//       );
//     } else {
//       updateResult = await User.findById(userId);
//     }

//     // Save applause response
//     const response = await ApplauseResponse.create({
//       userId,
//       questionId,
//       channelId,
//       sessionId,
//       selectedOptionIndex,
//       deductCoin,
//       magicCoinDeducted: deductCoin ? magicCoinDeducted : 0,
//     });

//     return res.status(200).json({
//       success: true,
//       correctOptionIndex: question.correctAnswerIndex, // ✅ helpful for feedback
//       availableCoins: updateResult.walletCoins || 0,
//       responseId: response._id,
//     });
//   } catch (err) {
//     console.error("Error saving applause response:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// });

router.get(
  "/channel/:channelId/session/:sessionId/applause-response-tracker",
  async (req, res) => {
    const currentPage = parseInt(req.query.page) || 1;
    const recordsPerPage = parseInt(process.env.USER_PER_PAGE) || 10;
    const skip = (currentPage - 1) * recordsPerPage;
    const { sessionId, channelId } = req.params;

    // 1️⃣ Validate channel
    const channel = await Channel.findById(channelId);
    if (!channel || !channel.createdBy.equals(req.user._id)) {
      return res.render("dashboardnew", {
        applauseResponses: [],
        totalResponsesWithoutPagination: 0,
        currentPage: 1,
        totalPages: 0,
        activeSection: "applause-response-tracker",
        user: req.user,
        error: "Access denied",
        sessionId,
        channelId,
      });
    }

    // 2️⃣ Validate session
    const session = await Session.findOne({ _id: sessionId, channelId });
    if (!session) {
      return res.render("dashboardnew", {
        applauseResponses: [],
        totalResponsesWithoutPagination: 0,
        currentPage: 1,
        totalPages: 0,
        activeSection: "applause-response-tracker",
        user: req.user,
        error: "Session not found",
        sessionId,
        channelId,
      });
    }

    // 3️⃣ Count QR scans if linked
    let qrScanCount = 0;
    const applauseQuestion = await Applause.findOne(
      { sessionId },
      "linkedQRCode"
    ).lean();

    const applauseQrId = applauseQuestion?.linkedQRCode || null;

    if (applauseQrId) {
      const qrDoc = await QRCodeData.findById(applauseQrId);
      if (qrDoc) {
        qrScanCount = await QRScanLog.countDocuments({ qrCodeId: qrDoc._id });
      }
    }

    try {
      const result = await ApplauseResponse.aggregate([
        // Lookup applause question
        {
          $lookup: {
            from: "applauses",
            localField: "questionId",
            foreignField: "_id",
            as: "question",
          },
        },
        { $unwind: "$question" },

        // Match current session and active responses
        {
          $match: {
            $expr: {
              $and: [
                {
                  $eq: [
                    "$question.sessionId",
                    new mongoose.Types.ObjectId(sessionId),
                  ],
                },
                { $eq: ["$isActive", true] },
              ],
            },
          },
        },

        // Lookup user info
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },

        // Project only necessary fields
        {
          $project: {
            questionText: "$question.question",
            selectedOptionIndex: 1,
            coinsDeducted: "$magicCoinDeducted",
            createdAt: 1,
            userName: "$user.fullName",
            userEmail: "$user.email",
            isNoResponseGiven: 1,
          },
        },

        // Sort by newest first
        { $sort: { createdAt: -1 } },

        // Pagination + total count
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

      const applauseResponses = result[0].data;
      const totalResponses = result[0].totalCount[0]?.total || 0;
      const totalPages = Math.ceil(totalResponses / recordsPerPage);
      const totalResponsesExcludingNoResponse =
        result[0].totalCountExcludingNoResponse[0]?.total || 0;

      res.render("dashboardnew", {
        applauseResponses,
        totalResponsesWithoutPagination: totalResponses,
        totalResponsesExcludingNoResponse, // ✅ added
        qrScanCount,
        currentPage,
        totalPages,
        error: null,
        activeSection: "applause-response-tracker",
        user: req.user,
        sessionId,
        channelId,
      });
    } catch (error) {
      console.error("Error fetching applause responses:", error);
      res.status(500).render("dashboardnew", {
        applauseResponses: [],
        totalResponsesWithoutPagination: 0,
        error: "Server Error",
        currentPage: 1,
        totalPages: 0,
        activeSection: "applause-response-tracker",
        user: req.user,
        sessionId,
        channelId,
      });
    }
  }
);

module.exports = router;
