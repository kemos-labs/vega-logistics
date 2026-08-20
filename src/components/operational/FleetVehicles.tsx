'use client';

import { useMemo, useState } from 'react';
import { Section, StatCard, Panel, PanelTitle, Bar } from '@/components/v2026/Shell';
import { VehicleClass, FuelType } from '@/lib/types';
import { Truck, Plus, ChevronDown, ChevronRight, Lightbulb, AlertTriangle, TrendingUp } from 'lucide-react';

interface FleetVehiclesProps {
  vehicleClasses: VehicleClass[];
  onChange: (updater: (prev: VehicleClass[]) => VehicleClass[]) => void;
  onAdd: () => void;
  totalVehicles: number;
  monthlyCost: number;
  activeDriverCount: number;
  fuelPricePerLiter: number;
}

const FUEL_OPTIONS: FuelType[] = ['petrol', 'diesel', 'electric', 'hybrid'];

export default function FleetVehicles({
  vehicleClasses,
  onChange,
  onAdd,
  totalVehicles,
  monthlyCost,
  activeDriverCount,
  fuelPricePerLiter,
}: FleetVehiclesProps) {
  const enabled = useMemo(() => vehicleClasses.filter((c) => c.enabled), [vehicleClasses]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalQuantity = enabled.reduce((s, c) => s + c.quantity, 0);
  const totalRent = enabled.reduce((s, c) => s + c.quantity * c.monthlyRent, 0);
  const totalVariable = enabled.reduce((s, c) => s + c.quantity * c.variableCost, 0);
  const totalDriverSalary = enabled.reduce((s, c) => s + c.quantity * (c.driverSalary || 0), 0);
  const totalAssetValue = enabled.reduce((s, c) => s + c.quantity * (c.purchasePrice || 0), 0);
  const totalDepreciation = enabled.reduce((s, c) => {
    if (c.purchasePrice && c.depreciationMonths) return s + c.quantity * (c.purchasePrice / c.depreciationMonths);
    return s;
  }, 0);

  return (
    <Section
      title="Fleet & Vehicles"
      subtitle={`${totalVehicles} vehicles · SAR ${monthlyCost.toLocaleString('en-US', { maximumFractionDigits: 0 })} / mo · ${activeDriverCount} active drivers`}
      actions={
        <button
          onClick={onAdd}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-colors"
        >
          <Plus className="w-3 h-3" /> Add Class
        </button>
      }
    >
      <div className="grid grid-cols-6 gap-3 mb-4">
        <StatCard label="Total Vehicles" value={totalVehicles} color="#3b82f6" sub="Across all classes" />
        <StatCard label="Monthly Rent" value={`SAR ${(totalRent / 1000).toFixed(1)}K`} color="#f97316" sub="Vehicle leases" />
        <StatCard label="Variable Cost" value={`SAR ${(totalVariable / 1000).toFixed(1)}K`} color="#eab308" sub="Insurance + GPS + misc" />
        <StatCard label="Driver Salary" value={`SAR ${(totalDriverSalary / 1000).toFixed(1)}K`} color="#a855f7" sub="Per-class driver pay" />
        <StatCard label="Asset Value" value={totalAssetValue > 0 ? `SAR ${(totalAssetValue / 1000).toFixed(0)}K` : '—'} color="#22c55e" sub={totalDepreciation > 0 ? `SAR ${Math.round(totalDepreciation)}/mo deprec` : 'All rented'} />
        <StatCard label="Active Drivers" value={activeDriverCount} color="#06b6d4" sub="Synced from Driver tab" />
      </div>

      <Panel className="p-0">
        <div className="p-3 border-b border-[#2a2a33] flex items-center justify-between">
          <PanelTitle>Vehicle Classes</PanelTitle>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[#52525b] font-mono-data">
              {enabled.length} / {vehicleClasses.length} enabled
            </span>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-1 px-3 py-2 text-[9px] uppercase tracking-wider text-[#52525b] border-b border-[#2a2a33] bg-[#0c0c0f]">
          <div className="col-span-1"></div>
          <div className="col-span-2">Class Name</div>
          <div className="col-span-1 text-right">Qty</div>
          <div className="col-span-1 text-right">Rent</div>
          <div className="col-span-1 text-right">Variable</div>
          <div className="col-span-1 text-right">Driver</div>
          <div className="col-span-1 text-right">Fuel</div>
          <div className="col-span-1 text-right">L/100</div>
          <div className="col-span-1 text-right">Km/d</div>
          <div className="col-span-1 text-right">Deprec</div>
          <div className="col-span-1 text-right">Total</div>
        </div>

        <div className="divide-y divide-[#1f1f26]">
          {vehicleClasses.length === 0 && (
            <div className="p-6 text-center text-[10px] text-[#52525b]">No vehicle classes yet. Click &ldquo;Add Class&rdquo; to create one.</div>
          )}
          {vehicleClasses.map((c) => {
            const classRent = c.quantity * c.monthlyRent;
            const classVar = c.quantity * c.variableCost;
            const classDriver = c.quantity * (c.driverSalary || 0);
            const classDeprec = c.purchasePrice > 0 && c.depreciationMonths > 0 ? Math.round(c.quantity * c.purchasePrice / c.depreciationMonths) : 0;
            const classTotal = classRent + classVar + classDriver + classDeprec;
            const qty = Math.max(0, c.quantity || 0);
            const expanded = expandedId === c.id;
            return (
              <div key={c.id}>
                <div className="grid grid-cols-12 gap-1 items-center px-3 py-1.5 hover:bg-[#131316] transition-colors">
                  <div className="col-span-1 flex items-center gap-1">
                    <button
                      onClick={() => setExpandedId(expanded ? null : c.id)}
                      className="text-[#52525b] hover:text-[#a1a1aa]"
                    >
                      {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                    <input
                      type="checkbox"
                      checked={c.enabled}
                      onChange={(e) => onChange((prev) => prev.map((x) => (x.id === c.id ? { ...x, enabled: e.target.checked } : x)))}
                      className="w-3 h-3 accent-[#3b82f6]"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      value={c.name}
                      onChange={(e) => onChange((prev) => prev.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))}
                      className={`w-full bg-transparent border-none text-[11px] text-[#e4e4e7] focus:outline-none focus:bg-[#0a0a0b] focus:px-1 focus:py-0.5 rounded ${c.enabled ? '' : 'opacity-50'}`}
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      type="number"
                      min={0}
                      value={qty}
                      onChange={(e) => onChange((prev) => prev.map((x) => (x.id === c.id ? { ...x, quantity: Math.max(0, parseInt(e.target.value) || 0) } : x)))}
                      className={`w-full bg-transparent text-right text-[10px] font-mono-data text-[#e4e4e7] focus:outline-none focus:bg-[#0a0a0b] focus:px-1 focus:py-0.5 rounded ${c.enabled ? '' : 'opacity-50'}`}
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      type="number"
                      min={0}
                      step={50}
                      value={c.monthlyRent}
                      onChange={(e) => onChange((prev) => prev.map((x) => (x.id === c.id ? { ...x, monthlyRent: Math.max(0, parseFloat(e.target.value) || 0) } : x)))}
                      className={`w-full bg-transparent text-right text-[10px] font-mono-data text-[#e4e4e7] focus:outline-none focus:bg-[#0a0a0b] focus:px-1 focus:py-0.5 rounded ${c.enabled ? '' : 'opacity-50'}`}
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      type="number"
                      min={0}
                      step={50}
                      value={c.variableCost}
                      onChange={(e) => onChange((prev) => prev.map((x) => (x.id === c.id ? { ...x, variableCost: Math.max(0, parseFloat(e.target.value) || 0) } : x)))}
                      className={`w-full bg-transparent text-right text-[10px] font-mono-data text-[#e4e4e7] focus:outline-none focus:bg-[#0a0a0b] focus:px-1 focus:py-0.5 rounded ${c.enabled ? '' : 'opacity-50'}`}
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={c.driverSalary || 0}
                      onChange={(e) => onChange((prev) => prev.map((x) => (x.id === c.id ? { ...x, driverSalary: Math.max(0, parseFloat(e.target.value) || 0) } : x)))}
                      className={`w-full bg-transparent text-right text-[10px] font-mono-data text-[#a855f7] focus:outline-none focus:bg-[#0a0a0b] focus:px-1 focus:py-0.5 rounded ${c.enabled ? '' : 'opacity-50'}`}
                    />
                  </div>
                  <div className="col-span-1">
                    <select
                      value={c.fuelType || 'diesel'}
                      onChange={(e) => onChange((prev) => prev.map((x) => (x.id === c.id ? { ...x, fuelType: e.target.value as FuelType } : x)))}
                      className={`w-full bg-transparent text-right text-[10px] font-mono-data text-[#e4e4e7] focus:outline-none focus:bg-[#0a0a0b] focus:px-1 focus:py-0.5 rounded ${c.enabled ? '' : 'opacity-50'}`}
                    >
                      {FUEL_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={c.fuelEfficiency || 10}
                      onChange={(e) => onChange((prev) => prev.map((x) => (x.id === c.id ? { ...x, fuelEfficiency: Math.max(0, parseFloat(e.target.value) || 0) } : x)))}
                      className={`w-full bg-transparent text-right text-[10px] font-mono-data text-[#06b6d4] focus:outline-none focus:bg-[#0a0a0b] focus:px-1 focus:py-0.5 rounded ${c.enabled ? '' : 'opacity-50'}`}
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={c.avgDailyDistance || 100}
                      onChange={(e) => onChange((prev) => prev.map((x) => (x.id === c.id ? { ...x, avgDailyDistance: Math.max(0, parseFloat(e.target.value) || 0) } : x)))}
                      className={`w-full bg-transparent text-right text-[10px] font-mono-data text-[#eab308] focus:outline-none focus:bg-[#0a0a0b] focus:px-1 focus:py-0.5 rounded ${c.enabled ? '' : 'opacity-50'}`}
                    />
                  </div>
                  <div className="col-span-1 text-right font-mono-data text-[10px] text-[#22c55e]">
                    {classDeprec > 0 ? classDeprec.toLocaleString() : '—'}
                  </div>
                  <div className="col-span-1 text-right font-mono-data text-[10px]" style={{ color: c.enabled ? '#22c55e' : '#52525b' }}>
                    {classTotal > 0 ? `SAR ${(classTotal / 1000).toFixed(0)}K` : '—'}
                  </div>
                </div>
                {expanded && (
                  <div className="px-3 py-2 bg-[#0c0c0f] border-t border-[#2a2a33] grid grid-cols-2 gap-3 text-[10px]">
                    <div className="space-y-1.5">
                      <div className="text-[9px] text-[#52525b] uppercase tracking-wider mb-1">Cost Breakdown</div>
                      <CostRow label="Rent" value={classRent} color="#f97316" />
                      <CostRow label="Variable (ins/GPS/misc)" value={classVar} color="#eab308" />
                      <CostRow label="Driver Salary" value={classDriver} color="#a855f7" />
                      {c.purchasePrice > 0 && c.depreciationMonths > 0 && <CostRow label="Depreciation" value={Math.round(c.quantity * c.purchasePrice / c.depreciationMonths)} color="#06b6d4" />}
                      <CostRow label="Per-Vehicle Total" value={c.monthlyRent + c.variableCost + (c.driverSalary || 0) + (c.purchasePrice > 0 && c.depreciationMonths > 0 ? c.purchasePrice / c.depreciationMonths : 0)} color="#3b82f6" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-[9px] text-[#52525b] uppercase tracking-wider mb-1">Fuel Details</div>
                      <div className="flex items-center justify-between"><span className="text-[#71717a]">Fuel Type</span><span className="font-mono-data text-[#e4e4e7] capitalize">{c.fuelType || 'diesel'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-[#71717a]">Efficiency</span><span className="font-mono-data text-[#06b6d4]">{c.fuelEfficiency || 10} L/100km</span></div>
                      <div className="flex items-center justify-between"><span className="text-[#71717a]">Daily Distance</span><span className="font-mono-data text-[#eab308]">{c.avgDailyDistance || 100} km</span></div>
                      <div className="flex items-center justify-between"><span className="text-[#71717a]">Est. Fuel Cost/mo</span>
                        <span className="font-mono-data text-[#f97316]">
                          SAR {Math.round(c.quantity * ((c.avgDailyDistance || 100) / 100) * (c.fuelEfficiency || 10) * fuelPricePerLiter * 26)}
                        </span>
                      </div>
                      <div className="border-t border-[#2a2a33] pt-1 mt-1">
                        <div className="text-[9px] text-[#52525b] uppercase tracking-wider mb-1">Asset (Purchase)</div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[#71717a]">Price</span>
                          <input
                            type="number"
                            min={0}
                            step={1000}
                            value={c.purchasePrice || 0}
                            onChange={(e) => onChange((prev) => prev.map((x) => (x.id === c.id ? { ...x, purchasePrice: Math.max(0, parseFloat(e.target.value) || 0) } : x)))}
                            className="flex-1 bg-[#0a0a0b] border border-[#2a2a33] rounded px-1.5 py-0.5 text-[10px] font-mono-data text-right text-[#22c55e] focus:outline-none focus:border-[#3b82f6]"
                          />
                          <span className="text-[#71717a]">Deprec</span>
                          <input
                            type="number"
                            min={0}
                            step={12}
                            value={c.depreciationMonths || 0}
                            onChange={(e) => onChange((prev) => prev.map((x) => (x.id === c.id ? { ...x, depreciationMonths: Math.max(0, parseInt(e.target.value) || 0) } : x)))}
                            className="w-14 bg-[#0a0a0b] border border-[#2a2a33] rounded px-1.5 py-0.5 text-[10px] font-mono-data text-right text-[#06b6d4] focus:outline-none focus:border-[#3b82f6]"
                          />
                          <span className="text-[#52525b]">mo</span>
                        </div>
                        {c.purchasePrice > 0 && (
                          <div className="text-[9px] text-[#71717a]">
                            Asset value: <span className="font-mono-data text-[#22c55e]">SAR {(c.purchasePrice * c.quantity).toLocaleString()}</span>
                            {c.depreciationMonths > 0 && (
                              <> · Deprec: <span className="font-mono-data text-[#06b6d4]">SAR {Math.round(c.quantity * c.purchasePrice / c.depreciationMonths)}/mo</span></>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-12 gap-1 px-3 py-2.5 border-t border-[#2a2a33] bg-[#0c0c0f]">
          <div className="col-span-3 text-[10px] text-[#71717a] uppercase tracking-wider flex items-center gap-1.5">
            <Truck className="w-3 h-3" /> Fleet Total
          </div>
          <div className="col-span-1 text-right font-mono-data text-xs font-bold text-[#3b82f6]">{totalQuantity}</div>
          <div className="col-span-1 text-right font-mono-data text-[10px] text-[#71717a]">{totalRent.toLocaleString()}</div>
          <div className="col-span-1 text-right font-mono-data text-[10px] text-[#71717a]">{totalVariable.toLocaleString()}</div>
          <div className="col-span-1 text-right font-mono-data text-[10px] text-[#a855f7]">{totalDriverSalary.toLocaleString()}</div>
          <div className="col-span-1 text-right font-mono-data text-[10px] text-[#22c55e]">{totalDepreciation > 0 ? Math.round(totalDepreciation).toLocaleString() : '—'}</div>
          <div className="col-span-3 text-right font-mono-data text-[11px] font-bold text-[#22c55e]">
            SAR {(totalRent + totalVariable + totalDriverSalary + totalDepreciation).toLocaleString()}
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-3 gap-3 mt-3">
        <Panel>
          <PanelTitle>Composition by Class</PanelTitle>
          <div className="space-y-2">
            {enabled.length === 0 && <div className="text-[10px] text-[#52525b]">No enabled classes</div>}
            {enabled.map((c) => {
              const pct = totalQuantity > 0 ? (c.quantity / totalQuantity) * 100 : 0;
              return (
                <div key={c.id}>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-[#e4e4e7]">{c.name}</span>
                    <span className="font-mono-data text-[#a1a1aa]">{c.quantity} · {pct.toFixed(0)}%</span>
                  </div>
                  <Bar value={pct} max={100} color="#3b82f6" height={6} />
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel>
          <PanelTitle>Cost Composition</PanelTitle>
          <div className="space-y-2">
            {enabled.map((c) => {
              const classDeprecCost = c.purchasePrice > 0 && c.depreciationMonths > 0 ? c.quantity * c.purchasePrice / c.depreciationMonths : 0;
              const total = c.quantity * (c.monthlyRent + c.variableCost + (c.driverSalary || 0)) + classDeprecCost;
              const grandTotal = totalRent + totalVariable + totalDriverSalary + totalDepreciation;
              const share = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
              return (
                <div key={c.id}>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-[#e4e4e7]">{c.name}</span>
                    <span className="font-mono-data text-[#f97316]">SAR {total.toLocaleString()}</span>
                  </div>
                  <Bar value={share} max={100} color="#f97316" height={6} />
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel>
          <PanelTitle>
            <div className="flex items-center gap-1.5">
              <Lightbulb className="w-3 h-3 text-[#eab308]" />
              Recommendations
            </div>
          </PanelTitle>
          <div className="space-y-2 text-[10px]">
            {(() => {
              const recs: { text: string; severity: 'info' | 'warning' | 'critical' }[] = [];

              const ownedCount = vehicleClasses.filter(c => c.purchasePrice > 0).reduce((s, c) => s + c.quantity, 0);
              const rentedCount = totalQuantity - ownedCount;
              if (ownedCount > 0 && rentedCount > 0) {
                recs.push({ text: `Mixed fleet: ${ownedCount} owned + ${rentedCount} rented. Evaluate total cost of ownership vs rental for long-term routes.`, severity: 'info' });
              }
              if (totalQuantity > 0) {
                const driverCostRatio = totalDriverSalary / (totalRent + totalVariable + totalDriverSalary) * 100;
                if (driverCostRatio > 40) recs.push({ text: `Driver salaries are ${driverCostRatio.toFixed(0)}% of fleet cost. Consider route optimization to reduce per-driver overhead.`, severity: 'warning' });
              }
              const fuelTypes = enabled.map(c => c.fuelType);
              const hasElectric = fuelTypes.includes('electric');
              const hasDiesel = fuelTypes.includes('diesel');
              if (!hasElectric && hasDiesel) {
                recs.push({ text: 'No electric vehicles. EV transition could reduce fuel cost by 40-60% on urban routes with high daily distance.', severity: 'info' });
              }
              if (hasElectric) {
                recs.push({ text: 'EV in fleet. Ensure charging infrastructure matches daily range requirements.', severity: 'info' });
              }
              const highConsumption = enabled.filter(c => (c.fuelEfficiency || 10) > 12);
              if (highConsumption.length > 0) {
                recs.push({ text: `${highConsumption.map(c => c.name).join(', ')} have high fuel consumption (>12L/100km). Consider replacement or aero mods.`, severity: 'warning' });
              }
              const lowUtilization = enabled.filter(c => (c.avgDailyDistance || 100) < 50);
              if (lowUtilization.length > 0) {
                recs.push({ text: `${lowUtilization.map(c => c.name).join(', ')} avg <50km/day. Consider reassigning or downsizing these vehicle classes.`, severity: 'warning' });
              }
              if (enabled.some(c => c.monthlyRent === 0 && c.purchasePrice === 0)) {
                recs.push({ text: 'Some classes have zero rent and zero purchase price. Set purchase price for owned assets or rent for leased vehicles.', severity: 'critical' });
              }

              if (recs.length === 0) recs.push({ text: 'Fleet looks balanced. No critical recommendations.', severity: 'info' });

              return recs.map((r, i) => (
                <div key={i} className={`flex items-start gap-1.5 p-1.5 rounded ${
                  r.severity === 'critical' ? 'bg-[#ef4444]/10 border border-[#ef4444]/30' :
                  r.severity === 'warning' ? 'bg-[#eab308]/10 border border-[#eab308]/30' :
                  'bg-[#3b82f6]/10 border border-[#3b82f6]/20'
                }`}>
                  {r.severity === 'critical' ? <AlertTriangle className="w-3 h-3 text-[#ef4444] mt-0.5 shrink-0" /> :
                   r.severity === 'warning' ? <TrendingUp className="w-3 h-3 text-[#eab308] mt-0.5 shrink-0" /> :
                   <Lightbulb className="w-3 h-3 text-[#3b82f6] mt-0.5 shrink-0" />}
                  <span className="text-[#d4d4d8] leading-relaxed">{r.text}</span>
                </div>
              ));
            })()}
          </div>
        </Panel>
      </div>
    </Section>
  );
}

function CostRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#71717a]">{label}</span>
      <span className="font-mono-data" style={{ color }}>SAR {value.toLocaleString()}</span>
    </div>
  );
}