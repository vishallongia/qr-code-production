const express = require("express");
const router = express.Router();
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const User = require("../models/User");
const QRCodeData = require("../models/QRCODEDATA"); // adjust path as needed
const QRScanLog = require("../models/QRScanLog"); // Adjust path if needed
const {
  upload,
  cleanupUploadedFiles,
  deleteFileIfExists,
} = require("../middleware/multerQuizUploader");

const SafeId = require("../models/SafeId");
const SafeIdVariant = require("../models/SafeIdVariant");
const { addUploadPath } = require("../utils/selectUploadDestination");

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

      { $sort: { createdAt: -1 } }
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

      // Allowed profile toggles
      const allowedProfiles = ["broadcaster", "project", "episode", "custom"];
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
        logoMediaProfile: logoProfiles,

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

module.exports = router;
