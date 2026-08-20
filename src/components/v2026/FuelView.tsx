'use client';

import { useMemo, useState } from 'react';
import { Section, StatCard, Badge, Panel, PanelTitle, Bar } from './Shell';
import { useApp50 } from '@/lib/AppContext50';

import { FuelEvent } from '@/lib/types2026';

export default function FuelView() {
  const { snapshot, kpis } = useApp50();
  const [tab, setTab] = useState<'events' | 'anomalies' | 'leaderboard' | 'cards'>('events');

  // Per-vehicle efficiency ranking
  const efficiencyRanking = useMemo(() => {
    const map = new Map<string, { liters: number; cost: number; km: number; events: number }>();
    snapshot.fuelEvents.forEach((e) => {
      const cur = map.get(e.vehicleId) ?? { liters: 0, cost: 0, km: 0, events: 0 };
      cur.liters += e.liters;
      cur.cost += e.costSar;
      cur.km += e.kmSinceLastFill;
      cur.events += 1;
      map.set(e.vehicleId, cur);
    });
    return Array.from(map.entries()).map(([id, d]) => ({
      vehicleId: id,
      plate: snapshot.vehicles.find((v) => v.id === id)?.plate ?? id,
      consumption: d.km > 0 ? (d.liters / d.km) * 100 : 0,
      costPerKm: d.km > 0 ? d.cost / d.km : 0,
      totalCost: d.cost,
      totalLiters: d.liters,
      events: d.events,
    })).sort((a, b) => a.consumption - b.consumption);
  }, [snapshot]);

  const anomalies = snapshot.fuelEvents.filter((e) => e.isAnomaly);

  return (
    <Section
      title="Fuel & Cost Control"
      subtitle={`${snapshot.fuelEvents.length} events · ${snapshot.fuelCards.length} fuel cards`}
      actions={
        <div className="flex items-center gap-1 bg-[#18181c] border border-[#2a2a33] rounded p-0.5">
          {(['events', 'anomalies', 'leaderboard', 'cards'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-[10px] px-3 py-1 rounded capitalize ${tab === t ? 'bg-[#3b82f6] text-white' : 'text-[#a1a1aa] hover:text-[#e4e4e7]'}`}
            >
              {t}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-5 gap-3 mb-4">
        <StatCard label="Month Spend" value={`${(kpis.fuelCostMonth / 1000).toFixed(0)}k`} unit="SAR" color="#f97316" sub="Last 30d" />
        <StatCard label="Avg Consumption" value={kpis.avgConsumptionL100km} unit="L/100km" color="#06b6d4" />
        <StatCard label="Anomalies" value={kpis.fuelAnomalies} color={kpis.fuelAnomalies > 5 ? '#ef4444' : '#22c55e'} sub="Suspicious events" />
        <StatCard label="Best Vehicle" value={efficiencyRanking[0]?.consumption.toFixed(1) ?? '—'} unit="L/100km" color="#22c55e" sub={efficiencyRanking[0]?.plate ?? ''} />
        <StatCard label="Worst Vehicle" value={efficiencyRanking[efficiencyRanking.length - 1]?.consumption.toFixed(1) ?? '—'} unit="L/100km" color="#ef4444" sub={efficiencyRanking[efficiencyRanking.length - 1]?.plate ?? ''} />
      </div>

      {tab === 'events' && (
        <Panel>
          <PanelTitle>Recent Fuel Events</PanelTitle>
          <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
            <table className="w-full text-[10px]">
              <thead className="sticky top-0 bg-[#18181c] z-10">
                <tr className="text-[#71717a]">
                  <th className="text-left p-1.5">Time</th>
                  <th className="text-left p-1.5">Vehicle</th>
                  <th className="text-left p-1.5">Station</th>
                  <th className="text-right p-1.5">Liters</th>
                  <th className="text-right p-1.5">Cost</th>
                  <th className="text-right p-1.5">Price/L</th>
                  <th className="text-right p-1.5">L/100km</th>
                  <th className="text-left p-1.5">Source</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.fuelEvents.slice(0, 50).map((e) => (
                  <FuelRow key={e.id} event={e} vehiclePlate={snapshot.vehicles.find((v) => v.id === e.vehicleId)?.plate ?? e.vehicleId} />
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === 'anomalies' && (
        <Panel>
          <PanelTitle action={<Badge color="#ef4444">{anomalies.length} detected</Badge>}>Fuel Anomalies</PanelTitle>
          {anomalies.length === 0 ? (
            <div className="text-center text-[10px] text-[#52525b] py-8">No anomalies detected</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-[560px] overflow-y-auto">
              {anomalies.map((a) => (
                <div key={a.id} className="p-3 rounded bg-[#0a0a0b] border border-[#ef444433]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono-data text-[#e4e4e7]">{snapshot.vehicles.find((v) => v.id === a.vehicleId)?.plate ?? a.vehicleId}</span>
                    <span className="text-[9px] text-[#52525b] font-mono-data">{new Date(a.timestamp).toLocaleString('en-US', { hour12: false })}</span>
                  </div>
                  <div className="text-[10px] text-[#a1a1aa]">{a.stationName}</div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-[10px]">
                    <div>
                      <div className="text-[#71717a] text-[9px]">Liters</div>
                      <div className="font-mono-data text-[#f97316]">{a.liters}</div>
                    </div>
                    <div>
                      <div className="text-[#71717a] text-[9px]">Cost</div>
                      <div className="font-mono-data text-[#f97316]">SAR {Math.round(a.costSar)}</div>
                    </div>
                    <div>
                      <div className="text-[#71717a] text-[9px]">L/100km</div>
                      <div className="font-mono-data" style={{ color: a.consumptionLPer100km > 12 ? '#ef4444' : '#22c55e' }}>{a.consumptionLPer100km}</div>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {a.anomalyFlags.map((f) => <Badge key={f} color="#ef4444">{f.replace('_', ' ')}</Badge>)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {tab === 'leaderboard' && (
        <Panel>
          <PanelTitle action={<Badge color="#22c55e">Best → Worst</Badge>}>Fuel Efficiency Leaderboard (L/100km)</PanelTitle>
          <div className="space-y-1 max-h-[560px] overflow-y-auto">
            {efficiencyRanking.map((v, i) => {
              const max = Math.max(...efficiencyRanking.map((x) => x.consumption));
              return (
                <div key={v.vehicleId} className="grid grid-cols-12 gap-2 items-center p-2 rounded bg-[#0a0a0b] border border-[#2a2a33]">
                  <div className="col-span-1 text-center">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mx-auto" style={{ backgroundColor: i < 3 ? '#22c55e' : '#2a2a33', color: i < 3 ? '#000' : '#a1a1aa' }}>{i + 1}</div>
                  </div>
                  <div className="col-span-2 text-[11px] font-mono-data text-[#e4e4e7]">{v.plate}</div>
                  <div className="col-span-4">
                    <div className="text-[9px] text-[#71717a] uppercase">L/100km</div>
                    <Bar value={max - v.consumption} max={max} color={i < 3 ? '#22c55e' : i < 10 ? '#3b82f6' : '#ef4444'} height={4} />
                    <div className="text-[10px] font-mono-data mt-0.5" style={{ color: i < 3 ? '#22c55e' : i < 10 ? '#3b82f6' : '#ef4444' }}>{v.consumption.toFixed(1)}</div>
                  </div>
                  <div className="col-span-2 text-right">
                    <div className="text-[9px] text-[#71717a] uppercase">Cost/km</div>
                    <div className="text-[10px] font-mono-data text-[#f97316]">SAR {v.costPerKm.toFixed(2)}</div>
                  </div>
                  <div className="col-span-3 text-right">
                    <div className="text-[9px] text-[#71717a] uppercase">Total Cost (30d)</div>
                    <div className="text-[10px] font-mono-data text-[#e4e4e7]">SAR {Math.round(v.totalCost).toLocaleString()}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {tab === 'cards' && (
        <Panel>
          <PanelTitle>Fuel Cards ({snapshot.fuelCards.length})</PanelTitle>
          <div className="grid grid-cols-3 gap-2 max-h-[560px] overflow-y-auto">
            {snapshot.fuelCards.slice(0, 30).map((c) => (
              <div key={c.id} className="p-3 rounded bg-[#0a0a0b] border border-[#2a2a33]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono-data text-[#e4e4e7]">{c.vehicleId}</span>
                  <Badge color={c.status === 'active' ? '#22c55e' : c.status === 'suspended' ? '#f97316' : '#71717a'}>{c.status}</Badge>
                </div>
                <div className="text-[10px] text-[#a1a1aa] font-mono-data">{c.cardNumber}</div>
                <div className="text-[9px] text-[#71717a] mt-1 capitalize">{c.provider}</div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
                  <div>
                    <div className="text-[#71717a] text-[9px]">Daily Limit</div>
                    <div className="font-mono-data text-[#3b82f6]">SAR {c.dailyLimitSar}</div>
                  </div>
                  <div>
                    <div className="text-[#71717a] text-[9px]">Monthly</div>
                    <div className="font-mono-data text-[#3b82f6]">SAR {c.monthlyLimitSar.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </Section>
  );
}

function FuelRow({ event, vehiclePlate }: { event: FuelEvent; vehiclePlate: string }) {
  return (
    <tr className="border-t border-[#2a2a33]" style={{ backgroundColor: event.isAnomaly ? 'rgba(239, 68, 68, 0.05)' : undefined }}>
      <td className="p-1.5 text-[#a1a1aa] font-mono-data">{new Date(event.timestamp).toLocaleString('en-US', { hour12: false, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
      <td className="p-1.5 font-mono-data text-[#e4e4e7]">{vehiclePlate}</td>
      <td className="p-1.5 text-[#a1a1aa]">{event.stationName}</td>
      <td className="p-1.5 text-right font-mono-data text-[#e4e4e7]">{event.liters.toFixed(1)}</td>
      <td className="p-1.5 text-right font-mono-data text-[#f97316]">SAR {event.costSar.toFixed(0)}</td>
      <td className="p-1.5 text-right font-mono-data text-[#a1a1aa]">{event.pricePerLiter.toFixed(2)}</td>
      <td className="p-1.5 text-right font-mono-data" style={{ color: event.consumptionLPer100km > 12 ? '#ef4444' : '#22c55e' }}>{event.consumptionLPer100km.toFixed(1)}</td>
      <td className="p-1.5 text-[#a1a1aa] capitalize">{event.source}{event.isAnomaly && ' ⚠'}</td>
    </tr>
  );
}
