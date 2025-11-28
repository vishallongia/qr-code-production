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
const MagicScreenResponse = require("../models/MagicScreenResponse");
const QRCodeData = require("../models/QRCODEDATA"); // adjust path as needed
const QRScanLog = require("../models/QRScanLog"); // Adjust path if needed
const Session = require("../models/Session"); // adjust path if needed
const { cascadeDelete } = require("../utils/cascadeDelete"); // adjust path
const MagicScreen = require("../models/MagicScreen");

router.get(
  "/channels/:channelId/session/:sessionId/magicscreen",
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
        activeSection: "magicscreen",
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
          activeSection: "magicscreen",
          user: req.user,
          sessionId: null,
          channelId: null,
          session: null,
        });
      }

      // Check ownership
      if (!channel.createdBy.equals(req.user._id)) {
        return res.render("dashboardnew", {
          channel,
          error: "Access denied",
          activeSection: "magicscreen",
          user: req.user,
          sessionId: null,
          channelId: null,
          session: null,
        });
      }

      const skip = parseInt(req.query.skip) || 0;
      const limit = parseInt(req.query.limit) || 5;

      const magicScreens = await MagicScreen.find({
        channelId,
        sessionId,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await MagicScreen.countDocuments({ channelId, sessionId });
      const hasMore = skip + magicScreens.length < total;

      // Handle AJAX / JSON request
      if (req.xhr || req.headers.accept.includes("json")) {
        return res.json({ type: "success", data: magicScreens, hasMore });
      }

      // Render dashboard view
      return res.render("dashboardnew", {
        channel,
        error: null,
        activeSection: "magicscreen",
        user: req.user,
        quizQuestions: magicScreens,
        hasMore,
        sessionId,
        channelId,
        session,
      });
    } catch (err) {
      console.error("Error fetching magic screen for session:", err);
      return res.render("dashboardnew", {
        channel: null,
        error: "Server error. Please try again later.",
        activeSection: "magicscreen",
        user: req.user,
        quizQuestions: null,
        hasMore: false,
      });
    }
  }
);

router.get(
  "/channels/:channelId/session/:sessionId/addmagicscreenquestion",
  async (req, res) => {
    const { channelId, sessionId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(channelId) ||
      !mongoose.Types.ObjectId.isValid(sessionId)
    ) {
      return res.render("magicscreen/add-question", {
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
        return res.render("magicscreen/add-question", {
          channel: null,
          session: null,
          error: "Channel or Session not found",
          user: req.user,
        });
      }

      // ✅ Verify ownership
      if (!channel.createdBy.equals(req.user._id)) {
        return res.render("magicscreen/add-question", {
          channel: null,
          session: null,
          error: "Access denied",
          user: req.user,
        });
      }

      // ✅ Ensure session belongs to this channel
      if (!session.channelId.equals(channel._id)) {
        return res.render("magicscreen/add-question", {
          channel: null,
          session: null,
          error: "Session does not belong to this channel",
          user: req.user,
        });
      }

      // ✅ Only one question allowed per session
      const existingQuestion = await MagicScreen.findOne({ sessionId });

      if (existingQuestion) {
        return res.render("magicscreen/add-question", {
          channel,
          session,
          error: "Only one question is allowed per session.",
          user: req.user,
          sessionId,
        });
      }

      // ✅ Render add question page
      return res.render("magicscreen/add-question", {
        channel,
        session,
        error: null,
        user: req.user,
        sessionId,
      });
    } catch (err) {
      console.error(
        "Error in GET /channels/:channelId/session/:sessionId/addmagicscreenquestion:",
        err
      );
      return res.render("magicscreen/add-question", {
        channel: null,
        session: null,
        error: "Server error, please try again later.",
        user: req.user,
      });
    }
  }
);

router.post(
  "/magicscreen-question/create",
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
      if (!channelId || !sessionId || !options) {
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

      // ✅ Parse options
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
          message: "At least 1 option is required.",
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
          link: opt.link?.trim() || null, // ✅ new link field
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

      // ✅ Create and save Magic Screen question
      const magicScreenData = new MagicScreen({
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
        questionDescription: questionDescription?.trim(),
        logoMediaProfile: logoProfiles,
        showLogoSection: showLogoSection === "true" || showLogoSection === true,
      });

      await magicScreenData.save();

      return res.status(201).json({
        message: "Magic Screen question saved successfully.",
        type: "success",
        data: magicScreenData,
      });
    } catch (err) {
      console.error("Error saving Magic Screen question:", err);
      cleanupUploadedFiles(req.files);
      return res.status(500).json({
        message: "Failed to save Magic Screen question.",
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
      return res.render("magicscreen/edit-question", {
        error: "Invalid Channel ID, Question ID, or Session ID",
        channel: null,
        question: null,
        user: req.user,
        session: null,
      });
    }

    try {
      const channel = await Channel.findById(channelId);
      const session = await Channel.findById(sessionId);

      if (!channel) {
        return res.render("magicscreen/edit-question", {
          error: "Channel not found",
          channel: null,
          question: null,
          user: req.user,
          session: null,
        });
      }

      if (!channel.createdBy.equals(req.user._id)) {
        return res.render("magicscreen/edit-question", {
          error: "Access denied",
          channel: null,
          question: null,
          user: req.user,
          session: null,
        });
      }

      const question = await MagicScreen.findOne({
        _id: questionId,
        channelId,
      }).lean();

      if (!question) {
        return res.render("magicscreen/edit-question", {
          error: "Magic Screen question not found",
          channel,
          question: null,
          user: req.user,
          session: null,
        });
      }

      return res.render("magicscreen/edit-question", {
        error: null,
        channel,
        question,
        user: req.user,
        sessionId,
        session,
      });
    } catch (err) {
      console.error("Error fetching magic screen question for edit:", err);
      return res.render("magicscreen/edit-question", {
        error: "Server error. Try again later.",
        channel: null,
        question: null,
        user: req.user,
        session: null,
      });
    }
  }
);

router.post(
  "/magicscreen-question/update",
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

      // ✅ Validate IDs
      if (
        !mongoose.Types.ObjectId.isValid(channelId) ||
        !mongoose.Types.ObjectId.isValid(sessionId)
      ) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({ message: "Invalid IDs", type: "error" });
      }

      // ✅ Find Magic Screen question
      const magicScreen = await MagicScreen.findById(questionId);
      if (!magicScreen) {
        cleanupUploadedFiles(req.files);
        return res
          .status(404)
          .json({ message: "Magic Screen question not found", type: "error" });
      }

      // ✅ Validate channel/session ownership
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

      // ✅ Validate main fields
      if (!options) {
        cleanupUploadedFiles(req.files);
        return res
          .status(400)
          .json({ message: "Missing required fields", type: "error" });
      }

      // ✅ Parse options JSON
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

      // ✅ Handle cleared images array
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
          deleteFileIfExists(magicScreen[field]);
          return null;
        } else if (uploadedFile) {
          deleteFileIfExists(magicScreen[field]);
          return `/questions-image/${uploadedFile.filename}`;
        }
        return magicScreen[field];
      };

      // ✅ Update main images
      magicScreen.logo = handleImageUpdate("logo", req.files["logo"]?.[0]);
      magicScreen.questionImage = handleImageUpdate(
        "questionImage",
        req.files["questionImage"]?.[0]
      );
      magicScreen.questionLogo = handleImageUpdate(
        "questionLogo",
        req.files["questionLogo"]?.[0]
      );

      // ✅ Map uploaded option files to their option IDs
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

      // ✅ Remove cleared options (with their images)
      if (clearedOptions) {
        const fullyClearedOptionIds = clearedOptions.split(",");
        fullyClearedOptionIds.forEach((id) => {
          const existingOpt = magicScreen.options.find(
            (o) => o._id.toString() === id
          );
          if (existingOpt) deleteFileIfExists(existingOpt.image);
        });
        magicScreen.options = magicScreen.options.filter(
          (o) => !fullyClearedOptionIds.includes(o._id.toString())
        );
      }

      // ✅ Build updated options
      const formattedOptions = parsedOptions.map((opt) => {
        let optId =
          opt._id && mongoose.Types.ObjectId.isValid(opt._id)
            ? opt._id
            : new mongoose.Types.ObjectId();

        let oldImage = null;
        if (opt._id) {
          const found = magicScreen.options.find(
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
          link: opt.link?.trim() || "", // ✅ link field added
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

      // ✅ Save all updates
      magicScreen.channelId = channelId;
      magicScreen.sessionId = sessionId;
      magicScreen.question = question.trim();
      magicScreen.options = formattedOptions;
      magicScreen.logoTitle = logoTitle?.trim() || null;
      magicScreen.logoDescription = logoDescription?.trim() || null;
      magicScreen.logoLink = logoLink?.trim() || null;
      magicScreen.questionImageLink = questionImageLink?.trim() || null;
      magicScreen.questionDescription = questionDescription?.trim() || null;
      magicScreen.logoMediaProfile = logoProfiles;
      magicScreen.showLogoSection =
        showLogoSection === "true" || showLogoSection === true;

      await magicScreen.save();

      return res.status(200).json({
        message: "Magic Screen question updated successfully.",
        type: "success",
        data: magicScreen,
      });
    } catch (err) {
      console.error("Error updating Magic Screen question:", err);
      cleanupUploadedFiles(req.files);
      return res.status(500).json({
        message: "Failed to update Magic Screen question",
        type: "error",
      });
    }
  }
);

// DELETE Magic Screen event (same structure as applause delete)
router.delete("/:id", async (req, res) => {
  try {
    const questionId = req.params.id; // ✅ same naming as your applause route
    const { channelId } = req.body;
    const userId = req.user?._id;

    if (!channelId || !userId) {
      return res.status(400).json({
        message: "channelId and userId are required",
        type: "error",
      });
    }

    // Validate ownership of the channel
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

    // Validate magic screen event
    const magicScreen = await MagicScreen.findOne({
      _id: questionId,
      channelId,
    });
    if (!magicScreen) {
      return res.status(404).json({
        message: "Magic Screen event not found",
        type: "error",
      });
    }

    // Perform cascading deletion
    await cascadeDelete("magicScreen", questionId);

    return res.status(200).json({
      message: "Magic Screen event deleted successfully",
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
  "/channels/:channelId/session/:sessionId/magicscreen-play",
  async (req, res) => {
    const { channelId, sessionId } = req.params;

    try {
      // ✅ Validate IDs
      if (
        !mongoose.Types.ObjectId.isValid(channelId) ||
        !mongoose.Types.ObjectId.isValid(sessionId)
      ) {
        return res.render("magicscreen/user-magic-screen", {
          channel: null,
          error: "Invalid Channel ID or Session ID",
          user: req.user,
          currentQuestion: null,
          index: 0,
          total: 0,
          availableCoins: 0,
          tvStationUser: null,
        });
      }

      const channel = await Channel.findById(channelId);
      const session = await Session.findById(sessionId);

      if (!channel) {
        return res.render("magicscreen/user-magic-screen", {
          channel: null,
          error: "Channel not found",
          user: req.user,
          currentQuestion: null,
          index: 0,
          total: 0,
          availableCoins: 0,
          tvStationUser: null,
          session: null,
        });
      }

      if (!session) {
        return res.render("magicscreen/user-magic-screen", {
          channel: null,
          error: "Session not found",
          user: req.user,
          currentQuestion: null,
          index: 0,
          total: 0,
          availableCoins: 0,
          tvStationUser: null,
          session: null,
        });
      }

      if (!channel.isRunning) {
        return res.render("magicscreen/user-magic-screen", {
          channel: null,
          error: "Magic Screen session is not currently running",
          user: req.user,
          currentQuestion: null,
          index: 0,
          total: 0,
          availableCoins: 0,
          tvStationUser: null,
          session: null,
        });
      }

      // ✅ Fetch full createdBy user for metadata (consistent with quiz/voting)
      let tvStationUser = null;
      if (
        channel.createdBy &&
        mongoose.Types.ObjectId.isValid(channel.createdBy)
      ) {
        tvStationUser = await User.findById(channel.createdBy).lean();
      }
      const index =
        req.query.index !== undefined ? parseInt(req.query.index) : 0;

      // ✅ Fetch MagicScreen questions instead of Applause
      const magicScreens = await MagicScreen.find({ sessionId })
        .sort({ createdAt: 1 })
        .skip(index)
        .limit(1)
        .lean();

      const total = await MagicScreen.countDocuments({ sessionId });
      const currentQuestion = magicScreens[0] || null;
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
          tvStationUser: null,
          session,
        });
      }

      // ✅ Render EJS page
      return res.render("magicscreen/user-magic-screen", {
        channel,
        error: null,
        user: req.user,
        currentQuestion,
        index,
        total,
        availableCoins,
        sessionId,
        tvStationUser,
        session,
      });
    } catch (err) {
      console.error("Error loading magic screen question:", err);
      return res.render("magicscreen/user-magic-screen", {
        channel: null,
        error: "Server error. Please try again later.",
        user: req.user,
        currentQuestion: null,
        index: 0,
        total: 0,
        availableCoins: 0,
        session: null,
      });
    }
  }
);

router.post("/magic-screen-response", async (req, res) => {
  const {
    questionId,
    channelId,
    sessionId,
    selectedOptionIndex,
    selectedLink,
  } = req.body;
  const userId = req.user?._id || null;

  if (!questionId || !channelId || selectedOptionIndex === undefined) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
    });
  }

  try {
    const question = await MagicScreen.findById(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Magic screen question not found",
      });
    }

    // Save MagicScreen response
    const response = await MagicScreenResponse.create({
      userId,
      questionId,
      channelId,
      sessionId,
      selectedOptionIndex,
      selectedLink: selectedLink || null, // save the clicked link
    });

    return res.status(200).json({
      success: true,
      responseId: response._id,
    });
  } catch (err) {
    console.error("Error saving magic screen response:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

router.get(
  "/channel/:channelId/session/:sessionId/magicscreen-response-tracker",
  async (req, res) => {
    const currentPage = parseInt(req.query.page) || 1;
    const recordsPerPage = parseInt(process.env.USER_PER_PAGE) || 10;
    const skip = (currentPage - 1) * recordsPerPage;
    const { sessionId, channelId } = req.params;

    // 1️⃣ Validate channel
    const channel = await Channel.findById(channelId);
    if (!channel || !channel.createdBy.equals(req.user._id)) {
      return res.render("dashboardnew", {
        magicScreenResponses: [],
        totalResponsesWithoutPagination: 0,
        currentPage: 1,
        totalPages: 0,
        activeSection: "magicscreen-response-tracker",
        user: req.user,
        error: "Access denied",
        sessionId,
        channelId,
        qrScanCount: 0,
        broadcasterId: channel.broadcasterId || null,
      });
    }

    // 2️⃣ Validate session
    const session = await Session.findOne({ _id: sessionId, channelId });
    if (!session) {
      return res.render("dashboardnew", {
        magicScreenResponses: [],
        totalResponsesWithoutPagination: 0,
        currentPage: 1,
        totalPages: 0,
        activeSection: "magicscreen-response-tracker",
        user: req.user,
        error: "Session not found",
        sessionId,
        channelId,
        qrScanCount: 0,
        broadcasterId: channel.broadcasterId || null,
      });
    }

    // 3️⃣ Count QR scans if linked
    let qrScanCount = 0;
    const magicScreenQuestion = await MagicScreen.findOne(
      { sessionId },
      "linkedQRCode"
    ).lean();

    const magicScreenQrId = magicScreenQuestion?.linkedQRCode || null;

    if (magicScreenQrId) {
      const qrDoc = await QRCodeData.findById(magicScreenQrId);
      if (qrDoc) {
        qrScanCount = await QRScanLog.countDocuments({ qrCodeId: qrDoc._id });
      }
    }

    try {
      const result = await MagicScreenResponse.aggregate([
        // Lookup magic screen question
        {
          $lookup: {
            from: "magicscreens",
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

        // Lookup user info — include null userId (left join)
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        {
          $unwind: {
            path: "$user",
            preserveNullAndEmptyArrays: true, // ✅ include responses with no userId
          },
        },

        // Lookup user info
        // {
        //   $lookup: {
        //     from: "users",
        //     localField: "userId",
        //     foreignField: "_id",
        //     as: "user",
        //   },
        // },
        // { $unwind: "$user" },

        // Project only necessary fields
        {
          $project: {
            questionText: "$question.question",
            selectedOptionIndex: 1,
            selectedLink: 1, // ✅ include selected link
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

      const magicScreenResponses = result[0].data;
      const totalResponses = result[0].totalCount[0]?.total || 0;
      const totalPages = Math.ceil(totalResponses / recordsPerPage);
      const totalResponsesExcludingNoResponse =
        result[0].totalCountExcludingNoResponse[0]?.total || 0;

      res.render("dashboardnew", {
        magicScreenResponses,
        totalResponsesWithoutPagination: totalResponses,
        totalResponsesExcludingNoResponse,
        qrScanCount, // ✅ include QR scan count
        currentPage,
        totalPages,
        error: null,
        activeSection: "magicscreen-response-tracker",
        user: req.user,
        sessionId,
        channelId,
        broadcasterId: channel.broadcasterId || null,
      });
    } catch (error) {
      console.error("Error fetching magic screen responses:", error);
      res.status(500).render("dashboardnew", {
        magicScreenResponses: [],
        totalResponsesWithoutPagination: 0,
        qrScanCount: 0,
        error: "Server Error",
        currentPage: 1,
        totalPages: 0,
        activeSection: "magicscreen-response-tracker",
        user: req.user,
        sessionId,
        channelId,
        broadcasterId: channel.broadcasterId || null,
      });
    }
  }
);

module.exports = router;
