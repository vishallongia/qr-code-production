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
const Comment = require("../models/Comments");
const CommentResponse = require("../models/CommentResponse");
const QRCodeData = require("../models/QRCODEDATA"); // adjust path as needed
const QRScanLog = require("../models/QRScanLog"); // Adjust path if needed
const Session = require("../models/Session"); // adjust path if needed
const { cascadeDelete } = require("../utils/cascadeDelete"); // adjust path
const fs = require("fs");
const path = require("path");

router.get(
  "/channels/:channelId/session/:sessionId/comment",
  async (req, res) => {
    const { channelId, sessionId } = req.params;

    // ✅ Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(channelId) ||
      !mongoose.Types.ObjectId.isValid(sessionId)
    ) {
      return res.render("dashboardnew", {
        channel: null,
        error: "Invalid Channel or Session ID",
        activeSection: "comment",
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
          activeSection: "comment",
          user: req.user,
          sessionId: null,
          channelId: null,
          session: null,
        });
      }

      // ✅ Check ownership
      if (!channel.createdBy.equals(req.user._id)) {
        return res.render("dashboardnew", {
          channel,
          error: "Access denied",
          activeSection: "comment",
          user: req.user,
          sessionId: null,
          channelId: null,
          session: null,
        });
      }

      // ✅ Pagination
      const skip = parseInt(req.query.skip) || 0;
      const limit = parseInt(req.query.limit) || 5;

      // ✅ Fetch comments
      const comment = await Comment.find({
        channelId,
        sessionId,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Comment.countDocuments({ channelId, sessionId });
      const hasMore = skip + comment.length < total;

      // ✅ Handle AJAX / JSON request
      if (req.xhr || req.headers.accept.includes("json")) {
        return res.json({ type: "success", data: comment, hasMore });
      }

      // ✅ Render dashboard view
      return res.render("dashboardnew", {
        channel,
        error: null,
        activeSection: "comment",
        user: req.user,
        quizQuestions: comment, // keeping the same variable name used in frontend template
        hasMore,
        sessionId,
        channelId,
        session,
      });
    } catch (err) {
      console.error("Error fetching comments for session:", err);
      return res.render("dashboardnew", {
        channel: null,
        error: "Server error. Please try again later.",
        activeSection: "comment",
        user: req.user,
        quizQuestions: null,
        hasMore: false,
      });
    }
  }
);

router.get(
  "/channels/:channelId/session/:sessionId/addcommentquestion",
  async (req, res) => {
    const { channelId, sessionId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(channelId) ||
      !mongoose.Types.ObjectId.isValid(sessionId)
    ) {
      return res.render("comment/add-comment", {
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
        return res.render("comment/add-comment", {
          channel: null,
          session: null,
          error: "Channel or Session not found",
          user: req.user,
        });
      }

      // ✅ Verify ownership
      if (!channel.createdBy.equals(req.user._id)) {
        return res.render("comment/add-comment", {
          channel: null,
          session: null,
          error: "Access denied",
          user: req.user,
        });
      }

      // ✅ Ensure session belongs to this channel
      if (!session.channelId.equals(channel._id)) {
        return res.render("comment/add-comment", {
          channel: null,
          session: null,
          error: "Session does not belong to this channel",
          user: req.user,
        });
      }

      const existingComment = await Comment.findOne({ sessionId });
      if (existingComment) {
        return res.render("comment/add-comment", {
          channel,
          session,
          error: "Only one comment is allowed per session.",
          user: req.user,
          sessionId,
        });
      }

      // ✅ Render add comment page
      return res.render("comment/add-comment", {
        channel,
        session,
        error: null,
        user: req.user,
        sessionId,
      });
    } catch (err) {
      console.error(
        "Error in GET /channels/:channelId/session/:sessionId/addcomment:",
        err
      );
      return res.render("comment/add-comment", {
        channel: null,
        session: null,
        error: "Server error, please try again later.",
        user: req.user,
      });
    }
  }
);

router.post(
  "/comment-question/create",
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

      if (!channelId || !sessionId || !options) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({
          message: "Missing required fields.",
          type: "error",
        });
      }

      // ✅ Verify ownership
      const channel = await Channel.findById(channelId);
      const session = await Session.findById(sessionId);
      if (!channel || !session) {
        cleanupUploadedFiles(req.files);
        return res.status(404).json({
          message: "Channel or session not found.",
          type: "error",
        });
      }
      if (!channel.createdBy.equals(req.user._id)) {
        cleanupUploadedFiles(req.files);
        return res.status(403).json({
          message: "Access denied.",
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
          message: "At least one option is required.",
          type: "error",
        });
      }

      const formattedOptions = parsedOptions.map((opt) => {
        const imageFile = req.files["optionsImages"]?.find(
          (file) => file.originalname === opt.imageName
        );

        // ✅ If logo was selected, directly use its src (and ignore file)
        const imageSrc = opt.selectedLogoSrc?.trim()
          ? opt.selectedLogoSrc.trim()
          : imageFile
          ? `/questions-image/${imageFile.filename}`
          : null;

        return {
          text: opt.text?.trim(),
          description: opt.description?.trim() || "",
          image: imageSrc, // ✅ handles both uploaded or predefined
          link: opt.link?.trim() || null,
        };
      });

      // ✅ Extract file paths
      const questionImagePath = req.files["questionImage"]?.[0]?.filename;
      const logoPath = req.files["logo"]?.[0]?.filename;

      const allowedProfiles = ["broadcaster", "project", "episode", "custom"];
      const logoProfiles = Array.isArray(logoMediaProfile)
        ? logoMediaProfile.filter((p) => allowedProfiles.includes(p))
        : [];

      // ✅ Create comment question
      const commentQuestion = new Comment({
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
        questionDescription: questionDescription?.trim() || "",
        logoMediaProfile: logoProfiles,
      });

      await commentQuestion.save();

      res.status(201).json({
        message: "Comment question created successfully.",
        type: "success",
        data: commentQuestion,
      });
    } catch (err) {
      console.error("Error saving comment question:", err);
      cleanupUploadedFiles(req.files);
      res.status(500).json({
        message: "Failed to save comment question.",
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
      return res.render("comment/edit-comment", {
        error: "Invalid Channel ID, Question ID, or Session ID",
        channel: null,
        question: null,
        user: req.user,
      });
    }

    try {
      const channel = await Channel.findById(channelId);

      if (!channel) {
        return res.render("comment/edit-comment", {
          error: "Channel not found",
          channel: null,
          question: null,
          user: req.user,
        });
      }

      if (!channel.createdBy.equals(req.user._id)) {
        return res.render("comment/edit-comment", {
          error: "Access denied",
          channel: null,
          question: null,
          user: req.user,
        });
      }

      const question = await Comment.findOne({
        _id: questionId,
        channelId,
      }).lean();

      if (!question) {
        return res.render("comment/edit-comment", {
          error: "Comment not found",
          channel,
          question: null,
          user: req.user,
        });
      }

      return res.render("comment/edit-comment", {
        error: null,
        channel,
        question,
        user: req.user,
        sessionId,
      });
    } catch (err) {
      console.error("Error fetching comment for edit:", err);
      return res.render("comment/edit-comment", {
        error: "Server error. Try again later.",
        channel: null,
        question: null,
        user: req.user,
      });
    }
  }
);

router.post(
  "/comment-question/update",
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

      // ✅ Find Comment
      const comment = await Comment.findById(questionId);
      if (!comment) {
        cleanupUploadedFiles(req.files);
        return res
          .status(404)
          .json({ message: "Comment not found", type: "error" });
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
          deleteFileIfExists(comment[field]);
          return null;
        } else if (uploadedFile) {
          deleteFileIfExists(comment[field]);
          return `/comment-image/${uploadedFile.filename}`;
        }
        return comment[field];
      };

      // ✅ Update main images
      comment.logo = handleImageUpdate("logo", req.files["logo"]?.[0]);
      comment.questionImage = handleImageUpdate(
        "questionImage",
        req.files["questionImage"]?.[0]
      );
      comment.questionLogo = handleImageUpdate(
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
          const existingOpt = comment.options.find(
            (o) => o._id.toString() === id
          );
          if (existingOpt) deleteFileIfExists(existingOpt.image);
        });
        comment.options = comment.options.filter(
          (o) => !fullyClearedOptionIds.includes(o._id.toString())
        );
      }

      // ✅ Build updated options
      const formattedOptions = parsedOptions.map((opt) => {
        let optId =
          opt._id && mongoose.Types.ObjectId.isValid(opt._id)
            ? opt._id
            : new mongoose.Types.ObjectId();

        // Find existing option to get old image
        let oldImage = null;
        if (opt._id) {
          const found = comment.options.find(
            (o) => o._id.toString() === opt._id.toString()
          );
          oldImage = found ? found.image : null;
        }

        let newImage = oldImage;

        // ✅ Case 1: New file uploaded manually
        if (fileByOptionId.has(opt._id)) {
          // delete only if previous was manually uploaded (/questions-image/)
          if (oldImage && oldImage.startsWith("/questions-image/")) {
            deleteFileIfExists(oldImage);
          }
          newImage = `/questions-image/${fileByOptionId.get(opt._id).filename}`;
        }

        // ✅ Case 2: Cleared image
        else if (
          cleared.includes(opt._id) ||
          cleared.includes(`optionImage-${opt._id}`)
        ) {
          if (oldImage && oldImage.startsWith("/questions-image/")) {
            deleteFileIfExists(oldImage);
          }
          newImage = null;
        }

        // ✅ Case 3: New option uses a predefined logo
        else if (
          opt.selectedLogoSrc &&
          opt.selectedLogoSrc.startsWith("/comment-logos/")
        ) {
          // 🧩 If old image was manually uploaded, delete it
          if (oldImage && oldImage.startsWith("/questions-image/")) {
            deleteFileIfExists(oldImage);
          }

          newImage = opt.selectedLogoSrc.trim();
        }

        // ✅ Case 4: imageName manually passed (existing image reuse)
        else if (opt.imageName && !oldImage) {
          newImage = `/questions-image/${opt.imageName}`;
        }

        return {
          _id: optId,
          text: opt.text?.trim() || "",
          description: opt.description?.trim() || "",
          link: opt.link?.trim() || "",
          image: newImage,
        };
      });

      // ✅ Validate logoMediaProfile
      const allowedProfiles = ["broadcaster", "project", "episode", "custom"];
      let logoProfiles = [];

      if (Array.isArray(logoMediaProfile)) {
        logoProfiles = logoMediaProfile
          .map((p) => p.trim())
          .filter((p) => allowedProfiles.includes(p));
      } else if (typeof logoMediaProfile === "string") {
        if (allowedProfiles.includes(logoMediaProfile.trim())) {
          logoProfiles = [logoMediaProfile.trim()];
        }
      }

      logoProfiles = [...new Set(logoProfiles)];

      // ✅ Save updates
      comment.channelId = channelId;
      comment.sessionId = sessionId;
      comment.question = question.trim();
      comment.options = formattedOptions;
      comment.logoTitle = logoTitle?.trim() || null;
      comment.logoDescription = logoDescription?.trim() || null;
      comment.logoLink = logoLink?.trim() || null;
      comment.questionImageLink = questionImageLink?.trim() || null;
      comment.questionDescription = questionDescription?.trim() || null;
      comment.logoMediaProfile = logoProfiles;
      comment.showLogoSection =
        showLogoSection === "true" || showLogoSection === true;

      await comment.save();

      return res.status(200).json({
        message: "Comment updated successfully.",
        type: "success",
        data: comment,
      });
    } catch (err) {
      console.error("Error updating Comment:", err);
      cleanupUploadedFiles(req.files);
      return res.status(500).json({
        message: "Failed to update Comment",
        type: "error",
      });
    }
  }
);

// DELETE Comment event (same structure as Magic Screen)
router.delete("/:id", async (req, res) => {
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

    // Validate comment event
    const comment = await Comment.findOne({
      _id: questionId,
      channelId,
    });

    if (!comment) {
      return res.status(404).json({
        message: "Comment event not found",
        type: "error",
      });
    }

    // Perform cascading deletion
    await cascadeDelete("commentQuestion", questionId);

    return res.status(200).json({
      message: "Comment event deleted successfully",
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
  "/channels/:channelId/session/:sessionId/comment-play",
  async (req, res) => {
    const { channelId, sessionId } = req.params;

    try {
      // ✅ Validate IDs
      if (
        !mongoose.Types.ObjectId.isValid(channelId) ||
        !mongoose.Types.ObjectId.isValid(sessionId)
      ) {
        return res.render("comment/user-comment", {
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
        return res.render("comment/user-comment", {
          channel: null,
          error: "Channel not found",
          user: req.user,
          currentQuestion: null,
          index: 0,
          total: 0,
          availableCoins: 0,
          tvStationUser: null,
        });
      }

      if (!session) {
        return res.render("comment/user-comment", {
          channel: null,
          error: "Session not found",
          user: req.user,
          currentQuestion: null,
          index: 0,
          total: 0,
          availableCoins: 0,
          tvStationUser: null,
        });
      }

      if (!channel.isRunning) {
        return res.render("comment/user-comment", {
          channel: null,
          error: "Comment session is not currently running",
          user: req.user,
          currentQuestion: null,
          index: 0,
          total: 0,
          availableCoins: 0,
          tvStationUser: null,
        });
      }

      // ✅ Fetch full createdBy user (metadata)
      let tvStationUser = null;
      if (
        channel.createdBy &&
        mongoose.Types.ObjectId.isValid(channel.createdBy)
      ) {
        tvStationUser = await User.findById(channel.createdBy).lean();
      }

      const index =
        req.query.index !== undefined ? parseInt(req.query.index) : 0;

      // ✅ Fetch Comment documents instead of MagicScreen
      const comments = await Comment.find({ sessionId })
        .sort({ createdAt: 1 })
        .skip(index)
        .limit(1)
        .lean();

      const total = await Comment.countDocuments({ sessionId });
      const currentQuestion = comments[0] || null;
      const hasNext = index + 1 < total;

      const availableCoins = req.user?.walletCoins || 0;

      // ✅ JSON response for AJAX requests
      if (req.xhr || req.headers.accept?.includes("json")) {
        return res.json({
          type: "success",
          data: currentQuestion,
          currentIndex: index,
          total,
          hasNext,
          availableCoins,
          sessionId,
          tvStationUser,
        });
      }

      // ✅ Render EJS page
      return res.render("comment/user-comment", {
        channel,
        error: null,
        user: req.user,
        currentQuestion,
        index,
        total,
        availableCoins,
        sessionId,
        tvStationUser,
      });
    } catch (err) {
      console.error("Error loading comment question:", err);
      return res.render("comment/user-comment", {
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

router.post("/comment-response", async (req, res) => {
  const {
    questionId,
    channelId,
    sessionId,
    selectedOptionIndex,
    selectedLink,
  } = req.body;
  const userId = req.user?._id || null;

  // ✅ Validate required fields
  if (!questionId || !channelId || selectedOptionIndex === undefined) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
    });
  }

  try {
    // ✅ Verify Comment exists
    const question = await Comment.findById(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Comment question not found",
      });
    }

    // ✅ Save Comment response
    const response = await CommentResponse.create({
      userId,
      questionId,
      channelId,
      sessionId,
      selectedOptionIndex,
      selectedLink: selectedLink || null, // Save clicked link if any
    });

    return res.status(200).json({
      success: true,
      responseId: response._id,
    });
  } catch (err) {
    console.error("Error saving comment response:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

router.get(
  "/channel/:channelId/session/:sessionId/comment-response-tracker",
  async (req, res) => {
    const currentPage = parseInt(req.query.page) || 1;
    const recordsPerPage = parseInt(process.env.USER_PER_PAGE) || 10;
    const skip = (currentPage - 1) * recordsPerPage;
    const { sessionId, channelId } = req.params;

    // 1️⃣ Validate channel
    const channel = await Channel.findById(channelId);
    if (!channel || !channel.createdBy.equals(req.user._id)) {
      return res.render("dashboardnew", {
        commentResponses: [], // ✅ same key
        totalResponsesWithoutPagination: 0,
        currentPage: 1,
        totalPages: 0,
        activeSection: "comment-response-tracker",
        user: req.user,
        error: "Access denied",
        sessionId,
        channelId,
        qrScanCount: 0,
      });
    }

    // 2️⃣ Validate session
    const session = await Session.findOne({ _id: sessionId, channelId });
    if (!session) {
      return res.render("dashboardnew", {
        commentResponses: [], // ✅ same key
        totalResponsesWithoutPagination: 0,
        currentPage: 1,
        totalPages: 0,
        activeSection: "comment-response-tracker",
        user: req.user,
        error: "Session not found",
        sessionId,
        channelId,
        qrScanCount: 0,
      });
    }

    // 3️⃣ Count QR scans if linked
    let qrScanCount = 0;
    const commentQuestion = await Comment.findOne(
      { sessionId },
      "linkedQRCode"
    ).lean();

    const commentQrId = commentQuestion?.linkedQRCode || null;

    if (commentQrId) {
      const qrDoc = await QRCodeData.findById(commentQrId);
      if (qrDoc) {
        qrScanCount = await QRScanLog.countDocuments({ qrCodeId: qrDoc._id });
      }
    }

    try {
      const result = await CommentResponse.aggregate([
        // Lookup Comment question
        {
          $lookup: {
            from: "comments",
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

        // Project only necessary fields
        {
          $project: {
            questionText: "$question.question",
            selectedOptionIndex: 1,
            selectedLink: 1,
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

      const commentResponses = result[0].data; // ✅ same key name
      const totalResponses = result[0].totalCount[0]?.total || 0;
      const totalPages = Math.ceil(totalResponses / recordsPerPage);
      const totalResponsesExcludingNoResponse =
        result[0].totalCountExcludingNoResponse[0]?.total || 0;

      res.render("dashboardnew", {
        commentResponses, // ✅ keep identical key for EJS reuse
        totalResponsesWithoutPagination: totalResponses,
        totalResponsesExcludingNoResponse,
        qrScanCount,
        currentPage,
        totalPages,
        error: null,
        activeSection: "comment-response-tracker",
        user: req.user,
        sessionId,
        channelId,
      });
    } catch (error) {
      console.error("Error fetching comment responses:", error);
      res.status(500).render("dashboardnew", {
        commentResponses: [], // ✅ same key
        totalResponsesWithoutPagination: 0,
        qrScanCount: 0,
        error: "Server Error",
        currentPage: 1,
        totalPages: 0,
        activeSection: "comment-response-tracker",
        user: req.user,
        sessionId,
        channelId,
      });
    }
  }
);

// ✅ API to return list of comment logos
router.get("/comment-logos", (req, res) => {
  const dir = path.join(__dirname, "..", "comment-logos");

  fs.readdir(dir, (err, files) => {
    if (err) {
      console.error("Error reading comment-logos folder:", err);
      return res.status(500).json({ error: "Unable to load logos" });
    }

    // Filter only image files
    const imageFiles = files.filter((file) =>
      /\.(png|jpg|jpeg|gif|svg)$/i.test(file)
    );

    // Build public URLs
    const urls = imageFiles.map((file) => `/comment-logos/${file}`);

    res.json(urls);
  });
});

module.exports = router;
