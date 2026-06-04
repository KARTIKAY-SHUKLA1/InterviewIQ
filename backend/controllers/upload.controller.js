const handleUpload = async (req, res) => {
  try {
    const files = req.files;

    // Validate all three files are present
    if (!files.resume || !files.jobDescription || !files.audio) {
      return res.status(400).json({
        success: false,
        message: "Please upload all three files: resume, jobDescription, audio",
        received: Object.keys(files),
      });
    }

    const resume = files.resume[0];
    const jobDescription = files.jobDescription[0];
    const audio = files.audio[0];

    return res.status(200).json({
      success: true,
      message: "Files uploaded successfully",
      files: {
        resume: {
          originalName: resume.originalname,
          savedAs: resume.filename,
          size: resume.size,
          path: resume.path,
        },
        jobDescription: {
          originalName: jobDescription.originalname,
          savedAs: jobDescription.filename,
          size: jobDescription.size,
          path: jobDescription.path,
        },
        audio: {
          originalName: audio.originalname,
          savedAs: audio.filename,
          size: audio.size,
          path: audio.path,
        },
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({
      success: false,
      message: "Upload failed",
      error: error.message,
    });
  }
};

module.exports = { handleUpload };