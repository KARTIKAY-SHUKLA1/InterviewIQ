function App() {
  return (
    <div style={{ padding: "40px" }}>
      <h1>InterviewIQ</h1>

      <br />

      <div>
        <h3>Upload Resume</h3>
        <input type="file" />
      </div>

      <br />

      <div>
        <h3>Upload Job Description</h3>
        <input type="file" />
      </div>

      <br />

      <div>
        <h3>Upload Interview Recording</h3>
        <input type="file" />
      </div>

      <br />

      <button>Analyze Interview</button>
    </div>
  );
}

export default App;