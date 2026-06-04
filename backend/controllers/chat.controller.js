const { getSingleEmbedding } = require("../services/embed.service");
const { searchChunks } = require("../services/qdrant.service");
const { chatWithContext } = require("../services/qwen.service");

// In-memory conversation history per session
// In production this moves to MongoDB
const conversationStore = {};

const chat = async (req, res) => {
  try {
    const { question, sessionId, analysis } = req.body;

    if (!question || !sessionId) {
      return res.status(400).json({
        success: false,
        message: "question and sessionId are required",
      });
    }

    // Get or create conversation history for this session
    if (!conversationStore[sessionId]) {
      conversationStore[sessionId] = [];
    }
    const history = conversationStore[sessionId];

    let retrievedChunks = [];

    // If Qdrant is configured, do real RAG retrieval
    if (process.env.QDRANT_URL) {
      console.log("RAG: generating query embedding...");
      const queryEmbedding = await getSingleEmbedding(question);

      console.log("RAG: searching vector DB...");
      retrievedChunks = await searchChunks(queryEmbedding, sessionId, 5);
      console.log(`RAG: retrieved ${retrievedChunks.length} chunks`);
    } else {
      // Stub context — use the analysis object passed from frontend
      console.log("⚠️  RAG stub mode — using analysis as context");
      if (analysis) {
        retrievedChunks = [
          {
            text: JSON.stringify(analysis.skillGap),
            source: "analysis",
            score: 1.0,
          },
          {
            text: JSON.stringify(analysis.performance),
            source: "analysis",
            score: 0.9,
          },
          {
            text: JSON.stringify(analysis.roadmap),
            source: "analysis",
            score: 0.8,
          },
        ];
      }
    }

    // Generate answer
    const { answer, sourcesUsed } = await chatWithContext(
      question,
      retrievedChunks,
      history
    );

    // Update conversation history
    history.push({ role: "user", content: question });
    history.push({ role: "assistant", content: answer });

    // Keep last 10 messages to avoid context overflow
    if (history.length > 10) {
      conversationStore[sessionId] = history.slice(-10);
    }

    return res.status(200).json({
      success: true,
      answer,
      sourcesUsed,
      chunksRetrieved: retrievedChunks.length,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({
      success: false,
      message: "Chat failed",
      error: error.message,
    });
  }
};

module.exports = { chat };