"use client";

import { useState, useEffect } from "react";
import Layout from "@/components/Layout";

type Transaction = {
  id: string;
  account_id: string;
  amount: number;
  timestamp: string;
  merchant: string;
  country: string;
  risk_score: number;
  status: string;
};

type Stats = {
  total: number;
  high_risk: number;
  pending_review: number;
  total_volume: number;
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, high_risk: 0, pending_review: 0, total_volume: 0 });
  const [filter, setFilter] = useState<"all" | "high_risk" | "review">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [txRes, statsRes] = await Promise.all([
        fetch(`http://127.0.0.1:8000/api/transactions?status=${filter}&limit=100`),
        fetch("http://127.0.0.1:8000/api/transactions/stats")
      ]);
      
      const txData = await txRes.json();
      const statsData = await statsRes.json();
      
      setTransactions(txData.transactions);
      setStats(statsData);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return tx.account_id.toLowerCase().includes(search) || 
           tx.merchant.toLowerCase().includes(search) ||
           tx.id.toLowerCase().includes(search);
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-green-500/10 text-green-400 border-green-500/30";
      case "declined": return "bg-red-500/10 text-red-400 border-red-500/30";
      case "review": return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";
      default: return "bg-gray-500/10 text-gray-400";
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Transactions</h1>
            <p className="text-gray-400 mt-1">Monitor and analyze all transactions</p>
          </div>
          <button 
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="🔍 Search by account, merchant, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 p-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="p-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
          >
            <option value="all">All Transactions</option>
            <option value="high_risk">High Risk Only</option>
            <option value="review">Needs Review</option>
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
            <div className="text-xs text-gray-400 uppercase">Total</div>
            <div className="text-2xl font-bold text-white mt-1">{stats.total}</div>
          </div>
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
            <div className="text-xs text-gray-400 uppercase">High Risk</div>
            <div className="text-2xl font-bold text-red-400 mt-1">{stats.high_risk}</div>
          </div>
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
            <div className="text-xs text-gray-400 uppercase">Pending Review</div>
            <div className="text-2xl font-bold text-yellow-400 mt-1">{stats.pending_review}</div>
          </div>
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
            <div className="text-xs text-gray-400 uppercase">Total Volume</div>
            <div className="text-2xl font-bold text-blue-400 mt-1">${stats.total_volume.toLocaleString()}</div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading transactions...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900 border-b border-gray-700">
                  <tr>
                    <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Transaction ID</th>
                    <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Account</th>
                    <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Amount</th>
                    <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Merchant</th>
                    <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Risk Score</th>
                    <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-700/50 transition">
                      <td className="p-4 text-sm text-gray-300 font-mono">{tx.id}</td>
                      <td className="p-4 text-sm text-gray-300 font-mono">{tx.account_id}</td>
                      <td className="p-4 text-sm text-white font-semibold">${tx.amount.toLocaleString()}</td>
                      <td className="p-4 text-sm text-gray-300">{tx.merchant}<div className="text-xs text-gray-500">{tx.country}</div></td>
                      <td className="p-4">
                        <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${
                          tx.risk_score >= 70 ? "bg-red-500/20 text-red-400" :
                          tx.risk_score >= 40 ? "bg-yellow-500/20 text-yellow-400" :
                          "bg-green-500/20 text-green-400"
                        }`}>
                          {tx.risk_score.toFixed(0)}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(tx.status)}`}>
                          {tx.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}