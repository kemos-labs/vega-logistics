'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppState } from '@/lib/AppContext';
import { useSimulatedData } from '@/hooks/useSimulatedData';
import { calculateRentedFleet, runRentedMC, driverScore, type DriverData, type ZoneData, type RentedFleetOutput } from '@/lib/rentedFleetEngine';
import { calculateSaudiCosts, runSaudiMonteCarlo } from '@/lib/saudiLogisticsEngine';

import type { VehicleLocation, ZoneDensity } from '@/lib/types';
import HexCostGraph from '@/components/charts/HexCostGraph';
import FleetMap from '@/components/fleet/FleetMap';
import { Truck, Car, BarChart3, Target, AlertTriangle, DollarSign, TrendingUp, Users, MapPin, Activity, Settings2, Plus, X, Pencil } from 'lucide-react';
import type { CostItem } from '@/components/charts/HexCostGraph';

type Section = 'config' | 'overview' | 'costs' | 'drivers' | 'zones' | 'breakeven' | 'monte-carlo' | 'investor';

export default function FleetHub() {
  const { autoclaw, setAutoclaw, saudiFleet, setSaudiFleet } = useAppState();
  const { vehicles, zones: simZones } = useSimulatedData();

  const se = saudiFleet.enabled;
  const rentedCosts = useMemo(() => calculateRentedFleet(autoclaw.input), [autoclaw.input]);
  const saudiCosts = useMemo(() => calculateSaudiCosts(saudiFleet.input), [saudiFleet.input]);
  const totalFleet = autoclaw.input.fleetSize + (se ? saudiFleet.input.fleetSize : 0);
  const totalActive = rentedCosts.activeVans + (se ? saudiCosts.activeVans : 0);
  const totalCost = (rentedCosts?.totalCost ?? 0) + (se ? (saudiCosts?.totalMonthlyCost ?? 0) : 0);
  const totalDelCapacity = rentedCosts.delPerDay + (se ? saudiCosts.deliveriesPerDay : 0);
  const totalRevenue = rentedCosts.revenue + (se ? saudiCosts.monthlyRevenue : 0);
  const totalProfit = rentedCosts.profit + (se ? saudiCosts.monthlyProfit : 0);
  const marginPct = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const utilization = totalFleet > 0 ? (totalActive / totalFleet) * 100 : 0;

  // ── Section nav ──
  const [section, setSection] = useState<Section>('overview');
  const sections: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'config', label: 'Configuration', icon: <Settings2 className="w-3.5 h-3.5" /> },
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'costs', label: 'Cost Structure', icon: <DollarSign className="w-3.5 h-3.5" /> },
    { id: 'drivers', label: 'Drivers', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'zones', label: 'Zones & Map', icon: <MapPin className="w-3.5 h-3.5" /> },
    { id: 'breakeven', label: 'Break-Even', icon: <Target className="w-3.5 h-3.5" /> },
    { id: 'monte-carlo', label: 'Monte Carlo', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'investor', label: 'Investor View', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  ];

  // ── Editable hex items (synced with input data) ──
  const initialCostItems = useMemo((): CostItem[] => {
    const r = rentedCosts, s = saudiCosts, i = autoclaw.input, si = saudiFleet.input;
    const arr: CostItem[] = [
      { label: 'Van Rent', value: (i.vanRentPerMonth || 0) * (r.activeVans || 0), color: '#378ADD', perVan: i.vanRentPerMonth },
      { label: 'Fuel', value: (r.fuelPerVan || 0) * (r.activeVans || 0) + (se && s.fuelPerVanPerMonth ? s.fuelPerVanPerMonth * s.activeVans : 0), color: '#E85D3A' },
      { label: 'Drivers', value: (r.driverTotal || 0) * (r.activeVans || 0) + (se && s.driverTotalPerMonth ? s.driverTotalPerMonth * s.activeVans : 0), color: '#40A9F3' },
      { label: 'Maintenance', value: ((i.otherMaintPerMonth || 0) + (r.oilPerVan || 0) + (r.tiresPerVan || 0)) * (r.activeVans || 0) + (se ? ((si.otherMaintenancePerMonth || 0) + (s.oilPerVanPerMonth || 0) + (s.tiresPerVanPerMonth || 0)) * (s.activeVans || 0) : 0), color: '#9B6FE8' },
      { label: 'Warehouse', value: (i.warehouseRent || 0) + (se ? (si.warehouseRentPerMonth || 0) : 0), color: '#7F77DD' },
      { label: 'Admin', value: (i.adminSalaries || 0) + (i.software || 0) + (i.comms || 0) + (se ? (si.adminSalariesPerMonth || 0) + (si.softwarePerMonth || 0) + (si.communicationPerMonth || 0) : 0), color: '#f97316' },
      { label: 'Depreciation', value: se ? ((s.depreciationPerVanPerMonth || 0) * (s.activeVans || 0)) : 0, color: '#eab308', perVan: se ? s.depreciationPerVanPerMonth : 0 },
      { label: 'Utilities', value: (i.utilities || 0) + (se ? (si.utilitiesPerMonth || 0) : 0), color: '#06b6d4' },
    ];
    return arr.filter(it => it.value > 0);
  }, [rentedCosts, saudiCosts, autoclaw.input, saudiFleet.input, se]);

  const [hexItems, setHexItems] = useState<CostItem[]>(initialCostItems);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync local state from computed prop
  useEffect(() => { setHexItems(initialCostItems); }, [initialCostItems]);
  const hexTotal = useMemo(() => hexItems.reduce((s, it) => s + it.value, 0), [hexItems]);

  const [targets, setTargets] = useState({ fuelReduction: 0, utilTarget: 85, driverEfficiency: 0 });
  const targetDefs = [
    { label: 'Fuel reduction target', key: 'fuelReduction', value: targets.fuelReduction, max: 20, suffix: '%' },
    { label: 'Utilization target', key: 'utilTarget', value: targets.utilTarget, max: 100, suffix: '%' },
    { label: 'Driver efficiency boost', key: 'driverEfficiency', value: targets.driverEfficiency, max: 15, suffix: '%' },
  ];
  const onTargetChange = useCallback((key: string, value: number) => setTargets(p => ({ ...p, [key]: value })), []);

  const projectedSavings = useMemo(() => {
    const f = hexItems.find(i => i.label === 'Fuel');
    const d = hexItems.find(i => i.label === 'Drivers');
    return (f ? f.value * (targets.fuelReduction / 100) : 0) + (d ? d.value * (targets.driverEfficiency / 100) : 0);
  }, [hexItems, targets]);

  const recs = useMemo(() => {
    const r: { title: string; detail: string; priority: string }[] = [];
    if (utilization < targets.utilTarget) r.push({ title: 'Increase fleet utilization', priority: 'high', detail: `Combined utilization at ${utilization.toFixed(0)}% — target ${targets.utilTarget}%.` });
    if (autoclaw.input.deliveriesPerVanPerDay < 35) r.push({ title: 'Boost deliveries per van', priority: 'high', detail: `Nexus Fleet at ${autoclaw.input.deliveriesPerVanPerDay}/van/day — benchmark 35-50.` });
    const fuelPct = hexTotal > 0 ? ((hexItems.find(i => i.label === 'Fuel')?.value || 0) / hexTotal) * 100 : 0;
    if (fuelPct > 25) r.push({ title: 'Optimize fuel costs', priority: 'medium', detail: `Fuel is ${fuelPct.toFixed(1)}% of costs. Target ${targets.fuelReduction}% reduction saves SAR ${Math.round((hexItems.find(i => i.label === 'Fuel')?.value || 0) * targets.fuelReduction / 100).toLocaleString()}/mo.` });
    if (rentedCosts.monthlyContribPerVan < 3000) r.push({ title: 'Improve per-van contribution', priority: 'medium', detail: `Nexus Fleet contribution is SAR ${Math.round(rentedCosts.monthlyContribPerVan).toLocaleString()}/van. Target > SAR 3,000.` });
    return r;
  }, [utilization, targets, autoclaw.input.deliveriesPerVanPerDay, hexTotal, hexItems, rentedCosts.monthlyContribPerVan]);

  // ── Specialised sections ──


  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Section nav */}
      <div className="flex gap-0.5 border-b border-[#2a2a33] bg-[#0a0a0b] px-4 overflow-x-auto shrink-0">
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium whitespace-nowrap border-b-2 transition-all ${
              section === s.id ? 'text-[#e4e4e7] border-[#3b82f6]' : 'text-[#71717a] border-transparent hover:text-[#a1a1aa]'
            }`}>
            {s.icon}{s.label}
          </button>
        ))}
      </div>

      {/* ───────────────── CONFIGURATION ───────────────── */}
      {section === 'config' && (
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <h2 className="text-sm font-semibold text-[#e4e4e7] flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-[#a855f7]" /> Fleet Configuration — All Parameters
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {/* ─── Nexus Fleet Inputs ─── */}
            <div className="bg-[#18181c] border border-[#378ADD]/30 rounded-lg p-4">
              <h3 className="text-[10px] font-semibold text-[#378ADD] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Truck className="w-3 h-3" /> Nexus Fleet (Rented)
              </h3>
              <div className="space-y-2.5">
                <h4 className="text-[9px] text-[#71717a] uppercase tracking-wider border-b border-[#2a2a33] pb-1">Fleet & Operations</h4>
                <div className="grid grid-cols-2 gap-2">
                  <NexusInput label="Fleet Size" val={autoclaw.input.fleetSize} onChange={v => setAutoclaw({ input: { ...autoclaw.input, fleetSize: v } })} />
                  <NexusInput label="Utilization %" val={autoclaw.input.utilization} onChange={v => setAutoclaw({ input: { ...autoclaw.input, utilization: v } })} min={0} max={100} />
                  <NexusInput label="Working Days" val={autoclaw.input.workingDays} onChange={v => setAutoclaw({ input: { ...autoclaw.input, workingDays: v } })} min={19} max={30} />
                  <NexusInput label="KM / Day" val={autoclaw.input.kmPerDay} onChange={v => setAutoclaw({ input: { ...autoclaw.input, kmPerDay: v } })} />
                </div>
                <h4 className="text-[9px] text-[#71717a] uppercase tracking-wider border-b border-[#2a2a33] pb-1 mt-3">Cost Parameters</h4>
                <div className="grid grid-cols-2 gap-2">
                  <NexusInput label="Van Rent / Mo" val={autoclaw.input.vanRentPerMonth} onChange={v => setAutoclaw({ input: { ...autoclaw.input, vanRentPerMonth: v } })} />
                  <NexusInput label="Fuel Price (SAR/L)" val={autoclaw.input.fuelPriceLiter} onChange={v => setAutoclaw({ input: { ...autoclaw.input, fuelPriceLiter: v } })} step={0.01} />
                  <NexusInput label="Fuel Per 100KM (L)" val={autoclaw.input.fuelPer100km} onChange={v => setAutoclaw({ input: { ...autoclaw.input, fuelPer100km: v } })} />
                  <NexusInput label="Oil Per 5K KM (SAR)" val={autoclaw.input.oilPer5000km} onChange={v => setAutoclaw({ input: { ...autoclaw.input, oilPer5000km: v } })} />
                  <NexusInput label="Tires / Year (SAR)" val={autoclaw.input.tiresPerYear} onChange={v => setAutoclaw({ input: { ...autoclaw.input, tiresPerYear: v } })} />
                  <NexusInput label="Other Maintenance" val={autoclaw.input.otherMaintPerMonth} onChange={v => setAutoclaw({ input: { ...autoclaw.input, otherMaintPerMonth: v } })} />
                </div>
                <h4 className="text-[9px] text-[#71717a] uppercase tracking-wider border-b border-[#2a2a33] pb-1 mt-3">Driver Costs</h4>
                <div className="grid grid-cols-2 gap-2">
                  <NexusInput label="Driver Salary (SAR)" val={autoclaw.input.driverSalary} onChange={v => setAutoclaw({ input: { ...autoclaw.input, driverSalary: v } })} />
                  <NexusInput label="Driver Benefits %" val={autoclaw.input.driverBenefits} onChange={v => setAutoclaw({ input: { ...autoclaw.input, driverBenefits: v } })} />
                </div>
                <h4 className="text-[9px] text-[#71717a] uppercase tracking-wider border-b border-[#2a2a33] pb-1 mt-3">Overhead</h4>
                <div className="grid grid-cols-2 gap-2">
                  <NexusInput label="Warehouse Rent" val={autoclaw.input.warehouseRent} onChange={v => setAutoclaw({ input: { ...autoclaw.input, warehouseRent: v } })} />
                  <NexusInput label="Utilities" val={autoclaw.input.utilities} onChange={v => setAutoclaw({ input: { ...autoclaw.input, utilities: v } })} />
                  <NexusInput label="Admin Salaries" val={autoclaw.input.adminSalaries} onChange={v => setAutoclaw({ input: { ...autoclaw.input, adminSalaries: v } })} />
                  <NexusInput label="Software" val={autoclaw.input.software} onChange={v => setAutoclaw({ input: { ...autoclaw.input, software: v } })} />
                  <NexusInput label="Communications" val={autoclaw.input.comms} onChange={v => setAutoclaw({ input: { ...autoclaw.input, comms: v } })} />
                </div>
                <h4 className="text-[9px] text-[#71717a] uppercase tracking-wider border-b border-[#2a2a33] pb-1 mt-3">Revenue</h4>
                <div className="grid grid-cols-2 gap-2">
                  <NexusInput label="Deliveries / Van / Day" val={autoclaw.input.deliveriesPerVanPerDay} onChange={v => setAutoclaw({ input: { ...autoclaw.input, deliveriesPerVanPerDay: v } })} />
                  <NexusInput label="Revenue / Delivery" val={autoclaw.input.revenuePerDelivery} onChange={v => setAutoclaw({ input: { ...autoclaw.input, revenuePerDelivery: v } })} />
                </div>
              </div>
            </div>

            {/* ─── Saudi Fleet Inputs ─── */}
            <div className={`bg-[#18181c] border rounded-lg p-4 ${saudiFleet.enabled ? 'border-[#22c55e]/30' : 'border-[#52525b]/30 opacity-60'}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-semibold text-[#22c55e] uppercase tracking-wider flex items-center gap-1.5">
                  <Car className="w-3 h-3" /> Saudi Fleet (Owned)
                </h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-[9px] text-[#71717a]">{saudiFleet.enabled ? 'Enabled' : 'Disabled'}</span>
                  <div className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${saudiFleet.enabled ? 'bg-[#22c55e]' : 'bg-[#52525b]'}`}
                    onClick={() => setSaudiFleet({ enabled: !saudiFleet.enabled })}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${saudiFleet.enabled ? 'left-4' : 'left-0.5'}`} />
                  </div>
                </label>
              </div>
              <div className="space-y-2.5">
                <h4 className="text-[9px] text-[#71717a] uppercase tracking-wider border-b border-[#2a2a33] pb-1">Fleet & Operations</h4>
                <div className="grid grid-cols-2 gap-2">
                  <SaudiInput label="Fleet Size" val={saudiFleet.input.fleetSize} onChange={v => setSaudiFleet({ input: { ...saudiFleet.input, fleetSize: v } })} />
                  <SaudiInput label="Utilization %" val={saudiFleet.input.vanUtilization} onChange={v => setSaudiFleet({ input: { ...saudiFleet.input, vanUtilization: v } })} min={0} max={100} />
                  <SaudiInput label="KM / Van / Day" val={saudiFleet.input.kmPerVanPerDay} onChange={v => setSaudiFleet({ input: { ...saudiFleet.input, kmPerVanPerDay: v } })} />
                  <SaudiInput label="Purchase Price (SAR)" val={saudiFleet.input.vanPurchasePrice} onChange={v => setSaudiFleet({ input: { ...saudiFleet.input, vanPurchasePrice: v } })} />
                  <SaudiInput label="Van Lifespan (Years)" val={saudiFleet.input.vanLifespanYears} onChange={v => setSaudiFleet({ input: { ...saudiFleet.input, vanLifespanYears: v } })} min={1} max={20} />
                </div>
                <h4 className="text-[9px] text-[#71717a] uppercase tracking-wider border-b border-[#2a2a33] pb-1 mt-3">Cost Parameters</h4>
                <div className="grid grid-cols-2 gap-2">
                  <SaudiInput label="Fuel Price (SAR/L)" val={saudiFleet.input.fuelPriceLiter} onChange={v => setSaudiFleet({ input: { ...saudiFleet.input, fuelPriceLiter: v } })} step={0.01} />
                  <SaudiInput label="Fuel Cons. (L/100km)" val={saudiFleet.input.fuelConsumptionPer100km} onChange={v => setSaudiFleet({ input: { ...saudiFleet.input, fuelConsumptionPer100km: v } })} />
                  <SaudiInput label="Oil Change / 5K km" val={saudiFleet.input.oilChangeCostPer5000km} onChange={v => setSaudiFleet({ input: { ...saudiFleet.input, oilChangeCostPer5000km: v } })} />
                  <SaudiInput label="Tires / Year (SAR)" val={saudiFleet.input.tiresPerYear} onChange={v => setSaudiFleet({ input: { ...saudiFleet.input, tiresPerYear: v } })} />
                  <SaudiInput label="Other Maintenance" val={saudiFleet.input.otherMaintenancePerMonth} onChange={v => setSaudiFleet({ input: { ...saudiFleet.input, otherMaintenancePerMonth: v } })} />
                </div>
                <h4 className="text-[9px] text-[#71717a] uppercase tracking-wider border-b border-[#2a2a33] pb-1 mt-3">Driver Costs</h4>
                <div className="grid grid-cols-2 gap-2">
                  <SaudiInput label="Driver Salary / Mo" val={saudiFleet.input.driverSalaryPerMonth} onChange={v => setSaudiFleet({ input: { ...saudiFleet.input, driverSalaryPerMonth: v } })} />
                  <SaudiInput label="Benefits %" val={saudiFleet.input.driverBenefitsPercent} onChange={v => setSaudiFleet({ input: { ...saudiFleet.input, driverBenefitsPercent: v } })} />
                </div>
                <h4 className="text-[9px] text-[#71717a] uppercase tracking-wider border-b border-[#2a2a33] pb-1 mt-3">Overhead</h4>
                <div className="grid grid-cols-2 gap-2">
                  <SaudiInput label="Warehouse Rent" val={saudiFleet.input.warehouseRentPerMonth} onChange={v => setSaudiFleet({ input: { ...saudiFleet.input, warehouseRentPerMonth: v } })} />
                  <SaudiInput label="Utilities" val={saudiFleet.input.utilitiesPerMonth} onChange={v => setSaudiFleet({ input: { ...saudiFleet.input, utilitiesPerMonth: v } })} />
                  <SaudiInput label="Admin Salaries" val={saudiFleet.input.adminSalariesPerMonth} onChange={v => setSaudiFleet({ input: { ...saudiFleet.input, adminSalariesPerMonth: v } })} />
                  <SaudiInput label="Software" val={saudiFleet.input.softwarePerMonth} onChange={v => setSaudiFleet({ input: { ...saudiFleet.input, softwarePerMonth: v } })} />
                  <SaudiInput label="Communication" val={saudiFleet.input.communicationPerMonth} onChange={v => setSaudiFleet({ input: { ...saudiFleet.input, communicationPerMonth: v } })} />
                </div>
                <h4 className="text-[9px] text-[#71717a] uppercase tracking-wider border-b border-[#2a2a33] pb-1 mt-3">Revenue</h4>
                <div className="grid grid-cols-2 gap-2">
                  <SaudiInput label="Deliveries / Van / Day" val={saudiFleet.input.deliveriesPerVanPerDay} onChange={v => setSaudiFleet({ input: { ...saudiFleet.input, deliveriesPerVanPerDay: v } })} />
                  <SaudiInput label="Revenue / Delivery" val={saudiFleet.input.revenuePerDelivery} onChange={v => setSaudiFleet({ input: { ...saudiFleet.input, revenuePerDelivery: v } })} />
                  <SaudiInput label="Break-Even Benchmark" val={saudiFleet.input.breakEvenBenchmark} onChange={v => setSaudiFleet({ input: { ...saudiFleet.input, breakEvenBenchmark: v } })} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────── OVERVIEW ───────────────── */}
      {section === 'overview' && (
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Row 1: 4 big visual KPI infocards */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { l: 'Revenue', v: `SAR ${Math.round(totalRevenue).toLocaleString()}`, c: '#3b82f6', icon: '📈', sub: `${totalActive} active vans`, pct: 100 },
              { l: 'Total Cost', v: `SAR ${Math.round(totalCost).toLocaleString()}`, c: '#f97316', icon: '💰', sub: `SAR ${totalActive > 0 ? Math.round(totalCost/totalActive).toLocaleString() : 0}/van`, pct: totalRevenue > 0 ? (totalCost/totalRevenue)*100 : 0 },
              { l: 'Net Profit', v: `SAR ${Math.round(Math.abs(totalProfit)).toLocaleString()}`, c: totalProfit >= 0 ? '#22c55e' : '#ef4444', icon: totalProfit >= 0 ? '📊' : '⚠️', sub: `${marginPct.toFixed(1)}% margin · ${totalProfit >= 0 ? 'Profitable' : 'Loss'}`, pct: totalRevenue > 0 ? (Math.abs(totalProfit)/totalRevenue)*100 : 0 },
              { l: 'Delivery Capacity', v: `${totalDelCapacity.toLocaleString()}`, c: '#a855f7', icon: '🚚', sub: `${totalDelCapacity > 0 ? Math.round(totalRevenue/totalDelCapacity) : 0} SAR/delivery`, pct: Math.min(100, (totalDelCapacity / Math.max(1, totalFleet * 40)) * 100) },
            ].map((k, i) => (
              <div key={i} className="bg-gradient-to-br from-[#18181c] to-[#1c1c24] border border-[#2a2a33] rounded-lg p-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 opacity-5 text-3xl">{k.icon}</div>
                <div className="text-[9px] text-[#52525b] uppercase tracking-wider mb-1">{k.l}</div>
                <div className="font-mono-data text-xl font-bold" style={{ color: k.c }}>{k.v}</div>
                <div className="text-[9px] text-[#71717a] mt-0.5">{k.sub}</div>
                <div className="mt-2 h-1 bg-[#0a0a0b] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, k.pct)}%`, backgroundColor: k.c, opacity: 0.6 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Row 2: Revenue → Cost → Profit waterfall infographic + Donut */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4 col-span-1">
              <h3 className="text-[9px] text-[#71717a] uppercase tracking-wider mb-3">Revenue Flow</h3>
              <div className="space-y-3">
                <div className="bg-[#0a0a0b] rounded-lg p-3 border-l-4 border-[#3b82f6]">
                  <div className="text-[8px] text-[#52525b] uppercase">Revenue In</div>
                  <div className="font-mono-data text-base font-bold text-[#3b82f6]">SAR {Math.round(totalRevenue).toLocaleString()}</div>
                </div>
                <div className="flex flex-col items-center text-[#52525b]">↓</div>
                <div className="bg-[#0a0a0b] rounded-lg p-3 border-l-4 border-[#f97316]">
                  <div className="text-[8px] text-[#52525b] uppercase">Operating Costs</div>
                  <div className="font-mono-data text-base font-bold text-[#f97316]">- SAR {Math.round(totalCost).toLocaleString()}</div>
                </div>
                <div className="flex flex-col items-center text-[#52525b]">↓</div>
                <div className={`bg-[#0a0a0b] rounded-lg p-3 border-l-4 ${totalProfit >= 0 ? 'border-[#22c55e]' : 'border-[#ef4444]'}`}>
                  <div className="text-[8px] text-[#52525b] uppercase">Net Result</div>
                  <div className={`font-mono-data text-base font-bold ${totalProfit >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{totalProfit >= 0 ? '' : '-'}SAR {Math.round(Math.abs(totalProfit)).toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* Donut infographic */}
            <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4 col-span-1">
              <h3 className="text-[9px] text-[#71717a] uppercase tracking-wider mb-3">Where Costs Go</h3>
              <div className="flex flex-col items-center">
                <svg width="130" height="130" viewBox="0 0 130 130">
                  {(() => {
                    const segs = [
                      { l: 'Van Rent', v: autoclaw.input.vanRentPerMonth * rentedCosts.activeVans, c: '#378ADD' },
                      { l: 'Fuel', v: rentedCosts.fuelPerVan * rentedCosts.activeVans + (se ? saudiCosts.fuelPerVanPerMonth * saudiCosts.activeVans : 0), c: '#E85D3A' },
                      { l: 'Drivers', v: rentedCosts.driverTotal * rentedCosts.activeVans + (se ? saudiCosts.driverTotalPerMonth * saudiCosts.activeVans : 0), c: '#40A9F3' },
                      { l: 'Maint.', v: (autoclaw.input.otherMaintPerMonth + rentedCosts.oilPerVan + rentedCosts.tiresPerVan) * rentedCosts.activeVans + (se ? (saudiFleet.input.otherMaintenancePerMonth + saudiCosts.oilPerVanPerMonth + saudiCosts.tiresPerVanPerMonth) * saudiCosts.activeVans : 0), c: '#9B6FE8' },
                      { l: 'Overhead', v: autoclaw.input.warehouseRent + autoclaw.input.adminSalaries + autoclaw.input.software + autoclaw.input.comms + autoclaw.input.utilities + (se ? saudiFleet.input.warehouseRentPerMonth + saudiFleet.input.adminSalariesPerMonth + saudiFleet.input.softwarePerMonth + saudiFleet.input.communicationPerMonth + saudiFleet.input.utilitiesPerMonth : 0), c: '#7F77DD' },
                      { l: 'Deprec.', v: se ? saudiCosts.depreciationPerVanPerMonth * saudiCosts.activeVans : 0, c: '#eab308' },
                    ].filter(it => it.v > 0);
                    const t = segs.reduce((s, it) => s + it.v, 0) || 1;
                    let cum = 0;
                    const cx = 65, cy = 65, r = 48;
                    return segs.map((it, i) => {
                      const pct = it.v / t;
                      const a1 = cum * 360; cum += pct; const a2 = cum * 360;
                      const sR = (a1 - 90) * Math.PI / 180;
                      const eR = (a2 - 90) * Math.PI / 180;
                      const x1 = cx + r * Math.cos(sR);
                      const y1 = cy + r * Math.sin(sR);
                      const x2 = cx + r * Math.cos(eR);
                      const y2 = cy + r * Math.sin(eR);
                      const la = pct > 0.5 ? 1 : 0;
                      const d = pct >= 1 ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}` : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${la} 1 ${x2} ${y2} Z`;
                      return <path key={i} d={d} fill={it.c} opacity="0.85" stroke="#18181c" strokeWidth="1" />;
                    });
                  })()}
                  <circle cx="65" cy="65" r="24" fill="#18181c" />
                  <text x="65" y="62" textAnchor="middle" fill="#e4e4e7" fontSize="11" fontWeight="bold" fontFamily="monospace">SAR</text>
                  <text x="65" y="75" textAnchor="middle" fill="#a1a1aa" fontSize="7" fontFamily="monospace">{Math.round(totalCost / 1000)}K</text>
                </svg>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1">
                {[
                  { l: 'Rent', c: '#378ADD' }, { l: 'Fuel', c: '#E85D3A' }, { l: 'Drivers', c: '#40A9F3' },
                  { l: 'Maint', c: '#9B6FE8' }, { l: 'Overhead', c: '#7F77DD' }, { l: 'Depr', c: '#eab308' },
                ].map((it, i) => (
                  <div key={i} className="flex items-center gap-1 text-[7px]">
                    <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: it.c }} />
                    <span className="text-[#71717a]">{it.l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fleet health gauge */}
            <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4 col-span-1">
              <h3 className="text-[9px] text-[#71717a] uppercase tracking-wider mb-3">Fleet Health</h3>
              <div className="flex flex-col items-center">
                <svg width="120" height="80" viewBox="0 0 120 80">
                  <path d="M 10 70 A 50 50 0 0 1 110 70" fill="none" stroke="#2a2a33" strokeWidth="8" strokeLinecap="round" />
                  <path d="M 10 70 A 50 50 0 0 1 110 70" fill="none" stroke={utilization >= 75 ? '#22c55e' : utilization >= 50 ? '#eab308' : '#ef4444'} strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${(utilization / 100) * 157} 157`} />
                  <text x="60" y="40" textAnchor="middle" fill="#e4e4e7" fontSize="18" fontWeight="bold" fontFamily="monospace">{utilization.toFixed(0)}%</text>
                  <text x="60" y="52" textAnchor="middle" fill="#71717a" fontSize="6">Utilization</text>
                </svg>
              </div>
              <div className="mt-2 space-y-1 text-[9px]">
                <div className="flex justify-between"><span className="text-[#71717a]">Active</span><span className="font-mono-data text-[#22c55e]">{totalActive}</span></div>
                <div className="flex justify-between"><span className="text-[#71717a]">Idle</span><span className="font-mono-data text-[#ef4444]">{totalFleet - totalActive}</span></div>
                <div className="flex justify-between"><span className="text-[#71717a]">Cost/Van</span><span className="font-mono-data text-[#a1a1aa]">SAR {totalActive > 0 ? Math.round(totalCost / totalActive).toLocaleString() : 0}</span></div>
                <div className="flex justify-between"><span className="text-[#71717a]">Rev/Del</span><span className="font-mono-data text-[#a1a1aa]">SAR {totalDelCapacity > 0 ? Math.round(totalRevenue / totalDelCapacity) : 0}</span></div>
              </div>
            </div>
          </div>

          {/* Row 3: Big horizontal cost breakdown bar */}
          <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
            <h3 className="text-[9px] text-[#71717a] uppercase tracking-wider mb-3">Cost Breakdown — Combined Fleet</h3>
            <div className="h-8 bg-[#0a0a0b] rounded-lg overflow-hidden flex">
              {(() => {
                const segs = [
                  { l: 'Van Rent', v: autoclaw.input.vanRentPerMonth * rentedCosts.activeVans, c: '#378ADD' },
                  { l: 'Fuel', v: rentedCosts.fuelPerVan * rentedCosts.activeVans + (se ? saudiCosts.fuelPerVanPerMonth * saudiCosts.activeVans : 0), c: '#E85D3A' },
                  { l: 'Drivers', v: rentedCosts.driverTotal * rentedCosts.activeVans + (se ? saudiCosts.driverTotalPerMonth * saudiCosts.activeVans : 0), c: '#40A9F3' },
                  { l: 'Maint', v: (autoclaw.input.otherMaintPerMonth + rentedCosts.oilPerVan + rentedCosts.tiresPerVan) * rentedCosts.activeVans + (se ? (saudiFleet.input.otherMaintenancePerMonth + saudiCosts.oilPerVanPerMonth + saudiCosts.tiresPerVanPerMonth) * saudiCosts.activeVans : 0), c: '#9B6FE8' },
                  { l: 'Overhead', v: autoclaw.input.warehouseRent + autoclaw.input.adminSalaries + autoclaw.input.software + autoclaw.input.comms + autoclaw.input.utilities + (se ? saudiFleet.input.warehouseRentPerMonth + saudiFleet.input.adminSalariesPerMonth + saudiFleet.input.softwarePerMonth + saudiFleet.input.communicationPerMonth + saudiFleet.input.utilitiesPerMonth : 0), c: '#7F77DD' },
                  { l: 'Deprec', v: se ? saudiCosts.depreciationPerVanPerMonth * saudiCosts.activeVans : 0, c: '#eab308' },
                ].filter(s => s.v > 0);
                const t = segs.reduce((s, it) => s + it.v, 0) || 1;
                return segs.map((s, i) => (
                  <div key={i} className="h-full flex items-center justify-center text-[8px] font-medium text-white/80 first:rounded-l-lg last:rounded-r-lg relative group"
                    style={{ width: `${(s.v / t) * 100}%`, backgroundColor: s.c, minWidth: s.v / t > 0.05 ? 'fit-content' : undefined }}>
                    <span className="truncate px-1">{s.l} {s.v / t > 0.05 ? `${(s.v / t * 100).toFixed(0)}%` : ''}</span>
                  </div>
                ));
              })()}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[8px]">
              {[
                { l: 'Van Rent', v: autoclaw.input.vanRentPerMonth * rentedCosts.activeVans, c: '#378ADD' },
                { l: 'Fuel', v: rentedCosts.fuelPerVan * rentedCosts.activeVans + (se ? saudiCosts.fuelPerVanPerMonth * saudiCosts.activeVans : 0), c: '#E85D3A' },
                { l: 'Drivers', v: rentedCosts.driverTotal * rentedCosts.activeVans + (se ? saudiCosts.driverTotalPerMonth * saudiCosts.activeVans : 0), c: '#40A9F3' },
                { l: 'Maint', v: (autoclaw.input.otherMaintPerMonth + rentedCosts.oilPerVan + rentedCosts.tiresPerVan) * rentedCosts.activeVans + (se ? (saudiFleet.input.otherMaintenancePerMonth + saudiCosts.oilPerVanPerMonth + saudiCosts.tiresPerVanPerMonth) * saudiCosts.activeVans : 0), c: '#9B6FE8' },
                { l: 'Overhead', v: autoclaw.input.warehouseRent + autoclaw.input.adminSalaries + autoclaw.input.software + autoclaw.input.comms + autoclaw.input.utilities + (se ? saudiFleet.input.warehouseRentPerMonth + saudiFleet.input.adminSalariesPerMonth + saudiFleet.input.softwarePerMonth + saudiFleet.input.communicationPerMonth + saudiFleet.input.utilitiesPerMonth : 0), c: '#7F77DD' },
                { l: 'Deprec', v: se ? saudiCosts.depreciationPerVanPerMonth * saudiCosts.activeVans : 0, c: '#eab308' },
              ].filter(s => s.v > 0).map((s, i) => (
                <span key={i} className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: s.c }} /><span className="text-[#a1a1aa]">{s.l}:</span><span className="font-mono-data text-[#e4e4e7]">SAR {Math.round(s.v).toLocaleString()}</span></span>
              ))}
            </div>
          </div>

          {/* Hex Cost Graph */}
          {hexItems.length > 0 && (
            <HexCostGraph items={hexItems} total={hexTotal} title="Cost Distribution — All Fleets"
              editable onItemsChange={setHexItems} totalVans={totalActive}
              targets={targetDefs} onTargetChange={onTargetChange} />
          )}

          {/* Break-even line on cost distribution */}
          {totalDelCapacity > 0 && (
            <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[9px] text-[#71717a] uppercase tracking-wider">Break-Even on Cost Distribution</h3>
                <span className="text-[8px] text-[#52525b]">BE: {Math.round(rentedCosts.breakEvenDel + (se ? saudiCosts.breakEvenDeliveriesPerDay : 0))} del/day combined</span>
              </div>
              <div className="flex items-end gap-0.5 h-16">
                {Array.from({ length: 24 }, (_, i) => {
                  const del = Math.round((totalDelCapacity * 0.3) + i * (totalDelCapacity * 0.7 / 23));
                  const BE = Math.round(rentedCosts.breakEvenDel + (se ? saudiCosts.breakEvenDeliveriesPerDay : 0));
                  const costPerDel = totalCost / Math.max(1, totalDelCapacity);
                  const revPerDel = totalRevenue / Math.max(1, totalDelCapacity);
                  const cost = del * costPerDel;
                  const rev = del * revPerDel;
                  const hCost = Math.min(100, (cost / Math.max(1, rev * 1.5)) * 100);
                  const hRev = Math.min(100, (rev / Math.max(1, rev * 1.5)) * 100);
                  const isBE = Math.abs(del - BE) < totalDelCapacity * 0.05;
                  return (
                    <div key={i} className="flex-1 flex flex-col justify-end relative group" title={`${del} del · Cost SAR ${Math.round(cost)} · Rev SAR ${Math.round(rev)}`}>
                      <div className="w-full bg-[#f97316]/40 rounded-t" style={{ height: `${hCost}%` }} />
                      <div className={`w-full bg-[#3b82f6]/40 rounded-t absolute bottom-0 ${isBE ? 'ring-1 ring-[#eab308]' : ''}`} style={{ height: `${hRev}%` }} />
                      {i % 4 === 0 && <span className="text-[5px] text-[#52525b] text-center mt-px">{del}</span>}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-3 mt-1 text-[8px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#3b82f6]/40 rounded" /> Revenue</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#f97316]/40 rounded" /> Cost</span>
                <span className="text-[#eab308]">★ Break-Even</span>
              </div>
            </div>
          )}

          {projectedSavings > 0 && (
            <div className="bg-gradient-to-r from-[#a855f7]/20 to-[#3b82f6]/20 border border-[#a855f7]/30 rounded-lg p-3 flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-[#a855f7]" />
              <div>
                <span className="text-xs font-semibold text-[#e4e4e7]">Projected Monthly Savings: SAR {Math.round(projectedSavings).toLocaleString()}</span>
                <p className="text-[10px] text-[#a1a1aa]">Based on current optimization targets. Adjust targets above to model scenarios.</p>
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
            <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-[#a855f7]" /> Fleet Optimization Recommendations
            </h3>
            {recs.length === 0 ? <p className="text-xs text-[#71717a]">Fleet operating efficiently.</p> : (
              <div className="space-y-2">
                {recs.map((r, i) => (
                  <div key={i} className="bg-[#0a0a0b] border border-[#2a2a33] rounded p-3 flex items-start gap-3">
                    <div className={`mt-0.5 ${r.priority === 'high' ? 'text-[#ef4444]' : 'text-[#f97316]'}`}><AlertTriangle className="w-4 h-4" /></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-[#e4e4e7]">{r.title}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${r.priority === 'high' ? 'bg-[#ef4444]/20 text-[#ef4444]' : 'bg-[#f97316]/20 text-[#f97316]'}`}>{r.priority.toUpperCase()}</span>
                      </div>
                      <p className="text-[11px] text-[#a1a1aa]">{r.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────── COST STRUCTURE ───────────────── */}
      {section === 'costs' && (
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <h2 className="text-sm font-semibold text-[#e4e4e7] flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#3b82f6]" /> Unified Cost Structure
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {/* Nexus Costs */}
            <div className="bg-[#18181c] border border-[#378ADD]/30 rounded-lg p-4">
              <h3 className="text-[10px] font-semibold text-[#378ADD] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Truck className="w-3 h-3" /> Nexus Fleet (Rented)
              </h3>
              <div className="space-y-1.5 text-[10px]">
                {[
                  { l: 'Active Vans', v: rentedCosts.activeVans, c: '#e4e4e7' },
                  { l: 'Van Rent / Van', v: `SAR ${Math.round(autoclaw.input.vanRentPerMonth).toLocaleString()}`, c: '#378ADD' },
                  { l: 'Fuel / Van', v: `SAR ${Math.round(rentedCosts.fuelPerVan).toLocaleString()}`, c: '#E85D3A' },
                  { l: 'Oil / Van', v: `SAR ${Math.round(rentedCosts.oilPerVan).toLocaleString()}`, c: '#9B6FE8' },
                  { l: 'Tires / Van', v: `SAR ${Math.round(rentedCosts.tiresPerVan).toLocaleString()}`, c: '#eab308' },
                  { l: 'Driver / Van', v: `SAR ${Math.round(rentedCosts.driverTotal).toLocaleString()}`, c: '#40A9F3' },
                  { l: 'Total Variable', v: `SAR ${Math.round(rentedCosts.totalVar).toLocaleString()}`, c: '#f97316' },
                  { l: 'Total Fixed', v: `SAR ${Math.round(rentedCosts.totalFixed).toLocaleString()}`, c: '#7F77DD' },
                  { l: 'Warehouse', v: `SAR ${Math.round(autoclaw.input.warehouseRent).toLocaleString()}`, c: '#7F77DD' },
                  { l: 'Admin+Software', v: `SAR ${Math.round(autoclaw.input.adminSalaries + autoclaw.input.software + autoclaw.input.comms).toLocaleString()}`, c: '#f97316' },
                  { l: 'Total Cost', v: `SAR ${Math.round(rentedCosts.totalCost).toLocaleString()}`, c: '#e4e4e7', b: true },
                  { l: 'Revenue', v: `SAR ${Math.round(rentedCosts.revenue).toLocaleString()}`, c: '#3b82f6' },
                  { l: 'Profit', v: `SAR ${Math.round(rentedCosts.profit).toLocaleString()}`, c: rentedCosts.profit >= 0 ? '#22c55e' : '#ef4444' },
                  { l: 'Margin', v: `${rentedCosts.margin.toFixed(1)}%`, c: rentedCosts.margin >= 20 ? '#22c55e' : rentedCosts.margin >= 10 ? '#eab308' : '#ef4444' },
                ].map((r, i) => (
                  <div key={i} className={`flex justify-between ${r.b ? 'border-t border-[#2a2a33] pt-1 mt-1 font-semibold' : 'border-b border-[#1c1c21] pb-1'}`}>
                    <span className="text-[#a1a1aa]">{r.l}</span>
                    <span className="font-mono-data" style={{ color: r.c }}>{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Saudi Costs */}
            <div className="bg-[#18181c] border border-[#22c55e]/30 rounded-lg p-4">
              <h3 className="text-[10px] font-semibold text-[#22c55e] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Car className="w-3 h-3" /> Saudi Fleet (Owned)
              </h3>
              <div className="space-y-1.5 text-[10px]">
                {[
                  { l: 'Active Vans', v: saudiCosts.activeVans, c: '#e4e4e7' },
                  { l: 'Fuel / Van / Mo', v: `SAR ${Math.round(saudiCosts.fuelPerVanPerMonth).toLocaleString()}`, c: '#E85D3A' },
                  { l: 'Oil / Van / Mo', v: `SAR ${Math.round(saudiCosts.oilPerVanPerMonth).toLocaleString()}`, c: '#9B6FE8' },
                  { l: 'Tires / Van / Mo', v: `SAR ${Math.round(saudiCosts.tiresPerVanPerMonth).toLocaleString()}`, c: '#eab308' },
                  { l: 'Depreciation / Van', v: `SAR ${Math.round(saudiCosts.depreciationPerVanPerMonth).toLocaleString()}`, c: '#eab308' },
                  { l: 'Driver / Van / Mo', v: `SAR ${Math.round(saudiCosts.driverTotalPerMonth).toLocaleString()}`, c: '#40A9F3' },
                  { l: 'Total Variable', v: `SAR ${Math.round(saudiCosts.totalVariableCost).toLocaleString()}`, c: '#f97316' },
                  { l: 'Total Fixed', v: `SAR ${Math.round(saudiCosts.totalFixedCost).toLocaleString()}`, c: '#7F77DD' },
                  { l: 'Warehouse', v: `SAR ${Math.round(saudiFleet.input.warehouseRentPerMonth).toLocaleString()}`, c: '#7F77DD' },
                  { l: 'Admin+Software', v: `SAR ${Math.round(saudiFleet.input.adminSalariesPerMonth + saudiFleet.input.softwarePerMonth + saudiFleet.input.communicationPerMonth).toLocaleString()}`, c: '#f97316' },
                  { l: 'Total Cost', v: `SAR ${Math.round(saudiCosts.totalMonthlyCost).toLocaleString()}`, c: '#e4e4e7', b: true },
                  { l: 'Revenue', v: `SAR ${Math.round(saudiCosts.monthlyRevenue).toLocaleString()}`, c: '#3b82f6' },
                  { l: 'Profit', v: `SAR ${Math.round(saudiCosts.monthlyProfit).toLocaleString()}`, c: saudiCosts.monthlyProfit >= 0 ? '#22c55e' : '#ef4444' },
                  { l: 'Margin', v: `${saudiCosts.marginPercent.toFixed(1)}%`, c: saudiCosts.marginPercent >= 20 ? '#22c55e' : saudiCosts.marginPercent >= 10 ? '#eab308' : '#ef4444' },
                ].map((r, i) => (
                  <div key={i} className={`flex justify-between ${r.b ? 'border-t border-[#2a2a33] pt-1 mt-1 font-semibold' : 'border-b border-[#1c1c21] pb-1'}`}>
                    <span className="text-[#a1a1aa]">{r.l}</span>
                    <span className="font-mono-data" style={{ color: r.c }}>{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Combined cost table */}
          <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
            <h3 className="text-[10px] text-[#71717a] uppercase tracking-wider mb-3">Combined Cost Breakdown</h3>
            <div className="space-y-1 text-[10px]">
              {[
                { l: 'Van Rent', v: autoclaw.input.vanRentPerMonth * rentedCosts.activeVans, c: '#378ADD' },
                { l: 'Fuel', v: rentedCosts.fuelPerVan * rentedCosts.activeVans + saudiCosts.fuelPerVanPerMonth * saudiCosts.activeVans, c: '#E85D3A' },
                { l: 'Drivers', v: rentedCosts.driverTotal * rentedCosts.activeVans + saudiCosts.driverTotalPerMonth * saudiCosts.activeVans, c: '#40A9F3' },
                { l: 'Maintenance', v: (autoclaw.input.otherMaintPerMonth + rentedCosts.oilPerVan + rentedCosts.tiresPerVan) * rentedCosts.activeVans + (saudiFleet.input.otherMaintenancePerMonth + saudiCosts.oilPerVanPerMonth + saudiCosts.tiresPerVanPerMonth) * saudiCosts.activeVans, c: '#9B6FE8' },
                { l: 'Warehouse', v: autoclaw.input.warehouseRent + saudiFleet.input.warehouseRentPerMonth, c: '#7F77DD' },
                { l: 'Depreciation', v: saudiCosts.depreciationPerVanPerMonth * saudiCosts.activeVans, c: '#eab308' },
                { l: 'Admin & Software', v: autoclaw.input.adminSalaries + autoclaw.input.software + autoclaw.input.comms + saudiFleet.input.adminSalariesPerMonth + saudiFleet.input.softwarePerMonth + saudiFleet.input.communicationPerMonth, c: '#f97316' },
                { l: 'Utilities', v: autoclaw.input.utilities + saudiFleet.input.utilitiesPerMonth, c: '#06b6d4' },
              ].filter(it => it.v > 0).map((it, i) => (
                <div key={i} className="flex justify-between border-b border-[#1c1c21] py-1">
                  <span className="flex items-center gap-1.5 text-[#a1a1aa]">
                    <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: it.c }} />
                    {it.l}
                  </span>
                  <span className="font-mono-data text-[#e4e4e7]">SAR {Math.round(it.v).toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between py-1 font-semibold border-t border-[#2a2a33] mt-1 pt-1">
                <span className="text-[#e4e4e7]">Total Monthly Cost</span>
                <span className="font-mono-data text-[#e4e4e7]">SAR {Math.round(totalCost).toLocaleString()}</span>
              </div>
            </div>
          </div>
          {/* Donut chart — cost distribution */}
          <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
            <h3 className="text-[10px] text-[#71717a] uppercase tracking-wider mb-3">Cost Distribution — Combined Fleet</h3>
            <div className="flex items-center gap-6">
              <svg width="140" height="140" viewBox="0 0 140 140">
                {(() => {
                  const items = [
                    { l: 'Van Rent', v: autoclaw.input.vanRentPerMonth * rentedCosts.activeVans, c: '#378ADD' },
                    { l: 'Fuel', v: rentedCosts.fuelPerVan * rentedCosts.activeVans + (se ? saudiCosts.fuelPerVanPerMonth * saudiCosts.activeVans : 0), c: '#E85D3A' },
                    { l: 'Drivers', v: rentedCosts.driverTotal * rentedCosts.activeVans + (se ? saudiCosts.driverTotalPerMonth * saudiCosts.activeVans : 0), c: '#40A9F3' },
                    { l: 'Maintenance', v: (autoclaw.input.otherMaintPerMonth + rentedCosts.oilPerVan + rentedCosts.tiresPerVan) * rentedCosts.activeVans + (se ? (saudiFleet.input.otherMaintenancePerMonth + saudiCosts.oilPerVanPerMonth + saudiCosts.tiresPerVanPerMonth) * saudiCosts.activeVans : 0), c: '#9B6FE8' },
                    { l: 'Warehouse', v: autoclaw.input.warehouseRent + (se ? saudiFleet.input.warehouseRentPerMonth : 0), c: '#7F77DD' },
                    { l: 'Admin & SW', v: autoclaw.input.adminSalaries + autoclaw.input.software + autoclaw.input.comms + (se ? saudiFleet.input.adminSalariesPerMonth + saudiFleet.input.softwarePerMonth + saudiFleet.input.communicationPerMonth : 0), c: '#f97316' },
                    { l: 'Depreciation', v: se ? saudiCosts.depreciationPerVanPerMonth * saudiCosts.activeVans : 0, c: '#eab308' },
                    { l: 'Utilities', v: autoclaw.input.utilities + (se ? saudiFleet.input.utilitiesPerMonth : 0), c: '#06b6d4' },
                  ].filter(it => it.v > 0);
                  const total = items.reduce((s, it) => s + it.v, 0) || 1;
                  let cumulative = 0;
                  const cx = 70, cy = 70, r = 50;
                  return items.map((it, i) => {
                    const pct = it.v / total;
                    const startAngle = cumulative * 360;
                    cumulative += pct;
                    const endAngle = cumulative * 360;
                    const sRad = (startAngle - 90) * Math.PI / 180;
                    const eRad = (endAngle - 90) * Math.PI / 180;
                    const x1 = cx + r * Math.cos(sRad);
                    const y1 = cy + r * Math.sin(sRad);
                    const x2 = cx + r * Math.cos(eRad);
                    const y2 = cy + r * Math.sin(eRad);
                    const largeArc = pct > 0.5 ? 1 : 0;
                    const path = pct >= 1
                      ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`
                      : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                    return <path key={i} d={path} fill={it.c} opacity="0.85" stroke="#18181c" strokeWidth="1" />;
                  });
                })()}
                <circle cx="70" cy="70" r="26" fill="#18181c" />
                <text x="70" y="67" textAnchor="middle" fill="#e4e4e7" fontSize="12" fontWeight="bold" fontFamily="monospace">SAR</text>
                <text x="70" y="80" textAnchor="middle" fill="#a1a1aa" fontSize="8" fontFamily="monospace">{Math.round(totalCost / 1000)}K</text>
              </svg>
              <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {[
                  { l: 'Van Rent', v: autoclaw.input.vanRentPerMonth * rentedCosts.activeVans, c: '#378ADD' },
                  { l: 'Fuel', v: rentedCosts.fuelPerVan * rentedCosts.activeVans + (se ? saudiCosts.fuelPerVanPerMonth * saudiCosts.activeVans : 0), c: '#E85D3A' },
                  { l: 'Drivers', v: rentedCosts.driverTotal * rentedCosts.activeVans + (se ? saudiCosts.driverTotalPerMonth * saudiCosts.activeVans : 0), c: '#40A9F3' },
                  { l: 'Maint.', v: (autoclaw.input.otherMaintPerMonth + rentedCosts.oilPerVan + rentedCosts.tiresPerVan) * rentedCosts.activeVans + (se ? (saudiFleet.input.otherMaintenancePerMonth + saudiCosts.oilPerVanPerMonth + saudiCosts.tiresPerVanPerMonth) * saudiCosts.activeVans : 0), c: '#9B6FE8' },
                  { l: 'Warehouse', v: autoclaw.input.warehouseRent + (se ? saudiFleet.input.warehouseRentPerMonth : 0), c: '#7F77DD' },
                  { l: 'Admin', v: autoclaw.input.adminSalaries + autoclaw.input.software + autoclaw.input.comms + (se ? saudiFleet.input.adminSalariesPerMonth + saudiFleet.input.softwarePerMonth + saudiFleet.input.communicationPerMonth : 0), c: '#f97316' },
                  { l: 'Deprec.', v: se ? saudiCosts.depreciationPerVanPerMonth * saudiCosts.activeVans : 0, c: '#eab308' },
                  { l: 'Utilities', v: autoclaw.input.utilities + (se ? saudiFleet.input.utilitiesPerMonth : 0), c: '#06b6d4' },
                ].filter(it => it.v > 0).map((it, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[9px]">
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: it.c }} />
                    <span className="text-[#a1a1aa] flex-1">{it.l}</span>
                    <span className="font-mono-data text-[#e4e4e7]">SAR {Math.round(it.v).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────── DRIVERS ───────────────── */}
      {section === 'drivers' && (
        <DriversSection autoclaw={autoclaw} setAutoclaw={setAutoclaw} rentedCosts={rentedCosts}
          saudiCosts={se ? saudiCosts : null} saudiFleetSize={saudiFleet.input.fleetSize} />
      )}

      {/* ───────────────── ZONES & MAP ───────────────── */}
      {section === 'zones' && (
        <ZonesSection zones={autoclaw.zones} setZones={(z) => setAutoclaw({ zones: z })} vehicles={vehicles} simZones={simZones} />
      )}

      {/* ───────────────── BREAK-EVEN ───────────────── */}
      {section === 'breakeven' && (
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <h2 className="text-sm font-semibold text-[#e4e4e7] flex items-center gap-2">
            <Target className="w-4 h-4 text-[#eab308]" /> Break-Even Analysis
          </h2>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-[#18181c] border border-[#378ADD]/30 rounded-lg p-3">
              <div className="text-[9px] text-[#378ADD] uppercase mb-1">Nexus BE</div>
              <div className="font-mono-data text-lg font-bold text-[#eab308]">{Math.round(rentedCosts.breakEvenDel)} <span className="text-[9px] text-[#71717a]">del/day</span></div>
              <div className="text-[9px] text-[#71717a]">SAR {Math.round(rentedCosts.costPerDel)}/del · {rentedCosts.margin.toFixed(1)}% margin</div>
            </div>
            <div className="bg-[#18181c] border border-[#22c55e]/30 rounded-lg p-3">
              <div className="text-[9px] text-[#22c55e] uppercase mb-1">Saudi BE</div>
              <div className="font-mono-data text-lg font-bold text-[#eab308]">{se ? `${Math.round(saudiCosts.breakEvenDeliveriesPerDay)}` : '—'} <span className="text-[9px] text-[#71717a]">del/day</span></div>
              <div className="text-[9px] text-[#71717a]">{se ? `SAR ${Math.round(saudiCosts.costPerDelivery)}/del · ${saudiCosts.marginPercent.toFixed(1)}% margin` : 'Saudi fleet disabled'}</div>
            </div>
            <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
              <div className="text-[9px] text-[#a855f7] uppercase mb-1">Combined Cost/Del</div>
              <div className="font-mono-data text-lg font-bold text-[#f97316]">SAR {totalDelCapacity > 0 ? Math.round(totalCost / totalDelCapacity) : 0}</div>
              <div className="text-[9px] text-[#71717a]">Across {totalActive} active vans</div>
            </div>
            <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
              <div className="text-[9px] text-[#52525b] uppercase mb-1">Combined Margin</div>
              <div className={`font-mono-data text-lg font-bold ${marginPct >= 20 ? 'text-[#22c55e]' : marginPct >= 10 ? 'text-[#eab308]' : 'text-[#ef4444]'}`}>{marginPct.toFixed(1)}%</div>
              <div className="text-[9px] text-[#71717a]">SAR {Math.round(totalProfit).toLocaleString()} profit</div>
            </div>
          </div>
          {/* Professional chart: Revenue vs Cost bars + profit line */}
          <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
            <h3 className="text-[10px] text-[#71717a] uppercase tracking-wider mb-3">Revenue vs Cost — Break-Even Analysis by Delivery Volume</h3>
            <div className="flex gap-6">
              <div className="flex-1">
                <div className="flex items-end gap-0.5 h-48">
                  {Array.from({ length: 16 }, (_, i) => {
                    const vol = 5 + i * 5;
                    const nexusRev = vol * autoclaw.input.revenuePerDelivery * autoclaw.input.workingDays * rentedCosts.activeVans;
                    const nexusCost = rentedCosts.totalVar + rentedCosts.totalFixed;
                    const saudiRev = se ? vol * saudiFleet.input.revenuePerDelivery * 22 * saudiCosts.activeVans : 0;
                    const saudiCostsTotal = se ? saudiCosts.totalVariableCost + saudiCosts.totalFixedCost : 0;
                    const rev = nexusRev + saudiRev;
                    const cost = nexusCost + saudiCostsTotal;
                    const profit = rev - cost;
                    const maxVal = Math.max(rev, cost, totalRevenue * 1.3);
                    const hRev = (rev / maxVal) * 100;
                    const hCost = (cost / maxVal) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                        <div className="w-full relative" style={{ height: `${Math.max(hRev, hCost)}%`, minHeight: '4px' }}>
                          <div className="absolute bottom-0 w-full bg-[#3b82f6]/60 rounded-t transition-all group-hover:bg-[#3b82f6]/80" style={{ height: `${hRev}%` }} title={`Rev: SAR ${Math.round(rev).toLocaleString()}`} />
                          <div className="absolute bottom-0 w-full bg-[#f97316]/60 rounded-t transition-all group-hover:bg-[#f97316]/80" style={{ height: `${hCost}%` }} title={`Cost: SAR ${Math.round(cost).toLocaleString()}`} />
                          {profit >= 0 && <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[#22c55e] text-[8px]">▲</div>}
                        </div>
                        <span className={`text-[6px] ${profit >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{vol}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex text-[6px] text-[#52525b] mt-1">
                  <span className="flex-1">5 del</span>
                  <span className="flex-1 text-center">40 del</span>
                  <span className="flex-1 text-right">80 del</span>
                </div>
              </div>
              <div className="w-48 shrink-0 space-y-2">
                <div className="bg-[#0a0a0b] rounded p-2">
                  <div className="text-[8px] text-[#52525b]">Break-Even Point</div>
                  <div className="font-mono-data text-sm font-bold text-[#eab308]">{Math.round(rentedCosts.breakEvenDel + (se ? saudiCosts.breakEvenDeliveriesPerDay : 0))} <span className="text-[9px] text-[#71717a]">del/day</span></div>
                </div>
                <div className="bg-[#0a0a0b] rounded p-2">
                  <div className="text-[8px] text-[#52525b]">Current Volume</div>
                  <div className="font-mono-data text-sm font-bold text-[#3b82f6]">{totalDelCapacity} <span className="text-[9px] text-[#71717a]">del/day</span></div>
                  <div className="text-[8px] text-[#71717a]">{totalDelCapacity > (rentedCosts.breakEvenDel + (se ? saudiCosts.breakEvenDeliveriesPerDay : 0)) ? '✅ Above break-even' : '⚠️ Below break-even'}</div>
                </div>
                <div className="bg-[#0a0a0b] rounded p-2">
                  <div className="text-[8px] text-[#52525b]">Profit at Current</div>
                  <div className={`font-mono-data text-sm font-bold ${totalProfit >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>SAR {Math.round(totalProfit).toLocaleString()}</div>
                  <div className="text-[8px] text-[#71717a]">{marginPct.toFixed(1)}% margin</div>
                </div>
                <div className="flex gap-2 text-[8px]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#3b82f6]/60 rounded" /> Revenue</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#f97316]/60 rounded" /> Cost</span>
                  <span className="flex items-center gap-1 text-[#eab308]">★ BE</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────── MONTE CARLO ───────────────── */}
      {section === 'monte-carlo' && (
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <h2 className="text-sm font-semibold text-[#e4e4e7] flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#a855f7]" /> Monte Carlo Simulation
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {/* Nexus MC */}
            <div className="bg-[#18181c] border border-[#378ADD]/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-semibold text-[#378ADD] uppercase">Nexus Fleet MC</h3>
                <div className="flex items-center gap-2">
                  <input type="number" min={100} max={10000} step={100} value={autoclaw.mcRuns}
                    onChange={e => setAutoclaw({ mcRuns: Math.max(100, Number(e.target.value)) })}
                    className="w-16 bg-[#0a0a0b] border border-[#2a2a33] rounded px-1.5 py-0.5 text-[10px] text-[#e4e4e7] font-mono-data text-center" />
                  <button onClick={() => { setAutoclaw({ mcRunning: true }); setTimeout(() => setAutoclaw({ mcResult: runRentedMC(autoclaw.input, rentedCosts, autoclaw.mcRuns), mcRunning: false }), 50); }}
                    className="bg-[#378ADD] text-white text-[9px] px-2 py-1 rounded font-medium hover:bg-[#2563eb] transition-colors">
                    {autoclaw.mcRunning ? 'Running...' : 'Run MC'}
                  </button>
                </div>
              </div>
              {autoclaw.mcResult ? (
                <div className="space-y-2 text-[10px]">
                  <div className="flex justify-between bg-[#0a0a0b] rounded px-2 py-1"><span className="text-[#a1a1aa]">Risk of Loss</span><span className={`font-mono-data ${autoclaw.mcResult.risk === 'Low' ? 'text-[#22c55e]' : autoclaw.mcResult.risk === 'Medium' ? 'text-[#eab308]' : 'text-[#ef4444]'}`}>{autoclaw.mcResult.risk}</span></div>
                  <div className="flex justify-between bg-[#0a0a0b] rounded px-2 py-1"><span className="text-[#a1a1aa]">P10 (Worst)</span><span className="font-mono-data text-[#ef4444]">SAR {Math.round(autoclaw.mcResult.p10).toLocaleString()}</span></div>
                  <div className="flex justify-between bg-[#0a0a0b] rounded px-2 py-1"><span className="text-[#a1a1aa]">P50 (Median)</span><span className="font-mono-data text-[#e4e4e7]">SAR {Math.round(autoclaw.mcResult.p50).toLocaleString()}</span></div>
                  <div className="flex justify-between bg-[#0a0a0b] rounded px-2 py-1"><span className="text-[#a1a1aa]">P90 (Best)</span><span className="font-mono-data text-[#22c55e]">SAR {Math.round(autoclaw.mcResult.p90).toLocaleString()}</span></div>
                </div>
              ) : <p className="text-[10px] text-[#71717a]">Click &quot;Run MC&quot; to simulate profit distribution.</p>}
            </div>
            {/* Saudi MC */}
            <div className="bg-[#18181c] border border-[#22c55e]/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-semibold text-[#22c55e] uppercase">Saudi Fleet MC</h3>
                <div className="flex items-center gap-2">
                  <input type="number" min={100} max={10000} step={100} value={saudiFleet.mcRuns}
                    onChange={e => setSaudiFleet({ mcRuns: Math.max(100, Number(e.target.value)) })}
                    className="w-16 bg-[#0a0a0b] border border-[#2a2a33] rounded px-1.5 py-0.5 text-[10px] text-[#e4e4e7] font-mono-data text-center" />
                  <button onClick={() => { setSaudiFleet({ mcRunning: true }); setTimeout(() => setSaudiFleet({ mcResult: runSaudiMonteCarlo(saudiFleet.input, saudiCosts, saudiFleet.mcRuns), mcRunning: false }), 50); }}
                    className="bg-[#22c55e] text-white text-[9px] px-2 py-1 rounded font-medium hover:bg-[#16a34a] transition-colors">
                    {saudiFleet.mcRunning ? 'Running...' : 'Run MC'}
                  </button>
                </div>
              </div>
              {saudiFleet.mcResult ? (
                <div className="space-y-2 text-[10px]">
                  <div className="flex justify-between bg-[#0a0a0b] rounded px-2 py-1"><span className="text-[#a1a1aa]">Risk of Loss</span><span className={`font-mono-data ${saudiFleet.mcResult.riskPercent < 25 ? 'text-[#22c55e]' : saudiFleet.mcResult.riskPercent < 50 ? 'text-[#eab308]' : 'text-[#ef4444]'}`}>{saudiFleet.mcResult.riskPercent.toFixed(1)}%</span></div>
                  <div className="flex justify-between bg-[#0a0a0b] rounded px-2 py-1"><span className="text-[#a1a1aa]">P10 (Worst)</span><span className="font-mono-data text-[#ef4444]">SAR {Math.round(saudiFleet.mcResult.p10).toLocaleString()}</span></div>
                  <div className="flex justify-between bg-[#0a0a0b] rounded px-2 py-1"><span className="text-[#a1a1aa]">P50 (Median)</span><span className="font-mono-data text-[#e4e4e7]">SAR {Math.round(saudiFleet.mcResult.p50).toLocaleString()}</span></div>
                  <div className="flex justify-between bg-[#0a0a0b] rounded px-2 py-1"><span className="text-[#a1a1aa]">P90 (Best)</span><span className="font-mono-data text-[#22c55e]">SAR {Math.round(saudiFleet.mcResult.p90).toLocaleString()}</span></div>
                </div>
              ) : <p className="text-[10px] text-[#71717a]">Click &quot;Run MC&quot; to simulate profit distribution.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ───────────────── INVESTOR VIEW ───────────────── */}
      {section === 'investor' && (
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <h2 className="text-sm font-semibold text-[#e4e4e7] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#3b82f6]" /> Unified Investor View
          </h2>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
              <div className="text-[9px] text-[#52525b] uppercase mb-1">Nexus ROI</div>
              <div className={`font-mono-data text-lg font-bold ${rentedCosts.annualROI >= 30 ? 'text-[#22c55e]' : rentedCosts.annualROI >= 15 ? 'text-[#eab308]' : 'text-[#ef4444]'}`}>{rentedCosts.annualROI.toFixed(1)}%</div>
              <div className="text-[9px] text-[#52525b]">Payback: {rentedCosts.paybackMonths} mo</div>
            </div>
            <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
              <div className="text-[9px] text-[#52525b] uppercase mb-1">Saudi ROI</div>
              <div className={`font-mono-data text-lg font-bold ${saudiCosts.fleetROI >= 30 ? 'text-[#22c55e]' : saudiCosts.fleetROI >= 15 ? 'text-[#eab308]' : 'text-[#ef4444]'}`}>{saudiCosts.fleetROI.toFixed(1)}%</div>
              <div className="text-[9px] text-[#52525b]">Payback: {saudiCosts.paybackMonths} mo</div>
            </div>
            <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
              <div className="text-[9px] text-[#52525b] uppercase mb-1">Nexus EBITDA</div>
              <div className="font-mono-data text-lg font-bold text-[#3b82f6]">{rentedCosts.ebitdaMargin.toFixed(1)}%</div>
              <div className="text-[9px] text-[#52525b]">SAR {Math.round(rentedCosts.revenue - rentedCosts.totalVar).toLocaleString()}</div>
            </div>
            <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
              <div className="text-[9px] text-[#52525b] uppercase mb-1">Saudi EBITDA</div>
              <div className="font-mono-data text-lg font-bold text-[#22c55e]">{saudiCosts.ebitdaMargin.toFixed(1)}%</div>
              <div className="text-[9px] text-[#52525b]">SAR {Math.round(saudiCosts.ebitda).toLocaleString()}</div>
            </div>
          </div>
          <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
            <h3 className="text-[10px] text-[#71717a] uppercase tracking-wider mb-3">Key Financial Metrics</h3>
            <div className="grid grid-cols-2 gap-4 text-[10px]">
              <div>
                <h4 className="text-[#378ADD] font-semibold mb-2">Nexus Fleet</h4>
                <div className="space-y-1">
                  {[
                    { l: 'Setup Cost', v: `SAR ${Math.round(rentedCosts.setupCost).toLocaleString()}` },
                    { l: 'Monthly Contribution', v: `SAR ${Math.round(rentedCosts.monthlyContribPerVan).toLocaleString()}/van` },
                    { l: 'Break-Even Deliveries', v: `${Math.round(rentedCosts.breakEvenDel)}/day` },
                    { l: 'Cost per Delivery', v: `SAR ${Math.round(rentedCosts.costPerDel)}` },
                    { l: 'Annual ROI', v: `${rentedCosts.annualROI.toFixed(1)}%` },
                    { l: 'Payback Period', v: `${rentedCosts.paybackMonths} months` },
                    { l: 'EBITDA Margin', v: `${rentedCosts.ebitdaMargin.toFixed(1)}%` },
                  ].map((r, i) => (
                    <div key={i} className="flex justify-between border-b border-[#1c1c21] pb-0.5">
                      <span className="text-[#a1a1aa]">{r.l}</span>
                      <span className="font-mono-data text-[#e4e4e7]">{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-[#22c55e] font-semibold mb-2">Saudi Fleet</h4>
                <div className="space-y-1">
                  {[
                    { l: 'Cost per Delivery', v: `SAR ${Math.round(saudiCosts.costPerDelivery)}` },
                    { l: 'Break-Even Deliveries', v: `${Math.round(saudiCosts.breakEvenDeliveriesPerDay)}/day` },
                    { l: 'Revenue per Van', v: `SAR ${Math.round(saudiCosts.revenuePerVanPerMonth).toLocaleString()}` },
                    { l: 'Fleet ROI', v: `${saudiCosts.fleetROI.toFixed(1)}%` },
                    { l: 'Payback Period', v: `${saudiCosts.paybackMonths} months` },
                    { l: 'EBITDA Margin', v: `${saudiCosts.ebitdaMargin.toFixed(1)}%` },
                  ].map((r, i) => (
                    <div key={i} className="flex justify-between border-b border-[#1c1c21] pb-0.5">
                      <span className="text-[#a1a1aa]">{r.l}</span>
                      <span className="font-mono-data text-[#e4e4e7]">{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Input helpers ──
function NexusInput({ label, val, onChange, min, max, step }: { label: string; val: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <div>
      <label className="text-[9px] text-[#52525b] block">{label}</label>
      <input type="number" value={val} min={min} max={max} step={step ?? 1}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full mt-0.5 bg-[#0a0a0b] border border-[#2a2a33] rounded px-2 py-1 text-[10px] text-[#e4e4e7] font-mono-data focus:outline-none focus:border-[#378ADD]" />
    </div>
  );
}
function SaudiInput({ label, val, onChange, min, max, step }: { label: string; val: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <div>
      <label className="text-[9px] text-[#52525b] block">{label}</label>
      <input type="number" value={val} min={min} max={max} step={step ?? 1}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full mt-0.5 bg-[#0a0a0b] border border-[#2a2a33] rounded px-2 py-1 text-[10px] text-[#e4e4e7] font-mono-data focus:outline-none focus:border-[#22c55e]" />
    </div>
  );
}

// ── Zones Section ──
function ZonesSection({ zones, setZones, vehicles, simZones }: {
  zones: ZoneData[]; setZones: (z: ZoneData[]) => void; vehicles: VehicleLocation[]; simZones: ZoneDensity[];
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDel, setEditDel] = useState(0);
  const [editPrice, setEditPrice] = useState(0);
  const [newName, setNewName] = useState('');
  const [newDel, setNewDel] = useState(50);
  const [newPrice, setNewPrice] = useState(12);

  const startEdit = (idx: number, z: ZoneData) => { setEditingIdx(idx); setEditName(z.name); setEditDel(z.deliveries); setEditPrice(z.pricePerDelivery); };
  const saveEdit = (idx: number) => {
    if (!editName.trim()) return;
    const updated = [...zones];
    updated[idx] = { ...updated[idx], name: editName.trim(), deliveries: editDel, pricePerDelivery: editPrice };
    setZones(updated);
    setEditingIdx(null);
  };
  const removeZone = (idx: number) => setZones(zones.filter((_z: ZoneData, i: number) => i !== idx));
  const addZone = () => {
    if (!newName.trim()) return;
    setZones([...zones, { name: newName.trim(), deliveries: newDel, pricePerDelivery: newPrice, active: true }]);
    setNewName(''); setNewDel(50); setNewPrice(12);
  };

  return (
    <div className="p-4 space-y-4 overflow-y-auto flex-1">
      <h2 className="text-sm font-semibold text-[#e4e4e7] flex items-center gap-2">
        <MapPin className="w-4 h-4 text-[#7F77DD]" /> Zones & Fleet Map
      </h2>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4 col-span-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] text-[#378ADD] uppercase tracking-wider">Nexus Zones</h3>
            <span className="text-[9px] text-[#71717a]">{zones.length} zones</span>
          </div>
          <div className="space-y-1 text-[10px] max-h-48 overflow-y-auto">
            {zones.map((z: ZoneData, i: number) => (
              <div key={i} className="flex items-center justify-between bg-[#0a0a0b] rounded px-2 py-1 group">
                {editingIdx === i ? (
                  <div className="flex gap-1 flex-1">
                    <input value={editName} onChange={e => setEditName(e.target.value)} className="w-16 bg-[#18181c] border border-[#378ADD] rounded px-1 text-[9px] text-[#e4e4e7]" />
                    <input type="number" value={editDel} onChange={e => setEditDel(Number(e.target.value))} className="w-10 bg-[#18181c] border border-[#378ADD] rounded px-1 text-[9px] text-[#e4e4e7] font-mono-data" />
                    <input type="number" value={editPrice} onChange={e => setEditPrice(Number(e.target.value))} step={0.5} className="w-10 bg-[#18181c] border border-[#378ADD] rounded px-1 text-[9px] text-[#e4e4e7] font-mono-data" />
                    <button onClick={() => saveEdit(i)} className="text-[#22c55e] text-[9px]">✓</button>
                  </div>
                ) : (
                  <>
                    <span className="text-[#a1a1aa]">{z.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-data text-[#e4e4e7]">{z.deliveries} del · SAR {z.pricePerDelivery}</span>
                      <button onClick={() => startEdit(i, z)} className="opacity-0 group-hover:opacity-100 text-[#a1a1aa] hover:text-[#3b82f6]"><Pencil className="w-2.5 h-2.5" /></button>
                      <button onClick={() => removeZone(i)} className="opacity-0 group-hover:opacity-100 text-[#a1a1aa] hover:text-[#ef4444]"><X className="w-2.5 h-2.5" /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-[#2a2a33] flex items-center gap-1.5">
            <input placeholder="Zone name" value={newName} onChange={e => setNewName(e.target.value)}
              className="flex-1 bg-[#0a0a0b] border border-[#2a2a33] rounded px-1.5 py-0.5 text-[9px] text-[#e4e4e7] focus:outline-none focus:border-[#378ADD]" />
            <input type="number" placeholder="Del" value={newDel} onChange={e => setNewDel(Number(e.target.value))}
              className="w-12 bg-[#0a0a0b] border border-[#2a2a33] rounded px-1 py-0.5 text-[9px] text-[#e4e4e7] font-mono-data focus:outline-none focus:border-[#378ADD]" />
            <input type="number" placeholder="SAR" value={newPrice} onChange={e => setNewPrice(Number(e.target.value))} step={0.5}
              className="w-12 bg-[#0a0a0b] border border-[#2a2a33] rounded px-1 py-0.5 text-[9px] text-[#e4e4e7] font-mono-data focus:outline-none focus:border-[#378ADD]" />
            <button onClick={addZone} disabled={!newName.trim()}
              className="flex items-center gap-0.5 bg-[#378ADD] text-white text-[8px] px-1.5 py-0.5 rounded font-medium hover:bg-[#2563eb] transition-colors disabled:opacity-40">
              <Plus className="w-2.5 h-2.5" /> Add
            </button>
          </div>
        </div>
        <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg overflow-hidden col-span-2" style={{ minHeight: 350 }}>
          <FleetMap vehicles={vehicles} zones={simZones} />
        </div>
      </div>
    </div>
  );
}

// ── Drivers Section ──
function DriversSection({ autoclaw, setAutoclaw, rentedCosts, saudiCosts, saudiFleetSize }: {
  autoclaw: { drivers: DriverData[] }; setAutoclaw: (s: { drivers: DriverData[] }) => void;
  rentedCosts: RentedFleetOutput; saudiCosts: { driverTotalPerMonth: number; activeVans: number } | null; saudiFleetSize: number;
}) {
  const [filter, setFilter] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [newDel, setNewDel] = useState(30);
  const [newKm, setNewKm] = useState(120);

  const combinedDriverCost = (rentedCosts.driverTotal || 0) * (rentedCosts.activeVans || 0) + (saudiCosts ? (saudiCosts.driverTotalPerMonth || 0) * (saudiCosts.activeVans || 0) : 0);

  const startEdit = (idx: number, name: string) => { setEditingIdx(idx); setEditName(name); };
  const saveEdit = (idx: number) => {
    if (editName.trim()) {
      const updated = [...autoclaw.drivers];
      updated[idx] = { ...updated[idx], name: editName.trim() };
      setAutoclaw({ drivers: updated });
    }
    setEditingIdx(null);
  };
  const removeDriver = (idx: number) => {
    const updated = autoclaw.drivers.filter((_d: DriverData, i: number) => i !== idx);
    setAutoclaw({ drivers: updated });
  };
  const addDriver = () => {
    if (!newName.trim()) return;
    const d: DriverData = { name: newName.trim(), deliveriesPerDay: newDel, kmPerDay: newKm, fuelActual: 8, attendance: 95 };
    setAutoclaw({ drivers: [...autoclaw.drivers, d] });
    setNewName(''); setNewDel(30); setNewKm(120);
  };

  return (
    <div className="p-4 space-y-4 overflow-y-auto flex-1">
      <h2 className="text-sm font-semibold text-[#e4e4e7] flex items-center gap-2">
        <Users className="w-4 h-4 text-[#40A9F3]" /> Unified Driver Management
      </h2>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
          <div className="text-[9px] text-[#378ADD] uppercase tracking-wider mb-1">Nexus Drivers</div>
          <div className="font-mono-data text-lg font-bold text-[#e4e4e7]">{autoclaw.drivers.length}</div>
          <div className="text-[9px] text-[#52525b]">SAR {Math.round(rentedCosts.driverTotal).toLocaleString()}/van</div>
        </div>
        <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
          <div className="text-[9px] text-[#22c55e] uppercase tracking-wider mb-1">Saudi Drivers</div>
          <div className="font-mono-data text-lg font-bold text-[#e4e4e7]">{saudiFleetSize}</div>
          <div className="text-[9px] text-[#52525b]">SAR {saudiCosts ? Math.round(saudiCosts.driverTotalPerMonth).toLocaleString() : '—'}/van</div>
        </div>
        <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
          <div className="text-[9px] text-[#a855f7] uppercase tracking-wider mb-1">Combined Driver Cost</div>
          <div className="font-mono-data text-lg font-bold text-[#f97316]">SAR {Math.round(combinedDriverCost).toLocaleString()}</div>
        </div>
      </div>
      {/* Nexus driver list */}
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] text-[#378ADD] uppercase tracking-wider">Nexus Fleet — Drivers</h3>
          <div className="flex items-center gap-2">
            <input placeholder="Filter by name..." value={filter} onChange={e => setFilter(e.target.value)}
              className="bg-[#0a0a0b] border border-[#2a2a33] rounded px-2 py-1 text-[10px] text-[#e4e4e7] focus:outline-none focus:border-[#378ADD] w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-1 max-h-64 overflow-y-auto">
          {autoclaw.drivers.filter((d: DriverData) => !filter || d.name.toLowerCase().includes(filter.toLowerCase())).map((d: DriverData, i: number) => (
            <div key={i} className="flex items-center justify-between text-[10px] bg-[#0a0a0b] rounded px-2 py-1.5 group">
              <div className="flex items-center gap-2 flex-1">
                {editingIdx === i ? (
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    onBlur={() => saveEdit(i)} onKeyDown={e => e.key === 'Enter' && saveEdit(i)}
                    className="bg-[#18181c] border border-[#378ADD] rounded px-1.5 py-0.5 text-[10px] text-[#e4e4e7] font-mono-data w-28 focus:outline-none" autoFocus />
                ) : (
                  <span className="text-[#e4e4e7] font-medium">{d.name}</span>
                )}
              </div>
              <div className="flex gap-3 text-[#a1a1aa] items-center">
                <span>{d.deliveriesPerDay} del/day</span>
                <span>{d.kmPerDay} km</span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-[#1c1c21] text-[#a1a1aa]">Score: {driverScore(d, 30, 8)}</span>
                <button onClick={() => startEdit(i, d.name)} className="opacity-0 group-hover:opacity-100 transition-opacity text-[#a1a1aa] hover:text-[#3b82f6]"><Pencil className="w-3 h-3" /></button>
                <button onClick={() => removeDriver(i)} className="opacity-0 group-hover:opacity-100 transition-opacity text-[#a1a1aa] hover:text-[#ef4444]"><X className="w-3 h-3" /></button>
              </div>
            </div>
          ))}
          {autoclaw.drivers.length === 0 && <p className="text-[10px] text-[#71717a]">No drivers configured. Add one below.</p>}
        </div>
        {/* Add driver */}
        <div className="mt-3 pt-3 border-t border-[#2a2a33] flex items-center gap-2">
          <input placeholder="Driver name" value={newName} onChange={e => setNewName(e.target.value)}
            className="bg-[#0a0a0b] border border-[#2a2a33] rounded px-2 py-1 text-[10px] text-[#e4e4e7] focus:outline-none focus:border-[#378ADD] w-28" />
          <input type="number" placeholder="Del/day" value={newDel} onChange={e => setNewDel(Number(e.target.value))}
            className="bg-[#0a0a0b] border border-[#2a2a33] rounded px-1.5 py-1 text-[10px] text-[#e4e4e7] font-mono-data w-16 focus:outline-none focus:border-[#378ADD]" />
          <input type="number" placeholder="Km" value={newKm} onChange={e => setNewKm(Number(e.target.value))}
            className="bg-[#0a0a0b] border border-[#2a2a33] rounded px-1.5 py-1 text-[10px] text-[#e4e4e7] font-mono-data w-16 focus:outline-none focus:border-[#378ADD]" />
          <button onClick={addDriver} disabled={!newName.trim()}
            className="flex items-center gap-1 bg-[#378ADD] text-white text-[9px] px-2 py-1 rounded font-medium hover:bg-[#2563eb] transition-colors disabled:opacity-40">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
      </div>
    </div>
  );
}
