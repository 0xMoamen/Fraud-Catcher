"use client";

import { useState } from "react";
import Layout from "@/components/Layout";

// Categorized account presets
const ACCOUNT_CATEGORIES = [
  {
    name: "Known Fraud",
    icon: "",
    color: "red",
    description: "Confirmed laundering accounts from dataset",
    accounts: [
      { id: "10_8000EBD30", label: "Primary Launderer" },
      { id: "8_80907D370", label: "High-Risk Account #1" },
      { id: "795_8010A5680", label: "High-Risk Account #2" },
    ],
  },
  {
    name: "High Risk",
    icon: "⚠️",
    color: "orange",
    description: "Top 10 suspicious accounts by heuristic score",
    accounts: [
      { id: "5627_8036BB8D0", label: "Suspicious #3" },
      { id: "513_8003491D0", label: "Suspicious #4" },
      { id: "410_800276DD0", label: "Suspicious #5" },
      { id: "29404_8041A3440", label: "Suspicious #6" },
    ],
  },
  {
    name: "Medium Risk",
    icon: "🔍",
    color: "yellow",
    description: "Accounts with unusual patterns",
    accounts: [
      { id: "23_80017F480", label: "Unusual Activity #1" },
      { id: "223_811A65E30", label: "Unusual Activity #2" },
      { id: "223_811A4DBD0", label: "Unusual Activity #3" },
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

type AccountResult = {
  account_id: string;
  raw_score: number;
  rank_percentile: number;
  final_verdict: string;
  confidence: string;
};

export default function Home() {
  const [customAccountId, setCustomAccountId] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [batchResults, setBatchResults] = useState<AccountResult[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const getColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      red: "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20",
      orange: "bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20",
      yellow: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20",
      green: "bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20",
    };
    return colors[color] || colors.green;
  };

  const getVerdictColor = (verdict: string) => {
    if (verdict === "HIGH_RISK") return "bg-red-500/10 border-red-500/50 text-red-400";
    if (verdict === "REQUIRES_REVIEW" || verdict === "REQUIRES_HUMAN_REVIEW") return "bg-yellow-500/10 border-yellow-500/50 text-yellow-400";
    return "bg-green-500/10 border-green-500/50 text-green-400";
  };

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
    setBatchResults([]); // Clear results when selection changes
  };

  const addCustomAccount = () => {
    if (customAccountId.trim() && !selectedAccounts.includes(customAccountId.trim())) {
      setSelectedAccounts([...selectedAccounts, customAccountId.trim()]);
      setCustomAccountId("");
    }
  };

  const clearSelection = () => {
    setSelectedAccounts([]);
    setBatchResults([]);
    setError(null);
  };

  const runBatchTest = async () => {
    let accountsToTest = selectedAccounts;
    
    if (accountsToTest.length === 0 && customAccountId.trim()) {
      accountsToTest = [customAccountId.trim()];
    }

    if (accountsToTest.length === 0) {
      setError("Please select at least one account or type a custom ID.");
      return;
    }

    setLoading(true);
    setError(null);
    setBatchResults([]);

    try {
      const res = await fetch("http://127.0.0.1:8000/graph-batch-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountsToTest),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      setBatchResults(data.results);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = ACCOUNT_CATEGORIES.map((cat) => ({
    ...cat,
    accounts: cat.accounts.filter(
      (acc) =>
        acc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.label.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((cat) => cat.accounts.length > 0);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">🕸️ Graph AML Account Tester</h1>
          <p className="text-gray-400 mt-1">
            Select accounts to analyze using rank-based heuristic scoring.
          </p>
        </div>

        {/* Search & Custom Input */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Search accounts by ID or label..."
              className="flex-1 p-3 bg-gray-900 border border-gray-600 rounded-lg text-white"
            />
            <div className="flex flex-1 gap-2">
              <input
                type="text"
                value={customAccountId}
                onChange={(e) => setCustomAccountId(e.target.value)}
                placeholder="Type custom account ID..."
                className="flex-1 p-3 bg-gray-900 border border-gray-600 rounded-lg text-white font-mono"
                onKeyDown={(e) => e.key === "Enter" && addCustomAccount()}
              />
              <button
                onClick={addCustomAccount}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
              >
                Add
              </button>
            </div>
          </div>

          {/* Selected Accounts Tags */}
          {selectedAccounts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-300">
                  Selected for Analysis ({selectedAccounts.length})
                </h3>
                <button
                  onClick={clearSelection}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedAccounts.map((accId) => (
                  <div
                    key={accId}
                    className="flex items-center gap-2 px-3 py-1 bg-gray-900 border border-gray-600 rounded-md text-sm font-mono"
                  >
                    <span className="text-gray-300">{accId}</span>
                    <button
                      onClick={() => toggleAccount(accId)}
                      className="text-red-400 hover:text-red-300 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={runBatchTest}
            disabled={loading || (selectedAccounts.length === 0 && !customAccountId.trim())}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white font-semibold py-3 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? "⏳ Ranking Accounts..." : `🚀 Run Batch Test (${selectedAccounts.length > 0 ? selectedAccounts.length : 1} account)`}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Batch Test Results */}
        {batchResults.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">
              📊 Ranking Results ({batchResults.length} accounts)
            </h2>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <div className="text-xs text-red-400 uppercase">High Risk</div>
                <div className="text-2xl font-bold text-red-400 mt-1">
                  {batchResults.filter((r) => r.final_verdict === "HIGH_RISK").length}
                </div>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="text-xs text-yellow-400 uppercase">Needs Review</div>
                <div className="text-2xl font-bold text-yellow-400 mt-1">
                  {batchResults.filter((r) => r.final_verdict === "REQUIRES_HUMAN_REVIEW" || r.final_verdict === "REQUIRES_REVIEW").length}
                </div>
              </div>
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <div className="text-xs text-green-400 uppercase">Low Risk</div>
                <div className="text-2xl font-bold text-green-400 mt-1">
                  {batchResults.filter((r) => r.final_verdict === "LOW_RISK").length}
                </div>
              </div>
            </div>

            {/* Individual Results List */}
            <div className="grid grid-cols-1 gap-3">
              {batchResults.map((result, idx) => (
                <div
                  key={idx}
                  className={`p-5 rounded-xl border-2 flex justify-between items-center ${getVerdictColor(result.final_verdict)}`}
                >
                  <div>
                    <div className="text-xs uppercase opacity-70">Account</div>
                    <div className="text-lg font-mono font-bold mt-1">
                      {result.account_id}
                    </div>
                    <div className="text-sm mt-2">
                      Rank Percentile: <span className="font-bold">{result.rank_percentile}%</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase opacity-70">Score</div>
                    <div className="text-2xl font-bold mt-1">{result.raw_score.toFixed(2)}</div>
                    <div className="text-sm font-bold mt-1">{result.final_verdict.replace(/_/g, ' ')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Account Categories (Selection Grid) */}
        <div className="mt-8">
           <h3 className="text-lg font-semibold text-white mb-4">Select Accounts to Test</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCategories.map((category) => (
              <div
                key={category.name}
                className={`rounded-xl border-2 p-5 ${getColorClasses(category.color)}`}
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="text-3xl">{category.icon}</div>
                  <div>
                    <h3 className="text-lg font-bold">{category.name}</h3>
                    <p className="text-xs opacity-75 mt-1">{category.description}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {category.accounts.map((acc) => {
                    const isSelected = selectedAccounts.includes(acc.id);
                    return (
                      <button
                        key={acc.id}
                        onClick={() => toggleAccount(acc.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          isSelected
                            ? "bg-white/10 border-white/50 scale-[1.02]"
                            : "bg-black/20 border-transparent hover:bg-black/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-mono text-sm font-semibold">{acc.id}</div>
                          <div className="text-xs opacity-75">{acc.label}</div>
                        </div>
                        {isSelected && (
                          <div className="text-xs mt-1 opacity-75 font-bold">✓ Selected</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}