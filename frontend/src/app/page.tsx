"use client";

import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Layout from "@/components/Layout";
import FeatureAttributions from "@/components/FeatureAttributions";
import AgentOpinions from "@/components/AgentOpinions";

const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

const ACCOUNT_CATEGORIES = [
  {
    name: "Known Fraud",
    icon: "🚨",
    color: "red",
    description: "Confirmed laundering accounts",
    accounts: [
      { id: "10_8000EBD30", label: "Primary Launderer" },
      { id: "8_80907D370", label: "High-Risk #1" },
      { id: "795_8010A5680", label: "High-Risk #2" },
    ],
  },
  {
    name: "High Risk",
    icon: "⚠️",
    color: "orange",
    description: "Top suspicious accounts",
    accounts: [
      { id: "5627_8036BB8D0", label: "Suspicious #3" },
      { id: "513_8003491D0", label: "Suspicious #4" },
      { id: "410_800276DD0", label: "Suspicious #5" },
    ],
  },
  {
    name: "Medium Risk",
    icon: "🔍",
    color: "yellow",
    description: "Accounts with unusual patterns",
    accounts: [
      { id: "23_80017F480", label: "Unusual #1" },
      { id: "223_811A65E30", label: "Unusual #2" },
    ],
  },
  {
    name: "Low Risk",
    icon: "✅",
    color: "green",
    description: "Normal customer accounts",
    accounts: [
      { id: "10_8000F4580", label: "Ahmed A. - Regular" },
      { id: "3209_8000F4670", label: "Business Account" },
      { id: "70_100428660", label: "High Volume (Legit)" },
    ],
  },
];

type SingleScoreResult = {
  account_id: string;
  risk_score: number;
  fraud_probability: number;
  risk_level: string;
  recommended_action: string;
  feature_attributions: { feature: string; value: number; contribution: number }[];
  model_version: string;
  processing_ms: number;
  explanation_available: boolean;
};

type BatchPredictResult = {
  account_id: string;
  risk_score: number;
  fraud_probability: number;
  risk_level: string;
  recommended_action: string;
  status: string;
};

export default function Home() {
  const [customAccountId, setCustomAccountId] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [singleResult, setSingleResult] = useState<SingleScoreResult | null>(null);
  const [loadingSingle, setLoadingSingle] = useState(false);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [agentOpinions, setAgentOpinions] = useState<any[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  const [stats, setStats] = useState({ total: 0, high_risk: 0, pending_review: 0, total_volume: 0 });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [riskData, setRiskData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);

  // NEW: Batch file upload states
  const [batchFileAccounts, setBatchFileAccounts] = useState<string[]>([]);
  const [batchFileResults, setBatchFileResults] = useState<BatchPredictResult[]>([]);
  const [batchFileErrors, setBatchFileErrors] = useState<any[]>([]);
  const [loadingBatchFile, setLoadingBatchFile] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [txRes, statsRes] = await Promise.all([
        fetch("http://127.0.0.1:8000/api/transactions?limit=50"),
        fetch("http://127.0.0.1:8000/api/transactions/stats")
      ]);
      
      const txData = await txRes.json();
      const statsData = await statsRes.json();
      
      setStats(statsData);
      setTransactions(txData.transactions);

      const low = txData.transactions.filter((t: any) => t.risk_score < 40).length;
      const med = txData.transactions.filter((t: any) => t.risk_score >= 40 && t.risk_score < 70).length;
      const high = txData.transactions.filter((t: any) => t.risk_score >= 70).length;
      
      setRiskData([
        { name: 'Low Risk', value: low },
        { name: 'Medium Risk', value: med },
        { name: 'High Risk', value: high },
      ]);

      setStatusData([
        { name: 'Approved', value: txData.transactions.filter((t: any) => t.status === 'approved').length },
        { name: 'Review', value: txData.transactions.filter((t: any) => t.status === 'review').length },
        { name: 'Declined', value: txData.transactions.filter((t: any) => t.status === 'declined').length },
      ]);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    }
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      red: "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20",
      orange: "bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20",
      yellow: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20",
      green: "bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20",
    };
    return colors[color] || colors.green;
  };

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(accountId)) {
        newSet.delete(accountId);
      } else {
        newSet.add(accountId);
      }
      return newSet;
    });
  };

  const isSelected = (accountId: string) => selectedAccounts.has(accountId);

  const runSingleScore = async (accountId: string) => {
    if (!accountId.trim()) return;
    setLoadingSingle(true);
    setLoadingAgents(true);
    setSingleResult(null);
    setAgentOpinions([]);
    setError(null);

    try {
      const [scoreRes, agentsRes] = await Promise.all([
        fetch(`http://127.0.0.1:8000/graph-score-by-account/${accountId}`, { method: "POST" }),
        fetch(`http://127.0.0.1:8000/graph-llm-agents/${accountId}`, { method: "POST" })
      ]);

      if (!scoreRes.ok) {
        const errText = await scoreRes.text();
        throw new Error(`HTTP ${scoreRes.status}: ${errText}`);
      }

      const scoreData = await scoreRes.json();
      setSingleResult(scoreData);

      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        setAgentOpinions(agentsData.agent_opinions || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingSingle(false);
      setLoadingAgents(false);
    }
  };

  const runBatchTest = async () => {
    const accountsToTest = Array.from(selectedAccounts);
    if (accountsToTest.length === 0) {
      setError("Please select at least one account.");
      return;
    }
    setLoadingBatch(true);
    setError(null);
    try {
      const res = await fetch("http://127.0.0.1:8000/graph-batch-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountsToTest),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log("Batch ranking results:", data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingBatch(false);
    }
  };

  // NEW: Handle batch file upload (one-by-one, no ranking)
  const handleBatchFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const accounts = text.split(/\r?\n/).map(a => a.trim()).filter(a => a.length > 0);
        setBatchFileAccounts(accounts);
        setBatchFileResults([]);
        setBatchFileErrors([]);
      };
      reader.readAsText(file);
    }
  };

  // NEW: Run batch predict (one-by-one)
  const runBatchFilePredict = async () => {
    if (batchFileAccounts.length === 0) return;
    setLoadingBatchFile(true);
    setBatchFileResults([]);
    setBatchFileErrors([]);
    try {
      const res = await fetch("http://127.0.0.1:8000/graph-batch-predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batchFileAccounts),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBatchFileResults(data.results || []);
      setBatchFileErrors(data.errors || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingBatchFile(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-10">
        {/* ========================================== */}
        {/* HERO: Quick Account Analysis */}
        {/* ========================================== */}
        <div className="bg-gradient-to-br from-[#111827] to-[#0B0F19] border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white tracking-tight">Quick Account Analysis</h2>
            <p className="text-sm text-gray-400 mt-1">Enter an account ID to generate a full risk profile with SHAP attributions and AI agent opinions.</p>
          </div>

          <div className="flex gap-3 mb-8">
            <input
              type="text"
              value={customAccountId}
              onChange={(e) => setCustomAccountId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSingleScore(customAccountId)}
              placeholder="e.g., 10_8000EBD30"
              className="flex-1 p-4 bg-[#0B0F19] border border-white/10 rounded-lg text-white font-mono text-lg focus:outline-none focus:border-blue-500/50 transition"
            />
            <button
              onClick={() => runSingleScore(customAccountId)}
              disabled={loadingSingle || !customAccountId.trim()}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-lg"
            >
              {loadingSingle ? "Processing..." : "Analyze Account"}
            </button>
          </div>

          {/* Single Result Display */}
          {singleResult && (
            <div className="space-y-6">
              <div className={`p-6 rounded-xl border-2 ${
                singleResult.risk_level === 'high' ? 'bg-red-500/5 border-red-500/30' :
                singleResult.risk_level === 'medium' ? 'bg-yellow-500/5 border-yellow-500/30' :
                'bg-green-500/5 border-green-500/30'
              }`}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">Account ID</div>
                    <div className="text-2xl font-mono font-bold text-white">{singleResult.account_id}</div>
                    <div className="text-sm text-gray-400 mt-2">
                      Action: <span className={`font-bold ${
                        singleResult.recommended_action === 'decline' ? 'text-red-400' :
                        singleResult.recommended_action === 'review' ? 'text-yellow-400' :
                        'text-green-400'
                      }`}>{singleResult.recommended_action.toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">Risk Score</div>
                    <div className={`text-5xl font-bold ${
                      singleResult.risk_level === 'high' ? 'text-red-400' :
                      singleResult.risk_level === 'medium' ? 'text-yellow-400' :
                      'text-green-400'
                    }`}>
                      {singleResult.risk_score}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Probability: {(singleResult.fraud_probability * 100).toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>

              {singleResult.feature_attributions && singleResult.feature_attributions.length > 0 ? (
                <FeatureAttributions 
                  attributions={singleResult.feature_attributions} 
                  score={singleResult.risk_score}
                />
              ) : (
                <div className="bg-[#111827] border border-white/5 rounded-xl p-6">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Risk Factor Analysis</h3>
                  <p className="text-gray-500 text-sm">No SHAP data available.</p>
                </div>
              )}

              {loadingAgents ? (
                <div className="bg-[#111827] border border-white/5 rounded-xl p-8 text-center text-gray-400">
                  Consulting AI Agents...
                </div>
              ) : (
                agentOpinions.length > 0 && <AgentOpinions opinions={agentOpinions} />
              )}
            </div>
          )}
        </div>

        {/* ========================================== */}
        {/* EXECUTIVE DASHBOARD STATS */}
        {/* ========================================== */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Executive Overview</h2>
            <button onClick={loadDashboardData} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition text-sm">
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#111827] border border-white/5 rounded-xl p-5">
              <div className="text-xs text-gray-400 uppercase font-semibold">Total Transactions</div>
              <div className="text-3xl font-bold text-blue-400 mt-2">{stats.total}</div>
            </div>
            <div className="bg-[#111827] border border-red-500/20 rounded-xl p-5">
              <div className="text-xs text-gray-400 uppercase font-semibold">High Risk Alerts</div>
              <div className="text-3xl font-bold text-red-400 mt-2">{stats.high_risk}</div>
            </div>
            <div className="bg-[#111827] border border-yellow-500/20 rounded-xl p-5">
              <div className="text-xs text-gray-400 uppercase font-semibold">Pending Review</div>
              <div className="text-3xl font-bold text-yellow-400 mt-2">{stats.pending_review}</div>
            </div>
            <div className="bg-[#111827] border border-green-500/20 rounded-xl p-5">
              <div className="text-xs text-gray-400 uppercase font-semibold">Total Volume</div>
              <div className="text-3xl font-bold text-green-400 mt-2">${(stats.total_volume / 1000000).toFixed(2)}M</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#111827] border border-white/5 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Risk Score Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={riskData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {riskData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-4">
                {riskData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2 text-sm text-gray-300">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }}></div>
                    {entry.name}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#111827] border border-white/5 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Transaction Status</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* BATCH TESTING (with ranking) */}
        {/* ========================================== */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Batch Testing (with Ranking)</h2>
            {selectedAccounts.size > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">{selectedAccounts.size} selected</span>
                <button onClick={() => setSelectedAccounts(new Set())} className="text-sm text-red-400 hover:text-red-300">
                  Clear All
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {ACCOUNT_CATEGORIES.map((category) => (
              <div key={category.name} className={`rounded-xl border-2 p-5 ${getColorClasses(category.color)}`}>
                <div className="flex items-start gap-3 mb-4">
                  <div className="text-3xl">{category.icon}</div>
                  <div>
                    <h3 className="text-lg font-bold">{category.name}</h3>
                    <p className="text-xs opacity-75 mt-1">{category.description}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {category.accounts.map((acc) => {
                    const selected = isSelected(acc.id);
                    return (
                      <button
                        key={acc.id}
                        onClick={() => {
                          toggleAccount(acc.id);
                          runSingleScore(acc.id);
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          selected ? "bg-white/10 border-white/50 scale-[1.02]" : "bg-black/20 border-transparent hover:bg-black/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-mono text-sm font-semibold">{acc.id}</div>
                          <div className="text-xs opacity-75">{acc.label}</div>
                        </div>
                        {selected && (
                          <div className="text-xs mt-1 opacity-75 font-bold flex items-center gap-1">
                            ✓ Selected
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {selectedAccounts.size > 0 && (
            <button
              onClick={runBatchTest}
              disabled={loadingBatch}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl transition disabled:opacity-50 text-lg"
            >
              {loadingBatch ? "Processing..." : `Run Batch Test (${selectedAccounts.size} accounts)`}
            </button>
          )}
        </div>

        {/* ========================================== */}
        {/* NEW: BATCH FILE UPLOAD (One-by-One, No Ranking) */}
        {/* ========================================== */}
        <div className="bg-[#111827] border border-white/5 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-2">📄 Batch File Analysis (One-by-One)</h2>
          <p className="text-sm text-gray-400 mb-4">
            Upload a <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-300">.txt</code> or <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-300">.csv</code> file with one Account ID per line. Each account is analyzed individually — no ranking.
          </p>
          
          <input 
            type="file" 
            accept=".txt,.csv" 
            onChange={handleBatchFileUpload}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer mb-4"
          />
          
          {batchFileAccounts.length > 0 && (
            <div className="mb-4 p-3 bg-[#0B0F19] rounded-lg border border-white/5">
              <p className="text-sm text-gray-300 mb-2">✅ <strong>{batchFileAccounts.length}</strong> Account IDs loaded.</p>
              <div className="max-h-32 overflow-y-auto mb-3 bg-black/30 p-2 rounded text-xs font-mono text-gray-400">
                {batchFileAccounts.map((acc, i) => (
                  <div key={i} className="py-0.5">• {acc}</div>
                ))}
              </div>
              <button 
                onClick={runBatchFilePredict}
                disabled={loadingBatchFile}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition disabled:opacity-50"
              >
                {loadingBatchFile ? "Analyzing..." : `Analyze All (${batchFileAccounts.length} accounts)`}
              </button>
            </div>
          )}

          {batchFileResults.length > 0 && (
            <div className="space-y-3 mt-6">
              <h3 className="text-lg font-semibold text-white">Results ({batchFileResults.length} processed)</h3>
              <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                {batchFileResults.map((r, i) => (
                  <div key={i} className={`p-4 rounded-lg border flex justify-between items-center ${
                    r.risk_level === 'high' ? 'bg-red-500/10 border-red-500/30' :
                    r.risk_level === 'medium' ? 'bg-yellow-500/10 border-yellow-500/30' :
                    'bg-green-500/10 border-green-500/30'
                  }`}>
                    <div>
                      <div className="font-mono text-sm font-bold text-white">{r.account_id}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        Action: <span className={`font-semibold ${
                          r.recommended_action === 'decline' ? 'text-red-400' :
                          r.recommended_action === 'review' ? 'text-yellow-400' :
                          'text-green-400'
                        }`}>{r.recommended_action.toUpperCase()}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${
                        r.risk_level === 'high' ? 'text-red-400' :
                        r.risk_level === 'medium' ? 'text-yellow-400' :
                        'text-green-400'
                      }`}>
                        {r.risk_score}
                      </div>
                      <div className="text-xs text-gray-500">
                        {(r.fraud_probability * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {batchFileErrors.length > 0 && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <h4 className="text-sm font-semibold text-red-400 mb-2">Errors ({batchFileErrors.length})</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {batchFileErrors.map((e, i) => (
                  <div key={i} className="text-xs text-red-300 font-mono">
                    • {e.account_id}: {e.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    </Layout>
  );
}