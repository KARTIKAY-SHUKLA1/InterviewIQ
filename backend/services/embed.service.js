const axios = require("axios");

const getEmbeddings = async (texts) => {
  if (!process.env.EMBED_API_URL) {
    console.log("⚠️  Embed stub mode");
    return texts.map(() =>
      Array.from({ length: 768 }, () => Math.random() * 2 - 1)
    );
  }

  try {
    const response = await axios.post(
      `${process.env.EMBED_API_URL}/v1/embeddings`,
      {
        input: texts,
        model: "BAAI/bge-large-en-v1.5",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.EMBED_API_KEY || "dummy"}`,
        },
        timeout: 60000,
      }
    );

    return response.data.data.map((item) => item.embedding);
  } catch (error) {
    console.error("Embedding error:", error.message);
    console.log("⚠️  Falling back to stub embeddings");
    return texts.map(() =>
      Array.from({ length: 768 }, () => Math.random() * 2 - 1)
    );
  }
};

const getSingleEmbedding = async (text) => {
  const embeddings = await getEmbeddings([text]);
  return embeddings[0];
};

module.exports = { getEmbeddings, getSingleEmbedding };