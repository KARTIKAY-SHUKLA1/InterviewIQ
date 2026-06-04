const { QdrantClient } = require("@qdrant/js-client-rest");

const COLLECTION_NAME = "interviewiq";
const VECTOR_SIZE = 1024;

const getClient = () => {
  return new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    checkCompatibility: false,
  });
};

const ensureCollection = async () => {
  try {
    const client = getClient();
    const collections = await client.getCollections();
    const exists = collections.collections.some(c => c.name === COLLECTION_NAME);
    if (!exists) {
      await client.createCollection(COLLECTION_NAME, {
        vectors: { size: VECTOR_SIZE, distance: "Cosine" },
      });
      console.log("Qdrant collection created");
    } else {
      console.log("Qdrant collection exists");
    }
  } catch (error) {
    console.error("Qdrant ensureCollection error:", error.message);
    throw error;
  }
};

const storeChunks = async (chunks, embeddings, sessionId) => {
  const client = getClient();
  await ensureCollection();

  const numericPoints = chunks.map((chunk, idx) => ({
    id: Date.now() + idx,
    vector: embeddings[idx],
    payload: {
      text: chunk.text,
      source: chunk.source,
      chunkIndex: chunk.chunkIndex,
      sessionId,
      startWord: chunk.startWord,
      endWord: chunk.endWord,
    },
  }));

  await client.upsert(COLLECTION_NAME, { points: numericPoints });
  console.log(`Stored ${chunks.length} chunks in Qdrant`);
  return numericPoints.map((p) => p.id);
};

const searchChunks = async (queryEmbedding, sessionId, limit = 5) => {
  const client = getClient();
  const results = await client.search(COLLECTION_NAME, {
    vector: queryEmbedding,
    limit,
    filter: {
      must: [{ key: "sessionId", match: { value: sessionId } }],
    },
    with_payload: true,
  });

  return results.map((r) => ({
    text: r.payload.text,
    source: r.payload.source,
    score: r.score,
    chunkIndex: r.payload.chunkIndex,
  }));
};

module.exports = { ensureCollection, storeChunks, searchChunks };