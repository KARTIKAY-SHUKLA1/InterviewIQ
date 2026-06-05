import { useState } from "react";
import UploadPage from "./pages/UploadPage";
import ResultsPage from "./pages/ResultsPage";

function App() {
  const [analysisData, setAnalysisData] = useState(null);

  return (
    <div className="min-h-screen bg-[#080810] text-white">
      {!analysisData ? (
        <UploadPage onAnalysisComplete={setAnalysisData} />
      ) : (
        <ResultsPage data={analysisData} onBack={() => setAnalysisData(null)} />
      )}
    </div>
  );
}

export default App;