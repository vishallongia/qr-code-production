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
const Channel = require("../models/Channel");
const Payment = require("../models/Payment");
const QuizQuestionResponse = require("../models/QuizQuestionResponse");
const QRCodeData = require("../models/QRCODEDATA"); // adjust path as needed
const BASE_URL = process.env.FRONTEND_URL; // update if needed
const {
  encryptPassword,
  decryptPassword,
  generateCode,
} = require("../public/js/cryptoUtils");

// GET /channels - paginated list
router.get("/channels", async (req, res) => {
  try {
    const currentPage = parseInt(req.query.page) || 1;
    const recordsPerPage = Number(process.env.USER_PER_PAGE) || 10;
    const skip = (currentPage - 1) * recordsPerPage;

    const totalChannels = await Channel.countDocuments();
    const totalPages = Math.ceil(totalChannels / recordsPerPage);

    const channels = await Channel.find()
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

router.post("/create-channel", async (req, res) => {
  try {
    const { name } = req.body;
    const user = req.user;

    // Validate input
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        message: "Channel name is required",
        type: "error",
      });
    }

    const channelName = name.trim();

    // Check for duplicates (case-insensitive)
    const duplicate = await Channel.findOne({
      channelName: new RegExp(`^${channelName}$`, "i"),
    });

    if (duplicate) {
      return res.status(400).json({
        message: "Channel with this name already exists",
        type: "error",
      });
    }

    // Create channel
    const newChannel = new Channel({
      channelName,
      createdBy: user._id,
    });

    await newChannel.save();

    return res.status(201).json({
      message: "Channel created successfully",
      type: "success",
      channel: newChannel,
    });
  } catch (err) {
    console.error("Error creating channel:", err.message);
    return res.status(500).json({
      message: "Internal server error while creating channel",
      type: "error",
    });
  }
});

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

    await Channel.findByIdAndDelete(channelId);

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

router.put("/channels/:id", async (req, res) => {
  try {
    const channelId = req.params.id;
    const { name } = req.body;
    const user = req.user;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        message: "Channel name is required",
        type: "error",
      });
    }

    const updatedName = name.trim();

    // Fetch channel
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({
        message: "Channel not found",
        type: "error",
      });
    }

    // Allow only creator to update (or admin if applicable)
    if (!channel.createdBy.equals(user._id)) {
      return res.status(403).json({
        message: "You are not authorized to edit this channel",
        type: "error",
      });
    }

    // Check for duplicate name (case-insensitive)
    const duplicate = await Channel.findOne({
      _id: { $ne: channelId }, // exclude current
      channelName: new RegExp(`^${updatedName}$`, "i"),
    });

    if (duplicate) {
      return res.status(400).json({
        message: "Another channel with this name already exists",
        type: "error",
      });
    }

    // Perform update
    channel.channelName = updatedName;
    await channel.save();

    return res.status(200).json({
      message: "Channel updated successfully",
      type: "success",
      channel,
    });
  } catch (err) {
    console.error("Error updating channel:", err.message);
    return res.status(500).json({
      message: "Internal server error while updating channel",
      type: "error",
    });
  }
});

router.get("/channels/:id", async (req, res) => {
  const channelId = req.params.id;

  // Validate ObjectId
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

    // Render with channel data
    res.render("dashboardnew", {
      channel,
      error: null,
      activeSection: "channel-details",
      user: req.user,
    });
  } catch (err) {
    console.error("Error fetching channel details:", err);
    res.render("login", {
      channel: null,
      error: "Server error, please try again later.",
      activeSection: "channel-details",
      user: req.user,
    });
  }
});

router.get("/channels/:id/quiz", async (req, res) => {
  const channelId = req.params.id;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(channelId)) {
    return res.render("dashboardnew", {
      channel: null,
      error: "Invalid Channel ID",
      activeSection: "channel-quiz",
      user: req.user,
    });
  }

  try {
    const channel = await Channel.findById(channelId);

    if (!channel) {
      return res.render("dashboardnew", {
        channel: null,
        error: "Channel not found",
        activeSection: "channel-quiz",
        user: req.user,
      });
    }

    // Check ownership
    if (!channel.createdBy.equals(req.user._id)) {
      return res.render("dashboardnew", {
        channel: null,
        error: "Access denied",
        activeSection: "channel-quiz",
        user: req.user,
      });
    }
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 5;
    const quizQuestions = await QuizQuestion.find({ channelId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await QuizQuestion.countDocuments({ channelId });
    const hasMore = skip + quizQuestions.length < total;

    if (req.xhr || req.headers.accept.includes("json")) {
      return res.json({ type: "success", data: quizQuestions, hasMore });
    }

    // Render quiz section of the dashboard
    return res.render("dashboardnew", {
      channel,
      error: null,
      activeSection: "channel-quiz",
      user: req.user,
      quizQuestions,
      hasMore,
    });
  } catch (err) {
    console.error("Error fetching quiz channel details:", err);
    return res.render("dashboardnew", {
      channel: null,
      error: "Server error. Please try again later.",
      activeSection: "channel-quiz",
      user: req.user,
      quizQuestions: null,
      hasMore,
    });
  }
});

router.post(
  "/quiz-question/create",
  upload.fields([
    { name: "questionImage", maxCount: 1 },
    { name: "questionLogo", maxCount: 1 },
    { name: "optionsImages" },
  ]),
  async (req, res) => {
    try {
      const {
        channelId,
        question,
        options,
        correctAnswerIndex,
        questionImageLink,
        magicCoinDeducted,
      } = req.body;
      if (!channelId || !question || !options || !magicCoinDeducted) {
        cleanupUploadedFiles(req.files); // ⛔ Clean files on validation error
        return res.status(400).json({
          message: "Missing required fields.",
          type: "error",
        });
      }

      const parsedOptions = JSON.parse(options);
      if (!Array.isArray(parsedOptions) || parsedOptions.length < 2) {
        cleanupUploadedFiles(req.files); // ⛔ Clean files on validation error
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
          image: imageFile ? `/questions-image/${imageFile.filename}` : null,
        };
      });

      const questionImagePath = req.files["questionImage"]?.[0]?.filename;
      const questionLogoPath = req.files["questionLogo"]?.[0]?.filename;

      const quizData = new QuizQuestion({
        channelId,
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
        magicCoinDeducted: parseInt(magicCoinDeducted),
      });

      await quizData.save();

      return res.status(201).json({
        message: "Quiz question saved successfully.",
        type: "success",
        data: quizData,
      });
    } catch (err) {
      console.error("Error saving quiz question:", err);
      cleanupUploadedFiles(req.files); // ⛔ Clean files on any failure
      return res.status(500).json({
        message: "Failed to save quiz question.",
        type: "error",
      });
    }
  }
);

router.get("/channels/:id/addquestion", async (req, res) => {
  const channelId = req.params.id;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(channelId)) {
    return res.render("add-questions", {
      channel: null,
      error: "Invalid Channel ID",
      user: req.user,
    });
  }

  try {
    const channel = await Channel.findById(channelId);

    if (!channel) {
      return res.render("add-questions", {
        channel: null,
        error: "Channel not found",
        user: req.user,
      });
    }

    if (!channel.createdBy.equals(req.user._id)) {
      return res.render("add-questions", {
        channel: null,
        error: "Access denied",
        user: req.user,
      });
    }

    // Render the add-question page if all checks pass
    return res.render("add-questions", {
      channel,
      error: null,
      user: req.user,
    });
  } catch (err) {
    console.error("Error in /channels/:id/addquestion:", err);
    return res.render("add-questions", {
      channel: null,
      error: "Server error, please try again later.",
      user: req.user,
    });
  }
});

router.get(
  "/channels/:channelId/editquestion/:questionId",
  async (req, res) => {
    const { channelId, questionId } = req.params;

    // Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(channelId) ||
      !mongoose.Types.ObjectId.isValid(questionId)
    ) {
      return res.render("edit-question", {
        error: "Invalid Channel ID or Question ID",
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

router.post("/quiz-question/update", upload.any(), async (req, res) => {
  try {
    const {
      channelId,
      questionId,
      question,
      questionImageLink,
      correctAnswerIndex,
      magicCoinDeducted,
      optionTexts = [],
    } = req.body;

    // 🛡️ Allowable file fields
    const allowedFields = new Set([
      "questionImage",
      "questionLogo",
      ...Array.from({ length: 20 }, (_, i) => `optionImages[${i}]`),
    ]);

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

    for (const file of req.files) {
      if (!allowedFields.has(file.fieldname)) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({
          message: `Unexpected file field: ${file.fieldname}`,
          type: "error",
        });
      }

      if (!allowedMimeTypes.includes(file.mimetype)) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({
          message: `Invalid file type for: ${file.originalname}`,
          type: "error",
        });
      }
    }

    // Basic field validation
    if (
      !channelId ||
      !questionId ||
      !question ||
      !optionTexts ||
      magicCoinDeducted === undefined
    ) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({ message: "Missing fields", type: "error" });
    }

    const quiz = await QuizQuestion.findOne({ _id: questionId, channelId });
    if (!quiz) {
      cleanupUploadedFiles(req.files);
      return res.status(404).json({ message: "Quiz not found", type: "error" });
    }

    // 🔍 Collect files into structured format
    const uploadedOptionImagesByIndex = {};
    const filesMap = {};
    for (const file of req.files) {
      filesMap[file.fieldname] = file;
      const match = file.fieldname.match(/^optionImages\[(\d+)]$/);
      if (match) {
        const index = parseInt(match[1], 10);
        uploadedOptionImagesByIndex[index] = file;
      }
    }

    // 📸 Question Image
    if (filesMap["questionImage"]) {
      if (quiz.questionImage) deleteFileIfExists(quiz.questionImage);
      quiz.questionImage = `/questions-image/${filesMap["questionImage"].filename}`;
    } else {
      if (quiz.questionImage) deleteFileIfExists(quiz.questionImage);
      quiz.questionImage = null;
    }

    // 🖼️ Question Logo
    if (filesMap["questionLogo"]) {
      if (quiz.questionLogo) deleteFileIfExists(quiz.questionLogo);
      quiz.questionLogo = `/questions-image/${filesMap["questionLogo"].filename}`;
    } else {
      if (quiz.questionLogo) deleteFileIfExists(quiz.questionLogo);
      quiz.questionLogo = null;
    }

    // 📝 Options with Images
    const formattedOptions = optionTexts.map((text, i) => {
      const uploaded = uploadedOptionImagesByIndex[i];
      const old = quiz.options[i]?.image;

      if (uploaded) {
        if (old) deleteFileIfExists(old);
        return {
          text: text.trim(),
          image: `/questions-image/${uploaded.filename}`,
        };
      } else {
        if (old) deleteFileIfExists(old);
        return {
          text: text.trim(),
          image: null,
        };
      }
    });

    // 🧠 Update quiz
    quiz.question = question.trim();
    quiz.correctAnswerIndex = parseInt(correctAnswerIndex);
    quiz.magicCoinDeducted = parseInt(magicCoinDeducted);
    quiz.questionImageLink = questionImageLink?.trim() || null;
    quiz.options = formattedOptions;

    await quiz.save();

    res.status(200).json({
      message: "Question updated successfully",
      type: "success",
    });
  } catch (err) {
    console.error("Update Error:", err);
    cleanupUploadedFiles(req.files);
    res.status(500).json({ message: "Server error", type: "error" });
  }
});

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

router.get("/channels/:id/quiz-play", async (req, res) => {
  const channelId = req.params.id;

  // Validate Channel ID
  if (!mongoose.Types.ObjectId.isValid(channelId)) {
    return res.render("user-quiz", {
      channel: null,
      error: "Invalid Channel ID",
      user: req.user,
      currentQuestion: null,
      index: 0,
      total: 0,
      availableCoins: 0,
    });
  }

  try {
    const channel = await Channel.findById(channelId);
    if (!channel || channel.typeOfRunning !== "quiz" || !channel.isRunning) {
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

    const index = req.query.index !== undefined ? parseInt(req.query.index) : 0;

    const quizQuestions = await QuizQuestion.find({ channelId })
      .sort({ createdAt: 1 })
      .skip(index)
      .limit(1)
      .lean();

    const total = await QuizQuestion.countDocuments({ channelId });
    const currentQuestion = quizQuestions[0] || null;
    const hasNext = index + 1 < total;

    // 🔹 Calculate total purchased coins
    const purchasedCoinsResult = await Payment.aggregate([
      {
        $match: {
          user_id: req.user._id,
          paymentStatus: "completed",
          type: "coin",
        },
      },
      {
        $lookup: {
          from: "magiccoinplans",
          localField: "plan_id",
          foreignField: "_id",
          as: "planInfo",
        },
      },
      { $unwind: "$planInfo" },
      {
        $group: {
          _id: null,
          totalCoins: { $sum: "$planInfo.coinsOffered" },
        },
      },
    ]);

    const totalCoins = purchasedCoinsResult[0]?.totalCoins || 0;

    // 🔹 Calculate total deducted coins
    const deductedResponses = await QuizQuestionResponse.aggregate([
      {
        $match: {
          userId: req.user._id,
          deductCoin: true,
        },
      },
      {
        $lookup: {
          from: "quizquestions",
          localField: "questionId",
          foreignField: "_id",
          as: "questionInfo",
        },
      },
      { $unwind: "$questionInfo" },
      {
        $group: {
          _id: null,
          totalDeducted: { $sum: "$questionInfo.magicCoinDeducted" },
        },
      },
    ]);

    const totalDeducted = deductedResponses[0]?.totalDeducted || 0;

    const availableCoins = totalCoins - totalDeducted;

    if (req.xhr || req.headers.accept.includes("json")) {
      return res.json({
        type: "success",
        data: currentQuestion,
        currentIndex: index,
        total,
        hasNext,
        availableCoins,
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
});

router.post("/quiz-response", async (req, res) => {
  const {
    questionId,
    channelId,
    selectedOptionIndex,
    deductCoin = false,
  } = req.body;

  const userId = req.user?._id;

  if (!questionId || !channelId || selectedOptionIndex === undefined) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }

  try {
    const question = await QuizQuestion.findById(questionId);
    if (!question) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }

    const isCorrect =
      question.correctAnswerIndex === Number(selectedOptionIndex);

    // 🪙 Check coin balance if deductCoin is true
    if (deductCoin) {
      // Get total coins purchased
      const purchased = await Payment.aggregate([
        {
          $match: {
            user_id: userId,
            paymentStatus: "completed",
            type: "coin",
          },
        },
        {
          $lookup: {
            from: "magiccoinplans",
            localField: "plan_id",
            foreignField: "_id",
            as: "planInfo",
          },
        },
        { $unwind: "$planInfo" },
        {
          $group: {
            _id: null,
            totalCoins: { $sum: "$planInfo.coinsOffered" },
          },
        },
      ]);
      const totalCoins = purchased[0]?.totalCoins || 0;

      // Get total deducted coins from past responses
      const deducted = await QuizQuestionResponse.aggregate([
        {
          $match: {
            userId,
            deductCoin: true,
          },
        },
        {
          $lookup: {
            from: "quizquestions",
            localField: "questionId",
            foreignField: "_id",
            as: "questionInfo",
          },
        },
        { $unwind: "$questionInfo" },
        {
          $group: {
            _id: null,
            totalDeducted: { $sum: "$questionInfo.magicCoinDeducted" },
          },
        },
      ]);
      const totalDeducted = deducted[0]?.totalDeducted || 0;

      const availableCoins = totalCoins - totalDeducted;

      if (availableCoins < question.magicCoinDeducted) {
        return res.status(400).json({
          success: false,
          message: `You need ${question.magicCoinDeducted} coins, but you have only ${availableCoins}`,
        });
      }
    }

    // Always create new response
    await QuizQuestionResponse.create({
      userId,
      questionId,
      channelId,
      selectedOptionIndex,
      isCorrect,
      deductCoin,
    });

    return res.status(200).json({ success: true, isCorrect });
  } catch (err) {
    console.error("Error saving quiz response:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/quiz-response-tracker", async (req, res) => {
  const currentPage = parseInt(req.query.page) || 1;
  const recordsPerPage = parseInt(process.env.USER_PER_PAGE) || 10;
  const skip = (currentPage - 1) * recordsPerPage;

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
          selectedOptionIndex: 1,
          isCorrect: 1,
          deductCoin: 1,
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
        },
      },
    ]);

    const quizResponses = result[0].data;
    const totalResponses = result[0].totalCount[0]?.total || 0;
    const totalPages = Math.ceil(totalResponses / recordsPerPage);

    res.render("dashboardnew", {
      quizResponses,
      totalResponsesWithoutPagination: totalResponses,
      currentPage,
      totalPages,
      activeSection: "quiz-response-tracker", // ✅ Added here
      user: req.user,
    });
  } catch (error) {
    console.error("Error fetching quiz responses:", error);
    res.status(500).render("dashboardnew", {
      quizResponses: [],
      totalResponsesWithoutPagination: 0,
      currentPage: 1,
      totalPages: 0,
      activeSection: "quiz-response-tracker", // ✅ Added here
      user: req.user,
    });
  }
});

// POST /api/channel/:channelId/qr
router.post("/channel/:channelId/qr", async (req, res) => {
  try {
    const { channelId } = req.params;
    const { backgroundColor, qrDotColor } = req.body;

    // Step 1: Find the channel
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res
        .status(404)
        .json({ success: false, message: "Channel not found" });
    }

    const channelCode = channel.code;
    const qrUrl = `${BASE_URL}/tvstation/channels/${channelId}/quiz-play`;

    // Step 2: Find QR by code
    let qr = await QRCodeData.findOne({ code: channelCode });

    if (qr) {
      // Step 3a: If QR exists and colors provided, update them
      let updated = false;

      if (backgroundColor && backgroundColor !== qr.backgroundColor) {
        qr.backgroundColor = backgroundColor;
        updated = true;
      }

      if (qrDotColor && qrDotColor !== qr.qrDotColor) {
        qr.qrDotColor = qrDotColor;
        updated = true;
      }

      if (updated) {
        await qr.save();
      }
    } else {
      // Step 3b: Create new QR
      qr = await QRCodeData.create({
        qrName: channelCode,
        type: "url",
        url: qrUrl,
        text: "",
        code: channelCode,
        qrDotColor: qrDotColor || "#000000",
        backgroundColor: backgroundColor || "#FFFFFF",
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

    // Step 4: Return response
    res.json({ success: true, qr });
  } catch (error) {
    console.error("QR generation error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
