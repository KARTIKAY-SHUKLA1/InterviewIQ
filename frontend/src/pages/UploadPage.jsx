import { useState } from "react";
import { Upload, FileText, Mic, ArrowRight, Loader2, CheckCircle } from "lucide-react";
import { uploadFiles, analyzeInterview } from "../utils/api";

const UploadPage = ({ onAnalysisComplete }) => {
  const [resume, setResume] = useState(null);
  const [jobDescription, setJobDescription] = useState(null);
  const [audio, setAudio] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    if (!resume || !jobDescription || !audio) {
      setError("Please upload all three files.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      setStage("Uploading files...");
      const uploadResult = await uploadFiles(resume, jobDescription, audio);

      if (!uploadResult.success) {
        throw new Error("Upload failed");
      }

      setStage("Transcribing audio with Whisper...");
      await new Promise((r) => setTimeout(r, 1000));

      setStage("Generating embeddings and storing in Qdrant...");
      await new Promise((r) => setTimeout(r, 1000));

      setStage("Analyzing with Qwen AI...");
      const analysisResult = await analyzeInterview(
        uploadResult.files.resume.path,
        uploadResult.files.jobDescription.path,
        uploadResult.files.audio.path
      );

      if (!analysisResult.success) {
        throw new Error("Analysis failed");
      }

      onAnalysisComplete(analysisResult);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
      setStage("");
    }
  };

  const FileUploadBox = ({ label, icon: Icon, accept, file, onChange, color }) => (
    <div className={`upload-box ${file ? "uploaded" : ""}`}>
      <label className="upload-label">
        <input
          type="file"
          accept={accept}
          onChange={(e) => onChange(e.target.files[0])}
          style={{ display: "none" }}
        />
        <div className="upload-icon" style={{ color }}>
          {file ? <CheckCircle size={32} /> : <Icon size={32} />}
        </div>
        <div className="upload-text">
          <strong>{label}</strong>
          <span>{file ? file.name : "Click to upload"}</span>
        </div>
      </label>
    </div>
  );

  return (
    <div className="upload-page">
      <div className="hero">
        <h1>InterviewIQ</h1>
        <p>AI-Powered Interview Intelligence Copilot</p>
        <p className="subtitle">
          Upload your resume, job description, and interview recording. Get
          actionable feedback powered by Whisper + Qwen + RAG.
        </p>
      </div>

      <div className="upload-grid">
        <FileUploadBox
          label="Resume"
          icon={FileText}
          accept=".pdf"
          file={resume}
          onChange={setResume}
          color="#6366f1"
        />
        <FileUploadBox
          label="Job Description"
          icon={Upload}
          accept=".pdf"
          file={jobDescription}
          onChange={setJobDescription}
          color="#8b5cf6"
        />
        <FileUploadBox
          label="Interview Recording"
          icon={Mic}
          accept="audio/*,video/*"
          file={audio}
          onChange={setAudio}
          color="#a855f7"
        />
      </div>

      {error && <div className="error-box">{error}</div>}

      {loading && (
        <div className="loading-box">
          <Loader2 size={24} className="spinner" />
          <span>{stage}</span>
        </div>
      )}

      <button
        className="analyze-btn"
        onClick={handleAnalyze}
        disabled={loading || !resume || !jobDescription || !audio}
      >
        {loading ? "Analyzing..." : "Analyze Interview"}
        {!loading && <ArrowRight size={20} />}
      </button>

      <div className="tech-badges">
        <span>Whisper Large V3</span>
        <span>Qwen 3</span>
        <span>BGE Embeddings</span>
        <span>Qdrant Vector DB</span>
        <span>JarvisLabs GPU</span>
      </div>
    </div>
  );
};

export default UploadPage;