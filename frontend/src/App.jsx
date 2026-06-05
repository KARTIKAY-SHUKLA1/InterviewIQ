import { useState } from "react";
import UploadPage from "./pages/UploadPage";
import ResultsPage from "./pages/ResultsPage";
import "./App.css";

function App() {
  const [analysisData, setAnalysisData] = useState(null);

  return (
    <div className="app">
      {!analysisData ? (
        <UploadPage onAnalysisComplete={setAnalysisData} />
      ) : (
        <ResultsPage data={analysisData} />
      )}
    </div>
  );
}

export default App;