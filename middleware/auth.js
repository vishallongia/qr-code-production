const jwt = require("jsonwebtoken");
const User = require("../models/User"); // Replace with your User model
// ✅ List of routes that don't need authentication
const PUBLIC_PLAY_ROUTES = [
  "quiz-play",
  "voting-play",
  "applause-play",
  "magicscreen-play",
  "comment-play",
  "product-play",
  "portfolio-play",
  "magic-screen-response",
  "quiz-viewed",
  "comment-response",
  "product-response",
  "brand-play",
  "brand-response",
  "play"
  // add more like "reaction-play", "buzzer-play" later
];

const authMiddleware = async (req, res, next) => {
  try {
    // Get the token from cookies
    const token = req.cookies.token;
    const path = req.path.toLowerCase();

    if (!token) {
      const pathSegments = path.split("/").filter(Boolean);
      const lastSegment = pathSegments[pathSegments.length - 1] || "";

      // ✅ Allow only if the last segment exactly matches a public route
      if (PUBLIC_PLAY_ROUTES.includes(lastSegment)) {
        return next();
      }
    }


    if (!token && req.path !== "/") {
      return handleAuthError(req, res, "Token is missing. Please log in.");
    }

    if (token) {
      // Decode the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Find the user in the database
      const user = await User.findById(decoded.userId);
      if (!user) {
        return handleAuthError(res, "User not found. Please log in.");
      }

      req.user = user;
      if (
        (req.path.includes("/admindashboard") ||
          req.originalUrl.includes("/admindashboard")) &&
        user.role !== "admin"
      ) {
        return handleAuthError(req, res, "Access denied. Admins only.");
      }

      if (req.path === "/" && user.role === "admin") {
        return res.redirect("/admindashboard");
      }

      if (req.path === "/" && user.role === "affiliate") {
        return res.redirect("/magiccode");
      }

      // If the user is authenticated and requests the "/" path (SSR), redirect to "/magiccode"
      if (req.path === "/" && req.user) {
        return res.redirect("/magiccode");
      }
    }

    // Proceed to the next middleware or route handler
    next();
  } catch (error) {
    console.error("Token verification failed:", error.message);

    // Handle specific JWT errors (e.g., expired token)
    if (error.name === "TokenExpiredError") {
      return handleAuthError(req, res, "Token expired. Please log in again.");
    } else if (error.name === "JsonWebTokenError") {
      return handleAuthError(req, res, "Invalid token. Please log in again.");
    } else {
      return handleAuthError(req, res, "Authentication error. Please log in.");
    }
  }
};

// Utility function to handle different types of errors based on request type
function handleAuthError(req, res, message) {
  const responseMessage = {
    message: message,
    type: "error",
  };

  // Check if the request expects HTML or JSON
  const acceptHeader = req.headers.accept || ""; // Ensure this doesn't break if accept header is missing
  if (acceptHeader.includes("text/html")) {
    // If it's an SSR request, render the login page (or another appropriate page)
    return res.status(401).render("login", responseMessage);
  } else {
    // If it's an API request, respond with JSON
    return res.status(401).json(responseMessage);
  }
}

module.exports = { authMiddleware, handleAuthError };
