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
const tvStationProductApp = require("./routes/tvstationproductapp");
const tvStationPortfolioApp = require("./routes/tvstationportfolioapp");
const tvStationBrandApp = require("./routes/tvstationbrandapp");
const tvStationBroadcaster = require("./routes/tvstationbroadcaster");
const safeIdsRouter = require("./routes/safeId");
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

//Delete This after runing once twice or full working
const User = require("./models/User");
const SafeId = require("./models/SafeId");
const SafeIdVariant = require("./models/SafeIdVariant");
const mongoose = require("mongoose");
const Broadcaster = require("./models/Broadcaster");
const Channel = require("./models/Channel");
//Delete This after running migration

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
app.use("/chat-logos", express.static(path.join(__dirname, "chat-logos")));

app.use(
  "/portfolio-logos",
  express.static(path.join(__dirname, "portfolio-logos"))
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
app.use("/tvstation/product", authMiddleware, tvStationProductApp); // For fourth app magicscreen
app.use("/tvstation/portfolio", authMiddleware, tvStationPortfolioApp); // For fourth app magicscreen
app.use("/tvstation/brand", authMiddleware, tvStationBrandApp); // For brand app
app.use("/tvstation/broadcasters", authMiddleware, tvStationBroadcaster); // For brand app

app.use("/safe-id", authMiddleware, safeIdsRouter); // For brand app

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

// Delete this after completion after all this done on creating user too

async function realMigration() {
  // 1️⃣ Find users who already have SafeIds
  const usersWithSafeIds = await SafeId.distinct("createdBy");

  // 2️⃣ Users missing SafeIds
  const missingUsers = await User.find({
    _id: { $nin: usersWithSafeIds },
  });

  console.log(`Found ${missingUsers.length} users that need SafeId\n`);

  for (const user of missingUsers) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      console.log(`➡ Processing user: ${user._id}`);

      // 3️⃣ Create SafeId inside transaction
      const safeId = await SafeId.create(
        [
          {
            safeId: user.name || `SafeID`,
            createdBy: user._id,
            logo: null,
            logoTitle: "",
            description: "",
            link: "",
          },
        ],
        { session }
      );

      const safeIdDoc = safeId[0];

      // 4️⃣ Base Variant
      const base = {
        safeId: safeIdDoc._id,
        questionDescription: "",
        questionMessage: "",
        questionImage: null,
        options: [{ text: "", description: "", image: null, link: null }],
        showSafeIdProfile: false,
        generalPhoneNumber: "",
        emergencyPhoneNumber: "",
        otherPhoneNumber: "",
        email: "",
      };

      // 5️⃣ Create 4 variants
      const variants = [
        { ...base, question: "Car", questionImage: "/images/icons/car.png" },
        { ...base, question: "Bike", questionImage: "/images/icons/bike.png" },
        {
          ...base,
          question: "School",
          questionImage: "/images/icons/school.png",
        },
        {
          ...base,
          question: "Phone",
          questionImage: "/images/icons/phone.png",
        },
      ];

      await SafeIdVariant.insertMany(variants, { session });

      // 6️⃣ Commit
      await session.commitTransaction();
      session.endSession();

      console.log(`✔ Migration successful for user: ${user._id}\n`);
    } catch (err) {
      // 7️⃣ Rollback
      console.error(`❌ ERROR for user ${user._id}: ROLLING BACK`, err.message);

      await session.abortTransaction();
      session.endSession();
      console.log(`↩ Rolled back user: ${user._id}\n`);
    }
  }

  console.log("🎉 REAL MIGRATION COMPLETED\n");
}

// realMigration();

// CHANGE THIS TRUE/FALSE to run test mode
const TEST_MODE = true; // true = only console logs, false = real update

(async () => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // 1. Find channels with missing/null broadcasterId
    const channels = await Channel.find({
      $or: [{ broadcasterId: { $exists: false } }, { broadcasterId: null }],
    });

    console.log(`Found ${channels.length} channels needing fix`);

    for (const channel of channels) {
      console.log("=======================================");
      console.log("Channel:", channel.channelName);

      // Create broadcaster object (not saved yet)
      const newBroadcasterData = {
        broadcasterName: channel.channelName + " Broadcaster",
        description: `Auto-created broadcaster for channel ${channel.channelName}`,
        createdBy: channel.createdBy,
        link: "",
      };

      if (TEST_MODE) {
        console.log("TEST MODE → Broadcaster to create:", newBroadcasterData);
        console.log("TEST MODE → Channel to update:", channel._id);
        continue; // DO NOT CREATE/UPDATE
      }

      // Actual insert
      const newBroadcaster = await Broadcaster.create([newBroadcasterData], {
        session,
      });

      const broadcasterId = newBroadcaster[0]._id;

      // Update channel
      await Channel.updateOne(
        { _id: channel._id },
        { $set: { broadcasterId } },
        { session }
      );

      console.log(
        `Updated channel ${channel.channelName} → broadcaster ${broadcasterId}`
      );
    }

    if (TEST_MODE) {
      console.log("TEST MODE COMPLETE → NO CHANGES SAVED.");
      await session.abortTransaction(); // just rollback
      session.endSession();
      process.exit(0);
    }

    // If real mode
    await session.commitTransaction();
    session.endSession();
    console.log("✔ REAL MODE COMPLETE → All changes saved.");

    process.exit(0);
  } catch (err) {
    console.error("❌ ERROR:", err);

    // rollback
    await session.abortTransaction();
    session.endSession();

    console.log("❌ TRANSACTION ROLLED BACK.");
  }
})//();
