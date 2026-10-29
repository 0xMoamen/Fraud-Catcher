"use client";

import { useState } from "react";
import Layout from "@/components/Layout";

export default function ReceiptPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Force only 1 file to be processed due to VRAM limits
      setFiles([e.target.files[0]]); 
    }
  };

  const analyzeReceipts = async () => {
    if (files.length === 0) return;
    
    setLoading(true);
    setResults([]);
    
    // Process the single file
    const file = files[0];
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch("http://127.0.0.1:8000/api/receipt/detect", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResults([{ fileName: file.name, ...data }]);
    } catch (err) {
      setResults([{ fileName: file.name, error: "Failed to analyze. Ensure the backend model is fully loaded." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">🧾 Receipt Tampering Detection</h1>
          <p className="text-gray-400 mt-1 text-sm">Qwen2.5-VL Vision Model | Detects Forged Receipts</p>
        </div>

        {/* NEW: Hardware Limitation Note */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 p-4 rounded-lg flex items-start gap-3">
          <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
          <div>
            <strong className="font-bold block mb-1">Batch Processing Disabled</strong>
            <span className="text-sm text-yellow-200/80">
              Due to local hardware (VRAM) limitations, this Vision-Language model can only process <strong>one image at a time</strong>. 
              Please upload a single receipt to analyze.
            </span>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-[#111827] border border-white/5 rounded-xl p-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">Upload Receipt Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
          />
          
          {files.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-400 mb-2">✅ <strong>{files.length}</strong> file selected:</p>
              <ul className="text-sm text-gray-300 space-y-1 max-h-40 overflow-y-auto bg-[#0B0F19] p-3 rounded-lg border border-white/5">
                {files.map((f, i) => <li key={i}>📄 {f.name}</li>)}
              </ul>
              <button
                onClick={analyzeReceipts}
                disabled={loading}
                className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Analyzing (this may take 30-60s on CPU)..." : "Analyze Receipt"}
              </button>
            </div>
          )}
        </div>

        {/* Results Section */}
        {results.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Analysis Results</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((r, i) => (
                <div key={i} className={`p-4 rounded-xl border ${
                  r.error ? "bg-gray-500/10 border-gray-500/30" :
                  r.prediction === "forged" ? "bg-red-500/10 border-red-500/30" : "bg-green-500/10 border-green-500/30"
                }`}>
                  <div className="font-mono text-xs text-gray-400 mb-1 truncate">{r.fileName}</div>
                  <div className={`text-2xl font-bold ${
                    r.error ? "text-gray-400" :
                    r.prediction === "forged" ? "text-red-400" : "text-green-400"
                  }`}>
                    {r.error ? "⚠️ ERROR" : r.prediction === "forged" ? " FORGED" : "✅ AUTHENTIC"}
                  </div>
                  {r.message && <div className="text-sm text-gray-300 mt-2">{r.message}</div>}
                  {r.error && <div className="text-red-400 text-sm mt-2">{r.error}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}