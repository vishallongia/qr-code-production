const express = require("express");
const router = express.Router();
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const User = require("../models/User");
const QRCodeData = require("../models/QRCODEDATA"); // adjust path as needed
const QRScanLog = require("../models/QRScanLog"); // Adjust path if needed
const SafeId = require("../models/SafeId");
const SafeIdVariant = require("../models/SafeIdVariant");
const BASE_URL = process.env.FRONTEND_URL; // update if needed
const { addUploadPath } = require("../utils/selectUploadDestination");
const QuizQuestion = require("../models/QuizQuestion");
const VoteQuestion = require("../models/VoteQuestion");
const Applause = require("../models/Applause");
const MagicScreen = require("../models/MagicScreen");
const Comment = require("../models/Comments");
const Product = require("../models/Products");
const Portfolio = require("../models/Portfolios");
const Brand = require("../models/Brand");
const {
  upload,
  cleanupUploadedFiles,
  deleteFileIfExists,
} = require("../middleware/multerQuizUploader");

router.post(
  "/create",
  addUploadPath("uploads"),
  upload.fields([{ name: "logo", maxCount: 1 }]),
  async (req, res) => {
    try {
      const { name, logoTitle, description, link } = req.body;
      const user = req.user;

      // Validate required fields
      if (!name) {
        cleanupUploadedFiles(req.files, "uploads");
        return res.status(400).json({
          message: "Name is required.",
          type: "error",
        });
      }

      const logoFile = req.files["logo"]?.[0];
      const logoPath = logoFile ? `/uploads/${logoFile.filename}` : null;

      // Create SafeId
      const newSafeId = await SafeId.create({
        safeId: name.trim(),
        createdBy: user._id,
        logo: logoPath,
        logoTitle: logoTitle?.trim() || "",
        description: description?.trim() || "",
        link: link?.trim() || null,
      });

      return res.status(201).json({
        message: "SafeId created successfully.",
        type: "success",
        data: newSafeId,
      });
    } catch (err) {
      console.error("Error creating SafeId:", err);
      cleanupUploadedFiles(req.files, "uploads");

      return res.status(500).json({
        message: "Failed to create SafeId.",
        type: "error",
      });
    }
  }
);

router.post(
  "/:id/update",
  addUploadPath("uploads"),
  upload.fields([{ name: "logo", maxCount: 1 }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, logoTitle, description, link, removeLogo } = req.body;

      const doc = await SafeId.findById(id);
      if (!doc) {
        cleanupUploadedFiles(req.files, "uploads");
        return res
          .status(404)
          .json({ message: "SafeId not found", type: "error" });
      }

      const newLogoFile = req.files["logo"]?.[0];
      const shouldRemoveLogo = removeLogo === "true";

      // ✅ Handle logo
      let logoPath = doc.logo;

      if (newLogoFile) {
        if (doc.logo) {
          deleteFileIfExists(doc.logo);
        }
        logoPath = `/uploads/${newLogoFile.filename}`;
      } else if (shouldRemoveLogo && doc.logo) {
        deleteFileIfExists(doc.logo);
        logoPath = null;
      }

      // ✅ Update fields like session logic
      doc.safeId = name?.trim() || doc.safeId;
      doc.logo = logoPath;
      doc.logoTitle = logoTitle?.trim() || "";
      doc.description = description?.trim() || "";
      doc.link = link?.trim() || null;

      await doc.save();

      return res.status(200).json({
        message: "SafeId updated successfully.",
        type: "success",
        data: doc,
      });
    } catch (err) {
      console.error("Error updating SafeId:", err);
      cleanupUploadedFiles(req.files, "uploads");
      return res.status(500).json({
        message: "Failed to update SafeId.",
        type: "error",
      });
    }
  }
);

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    // ✅ Find SafeId first
    const safeIdDoc = await SafeId.findById(id);
    if (!safeIdDoc) {
      return res
        .status(404)
        .json({ message: "SafeId not found", type: "error" });
    }

    // 🔐 Check if SafeId belongs to the current user
    if (!safeIdDoc.createdBy.equals(userId)) {
      return res.status(403).json({
        message: "You are not authorized to delete this SafeId",
        type: "error",
      });
    }

    // ✅ Cascading delete
    await cascadeDelete("safeId", id);

    return res.status(200).json({
      message: "SafeId deleted successfully",
      type: "success",
    });
  } catch (err) {
    console.error("Error deleting SafeId:", err);
    return res.status(500).json({
      message: "Failed to delete SafeId",
      type: "error",
    });
  }
});

router.get("/safeids-list", async (req, res) => {
  try {
    const userId = req.user._id;

    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 5;

    // 🔥 SUPER OPTIMIZED: Fetch SafeIds + Variants in ONE query
    const safeIds = await SafeId.aggregate([
      { $match: { createdBy: userId } },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },

      // ⭐ JOIN WITH VARIANTS ⭐
      {
        $lookup: {
          from: "safeidvariants", // collection name (always lowercase plural)
          localField: "_id",
          foreignField: "safeId",
          as: "variants",
        },
      },

      { $sort: { createdAt: -1 } },
    ]);

    // Count for pagination
    const total = await SafeId.countDocuments({ createdBy: userId });
    const hasMore = skip + safeIds.length < total;

    // JSON response for AJAX
    if (req.xhr || req.headers.accept.includes("json")) {
      return res.json({
        type: "success",
        data: safeIds,
        hasMore,
      });
    }

    // Convert array of { _id, variants: [..] } to { id: [variants] }
    const variantsMap = {};
    safeIds.forEach((item) => {
      variantsMap[item._id] = item.variants || [];
    });

    return res.render("dashboardnew", {
      safeIds,
      variantsMap,
      error: null,
      activeSection: "safe-id-list",
      user: req.user,
      hasMore,
    });
  } catch (err) {
    console.error("Error fetching SafeIds:", err);

    return res.render("dashboardnew", {
      safeIds: [],
      variantsMap: {},
      error: "Server error. Please try again later.",
      activeSection: "safe-id-list",
      user: req.user,
      hasMore: false,
    });
  }
});

// <------------------------     Safe Id Variant Routes      ------------------------------------>

router.get("/safe-variant/create", async (req, res) => {
  const { safeId } = req.query;

  // Validate safeId
  if (!safeId || !mongoose.Types.ObjectId.isValid(safeId)) {
    return res.render("safe-variant/add-safe-variant", {
      safe: null,
      error: "Invalid Safe ID",
      user: req.user,
      safeId: "",
    });
  }

  try {
    // Fetch SafeId model
    const safe = await SafeId.findById(safeId);

    if (!safe) {
      return res.render("safe-variant/add-safe-variant", {
        safe: null,
        error: "Safe ID not found",
        user: req.user,
        safeId: "",
      });
    }

    // Validate ownership
    if (!safe.createdBy.equals(req.user._id)) {
      return res.render("safe-variant/add-safe-variant", {
        safe: null,
        error: "Access denied",
        user: req.user,
        safeId: "",
      });
    }

    // Render Add Safe Variant Page
    return res.render("safe-variant/add-safe-variant", {
      safe,
      error: null,
      user: req.user,
      safeId: safe._id.toString(), // ⭐ CORRECT VALUE ⭐
    });
  } catch (err) {
    console.error("Error in GET /safe-variant/create:", err);

    return res.render("safe-variant/add-safe-variant", {
      safe: null,
      error: "Server error, please try again later.",
      user: req.user,
      safeId: "",
    });
  }
});

router.post(
  "/safe-variant/create",
  upload.fields([
    { name: "questionImage", maxCount: 1 },
    { name: "logo", maxCount: 1 },
    { name: "optionsImages" },
  ]),
  async (req, res) => {
    try {
      const {
        safeId,
        question,
        questionDescription,
        questionMessage, // ⭐ updated here
        generalPhoneNumber,
        emergencyPhoneNumber,
        otherPhoneNumber,
        email,
        logoTitle,
        logoDescription,
        logoLink,
        logoMediaProfile = [],
        options,
        showSafeIdProfile,
      } = req.body;

      // Validate safeId
      if (!mongoose.Types.ObjectId.isValid(safeId)) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({
          message: "Invalid Safe ID",
          type: "error",
        });
      }

      const safe = await SafeId.findById(safeId);
      if (!safe || !safe.createdBy.equals(req.user._id)) {
        cleanupUploadedFiles(req.files);
        return res.status(403).json({
          message: "Unauthorized request.",
          type: "error",
        });
      }

      // Parse options
      let parsedOptions;
      try {
        parsedOptions = JSON.parse(options);
      } catch (error) {
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

      // Format options
      const formattedOptions = parsedOptions.map((opt) => {
        const file = req.files["optionsImages"]?.find(
          (f) => f.originalname === opt.imageName
        );

        const finalImage = opt.selectedLogoSrc
          ? opt.selectedLogoSrc
          : file
          ? `/questions-image/${file.filename}`
          : null;

        return {
          text: opt.text?.trim(),
          description: opt.description?.trim() || "",
          image: finalImage,
          link: opt.link?.trim() || null,
        };
      });

      // File paths
      const questionImage = req.files["questionImage"]?.[0]?.filename;
      const logo = req.files["logo"]?.[0]?.filename;

      // Allowed profile toggle is now only "safeId"
      const allowedProfiles = ["safeId"];
      const logoProfiles = Array.isArray(logoMediaProfile)
        ? logoMediaProfile.filter((x) => allowedProfiles.includes(x))
        : [];

      // Create SafeIdVariant
      const variant = new SafeIdVariant({
        safeId: safeId,
        question: question?.trim(),
        questionDescription: questionDescription?.trim(),
        questionMessage: questionMessage?.trim(), // ⭐ updated field
        questionImage: questionImage
          ? `/questions-image/${questionImage}`
          : null,
        options: formattedOptions,
        logo: logo ? `/questions-image/${logo}` : null,
        logoTitle: logoTitle?.trim() || "",
        logoDescription: logoDescription?.trim() || "",
        logoLink: logoLink?.trim() || "",
        showSafeIdProfile: showSafeIdProfile,

        // ⭐ Phone/email
        generalPhoneNumber: generalPhoneNumber?.trim(),
        emergencyPhoneNumber: emergencyPhoneNumber?.trim(),
        otherPhoneNumber: otherPhoneNumber?.trim(),
        email: email?.trim() || null,
      });

      await variant.save();

      res.status(201).json({
        type: "success",
        message: "Safe Variant created successfully!",
        data: variant,
      });
    } catch (err) {
      console.error("Error in POST /safe-variant/create:", err);
      cleanupUploadedFiles(req.files);
      res.status(500).json({
        type: "error",
        message: "Server error while saving safe variant.",
      });
    }
  }
);

router.get("/safe-variant/edit", async (req, res) => {
  const { safeVariantId } = req.query;

  // Validate Safe Variant ID
  if (!safeVariantId || !mongoose.Types.ObjectId.isValid(safeVariantId)) {
    return res.render("safe-variant/edit-safe-variant", {
      error: "Invalid Safe Variant ID",
      safeVariant: null,
      safe: null,
      user: req.user,
      safeId: "",
    });
  }

  try {
    // Load Safe Variant
    const safeVariant = await SafeIdVariant.findById(safeVariantId).lean();

    if (!safeVariant) {
      return res.render("safe-variant/edit-safe-variant", {
        error: "Safe Variant not found",
        safeVariant: null,
        safe: null,
        user: req.user,
        safeId: "",
      });
    }

    // Load its parent SafeId
    const safe = await SafeId.findById(safeVariant.safeId);

    if (!safe) {
      return res.render("safe-variant/edit-safe-variant", {
        error: "Parent Safe ID not found",
        safeVariant: null,
        safe: null,
        user: req.user,
        safeId: "",
      });
    }

    // Ownership check
    if (!safe.createdBy.equals(req.user._id)) {
      return res.render("safe-variant/edit-safe-variant", {
        error: "Access denied",
        safeVariant: null,
        safe: null,
        user: req.user,
        safeId: "",
      });
    }

    // Render Edit Page
    return res.render("safe-variant/edit-safe-variant", {
      error: null,
      safeVariant,
      safe,
      user: req.user,
      safeId: safe._id.toString(), // ⭐ Needed for EJS forms
    });
  } catch (err) {
    console.error("Error in GET /safe-variant/edit:", err);

    return res.render("safe-variant/edit-safe-variant", {
      error: "Server error, please try again later.",
      safeVariant: null,
      safe: null,
      user: req.user,
      safeId: "",
    });
  }
});

router.post(
  "/safe-variant/update/details",
  upload.fields([
    { name: "questionImage", maxCount: 1 },
    { name: "logo", maxCount: 1 },
    { name: "optionsImages" },
  ]),
  async (req, res) => {
    try {
      const {
        safeVariantId,
        safeId,
        question,
        questionDescription,
        questionMessage,
        generalPhoneNumber,
        emergencyPhoneNumber,
        otherPhoneNumber,
        email,
        logoTitle,
        logoDescription,
        logoLink,
        options,
        clearedImages,
        clearedOptions,
        logoMediaProfile = [],
        showSafeIdProfile = false,
        showLogoSection = true,
      } = req.body;

      // ---------------------------
      // ⭐ VALIDATE IDs
      // ---------------------------
      if (
        !mongoose.Types.ObjectId.isValid(safeVariantId) ||
        !mongoose.Types.ObjectId.isValid(safeId)
      ) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({
          type: "error",
          message: "Invalid safeVariantId or safeId",
        });
      }

      // ---------------------------
      // ⭐ LOAD SafeId Variant
      // ---------------------------
      const variant = await SafeIdVariant.findById(safeVariantId);
      if (!variant) {
        cleanupUploadedFiles(req.files);
        return res.status(404).json({
          type: "error",
          message: "Safe Variant not found",
        });
      }

      // ---------------------------
      // ⭐ OWNER CHECK (SafeId)
      // ---------------------------
      const safe = await SafeId.findById(safeId);
      if (!safe || !safe.createdBy.equals(req.user._id)) {
        cleanupUploadedFiles(req.files);
        return res.status(403).json({
          type: "error",
          message: "Access denied",
        });
      }

      // ---------------------------
      // ⭐ PARSE OPTIONS JSON
      // ---------------------------
      let parsedOptions = [];
      try {
        parsedOptions = JSON.parse(options);
      } catch (err) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({
          type: "error",
          message: "Invalid options format",
        });
      }

      if (!Array.isArray(parsedOptions) || parsedOptions.length < 1) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({
          type: "error",
          message: "At least 1 option is required",
        });
      }

      // ---------------------------
      // ⭐ HANDLE CLEARED IMAGE FIELDS
      // ---------------------------
      let cleared = [];
      if (clearedImages) {
        if (Array.isArray(clearedImages))
          cleared = clearedImages.flatMap((c) => c.split(","));
        else if (typeof clearedImages === "string")
          cleared = clearedImages.split(",");
      }

      // ---------------------------
      // ⭐ Base function for updating top-level images
      // ---------------------------
      const handleImageUpdate = (field, uploadedFile) => {
        if (cleared.includes(field)) {
          deleteFileIfExists(variant[field]);
          return null;
        } else if (uploadedFile) {
          deleteFileIfExists(variant[field]);
          return `/questions-image/${uploadedFile.filename}`;
        }
        return variant[field];
      };

      // Main images
      variant.logo = handleImageUpdate("logo", req.files["logo"]?.[0]);
      variant.questionImage = handleImageUpdate(
        "questionImage",
        req.files["questionImage"]?.[0]
      );

      // ---------------------------
      // ⭐ Map uploaded option images by option id
      // ---------------------------
      const files = req.files["optionsImages"] || [];
      const optionIdsRaw = req.body.optionIds || [];

      const optionIds = Array.isArray(optionIdsRaw)
        ? optionIdsRaw
        : [optionIdsRaw];

      const fileByOptionId = new Map();
      files.forEach((file, index) => {
        const id = optionIds[index];
        if (id) fileByOptionId.set(id, file);
      });

      // ---------------------------
      // ⭐ REMOVE FULLY CLEARED OPTIONS
      // ---------------------------
      if (clearedOptions) {
        const removedIds = clearedOptions.split(",");
        removedIds.forEach((id) => {
          const existing = variant.options.find((o) => o._id.toString() === id);
          if (existing && existing.image) deleteFileIfExists(existing.image);
        });

        variant.options = variant.options.filter(
          (o) => !removedIds.includes(o._id.toString())
        );
      }

      // ---------------------------
      // ⭐ FORMAT UPDATED OPTIONS
      // ---------------------------
      const formattedOptions = parsedOptions.map((opt) => {
        let optId =
          opt._id && mongoose.Types.ObjectId.isValid(opt._id)
            ? opt._id
            : new mongoose.Types.ObjectId();

        const existing = variant.options.find(
          (o) => o._id.toString() === optId.toString()
        );

        let oldImage = existing ? existing.image : null;
        let newImage = oldImage;

        // CASE 1: New file uploaded
        if (fileByOptionId.has(opt._id)) {
          if (oldImage && oldImage.startsWith("/questions-image/"))
            deleteFileIfExists(oldImage);

          newImage = `/questions-image/${fileByOptionId.get(opt._id).filename}`;
        }

        // CASE 2: Image cleared
        else if (
          cleared.includes(opt._id) ||
          cleared.includes(`optionImage-${opt._id}`)
        ) {
          if (oldImage && oldImage.startsWith("/questions-image/"))
            deleteFileIfExists(oldImage);

          newImage = null;
        }

        // CASE 3: Uses predefined logo
        else if (
          opt.selectedLogoSrc &&
          opt.selectedLogoSrc.startsWith("/comment-logos/")
        ) {
          if (oldImage && oldImage.startsWith("/questions-image/"))
            deleteFileIfExists(oldImage);

          newImage = opt.selectedLogoSrc.trim();
        }

        // CASE 4: Reusing an existing image reference
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

      // ---------------------------
      // ⭐ UPDATE FIELDS
      // ---------------------------
      variant.question = question?.trim();
      variant.questionDescription = questionDescription?.trim();
      variant.questionMessage = questionMessage?.trim();
      variant.options = formattedOptions;

      variant.logoTitle = logoTitle?.trim() || "";
      variant.logoDescription = logoDescription?.trim() || "";
      variant.logoLink = logoLink?.trim() || "";

      variant.generalPhoneNumber = generalPhoneNumber?.trim() || "";
      variant.emergencyPhoneNumber = emergencyPhoneNumber?.trim() || "";
      variant.otherPhoneNumber = otherPhoneNumber?.trim() || "";
      variant.email = email?.trim() || "";

      variant.showSafeIdProfile =
        showSafeIdProfile === "true" || showSafeIdProfile === true;

      // ---------------------------
      // ⭐ SAVE
      // ---------------------------
      await variant.save();

      res.status(200).json({
        type: "success",
        message: "Safe Variant updated successfully",
        data: variant,
      });
    } catch (err) {
      console.error("Error updating safe variant:", err);
      cleanupUploadedFiles(req.files);
      return res.status(500).json({
        type: "error",
        message: "Server error while updating variant",
      });
    }
  }
);

router.get("/variant/:variantId", async (req, res) => {
  const { variantId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(variantId)) {
    return res.render("dashboardnew", {
      variant: null,
      error: "Invalid SafeIdVariant ID",
      activeSection: "variantDetail",
      user: req.user,
    });
  }

  try {
    // Pagination
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 5;

    // Fetch variant and populate safeId
    const variant = await SafeIdVariant.findById(variantId)
      .populate("safeId", "safeId createdBy")
      .lean();

    if (!variant) {
      return res.render("dashboardnew", {
        variant: null,
        error: "SafeIdVariant not found",
        activeSection: "variantDetail",
        user: req.user,
      });
    }

    // Ownership check
    if (!variant.safeId.createdBy.equals(req.user._id)) {
      return res.render("dashboardnew", {
        variant,
        error: "Access denied",
        activeSection: "variantDetail",
        user: req.user,
      });
    }

    // ✅ Fetch variant's questions/options if stored separately
    const total = variant.questions?.length || 0;
    const variantQuestions = (variant.questions || []).slice(
      skip,
      skip + limit
    );
    const hasMore = skip + variantQuestions.length < total;

    if (req.xhr || req.headers.accept.includes("json")) {
      return res.json({ type: "success", data: variantQuestions, hasMore });
    }

    return res.render("dashboardnew", {
      variant,
      variantQuestions, // replace quizQuestions in template
      hasMore,
      error: null,
      activeSection: "variantDetail",
      user: req.user,
    });
  } catch (err) {
    console.error("Error fetching SafeIdVariant:", err);
    return res.render("dashboardnew", {
      variant: null,
      variantQuestions: null,
      hasMore: false,
      error: "Server error. Please try again later.",
      activeSection: "variantDetail",
      user: req.user,
    });
  }
});

router.get("/safe-variant/:variantId/qr", async (req, res) => {
  try {
    const { variantId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid SafeId Variant ID",
      });
    }

    // Fetch SafeIdVariant + minimal SafeId details
    const variant = await SafeIdVariant.findById(
      variantId,
      "question questionDescription options questionImage questionMessage safeId linkedQRCode"
    )
      .populate("safeId", "safeId createdBy logo logoTitle description link")
      .populate("linkedQRCode")
      .lean();

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "SafeId Variant not found",
      });
    }

    // Get SafeId Id
    const safeId = variant.safeId?._id;

    // Default URL if no QR is linked
    const defaultUrl = `${BASE_URL}/safe-id/safe/variant/${variantId}/play?lang=en`;

    // If no linked QR
    if (!variant.linkedQRCode) {
      return res.status(200).json({
        success: false,
        message: "No linked Magic Code found for this SafeId Variant",
        isNoQrLinked: true,
        url: defaultUrl,
      });
    }

    // Return QR data
    const qr = variant.linkedQRCode;

    return res.json({
      success: true,
      data: {
        type: "safeIdVariant",
        safeId,
        variantId,
        code: qr.code,
        qr: {
          ...qr,
          redirectUrl: `${BASE_URL}/${qr.code}`,
        },
      },
    });
  } catch (err) {
    console.error("Error fetching SafeIdVariant QR details:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

router.post("/safe-variant/:variantId/qr", async (req, res) => {
  try {
    const { variantId } = req.params;

    const {
      backgroundColor,
      qrDotColor,
      lang = "en",
      logo = `/images/logo1.jpg`,
    } = req.body;

    // Validate variant ID
    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid SafeId Variant ID" });
    }

    // Step 1: Fetch Variant + linked QR
    const variant = await SafeIdVariant.findById(variantId)
      .populate("linkedQRCode")
      .lean();

    if (!variant) {
      return res
        .status(404)
        .json({ success: false, message: "SafeId Variant not found" });
    }

    const qr = variant.linkedQRCode || null;

    // Step 2: Build default URL (same pattern as session QR logic)
    const qrUrl = `${BASE_URL}/safe-id/safe/variant/${variantId}/play/?lang=${encodeURIComponent(
      lang
    )}`;

    const defaultUrl = qrUrl;

    // Step 3: No QR linked → return default URL
    if (!qr) {
      return res.status(200).json({
        success: true,
        message: "No linked QR found for this SafeId Variant",
        url: defaultUrl,
      });
    }

    // Step 4: Build updated QR object
    const updatedQR = {
      ...qr,
      url: qrUrl,
      backgroundColor: backgroundColor || qr.backgroundColor,
      qrDotColor: qrDotColor || qr.qrDotColor,
      logo: logo || qr.logo,
      redirectUrl: `${BASE_URL}/${qr.code || qr.qrName}`,
    };

    // Step 5: Save update
    await QRCodeData.findByIdAndUpdate(qr._id, updatedQR, { new: true });

    // Step 6: Send response
    return res.json({
      success: true,
      qr: updatedQR,
    });
  } catch (error) {
    console.error("SafeId Variant QR update error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// POST /safe-id/safe-variant/link-magic-code
router.post("/safe-variant/link-magic-code", async (req, res) => {
  try {
    const userId = req.user?._id;
    const { variantId } = req.query;
    const { qrCodeId } = req.body;
    // Extract style & config same as session QR API
    const {
      backgroundColor,
      qrDotColor,
      type = "safeIdVariant",
      lang = "en",
      logo = `/images/logo1.jpg`,
    } = req.body;

    // 1️⃣ Basic validation
    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized. User not logged in.",
        type: "error",
      });
    }

    if (!variantId || !qrCodeId) {
      return res.status(400).json({
        message: "variantId and qrCodeId are required.",
        type: "error",
      });
    }

    // 2️⃣ Fetch Safe Variant + SafeId
    const variant = await SafeIdVariant.findById(variantId)
      .populate({ path: "safeId", select: "createdBy safeId" })
      .lean();

    if (!variant) {
      return res.status(404).json({
        message: "Safe ID Variant not found.",
        type: "error",
      });
    }

    // 3️⃣ Validate SafeId ownership
    if (
      !variant.safeId ||
      variant.safeId.createdBy.toString() !== userId.toString()
    ) {
      return res.status(403).json({
        message:
          "You are not authorized to link a Magic Code to this Safe ID Variant.",
        type: "error",
      });
    }

    // 4️⃣ Validate QR Code ownership
    const qrCode = await QRCodeData.findById(qrCodeId).select(
      "user_id assignedTo"
    );

    if (!qrCode) {
      return res
        .status(404)
        .json({ message: "QR code not found.", type: "error" });
    }

    const isOwner = qrCode.user_id?.toString() === userId.toString();
    const isAssigned = qrCode.assignedTo?.toString() === userId.toString();

    if (!isOwner && !isAssigned) {
      return res.status(403).json({
        message: "You are not authorized to use this QR code.",
        type: "error",
      });
    }

    // 5️⃣ Unlink QR code from ALL app models
    const AppModelMap = {
      quiz: QuizQuestion,
      voting: VoteQuestion,
      applause: Applause,
      magicscreen: MagicScreen,
      comment: Comment,
      product: Product,
      portfolio: Portfolio,
      brand: Brand,
    };

    await Promise.all([
      // unlink from all SafeIdVariants
      SafeIdVariant.updateMany(
        { linkedQRCode: qrCode._id },
        { $unset: { linkedQRCode: "" } }
      ),

      // unlink from all apps
      ...Object.values(AppModelMap).map((M) =>
        M.updateMany(
          { linkedQRCode: qrCode._id },
          { $unset: { linkedQRCode: "" } }
        )
      ),
    ]);

    // 6️⃣ Build the play URL
    const base = process.env.FRONTEND_URL;
    const playUrl = `${base}/safe-id/safe/variant/${variantId}/play`;

    // 7️⃣ Link QR code to variant + update QR entry
    await Promise.all([
      SafeIdVariant.updateOne(
        { _id: variantId },
        { $set: { linkedQRCode: qrCode._id } }
      ),

      QRCodeData.updateOne(
        { _id: qrCode._id },
        { $set: { type: "url", url: playUrl } }
      ),

      User.updateOne({ _id: userId }, { $set: { showEditOnScan: false } }),
    ]);

    // 8️⃣ Build manage link
    const manageLink = `${base}/safe-id/variant/${variantId}`;

    // 9️⃣ Success
    return res.status(200).json({
      message: "Magic Code linked successfully.",
      type: "success",
      link: manageLink,
    });
  } catch (err) {
    console.error("Error linking Magic Code to Safe Variant:", err);
    return res.status(500).json({
      message: "Internal server error.",
      type: "error",
    });
  }
});

// POST /safe-id/safe-variant/unlink-magic-code
router.post("/safe-variant/unlink-magic-code", async (req, res) => {
  try {
    const userId = req.user?._id;
    const { variantId } = req.query;

    // 1️⃣ Basic Auth Check
    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized. User not logged in.",
        type: "error",
      });
    }

    // 2️⃣ Validate variantId
    if (!variantId) {
      return res.status(400).json({
        message: "variantId is required.",
        type: "error",
      });
    }

    // 3️⃣ Fetch Variant + SafeId
    const variant = await SafeIdVariant.findById(variantId)
      .populate({ path: "safeId", select: "createdBy safeId" })
      .lean();

    if (!variant) {
      return res.status(404).json({
        message: "Safe ID Variant not found.",
        type: "error",
      });
    }

    // 4️⃣ Validate ownership
    if (
      !variant.safeId ||
      variant.safeId.createdBy.toString() !== userId.toString()
    ) {
      return res.status(403).json({
        message:
          "You are not authorized to unlink a Magic Code from this Safe ID Variant.",
        type: "error",
      });
    }

    // 5️⃣ Ensure Variant has linked QR
    if (!variant.linkedQRCode) {
      return res.status(400).json({
        message: "This Safe ID Variant has no linked Magic Code.",
        type: "error",
      });
    }

    const qrCodeId = variant.linkedQRCode;

    // 6️⃣ App model map (same as link)
    const AppModelMap = {
      quiz: QuizQuestion,
      voting: VoteQuestion,
      applause: Applause,
      magicscreen: MagicScreen,
      comment: Comment,
      product: Product,
      portfolio: Portfolio,
      brand: Brand,
    };

    // 7️⃣ Unlink QR from everything it was linked to
    await Promise.all([
      // unlink from all SafeIdVariants
      SafeIdVariant.updateMany(
        { linkedQRCode: qrCodeId },
        { $unset: { linkedQRCode: "" } }
      ),

      // unlink from all app models
      ...Object.values(AppModelMap).map((M) =>
        M.updateMany(
          { linkedQRCode: qrCodeId },
          { $unset: { linkedQRCode: "" } }
        )
      ),
    ]);

    // 8️⃣ Reset QR Code to default
    await QRCodeData.updateOne(
      { _id: qrCodeId },
      {
        $unset: { url: "" },
        $set: { type: "text", text: "Your Message" },
      }
    );

    // 9️⃣ Success
    return res.status(200).json({
      message: "Magic Code unlinked successfully.",
      type: "success",
    });
  } catch (err) {
    console.error("Error unlinking Magic Code from Safe Variant:", err);
    return res.status(500).json({
      message: "Internal server error.",
      type: "error",
    });
  }
});


router.get("/safe/variant/:variantId/play", async (req, res) => {
  try {
    const { variantId } = req.params;

    // Validate Variant ID
    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      return res.render("safe-variant/user-safe-variant", {
        error: "Invalid SafeId Variant ID",
        user: req.user,
        variant: null,
        index: 0,
        total: 0,
        availableCoins: req.user?.walletCoins || 0,
        safeIdUser: null,
      });
    }

    // Fetch SafeIdVariant
    const variant = await SafeIdVariant.findById(variantId)
      .populate("safeId", "createdBy safeId logo logoTitle description link")
      .lean();

    if (!variant) {
      return res.render("safe-variant/user-safe-variant", {
        error: "SafeId Variant not found",
        user: req.user,
        variant: null,
        index: 0,
        total: 0,
        availableCoins: req.user?.walletCoins || 0,
        safeIdUser: null,
      });
    }

    // Fetch SafeId Creator User
    let safeIdUser = null;
    if (variant.safeId?.createdBy) {
      safeIdUser = await User.findById(variant.safeId.createdBy).lean();
    }

    // Pagination (future-proof if multiple variants per SafeId)
    const index =
      req.query.index !== undefined ? parseInt(req.query.index) : 0;

    // Currently only ONE question per variant  
    const questions = [variant];
    const currentQuestion = questions[index] || null;
    const total = questions.length;
    const hasNext = index + 1 < total;

    const availableCoins = req.user?.walletCoins || 0;

    // JSON Mode (for AJAX calls)
    if (req.xhr || req.headers.accept?.includes("json")) {
      return res.json({
        success: true,
        data: currentQuestion,
        currentIndex: index,
        total,
        hasNext,
        safeIdUser,
        availableCoins,
      });
    }

    // Render normal EJS page
    return res.render("safe-variant/user-safe-variant", {
      error: null,
      user: req.user,
      variant: currentQuestion,
      index,
      total,
      hasNext,
      availableCoins,
      safeIdUser,
    });
  } catch (err) {
    console.error("Error loading SafeId Variant play page:", err);

    return res.render("safe-variant/user-safe-variant", {
      error: "Server error. Please try again.",
      user: req.user,
      variant: null,
      index: 0,
      total: 0,
      availableCoins: req.user?.walletCoins || 0,
      safeIdUser: null,
    });
  }
});

module.exports = router;
