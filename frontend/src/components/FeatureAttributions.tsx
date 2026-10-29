"use client";

import React from 'react';

type Attribution = {
  feature: string;
  value: number;
  contribution: number;
};

export default function FeatureAttributions({ 
  attributions, 
  score 
}: { 
  attributions: Attribution[] | undefined;
  score: number | undefined;
}) {
  if (!attributions || attributions.length === 0) {
    return <div className="text-gray-500 p-4">No SHAP data available yet.</div>;
  }

  // Find the max absolute contribution to scale the bars relative to the biggest factor
  const maxAbs = Math.max(...attributions.map(a => Math.abs(a.contribution)));

  return (
    <div className="bg-[#111827] border border-white/5 rounded-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">SHAP Feature Importance</h3>
        <div className="text-xs text-gray-500 font-mono">Score: {score?.toFixed(2) ?? 'N/A'}</div>
      </div>

      <div className="space-y-4">
        {attributions.map((attr, index) => {
          // Calculate width relative to the strongest feature
          const widthPercent = (Math.abs(attr.contribution) / maxAbs) * 100;
          
          // Color logic: Positive SHAP (Red/Fraud), Negative SHAP (Green/Safe)
          const isPositive = attr.contribution > 0;
          const barColor = isPositive 
            ? "bg-red-500" 
            : "bg-green-500";

          return (
            <div key={index} className="group">
              {/* Header Row: Name and Values */}
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-300">{attr.feature}</span>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="text-gray-500">Val: {attr.value}</span>
                  <span className={isPositive ? "text-red-400" : "text-green-400"}>
                    {attr.contribution > 0 ? '+' : ''}{attr.contribution}
                  </span>
                </div>
              </div>
              
              {/* The Bar */}
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${barColor} transition-all duration-500`}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}