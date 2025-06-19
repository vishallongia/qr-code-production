const QRCodeData = require("../models/QRCODEDATA"); // Adjust path if needed

async function updateIsFirstQrFlag() {
  let totalStatusChanges = 0;

  // Step 1: Get distinct user_ids and assignedTo ids
  const userIdsFromUserId = await QRCodeData.distinct("user_id", {
    user_id: { $exists: true },
  });
  const userIdsFromAssignedTo = await QRCodeData.distinct("assignedTo", {
    assignedTo: { $exists: true },
  });

  // Step 2: Merge and deduplicate
  const uniqueUserIds = Array.from(
    new Set([...userIdsFromUserId, ...userIdsFromAssignedTo])
  );

  // Step 3: Process each user
  for (const userId of uniqueUserIds) {
    const qrList = await QRCodeData.find({
      $or: [{ user_id: userId }, { assignedTo: userId }],
    }).sort({ createdAt: 1 });

    if (qrList.length === 0) continue;

    // 🔄 Set isQrActivated: true for all QRs assigned to this user
    await QRCodeData.updateMany(
      { assignedTo: userId },
      { $set: { isQrActivated: true } }
    );

    const oldestQrId = qrList[0]._id;

    const unsetRes = await QRCodeData.updateMany(
      {
        $or: [{ user_id: userId }, { assignedTo: userId }],
        isFirstQr: true,
      },
      { $unset: { isFirstQr: "" } }
    );

    const setRes = await QRCodeData.updateOne(
      { _id: oldestQrId },
      { $set: { isFirstQr: true } }
    );

    const changed = (unsetRes.modifiedCount || 0) + (setRes.modifiedCount || 0);
    totalStatusChanges += changed;

    console.log(
      `✔️ User ${userId} → isFirstQr set on QR ${oldestQrId} | Status changes: ${changed}`
    );
  }

  console.log(
    `\n🎯 Total QRs updated (isFirstQr unset/set): ${totalStatusChanges}`
  );
}

module.exports = {
  updateIsFirstQrFlag,
};
