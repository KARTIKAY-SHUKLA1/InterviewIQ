const express = require("express");
const router = express.Router();
const { analyzeInterview, getJobStatus } = require("../controllers/analyze.controller");

router.post("/", analyzeInterview);
router.get("/status/:jobId", getJobStatus);

module.exports = router;