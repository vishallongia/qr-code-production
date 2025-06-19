const jwt = require("jsonwebtoken");
const User = require("../models/User"); // Replace with your User model
const verifyUser = async (req, res, next) => {
  const token = req.cookies.token;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      if (user) {
        req.user = user;
      }
    } catch (err) {
      console.warn("Optional auth failed:", err.message);
      // Don't stop the request — just continue without req.user
    }
  }

  next(); // Always proceed
};

module.exports = { verifyUser };
