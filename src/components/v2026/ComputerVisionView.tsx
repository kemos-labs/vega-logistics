'use client';

import { useMemo, useState } from 'react';
import { Eye, Camera, AlertOctagon, Wrench, ScanLine, ShieldAlert } from 'lucide-react';
import { engineRegistry } from '@/lib/engines';

const SEVERITY_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#eab308',
  high: '#f97316',
  critical: '#ef4444',
};

const DAMAGE_BADGE: Record<string, string> = {
  dent: '🔨',
  scratch: '✏️',
  crack: '⚡',
  broken_glass: '🪟',
  tire_wear: '🛞',
  paint_damage: '🎨',
  cargo_damage: '📦',
};

export default function ComputerVisionView() {
  const [refreshKey, setRefreshKey] = useState(0);
  const vehicleIds = useMemo(
    () => Array.from({ length: 12 }, (_, i) => `VEGA-${String(i + 1).padStart(3, '0')}`),
    []
  );
  const snapshot = useMemo(
    () => engineRegistry.computerVision.snapshot(vehicleIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshKey, vehicleIds]
  );

  const detectionClassCounts = snapshot.detections.reduce<Record<string, number>>((acc, d) => {
    acc[d.objectClass] = (acc[d.objectClass] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-4 space-y-4 overflow-y-auto flex-1">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#e4e4e7] uppercase tracking-wider flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#3b82f6]" /> Computer Vision
          </h2>
          <p className="text-[10px] text-[#52525b] mt-1">
            Dashcam + warehouse cameras · damage assessment · lane monitoring · ANPR (EN/AR)
          </p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="text-[10px] px-3 py-1.5 rounded bg-[#18181c] border border-[#2a2a33] text-[#a1a1aa] hover:text-[#e4e4e7] transition-colors"
        >
          Refresh frames
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-3">
        <BigMetric label="Detections" value={snapshot.summary.totalDetections.toString()} color="#3b82f6" icon={Camera} />
        <BigMetric label="Damage Flags" value={snapshot.summary.damageCount.toString()} color="#f97316" icon={Wrench} />
        <BigMetric label="Lane Violations" value={snapshot.summary.violationCount.toString()} color="#ef4444" icon={AlertOctagon} />
        <BigMetric label="Avg Confidence" value={`${(snapshot.summary.averageConfidence * 100).toFixed(1)}%`} color="#22c55e" icon={ScanLine} />
        <BigMetric label="Risk Score" value={`${snapshot.riskScore}/100`} color={snapshot.riskScore > 50 ? '#ef4444' : '#eab308'} icon={ShieldAlert} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Detection classes */}
        <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3">Detection Classes</h3>
          <div className="space-y-2">
            {Object.entries(detectionClassCounts).sort((a, b) => b[1] - a[1]).map(([cls, count]) => {
              const pct = (count / snapshot.summary.totalDetections) * 100;
              return (
                <div key={cls}>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-[#a1a1aa] capitalize">{cls.replace(/_/g, ' ')}</span>
                    <span className="font-mono-data text-[#e4e4e7]">{count}</span>
                  </div>
                  <div className="h-1.5 bg-[#0a0a0b] rounded-full overflow-hidden">
                    <div className="h-full bg-[#3b82f6]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Damage assessment */}
        <div className="col-span-2 bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider">Recent Damage Assessments</h3>
            <div className="text-[10px] text-[#71717a]">
              Total est. cost: <span className="font-mono-data text-[#f97316]">SAR {snapshot.summary.totalRepairEstimate.toLocaleString()}</span>
            </div>
          </div>
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {snapshot.damages.length === 0 ? (
              <div className="text-[10px] text-[#52525b] text-center py-6">
                <CheckEmpty />
                No damage detected — fleet is in good condition.
              </div>
            ) : (
              snapshot.damages.slice(0, 12).map((d) => (
                <div key={d.id} className="flex items-center gap-2 p-2 rounded bg-[#0a0a0b] border border-[#2a2a33]">
                  <span className="text-lg">{DAMAGE_BADGE[d.damageType] ?? '⚠️'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono-data text-[#e4e4e7]">{d.vehicleId}</span>
                      <span className="text-[10px] text-[#a1a1aa] capitalize">{d.damageType.replace(/_/g, ' ')}</span>
                      <span className="text-[9px] text-[#52525b]">· {d.severity}</span>
                    </div>
                    <div className="text-[9px] text-[#52525b] mt-0.5 font-mono-data">
                      {d.imageRef} · conf {(d.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-mono-data text-[#f97316]">SAR {d.estimatedRepairCost.toLocaleString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Lane violations */}
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3">Lane Violations</h3>
        <div className="grid grid-cols-4 gap-2">
          {snapshot.violations.length === 0 ? (
            <div className="col-span-4 text-[10px] text-[#52525b] text-center py-4">No violations detected.</div>
          ) : (
            snapshot.violations.slice(0, 8).map((v) => {
              const color = SEVERITY_COLORS[v.severity];
              return (
                <div key={v.id} className="p-2 rounded bg-[#0a0a0b] border border-[#2a2a33]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono-data text-[#e4e4e7]">{v.vehicleId}</span>
                    <span className="text-[9px] font-mono-data px-1.5 py-0.5 rounded" style={{ color, backgroundColor: `${color}22` }}>
                      {v.severity.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#a1a1aa] capitalize">{v.type.replace(/_/g, ' ')}</div>
                  <div className="text-[9px] text-[#52525b] mt-0.5 font-mono-data">{v.speedKmh} km/h</div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function CheckEmpty() {
  return <span className="text-[#22c55e]">✓ </span>;
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
