from fastapi import FastAPI
from sentence_transformers import SentenceTransformer
from pydantic import BaseModel
from typing import List

app = FastAPI()
model = SentenceTransformer("BAAI/bge-large-en-v1.5")

class EmbedRequest(BaseModel):
    input: List[str]
    model: str = "BAAI/bge-large-en-v1.5"

@app.post("/v1/embeddings")
def embed(req: EmbedRequest):
    embeddings = model.encode(req.input).tolist()
    return {
        "data": [{"embedding": emb, "index": i} for i, emb in enumerate(embeddings)],
        "model": req.model
    }
