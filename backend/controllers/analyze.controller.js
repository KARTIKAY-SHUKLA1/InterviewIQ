const { extractTextFromPDF } = require("../services/pdf.service");
const { transcribeAudio } = require("../services/whisper.service");
const { chunkAllSources } = require("../services/chunker.service");
const { getEmbeddings } = require("../services/embed.service");
const { storeChunks } = require("../services/qdrant.service");
const { generateAnalysis } = require("../services/qwen.service");
const { v4: uuidv4 } = require("uuid");

// In-memory job store
const jobs = {};

const analyzeInterview = async (req, res) => {
  try {
    const { resumePath, jobDescriptionPath, audioPath } = req.body;

    if (!resumePath || !jobDescriptionPath || !audioPath) {
      return res.status(400).json({
        success: false,
        message: "Missing file paths.",
      });
    }

    const jobId = uuidv4();
    jobs[jobId] = { status: "processing", stage: "Starting...", result: null, error: null };

    // Return immediately with jobId
    res.status(202).json({ success: true, jobId, status: "processing" });

    // Process in background
    processInBackground(jobId, resumePath, jobDescriptionPath, audioPath);

  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to start analysis", error: error.message });
  }
};

const processInBackground = async (jobId, resumePath, jobDescriptionPath, audioPath) => {
  try {
    jobs[jobId].stage = "Extracting text from PDFs...";
    const [resumeResult, jdResult, transcriptResult] = await Promise.all([
      extractTextFromPDF(resumePath),
      extractTextFromPDF(jobDescriptionPath),
      transcribeAudio(audioPath),
    ]);

    if (!resumeResult.success) throw new Error("Resume parse failed");
    if (!jdResult.success) throw new Error("JD parse failed");
    if (!transcriptResult.success) throw new Error("Transcription failed");

    jobs[jobId].stage = "Generating embeddings...";
    const chunks = chunkAllSources(resumeResult.text, jdResult.text, transcriptResult.transcript);
    const embeddings = await getEmbeddings(chunks.map(c => c.text));

    jobs[jobId].stage = "Storing in vector database...";
    const sessionId = uuidv4();
    let qdrantStored = false;
    if (process.env.QDRANT_URL) {
      await storeChunks(chunks, embeddings, sessionId);
      qdrantStored = true;
    }

    jobs[jobId].stage = "Generating AI analysis...";
    const analysis = await generateAnalysis(resumeResult.text, jdResult.text, transcriptResult.transcript);

    jobs[jobId] = {
      status: "done",
      stage: "Complete",
      result: {
        success: true,
        sessionId,
        pipeline: {
          resumeWords: resumeResult.wordCount,
          jdWords: jdResult.wordCount,
          transcriptLength: transcriptResult.transcript.length,
          chunksCreated: chunks.length,
          embeddingsGenerated: embeddings.length,
          qdrantStored,
          transcriptIsStub: transcriptResult.isStub,
        },
        analysis,
      },
      error: null,
    };

  } catch (error) {
    console.error("Background processing error:", error);
    jobs[jobId] = { status: "error", stage: "Failed", result: null, error: error.message };
  }
};

const getJobStatus = (req, res) => {
  const { jobId } = req.params;
  const job = jobs[jobId];

  if (!job) {
    return res.status(404).json({ success: false, message: "Job not found" });
  }

  if (job.status === "done") {
    return res.status(200).json({ status: "done", ...job.result });
  }

  if (job.status === "error") {
    return res.status(500).json({ status: "error", error: job.error });
  }

  return res.status(200).json({ status: "processing", stage: job.stage });
};

module.exports = { analyzeInterview, getJobStatus };