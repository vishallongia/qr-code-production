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
const Product = require("../models/Products");
const ProductResponse = require("../models/ProductResponse");
const QRCodeData = require("../models/QRCODEDATA"); // adjust path as needed
const QRScanLog = require("../models/QRScanLog"); // Adjust path if needed
const Session = require("../models/Session"); // adjust path if needed
const { cascadeDelete } = require("../utils/cascadeDelete"); // adjust path
const fs = require("fs");
const path = require("path");

router.get(
  "/channels/:channelId/session/:sessionId/product",
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
        activeSection: "product",
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
          activeSection: "product",
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
          activeSection: "product",
          user: req.user,
          sessionId: null,
          channelId: null,
          session: null,
        });
      }

      // ✅ Pagination
      const skip = parseInt(req.query.skip) || 0;
      const limit = parseInt(req.query.limit) || 5;

      // ✅ Fetch products
      const product = await Product.find({
        channelId,
        sessionId,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Product.countDocuments({ channelId, sessionId });
      const hasMore = skip + product.length < total;

      // ✅ Handle AJAX / JSON request
      if (req.xhr || req.headers.accept.includes("json")) {
        return res.json({ type: "success", data: product, hasMore });
      }

      // ✅ Render dashboard view
      return res.render("dashboardnew", {
        channel,
        error: null,
        activeSection: "product",
        user: req.user,
        quizQuestions: product, // keeping the same variable name used in frontend template
        hasMore,
        sessionId,
        channelId,
        session,
      });
    } catch (err) {
      console.error("Error fetching products for session:", err);
      return res.render("dashboardnew", {
        channel: null,
        error: "Server error. Please try again later.",
        activeSection: "product",
        user: req.user,
        quizQuestions: null,
        hasMore: false,
      });
    }
  }
);

router.get(
  "/channels/:channelId/session/:sessionId/addproductquestion",
  async (req, res) => {
    const { channelId, sessionId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(channelId) ||
      !mongoose.Types.ObjectId.isValid(sessionId)
    ) {
      return res.render("product/add-product", {
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
        return res.render("product/add-product", {
          channel: null,
          session: null,
          error: "Channel or Session not found",
          user: req.user,
        });
      }

      // ✅ Verify ownership
      if (!channel.createdBy.equals(req.user._id)) {
        return res.render("product/add-product", {
          channel: null,
          session: null,
          error: "Access denied",
          user: req.user,
        });
      }

      // ✅ Ensure session belongs to this channel
      if (!session.channelId.equals(channel._id)) {
        return res.render("product/add-product", {
          channel: null,
          session: null,
          error: "Session does not belong to this channel",
          user: req.user,
        });
      }

      const existingProduct = await Product.findOne({ sessionId });
      if (existingProduct) {
        return res.render("product/add-product", {
          channel,
          session,
          error: "Only one product is allowed per session.",
          user: req.user,
          sessionId,
        });
      }

      // ✅ Render add product page
      return res.render("product/add-product", {
        channel,
        session,
        error: null,
        user: req.user,
        sessionId,
      });
    } catch (err) {
      console.error(
        "Error in GET /channels/:channelId/session/:sessionId/addproduct:",
        err
      );
      return res.render("product/add-product", {
        channel: null,
        session: null,
        error: "Server error, please try again later.",
        user: req.user,
      });
    }
  }
);

router.post(
  "/product-question/create",
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

      // ✅ Create product question
      const productQuestion = new Product({
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

      await productQuestion.save();

      res.status(201).json({
        message: "Product question created successfully.",
        type: "success",
        data: productQuestion,
      });
    } catch (err) {
      console.error("Error saving product question:", err);
      cleanupUploadedFiles(req.files);
      res.status(500).json({
        message: "Failed to save product question.",
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
      return res.render("product/edit-product", {
        error: "Invalid Channel ID, Question ID, or Session ID",
        channel: null,
        question: null,
        user: req.user,
        session: null,
      });
    }

    try {
      const channel = await Channel.findById(channelId);
      const session = await Session.findById(sessionId);

      if (!channel) {
        return res.render("product/edit-product", {
          error: "Channel not found",
          channel: null,
          question: null,
          user: req.user,
          session: null,
        });
      }

      if (!channel.createdBy.equals(req.user._id)) {
        return res.render("product/edit-product", {
          error: "Access denied",
          channel: null,
          question: null,
          user: req.user,
          session: null,
        });
      }

      const question = await Product.findOne({
        _id: questionId,
        channelId,
      }).lean();

      if (!question) {
        return res.render("product/edit-product", {
          error: "Product not found",
          channel,
          question: null,
          user: req.user,
          session: null,
        });
      }

      return res.render("product/edit-product", {
        error: null,
        channel,
        question,
        user: req.user,
        sessionId,
        session,
      });
    } catch (err) {
      console.error("Error fetching product for edit:", err);
      return res.render("product/edit-product", {
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
  "/product-question/update",
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

      // ✅ Find Product
      const product = await Product.findById(questionId);
      if (!product) {
        cleanupUploadedFiles(req.files);
        return res
          .status(404)
          .json({ message: "Product not found", type: "error" });
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
          deleteFileIfExists(product[field]);
          return null;
        } else if (uploadedFile) {
          deleteFileIfExists(product[field]);
          return `/questions-image/${uploadedFile.filename}`;
        }
        return product[field];
      };

      // ✅ Update main images
      product.logo = handleImageUpdate("logo", req.files["logo"]?.[0]);
      product.questionImage = handleImageUpdate(
        "questionImage",
        req.files["questionImage"]?.[0]
      );
      product.questionLogo = handleImageUpdate(
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
          const existingOpt = product.options.find(
            (o) => o._id.toString() === id
          );
          if (existingOpt) deleteFileIfExists(existingOpt.image);
        });
        product.options = product.options.filter(
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
          const found = product.options.find(
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
      product.channelId = channelId;
      product.sessionId = sessionId;
      product.question = question.trim();
      product.options = formattedOptions;
      product.logoTitle = logoTitle?.trim() || null;
      product.logoDescription = logoDescription?.trim() || null;
      product.logoLink = logoLink?.trim() || null;
      product.questionImageLink = questionImageLink?.trim() || null;
      product.questionDescription = questionDescription?.trim() || null;
      product.logoMediaProfile = logoProfiles;
      product.showLogoSection =
        showLogoSection === "true" || showLogoSection === true;

      await product.save();

      return res.status(200).json({
        message: "Product updated successfully.",
        type: "success",
        data: product,
      });
    } catch (err) {
      console.error("Error updating Product:", err);
      cleanupUploadedFiles(req.files);
      return res.status(500).json({
        message: "Failed to update Product",
        type: "error",
      });
    }
  }
);

// DELETE Product event (same structure as Magic Screen)
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

    // Validate product event
    const product = await Product.findOne({
      _id: questionId,
      channelId,
    });

    if (!product) {
      return res.status(404).json({
        message: "Product event not found",
        type: "error",
      });
    }

    // Perform cascading deletion
    await cascadeDelete("productQuestion", questionId);

    return res.status(200).json({
      message: "Product event deleted successfully",
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
  "/channels/:channelId/session/:sessionId/product-play",
  async (req, res) => {
    const { channelId, sessionId } = req.params;

    try {
      // ✅ Validate IDs
      if (
        !mongoose.Types.ObjectId.isValid(channelId) ||
        !mongoose.Types.ObjectId.isValid(sessionId)
      ) {
        return res.render("product/user-product", {
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
        return res.render("product/user-product", {
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
        return res.render("product/user-product", {
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
        return res.render("product/user-product", {
          channel: null,
          error: "Product session is not currently running",
          user: req.user,
          currentQuestion: null,
          index: 0,
          total: 0,
          availableCoins: 0,
          tvStationUser: null,
          session: null,
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

      // ✅ Fetch Product documents instead of MagicScreen
      const products = await Product.find({ sessionId })
        .sort({ createdAt: 1 })
        .skip(index)
        .limit(1)
        .lean();

      const total = await Product.countDocuments({ sessionId });
      const currentQuestion = products[0] || null;
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
          session,
        });
      }

      // ✅ Render EJS page
      return res.render("product/user-product", {
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
      console.error("Error loading product question:", err);
      return res.render("product/user-product", {
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

router.post("/product-response", async (req, res) => {
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
    // ✅ Verify Product exists
    const question = await Product.findById(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Product question not found",
      });
    }

    // ✅ Save Product response
    const response = await ProductResponse.create({
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
    console.error("Error saving product response:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

router.get(
  "/channel/:channelId/session/:sessionId/product-response-tracker",
  async (req, res) => {
    const currentPage = parseInt(req.query.page) || 1;
    const recordsPerPage = parseInt(process.env.USER_PER_PAGE) || 10;
    const skip = (currentPage - 1) * recordsPerPage;
    const { sessionId, channelId } = req.params;

    // 1️⃣ Validate channel
    const channel = await Channel.findById(channelId);
    if (!channel || !channel.createdBy.equals(req.user._id)) {
      return res.render("dashboardnew", {
        productResponses: [], // ✅ same key
        totalResponsesWithoutPagination: 0,
        currentPage: 1,
        totalPages: 0,
        activeSection: "product-response-tracker",
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
        productResponses: [], // ✅ same key
        totalResponsesWithoutPagination: 0,
        currentPage: 1,
        totalPages: 0,
        activeSection: "product-response-tracker",
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
    const productQuestion = await Product.findOne(
      { sessionId },
      "linkedQRCode"
    ).lean();

    const productQrId = productQuestion?.linkedQRCode || null;

    if (productQrId) {
      const qrDoc = await QRCodeData.findById(productQrId);
      if (qrDoc) {
        qrScanCount = await QRScanLog.countDocuments({ qrCodeId: qrDoc._id });
      }
    }

    try {
      const result = await ProductResponse.aggregate([
        // Lookup Product question
        {
          $lookup: {
            from: "products",
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

      const productResponses = result[0].data; // ✅ same key name
      const totalResponses = result[0].totalCount[0]?.total || 0;
      const totalPages = Math.ceil(totalResponses / recordsPerPage);
      const totalResponsesExcludingNoResponse =
        result[0].totalCountExcludingNoResponse[0]?.total || 0;

      res.render("dashboardnew", {
        productResponses, // ✅ keep identical key for EJS reuse
        totalResponsesWithoutPagination: totalResponses,
        totalResponsesExcludingNoResponse,
        qrScanCount,
        currentPage,
        totalPages,
        error: null,
        activeSection: "product-response-tracker",
        user: req.user,
        sessionId,
        channelId,
        broadcasterId: channel.broadcasterId || null,
      });
    } catch (error) {
      console.error("Error fetching product responses:", error);
      res.status(500).render("dashboardnew", {
        productResponses: [], // ✅ same key
        totalResponsesWithoutPagination: 0,
        qrScanCount: 0,
        error: "Server Error",
        currentPage: 1,
        totalPages: 0,
        activeSection: "product-response-tracker",
        user: req.user,
        sessionId,
        channelId,
        broadcasterId: channel.broadcasterId || null,
      });
    }
  }
);

// ✅ API to return list of product logos
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
