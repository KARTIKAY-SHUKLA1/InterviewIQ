const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { handleUpload } = require("../controllers/upload.controller");

// Configure storage — keep original extension
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

// File filter — only allow PDF and audio
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    "application/pdf",
    "audio/mpeg",
    "audio/mp4",
    "audio/wav",
    "audio/webm",
    "audio/ogg",
    "video/mp4",
    "video/webm",
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

// Accept three fields: resume, jobDescription, audio
router.post(
  "/",
  upload.fields([
    { name: "resume", maxCount: 1 },
    { name: "jobDescription", maxCount: 1 },
    { name: "audio", maxCount: 1 },
  ]),
  handleUpload
);

module.exports = router;