# InterviewIQ — AI-Powered Interview Intelligence Copilot

Live Demo : https://interview-iq-nine-zeta.vercel.app/

## What It Does ?

InterviewIQ takes three inputs - your resume, the job description, and your interview recording and gives you a complete breakdown of your performance. It tells you which questions you answered well, which ones exposed gaps, what skills you're missing for the role, and builds a personalized 3/7/14-day prep plan for your next round. You can also chat with it after: ask "what was my weakest answer?" or "what should I study tonight?" and it answers using your actual interview data.

## Why I Built This ?

I'm a final year ECE student at IIIT Kota, actively applying for internships and placements. After every interview whether it went well or badly I'd walk out with the same problem: I had no idea what actually went wrong. I'd try to recall which questions I fumbled, but memory right after a stressful interview is unreliable. I'd look at the job description and wonder which of those skills I'd actually demonstrated. I'd have no structured way to prepare for round two.

I've built full-stack products before — a pair programming platform, an AI code review tool, a job portal. But none of them solved this specific, personal problem I kept running into. I wanted something that could take the raw material of an interview — the audio, my resume, the JD and turn it into something actionable. That's InterviewIQ.

The smallest useful version of this is exactly what I built: upload three files, get back a breakdown that tells you what to do next.

## How To Run It -

### Prerequisites
- Node.js 20+
- JarvisLabs account (for GPU inference)
- Qdrant Cloud account (free tier)

### Local Setup

**1. Clone the repo**
```bash
git clone https://github.com/KARTIKAY-SHUKLA1/InterviewIQ.git
cd InterviewIQ
```

**2. Backend setup**
```bash
cd backend
npm install
```

Create `backend/.env`:
```env
PORT=3000
WHISPER_API_URL=http://localhost:8000
QDRANT_URL=your_qdrant_cloud_url
QDRANT_API_KEY=your_qdrant_api_key
QWEN_API_URL=http://localhost:8002/v1
QWEN_API_KEY=dummy
QWEN_MODEL=Qwen/Qwen3-1.7B
EMBED_API_URL=http://localhost:8001
EMBED_API_KEY=dummy
```

**3. Frontend setup**
```bash
cd frontend
npm install
```

Create `frontend/.env`:
```env
VITE_BACKEND_URL=http://localhost:3000
```

**4. JarvisLabs GPU setup**

Launch an A30 instance on JarvisLabs, then run:
```bash
pip install fastapi uvicorn openai-whisper transformers torch sentence-transformers accelerate python-multipart
conda install -c conda-forge ffmpeg -y
```

Start AI servers:
```bash
# Whisper transcription server
nohup uvicorn whisper_server:app --host 0.0.0.0 --port 8000 &

# BGE embeddings server  
nohup uvicorn embed_server:app --host 0.0.0.0 --port 8001 &

# Qwen inference server
nohup uvicorn qwen_server:app --host 0.0.0.0 --port 8002 &
```

**5. Run**
```bash
# Backend
cd backend && node server.js

# Frontend
cd frontend && npm run dev
```

### Sample Data
The `samples/` folder contains:
- `sample_resume.pdf` — example resume
- `sample_jd.pdf` — example job description  
- `sample_interview.mp3` — 10 minute mock coding interview

Use these to test without uploading your own files.

## Architecture Decisions - 

### Why Whisper over cloud STT APIs ?
Whisper Large V3 is open source and runs on our own GPU — no per-minute billing, no data leaving our infrastructure. For interview recordings which are personal and sensitive, this matters. Cloud APIs like AssemblyAI charge per minute and send your audio to third-party servers. Whisper base model on A30 GPU handles a 10-minute interview in about 3-4 minutes.

### Why Qdrant over Pinecone ?
Qdrant has a free cloud tier that works out of the box for our scale, and the JS client is straightforward. Pinecone's free tier has stricter limits. More importantly, Qdrant supports payload filtering which we use to isolate chunks by session ID — each interview analysis is completely separate from others.

### Why BGE-large over OpenAI embeddings ?
BGE-large-en-v1.5 ranks at the top of the MTEB retrieval benchmark for open models. It produces 1024-dimensional vectors which give better semantic precision than OpenAI's ada-002 (1536-dim but proprietary). Running it on our own GPU means zero cost per embedding call and no rate limits.

### Why chunking with overlap instead of full-document embedding ?
Embedding an entire resume as one vector loses granular information. When someone asks "what projects did I mention?", a single resume embedding can't retrieve the projects section specifically. We chunk into 200-word pieces with 40-word overlap so boundaries don't cut off context. This is what makes the chat actually useful — it retrieves the 5 most relevant chunks across resume, JD, and transcript, not just a vague document-level match.

### Why async job processing ?
Whisper takes 3-5 minutes on a 10-minute audio file. A synchronous HTTP request would timeout through Cloudflare's proxy (120 second limit). We return a jobId immediately, process in the background, and the frontend polls every 5 seconds. This is the standard pattern for long-running AI tasks and means the system works for any audio length.

### Why Qwen 3 over GPT-4 ?
This is a JarvisLabs assessment — using open models running on GPU is the whole point. Qwen3-1.7B fits in A30 VRAM and responds in 30-60 seconds. For production, Qwen3-8B on an A100 would give significantly sharper analysis.

### Why not LangChain ?
I intentionally avoided LangChain and built the RAG pipeline from scratch — custom chunker, direct Qdrant client, manual embedding calls. This means I understand every part of the pipeline and can explain exactly what happens between upload and answer. LangChain would abstract this away and make it harder to debug or optimize.

## What I Used AI For

- **AI-assisted:** Initial boilerplate for Express routes, Tailwind class suggestions, debugging error messages
- **Written by hand:** All architecture decisions, the chunking strategy, the prompt engineering for Qwen, the async job processing pattern, the RAG retrieval logic
- **Where I overrode AI:** Claude suggested using LangChain for RAG — I chose to build it manually because I wanted to understand the pipeline and be able to explain every component in an interview. Claude also suggested keeping embeddings as 768-dim — I changed to 1024-dim after realizing BGE-large produces 1024-dim vectors and the mismatch was causing Qdrant errors.

## What I Would Change With 4 More Weeks

**For real users:**

1. **Timestamp-level grounding** — instead of "your Docker answer was weak", say "at 4:32 you said X which showed gap Y". This requires speaker diarization + timestamp alignment with Whisper's word-level output, which Whisper supports but I didn't implement.

2. **Speaker separation** — currently we treat the full transcript as one blob. In a real interview there's an interviewer and a candidate. Separating them lets us analyze only your answers, not the questions.

3. **Round tracking** — upload interviews from multiple rounds, see skill improvement over time. The sessionId architecture already supports this conceptually.

4. **Whisper Large V3 on A100** — current setup uses base model on A30 for speed. Large V3 on A100 would give near-perfect transcription, especially for technical terms like algorithm names and framework names.

5. **Persistent storage** — analysis results currently live in memory and disappear when the server restarts. MongoDB integration (already in the stack) would persist sessions across restarts.