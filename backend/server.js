const express = require("express");
const cors = require("cors");
require("dotenv").config();

const uploadRoutes = require("./routes/upload.route");
const analyzeRoutes = require("./routes/analyze.route");
const chatRoutes = require("./routes/chat.route");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/upload", uploadRoutes);
app.use("/api/analyze", analyzeRoutes);
app.use("/api/chat", chatRoutes);

app.get("/", (req, res) => {
  res.send("InterviewIQ Backend Running");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});