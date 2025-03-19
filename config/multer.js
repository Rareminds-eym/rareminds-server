const multer = require("multer");

// Middleware to handle form data (excluding file uploads)
const upload = multer().none();

module.exports = upload;
