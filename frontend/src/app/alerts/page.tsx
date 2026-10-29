"use client";

import { useState, useEffect } from "react";
import Layout from "@/components/Layout";

type Alert = {
  id: string;
  account_id: string;
  risk_score: number;
  triggered_at: string;
  reason: string;
  status: "new" | "investigating" | "resolved" | "escalated";
  priority: "high" | "medium" | "low";
};

type AlertStats = {
  new: number;
  investigating: number;
  resolved: number;
  escalated: number;
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertStats>({ new: 0, investigating: 0, resolved: 0, escalated: 0 });
  const [filter, setFilter] = useState<"all" | "new" | "high_priority">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [alertsRes, statsRes] = await Promise.all([
        fetch(`http://127.0.0.1:8000/api/alerts?status=${filter}`),
        fetch("http://127.0.0.1:8000/api/alerts/stats")
      ]);
      
      const alertsData = await alertsRes.json();
      const statsData = await statsRes.json();
      
      setAlerts(alertsData.alerts);
      setStats(statsData);
    } catch (err) {
      console.error("Failed to load alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateAlertStatus = async (alertId: string, newStatus: string) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/alerts/${alertId}?status=${newStatus}`, {
        method: "PATCH",
      });
      if (res.ok) {
        loadData(); // Refresh after update
      }
    } catch (err) {
      console.error("Failed to update alert:", err);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "text-red-400 bg-red-500/10";
      case "medium": return "text-yellow-400 bg-yellow-500/10";
      default: return "text-blue-400 bg-blue-500/10";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "investigating": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "resolved": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "escalated": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      default: return "bg-gray-500/20 text-gray-400";
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Alerts</h1>
            <p className="text-gray-400 mt-1">High-risk accounts requiring investigation</p>
          </div>
          <button 
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl">
            <div className="text-xs text-red-400 uppercase">New Alerts</div>
            <div className="text-3xl font-bold text-red-400 mt-1">{stats.new}</div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-xl">
            <div className="text-xs text-yellow-400 uppercase">Investigating</div>
            <div className="text-3xl font-bold text-yellow-400 mt-1">{stats.investigating}</div>
          </div>
          <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-xl">
            <div className="text-xs text-green-400 uppercase">Resolved</div>
            <div className="text-3xl font-bold text-green-400 mt-1">{stats.resolved}</div>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/30 p-4 rounded-xl">
            <div className="text-xs text-purple-400 uppercase">Escalated</div>
            <div className="text-3xl font-bold text-purple-400 mt-1">{stats.escalated}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <button onClick={() => setFilter("all")} className={`px-4 py-2 rounded-lg transition ${filter === "all" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400"}`}>All Alerts</button>
          <button onClick={() => setFilter("new")} className={`px-4 py-2 rounded-lg transition ${filter === "new" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400"}`}>New Only</button>
          <button onClick={() => setFilter("high_priority")} className={`px-4 py-2 rounded-lg transition ${filter === "high_priority" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400"}`}>High Priority</button>
        </div>

        {/* Alerts List */}
        {loading ? (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center text-gray-400">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center text-gray-400">No alerts found for this filter.</div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div key={alert.id} className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(alert.status)}`}>
                        {alert.status.toUpperCase()}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getPriorityColor(alert.priority)}`}>
                        {alert.priority.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">{alert.triggered_at}</span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">Account: {alert.account_id}</h3>
                    <p className="text-gray-400 text-sm mb-3">{alert.reason}</p>
                    <div className="flex items-center gap-4">
                      <div className="text-sm">
                        <span className="text-gray-500">Risk Score:</span>
                        <span className={`ml-2 font-bold ${alert.risk_score >= 70 ? "text-red-400" : "text-yellow-400"}`}>
                          {alert.risk_score}/100
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    {alert.status === "new" && (
                      <>
                        <button onClick={() => updateAlertStatus(alert.id, "investigating")} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm transition">Start Investigation</button>
                        <button onClick={() => updateAlertStatus(alert.id, "resolved")} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition">Mark as False Positive</button>
                      </>
                    )}
                    {alert.status === "investigating" && (
                      <>
                        <button onClick={() => updateAlertStatus(alert.id, "escalated")} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition">Escalate</button>
                        <button onClick={() => updateAlertStatus(alert.id, "resolved")} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition">Resolve</button>
                      </>
                    )}
                    {alert.status === "resolved" && (
                      <button onClick={() => updateAlertStatus(alert.id, "new")} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm transition">Reopen</button>
                    )}
                    {alert.status === "escalated" && (
                      <button onClick={() => updateAlertStatus(alert.id, "investigating")} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm transition">Return to Investigation</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}