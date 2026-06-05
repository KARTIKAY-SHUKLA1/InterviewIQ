import { useState } from "react";
import { CheckCircle, AlertTriangle, Send, ArrowLeft } from "lucide-react";
import { sendChatMessage } from "../utils/api";

const ResultsPage = ({ data, onBack }) => {
  const { analysis, sessionId, pipeline } = data;
  const [activeTab, setActiveTab] = useState("summary");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `Hi! I've analyzed your interview. You scored **${analysis.performance.overallScore}/100** with a **${analysis.skillGap.matchScore}% skill match**. Ask me anything!`,
    },
  ]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || chatLoading) return;
    const q = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setChatLoading(true);
    try {
      const result = await sendChatMessage(q, sessionId, analysis);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: result.answer,
        sources: result.sourcesUsed,
        chunks: result.chunksRetrieved,
      }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const renderMarkdown = (text) => ({
    __html: text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>')
  });

  const tabs = ["summary", "skills", "performance", "roadmap", "chat"];
  const tabLabels = { summary: "Summary", skills: "Skill Gap", performance: "Performance", roadmap: "Roadmap", chat: "Chat" };

  return (
    <div className="min-h-screen px-4 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-4 transition-colors">
          <ArrowLeft size={16} /> New Analysis
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Interview Analysis
            </h1>
            <div className="flex gap-2 mt-2 flex-wrap">
              {[
                `${pipeline.resumeWords} resume words`,
                `${pipeline.jdWords} JD words`,
                `${pipeline.chunksCreated} chunks`,
                "Qdrant ✓",
                "Whisper ✓",
                "Qwen ✓",
              ].map((item) => (
                <span key={item} className="text-xs bg-white/5 border border-white/10 text-slate-400 px-2.5 py-1 rounded-full">
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <div className="text-center bg-indigo-500/10 border border-indigo-500/20 px-5 py-3 rounded-xl">
              <p className="text-3xl font-bold text-indigo-400">{analysis.performance.overallScore}</p>
              <p className="text-xs text-slate-500">Score</p>
            </div>
            <div className="text-center bg-blue-500/10 border border-blue-500/20 px-5 py-3 rounded-xl">
              <p className="text-3xl font-bold text-blue-400">{analysis.skillGap.matchScore}%</p>
              <p className="text-xs text-slate-500">Match</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.03] border border-white/10 p-1 rounded-xl mb-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">

        {/* Summary */}
        {activeTab === "summary" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Interview Summary</h2>
            <p className="text-slate-400 leading-relaxed mb-6">{analysis.summary.overallSummary}</p>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Questions Asked</h3>
                <ul className="space-y-2">
                  {analysis.summary.questionsAsked.map((q, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-400">
                      <span className="text-indigo-400 mt-0.5">→</span> {q}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Topics Covered</h3>
                <div className="flex flex-wrap gap-2">
                  {analysis.summary.topicsCovered.map((t, i) => (
                    <span key={i} className="text-xs bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Skills */}
        {activeTab === "skills" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Skill Gap Analysis</h2>
            <div className="mb-6">
              <div className="flex justify-between text-sm text-slate-400 mb-2">
                <span>Skill Match</span>
                <span>{analysis.skillGap.matchScore}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                  style={{ width: `${analysis.skillGap.matchScore}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <h3 className="text-sm font-semibold text-green-400 mb-3">✓ Your Skills</h3>
                <div className="space-y-2">
                  {analysis.skillGap.candidateSkills.map((s, i) => (
                    <div key={i} className="text-sm bg-green-500/10 border border-green-500/20 text-green-300 px-3 py-2 rounded-lg">{s}</div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-blue-400 mb-3">◎ Required</h3>
                <div className="space-y-2">
                  {analysis.skillGap.requiredSkills.map((s, i) => (
                    <div key={i} className="text-sm bg-blue-500/10 border border-blue-500/20 text-blue-300 px-3 py-2 rounded-lg">{s}</div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-red-400 mb-3">✗ Missing</h3>
                <div className="space-y-2">
                  {analysis.skillGap.missingSkills.map((s, i) => (
                    <div key={i} className="text-sm bg-red-500/10 border border-red-500/20 text-red-300 px-3 py-2 rounded-lg">{s}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Performance */}
        {activeTab === "performance" && (
          <div>
            <h2 className="text-xl font-semibold mb-6">Performance Analysis</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="flex items-center gap-2 text-green-400 font-semibold mb-4">
                  <CheckCircle size={16} /> Strong Answers
                </h3>
                <div className="space-y-3">
                  {analysis.performance.strongAnswers.map((a, i) => (
                    <div key={i} className="bg-green-500/5 border-l-2 border-green-500 pl-4 py-3 pr-3 rounded-r-lg">
                      <p className="font-medium text-sm text-green-300 mb-1">{a.question}</p>
                      <p className="text-xs text-slate-400">{a.why}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="flex items-center gap-2 text-red-400 font-semibold mb-4">
                  <AlertTriangle size={16} /> Weak Answers
                </h3>
                <div className="space-y-3">
                  {analysis.performance.weakAnswers.map((a, i) => (
                    <div key={i} className="bg-red-500/5 border-l-2 border-red-500 pl-4 py-3 pr-3 rounded-r-lg">
                      <p className="font-medium text-sm text-red-300 mb-1">{a.question}</p>
                      <p className="text-xs text-slate-400 mb-2">{a.why}</p>
                      <p className="text-xs text-amber-400">💡 {a.improvement}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Roadmap */}
        {activeTab === "roadmap" && (
          <div>
            <h2 className="text-xl font-semibold mb-6">Preparation Roadmap</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "3 Days", items: analysis.roadmap.threeDays, color: "indigo" },
                { label: "7 Days", items: analysis.roadmap.sevenDays, color: "purple" },
                { label: "14 Days", items: analysis.roadmap.fourteenDays, color: "pink" },
              ].map(({ label, items, color }) => (
                <div key={label}>
                  <h3 className={`text-sm font-bold mb-3 text-${color}-400`}>{label}</h3>
                  <div className="space-y-2">
                    {items.map((item, i) => (
                      <div key={i} className="text-xs text-slate-400 bg-white/[0.03] border border-white/5 p-3 rounded-lg leading-relaxed">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat */}
        {activeTab === "chat" && (
          <div className="flex flex-col h-[500px]">
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages.length === 1 && (
                <div className="text-center py-8 text-slate-600 text-sm">
                  <p className="text-3xl mb-2">💬</p>
                  <p>Ask anything about your interview</p>
                  <p className="text-xs mt-1">Powered by RAG — answers cite your actual documents</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] ${msg.role === "user" ? "order-1" : ""}`}>
                    <div
                      className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-indigo-600 text-white rounded-br-sm"
                          : "bg-white/[0.05] border border-white/10 text-slate-300 rounded-bl-sm"
                      }`}
                      dangerouslySetInnerHTML={renderMarkdown(msg.content)}
                    />
                    {msg.sources && (
                      <p className="text-xs text-slate-600 mt-1 px-1">
                        Sources: {msg.sources.join(", ")} · {msg.chunks} chunks
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/[0.05] border border-white/10 px-4 py-3 rounded-2xl rounded-bl-sm">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{animationDelay:"0ms"}}/>
                      <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{animationDelay:"150ms"}}/>
                      <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{animationDelay:"300ms"}}/>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Suggestions */}
            <div className="flex gap-2 mb-3 flex-wrap">
              {["What was my weakest answer?", "Which skills am I missing?", "What should I prepare first?"].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="text-xs border border-white/10 text-slate-400 hover:text-white hover:border-indigo-500/50 px-3 py-1.5 rounded-full transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask about your interview..."
                className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500/50 transition-colors"
              />
              <button
                onClick={sendMessage}
                disabled={chatLoading}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-3 rounded-xl transition-colors"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsPage;