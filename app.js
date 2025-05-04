require("dotenv").config(); // Load environment variables
const express = require("express");
const app = express();
const connectDB = require("./db"); // Import the database connection
const indexRouter = require("./routes/index");
const plansPaymentsRouter = require("./routes/plansPayments");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
require("./config/passport"); // Load Passport config
const cron = require("node-cron");
const sendEmailToAssignedUsers = require("./cronJobs/sendQrDeactivationEmails");

connectDB(); //Make Conncetion to Database

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

// Set EJS as the view engine
app.set("view engine", "ejs");

// Use routes from the index.js file
app.use("/", indexRouter);
app.use("/", plansPaymentsRouter); // Handles both plans and payments

// Run every 5 minutes
cron.schedule("*/5 * * * *", () => {
  console.log("Checking for expired QR codes...");
  sendEmailToAssignedUsers();
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
