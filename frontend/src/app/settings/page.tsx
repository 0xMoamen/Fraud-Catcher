"use client";

import { useState, useEffect } from "react";
import Layout from "@/components/Layout";

export default function SettingsPage() {
  const [riskThreshold, setRiskThreshold] = useState(70);
  const [autoDecline, setAutoDecline] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/settings");
      const data = await res.json();
      
      setRiskThreshold(data.risk_threshold || 70);
      setAutoDecline(data.auto_decline);
      setEmailAlerts(data.email_alerts);
      setApiKey(data.api_key || "");
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          risk_threshold: riskThreshold.toString(),
          auto_decline: autoDecline.toString(),
          email_alerts: emailAlerts.toString(),
          api_key: apiKey,
        }),
      });
      
      if (res.ok) {
        setMessage("✅ Settings saved successfully");
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (err) {
      console.error("Failed to save settings:", err);
      setMessage("❌ Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 mt-1">Configure fraud detection parameters</p>
        </div>

        {message && (
          <div className={`p-4 rounded-lg ${message.includes("✅") ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}>
            {message}
          </div>
        )}

        <div className="space-y-6">
          {/* Risk Threshold */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Risk Thresholds</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">High Risk Threshold: {riskThreshold}</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={riskThreshold}
                  onChange={(e) => setRiskThreshold(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0</span>
                  <span>50</span>
                  <span>100</span>
                </div>
              </div>
            </div>
          </div>

          {/* Automation */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Automation</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-white">Auto-decline High Risk</div>
                  <div className="text-xs text-gray-500">Automatically decline transactions above threshold</div>
                </div>
                <button
                  onClick={() => setAutoDecline(!autoDecline)}
                  className={`w-12 h-6 rounded-full transition ${autoDecline ? "bg-blue-600" : "bg-gray-600"}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition ${autoDecline ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-white">Email Alerts</div>
                  <div className="text-xs text-gray-500">Send email notifications for high-risk alerts</div>
                </div>
                <button
                  onClick={() => setEmailAlerts(!emailAlerts)}
                  className={`w-12 h-6 rounded-full transition ${emailAlerts ? "bg-blue-600" : "bg-gray-600"}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition ${emailAlerts ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </div>
          </div>

          {/* API Configuration */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">API Configuration</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">OpenRouter API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-or-..."
                  className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={saveSettings}
              disabled={loading}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save All Settings"}
            </button>
            <button
              onClick={() => {
                setRiskThreshold(70);
                setAutoDecline(true);
                setEmailAlerts(true);
              }}
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition"
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}