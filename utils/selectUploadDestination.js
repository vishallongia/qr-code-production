const path = require("path");

function addUploadPath(folderName) {
  return (req, res, next) => {
    req.uploadPath = path.join(folderName);
    next();
  };
}

module.exports = { addUploadPath };
