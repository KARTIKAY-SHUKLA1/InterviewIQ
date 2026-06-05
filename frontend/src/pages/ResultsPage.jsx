import { useState } from "react";
import { MessageCircle, TrendingUp, AlertTriangle, CheckCircle, Send, Brain } from "lucide-react";
import { sendChatMessage } from "../utils/api";

const ResultsPage = ({ data }) => {
  const { analysis, sessionId, pipeline } = data;
  const [activeTab, setActiveTab] = useState("summary");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `Hi! I've analyzed your interview. You scored ${analysis.performance.overallScore}/100 with a ${analysis.skillGap.matchScore}% skill match. Ask me anything about your performance!`,
    },
  ]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || chatLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setChatLoading(true);

    try {
      const result = await sendChatMessage(userMessage, sessionId, analysis);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.answer,
          sources: result.sourcesUsed,
          chunks: result.chunksRetrieved,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't process that. Try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "skills", label: "Skill Gap" },
    { id: "performance", label: "Performance" },
    { id: "roadmap", label: "Roadmap" },
    { id: "chat", label: "Chat" },
  ];

  return (
    <div className="results-page">
      <div className="results-header">
        <div>
          <h1>Interview Analysis</h1>
          <p>
            {pipeline.resumeWords} resume words · {pipeline.jdWords} JD words ·{" "}
            {pipeline.chunksCreated} chunks · Qdrant ✓ · Whisper ✓ · Qwen ✓
          </p>
        </div>
        <div className="score-badges">
          <div className="score-badge purple">
            <strong>{analysis.performance.overallScore}</strong>
            <span>Score</span>
          </div>
          <div className="score-badge blue">
            <strong>{analysis.skillGap.matchScore}%</strong>
            <span>Match</span>
          </div>
        </div>
      </div>

      <div className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === "summary" && (
          <div className="card">
            <h2>Interview Summary</h2>
            <p className="summary-text">{analysis.summary.overallSummary}</p>
            <div className="two-col">
              <div>
                <h3>Questions Asked</h3>
                <ul>
                  {analysis.summary.questionsAsked.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Topics Covered</h3>
                <div className="tag-list">
                  {analysis.summary.topicsCovered.map((t, i) => (
                    <span key={i} className="tag">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "skills" && (
          <div className="card">
            <h2>Skill Gap Analysis</h2>
            <div className="match-bar">
              <div className="match-fill" style={{ width: `${analysis.skillGap.matchScore}%` }} />
              <span>{analysis.skillGap.matchScore}% match</span>
            </div>
            <div className="three-col">
              <div>
                <h3 className="green">Your Skills</h3>
                {analysis.skillGap.candidateSkills.map((s, i) => (
                  <div key={i} className="skill-item green">{s}</div>
                ))}
              </div>
              <div>
                <h3 className="blue">Required</h3>
                {analysis.skillGap.requiredSkills.map((s, i) => (
                  <div key={i} className="skill-item blue">{s}</div>
                ))}
              </div>
              <div>
                <h3 className="red">Missing</h3>
                {analysis.skillGap.missingSkills.map((s, i) => (
                  <div key={i} className="skill-item red">{s}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "performance" && (
          <div className="card">
            <h2>Performance Analysis</h2>
            <div className="two-col">
              <div>
                <h3 className="green">
                  <CheckCircle size={16} /> Strong Answers
                </h3>
                {analysis.performance.strongAnswers.map((a, i) => (
                  <div key={i} className="answer-card green">
                    <strong>{a.question}</strong>
                    <p>{a.why}</p>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="red">
                  <AlertTriangle size={16} /> Weak Answers
                </h3>
                {analysis.performance.weakAnswers.map((a, i) => (
                  <div key={i} className="answer-card red">
                    <strong>{a.question}</strong>
                    <p>{a.why}</p>
                    <p className="improvement">💡 {a.improvement}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "roadmap" && (
          <div className="card">
            <h2>Preparation Roadmap</h2>
            <div className="three-col">
              <div className="roadmap-col">
                <h3>3 Days</h3>
                {analysis.roadmap.threeDays.map((t, i) => (
                  <div key={i} className="roadmap-item">{t}</div>
                ))}
              </div>
              <div className="roadmap-col">
                <h3>7 Days</h3>
                {analysis.roadmap.sevenDays.map((t, i) => (
                  <div key={i} className="roadmap-item">{t}</div>
                ))}
              </div>
              <div className="roadmap-col">
                <h3>14 Days</h3>
                {analysis.roadmap.fourteenDays.map((t, i) => (
                  <div key={i} className="roadmap-item">{t}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "chat" && (
          <div className="chat-container">
            <div className="chat-messages">
              {messages.map((msg, i) => (
                <div key={i} className={`message ${msg.role}`}>
                  <div className="message-content">{msg.content}</div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="message-sources">
                      Sources: {msg.sources.join(", ")} · {msg.chunks} chunks
                    </div>
                  )}
                </div>
              ))}
              {chatLoading && (
                <div className="message assistant">
                  <div className="message-content typing">Thinking...</div>
                </div>
              )}
            </div>
            <div className="chat-input-row">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask about your interview... e.g. What was my weakest answer?"
                className="chat-input"
              />
              <button onClick={sendMessage} disabled={chatLoading} className="send-btn">
                <Send size={18} />
              </button>
            </div>
            <div className="chat-suggestions">
              {["What was my weakest answer?", "Which skills am I missing?", "What should I prepare first?"].map((q) => (
                <button key={q} onClick={() => { setInput(q); }} className="suggestion">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsPage;