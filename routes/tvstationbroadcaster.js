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
const Broadcaster = require("../models/Broadcaster");
const User = require("../models/User");
const Brand = require("../models/Brand");
const BrandResponse = require("../models/BrandResponse");
const QRCodeData = require("../models/QRCODEDATA"); // adjust path as needed
const QRScanLog = require("../models/QRScanLog"); // Adjust path if needed
const Session = require("../models/Session"); // adjust path if needed
const { cascadeDelete } = require("../utils/cascadeDelete"); // adjust path
const fs = require("fs");
const path = require("path");
const { addUploadPath } = require("../utils/selectUploadDestination");

router.get("/list", async (req, res) => {
  try {
    const filter = { createdBy: req.user._id };
    const page = parseInt(req.query.page) || 1;
    const perPage = Number(process.env.USER_PER_PAGE) || 10;
    const skip = (page - 1) * perPage;

    const totalBroadcasters = await Broadcaster.countDocuments(filter);
    const totalPages = Math.ceil(totalBroadcasters / perPage);

    const broadcasters = await Broadcaster.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)
      .lean();

    res.render("dashboardnew", {
      activeSection: "broadcaster",
      broadcasters,
      currentPage: page,
      totalPages,
      totalBroadcasters,
      user: req.user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).render("dashboardnew", {
      message: "Server Error",
      type: "error",
      activeSection: "broadcaster",
      broadcasters: [],
    });
  }
});

router.post(
  "/create-broadcaster",
  addUploadPath("uploads"),
  upload.fields([{ name: "logo", maxCount: 1 }]),
  async (req, res) => {
    try {
      const user = req.user;
      const { name, description, link, logoTitle } = req.body;

      if (!name || !name.trim()) {
        cleanupUploadedFiles(req.files, "uploads");
        return res
          .status(400)
          .json({ message: "Broadcaster name is required", type: "error" });
      }

      const duplicate = await Broadcaster.findOne({
        name: new RegExp(`^${name.trim()}$`, "i"),
        createdBy: user._id,
      });

      if (duplicate) {
        cleanupUploadedFiles(req.files, "uploads");
        return res
          .status(400)
          .json({ message: "Broadcaster already exists", type: "error" });
      }

      const logoFile = req.files["logo"]?.[0];
      const logoPath = logoFile ? `/uploads/${logoFile.filename}` : null;

      const newBroadcaster = await Broadcaster.create({
        broadcasterName: name.trim(),
        createdBy: user._id,
        logo: logoPath,
        description: description?.trim() || "",
        link: link?.trim() || "",
        logoTitle: logoTitle?.trim() || "",
      });

      res.status(201).json({
        message: "Broadcaster created successfully",
        type: "success",
        broadcaster: newBroadcaster,
      });
    } catch (err) {
      console.error("Error creating broadcaster:", err);
      cleanupUploadedFiles(req.files, "uploads");
      res.status(500).json({ message: "Server error", type: "error" });
    }
  }
);

router.put(
  "/update-broadcaster/:id",
  addUploadPath("uploads"),
  upload.fields([{ name: "logo", maxCount: 1 }]),
  async (req, res) => {
    try {
      const broadcasterId = req.params.id;
      const user = req.user;

      const { name, description, link, logoTitle, removeLogo } = req.body;

      if (!name || typeof name !== "string" || !name.trim()) {
        cleanupUploadedFiles(req.files, "uploads");
        return res.status(400).json({
          message: "Broadcaster name is required",
          type: "error",
        });
      }

      const updatedName = name.trim();

      // Fetch broadcaster
      const broadcaster = await Broadcaster.findById(broadcasterId);
      if (!broadcaster) {
        cleanupUploadedFiles(req.files, "uploads");
        return res.status(404).json({
          message: "Broadcaster not found",
          type: "error",
        });
      }

      // Authorization check
      if (!broadcaster.createdBy.equals(user._id)) {
        cleanupUploadedFiles(req.files, "uploads");
        return res.status(403).json({
          message: "You are not authorized to edit this broadcaster",
          type: "error",
        });
      }

      // Duplicate check
      const duplicate = await Broadcaster.findOne({
        _id: { $ne: broadcasterId },
        name: new RegExp(`^${updatedName}$`, "i"),
        createdBy: user._id,
      });

      if (duplicate) {
        cleanupUploadedFiles(req.files, "uploads");
        return res.status(400).json({
          message: "Another broadcaster with this name already exists",
          type: "error",
        });
      }

      // Handle logo change/remove
      const newLogoFile = req.files["logo"]?.[0];
      const shouldRemoveLogo = removeLogo === "true";
      let logoPath = broadcaster.logo;

      // Replace new logo
      if (newLogoFile) {
        if (broadcaster.logo) deleteFileIfExists(broadcaster.logo);
        logoPath = `/uploads/${newLogoFile.filename}`;
      }
      // Remove existing logo
      else if (shouldRemoveLogo && broadcaster.logo) {
        deleteFileIfExists(broadcaster.logo);
        logoPath = null;
      }

      // Update fields
      broadcaster.broadcasterName = updatedName;
      broadcaster.logo = logoPath;
      broadcaster.description = description?.trim() || "";
      broadcaster.link = link?.trim() || "";
      broadcaster.logoTitle = logoTitle?.trim() || "";

      await broadcaster.save();

      return res.status(200).json({
        message: "Broadcaster updated successfully",
        type: "success",
        broadcaster,
      });
    } catch (err) {
      console.error("Error updating broadcaster:", err);
      cleanupUploadedFiles(req.files, "uploads");
      return res.status(500).json({
        message: "Internal server error while updating broadcaster",
        type: "error",
      });
    }
  }
);


router.delete("/:id", async (req, res) => {
  try {
    const broadcasterId = req.params.id;
    const user = req.user;

    if (!broadcasterId) {
      return res.status(400).json({
        message: "Broadcaster ID is required",
        type: "error",
      });
    }

    // Check if broadcaster exists
    const broadcaster = await Broadcaster.findById(broadcasterId);

    if (!broadcaster) {
      return res.status(404).json({
        message: "Broadcaster not found",
        type: "error",
      });
    }

    // Authorization: Only creator or admin can delete
    if (!broadcaster.createdBy.equals(user._id) && user.role !== "admin") {
      return res.status(403).json({
        message: "You are not authorized to delete this broadcaster",
        type: "error",
      });
    }

    // Cascade delete if needed: programs, channels, etc
    // await Broadcaster.findByIdAndDelete(broadcasterId);
    await cascadeDelete("broadcaster", broadcasterId);

    return res.status(200).json({
      message: "Broadcaster deleted successfully",
      type: "success",
    });

  } catch (err) {
    console.error("Error deleting broadcaster:", err.message);
    return res.status(500).json({
      message: "Internal server error while deleting broadcaster",
      type: "error",
    });
  }
});


module.exports = router;
