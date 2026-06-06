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

=== CANDIDATE RESUME ===
${resumeText.slice(0, 1500)}

=== JOB DESCRIPTION ===
${jdText.slice(0, 1500)}

=== INTERVIEW TRANSCRIPT (with timestamps) ===
${transcriptText.slice(0, 2000)}

Now analyze and produce feedback following these STRICT RULES:

--- SUMMARY RULES ---
- questionsAsked: list the EXACT questions asked in the transcript word for word
- topicsCovered: list specific technical topics discussed (not generic like "algorithms" but specific like "binary search on peak finding arrays")
- overallSummary: write 3 sentences — sentence 1: what role the candidate applied for and what technical area was tested, sentence 2: what the candidate did well with specific evidence from transcript, sentence 3: what the candidate struggled with and how it relates to JD requirements

--- SKILL GAP RULES ---
- candidateSkills: extract ONLY skills explicitly mentioned in the resume text above — use exact terms from resume
- requiredSkills: extract ONLY skills explicitly mentioned in the JD text above — use exact terms from JD
- missingSkills: compute this as (requiredSkills minus candidateSkills) — skills that appear in JD but are completely absent from resume — ZERO overlap with candidateSkills allowed
- matchScore: calculate as integer percentage = (number of requiredSkills found in candidateSkills / total requiredSkills) * 100

--- PERFORMANCE RULES ---
- strongAnswers and weakAnswers MUST be about DIFFERENT aspects — never the same question in both
- If only one question in transcript, split into different aspects: e.g. "Problem comprehension" vs "Solution completeness"
- strongAnswers.why: MUST include exact timestamp and quote candidate's words e.g. "At [00:15] you correctly said 'the array first increases then decreases' showing strong problem analysis"
- weakAnswers.why: MUST include exact timestamp and quote candidate's words showing the weakness
- weakAnswers.improvement: MUST be a specific resource — include platform name AND specific problem/course/chapter name

--- ROADMAP RULES ---
- Every task must be 100% specific to THIS candidate's gaps identified above
- Every task must name a specific platform (LeetCode, Pramp, neetcode.io, Coursera, YouTube, GitHub, docs.python.org etc)
- Every task must include a specific action (problem number, course name, chapter, project idea)
- FORBIDDEN generic phrases: "practice algorithms", "study concepts", "explore topics", "learn about", "attend workshops"
- threeDays: focus on the most critical weakness from the transcript
- sevenDays: focus on bridging the biggest skill gap between resume and JD
- fourteenDays: focus on building something demonstrable using the missing skills

Respond with ONLY valid JSON. No explanation, no markdown, no text outside the JSON:
{
  "summary": {
    "questionsAsked": ["exact question from transcript"],
    "topicsCovered": ["specific technical topic e.g. Binary search on peak finding arrays"],
    "overallSummary": "3 sentences following the rules above"
  },
  "skillGap": {
    "requiredSkills": ["exact skill from JD"],
    "candidateSkills": ["exact skill from resume"],
    "missingSkills": ["skill in JD not in resume — zero overlap"],
    "matchScore": 65
  },
  "performance": {
    "strongAnswers": [
      {
        "question": "specific aspect candidate handled well e.g. Problem comprehension and edge case clarification",
        "why": "At [00:XX] you said '[exact quote]' which shows [specific strength]"
      }
    ],
    "weakAnswers": [
      {
        "question": "DIFFERENT specific aspect candidate struggled with e.g. Implementing complete binary search solution",
        "why": "At [0X:XX] you said '[exact quote]' which shows [specific weakness]",
        "improvement": "[Platform name] — [specific resource]: [specific action with measurable goal]"
      }
    ],
    "overallScore": 55
  },
  "roadmap": {
    "threeDays": [
      "Address transcript weakness: [specific LeetCode problem number and name] on neetcode.io — solve without hints in under [X] minutes",
      "Quick skill bridge: [specific resource addressing top missing JD skill]"
    ],
    "sevenDays": [
      "Deep dive on biggest JD gap: [specific course/resource with platform and chapter]",
      "Interview practice: Complete [X] mock interviews on Pramp.com focusing on [specific skill]"
    ],
    "fourteenDays": [
      "Build project: [specific project idea using top missing JD skill] and deploy to GitHub",
      "Final prep: [specific final resource addressing remaining gaps]"
    ]
  }
}`;

    const response = await client.chat.completions.create({
      model: process.env.QWEN_MODEL || "Qwen/Qwen3-8B",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1500,
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
1. Candidate's resume
2. Job description they applied for  
3. Their interview transcript with exact timestamps

Your job is to give honest, specific, actionable answers.

Rules you must follow every single time:
- Answer ONLY using the provided context — never invent or assume
- Always say which source your answer comes from: (from resume) / (from jobDescription) / (from transcript)
- For transcript always include timestamp: "at [03:28] you said..."
- Quote the candidate's exact words when possible
- Be direct and specific — no filler phrases like "great question" or "it's important to"
- If asked about weak answers → find exact moment in transcript with timestamp and quote
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
      "Tell me about your experience with React and TypeScript",
      "How would you approach building a document intelligence pipeline?",
      "Where are you weak technically?",
    ],
    topicsCovered: [
      "React and TypeScript frontend development",
      "AI/LLM API integration",
      "RAG pipeline architecture",
      "Self-awareness and growth areas",
    ],
    overallSummary:
      "Candidate applied for a Software Engineering Intern role at Livo AI requiring Python, FastAPI, AWS Bedrock and RAG pipelines. At [01:45] candidate demonstrated strong React and Node.js experience through CodeLens project and showed genuine interest in AI product work. However candidate lacks Python, FastAPI and AWS Bedrock experience which are core requirements of the role.",
  },
  skillGap: {
    requiredSkills: ["Python", "FastAPI", "React", "AWS Bedrock", "Vector DB", "Neo4j", "RAG pipelines", "LLM APIs"],
    candidateSkills: ["React", "Node.js", "Express", "MongoDB", "TypeScript", "REST APIs", "WebSockets", "JWT"],
    missingSkills: ["Python", "FastAPI", "AWS Bedrock", "Neo4j", "RAG pipelines"],
    matchScore: 38,
  },
  performance: {
    strongAnswers: [
      {
        question: "AI/LLM API integration experience",
        why: "At [01:45] you said 'I built CodeLens which integrates with GenAI APIs to analyze code across 12 languages' showing real hands-on AI integration experience that directly aligns with Livo's work",
      },
    ],
    weakAnswers: [
      {
        question: "Backend architecture and Python ecosystem",
        why: "At [03:12] you said 'I haven't used FastAPI or Python backends' which is a significant gap since Livo's entire stack is Python + FastAPI",
        improvement: "FastAPI official tutorial at fastapi.tiangolo.com/tutorial — complete the full tutorial in 3 days and build a simple REST API — this is the most critical gap to close",
      },
    ],
    overallScore: 52,
  },
  roadmap: {
    threeDays: [
      "Complete FastAPI official tutorial at fastapi.tiangolo.com/tutorial — build a simple CRUD API with PostgreSQL to match Livo's stack",
      "Read Livo's website livoassistant.com and understand their 3 main product areas — prepare specific answers for why you want to work there",
    ],
    sevenDays: [
      "Build a simple RAG pipeline using Python + FAISS or Qdrant — index 10 PDFs and build a Q&A system — push to GitHub",
      "Complete 3 mock interviews on Pramp.com focusing on system design questions about document processing pipelines",
    ],
    fourteenDays: [
      "Build a document intelligence demo: upload a PDF → extract text → chunk → embed → query with LLM → deploy on Render — add to resume",
      "Study AWS Bedrock through official workshop at workshops.aws — focus on the RAG with Bedrock module",
    ],
  },
});

module.exports = { generateAnalysis, chatWithContext };