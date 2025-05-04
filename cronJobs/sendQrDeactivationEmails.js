const mongoose = require("mongoose");
const QRCodeData = require("../models/QRCODEDATA");
const User = require("../models/User");
const SendEmail = require("../Messages/SendEmail");

// Cron Job Function
const sendEmailToAssignedUsers = async () => {
  try {
    const now = new Date(); // Current full date and time

    const sender = {
      email: "textildruckschweiz.com@gmail.com",
      name: "Magic Code - Login Link",
    };

    // 1. Fetch QR codes that are still active and have an activatedUntil field
    const qrCodes = await QRCodeData.find({
      isQrActivated: true,
      activatedUntil: { $exists: true },
    });

    for (const qrCode of qrCodes) {
      if (qrCode.activatedUntil) {
        const activatedUntilDate = new Date(qrCode.activatedUntil);

        // Very accurate comparison of full date + time
        if (activatedUntilDate.getTime() < now.getTime()) {
          if (qrCode.assignedTo) {
            // 2. Find the assigned user
            const assignedUser = await User.findById(qrCode.assignedTo);

            if (assignedUser && assignedUser.email) {
              // 3. Prepare email content
              const subject = `QR Code Deactivated: ${qrCode.qrName}`;

              const htmlContent = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>QR Code Deactivation Notice</title>
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
                  <h2>QR Code Deactivated</h2>
                  <p>Hi ${assignedUser.fullName || "User"},</p>
                  <p>Your assigned QR Code "<strong>${
                    qrCode.qrName
                  }</strong>" has been deactivated on <strong>${activatedUntilDate.toLocaleString()}</strong> because the activation period has expired.</p>
                  <p>If you need a new QR code, please contact us or visit your dashboard for new options.</p>
                  <p class="footer">&copy; 2025 Magic Code | All rights reserved.</p>
                </div>
              </body>
              </html>
              `;

              // 4. Send HTML Email
              SendEmail(sender, assignedUser.email, subject, htmlContent);

              console.log(`Deactivation email sent to ${assignedUser.email}`);

              // OPTIONAL: Deactivate QR code after email is sent
              qrCode.isQrActivated = false;
              qrCode.isFirstActivationFree = false;
              await qrCode.save();
              console.log(`QR Code ${qrCode._id} marked as deactivated.`);
            } else {
              console.log(`Assigned user not found for QR code ${qrCode._id}`);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error in cron job:", error);
  }
};

module.exports = sendEmailToAssignedUsers;
