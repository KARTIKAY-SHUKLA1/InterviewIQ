import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: 600000, // 10 min
});

export const uploadFiles = async (resume, jobDescription, audio) => {
  const formData = new FormData();
  formData.append("resume", resume);
  formData.append("jobDescription", jobDescription);
  formData.append("audio", audio);

  const response = await api.post("/api/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const analyzeInterview = async (resumePath, jobDescriptionPath, audioPath) => {
  const response = await api.post("/api/analyze", {
    resumePath,
    jobDescriptionPath,
    audioPath,
  });
  return response.data;
};

export const sendChatMessage = async (question, sessionId, analysis) => {
  const response = await api.post("/api/chat", {
    question,
    sessionId,
    analysis,
  });
  return response.data;
};