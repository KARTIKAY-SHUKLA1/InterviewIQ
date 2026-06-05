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

    const prompt = `You are an expert interview coach. Analyze this real interview data carefully.

RESUME: ${resumeText.slice(0, 500)}

JOB DESCRIPTION: ${jdText.slice(0, 500)}

INTERVIEW TRANSCRIPT (with timestamps): ${transcriptText.slice(0, 500)}

Based on the above real data, respond with ONLY a JSON object. Use actual skill names, actual questions, actual topics from the data above. No placeholders like q1, s1, task1.

{
  "summary": {
    "questionsAsked": ["actual question from transcript"],
    "topicsCovered": ["actual topic discussed"],
    "overallSummary": "actual 2 sentence summary based on the data"
  },
  "skillGap": {
    "requiredSkills": ["actual skills from JD"],
    "candidateSkills": ["actual skills from resume"],
    "missingSkills": ["skills in JD but not in resume"],
    "matchScore": 70
  },
  "performance": {
    "strongAnswers": [{"question": "actual question", "why": "actual reason"}],
    "weakAnswers": [{"question": "actual question", "why": "actual reason", "improvement": "actual tip"}],
    "overallScore": 65
  },
  "roadmap": {
    "threeDays": ["specific actionable task"],
    "sevenDays": ["specific actionable task"],
    "fourteenDays": ["specific actionable task"]
  }
}`;

    const response = await client.chat.completions.create({
      model: process.env.QWEN_MODEL || "Qwen/Qwen3-1.7B",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 800,
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
      .map((c, i) => {
        const timeRef = c.timestamp ? ` at ${c.timestamp}` : "";
        return `[${i + 1}] (Source: ${c.source}${timeRef})\n${c.text.slice(0, 200)}`;
      })
      .join("\n\n");

    const systemPrompt = `You are InterviewIQ, an AI interview coach. Answer questions using ONLY the provided context. When citing transcript chunks, always mention the timestamp if available (e.g. "at 04:32 you said..."). Always cite which source (resume/jobDescription/transcript) your answer comes from. Be specific and concise.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-4),
      {
        role: "user",
        content: `Context:\n${context}\n\nQuestion: ${question}`,
      },
    ];

    const response = await client.chat.completions.create({
      model: process.env.QWEN_MODEL || "Qwen/Qwen3-1.7B",
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