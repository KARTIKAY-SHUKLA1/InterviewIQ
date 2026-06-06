const { extractTextFromPDF } = require("../services/pdf.service");
const { transcribeAudio } = require("../services/whisper.service");
const { chunkAllSources } = require("../services/chunker.service");
const { getEmbeddings } = require("../services/embed.service");
const { storeChunks } = require("../services/qdrant.service");
const { generateAnalysis } = require("../services/qwen.service");
const { v4: uuidv4 } = require("uuid");

// In-memory job store
const jobs = {};

// Calculate scores deterministically instead of trusting Qwen
const calculateScores = (analysis) => {
  try {
    // Match score — how many JD required skills appear in candidate skills
    const required = analysis.skillGap.requiredSkills.map((s) =>
      s.toLowerCase().trim()
    );
    const candidate = analysis.skillGap.candidateSkills.map((s) =>
      s.toLowerCase().trim()
    );

    const matched = required.filter((skill) =>
      candidate.some(
        (cs) =>
          cs.includes(skill) ||
          skill.includes(cs) ||
          cs.split(" ").some((word) => skill.includes(word) && word.length > 3)
      )
    ).length;

    const matchScore =
      required.length > 0
        ? Math.min(100, Math.round((matched / required.length) * 100))
        : 70;

    // Fix missing skills — remove any that appear in candidate skills
    const missingSkills = analysis.skillGap.requiredSkills.filter((skill) => {
      const skillLower = skill.toLowerCase().trim();
      return !candidate.some(
        (cs) =>
          cs.includes(skillLower) ||
          skillLower.includes(cs) ||
          cs.split(" ").some(
            (word) => skillLower.includes(word) && word.length > 3
          )
      );
    });

    // Performance score — ratio of strong to total answers
    const strong = analysis.performance.strongAnswers.length;
    const weak = analysis.performance.weakAnswers.length;
    const total = strong + weak;
    const performanceScore =
      total > 0 ? Math.round((strong / total) * 100) : 50;

    // Overall score — weighted combination
    const overallScore = Math.round(
      matchScore * 0.4 + performanceScore * 0.6
    );

    return {
      ...analysis,
      skillGap: {
        ...analysis.skillGap,
        matchScore,
        missingSkills,
      },
      performance: {
        ...analysis.performance,
        overallScore,
        scoreBreakdown: {
          skillMatch: matchScore,
          performanceRatio: performanceScore,
          formula: "40% skill match + 60% answer performance ratio",
        },
      },
    };
  } catch (error) {
    console.error("Score calculation error:", error.message);
    return analysis;
  }
};

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
    jobs[jobId] = {
      status: "processing",
      stage: "Starting...",
      result: null,
      error: null,
    };

    // Return immediately with jobId
    res.status(202).json({ success: true, jobId, status: "processing" });

    // Process in background
    processInBackground(jobId, resumePath, jobDescriptionPath, audioPath);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to start analysis",
      error: error.message,
    });
  }
};

const processInBackground = async (
  jobId,
  resumePath,
  jobDescriptionPath,
  audioPath
) => {
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
    const chunks = chunkAllSources(
      resumeResult.text,
      jdResult.text,
      transcriptResult.transcript
    );
    const embeddings = await getEmbeddings(chunks.map((c) => c.text));

    jobs[jobId].stage = "Storing in vector database...";
    const sessionId = uuidv4();
    let qdrantStored = false;
    if (process.env.QDRANT_URL) {
      await storeChunks(chunks, embeddings, sessionId);
      qdrantStored = true;
    }

    jobs[jobId].stage = "Generating AI analysis...";
    const rawAnalysis = await generateAnalysis(
      resumeResult.text,
      jdResult.text,
      transcriptResult.transcript
    );

    // Calculate scores deterministically
    const analysis = calculateScores(rawAnalysis);

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
    jobs[jobId] = {
      status: "error",
      stage: "Failed",
      result: null,
      error: error.message,
    };
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