const fs = require("fs");
const pdfParse = require("pdf-parse").default || require("pdf-parse");

const extractTextFromPDF = async (filePath) => {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);

    // Clean up extracted text
    const text = data.text
      .replace(/\s+/g, " ")
      .trim();

    return {
      success: true,
      text,
      pages: data.numpages,
      wordCount: text.split(" ").length,
    };
  } catch (error) {
    console.error("PDF parse error:", error);
    return {
      success: false,
      error: error.message,
      text: "",
    };
  }
};

module.exports = { extractTextFromPDF };