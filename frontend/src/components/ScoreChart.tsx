"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type ScoreChartProps = {
  mlScore: number | null;
  llmScore: number | null;
};

export default function ScoreChart({ mlScore, llmScore }: ScoreChartProps) {
  const data = [
    { name: 'ML Engine', score: mlScore ?? 0 },
    { name: 'LLM Agents', score: llmScore ?? 0 },
  ];

  const getColor = (score: number | null) => {
    if (!score) return '#6b7280'; // Gray
    if (score >= 80) return '#ef4444'; // Red (High Risk)
    if (score >= 50) return '#f59e0b'; // Yellow (Medium)
    return '#10b981'; // Green (Low)
  };

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-gray-200 mb-6">Risk Score Comparison</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" domain={[0, 100]} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} 
              itemStyle={{ color: '#f3f4f6' }}
            />
            <Bar dataKey="score" radius={[8, 8, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getColor(entry.score)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}