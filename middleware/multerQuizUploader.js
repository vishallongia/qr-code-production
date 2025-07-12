// 📁 middleware/multerQuizUploader.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "../questions-image");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Helper to delete uploaded files
function cleanupUploadedFiles(files) {
  if (!files) return;

  Object.values(files)
    .flat()
    .forEach((file) => {
      const filePath = path.join(
        __dirname,
        "../questions-image/",
        file.filename
      );
      fs.unlink(filePath, (err) => {
        if (err) console.error("Error deleting file:", filePath, err.message);
      });
    });
}

// Utility: delete single file if exists
function deleteFileIfExists(filePath) {
  if (!filePath) return;
  const fullPath = path.join(__dirname, "..", filePath); // assuming "/questions-image/filename"
  fs.unlink(fullPath, (err) => {
    if (err) console.warn("Failed to delete file:", fullPath);
  });
}




module.exports = { upload, cleanupUploadedFiles,deleteFileIfExists};
