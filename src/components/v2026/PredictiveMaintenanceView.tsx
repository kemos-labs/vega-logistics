'use client';

import { useMemo, useState } from 'react';
import { Wrench, AlertTriangle, CheckCircle2, Clock, DollarSign, Activity, Cpu } from 'lucide-react';
import { engineRegistry } from '@/lib/engines';

const HEALTH_COLORS: Record<string, string> = {
  healthy: '#22c55e',
  degraded: '#eab308',
  at_risk: '#f97316',
  failed: '#ef4444',
};

const COMPONENT_ICONS: Record<string, string> = {
  engine: '⚙️',
  brakes: '🛑',
  tires: '🛞',
  battery: '🔋',
  transmission: '🔧',
  cooling: '❄️',
};

export default function PredictiveMaintenanceView() {
  const [refreshKey, setRefreshKey] = useState(0);
  const vehicleIds = useMemo(
    () => Array.from({ length: 12 }, (_, i) => `VEGA-${String(i + 1).padStart(3, '0')}`),
    []
  );
  const overview = useMemo(
    () => engineRegistry.predictiveMaintenance.overview(vehicleIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshKey, vehicleIds]
  );

  return (
    <div className="p-4 space-y-4 overflow-y-auto flex-1">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#e4e4e7] uppercase tracking-wider flex items-center gap-2">
            <Wrench className="w-4 h-4 text-[#f97316]" /> Predictive Maintenance
          </h2>
          <p className="text-[10px] text-[#52525b] mt-1">
            Telemetry-driven RUL prediction · schedule work before failure
          </p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="text-[10px] px-3 py-1.5 rounded bg-[#18181c] border border-[#2a2a33] text-[#a1a1aa] hover:text-[#e4e4e7] transition-colors"
        >
          Recompute predictions
        </button>
      </div>

      {/* Fleet health summary */}
      <div className="grid grid-cols-4 gap-3">
        <BigMetric label="Avg Fleet Health" value={`${overview.avgHealthScore}/100`} color="#22c55e" icon={Activity} />
        <BigMetric label="Critical Alerts" value={overview.criticalCount.toString()} color="#ef4444" icon={AlertTriangle} />
        <BigMetric label="High Priority" value={overview.highCount.toString()} color="#f97316" icon={Clock} />
        <BigMetric label="Est. Service Cost" value={`SAR ${(overview.totalEstimatedCost / 1000).toFixed(0)}k`} color="#3b82f6" icon={DollarSign} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Asset health grid */}
        <div className="col-span-2 bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3">Fleet Health</h3>
          <div className="grid grid-cols-4 gap-2">
            {overview.assets.map((a) => {
              const color = HEALTH_COLORS[a.health];
              return (
                <div key={a.vehicleId} className="p-2.5 rounded bg-[#0a0a0b] border border-[#2a2a33]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono-data text-[#e4e4e7]">{a.vehicleId}</span>
                    <span className="text-[9px] font-mono-data px-1.5 py-0.5 rounded" style={{ color, backgroundColor: `${color}22` }}>
                      {a.healthScore}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#1c1c21] rounded-full overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${a.healthScore}%`, backgroundColor: color }} />
                  </div>
                  <div className="text-[9px] text-[#52525b] mt-1.5 flex items-center justify-between">
                    <span>MTBF {a.mtbfDays}d</span>
                    {a.openPredictions > 0 && <span className="text-[#f97316]">{a.openPredictions} alert{a.openPredictions > 1 ? 's' : ''}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Maintenance schedule */}
        <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3">Upcoming Service</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {overview.schedule.slice(0, 10).map((s, i) => {
              const color = s.priority === 'critical' ? '#ef4444' : '#f97316';
              return (
                <div key={i} className="p-2 rounded bg-[#0a0a0b] border border-[#2a2a33]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono-data text-[#e4e4e7]">{s.vehicleId}</span>
                    <span className="text-[9px] font-mono-data px-1.5 py-0.5 rounded" style={{ color, backgroundColor: `${color}22` }}>
                      {s.priority.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#71717a] mt-1 leading-relaxed">{s.reason}</p>
                  <div className="flex justify-between text-[9px] text-[#52525b] mt-1.5">
                    <span>{new Date(s.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <span className="font-mono-data">SAR {s.estimatedCost.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
            {overview.schedule.length === 0 && (
              <div className="text-[10px] text-[#52525b] text-center py-4">No urgent maintenance scheduled.</div>
            )}
          </div>
        </div>
      </div>

      {/* Component risk heatmap */}
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-[#a855f7]" /> Component Risk Heatmap (30d failure probability)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-[#71717a]">
                <th className="text-left p-1.5">Vehicle</th>
                {['engine', 'brakes', 'tires', 'battery', 'transmission', 'cooling'].map((c) => (
                  <th key={c} className="p-1.5 text-center capitalize">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {overview.assets.map((a) => {
                const vehiclePreds = overview.predictions.filter((p) => p.vehicleId === a.vehicleId);
                return (
                  <tr key={a.vehicleId} className="border-t border-[#2a2a33]">
                    <td className="p-1.5 font-mono-data text-[#e4e4e7]">{a.vehicleId}</td>
                    {['engine', 'brakes', 'tires', 'battery', 'transmission', 'cooling'].map((comp) => {
                      const p = vehiclePreds.find((pp) => pp.component === comp);
                      const v = p?.failureProbability30d ?? 0;
                      const opacity = Math.min(1, v * 2);
                      const color = v > 0.4 ? '#ef4444' : v > 0.2 ? '#f97316' : v > 0.1 ? '#eab308' : '#22c55e';
                      return (
                        <td key={comp} className="p-1 text-center">
                          <div
                            className="rounded py-1 font-mono-data text-[10px]"
                            style={{ backgroundColor: `${color}${Math.round(opacity * 80).toString(16).padStart(2, '0')}`, color }}
                          >
                            {(v * 100).toFixed(0)}%
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top critical predictions */}
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3">Top Risk Predictions</h3>
        <div className="space-y-1.5">
          {overview.predictions
            .filter((p) => p.priority === 'high' || p.priority === 'critical')
            .sort((a, b) => b.failureProbability30d - a.failureProbability30d)
            .slice(0, 8)
            .map((p) => {
              const color = p.priority === 'critical' ? '#ef4444' : '#f97316';
              return (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded bg-[#0a0a0b] border border-[#2a2a33]">
                  <span className="text-base">{COMPONENT_ICONS[p.component]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono-data text-[#e4e4e7]">{p.vehicleId}</span>
                      <span className="text-[10px] text-[#71717a] capitalize">{p.component}</span>
                      <span className="text-[9px] font-mono-data px-1.5 py-0.5 rounded" style={{ color, backgroundColor: `${color}22` }}>
                        {p.priority.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#71717a] mt-0.5">{p.recommendedAction}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-mono-data" style={{ color }}>
                      {(p.failureProbability30d * 100).toFixed(0)}%
                    </div>
                    <div className="text-[9px] text-[#52525b]">SAR {p.estimatedCost.toLocaleString()}</div>
                  </div>
                </div>
              );
            })}
          {overview.predictions.filter((p) => p.priority === 'high' || p.priority === 'critical').length === 0 && (
            <div className="text-[10px] text-[#52525b] text-center py-4 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#22c55e]" /> All systems nominal — no high-priority predictions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BigMetric({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }) {
  return (
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-[#71717a] uppercase tracking-wider">{label}</span>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div className="font-mono-data text-xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
