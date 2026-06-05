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

export const analyzeInterview = async (resumePath, jobDescriptionPath, audioPath, onProgress) => {
  // Start the job
  const response = await api.post("/api/analyze", {
    resumePath,
    jobDescriptionPath,
    audioPath,
  });

  const { jobId } = response.data;

  // Poll for results
  return new Promise((resolve, reject) => {
    const poll = setInterval(async () => {
      try {
        const statusResponse = await api.get(`/api/analyze/status/${jobId}`);
        const data = statusResponse.data;

        if (onProgress) onProgress(data.stage || "Processing...");

        if (data.status === "done") {
          clearInterval(poll);
          resolve(data);
        } else if (data.status === "error") {
          clearInterval(poll);
          reject(new Error(data.error));
        }
      } catch (err) {
        clearInterval(poll);
        reject(err);
      }
    }, 5000); // Poll every 5 seconds
  });
};

export const sendChatMessage = async (question, sessionId, analysis) => {
  const response = await api.post("/api/chat", {
    question,
    sessionId,
    analysis,
  });
  return response.data;
};