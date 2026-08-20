'use client';

import { useMemo } from 'react';
import { Section, StatCard, Badge, Panel, PanelTitle, Bar } from '@/components/v2026/Shell';
import { MaintenanceEntry, MaintenanceType, VehicleClass } from '@/lib/types';
import {  Trash2, Wrench, CircleDot, AlertTriangle, Calendar } from 'lucide-react';

interface MaintenanceProps {
  entries: MaintenanceEntry[];
  vehicleClasses: VehicleClass[];
  onChange: (updater: (prev: MaintenanceEntry[]) => MaintenanceEntry[]) => void;
  onAdd: (vehicleClassId: string) => void;
  monthlyTotal: number;
}

const TYPE_COLOR: Record<MaintenanceType, string> = {
  routine: '#3b82f6',
  repair: '#f97316',
  tyre: '#a855f7',
};

const TYPE_LABEL: Record<MaintenanceType, string> = {
  routine: 'Routine',
  repair: 'Repair',
  tyre: 'Tyre',
};

export default function Maintenance({ entries, vehicleClasses, onChange, onAdd, monthlyTotal }: MaintenanceProps) {
  const enabledClasses = useMemo(() => vehicleClasses.filter((c) => c.enabled), [vehicleClasses]);
  const enabledEntries = useMemo(() => entries.filter((e) => e.enabled), [entries]);

  // group by vehicle class
  const grouped = useMemo(() => {
    const map = new Map<string, MaintenanceEntry[]>();
    enabledClasses.forEach((c) => map.set(c.id, []));
    enabledEntries.forEach((e) => {
      if (map.has(e.vehicleClassId)) map.get(e.vehicleClassId)!.push(e);
    });
    return map;
  }, [enabledClasses, enabledEntries]);

  const perClassCost = useMemo(() => {
    const out = new Map<string, number>();
    enabledClasses.forEach((c) => {
      const list = grouped.get(c.id) ?? [];
      const sum = list.reduce((s, e) => s + c.quantity * e.frequency * e.costPerEvent, 0);
      out.set(c.id, sum);
    });
    return out;
  }, [enabledClasses, grouped]);

  return (
    <Section
      title="Maintenance Management"
      subtitle={`All costs re-anchored to Fleet & Vehicles classes — no hardcoded values`}
      actions={
        <div className="flex items-center gap-2">
          {enabledClasses.length === 0 ? (
            <span className="text-[10px] text-[#52525b]">Add a vehicle class first</span>
          ) : (
            <select
              onChange={(e) => {
                if (e.target.value) {
                  onAdd(e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              className="bg-[#18181c] border border-[#2a2a33] rounded px-2 py-1 text-[10px] text-[#e4e4e7] focus:outline-none focus:border-[#3b82f6]"
            >
              <option value="" disabled>+ Add to class…</option>
              {enabledClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.quantity})</option>
              ))}
            </select>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-4 gap-3 mb-4">
        <StatCard label="Monthly Total" value={`SAR ${monthlyTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} color="#f97316" sub="All maintenance combined" />
        <StatCard label="Active Entries" value={entries.filter((e) => e.enabled).length} color="#3b82f6" sub={`${entries.length} total`} />
        <StatCard label="Vehicle Classes" value={enabledClasses.length} color="#22c55e" sub="From Fleet & Vehicles" />
        <StatCard label="Depreciation" value="None" color="#71717a" sub="Fleet is rented" />
      </div>

      {enabledClasses.length === 0 && (
        <Panel>
          <div className="text-center py-8">
            <Wrench className="w-8 h-8 mx-auto text-[#52525b] mb-2" />
            <div className="text-xs text-[#a1a1aa]">No vehicle classes configured</div>
            <div className="text-[10px] text-[#52525b] mt-1">Add a vehicle class in Fleet & Vehicles to start tracking maintenance.</div>
          </div>
        </Panel>
      )}

      <div className="space-y-3">
        {enabledClasses.map((c) => {
          const list = grouped.get(c.id) ?? [];
          const classCost = perClassCost.get(c.id) ?? 0;
          return (
            <Panel key={c.id} className="p-0">
              <div className="p-3 border-b border-[#2a2a33] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TruckBadge>{c.name}</TruckBadge>
                  <span className="text-[10px] text-[#52525b]">{c.quantity} vehicles</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#71717a] uppercase tracking-wider">Class total</span>
                  <span className="font-mono-data text-sm font-bold text-[#f97316]">SAR {classCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[9px] uppercase tracking-wider text-[#52525b] border-b border-[#2a2a33] bg-[#0c0c0f]">
                <div className="col-span-1">On</div>
                <div className="col-span-3">Maintenance Type</div>
                <div className="col-span-2 text-right">Cost / Event (SAR)</div>
                <div className="col-span-2 text-right">Frequency / vehicle / mo</div>
                <div className="col-span-2 text-right">Monthly / vehicle</div>
                <div className="col-span-2 text-right">Class Monthly</div>
                <div className="col-span-1 text-right"></div>
              </div>

              {list.length === 0 ? (
                <div className="px-3 py-4 text-center text-[10px] text-[#52525b]">No maintenance entries for this class yet.</div>
              ) : (
                <div className="divide-y divide-[#1f1f26]">
                  {list.map((e) => {
                    const monthlyPerVehicle = e.frequency * e.costPerEvent;
                    const classMonthly = monthlyPerVehicle * c.quantity;
                    return (
                      <div key={e.id} className="grid grid-cols-12 gap-2 items-center px-3 py-2 hover:bg-[#131316] transition-colors">
                        <div className="col-span-1">
                          <input
                            type="checkbox"
                            checked={e.enabled}
                            onChange={(ev) => onChange((prev) => prev.map((x) => (x.id === e.id ? { ...x, enabled: ev.target.checked } : x)))}
                            className="w-3.5 h-3.5 accent-[#3b82f6]"
                          />
                        </div>
                        <div className="col-span-3">
                          <select
                            value={e.type}
                            onChange={(ev) => onChange((prev) => prev.map((x) => (x.id === e.id ? { ...x, type: ev.target.value as MaintenanceType } : x)))}
                            className="w-full bg-transparent border-none text-xs focus:outline-none focus:bg-[#0a0a0b] focus:px-2 focus:py-1 rounded"
                            style={{ color: TYPE_COLOR[e.type] }}
                          >
                            {(['routine', 'repair', 'tyre'] as MaintenanceType[]).map((t) => (
                              <option key={t} value={t} className="bg-[#0a0a0b] text-[#e4e4e7]">{TYPE_LABEL[t]}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min={0}
                            step={50}
                            value={e.costPerEvent}
                            onChange={(ev) => onChange((prev) => prev.map((x) => (x.id === e.id ? { ...x, costPerEvent: Math.max(0, parseFloat(ev.target.value) || 0) } : x)))}
                            className="w-full bg-transparent text-right text-xs font-mono-data text-[#e4e4e7] focus:outline-none focus:bg-[#0a0a0b] focus:px-2 focus:py-1 rounded"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={e.frequency}
                            onChange={(ev) => onChange((prev) => prev.map((x) => (x.id === e.id ? { ...x, frequency: Math.max(0, parseFloat(ev.target.value) || 0) } : x)))}
                            className="w-full bg-transparent text-right text-xs font-mono-data text-[#e4e4e7] focus:outline-none focus:bg-[#0a0a0b] focus:px-2 focus:py-1 rounded"
                          />
                        </div>
                        <div className="col-span-2 text-right font-mono-data text-[10px] text-[#a1a1aa]">
                          SAR {monthlyPerVehicle.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </div>
                        <div className="col-span-2 text-right font-mono-data text-[10px] text-[#f97316]">
                          SAR {classMonthly.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </div>
                        <div className="col-span-1 text-right">
                          <button
                            onClick={() => onChange((prev) => prev.filter((x) => x.id !== e.id))}
                            className="text-[#71717a] hover:text-[#ef4444] transition-colors"
                            title="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-12 gap-2 px-3 py-2.5 border-t border-[#2a2a33] bg-[#0c0c0f]">
                <div className="col-span-7 text-[10px] text-[#71717a] uppercase tracking-wider flex items-center gap-1.5">
                  <Wrench className="w-3 h-3" /> {c.name} Maintenance Total
                </div>
                <div className="col-span-2 text-right font-mono-data text-[10px] text-[#71717a]">{list.length} entries</div>
                <div className="col-span-2"></div>
                <div className="col-span-2 text-right font-mono-data text-xs font-bold text-[#f97316]">
                  SAR {classCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </div>
                <div className="col-span-1"></div>
              </div>
            </Panel>
          );
        })}
      </div>

      {enabledClasses.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Panel>
            <PanelTitle>Cost by Vehicle Class</PanelTitle>
            <div className="space-y-2">
              {enabledClasses.map((c) => {
                const cost = perClassCost.get(c.id) ?? 0;
                const pct = monthlyTotal > 0 ? (cost / monthlyTotal) * 100 : 0;
                return (
                  <div key={c.id}>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-[#e4e4e7]">{c.name}</span>
                      <span className="font-mono-data text-[#f97316]">SAR {cost.toLocaleString('en-US', { maximumFractionDigits: 0 })} · {pct.toFixed(0)}%</span>
                    </div>
                    <Bar value={pct} max={100} color="#f97316" height={6} />
                  </div>
                );
              })}
            </div>
          </Panel>
          <Panel>
            <PanelTitle>Cost by Maintenance Type</PanelTitle>
            <div className="space-y-2">
              {(['routine', 'repair', 'tyre'] as MaintenanceType[]).map((t) => {
                const sum = enabledEntries
                  .filter((e) => e.type === t)
                  .reduce((s, e) => {
                    const c = enabledClasses.find((vc) => vc.id === e.vehicleClassId);
                    return s + (c ? c.quantity * e.frequency * e.costPerEvent : 0);
                  }, 0);
                const pct = monthlyTotal > 0 ? (sum / monthlyTotal) * 100 : 0;
                return (
                  <div key={t}>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-[#e4e4e7] flex items-center gap-1.5">
                        <TypeIcon type={t} /> {TYPE_LABEL[t]}
                      </span>
                      <span className="font-mono-data" style={{ color: TYPE_COLOR[t] }}>SAR {sum.toLocaleString('en-US', { maximumFractionDigits: 0 })} · {pct.toFixed(0)}%</span>
                    </div>
                    <Bar value={pct} max={100} color={TYPE_COLOR[t]} height={6} />
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      )}
    </Section>
  );
}

function TruckBadge({ children }: { children: React.ReactNode }) {
  return <Badge color="#3b82f6">{children}</Badge>;
}

function TypeIcon({ type }: { type: MaintenanceType }) {
  if (type === 'routine') return <CircleDot className="w-3 h-3" style={{ color: TYPE_COLOR[type] }} />;
  if (type === 'repair') return <AlertTriangle className="w-3 h-3" style={{ color: TYPE_COLOR[type] }} />;
  return <Calendar className="w-3 h-3" style={{ color: TYPE_COLOR[type] }} />;
}
