const getEmbeddings = async (texts) => {
  console.log("Using stub embeddings (BGE will replace on JarvisLabs)");
  return texts.map(() =>
    Array.from({ length: 768 }, () => Math.random() * 2 - 1)
  );
};

const getSingleEmbedding = async (text) => {
  const embeddings = await getEmbeddings([text]);
  return embeddings[0];
};

module.exports = { getEmbeddings, getSingleEmbedding };