"use client";

import { useState } from "react";
import Layout from "@/components/Layout";

export default function PhishingPage() {
  // --- Single URL States ---
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // --- Batch Upload States ---
  const [batchUrls, setBatchUrls] = useState<string[]>([]);
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [loadingBatch, setLoadingBatch] = useState(false);

  // --- Single URL Logic ---
  const checkUrl = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/phishing/predict?url=${encodeURIComponent(url)}`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed to analyze URL");
      
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isPhishing = result?.prediction === "phishing";

  // --- Batch Upload Logic ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        // Split by new lines, clean up, and filter empty strings
        const urls = text.split(/\r?\n/).map(u => u.trim()).filter(u => u.length > 0);
        setBatchUrls(urls);
        setBatchResults([]); // Clear previous results when new file is loaded
      };
      reader.readAsText(file);
    }
  };

  const runBatch = async () => {
    if (batchUrls.length === 0) return;
    setLoadingBatch(true);
    setBatchResults([]);
    
    const results = [];
    for (const u of batchUrls) {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/phishing/predict?url=${encodeURIComponent(u)}`, { method: "POST" });
        const data = await res.json();
        results.push({ url: u, ...data });
      } catch (e) {
        results.push({ url: u, error: "Failed to analyze" });
      }
    }
    
    setBatchResults(results);
    setLoadingBatch(false);
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* ========================================== */}
        {/* SINGLE URL ANALYSIS SECTION */}
        {/* ========================================== */}
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">🎣 Phishing Website Detector</h1>
          <p className="text-gray-400 mt-1 text-sm">
            Analyze URLs using a Random Forest model trained on 26 features. Accuracy: 96.1% | F1: 0.995
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-[#111827] border border-white/5 rounded-xl p-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">Enter URL to Analyze</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && checkUrl()}
              placeholder="https://example.com or suspicious-site.xyz"
              className="flex-1 p-3 bg-[#0B0F19] border border-white/10 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500/50 transition"
            />
            <button
              onClick={checkUrl}
              disabled={loading || !url.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition disabled:opacity-50"
            >
              {loading ? "Analyzing..." : "Check URL"}
            </button>
          </div>

          {/* Example URLs */}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs text-gray-500">Try:</span>
            {["https://www.google.com", "https://www.github.com", "http://free-money.xyz"].map((ex) => (
              <button
                key={ex}
                onClick={() => setUrl(ex)}
                className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition font-mono"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Single URL Results */}
        {result && (
          <div className="space-y-4">
            {/* Verdict Banner */}
            <div className={`p-6 rounded-xl border-2 ${
              isPhishing 
                ? "bg-red-500/5 border-red-500/30" 
                : "bg-green-500/5 border-green-500/30"
            }`}>
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">Verdict</div>
                  <div className={`text-3xl font-bold ${isPhishing ? "text-red-400" : "text-green-400"}`}>
                    {isPhishing ? "🚨 PHISHING DETECTED" : "✅ SAFE WEBSITE"}
                  </div>
                  <div className="text-sm text-gray-400 mt-2 font-mono break-all">{result.url}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">Confidence</div>
                  <div className={`text-4xl font-bold ${isPhishing ? "text-red-400" : "text-green-400"}`}>
                    {(result.confidence * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Probability Bars */}
            <div className="bg-[#111827] border border-white/5 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Prediction Probabilities</h3>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-gray-300">Legitimate</span>
                    <span className="text-sm font-mono text-green-400">{(result.legitimate_probability * 100).toFixed(2)}%</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${result.legitimate_probability * 100}%` }} />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-gray-300">Phishing</span>
                    <span className="text-sm font-mono text-red-400">{(result.phishing_probability * 100).toFixed(2)}%</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${result.phishing_probability * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Top Features */}
            <div className="bg-[#111827] border border-white/5 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Top Contributing Features</h3>
              <div className="space-y-2">
                {result.top_features.map((f: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-[#0B0F19] rounded-lg border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </div>
                      <span className="text-sm text-gray-200 font-mono">{f.name}</span>
                    </div>
                    <span className="text-sm text-gray-400 font-mono">{(f.importance * 100).toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* All Features Grid */}
            <div className="bg-[#111827] border border-white/5 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">All 26 Features</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(result.features_used).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-2 bg-[#0B0F19] rounded border border-white/5 text-xs">
                    <span className="text-gray-400 font-mono truncate mr-2">{key}</span>
                    <span className={`font-mono font-bold ${
                      value === 1 ? "text-green-400" : value === -1 ? "text-red-400" : "text-gray-500"
                    }`}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* BATCH ANALYSIS SECTION */}
        {/* ========================================== */}
        <div className="border-t border-white/10 pt-8">
          <div className="bg-[#111827] border border-white/5 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">📦 Batch URL Analysis</h3>
            <p className="text-sm text-gray-400 mb-4">
              Upload a <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-300">.txt</code> or <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-300">.csv</code> file with one URL per line to analyze multiple websites at once.
            </p>
            
            <input 
              type="file" 
              accept=".txt,.csv" 
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer mb-4"
            />
            
            {batchUrls.length > 0 && (
              <div className="mb-4 p-3 bg-[#0B0F19] rounded-lg border border-white/5">
                <p className="text-sm text-gray-300 mb-2">✅ <strong>{batchUrls.length}</strong> URLs loaded successfully.</p>
                <button 
                  onClick={runBatch}
                  disabled={loadingBatch}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition disabled:opacity-50"
                >
                  {loadingBatch ? "Analyzing..." : "Analyze All URLs"}
                </button>
              </div>
            )}

            {batchResults.length > 0 && (
              <div className="space-y-2 mt-4 max-h-96 overflow-y-auto pr-2">
                {batchResults.map((r, i) => (
                  <div key={i} className={`p-3 rounded-lg border flex justify-between items-center ${
                    r.error 
                      ? "bg-gray-500/10 border-gray-500/30" 
                      : r.prediction === "phishing" 
                        ? "bg-red-500/10 border-red-500/30" 
                        : "bg-green-500/10 border-green-500/30"
                  }`}>
                    <div className="font-mono text-sm text-gray-300 truncate max-w-md" title={r.url}>
                      {r.url}
                    </div>
                    <div className={`font-bold text-sm ${
                      r.error ? "text-gray-400" : r.prediction === "phishing" ? "text-red-400" : "text-green-400"
                    }`}>
                      {r.error ? "⚠️ Failed" : r.prediction === "phishing" ? "🚨 PHISHING" : "✅ SAFE"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </Layout>
  );
}