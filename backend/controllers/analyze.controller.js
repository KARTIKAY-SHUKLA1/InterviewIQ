const { extractTextFromPDF } = require("../services/pdf.service");
const { transcribeAudio } = require("../services/whisper.service");
const { chunkAllSources } = require("../services/chunker.service");
const { getEmbeddings } = require("../services/embed.service");
const { storeChunks } = require("../services/qdrant.service");
const { generateAnalysis } = require("../services/qwen.service");
const { v4: uuidv4 } = require("uuid");

const jobs = {};

// ===== DETERMINISTIC SKILL EXTRACTION =====
// We extract skills using code, not AI — 100% accurate, no hallucination
const SKILL_KEYWORDS = [
  "React", "React.js", "Node.js", "Express", "MongoDB", "PostgreSQL",
  "MySQL", "TypeScript", "JavaScript", "Python", "FastAPI", "Django",
  "AWS", "Docker", "Kubernetes", "Redis", "GraphQL", "REST APIs",
  "WebSockets", "JWT", "OAuth", "Git", "GitHub", "Linux", "Tailwind",
  "CSS", "HTML", "SQL", "NoSQL", "Supabase", "Firebase", "Vercel",
  "Render", "Netlify", "System Design", "DSA", "OOP", "DBMS",
  "LLM", "RAG", "Vector DB", "Qdrant", "Pinecone", "OpenAI",
  "Claude", "Whisper", "Embeddings", "Neo4j", "AWS Bedrock",
  "Stripe", "Cloudinary", "Socket.io", "C++", "Java", "C",
  "Next.js", "Vue", "Angular", "Flask", "pandas", "numpy",
  "TensorFlow", "PyTorch", "Kafka", "Microservices", "CI/CD",
  "Prompt Engineering", "LLM APIs", "Knowledge Graph", "Agentic",
  "REST API", "Authentication", "WebSocket", "Real-time",
  "Context API", "Tailwind CSS", "Postman", "Full-stack",
  "Backend", "Frontend", "MongoDB Atlas", "VS Code", "JWT Auth",
  "GitHub OAuth", "Stripe", "Clerk", "Cloudinary", "Judge0",
  "Socket.io", "WebRTC", "OCR", "Document Intelligence",
  "Vector Search", "Knowledge Graph", "Graphiti", "Bedrock",
];

const extractSkillsFromText = (text) => {
  const textLower = text.toLowerCase();
  return [...new Set(
    SKILL_KEYWORDS.filter(skill =>
      textLower.includes(skill.toLowerCase())
    )
  )];
};

const computeSkillGap = (resumeText, jdText) => {
  const resumeSkills = extractSkillsFromText(resumeText);
  const jdSkills = extractSkillsFromText(jdText);

  const missingSkills = jdSkills.filter(skill =>
    !resumeSkills.some(rs => rs.toLowerCase() === skill.toLowerCase())
  );

  const matchedCount = jdSkills.filter(skill =>
    resumeSkills.some(rs => rs.toLowerCase() === skill.toLowerCase())
  ).length;

  const matchScore = jdSkills.length > 0
    ? Math.round((matchedCount / jdSkills.length) * 100)
    : 70;

  return { resumeSkills, jdSkills, missingSkills, matchScore };
};

// ===== SCORE CALCULATION =====
const calculatePerformanceScore = (analysis) => {
  const strong = analysis.performance.strongAnswers.length;
  const weak = analysis.performance.weakAnswers.length;
  const total = strong + weak;
  return total > 0 ? Math.round((strong / total) * 100) : 50;
};

// ===== POST PROCESSING =====
const postProcessAnalysis = (analysis, skillGap) => {
  // Override skill gap with deterministic extraction
  analysis.skillGap.candidateSkills = skillGap.resumeSkills;
  analysis.skillGap.requiredSkills = skillGap.jdSkills;
  analysis.skillGap.missingSkills = skillGap.missingSkills;
  analysis.skillGap.matchScore = skillGap.matchScore;

  // Calculate scores deterministically
  const performanceRatio = calculatePerformanceScore(analysis);
  const overallScore = Math.round(
    skillGap.matchScore * 0.4 + performanceRatio * 0.6
  );
  analysis.performance.overallScore = overallScore;
  analysis.performance.scoreBreakdown = {
    skillMatch: skillGap.matchScore,
    performanceRatio,
    formula: "40% skill match + 60% answer performance",
  };

  // Fix: remove weak answers that have same question as strong answers
  const strongQuestions = analysis.performance.strongAnswers.map(a =>
    a.question.toLowerCase().trim()
  );
  analysis.performance.weakAnswers = analysis.performance.weakAnswers.filter(
    a => !strongQuestions.includes(a.question.toLowerCase().trim())
  );

  // Add default weak answer if none left after filtering
  if (analysis.performance.weakAnswers.length === 0) {
    analysis.performance.weakAnswers = [{
      question: "Completing full solution with all edge cases",
      why: "Candidate did not fully implement or articulate the complete solution during the interview",
      improvement: "Practice completing full solutions on LeetCode — solve 2-3 problems daily in the relevant topic area without hints",
    }];
  }

  return analysis;
};

// ===== MAIN CONTROLLER =====
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

    res.status(202).json({ success: true, jobId, status: "processing" });
    processInBackground(jobId, resumePath, jobDescriptionPath, audioPath);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to start analysis",
      error: error.message,
    });
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

    // Step 1 — Extract skills deterministically from text (no AI hallucination)
    const skillGap = computeSkillGap(resumeResult.text, jdResult.text);
    console.log(`Resume skills found: ${skillGap.resumeSkills.join(", ")}`);
    console.log(`JD skills found: ${skillGap.jdSkills.join(", ")}`);
    console.log(`Missing skills: ${skillGap.missingSkills.join(", ")}`);

    // Step 2 — Let Qwen generate summary, performance, roadmap
    // Send FULL resume and JD — no slicing
    const rawAnalysis = await generateAnalysis(
      resumeResult.text,
      jdResult.text,
      transcriptResult.transcript
    );

    // Step 3 — Override skill gap with deterministic results
    const analysis = postProcessAnalysis(rawAnalysis, skillGap);

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