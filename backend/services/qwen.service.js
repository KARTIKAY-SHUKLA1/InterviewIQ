const OpenAI = require("openai");

const getClient = () => {
  return new OpenAI({
    baseURL: process.env.QWEN_API_URL || "http://localhost:8002/v1",
    apiKey: process.env.QWEN_API_KEY || "dummy",
  });
};

const generateAnalysis = async (resumeText, jdText, transcriptText) => {
  if (!process.env.QWEN_API_URL) {
    console.log("⚠️  Qwen stub mode");
    return getStubAnalysis();
  }

  try {
    const client = getClient();

    const prompt = `You are an expert interview coach. Analyze this interview data and respond with JSON only.

RESUME: ${resumeText.slice(0, 500)}

JOB DESCRIPTION: ${jdText.slice(0, 500)}

TRANSCRIPT: ${transcriptText.slice(0, 500)}

Respond with ONLY this JSON, no other text:
{
  "summary": {
    "questionsAsked": ["q1", "q2"],
    "topicsCovered": ["t1", "t2"],
    "overallSummary": "2 sentence summary"
  },
  "skillGap": {
    "requiredSkills": ["s1", "s2"],
    "candidateSkills": ["s1", "s2"],
    "missingSkills": ["s1"],
    "matchScore": 70
  },
  "performance": {
    "strongAnswers": [{"question": "q1", "why": "reason"}],
    "weakAnswers": [{"question": "q1", "why": "reason", "improvement": "tip"}],
    "overallScore": 65
  },
  "roadmap": {
    "threeDays": ["task1"],
    "sevenDays": ["task1"],
    "fourteenDays": ["task1"]
  }
}`;

    const response = await client.chat.completions.create({
      model: process.env.QWEN_MODEL || "Qwen/Qwen3-8B",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    });

    const raw = response.choices[0].message.content;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Qwen did not return valid JSON");
    return JSON.parse(jsonMatch[0]);

  } catch (error) {
    console.error("Qwen error:", error.message);
    console.log("Falling back to stub analysis");
    return getStubAnalysis();
  }
};

const chatWithContext = async (question, retrievedChunks, conversationHistory = []) => {
  if (!process.env.QWEN_API_URL) {
    return {
      answer: `[STUB] You asked: "${question}". Retrieved ${retrievedChunks.length} relevant chunks.`,
      sourcesUsed: retrievedChunks.map((c) => c.source),
    };
  }

  try {
    const client = getClient();

    const context = retrievedChunks
      .map((c, i) => `[${i + 1}] (Source: ${c.source})\n${c.text.slice(0, 200)}`)
      .join("\n\n");

    const systemPrompt = `You are InterviewIQ, an AI interview coach. Answer questions using ONLY the provided context. Always cite which source (resume/jobDescription/transcript) your answer comes from. Be concise.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-4),
      {
        role: "user",
        content: `Context:\n${context}\n\nQuestion: ${question}`,
      },
    ];

    const response = await client.chat.completions.create({
      model: process.env.QWEN_MODEL || "Qwen/Qwen3-8B",
      messages,
      temperature: 0.4,
      max_tokens: 300,
    });

    return {
      answer: response.choices[0].message.content,
      sourcesUsed: [...new Set(retrievedChunks.map((c) => c.source))],
    };

  } catch (error) {
    console.error("Qwen chat error:", error.message);
    return {
      answer: `Based on your documents: ${retrievedChunks[0]?.text?.slice(0, 200) || "No context found"}`,
      sourcesUsed: retrievedChunks.map((c) => c.source),
    };
  }
};

const getStubAnalysis = () => ({
  summary: {
    questionsAsked: [
      "Tell me about your React experience",
      "How do you handle system design?",
      "What is your experience with Docker?",
    ],
    topicsCovered: ["React", "Node.js", "System Design", "Docker"],
    overallSummary:
      "The candidate demonstrated strong frontend skills with React and Node.js. However, gaps were identified in DevOps tooling and system design depth.",
  },
  skillGap: {
    requiredSkills: ["React", "Node.js", "Docker", "AWS", "System Design"],
    candidateSkills: ["React", "Node.js", "MongoDB", "REST APIs", "WebSockets"],
    missingSkills: ["Docker", "AWS", "Kubernetes"],
    matchScore: 68,
  },
  performance: {
    strongAnswers: [
      { question: "React experience", why: "Gave concrete project examples" },
      { question: "REST API design", why: "Demonstrated solid understanding" },
    ],
    weakAnswers: [
      {
        question: "System design",
        why: "Answer was too high-level",
        improvement: "Study load balancing and caching strategies",
      },
      {
        question: "Docker experience",
        why: "Admitted limited experience",
        improvement: "Build a Dockerized Node.js app this week",
      },
    ],
    overallScore: 65,
  },
  roadmap: {
    threeDays: ["Complete Docker fundamentals", "Deploy one project to AWS EC2"],
    sevenDays: ["Study system design patterns", "Practice 3 mock interviews"],
    fourteenDays: ["Build microservices with Docker Compose", "Complete AWS basics"],
  },
});

module.exports = { generateAnalysis, chatWithContext };