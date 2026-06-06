# InterviewIQ — AI-Powered Interview Intelligence Copilot

Live Demo : https://interview-iq-nine-zeta.vercel.app/

## What It Does ?

InterviewIQ takes three inputs — your resume, job description, and interview recording and gives you a complete breakdown of your performance. It tells you which questions you answered well, which ones exposed gaps, what skills you're missing for the role, and gives you a personalized 3/7/14 day prep plan. You can also chat with it: ask "what was my weakest answer?" and it answers citing the exact timestamp in your recording.

## Why I Built This ?

I'm a final year ECE student at IIIT Kota, actively applying for internships. After every interview I'd walk out not knowing what actually went wrong. Memory right after a stressful interview is unreliable — I couldn't tell which questions I fumbled, which skills I failed to demonstrate, or what to study before round two. I've built full-stack products before but none of them solved this specific problem. I wanted something that could take the raw material of an interview — the audio, my resume, the JD — and turn it into something actionable. That's InterviewIQ.

The smallest useful version: upload three files, get back a breakdown that tells you what to do next.

## How To Run It ?

### Prerequisites
- Node.js 20+
- JarvisLabs account (for GPU inference)
- Qdrant Cloud free account

### 1. Clone
```bash
git clone https://github.com/KARTIKAY-SHUKLA1/InterviewIQ.git
cd InterviewIQ
```

### 2. Backend
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

### 3. Frontend
```bash
cd frontend
npm install
```

Create `frontend/.env`:
```env
VITE_BACKEND_URL=http://localhost:3000
```

### 4. JarvisLabs GPU Setup

Launch an A30 instance, then run:
```bash
pip install fastapi uvicorn openai-whisper transformers torch sentence-transformers accelerate python-multipart
conda install -c conda-forge ffmpeg -y
```

Start AI servers:
```bash
nohup uvicorn whisper_server:app --host 0.0.0.0 --port 8000 --app-dir /home/user/interviewiq &
nohup uvicorn embed_server:app --host 0.0.0.0 --port 8001 --app-dir /home/user/interviewiq &
nohup uvicorn qwen_server:app --host 0.0.0.0 --port 8002 --app-dir /home/user/interviewiq &
```

### 5. Start Backend
```bash
cd backend && node server.js
```

### 6. Start Frontend
```bash
cd frontend && npm run dev
```

### Sample Data
The `samples/` folder has a sample resume, JD, and 10 minute mock coding interview. Use these to test without recording your own interview.

## Example Questions The Chat Can Answer

These require combining information from multiple sources:

- *"What was my weakest answer?"* — uses transcript timestamps + JD requirements
- *"Which skills from the JD am I missing?"* — compares resume against JD
- *"What should I study before my next round?"* — pulls from all three sources to give a personalized plan

## Processing Time

| Audio Length | Time |
|---|---|
| 5 min | ~2 min |
| 10 min | ~4 min |
| 20 min | ~8 min |

## Architecture Decisions

###Why Whisper instead of cloud speech-to-text APIs ?
Interview recordings are personal and sensitive. Cloud APIs like AssemblyAI send your audio to third-party servers and charge per minute. Whisper is open source, runs on our own GPU, and costs nothing per call. Base model on A30 GPU handles a 10-minute interview in about 3-4 minutes.

###Why BGE-large for embeddings instead of OpenAI ?
BGE-large-en-v1.5 ranks at the top of the MTEB retrieval benchmark for open models. It produces 1024-dimensional vectors, runs on our GPU, and has zero cost per call. OpenAI embeddings are proprietary and add external dependency.

###Why Qdrant instead of Pinecone ?
Qdrant has a free cloud tier that works without credit card. More importantly it supports payload filtering — we use this to filter chunks by sessionId so each interview analysis is completely isolated from others. Pinecone's free tier has stricter index limits.

###Why chunk text instead of embedding full documents ?
A single resume vector can't answer "what projects did I mention?" — you need chunk-level retrieval. We split into 200-word pieces with 40-word overlap so context isn't lost at boundaries. This is what makes the chat actually precise rather than vague.

###Why async processing with polling instead of waiting for response ?
Whisper takes 3-5 minutes on a 10-minute file. Synchronous HTTP requests timeout through Cloudflare at 120 seconds. We return a jobId immediately, process in background, frontend polls every 5 seconds. Standard pattern for long-running AI tasks.

###Why timestamp citations in chat ?
Whisper returns word-level timestamps with every transcription. We store the start timestamp with each transcript chunk in Qdrant. When chat retrieves chunks, Qwen can say "at 03:28 you said..." so the user can verify exactly what moment in their interview is being referenced. This is what separates a useful answer from a generic one.

###Why not use LangChain ?
I built the RAG pipeline from scratch — custom chunker, direct Qdrant client, manual embedding calls. I wanted to understand every component and explain it clearly in an interview. LangChain would abstract it away and I'd be guessing at what's happening under the hood.

###Why Qwen3 instead of GPT-4 ?
This is a JarvisLabs assessment — running open models on GPU is the whole point. Qwen3-1.7B fits in A30 VRAM and responds in 30-60 seconds. For production I'd use Qwen3-8B on an A100 for sharper analysis quality.

---

## What I Used AI For

- **AI assisted:** Express boilerplate, Tailwind classes, debugging error messages
- **Written by hand:** Architecture decisions, chunking strategy, prompt engineering, async job pattern, RAG retrieval logic, timestamp citation implementation
- **Where I overrode AI:** Claude suggested LangChain — I built manually. Claude suggested 768-dim embeddings — I changed to 1024-dim after hitting a Qdrant dimension mismatch error.

---

## What I Would Change With 4 More Weeks

1. **Speaker diarization** — separate interviewer questions from candidate answers. Right now we treat the full transcript as one blob. Analyzing only the candidate's answers would make performance scoring much more accurate.

2. **Whisper Large V3 on A100** — current setup uses base model on A30 for speed. Large V3 gives near-perfect transcription especially for technical terms.

3. **Round tracking** — upload interviews from multiple rounds, track skill improvement over time. The sessionId architecture already supports this conceptually.

4. **Persistent storage** — analysis results live in memory and disappear on restart. MongoDB is already in the stack, just not wired up for session persistence.

5. **Confidence scoring per answer** — instead of just "weak" or "strong", show a percentage score for each answer based on how completely it addressed the JD requirement.