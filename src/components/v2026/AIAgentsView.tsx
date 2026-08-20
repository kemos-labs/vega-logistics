'use client';

import { useMemo, useState } from 'react';
import { Brain, Bot, Zap, Activity, MessageSquare, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { engineRegistry } from '@/lib/engines';

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  learning: '#3b82f6',
  idle: '#71717a',
  error: '#ef4444',
};

export default function AIAgentsView() {
  const [refreshKey, setRefreshKey] = useState(0);
  const overview = useMemo(
    () => engineRegistry.agents.overview(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshKey]
  );

  const [askQ, setAskQ] = useState('What is OTIF?');
  const [askA, setAskA] = useState<{ content: string; citations?: { source: string; snippet: string }[]; confidence?: number } | null>(null);

  const handleAsk = () => {
    const ans = engineRegistry.nlp.ask(askQ);
    setAskA({ content: ans.content, citations: ans.citations, confidence: ans.confidence });
  };

  return (
    <div className="p-4 space-y-4 overflow-y-auto flex-1">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#e4e4e7] uppercase tracking-wider flex items-center gap-2">
            <Brain className="w-4 h-4 text-[#a855f7]" /> AI Agent Coordinator
          </h2>
          <p className="text-[10px] text-[#52525b] mt-1">
            Multi-agent orchestration — 7 specialists coordinated by Vega-Oracle
          </p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="text-[10px] px-3 py-1.5 rounded bg-[#18181c] border border-[#2a2a33] text-[#a1a1aa] hover:text-[#e4e4e7] transition-colors"
        >
          Refresh snapshot
        </button>
      </div>

      {/* Metrics strip */}
      <div className="grid grid-cols-5 gap-3">
        <Metric label="Active Agents" value={`${overview.metrics.activeAgents} / ${overview.agents.length}`} color="#22c55e" icon={Bot} />
        <Metric label="Tasks Processed" value={overview.metrics.totalTasks.toString()} color="#3b82f6" icon={Activity} />
        <Metric label="Success Rate" value={`${(overview.metrics.successRate * 100).toFixed(1)}%`} color="#22c55e" icon={CheckCircle2} />
        <Metric label="Avg Latency" value={`${overview.metrics.avgLatency}ms`} color="#a855f7" icon={Zap} />
        <Metric label="Cross-Agent Consensus" value={`${(overview.metrics.consensusRate * 100).toFixed(1)}%`} color="#06b6d4" icon={Brain} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Agent roster */}
        <div className="col-span-2 bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3">Agent Roster</h3>
          <div className="space-y-2">
            {overview.agents.map((a) => {
              const color = STATUS_COLORS[a.status] ?? '#71717a';
              return (
                <div key={a.id} className="flex items-start gap-3 p-2.5 rounded bg-[#0a0a0b] border border-[#2a2a33] hover:border-[#3d3d4a] transition-colors">
                  <div className="w-9 h-9 rounded bg-[#1c1c21] flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#e4e4e7]">{a.name}</span>
                      <span className="text-[9px] text-[#52525b]">· {a.role}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono-data" style={{ color, backgroundColor: `${color}22` }}>
                        {a.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#71717a] mt-0.5">{a.description}</p>
                    <div className="flex gap-3 mt-1.5 text-[10px] text-[#a1a1aa]">
                      <span>Tasks: <span className="font-mono-data">{a.tasksCompleted}</span></span>
                      <span>Latency: <span className="font-mono-data">{a.averageLatencyMs}ms</span></span>
                      <span>Accuracy: <span className="font-mono-data">{(a.accuracy * 100).toFixed(1)}%</span></span>
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {a.capabilities.map((c) => (
                        <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-[#1c1c21] text-[#a1a1aa] border border-[#2a2a33]">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent tasks + Ask NLP */}
        <div className="space-y-4">
          <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
            <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3 flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-[#a855f7]" /> Ask Vega (RAG)
            </h3>
            <div className="flex gap-2 mb-2">
              <input
                value={askQ}
                onChange={(e) => setAskQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                placeholder="e.g. What is OTIF?"
                className="flex-1 bg-[#0a0a0b] border border-[#2a2a33] rounded px-2 py-1.5 text-xs text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-[#3b82f6]"
              />
              <button
                onClick={handleAsk}
                className="px-3 py-1.5 rounded bg-[#3b82f6] text-white text-xs font-medium hover:bg-[#2563eb] transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {askA && (
              <div className="bg-[#0a0a0b] border border-[#2a2a33] rounded p-2.5">
                <p className="text-xs text-[#a1a1aa] leading-relaxed">{askA.content}</p>
                {askA.confidence !== undefined && (
                  <div className="text-[9px] text-[#52525b] mt-2">Confidence: {(askA.confidence * 100).toFixed(0)}%</div>
                )}
                {askA.citations && askA.citations.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[#2a2a33]">
                    {askA.citations.map((c, i) => (
                      <div key={i} className="text-[9px] text-[#52525b]">
                        <span className="text-[#3b82f6]">{c.source}</span> · {c.snippet}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
            <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3">Recent Tasks</h3>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {overview.tasks.slice(0, 10).map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-[10px]">
                  {t.status === 'complete' && <CheckCircle2 className="w-3 h-3 text-[#22c55e] flex-shrink-0" />}
                  {t.status === 'failed' && <AlertCircle className="w-3 h-3 text-[#ef4444] flex-shrink-0" />}
                  {t.status === 'running' && <Loader2 className="w-3 h-3 text-[#3b82f6] flex-shrink-0 animate-spin" />}
                  {t.status === 'queued' && <div className="w-3 h-3 rounded-full border border-[#71717a] flex-shrink-0" />}
                  <span className="text-[#a1a1aa] truncate flex-1">{t.type}</span>
                  <span className="font-mono-data text-[#52525b]">{t.latencyMs ? `${t.latencyMs}ms` : '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Coordination events */}
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3">Coordination Events (last hour)</h3>
        <div className="grid grid-cols-2 gap-2">
          {overview.events.slice(0, 12).map((e) => (
            <div key={e.id} className="flex items-center gap-2 p-2 rounded bg-[#0a0a0b] border border-[#2a2a33]">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: e.consensus ? '#22c55e' : '#eab308' }} />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-[#e4e4e7] truncate">
                  <span className="text-[#a855f7]">{e.sourceAgent.replace('agent_', '')}</span>
                  {e.targetAgent && (
                    <>
                      <ArrowRight className="w-2.5 h-2.5 inline mx-1 text-[#52525b]" />
                      <span className="text-[#3b82f6]">{e.targetAgent.replace('agent_', '')}</span>
                    </>
                  )}
                </div>
                <div className="text-[9px] text-[#52525b]">{e.eventType} · {new Date(e.timestamp).toLocaleTimeString('en-US', { hour12: false })}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }) {
  return (
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-[#71717a] uppercase tracking-wider">{label}</span>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div className="font-mono-data text-lg font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
