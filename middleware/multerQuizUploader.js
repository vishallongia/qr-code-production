// 📁 middleware/multerQuizUploader.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Get path from request body, default to "questions-image"
    const folder = req.uploadPath || "questions-image";

    // Create the full path relative to current file
    const savePath = path.join(__dirname, `../${folder}`);

    // Create folder if it doesn't exist
    if (!fs.existsSync(savePath)) {
      fs.mkdirSync(savePath, { recursive: true });
    }

    cb(null, savePath);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 5MB
});

function cleanupUploadedFiles(files, folder = "questions-image") {
  if (!files) return;

  Object.values(files)
    .flat()
    .forEach((file) => {
      const filePath = path.join(__dirname, `../${folder}/`, file.filename);
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error("Error deleting file:", filePath, err.message);
        } else {
          console.log("Successfully deleted:", filePath);
        }
      });
    });
}

// Utility: delete single file if exists
function deleteFileIfExists(filePath) {
  if (!filePath) return;

  const fullPath = path.join(__dirname, "..", filePath); // e.g., "/questions-image/filename"

  // Check if file exists
  if (fs.existsSync(fullPath)) {
    fs.unlink(fullPath, (err) => {
      if (err) {
        console.warn("Failed to delete file:", fullPath, err);
      } else {
        console.log("Deleted file successfully:", fullPath);
      }
    });
  } else {
    console.log("File does not exist, nothing to delete:", fullPath);
  }
}

function copyFileToQuestionsImage(sourcePath) {
  if (!sourcePath) return null;

  const fileName = `copy-${Date.now()}-${path.basename(sourcePath)}`;
  const destPath = path.join(__dirname, "../questions-image", fileName);

  try {
    fs.copyFileSync(sourcePath, destPath);
    return `/questions-image/${fileName}`;
  } catch (err) {
    console.error("Error copying file:", err);
    return null;
  }
}
module.exports = {
  upload,
  cleanupUploadedFiles,
  deleteFileIfExists,
  copyFileToQuestionsImage,
};
