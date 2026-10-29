"use client";

import { useState } from "react";

type ScoringResponse = {
  transaction_id: string;
  mode_used: string;
  ml_score: number | null;
  llm_score: number | null;
  llm_reasoning: string | null;
  llm_signals: string[] | null;
  final_verdict: string;
  confidence: string;
};

type ChatBotProps = {
  context: ScoringResponse | null;
};

type Message = { role: "user" | "bot"; text: string };

export default function ChatBot({ context }: ChatBotProps) {
  const [role, setRole] = useState<"customer" | "admin">("admin");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || !context) return;
    
    const userMsg: Message = { role: "user", text: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, message: input, context }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "bot", text: data.reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "bot", text: "Failed to connect to backend." }]);
    } finally {
      setLoading(false);
    }
  };

  if (!context) {
    return <div className="p-6 bg-gray-100 rounded-xl text-center text-gray-500">Run a transaction first to enable the chatbots.</div>;
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">💬 Fraud Investigation Chat</h3>
        <div className="flex gap-2">
          <button 
            onClick={() => { setRole("admin"); setMessages([]); }}
            className={`px-3 py-1 text-xs rounded-full border ${role === "admin" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300"}`}
          >
            Admin Mode
          </button>
          <button 
            onClick={() => { setRole("customer"); setMessages([]); }}
            className={`px-3 py-1 text-xs rounded-full border ${role === "customer" ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-300"}`}
          >
            Customer Mode
          </button>
        </div>
      </div>

      {/* Chat History */}
      <div className="h-64 overflow-y-auto bg-gray-50 p-4 rounded-lg mb-4 space-y-3 border border-gray-100">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400 text-center mt-10">
            {role === "admin" ? "Ask about the signals, ML score, or reasoning..." : "Ask why your transaction was declined..."}
          </p>
        )}
        {messages.map((msg, idx) => (
          // Only render if there is actual text
          msg.text && msg.text.trim() !== "" ? (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] p-3 rounded-lg text-sm whitespace-pre-wrap ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-800"}`}>
                {msg.text}
              </div>
            </div>
          ) : null
        ))}
        {loading && <div className="text-xs text-gray-400 animate-pulse">AI is thinking...</div>}
      </div>

      {/* Input Area */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={role === "admin" ? "e.g., Why did the LLM flag this?" : "e.g., Why was my payment declined?"}
          className="flex-1 p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
        />
        <button 
          onClick={handleSend} 
          disabled={loading}
          className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}