import { useState } from "react";
import { Upload, FileText, Mic, ArrowRight, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
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
      if (!uploadResult.success) throw new Error("Upload failed");

      const analysisResult = await analyzeInterview(
        uploadResult.files.resume.path,
        uploadResult.files.jobDescription.path,
        uploadResult.files.audio.path,
        (s) => setStage(s)
      );

      if (!analysisResult.success) throw new Error("Analysis failed");
      onAnalysisComplete(analysisResult);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
      setStage("");
    }
  };

  const FileCard = ({ label, icon: Icon, accept, file, onChange, color }) => (
    <label className={`
      relative flex flex-col items-center gap-4 p-8 rounded-2xl cursor-pointer
      border-2 border-dashed transition-all duration-300
      ${file
        ? "border-green-500/50 bg-green-500/5"
        : "border-white/10 bg-white/[0.02] hover:border-indigo-500/50 hover:bg-indigo-500/5"
      }
    `}>
      <input type="file" accept={accept} onChange={(e) => onChange(e.target.files[0])} className="hidden" />
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${file ? "bg-green-500/10" : "bg-indigo-500/10"}`}>
        {file ? <CheckCircle size={28} className="text-green-400" /> : <Icon size={28} style={{ color }} />}
      </div>
      <div className="text-center">
        <p className="font-semibold text-white">{label}</p>
        <p className="text-xs text-slate-500 mt-1 break-all max-w-[160px]">
          {file ? file.name : "Click to upload"}
        </p>
      </div>
    </label>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      {/* Hero */}
      <div className="text-center mb-12 max-w-2xl">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs px-4 py-1.5 rounded-full mb-6">
          ✦ AI-Powered Interview Intelligence
        </div>
        <h1 className="text-6xl font-black mb-4 bg-gradient-to-br from-white via-indigo-200 to-purple-400 bg-clip-text text-transparent">
          InterviewIQ
        </h1>
        <p className="text-slate-400 text-lg leading-relaxed">
          Upload your resume, job description, and interview recording.
          Get actionable AI feedback powered by Whisper + Qwen + RAG.
        </p>
      </div>

      {/* Upload Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-3xl mb-8">
        <FileCard label="Resume" icon={FileText} accept=".pdf" file={resume} onChange={setResume} color="#818cf8" />
        <FileCard label="Job Description" icon={Upload} accept=".pdf" file={jobDescription} onChange={setJobDescription} color="#a78bfa" />
        <FileCard label="Interview Recording" icon={Mic} accept="audio/*,video/*" file={audio} onChange={setAudio} color="#c084fc" />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-400 px-5 py-3 rounded-xl mb-4 text-sm max-w-md">
          <AlertTriangle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="w-full max-w-md bg-white/[0.03] border border-white/10 rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 size={20} className="animate-spin text-indigo-400 shrink-0" />
            <p className="text-slate-300 text-sm font-medium">{stage}</p>
          </div>
          <div className="space-y-2">
            {[
              "Uploading files",
              "Transcribing audio with Whisper",
              "Generating embeddings",
              "Storing in Qdrant",
              "Analyzing with Qwen AI",
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  stage.toLowerCase().includes(s.split(" ")[0].toLowerCase())
                    ? "bg-indigo-400"
                    : "bg-white/10"
                }`} />
                {s}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-4">This may take 3-5 minutes for long audio files</p>
        </div>
      )}

      {/* Button */}
      <button
        onClick={handleAnalyze}
        disabled={loading || !resume || !jobDescription || !audio}
        className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-10 py-4 rounded-full text-lg transition-all duration-200 shadow-lg shadow-indigo-500/20"
      >
        {loading ? "Analyzing..." : "Analyze Interview"}
        {!loading && <ArrowRight size={20} />}
      </button>

      {/* Tech Stack */}
      <div className="flex gap-3 flex-wrap justify-center mt-8">
        {["Whisper Large V3", "Qwen 3", "BGE Embeddings", "Qdrant Vector DB", "JarvisLabs GPU"].map((t) => (
          <span key={t} className="text-xs text-slate-500 border border-white/5 bg-white/[0.02] px-3 py-1.5 rounded-full">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
};

export default UploadPage;