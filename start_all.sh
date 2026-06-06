#!/bin/bash
echo "Installing dependencies..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs
pip install fastapi uvicorn openai-whisper transformers torch sentence-transformers accelerate python-multipart
conda install -c conda-forge ffmpeg -y

echo "Starting AI services..."
cd /home/user/interviewiq
nohup /root/miniconda3/envs/py3.10/bin/uvicorn whisper_server:app --host 0.0.0.0 --port 8000 --app-dir /home/user/interviewiq &
nohup /root/miniconda3/envs/py3.10/bin/uvicorn embed_server:app --host 0.0.0.0 --port 8001 --app-dir /home/user/interviewiq &
nohup /root/miniconda3/envs/py3.10/bin/uvicorn qwen_server:app --host 0.0.0.0 --port 8002 --app-dir /home/user/interviewiq &

echo "Waiting 90 seconds for Qwen 8B to load..."
sleep 90

echo "Starting Node.js backend..."
cd /home/user/InterviewIQ/backend
node server.js &
echo "All services started!"
