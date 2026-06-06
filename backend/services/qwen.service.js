const OpenAI = require("openai");

const getClient = () => {
  return new OpenAI({
    baseURL: process.env.QWEN_API_URL || "http://localhost:8002/v1",
    apiKey: process.env.QWEN_API_KEY || "dummy",
  });
};

const generateRoadmapPeriod = async (client, resumeText, jdText, transcriptText, period, missingSkills, weakAnswers) => {
  const periodConfig = {
    "3": {
      focus: "Address the most critical weakness identified in the transcript RIGHT NOW",
      count: 3,
      instruction: "Focus on quick wins — what can be done in 3 days to directly fix the biggest gap shown in the interview",
      example: '{"day": 1, "task": "FastAPI official tutorial at fastapi.tiangolo.com/tutorial — build Hello World API and understand routing"}'
    },
    "7": {
      focus: "Bridge the skill gaps between resume and JD through daily practice",
      count: 7,
      instruction: "Each day must be different and progressively harder — day 1 is basics, day 7 is a small project",
      example: '{"day": 4, "task": "Build a CRUD API with FastAPI and PostgreSQL — implement all 4 endpoints and test with Postman"}'
    },
    "14": {
      focus: "Build a complete deployable project using the missing skills",
      count: 7,
      instruction: "Key milestones on days 1, 2, 4, 6, 8, 11, 14 — ends with a deployed project on GitHub",
      example: '{"day": 14, "task": "Deploy document intelligence demo to Render.com — add live URL to resume and LinkedIn"}'
    }
  };

  const config = periodConfig[period];
  const missingSkillsList = missingSkills.slice(0, 5).join(", ");
  const weaknessSummary = weakAnswers.map(a => a.question).join(", ");

  const prompt = `You are a career coach. Generate a ${period}-day preparation plan for this candidate.

CANDIDATE MISSING SKILLS: ${missingSkillsList}
CANDIDATE WEAKNESSES FROM INTERVIEW: ${weaknessSummary}
RESUME BACKGROUND: ${resumeText.slice(0, 500)}
JOB REQUIRES: ${jdText.slice(0, 500)}

GOAL: ${config.focus}
INSTRUCTION: ${config.instruction}
REQUIRED COUNT: Exactly ${config.count} items

RULES:
- Every task must name a SPECIFIC platform (LeetCode, Pramp, Coursera, GitHub, fastapi.tiangolo.com, docs.aws.amazon.com, neetcode.io, Render.com etc)
- Every task must have a specific action (problem number, course name, chapter, project to build)
- Tasks must be DIFFERENT from each other — no repeating the same platform twice in a row
- Tasks must be progressive — easier to harder
- FORBIDDEN: "practice algorithms", "study concepts", "learn about", "explore"

Respond with ONLY a JSON array of exactly ${config.count} objects. No other text:
[
  ${config.example},
  ...
]`;

  const response = await client.chat.completions.create({
    model: process.env.QWEN_MODEL || "Qwen/Qwen3-8B",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 800,
  });

  const raw = response.choices[0].message.content;
  const arrayMatch = raw.match(/\[[\s\S]*\]/);
  if (!arrayMatch) return getDefaultRoadmapPeriod(period);
  
  try {
    return JSON.parse(arrayMatch[0]);
  } catch {
    return getDefaultRoadmapPeriod(period);
  }
};

const getDefaultRoadmapPeriod = (period) => {
  const defaults = {
    "3": [
      { day: 1, task: "FastAPI official tutorial at fastapi.tiangolo.com/tutorial — build a Hello World API and understand routing and request models" },
      { day: 2, task: "Build a CRUD REST API with FastAPI and PostgreSQL — implement all 4 endpoints and test with Postman" },
      { day: 3, task: "Deploy your FastAPI app to Render.com — follow their deployment guide and get a live URL" },
    ],
    "7": [
      { day: 1, task: "Read AWS Bedrock overview at docs.aws.amazon.com/bedrock — understand foundation models and inference APIs" },
      { day: 2, task: "Complete AWS Bedrock workshop at workshops.aws — follow the RAG with Knowledge Bases module hands-on" },
      { day: 3, task: "Build a simple document Q&A using AWS Bedrock Claude API — upload PDF, extract text, query with Claude" },
      { day: 4, task: "Study Neo4j fundamentals at neo4j.com/graphacademy — complete the free Neo4j Fundamentals course" },
      { day: 5, task: "Build a simple knowledge graph in Neo4j — model 3 entities and write 5 Cypher queries to traverse relationships" },
      { day: 6, task: "Complete 3 mock interviews on Pramp.com — focus on explaining RAG pipeline architecture clearly" },
      { day: 7, task: "Push all projects to GitHub with detailed READMEs — write a blog post summarizing what you learned" },
    ],
    "14": [
      { day: 1, task: "Start building document intelligence demo in Python — OCR a PDF using PyMuPDF and extract text" },
      { day: 2, task: "Add chunking and embeddings using sentence-transformers — store vectors in Qdrant Python client" },
      { day: 4, task: "Integrate AWS Bedrock Claude as LLM — implement full RAG pipeline with grounded answers" },
      { day: 6, task: "Build FastAPI backend — endpoints for upload, process, and query — test all endpoints with Postman" },
      { day: 8, task: "Add React frontend — file upload, query input, display answers with source citations" },
      { day: 11, task: "Deploy full stack — FastAPI on Render.com, React on Vercel, Qdrant Cloud for vector storage" },
      { day: 14, task: "Polish demo, write detailed README with architecture diagram, add to resume and LinkedIn" },
    ],
  };
  return defaults[period] || defaults["3"];
};

const generateAnalysis = async (resumeText, jdText, transcriptText) => {
  if (!process.env.QWEN_API_URL) {
    console.log("⚠️  Qwen stub mode");
    return getStubAnalysis();
  }

  try {
    const client = getClient();

    const prompt = `You are a senior technical interviewer and career coach. Analyze this real interview carefully.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jdText}

INTERVIEW TRANSCRIPT (with timestamps):
${transcriptText.slice(0, 2000)}

STRICT RULES:
- strongAnswers and weakAnswers MUST be about COMPLETELY DIFFERENT questions or aspects
- strongAnswers.why MUST start with exact timestamp e.g. "At [00:15] you said..."
- weakAnswers.why MUST start with exact timestamp e.g. "At [03:28] you said..."
- weakAnswers.improvement MUST name specific platform AND specific resource
- overallSummary: 3 sentences — role applied for, what candidate did well with transcript evidence, what candidate struggled with
- Do NOT generate roadmap — it will be generated separately

Respond with ONLY valid JSON:
{
  "summary": {
    "questionsAsked": ["exact question from transcript"],
    "topicsCovered": ["specific technical topic"],
    "overallSummary": "3 sentences"
  },
  "skillGap": {
    "requiredSkills": ["skill from JD"],
    "candidateSkills": ["skill from resume"],
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
        "improvement": "[Platform] — [specific resource]: [specific action]"
      }
    ],
    "overallScore": 55
  }
}`;

    const response = await client.chat.completions.create({
      model: process.env.QWEN_MODEL || "Qwen/Qwen3-8B",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1200,
    });

    const raw = response.choices[0].message.content;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Qwen did not return valid JSON");
    const analysis = JSON.parse(jsonMatch[0]);

    // Generate roadmap separately with 3 focused calls
    console.log("Generating 3-day roadmap...");
    const threeDays = await generateRoadmapPeriod(
      client, resumeText, jdText, transcriptText, "3",
      analysis.skillGap?.missingSkills || [],
      analysis.performance?.weakAnswers || []
    );

    console.log("Generating 7-day roadmap...");
    const sevenDays = await generateRoadmapPeriod(
      client, resumeText, jdText, transcriptText, "7",
      analysis.skillGap?.missingSkills || [],
      analysis.performance?.weakAnswers || []
    );

    console.log("Generating 14-day roadmap...");
    const fourteenDays = await generateRoadmapPeriod(
      client, resumeText, jdText, transcriptText, "14",
      analysis.skillGap?.missingSkills || [],
      analysis.performance?.weakAnswers || []
    );

    analysis.roadmap = { threeDays, sevenDays, fourteenDays };

    return analysis;

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

    const systemPrompt = `You are InterviewIQ, an expert interview coach with 10 years of experience.

You have access to:
1. Candidate resume
2. Job description
3. Interview transcript with exact timestamps

Rules:
- Answer ONLY from provided context
- Always cite source (resume / jobDescription / transcript)
- For transcript always include timestamp e.g. "at [03:28] you said..."
- Quote candidate's exact words when possible
- Be direct and specific — no filler phrases
- If asked about weak answers → find exact transcript moment with timestamp
- If asked about missing skills → name exact skills from JD not in resume
- If asked for score → give specific number with breakdown
- If asked what to study → name specific platform and resource
- Keep answers under 200 words
- Use **bold** for timestamps and key skills`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-4),
      {
        role: "user",
        content: `Context:\n\n${context}\n\nQuestion: ${question}`,
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
        why: "At [01:45] you said 'I built a complete RAG pipeline using Whisper, BGE embeddings, Qdrant, and Qwen' showing deep hands-on experience directly relevant to Livo's document intelligence work",
      },
    ],
    weakAnswers: [
      {
        question: "Python backend and FastAPI experience",
        why: "At [03:12] you said 'I have not built a production Python backend' which is a critical gap since Livo's entire stack is Python and FastAPI",
        improvement: "FastAPI official tutorial at fastapi.tiangolo.com/tutorial — complete full tutorial and build CRUD API with PostgreSQL in 3 days",
      },
    ],
    overallScore: 52,
    scoreBreakdown: {
      skillMatch: 38,
      performanceRatio: 60,
      formula: "40% skill match + 60% answer performance",
    },
  },
  roadmap: {
    threeDays: [
      { day: 1, task: "FastAPI official tutorial at fastapi.tiangolo.com/tutorial — build Hello World API, understand routing and request models" },
      { day: 2, task: "Build CRUD REST API with FastAPI and PostgreSQL — implement all 4 endpoints and test with Postman" },
      { day: 3, task: "Deploy FastAPI app to Render.com — get a live URL and add to GitHub README" },
    ],
    sevenDays: [
      { day: 1, task: "Read AWS Bedrock docs at docs.aws.amazon.com/bedrock — understand foundation models and Claude API" },
      { day: 2, task: "Complete AWS Bedrock workshop at workshops.aws — follow RAG with Knowledge Bases module" },
      { day: 3, task: "Build document Q&A with AWS Bedrock Claude — upload PDF, extract text, query with Claude API" },
      { day: 4, task: "Study Neo4j at neo4j.com/graphacademy — complete free Neo4j Fundamentals course" },
      { day: 5, task: "Build knowledge graph in Neo4j — model 3 entities and write 5 Cypher traversal queries" },
      { day: 6, task: "Complete 3 mock interviews on Pramp.com — practice explaining RAG pipeline architecture" },
      { day: 7, task: "Push all week projects to GitHub with README — document what you built and learned" },
    ],
    fourteenDays: [
      { day: 1, task: "Start document intelligence demo in Python — use PyMuPDF to extract text from PDFs" },
      { day: 2, task: "Add chunking and embeddings using sentence-transformers — store in Qdrant Python client" },
      { day: 4, task: "Integrate AWS Bedrock Claude as LLM — build full RAG pipeline with grounded answers" },
      { day: 6, task: "Build FastAPI backend — upload, process, query endpoints — test with Postman" },
      { day: 8, task: "Add React frontend — file upload UI, query input, answer display with source citations" },
      { day: 11, task: "Deploy full stack — FastAPI on Render, React on Vercel, Qdrant Cloud" },
      { day: 14, task: "Polish demo, write README with architecture diagram, add live URL to resume and LinkedIn" },
    ],
  },
});

module.exports = { generateAnalysis, chatWithContext };