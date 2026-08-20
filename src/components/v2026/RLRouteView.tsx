'use client';

import { useMemo, useState } from 'react';
import { Route, Brain, TrendingDown, Gauge, Target, Zap, Activity } from 'lucide-react';
import { engineRegistry } from '@/lib/engines';
import { useSimulatedData } from '@/hooks/useSimulatedData';

const ACTION_COLORS: Record<string, string> = {
  reassign: '#3b82f6',
  reroute: '#a855f7',
  hold: '#71717a',
  swap: '#eab308',
  add_vehicle: '#22c55e',
};

export default function RLRouteView() {
  const { vehicles } = useSimulatedData();
  const [refreshKey, setRefreshKey] = useState(0);
  const hour = useMemo(() => new Date().getHours(), []);

  const result = useMemo(
    () => engineRegistry.rlRoute.batch(vehicles.slice(0, 6), hour),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshKey, vehicles, hour]
  );
  const stats = useMemo(
    () => engineRegistry.rlRoute.stats(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshKey]
  );

  return (
    <div className="p-4 space-y-4 overflow-y-auto flex-1">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#e4e4e7] uppercase tracking-wider flex items-center gap-2">
            <Route className="w-4 h-4 text-[#a855f7]" /> RL Route Optimizer
          </h2>
          <p className="text-[10px] text-[#52525b] mt-1">
            Q-learning dispatch policy · policy {stats.policyVersion} · {stats.episodes.toLocaleString()} episodes
          </p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="text-[10px] px-3 py-1.5 rounded bg-[#18181c] border border-[#2a2a33] text-[#a1a1aa] hover:text-[#e4e4e7] transition-colors"
        >
          Re-run policy
        </button>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-5 gap-3">
        <BigMetric label="Optimized Reward" value={result.prediction.optimizedReward.toFixed(1)} color="#22c55e" icon={Target} />
        <BigMetric label="Baseline Reward" value={result.prediction.baselineReward.toFixed(1)} color="#71717a" icon={Activity} />
        <BigMetric label="Fuel Saving" value={`${result.prediction.fuelSavingPct}%`} color="#3b82f6" icon={TrendingDown} />
        <BigMetric label="Time Saving" value={`${result.prediction.timeSavingPct}%`} color="#a855f7" icon={Zap} />
        <BigMetric label="Epsilon (ε)" value={stats.epsilon.toFixed(3)} color="#06b6d4" icon={Gauge} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Training stats */}
        <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Brain className="w-3.5 h-3.5 text-[#a855f7]" /> Training Stats
          </h3>
          <div className="space-y-2">
            <Stat label="Episodes" value={stats.episodes.toLocaleString()} />
            <Stat label="Total Reward" value={stats.totalReward.toLocaleString()} />
            <Stat label="Avg Reward" value={stats.avgReward.toFixed(2)} />
            <Stat label="Loss" value={stats.loss.toFixed(4)} />
            <Stat label="Policy" value={stats.policyVersion} />
            <Stat label="Last Update" value={new Date(stats.lastUpdate).toLocaleTimeString('en-US', { hour12: false })} />
          </div>
        </div>

        {/* Recommended actions */}
        <div className="col-span-2 bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3">Top Recommended Actions (next hour)</h3>
          <div className="space-y-1.5">
            {result.actions.length === 0 ? (
              <div className="text-[10px] text-[#52525b] text-center py-4">No rebalancing actions needed at this hour.</div>
            ) : (
              result.actions.map((a) => {
                const color = ACTION_COLORS[a.type];
                return (
                  <div key={a.id} className="flex items-center gap-2 p-2 rounded bg-[#0a0a0b] border border-[#2a2a33]">
                    <span className="text-[9px] font-mono-data px-1.5 py-0.5 rounded uppercase" style={{ color, backgroundColor: `${color}22` }}>
                      {a.type}
                    </span>
                    <span className="text-[11px] font-mono-data text-[#e4e4e7]">{a.vehicleId}</span>
                    {a.fromZone && a.toZone && (
                      <span className="text-[10px] text-[#71717a]">{a.fromZone} → {a.toZone}</span>
                    )}
                    <span className="ml-auto text-[10px] font-mono-data text-[#22c55e]">+{a.expectedReward.toFixed(2)}</span>
                    <span className="text-[9px] text-[#52525b] font-mono-data w-12 text-right">{(a.confidence * 100).toFixed(0)}% conf</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Route comparison table */}
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3">Route Comparison (Baseline vs Optimized)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-[#71717a]">
                <th className="text-left p-1.5">Vehicle</th>
                <th className="text-right p-1.5">Stops</th>
                <th className="text-right p-1.5">Distance (km)</th>
                <th className="text-right p-1.5">Duration (min)</th>
                <th className="text-right p-1.5">Reward Δ</th>
                <th className="text-right p-1.5">Improvement</th>
              </tr>
            </thead>
            <tbody>
              {result.baseline.map((b, i) => {
                const o = result.optimized[i];
                if (!o) return null;
                const distSave = ((b.distanceKm - o.distanceKm) / b.distanceKm) * 100;
                const timeSave = ((b.durationMin - o.durationMin) / b.durationMin) * 100;
                return (
                  <tr key={b.id} className="border-t border-[#2a2a33]">
                    <td className="p-1.5 font-mono-data text-[#e4e4e7]">{b.vehicleId}</td>
                    <td className="p-1.5 text-right text-[#a1a1aa]">{b.stops.length}</td>
                    <td className="p-1.5 text-right font-mono-data">
                      <span className="text-[#71717a]">{b.distanceKm.toFixed(1)}</span>
                      <span className="text-[#52525b]"> → </span>
                      <span className="text-[#22c55e]">{o.distanceKm.toFixed(1)}</span>
                    </td>
                    <td className="p-1.5 text-right font-mono-data">
                      <span className="text-[#71717a]">{b.durationMin}</span>
                      <span className="text-[#52525b]"> → </span>
                      <span className="text-[#22c55e]">{o.durationMin}</span>
                    </td>
                    <td className="p-1.5 text-right font-mono-data text-[#22c55e]">+{(o.reward - b.reward).toFixed(2)}</td>
                    <td className="p-1.5 text-right font-mono-data text-[#3b82f6]">
                      {((distSave + timeSave) / 2).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[11px] py-1 border-b border-[#2a2a33] last:border-0">
      <span className="text-[#71717a]">{label}</span>
      <span className="font-mono-data text-[#e4e4e7]">{value}</span>
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
