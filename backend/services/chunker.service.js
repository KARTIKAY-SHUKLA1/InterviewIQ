const chunkText = (text, source, options = {}) => {
  const {
    chunkSize = 300,
    overlap = 50,
  } = options;

  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  let i = 0;
  let chunkIndex = 0;

  while (i < words.length) {
    const chunkWords = words.slice(i, i + chunkSize);
    const chunkText = chunkWords.join(" ");

    // Extract timestamp from chunk if it exists (format [MM:SS])
    const timestampMatch = chunkText.match(/\[(\d{2}:\d{2})\]/);
    const timestamp = timestampMatch ? timestampMatch[1] : null;

    chunks.push({
      text: chunkText,
      source,
      chunkIndex,
      wordCount: chunkWords.length,
      startWord: i,
      endWord: i + chunkWords.length,
      timestamp, // null for resume/JD, actual time for transcript
    });

    chunkIndex++;
    i += chunkSize - overlap;
  }

  return chunks;
};

const chunkAllSources = (resumeText, jdText, transcriptText) => {
  const resumeChunks = chunkText(resumeText, "resume", { chunkSize: 200, overlap: 40 });
  const jdChunks = chunkText(jdText, "jobDescription", { chunkSize: 200, overlap: 40 });
  const transcriptChunks = chunkText(transcriptText, "transcript", { chunkSize: 250, overlap: 60 });

  return [...resumeChunks, ...jdChunks, ...transcriptChunks];
};

module.exports = { chunkText, chunkAllSources };