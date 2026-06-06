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

    const prompt = `You are a senior technical interviewer and career coach. Analyze this specific interview and give highly personalized feedback.

CANDIDATE RESUME:
${resumeText.slice(0, 1500)}

JOB DESCRIPTION:
${jdText.slice(0, 1500)}

INTERVIEW TRANSCRIPT (with timestamps):
${transcriptText.slice(0, 2000)}

STRICT RULES — read every rule carefully:

RULE 1 — SKILL GAP:
- candidateSkills = list ONLY skills explicitly written in the RESUME above
- requiredSkills = list ONLY skills explicitly written in the JD above  
- missingSkills = list ONLY skills that appear in JD but are COMPLETELY ABSENT from resume
- missingSkills must have ZERO overlap with candidateSkills

RULE 2 — PERFORMANCE:
- strongAnswers and weakAnswers must be about COMPLETELY DIFFERENT questions or aspects
- NEVER put the same question in both strongAnswers and weakAnswers
- If only one question exists in transcript, split into different aspects e.g. "Problem comprehension" vs "Solution implementation"
- strongAnswers.why MUST start with exact timestamp e.g. "At [00:15] candidate..."
- weakAnswers.why MUST start with exact timestamp e.g. "At [03:28] candidate..."
- weakAnswers.improvement must name a SPECIFIC platform, problem number, or resource URL

RULE 3 — ROADMAP (most important):
- Every roadmap task must be 100% personalized to THIS candidate's specific gaps
- Look at missingSkills and weakAnswers — roadmap must directly address them
- Every task must include a specific platform name (LeetCode, Pramp, neetcode.io, Coursera, YouTube channel name, GitHub repo name)
- Every task must include a specific action (problem number, course name, chapter name, project idea)
- NEVER write generic tasks like "practice algorithms" or "study AI concepts"
- Example of BAD task: "Practice problem-solving skills"
- Example of GOOD task: "Solve LeetCode #162 Find Peak Element and #852 Peak Index — use binary search approach, aim to solve in under 15 minutes without hints"
- Example of BAD task: "Learn about AI strategy"  
- Example of GOOD task: "Read Lokal's product blog and study how they use AI for local content — then read 'AI Product Manager' course on Coursera by Duke University"

Respond with ONLY valid JSON, absolutely no other text:
{
  "summary": {
    "questionsAsked": ["exact question from transcript"],
    "topicsCovered": ["specific technical topic from transcript"],
    "overallSummary": "2 sentences: first sentence mentions specific skills from resume and what JD requires, second sentence mentions specific moment from transcript with timestamp"
  },
  "skillGap": {
    "requiredSkills": ["skill from JD"],
    "candidateSkills": ["skill from resume"],
    "missingSkills": ["skill in JD not in resume"],
    "matchScore": 60
  },
  "performance": {
    "strongAnswers": [
      {
        "question": "specific ASPECT candidate handled well — not the full question",
        "why": "At [00:XX] candidate [specific thing they did well with evidence from transcript]"
      }
    ],
    "weakAnswers": [
      {
        "question": "DIFFERENT specific ASPECT candidate struggled with",
        "why": "At [0X:XX] candidate [specific thing they struggled with, exact words if possible]",
        "improvement": "Specific action: [platform name] — [specific problem/course/resource] — [measurable goal]"
      }
    ],
    "overallScore": 55
  },
  "roadmap": {
    "threeDays": [
      "Directly address top weakness from transcript: [specific LeetCode problem or resource with number/link]",
      "Bridge biggest skill gap from JD vs resume: [specific course or project with platform name]"
    ],
    "sevenDays": [
      "Deepen weak area identified in transcript: [specific resource with platform and chapter/section]",
      "Practice interview communication: [specific mock interview platform with goal]"
    ],
    "fourteenDays": [
      "Build project using top missing JD skill: [specific project idea that demonstrates the missing skill]",
      "Complete interview preparation: [specific final preparation resource]"
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

You have access to:
- Candidate resume
- Job description they applied for
- Interview transcript with exact timestamps

Rules:
- Answer ONLY from the provided context — never make things up
- Always cite source (resume / jobDescription / transcript)
- For transcript always include timestamp e.g. "at [03:28] you said..."
- Be specific — name actual skills, actual companies, actual problems
- If asked about weak answers, find exact transcript moment with timestamp
- If asked about missing skills, compare resume vs JD precisely and name exact missing skills
- If asked for rating, give specific number with clear reasoning broken down
- Keep answers focused under 200 words
- Use **bold** for key points and timestamps`;

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
      temperature: 0.3,
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
      "Tell me about your React experience",
      "How do you handle system design?",
      "What is your experience with Docker?",
    ],
    topicsCovered: ["React", "Node.js", "System Design", "Docker"],
    overallSummary:
      "Candidate has strong React and Node.js experience from resume but the JD requires Docker and AWS which are completely absent. At [05:42] candidate gave a high-level system design answer without mentioning load balancers or caching.",
  },
  skillGap: {
    requiredSkills: ["React", "Node.js", "Docker", "AWS", "System Design"],
    candidateSkills: ["React", "Node.js", "MongoDB", "REST APIs", "WebSockets"],
    missingSkills: ["Docker", "AWS", "Kubernetes"],
    matchScore: 68,
  },
  performance: {
    strongAnswers: [
      {
        question: "Problem comprehension and clarification",
        why: "At [00:15] candidate correctly identified the core requirement and asked smart clarifying questions about edge cases showing strong analytical thinking",
      },
    ],
    weakAnswers: [
      {
        question: "Implementing complete solution with edge cases",
        why: "At [03:28] candidate said 'this is not my final answer' and did not complete the full implementation within the interview time",
        improvement: "Solve LeetCode #162 Find Peak Element and #852 Peak Index on neetcode.io — practice completing full solutions in under 20 minutes without hints",
      },
    ],
    overallScore: 65,
  },
  roadmap: {
    threeDays: [
      "Solve LeetCode #162 Find Peak Element and #852 Peak Index in Mountain Array on neetcode.io — use binary search, complete without hints in under 20 minutes",
      "Complete Docker getting started tutorial at docs.docker.com/get-started and containerize your existing Node.js project",
    ],
    sevenDays: [
      "Complete 5 mock interviews on Pramp.com — practice explaining your full approach out loud before writing any code",
      "Read System Design Primer chapter on scalability at github.com/donnemartin/system-design-primer",
    ],
    fourteenDays: [
      "Deploy a Dockerized Node.js app to AWS EC2 following the official AWS tutorial — add to your GitHub and resume",
      "Record yourself solving 3 LeetCode medium problems — review how clearly you explain your thought process",
    ],
  },
});

module.exports = { generateAnalysis, chatWithContext };