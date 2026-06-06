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

    const prompt = `You are a senior technical interviewer and career coach with 10 years of experience. Analyze this real interview data extremely carefully and provide highly specific, actionable feedback.

CANDIDATE RESUME:
${resumeText.slice(0, 1500)}

JOB DESCRIPTION:
${jdText.slice(0, 1500)}

INTERVIEW TRANSCRIPT (with timestamps showing exact moments):
${transcriptText.slice(0, 2000)}

STRICT RULES — follow every rule exactly:

1. candidateSkills = ONLY skills explicitly written in the resume above
2. requiredSkills = ONLY skills explicitly written in the JD above
3. missingSkills = skills in JD that do NOT appear anywhere in the resume — zero overlap with candidateSkills
4. strongAnswers and weakAnswers MUST be about completely different questions/topics
5. strongAnswers must cite a specific transcript moment with timestamp showing good performance
6. weakAnswers must cite a specific transcript moment with timestamp showing weakness
7. improvement in weakAnswers must be a specific actionable task with a real resource name
8. roadmap tasks must be specific with actual resource names, platform names, problem numbers
9. overallSummary must mention specific skills from resume, specific requirements from JD, and specific moments from transcript
10. matchScore = percentage of JD required skills found in resume (calculate precisely)
11. overallScore = honest assessment of interview performance based on transcript (be critical)

Respond with ONLY valid JSON, no explanation, no markdown:
{
  "summary": {
    "questionsAsked": ["exact question asked in transcript"],
    "topicsCovered": ["specific technical topic discussed"],
    "overallSummary": "2 specific sentences mentioning candidate name or role, specific skills demonstrated, specific gaps identified from the actual transcript and JD"
  },
  "skillGap": {
    "requiredSkills": ["exact skill from JD"],
    "candidateSkills": ["exact skill from resume"],
    "missingSkills": ["skill in JD completely absent from resume — no overlap allowed"],
    "matchScore": 65
  },
  "performance": {
    "strongAnswers": [
      {
        "question": "specific question candidate answered well",
        "why": "specific evidence from transcript with timestamp e.g. at [02:15] candidate correctly explained binary search approach showing strong algorithmic understanding"
      }
    ],
    "weakAnswers": [
      {
        "question": "DIFFERENT specific question candidate struggled with",
        "why": "specific evidence from transcript with timestamp e.g. at [03:28] candidate said they were unsure showing lack of depth",
        "improvement": "specific actionable resource e.g. Practice LeetCode problems #162 Find Peak Element and #852 Peak Index in Mountain Array, then read the binary search pattern guide on neetcode.io"
      }
    ],
    "overallScore": 60
  },
  "roadmap": {
    "threeDays": [
      "specific task with specific resource e.g. Solve LeetCode #162 Find Peak Element and #852 Peak Index using binary search — aim to solve without hints",
      "specific task with specific resource e.g. Watch Abdul Bari's algorithm playlist on YouTube covering divide and conquer"
    ],
    "sevenDays": [
      "specific task with specific resource e.g. Read System Design Primer on GitHub (github.com/donnemartin/system-design-primer) focusing on scalability chapter",
      "specific task e.g. Complete 5 mock interviews on Pramp.com focusing on communication and explaining approach before coding"
    ],
    "fourteenDays": [
      "specific task e.g. Build a full-stack project using the skills from JD that are missing from your resume — deploy it and add to GitHub",
      "specific task e.g. Record yourself solving 3 algorithmic problems and review how clearly you explain your thought process"
    ]
  }
}`;

    const response = await client.chat.completions.create({
      model: process.env.QWEN_MODEL || "Qwen/Qwen3-8B",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
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
- The candidate's resume
- The job description they applied for
- Their interview transcript with exact timestamps

Rules you must follow:
- Answer ONLY using the provided context — never make things up
- Always cite which source your answer comes from (resume / jobDescription / transcript)
- For transcript references always include the timestamp e.g. "at [03:28] you said..."
- Be specific and direct — give real actionable advice, not generic tips
- If asked about weak answers, find the exact moment in transcript and explain why it was weak
- If asked about missing skills, compare resume vs JD precisely
- If asked for a rating, give a specific number with clear reasoning
- Keep answers focused and under 200 words
- Use bold for important points`;

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
      "The candidate demonstrated strong frontend skills with React and Node.js but showed gaps in DevOps tooling. The JD requires Docker and AWS experience which are completely absent from the resume.",
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
        question: "React experience",
        why: "At [02:15] candidate described building DevLinkr with WebSockets and JWT authentication showing strong practical experience"
      },
    ],
    weakAnswers: [
      {
        question: "System design scalability",
        why: "At [05:42] candidate gave a high-level answer without mentioning load balancers, caching, or database sharding",
        improvement: "Read System Design Primer on GitHub (github.com/donnemartin/system-design-primer) and practice 3 mock system design interviews on Pramp.com",
      },
    ],
    overallScore: 65,
  },
  roadmap: {
    threeDays: [
      "Complete Docker getting started tutorial at docs.docker.com/get-started and dockerize one of your existing Node.js projects",
      "Solve LeetCode #162 Find Peak Element and #33 Search in Rotated Sorted Array using binary search without hints"
    ],
    sevenDays: [
      "Read System Design Primer on GitHub focusing on scalability, load balancing, and caching chapters",
      "Complete 3 mock interviews on Pramp.com focusing on explaining your approach before writing code"
    ],
    fourteenDays: [
      "Deploy a project to AWS EC2 following the official AWS getting started guide — add it to your resume",
      "Record yourself solving 3 algorithm problems and review how clearly you communicate your thought process"
    ],
  },
});

module.exports = { generateAnalysis, chatWithContext };