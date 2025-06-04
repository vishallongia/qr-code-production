const express = require("express");
const router = express.Router();
const QRCodeData = require("../models/QRCODEDATA");
const { authMiddleware } = require("../middleware/auth");
const SendEmail = require("../Messages/SendEmail");

module.exports = router;
