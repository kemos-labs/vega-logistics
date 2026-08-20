'use client';

import { useMemo, useState } from 'react';
import { Leaf, Factory, Truck, Zap, TreePine, TrendingDown, Award, AlertCircle } from 'lucide-react';
import { engineRegistry } from '@/lib/engines';
import { useSimulatedData } from '@/hooks/useSimulatedData';

export default function CarbonView() {
  const { financialOutput } = useSimulatedData();
  const [refreshKey, setRefreshKey] = useState(0);
  const overview = useMemo(
    () => engineRegistry.carbon.overview(12, 2, financialOutput.totalRevenue, financialOutput.totalMonthlyShipments),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshKey, financialOutput.totalRevenue, financialOutput.totalMonthlyShipments]
  );

  const report = overview.report;
  const totalGross = report.totalScope1 + report.totalScope2 + report.totalScope3;

  return (
    <div className="p-4 space-y-4 overflow-y-auto flex-1">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#e4e4e7] uppercase tracking-wider flex items-center gap-2">
            <Leaf className="w-4 h-4 text-[#22c55e]" /> Carbon & Sustainability
          </h2>
          <p className="text-[10px] text-[#52525b] mt-1">
            Scope 1/2/3 tracking · Saudi Net-Zero 2060 alignment
          </p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="text-[10px] px-3 py-1.5 rounded bg-[#18181c] border border-[#2a2a33] text-[#a1a1aa] hover:text-[#e4e4e7] transition-colors"
        >
          Refresh emissions
        </button>
      </div>

      {/* Top KPI strip */}
      <div className="grid grid-cols-5 gap-3">
        <BigMetric label="Scope 1 (Fuel)" value={`${(report.totalScope1 / 1000).toFixed(1)}t`} color="#ef4444" icon={Truck} />
        <BigMetric label="Scope 2 (Electricity)" value={`${(report.totalScope2 / 1000).toFixed(1)}t`} color="#f97316" icon={Factory} />
        <BigMetric label="Scope 3 (Value Chain)" value={`${(report.totalScope3 / 1000).toFixed(1)}t`} color="#eab308" icon={Zap} />
        <BigMetric label="Offsets Retired" value={`${(report.offsetsRetired / 1000).toFixed(1)}t`} color="#22c55e" icon={TreePine} />
        <BigMetric label="Saudi Net-Zero 2060" value={`${report.saudiNetZero2050Progress}%`} color="#3b82f6" icon={Award} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Emissions breakdown */}
        <div className="col-span-2 bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3">Emissions Breakdown (30 days)</h3>
          <ScopeBar s1={report.totalScope1} s2={report.totalScope2} s3={report.totalScope3} total={totalGross} />
          <div className="grid grid-cols-3 gap-3 mt-4">
            <SmallStat label="Per SAR 1k revenue" value={`${report.intensityPerRevenue} kg`} />
            <SmallStat label="Per shipment" value={`${report.intensityPerShipment} kg`} />
            <SmallStat label="Vs 2020 baseline" value={`${report.reductionVsBaseline}%`} positive={report.reductionVsBaseline > 0} />
          </div>
        </div>

        {/* Lane intensities */}
        <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3">Lane Carbon Intensity</h3>
          <div className="space-y-2">
            {overview.laneIntensities.map((lane) => {
              const color = lane.intensity === 'high' ? '#ef4444' : lane.intensity === 'medium' ? '#eab308' : '#22c55e';
              return (
                <div key={lane.laneId} className="p-2 rounded bg-[#0a0a0b] border border-[#2a2a33]">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#e4e4e7] font-medium">{lane.fromZone} → {lane.toZone}</span>
                    <span className="text-[9px] font-mono-data px-1.5 py-0.5 rounded" style={{ color, backgroundColor: `${color}22` }}>
                      {lane.intensity.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-[#71717a] mt-1">
                    <span>{lane.distanceKm} km</span>
                    <span className="font-mono-data">{lane.totalCo2eKg.toLocaleString()} kg</span>
                  </div>
                  <div className="text-[9px] text-[#52525b] mt-0.5">{lane.vehicleMix}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reduction actions */}
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3 flex items-center gap-2">
          <TrendingDown className="w-3.5 h-3.5 text-[#22c55e]" /> Recommended Reduction Actions
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {overview.actions.map((a) => {
            const color = a.priority === 'high' ? '#ef4444' : a.priority === 'medium' ? '#eab308' : '#71717a';
            return (
              <div key={a.id} className="p-3 rounded bg-[#0a0a0b] border border-[#2a2a33]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-[#e4e4e7]">{a.title}</span>
                  <span className="text-[9px] font-mono-data px-1.5 py-0.5 rounded" style={{ color, backgroundColor: `${color}22` }}>
                    {a.priority.toUpperCase()}
                  </span>
                </div>
                <p className="text-[10px] text-[#71717a] leading-relaxed">{a.description}</p>
                <div className="grid grid-cols-3 gap-2 mt-2 text-[10px]">
                  <div>
                    <div className="text-[#52525b]">CO2e saved</div>
                    <div className="font-mono-data text-[#22c55e]">{(a.co2eSavingKg / 1000).toFixed(1)}t</div>
                  </div>
                  <div>
                    <div className="text-[#52525b]">Cost</div>
                    <div className="font-mono-data text-[#e4e4e7]">SAR {(a.costSar / 1000).toFixed(0)}k</div>
                  </div>
                  <div>
                    <div className="text-[#52525b]">Payback</div>
                    <div className="font-mono-data text-[#3b82f6]">{a.paybackMonths}mo</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Offset portfolio */}
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3 flex items-center gap-2">
          <TreePine className="w-3.5 h-3.5 text-[#22c55e]" /> Offset Portfolio
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {overview.offsets.map((o) => (
            <div key={o.id} className="p-2.5 rounded bg-[#0a0a0b] border border-[#2a2a33]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#e4e4e7]">{o.projectName}</span>
                {o.retired && <span className="text-[9px] text-[#22c55e]">✓ Retired</span>}
                {!o.retired && <span className="text-[9px] text-[#eab308] flex items-center gap-0.5"><AlertCircle className="w-2.5 h-2.5" /> Active</span>}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1.5 text-[10px]">
                <div>
                  <div className="text-[#52525b]">Volume</div>
                  <div className="font-mono-data text-[#e4e4e7]">{(o.co2eOffsetKg / 1000).toFixed(1)}t</div>
                </div>
                <div>
                  <div className="text-[#52525b]">Price/t</div>
                  <div className="font-mono-data text-[#e4e4e7]">SAR {o.pricePerTonne}</div>
                </div>
              </div>
              <div className="text-[9px] text-[#52525b] mt-1">{o.registry} · vintage {o.vintage}</div>
            </div>
          ))}
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

function SmallStat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="p-2 rounded bg-[#0a0a0b] border border-[#2a2a33]">
      <div className="text-[9px] text-[#52525b] uppercase tracking-wider">{label}</div>
      <div className="font-mono-data text-sm font-bold mt-0.5" style={{ color: positive === undefined ? '#e4e4e7' : positive ? '#22c55e' : '#ef4444' }}>
        {value}
      </div>
    </div>
  );
}

function ScopeBar({ s1, s2, s3, total }: { s1: number; s2: number; s3: number; total: number }) {
  if (total === 0) return null;
  const p1 = (s1 / total) * 100;
  const p2 = (s2 / total) * 100;
  const p3 = (s3 / total) * 100;
  return (
    <div>
      <div className="flex h-6 rounded overflow-hidden border border-[#2a2a33]">
        <div style={{ width: `${p1}%`, background: '#ef4444' }} className="flex items-center justify-center text-[9px] text-white font-mono-data">{p1.toFixed(0)}%</div>
        <div style={{ width: `${p2}%`, background: '#f97316' }} className="flex items-center justify-center text-[9px] text-white font-mono-data">{p2.toFixed(0)}%</div>
        <div style={{ width: `${p3}%`, background: '#eab308' }} className="flex items-center justify-center text-[9px] text-white font-mono-data">{p3.toFixed(0)}%</div>
      </div>
      <div className="flex justify-between text-[10px] text-[#71717a] mt-1.5">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#ef4444]" /> Scope 1</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#f97316]" /> Scope 2</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#eab308]" /> Scope 3</span>
      </div>
    </div>
  );
}
