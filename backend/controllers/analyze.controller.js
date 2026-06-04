const { extractTextFromPDF } = require("../services/pdf.service");
const { transcribeAudio } = require("../services/whisper.service");
const { chunkAllSources } = require("../services/chunker.service");
const { getEmbeddings } = require("../services/embed.service");
const { storeChunks } = require("../services/qdrant.service");
const { generateAnalysis } = require("../services/qwen.service");
const { v4: uuidv4 } = require("uuid");

const analyzeInterview = async (req, res) => {
  try {
    const { resumePath, jobDescriptionPath, audioPath } = req.body;

    if (!resumePath || !jobDescriptionPath || !audioPath) {
      return res.status(400).json({
        success: false,
        message: "Missing file paths. Call /api/upload first.",
      });
    }

    // Step 1 — Extract text from all sources
    console.log("Step 1: Extracting text...");
    const [resumeResult, jdResult, transcriptResult] = await Promise.all([
      extractTextFromPDF(resumePath),
      extractTextFromPDF(jobDescriptionPath),
      transcribeAudio(audioPath),
    ]);

    if (!resumeResult.success) return res.status(500).json({ success: false, message: "Resume parse failed", error: resumeResult.error });
    if (!jdResult.success) return res.status(500).json({ success: false, message: "JD parse failed", error: jdResult.error });
    if (!transcriptResult.success) return res.status(500).json({ success: false, message: "Transcription failed", error: transcriptResult.error });

    // Step 2 — Chunk all sources
    console.log("Step 2: Chunking text...");
    const chunks = chunkAllSources(
      resumeResult.text,
      jdResult.text,
      transcriptResult.transcript
    );
    console.log(`Created ${chunks.length} chunks`);

    // Step 3 — Generate embeddings
    console.log("Step 3: Generating embeddings...");
    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await getEmbeddings(chunkTexts);

    // Step 4 — Store in Qdrant
    console.log("Step 4: Storing in vector DB...");
    const sessionId = uuidv4();

    // Skip Qdrant if not configured (local dev)
    let qdrantStored = false;
    if (process.env.QDRANT_URL) {
      await storeChunks(chunks, embeddings, sessionId);
      qdrantStored = true;
    } else {
      console.log("⚠️  Qdrant not configured — skipping vector store");
    }

    // Step 5 — Generate AI analysis
    console.log("Step 5: Generating analysis with Qwen...");
    const analysis = await generateAnalysis(
      resumeResult.text,
      jdResult.text,
      transcriptResult.transcript
    );

    return res.status(200).json({
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
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return res.status(500).json({
      success: false,
      message: "Analysis failed",
      error: error.message,
    });
  }
};

module.exports = { analyzeInterview };