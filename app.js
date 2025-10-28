require("dotenv").config(); // Load environment variables
const express = require("express");
const app = express();
const connectDB = require("./db"); // Import the database connection
const indexRouter = require("./routes/index");
const plansPaymentsRouter = require("./routes/plansPayments");
const affiliateUserRouter = require("./routes/affiliate");
const tvStationAdminRouter = require("./routes/tvstationadmin");
const tvStationUserRouter = require("./routes/tvstationuser");
const tvStationApplauseApp = require("./routes/tvstationapplauseapp");
const tvStationMagicScreenApp = require("./routes/tvstationmagicscreenapp");
const tvStationCommentApp = require("./routes/tvstationcommentapp");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
require("./config/passport"); // Load Passport config
const cron = require("node-cron");
const sendExpiryEmailForPayments = require("./cronJobs/sendQrDeactivationEmails");
const { authMiddleware } = require("./middleware/auth");
const { updateIsFirstQrFlag } = require("./utils/qrUtils");

connectDB(); //Make Conncetion to Database

async function updateIsFirstQrFlagFn() {
  await updateIsFirstQrFlag();
}

//updateIsFirstQrFlagFn();

// 💡 REGISTER RAW PARSER ROUTE FIRST — BEFORE global JSON body parser
app.use("/paypalwh", require("./routes/paypalWebhook"));

app.use("/stripe", require("./routes/stripeWebhook")); // Adjust path if needed

// Middleware for parsing request bodies
app.use(bodyParser.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
app.use(bodyParser.json()); // For parsing application/json
app.use(cookieParser());

// Session middleware
app.use(
  session({
    secret: "your_secret_key", // Change this to a strong secret
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Serve static files
app.use(
  "/css",
  express.static(path.join(__dirname, "node_modules/bootstrap/dist/css"))
);
app.use(
  "/js",
  express.static(path.join(__dirname, "node_modules/bootstrap/dist/js"))
);

// Serve static files from the public directory
app.use(express.static("public"));
// app.use(express.static("qr_images"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/logos", express.static(path.join(__dirname, "logos")));
app.use(
  "/comment-logos",
  express.static(path.join(__dirname, "comment-logos"))
);
app.use(
  "/questions-image",
  express.static(path.join(__dirname, "questions-image"))
);

// Set EJS as the view engine
app.set("view engine", "ejs");

// Use routes from the index.js file
app.use("/", indexRouter);
app.use("/", plansPaymentsRouter); // Handles both plans and payments
app.use("/admindashboard/affiliate", authMiddleware, affiliateUserRouter);
app.use("/admindashboard/tvstation", authMiddleware, tvStationAdminRouter);
app.use("/tvstation", authMiddleware, tvStationUserRouter); // It contains mixed code of voting and quiz
app.use("/tvstation/applause", authMiddleware, tvStationApplauseApp); // For third app applause
app.use("/tvstation/magicscreen", authMiddleware, tvStationMagicScreenApp); // For fourth app magicscreen
app.use("/tvstation/comment", authMiddleware, tvStationCommentApp); // For fourth app magicscreen

// 404 Handler
app.use((req, res) => {
  res.status(404).render("404main");
});

// Run every 5 minutes
cron.schedule("*/5 * * * *", () => {
  sendExpiryEmailForPayments();
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
