const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

const transcribeAudio = async (filePath) => {
  if (!process.env.WHISPER_API_URL) {
    console.log("⚠️  Whisper stub mode");
    return {
      success: true,
      transcript: `[STUB] Placeholder transcript for: ${path.basename(filePath)}.
      The candidate discussed React and Node.js experience.
      When asked about Docker, the candidate said they had limited experience.
      The interviewer asked about system design and the candidate gave a basic answer.`,
      language: "en",
      isStub: true,
    };
  }

  try {
    const form = new FormData();
    form.append("audio", fs.createReadStream(filePath));

    const response = await axios.post(
      `${process.env.WHISPER_API_URL}/transcribe`,
      form,
      {
        headers: form.getHeaders(),
        timeout: 300000,
      }
    );

    return {
      success: true,
      transcript: response.data.transcript,
      language: response.data.language || "en",
      isStub: false,
    };
  } catch (error) {
    console.error("Whisper error:", error.message);
    return {
      success: false,
      error: error.message,
      transcript: "",
    };
  }
};

module.exports = { transcribeAudio };