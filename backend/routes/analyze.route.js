const express = require("express");
const router = express.Router();
const { analyzeInterview } = require("../controllers/analyze.controller");

router.post("/", analyzeInterview);

module.exports = router;