// Split text into overlapping chunks with metadata
// This is critical for good RAG — naive splitting loses context at boundaries

const chunkText = (text, source, options = {}) => {
  const {
    chunkSize = 300,    // words per chunk
    overlap = 50,       // words overlap between chunks
  } = options;

  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  let i = 0;
  let chunkIndex = 0;

  while (i < words.length) {
    const chunkWords = words.slice(i, i + chunkSize);
    const chunkText = chunkWords.join(" ");

    chunks.push({
      text: chunkText,
      source,           // "resume" | "jobDescription" | "transcript"
      chunkIndex,
      wordCount: chunkWords.length,
      startWord: i,
      endWord: i + chunkWords.length,
    });

    chunkIndex++;
    i += chunkSize - overlap; // slide window with overlap
  }

  return chunks;
};

// Chunk all three sources and tag them
const chunkAllSources = (resumeText, jdText, transcriptText) => {
  const resumeChunks = chunkText(resumeText, "resume", { chunkSize: 200, overlap: 40 });
  const jdChunks = chunkText(jdText, "jobDescription", { chunkSize: 200, overlap: 40 });
  const transcriptChunks = chunkText(transcriptText, "transcript", { chunkSize: 250, overlap: 60 });

  return [...resumeChunks, ...jdChunks, ...transcriptChunks];
};

module.exports = { chunkText, chunkAllSources };