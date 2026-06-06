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

    const prompt = `You are a senior technical interviewer and career coach at a top tech company. Your job is to give the most honest, specific, and actionable interview feedback possible.

Read the following carefully:

RESUME:
${resumeText}

JOB DESCRIPTION:
${jdText}

INTERVIEW TRANSCRIPT (with timestamps):
${transcriptText.slice(0, 3000)}

Now analyze and produce feedback following these STRICT RULES:

--- SUMMARY RULES ---
- questionsAsked: list the EXACT questions asked in the transcript word for word
- topicsCovered: list specific technical topics discussed
- overallSummary: write 3 sentences — sentence 1: what role and what was tested, sentence 2: what candidate did well with specific transcript evidence, sentence 3: what candidate struggled with and how it relates to JD

--- SKILL GAP RULES ---
- candidateSkills: ONLY skills explicitly in resume
- requiredSkills: ONLY skills explicitly in JD
- missingSkills: skills in JD completely absent from resume — ZERO overlap with candidateSkills
- matchScore: integer percentage of JD skills found in resume

--- PERFORMANCE RULES ---
- strongAnswers and weakAnswers MUST be about COMPLETELY DIFFERENT questions or aspects
- strongAnswers.why: MUST start with exact timestamp e.g. "At [00:15] you said..."
- weakAnswers.why: MUST start with exact timestamp e.g. "At [03:28] you said..."
- weakAnswers.improvement: MUST name specific platform AND specific resource

--- ROADMAP RULES ---
- CRITICAL: threeDays MUST have EXACTLY 3 items. sevenDays MUST have EXACTLY 7 items. fourteenDays MUST have EXACTLY 7 items.
- Every task must name a specific platform (LeetCode, Pramp, neetcode.io, Coursera, YouTube, GitHub, fastapi.tiangolo.com etc)
- Every task must include specific action (problem number, course name, chapter, project idea)
- FORBIDDEN: "practice algorithms", "study concepts", "explore topics", "learn about"
- threeDays: address most critical weakness from transcript
- sevenDays: bridge biggest skill gap between resume and JD day by day
- fourteenDays: key milestones spread across 2 weeks ending with a deployable project

Respond with ONLY valid JSON. No explanation, no markdown, no text outside JSON:
{
  "summary": {
    "questionsAsked": ["exact question from transcript"],
    "topicsCovered": ["specific technical topic"],
    "overallSummary": "3 sentences following rules above"
  },
  "skillGap": {
    "requiredSkills": ["exact skill from JD"],
    "candidateSkills": ["exact skill from resume"],
    "missingSkills": ["skill in JD not in resume"],
    "matchScore": 65
  },
  "performance": {
    "strongAnswers": [
      {
        "question": "specific aspect candidate handled well",
        "why": "At [00:XX] you said '[exact quote]' which shows [specific strength]"
      }
    ],
    "weakAnswers": [
      {
        "question": "DIFFERENT specific aspect candidate struggled with",
        "why": "At [0X:XX] you said '[exact quote]' which shows [specific weakness]",
        "improvement": "[Platform] — [specific resource]: [specific action with measurable goal]"
      }
    ],
    "overallScore": 55
  },
  "roadmap": {
    "threeDays": [
      {"day": 1, "task": "specific day 1 task with platform and resource name"},
      {"day": 2, "task": "specific day 2 task with platform and resource name"},
      {"day": 3, "task": "specific day 3 task with platform and resource name"}
    ],
    "sevenDays": [
      {"day": 1, "task": "specific task with platform"},
      {"day": 2, "task": "specific task with platform"},
      {"day": 3, "task": "specific task with platform"},
      {"day": 4, "task": "specific task with platform"},
      {"day": 5, "task": "specific task with platform"},
      {"day": 6, "task": "specific task with platform"},
      {"day": 7, "task": "specific task with platform"}
    ],
    "fourteenDays": [
      {"day": 1, "task": "specific starting task"},
      {"day": 2, "task": "specific task"},
      {"day": 4, "task": "specific mid-week task"},
      {"day": 6, "task": "specific task"},
      {"day": 8, "task": "specific week 2 task"},
      {"day": 11, "task": "specific task"},
      {"day": 14, "task": "final deployable project — push to GitHub and add to resume"}
    ]
  }
}`;

    const response = await client.chat.completions.create({
      model: process.env.QWEN_MODEL || "Qwen/Qwen3-8B",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 2000,
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
        return `[${i + 1}] (Source: ${c.source}${timeRef})\n${c.text.slice(0, 600)}`;
      })
      .join("\n\n");

    const systemPrompt = `You are InterviewIQ, an expert interview coach with 10 years of experience helping candidates get hired at top tech companies.

You have access to three documents:
1. Candidate resume
2. Job description they applied for
3. Interview transcript with exact timestamps

Rules you must follow every single time:
- Answer ONLY using the provided context — never invent or assume
- Always cite source: (from resume) / (from jobDescription) / (from transcript)
- For transcript always include timestamp: "at [03:28] you said..."
- Quote candidate's exact words when possible
- Be direct and specific — no filler phrases
- If asked about weak answers → find exact transcript moment with timestamp and quote
- If asked about missing skills → name exact skills from JD not in resume
- If asked for a score → give specific number with breakdown
- If asked what to study → name specific platform and resource
- Keep answers under 200 words
- Use **bold** for timestamps and key skills`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-4),
      {
        role: "user",
        content: `Context from candidate documents:\n\n${context}\n\nQuestion: ${question}`,
      },
    ];

    const response = await client.chat.completions.create({
      model: process.env.QWEN_MODEL || "Qwen/Qwen3-8B",
      messages,
      temperature: 0.2,
      max_tokens: 400,
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
      "Tell me about yourself and why Livo AI?",
      "What is your experience with AI and LLM APIs?",
      "What is your experience with Python?",
      "How would you approach a document intelligence pipeline?",
      "What is your weakest area for this role?",
    ],
    topicsCovered: [
      "RAG pipeline architecture",
      "AI/LLM API integration",
      "Python backend development",
      "Document intelligence pipelines",
      "Self-awareness and technical gaps",
    ],
    overallSummary:
      "Candidate applied for Software Engineering Intern at Livo AI requiring Python, FastAPI, AWS Bedrock and RAG pipelines. At [01:45] candidate demonstrated strong RAG pipeline knowledge through InterviewIQ project showing real hands-on AI experience. However candidate lacks Python backend and AWS Bedrock experience which are core daily requirements at Livo AI.",
  },
  skillGap: {
    requiredSkills: ["Python", "FastAPI", "React", "AWS Bedrock", "Vector DB", "Neo4j", "RAG", "LLM APIs"],
    candidateSkills: ["React", "Node.js", "Express", "MongoDB", "TypeScript", "REST APIs", "WebSockets", "JWT"],
    missingSkills: ["Python", "FastAPI", "AWS Bedrock", "Neo4j"],
    matchScore: 38,
  },
  performance: {
    strongAnswers: [
      {
        question: "RAG pipeline architecture and AI integration",
        why: "At [01:45] you said 'I built a complete RAG pipeline using Whisper, BGE embeddings, Qdrant vector database, and Qwen for inference' showing deep hands-on experience directly relevant to Livo's document intelligence work",
      },
    ],
    weakAnswers: [
      {
        question: "Python backend and FastAPI experience",
        why: "At [03:12] you said 'I have not built a production Python backend' which is a critical gap since Livo's entire stack is Python and FastAPI",
        improvement: "FastAPI official tutorial at fastapi.tiangolo.com/tutorial — complete the full tutorial and build a CRUD API with PostgreSQL in 3 days",
      },
    ],
    overallScore: 52,
    scoreBreakdown: {
      skillMatch: 38,
      performanceRatio: 60,
      formula: "40% skill match + 60% answer performance",
    },
  },
  "roadmap": {
  "threeDays": [
    "Day 1-3 specific task with platform addressing top transcript weakness",
    "Day 2 specific task with platform bridging resume gap",
    "Day 3 specific deliverable to complete"
  ],
  "sevenDays": [
    "Day 4 specific task continuing from 3-day plan",
    "Day 5-6 specific task addressing biggest JD skill gap",
    "Day 7 specific deliverable — push to GitHub"
  ],
  "fourteenDays": [
    "Week 2 Day 8-10 specific task building on week 1",
    "Day 11-13 specific task — build complete project using missing skills",
    "Day 14 final deliverable — deployed project add to resume"
  ]
},
});

module.exports = { generateAnalysis, chatWithContext };