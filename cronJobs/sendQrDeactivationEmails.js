const mongoose = require("mongoose");
const QRCodeData = require("../models/QRCODEDATA");
const User = require("../models/User");
const SendEmail = require("../Messages/SendEmail");
const Payment = require("../models/Payment");

const sendExpiryEmailForPayments = async () => {
  try {
    const now = new Date();

    const sender = {
      email: "textildruckschweiz.com@gmail.com",
      name: "Magic Code - Plan Update",
    };

    // Step 1: Get all users who have at least one payment
    const userIdsWithPayments = await Payment.distinct("user_id");

    for (const userId of userIdsWithPayments) {
      // Step 2: Deactivate expired plans for this user
      await Payment.updateMany(
        { user_id: userId, validUntil: { $lt: now } },
        { $set: { isActive: false } }
      );

      // Step 3: Find the latest valid (non-expired) plan
      const latestValidPlan = await Payment.findOne({
        user_id: userId,
        validUntil: { $gte: now },
      })
        .sort({ validUntil: -1 })
        .exec();

      if (!latestValidPlan) {
        // Step 5: No active plan found — notify user

        // Fetch the user
        const user = await User.findById(userId);

        if (user && user.email) {
          const lastSent = user.lastExpiryEmailSent;
          const hoursSinceLastSent = lastSent
            ? (now - new Date(lastSent)) / (1000 * 60 * 60)
            : Infinity;

          if (hoursSinceLastSent < 24) {
            console.log(`Email already sent recently to ${user.email}`);
            continue;
          }

          // Get the most recent expired plan for date reference
          const lastExpiredPlan = await Payment.findOne({
            user_id: userId,
            validUntil: { $lt: now },
          }).sort({ validUntil: -1 });

          const expiredDate =
            lastExpiredPlan?.validUntil?.toLocaleString() || "recently";
          const subject = "Your Plan Has Expired";

          const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Plan Expired</title>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  background-color: #f4f4f4;
                  margin: 0;
                  padding: 0;
                }
                .container {
                  max-width: 600px;
                  margin: 30px auto;
                  background: #ffffff;
                  padding: 20px;
                  border-radius: 10px;
                  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                  text-align: center;
                }
                h2 {
                  color: #333;
                }
                p {
                  color: #555;
                  font-size: 16px;
                  line-height: 1.5;
                }
                .footer {
                  margin-top: 20px;
                  font-size: 14px;
                  color: #888;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h2>Your Subscription Plan Expired</h2>
                <p>Hi ${user.fullName || "User"},</p>
                <p>Your subscription plan has expired as of <strong>${expiredDate}</strong>.</p>
                <p>Please renew or purchase a new plan to continue enjoying our services.</p>
                <p class="footer">&copy; 2025 Magic Code | All rights reserved.</p>
              </div>
            </body>
            </html>
          `;

          // Send the email
          SendEmail(sender, user.email, subject, htmlContent);
          console.log(`Expiry email sent to ${user.email}`);
          // ✅ Update timestamp after sending
          user.lastExpiryEmailSent = now;
          await user.save();
        }
      }
    }
  } catch (error) {
    console.error("Error in payment plan cron job:", error);
  }
};

module.exports = sendExpiryEmailForPayments;
