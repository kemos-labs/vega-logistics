'use client';

import { useMemo, useState } from 'react';
import { Box, TrendingUp, AlertTriangle, Activity, Zap, Recycle } from 'lucide-react';
import { engineRegistry } from '@/lib/engines';
import type { TwinScenario } from '@/lib/types2026';

const SCENARIO_COLORS = ['#3b82f6', '#a855f7', '#06b6d4', '#22c55e', '#f97316'];

export default function DigitalTwinView() {
  const [refreshKey, setRefreshKey] = useState(0);
  const scenarios = useMemo(
    () => engineRegistry.digitalTwin.scenarios(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshKey]
  );
  const summary = useMemo(() => engineRegistry.digitalTwin.summary(scenarios), [scenarios]);
  const [activeId, setActiveId] = useState(scenarios[0]?.id ?? '');

  const active = scenarios.find((s) => s.id === activeId) ?? scenarios[0];

  return (
    <div className="p-4 space-y-4 overflow-y-auto flex-1">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#e4e4e7] uppercase tracking-wider flex items-center gap-2">
            <Box className="w-4 h-4 text-[#06b6d4]" /> Digital Twin Simulator
          </h2>
          <p className="text-[10px] text-[#52525b] mt-1">
            Mirror of physical fleet + warehouse · what-if scenario runner
          </p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="text-[10px] px-3 py-1.5 rounded bg-[#18181c] border border-[#2a2a33] text-[#a1a1aa] hover:text-[#e4e4e7] transition-colors"
        >
          Re-run scenarios
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <SummaryCard label="Avg Improvement" value={`${summary.avgImprovement}%`} color="#22c55e" icon={TrendingUp} />
        <SummaryCard label="Best Scenario" value={summary.bestScenario?.name ?? '—'} color="#3b82f6" icon={Zap} />
        <SummaryCard label="Emissions Saved" value={`${(summary.totalEmissionsSaved / 1000).toFixed(1)}t`} color="#22c55e" icon={Recycle} />
        <SummaryCard label="Worst Scenario" value={summary.worstScenario?.name ?? '—'} color="#f97316" icon={AlertTriangle} />
      </div>

      {/* Scenario list */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3">Scenarios</h3>
          <div className="space-y-2">
            {scenarios.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`w-full text-left p-2.5 rounded border transition-colors ${
                  s.id === activeId
                    ? 'bg-[#1c1c21] border-[#3b82f6]'
                    : 'bg-[#0a0a0b] border-[#2a2a33] hover:border-[#3d3d4a]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }} />
                  <span className="text-xs font-semibold text-[#e4e4e7]">{s.name}</span>
                </div>
                <p className="text-[10px] text-[#71717a] mt-1">{s.description}</p>
                {s.improvementPct !== undefined && (
                  <div className="text-[10px] mt-1 font-mono-data" style={{ color: s.improvementPct >= 0 ? '#22c55e' : '#ef4444' }}>
                    {s.improvementPct >= 0 ? '+' : ''}{s.improvementPct}% utilization
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Active scenario deep-dive */}
        <div className="col-span-2 bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
          {active && active.baselineResult && active.optimizedResult ? (
            <ScenarioDetail scenario={active} />
          ) : (
            <div className="text-xs text-[#52525b]">No scenario selected.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScenarioDetail({ scenario }: { scenario: TwinScenario }) {
  const base = scenario.baselineResult!;
  const opt = scenario.optimizedResult!;

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[#e4e4e7]">{scenario.name}</h3>
        <p className="text-[10px] text-[#71717a] mt-1">{scenario.description}</p>
        <div className="flex gap-3 mt-2 text-[10px] text-[#a1a1aa]">
          {Object.entries(scenario.parameters).map(([k, v]) => (
            <span key={k} className="px-2 py-0.5 rounded bg-[#0a0a0b] border border-[#2a2a33]">
              {k}: <span className="font-mono-data text-[#3b82f6]">{v}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#0a0a0b] border border-[#2a2a33] rounded p-3">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-3.5 h-3.5 text-[#f97316]" />
            <span className="text-[10px] font-semibold text-[#f97316] uppercase tracking-wider">Baseline</span>
          </div>
          <KpiRow label="Avg Utilization" value={`${base.kpis.avgUtilization}%`} />
          <KpiRow label="Total Distance" value={`${base.kpis.totalDistance} km`} />
          <KpiRow label="Deliveries" value={base.kpis.totalDeliveries.toString()} />
          <KpiRow label="Emissions" value={`${base.kpis.totalEmissionsKg} kg`} />
          <KpiRow label="Service Level" value={`${base.kpis.avgServiceLevel}%`} />
        </div>
        <div className="bg-[#0a0a0b] border border-[#2a2a33] rounded p-3">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3.5 h-3.5 text-[#22c55e]" />
            <span className="text-[10px] font-semibold text-[#22c55e] uppercase tracking-wider">Optimized</span>
          </div>
          <KpiRow label="Avg Utilization" value={`${opt.kpis.avgUtilization}%`} diff={opt.kpis.avgUtilization - base.kpis.avgUtilization} invert />
          <KpiRow label="Total Distance" value={`${opt.kpis.totalDistance} km`} diff={((opt.kpis.totalDistance - base.kpis.totalDistance) / base.kpis.totalDistance) * 100} unit="%" />
          <KpiRow label="Deliveries" value={opt.kpis.totalDeliveries.toString()} diff={((opt.kpis.totalDeliveries - base.kpis.totalDeliveries) / base.kpis.totalDeliveries) * 100} unit="%" />
          <KpiRow label="Emissions" value={`${opt.kpis.totalEmissionsKg} kg`} diff={((opt.kpis.totalEmissionsKg - base.kpis.totalEmissionsKg) / base.kpis.totalEmissionsKg) * 100} unit="%" />
          <KpiRow label="Service Level" value={`${opt.kpis.avgServiceLevel}%`} diff={opt.kpis.avgServiceLevel - base.kpis.avgServiceLevel} />
        </div>
      </div>

      {/* Timeline chart (utilization over time) */}
      <div className="mt-4 bg-[#0a0a0b] border border-[#2a2a33] rounded p-3">
        <div className="text-[10px] text-[#71717a] uppercase tracking-wider mb-2">Utilization Timeline (24h)</div>
        <TimelineChart data={opt.timeline.filter((t) => t.metric === 'utilization')} />
      </div>

      {/* Bottlenecks */}
      {base.bottlenecks.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] text-[#71717a] uppercase tracking-wider mb-2">Bottlenecks (Baseline)</div>
          <div className="space-y-1">
            {base.bottlenecks.slice(0, 5).map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] p-1.5 rounded bg-[#0a0a0b] border border-[#2a2a33]">
                <AlertTriangle className="w-3 h-3" style={{ color: b.severity === 'critical' ? '#ef4444' : b.severity === 'high' ? '#f97316' : '#eab308' }} />
                <span className="text-[#a1a1aa]">{b.node}</span>
                <span className="text-[#52525b]">· t={b.at}h</span>
                <span className="ml-auto uppercase font-mono-data" style={{ color: b.severity === 'critical' ? '#ef4444' : b.severity === 'high' ? '#f97316' : '#eab308' }}>{b.severity}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiRow({ label, value, diff, unit = '', invert }: { label: string; value: string; diff?: number; unit?: string; invert?: boolean }) {
  const diffColor = diff === undefined ? '#52525b' : invert
    ? (diff > 0 ? '#22c55e' : '#ef4444')
    : (diff > 0 ? '#22c55e' : '#ef4444');
  return (
    <div className="flex items-center justify-between py-1 text-[11px]">
      <span className="text-[#71717a]">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono-data text-[#e4e4e7]">{value}</span>
        {diff !== undefined && (
          <span className="font-mono-data text-[10px]" style={{ color: diffColor }}>
            {diff > 0 ? '+' : ''}{diff.toFixed(1)}{unit}
          </span>
        )}
      </span>
    </div>
  );
}

function TimelineChart({ data }: { data: { t: number; value: number }[] }) {
  if (data.length === 0) return <div className="text-[10px] text-[#52525b]">No data</div>;
  const max = Math.max(...data.map((d) => d.value), 100);
  const width = 100;
  const height = 40;
  const points = data
    .map((d, i) => `${(i / (data.length - 1)) * width},${height - (d.value / max) * height}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-16">
      <defs>
        <linearGradient id="utilGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`0,${height} ${points} ${width},${height}`} fill="url(#utilGrad)" stroke="none" />
      <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function SummaryCard({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }) {
  return (
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-[#71717a] uppercase tracking-wider">{label}</span>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div className="font-mono-data text-sm font-bold truncate" style={{ color }}>{value}</div>
    </div>
  );
}
