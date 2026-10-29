"use client";

import { useState } from "react";
import Layout from "@/components/Layout";
import FeatureAttributions from "@/components/FeatureAttributions";

type Investigation = {
  id: string;
  account_id: string;
  alert_id: string | null;
  notes: string;
  status: "open" | "closed";
  analyst: string;
  created_at: string;
  updated_at: string;
};

type ScoreResult = {
  account_id: string;
  fraud_probability: number;
  risk_score: number;
  risk_level: string;
  recommended_action: string;
  decision_reasons: string[];
  top_risk_factors: string[];
  feature_attributions: { feature: string; value: number; contribution: number }[];
  model_version: string;
  processing_ms: number;
};

export default function InvestigationPage() {
  const [selectedAccount, setSelectedAccount] = useState("");
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"open" | "closed">("open");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadInvestigation = async () => {
    if (!selectedAccount.trim()) return;
    
    setLoading(true);
    setMessage("");
    
    try {
      // Load investigation AND score in parallel
      const [invRes, scoreRes] = await Promise.all([
        fetch(`http://127.0.0.1:8000/api/investigations/${selectedAccount}`),
        fetch(`http://127.0.0.1:8000/graph-score-by-account/${selectedAccount}`, { method: "POST" })
      ]);
      
      const invData = await invRes.json();
      const scoreData = await scoreRes.json();
      
      if (invData) {
        setInvestigation(invData);
        setNotes(invData.notes || "");
        setStatus(invData.status);
      } else {
        setInvestigation(null);
        setNotes("");
        setStatus("open");
      }
      
      setScoreResult(scoreData);
    } catch (err) {
      console.error("Failed to load:", err);
      setMessage("❌ Failed to load account data");
    } finally {
      setLoading(false);
    }
  };

  const saveInvestigation = async () => {
    if (!selectedAccount.trim()) return;
    
    setLoading(true);
    try {
      if (investigation) {
        const res = await fetch(`http://127.0.0.1:8000/api/investigations/${investigation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes, status }),
        });
        
        if (res.ok) {
          setMessage("✅ Investigation updated successfully");
          setTimeout(() => setMessage(""), 3000);
        }
      } else {
        const res = await fetch(`http://127.0.0.1:8000/api/investigations?account_id=${selectedAccount}&notes=${encodeURIComponent(notes)}`, {
          method: "POST",
        });
        
        if (res.ok) {
          const data = await res.json();
          setMessage(`✅ Investigation created: ${data.investigation_id}`);
          setTimeout(() => setMessage(""), 3000);
          loadInvestigation();
        }
      }
    } catch (err) {
      console.error("Failed to save:", err);
      setMessage("❌ Failed to save investigation");
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    if (level === "high") return "text-red-400 bg-red-500/10 border-red-500/30";
    if (level === "medium") return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
    return "text-green-400 bg-green-500/10 border-green-500/30";
  };

  const getActionColor = (action: string) => {
    if (action === "decline") return "bg-red-600 hover:bg-red-700";
    if (action === "review") return "bg-yellow-600 hover:bg-yellow-700";
    return "bg-green-600 hover:bg-green-700";
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Investigation Workspace</h1>
          <p className="text-gray-400 mt-1 text-sm">Deep-dive analysis with AI-powered risk attribution</p>
        </div>

        {message && (
          <div className={`p-4 rounded-lg border ${message.includes("✅") ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
            {message}
          </div>
        )}

        {/* Account Lookup */}
        <div className="bg-[#111827] border border-white/5 rounded-xl p-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">Account ID Lookup</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadInvestigation()}
              placeholder="Enter account ID (e.g., 10_8000EBD30)..."
              className="flex-1 p-3 bg-[#0B0F19] border border-white/10 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500/50 transition"
            />
            <button
              onClick={loadInvestigation}
              disabled={loading || !selectedAccount.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition disabled:opacity-50"
            >
              {loading ? "Loading..." : "Investigate"}
            </button>
          </div>
        </div>

        {/* Score Result + SHAP Chart */}
        {scoreResult && (
          <div className="space-y-6">
            {/* Score Banner */}
            <div className={`p-6 rounded-xl border-2 flex justify-between items-center ${
              scoreResult.risk_level === 'high' ? 'bg-red-500/5 border-red-500/30' :
              scoreResult.risk_level === 'medium' ? 'bg-yellow-500/5 border-yellow-500/30' :
              'bg-green-500/5 border-green-500/30'
            }`}>
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">Account ID</div>
                <div className="text-xl font-mono font-bold text-white">{scoreResult.account_id}</div>
                <div className="flex gap-2 mt-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getRiskColor(scoreResult.risk_level)}`}>
                    {scoreResult.risk_level.toUpperCase()} RISK
                  </span>
                  <button className={`px-4 py-1 rounded-lg text-xs font-bold text-white uppercase ${getActionColor(scoreResult.recommended_action)}`}>
                    {scoreResult.recommended_action}
                  </button>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">Risk Score</div>
                <div className={`text-5xl font-bold tabular-nums ${
                  scoreResult.risk_level === 'high' ? 'text-red-400' :
                  scoreResult.risk_level === 'medium' ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {scoreResult.risk_score}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Probability: {(scoreResult.fraud_probability * 100).toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Decision Reasons */}
            {scoreResult.decision_reasons.length > 0 && (
              <div className="bg-[#111827] border border-white/5 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Decision Rationale</h3>
                <ul className="space-y-2">
                  {scoreResult.decision_reasons.map((reason, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-blue-400 mt-0.5">▸</span>
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* SHAP Chart */}
            <FeatureAttributions 
              attributions={scoreResult.feature_attributions} 
              metadata={{
                model_version: scoreResult.model_version,
                processing_ms: scoreResult.processing_ms
              }}
            />
          </div>
        )}

        {/* Investigation Notes */}
        <div className="bg-[#111827] border border-white/5 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Analyst Notes</h3>
            {investigation && (
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  investigation.status === "open" ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"
                }`}>
                  {investigation.status.toUpperCase()}
                </span>
                <span className="text-xs text-gray-500">ID: {investigation.id}</span>
              </div>
            )}
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Document findings, evidence, and conclusions..."
            rows={6}
            className="w-full p-3 bg-[#0B0F19] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50 transition"
          />

          <div className="flex items-center justify-between mt-4">
            <div className="flex gap-2">
              <button
                onClick={() => setStatus("open")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  status === "open" ? "bg-yellow-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                Open
              </button>
              <button
                onClick={() => setStatus("closed")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  status === "closed" ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                Closed
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={saveInvestigation}
                disabled={loading || !selectedAccount.trim()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50"
              >
                {loading ? "Saving..." : investigation ? "Update Notes" : "Create Investigation"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}