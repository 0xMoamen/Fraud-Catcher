"use client";

import React from 'react';

type AgentOpinion = {
  agent_name: string;
  role: string;
  opinion: string;
  confidence: string;
  key_findings: string[];
};

export default function AgentOpinions({ opinions }: { opinions: AgentOpinion[] }) {
  if (!opinions || opinions.length === 0) {
    return null;
  }

  const getConfidenceColor = (confidence: string) => {
    switch (confidence.toLowerCase()) {
      case 'high': return 'text-green-400 bg-green-500/10 border-green-500/30';
      case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'low': return 'text-red-400 bg-red-500/10 border-red-500/30';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
    }
  };

  const getAgentIcon = (agentName: string) => {
    switch (agentName) {
      case 'Risk Analyst': return '📊';
      case 'Compliance Officer': return '⚖️';
      case 'Behavioral Analyst': return '';
      default: return '🤖';
    }
  };

  return (
    <div className="bg-[#111827] border border-white/5 rounded-xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Multi-Agent AI Analysis</h3>
          <p className="text-xs text-gray-500 mt-1">Independent AI analyst opinions (informational only)</p>
        </div>
        <div className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded text-[10px] text-purple-400 font-mono">
          3 agents
        </div>
      </div>

      <div className="space-y-4">
        {opinions.map((agent, index) => (
          <div key={index} className="bg-[#0B0F19] border border-white/5 rounded-lg p-5 hover:border-white/10 transition">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{getAgentIcon(agent.agent_name)}</div>
                <div>
                  <div className="text-sm font-semibold text-white">{agent.agent_name}</div>
                  <div className="text-xs text-gray-500">{agent.role}</div>
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-[10px] font-bold border ${getConfidenceColor(agent.confidence)}`}>
                {agent.confidence.toUpperCase()} CONFIDENCE
              </span>
            </div>

            <p className="text-sm text-gray-300 leading-relaxed mb-3">
              {agent.opinion}
            </p>

            {agent.key_findings.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Key Findings</div>
                <div className="space-y-1">
                  {agent.key_findings.map((finding, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-2 text-xs text-gray-400">
                      <span className="text-purple-400 mt-0.5">▸</span>
                      <span>{finding}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
        <p className="text-xs text-blue-400 text-center">
          💡 These AI opinions are for analyst reference only and do not influence the mathematical risk score.
        </p>
      </div>
    </div>
  );
}