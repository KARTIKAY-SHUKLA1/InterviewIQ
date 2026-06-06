from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

app = FastAPI()

model_name = "Qwen/Qwen3-8B"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=torch.float16,
    device_map="cuda"
)

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model: str = model_name
    messages: List[Message]
    temperature: float = 0.3
    max_tokens: int = 500

@app.post("/v1/chat/completions")
def chat(req: ChatRequest):
    text = tokenizer.apply_chat_template(
        [m.dict() for m in req.messages],
        tokenize=False,
        add_generation_prompt=True,
        enable_thinking=False
    )
    inputs = tokenizer([text], return_tensors="pt").to(model.device)
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=req.max_tokens,
            temperature=req.temperature,
            do_sample=True
        )
    response = tokenizer.decode(
        outputs[0][len(inputs.input_ids[0]):],
        skip_special_tokens=True
    )
    return {
        "choices": [{
            "message": {"role": "assistant", "content": response},
            "finish_reason": "stop"
        }]
    }
