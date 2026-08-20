'use client';

import { useState, useCallback, useMemo } from 'react';
import { calculateRentedFleet, runRentedMC, driverScore,
  DEFAULT_RENTED, DEFAULT_ZONES, DEFAULT_DRIVERS,
  RentedFleetInput, RentedFleetOutput, MCResult, ZoneData, DriverData } from '@/lib/rentedFleetEngine';
import { Activity, Calculator, Zap, Truck,
  BarChart3, MapPin, User, Target, Shield } from 'lucide-react';

type Tab = 'overview' | 'costs' | 'zones' | 'drivers' | 'monte-carlo' | 'investor' | 'ask';

// ─── Entry ───
export default function RentedFleetPlanner() {
  const [tab, setTab] = useState<Tab>('overview');
  const [input, setInput] = useState<RentedFleetInput>(DEFAULT_RENTED);
  const [zones, setZones] = useState<ZoneData[]>(DEFAULT_ZONES);
  const [drivers, setDrivers] = useState<DriverData[]>(DEFAULT_DRIVERS);
  const [mcRuns, setMcRuns] = useState(1000);
  const [mcResult, setMcResult] = useState<MCResult | null>(null);
  const [mcRunning, setMcRunning] = useState(false);
  const [askQ, setAskQ] = useState('');
  const [askA, setAskA] = useState('');
  const [recs, setRecs] = useState<{ title: string; detail: string; priority: string; impact: string }[]>([]);

  const costs = useMemo(() => calculateRentedFleet(input), [input]);
  const isProfitable = costs.profit >= 0;

  const update = useCallback((k: keyof RentedFleetInput) => (v: number) => setInput(p => ({ ...p, [k]: v })), []);

  const runMC = () => { setMcRunning(true); setTimeout(() => { setMcResult(runRentedMC(input, costs, mcRuns)); setMcRunning(false); }, 50); };

  const runPerZone = (fuel: number, oil: number, tires: number, maint: number) => fuel + oil + tires + maint;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'costs', label: 'Costs', icon: <Calculator className="w-3.5 h-3.5" /> },
    { id: 'zones', label: 'Zones', icon: <MapPin className="w-3.5 h-3.5" /> },
    { id: 'drivers', label: 'Drivers', icon: <User className="w-3.5 h-3.5" /> },
    { id: 'monte-carlo', label: 'Monte Carlo', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'investor', label: 'Investor', icon: <Target className="w-3.5 h-3.5" /> },
    { id: 'ask', label: 'Ask Autoclaw', icon: <Zap className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="p-4 overflow-y-auto flex-1 max-w-5xl mx-auto space-y-4">
      <Header input={input} update={update} />
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[#2a2a33] overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-all border-b-2 ${
              tab === t.id ? 'text-[#e4e4e7] border-[#3b82f6]' : 'text-[#71717a] border-transparent hover:text-[#a1a1aa]'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab costs={costs} input={input} isProfitable={isProfitable} />}
      {tab === 'costs' && <CostsTab input={input} update={update} costs={costs} />}
      {tab === 'zones' && <ZonesTab zones={zones} setZones={setZones} costs={costs} input={input} runPerZone={runPerZone} />}
      {tab === 'drivers' && <DriversTab drivers={drivers} setDrivers={setDrivers} input={input} />}
      {tab === 'monte-carlo' && <MonteCarloTab mcRuns={mcRuns} setMcRuns={setMcRuns} runMC={runMC} mcRunning={mcRunning} mcResult={mcResult} />}
      {tab === 'investor' && <InvestorTab costs={costs} input={input} isProfitable={isProfitable} />}
      {tab === 'ask' && <AskTab askQ={askQ} setAskQ={setAskQ} askA={askA} setAskA={setAskA} recs={recs} setRecs={setRecs} costs={costs} input={input} />}
    </div>
  );
}

// ─── Header ───
function Header({ input, update }: { input: RentedFleetInput; update: (k: keyof RentedFleetInput) => (v: number) => void }) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-4">
      <div>
        <h2 className="text-lg font-semibold text-[#e4e4e7] flex items-center gap-2">
          <Truck className="w-5 h-5 text-[#3b82f6]" />
          Rented Fleet Planner
        </h2>
        <p className="text-xs text-[#71717a] mt-0.5">Rental Vans · Last-Mile · Saudi Arabia</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-[#71717a]">Fleet</label>
          <input type="number" min={1} max={100} value={input.fleetSize}
            onChange={e => update('fleetSize')(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-14 bg-[#0a0a0b] border border-[#2a2a33] rounded px-2 py-1 text-xs font-mono-data text-[#e4e4e7] text-center focus:border-[#3b82f6] focus:outline-none" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-[#71717a]">Util.</label>
          <input type="range" min={50} max={100} value={input.utilization}
            onChange={e => update('utilization')(Number(e.target.value))} className="w-20" />
          <span className="text-xs font-mono-data text-[#e4e4e7] w-8">{input.utilization}%</span>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 1: Overview ───
function OverviewTab({ costs, input, isProfitable }: { costs: RentedFleetOutput; input: RentedFleetInput; isProfitable: boolean }) {
  const gapBe = Math.round(costs.breakEvenDel - costs.delPerDay);
  const bars = [
    { label: 'Van Rental', val: input.vanRentPerMonth * costs.activeVans, color: '#378ADD' },
    { label: 'Fuel', val: costs.fuelPerVan * costs.activeVans, color: '#E85D3A' },
    { label: 'Oil+Tires+Maint', val: (costs.oilPerVan + costs.tiresPerVan + input.otherMaintPerMonth) * costs.activeVans, color: '#9B6FE8' },
    { label: 'Driver Salaries+Benefits', val: costs.driverTotal * costs.activeVans, color: '#40A9F3' },
    { label: 'Fixed Overhead', val: costs.totalFixed, color: '#7F77DD' },
    { label: 'Revenue', val: costs.revenue, color: '#1D9E75' },
  ];
  const maxV = Math.max(...bars.map(b => b.val));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KPI label="Revenue" value={`SAR ${(costs.revenue/1000).toFixed(1)}K`} sub={`${costs.delPerDay} del/day`} />
        <KPI label="Cost" value={`SAR ${(costs.totalCost/1000).toFixed(1)}K`} sub={`SAR ${costs.costPerDel.toFixed(1)}/del`} />
        <KPI label="Profit" value={`SAR ${(costs.profit/1000).toFixed(1)}K`} sub={`${costs.margin.toFixed(1)}% margin`} accent={isProfitable ? '#22c55e' : '#ef4444'} />
        <KPI label="Break-Even" value={`${Math.round(costs.breakEvenDel)}/day`} sub={`Benchmark: 200-220`} accent={costs.delPerDay >= costs.breakEvenDel ? '#22c55e' : '#ef4444'} />
      </div>
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3">Cost Waterfall</h3>
        {bars.map(b => (
          <div key={b.label} className="mb-2.5">
            <div className="flex justify-between text-[11px] text-[#a1a1aa] mb-1">
              <span>{b.label}</span>
              <span className="font-mono-data text-[#e4e4e7]">SAR {Math.round(b.val).toLocaleString()}</span>
            </div>
            <div className="h-1.5 bg-[#0a0a0b] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(b.val/maxV)*100}%`, backgroundColor: b.color }} />
            </div>
          </div>
        ))}
      </div>
      <div className={`rounded-lg p-3 ${isProfitable ? 'bg-[#22c55e]/10 border border-[#22c55e]/20' : 'bg-[#ef4444]/10 border border-[#ef4444]/20'}`}>
        <p className={`text-xs font-medium ${isProfitable ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
          {isProfitable
            ? `✓ Above break-even by ${Math.abs(gapBe)} deliveries/day. Margin: ${costs.margin.toFixed(1)}%.`
            : `⚠ Need ${gapBe} more deliveries/day to break even (${Math.round(costs.delPerDay/costs.breakEvenDel*100)}% of target).`}
        </p>
      </div>
    </div>
  );
}

// ─── KPI Card ───
function KPI({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: string }) {
  return (
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3 hover:border-[#3d3d4a] transition-colors">
      <div className="text-[10px] text-[#71717a] uppercase tracking-wider mb-1">{label}</div>
      <div className="font-mono-data text-xl font-bold" style={{ color: accent || '#e4e4e7' }}>{value}</div>
      <div className="text-[10px] text-[#52525b] mt-0.5">{sub}</div>
    </div>
  );
}

// ─── Tab 2: Costs ───
function CostsTab({ input, update, costs }: { input: RentedFleetInput; update: (k: keyof RentedFleetInput) => (v: number) => void; costs: RentedFleetOutput }) {
  const vanFields: [keyof RentedFleetInput, string, string, number][] = [
    ['vanRentPerMonth', 'Van Rent/Month', 'SAR', 100],
    ['fuelPriceLiter', 'Fuel Price', 'SAR/L', 0.01],
    ['fuelPer100km', 'Consumption', 'L/100km', 0.5],
    ['kmPerDay', 'KM/Day', 'km', 5],
    ['oilPer5000km', 'Oil/5,000km', 'SAR', 10],
    ['tiresPerYear', 'Tires/Year', 'SAR', 100],
    ['otherMaintPerMonth', 'Maint/Month', 'SAR', 50],
  ];
  const peopleFields: [keyof RentedFleetInput, string, string, number][] = [
    ['driverSalary', 'Driver Salary', 'SAR', 100],
    ['driverBenefits', 'Benefits', '%', 1],
  ];
  const fixedFields: [keyof RentedFleetInput, string, string, number][] = [
    ['warehouseRent', 'Warehouse Rent', 'SAR', 500],
    ['utilities', 'Utilities', 'SAR', 100],
    ['adminSalaries', 'Admin Salaries', 'SAR', 500],
    ['software', 'Software', 'SAR', 50],
    ['comms', 'Comms', 'SAR', 50],
  ];
  const opsFields: [keyof RentedFleetInput, string, string, number][] = [
    ['deliveriesPerVanPerDay', 'Deliveries/Van/Day', 'del', 1],
    ['revenuePerDelivery', 'Revenue/Delivery', 'SAR', 0.5],
    ['workingDays', 'Working Days', 'days', 1],
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      <SectionCard title="Van Rental & Running Costs" footnote={`Fuel SAR ${Math.round(costs.fuelPerVan)}/mo/van · Oil SAR ${Math.round(costs.oilPerVan)}/mo/van · Tires SAR ${Math.round(costs.tiresPerVan)}/mo/van`}>
        {vanFields.map(([k, l, u, s]) => <EditableRow key={k} label={l} value={input[k]} onChange={v => update(k)(v)} unit={u} step={s} />)}
      </SectionCard>
      <SectionCard title="People">
        {peopleFields.map(([k, l, u, s]) => <EditableRow key={k} label={l} value={input[k]} onChange={v => update(k)(v)} unit={u} step={s} />)}
      </SectionCard>
      <SectionCard title="Fixed Overhead">
        {fixedFields.map(([k, l, u, s]) => <EditableRow key={k} label={l} value={input[k]} onChange={v => update(k)(v)} unit={u} step={s} />)}
      </SectionCard>
      <SectionCard title="Operations">
        {opsFields.map(([k, l, u, s]) => <EditableRow key={k} label={l} value={input[k]} onChange={v => update(k)(v)} unit={u} step={s} />)}
      </SectionCard>
    </div>
  );
}

function SectionCard({ title, footnote, children }: { title: string; footnote?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
      <h3 className="text-xs font-semibold text-[#e4e4e7] mb-3">{title}</h3>
      {children}
      {footnote && <div className="mt-2 p-2 bg-[#0a0a0b] rounded text-[10px] text-[#52525b]">{footnote}</div>}
    </div>
  );
}

function EditableRow({ label, value, onChange, unit, step }: { label: string; value: number; onChange: (v: number) => void; unit: string; step: number }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#2a2a33]/50 last:border-0">
      <span className="text-[11px] text-[#a1a1aa]">{label}</span>
      <div className="flex items-center gap-1.5">
        <input type="number" value={value} onChange={e => { const n = parseFloat(e.target.value); if (!isNaN(n)) onChange(n); }} step={step} min={0}
          className="w-20 bg-[#0a0a0b] border border-[#2a2a33] rounded px-2 py-0.5 text-xs font-mono-data text-[#e4e4e7] text-right focus:border-[#3b82f6] focus:outline-none" />
        <span className="text-[10px] text-[#52525b] w-10">{unit}</span>
      </div>
    </div>
  );
}

// ─── Tab 3: Zones ───
function ZonesTab({ zones, setZones, costs, input, runPerZone }: {
  zones: ZoneData[]; setZones: (z: ZoneData[]) => void; costs: RentedFleetOutput; input: RentedFleetInput;
  runPerZone: (f: number, o: number, t: number, m: number, d: number) => number;
}) {
  const zoneCostRate = runPerZone(costs.fuelPerVan, costs.oilPerVan, costs.tiresPerVan, input.otherMaintPerMonth, input.deliveriesPerVanPerDay);
  const addZone = () => setZones([...zones, { name: `Zone ${zones.length+1}`, deliveries: 20, pricePerDelivery: 17, active: true }]);
  const toggle = (i: number) => { const zz = [...zones]; zz[i] = { ...zz[i], active: !zz[i].active }; setZones(zz); };
  const updateZone = (i: number, k: keyof ZoneData, v: string | number | boolean) => {
    const zz = [...zones]; zz[i] = { ...zz[i], [k]: v }; setZones(zz);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {zones.map((z, i) => {
          const zRev = z.deliveries * z.pricePerDelivery * input.workingDays;
          const zCost = (zoneCostRate * z.deliveries / input.deliveriesPerVanPerDay) + (costs.driverTotal / 4);
          const zProfit = zRev - zCost;
          const zMargin = zRev > 0 ? (zProfit / zRev) * 100 : 0;
          const contrib = zRev > 0 ? zProfit / z.deliveries / input.workingDays : 0;
          return (
            <div key={i} className={`bg-[#18181c] border rounded-lg p-4 transition-opacity ${z.active ? 'border-[#2a2a33]' : 'border-[#2a2a33]/40 opacity-50'}`}>
              <div className="flex items-center justify-between mb-3">
                <input value={z.name} onChange={e => updateZone(i, 'name', e.target.value)}
                  className="bg-transparent text-xs font-semibold text-[#e4e4e7] w-40 focus:outline-none border-b border-transparent focus:border-[#3b82f6]" />
                <button onClick={() => toggle(i)}
                  className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${z.active ? 'bg-[#22c55e]/20 text-[#22c55e]' : 'bg-[#52525b]/20 text-[#52525b]'}`}>
                  {z.active ? 'Active' : 'Inactive'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-[#71717a]">Deliveries:</span> <input type="number" value={z.deliveries} onChange={e => updateZone(i, 'deliveries', parseInt(e.target.value)||0)}
                  className="w-14 bg-[#0a0a0b] border border-[#2a2a33] rounded px-1.5 py-0.5 font-mono-data text-[#e4e4e7] text-right focus:border-[#3b82f6] focus:outline-none" /> <span className="text-[10px] text-[#52525b]">/day</span></div>
                <div><span className="text-[#71717a]">Price:</span> <input type="number" value={z.pricePerDelivery} onChange={e => updateZone(i, 'pricePerDelivery', parseFloat(e.target.value)||0)} step={0.5}
                  className="w-16 bg-[#0a0a0b] border border-[#2a2a33] rounded px-1.5 py-0.5 font-mono-data text-[#e4e4e7] text-right focus:border-[#3b82f6] focus:outline-none" /> <span className="text-[10px] text-[#52525b]">SAR</span></div>
                <div className="col-span-2 flex items-center gap-3 mt-1">
                  <span className="font-mono-data text-sm font-bold text-[#e4e4e7]">SAR {(zRev/1000).toFixed(1)}K/mo</span>
                  <span className={`font-mono-data text-xs ${zMargin>=0?'text-[#22c55e]':'text-[#ef4444]'}`}>{zMargin.toFixed(1)}% margin</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${contrib>=0?'bg-[#22c55e]/20 text-[#22c55e]':'bg-[#ef4444]/20 text-[#ef4444]'}`}>
                    SAR {contrib.toFixed(1)}/del
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={addZone} className="w-full py-2 border border-dashed border-[#2a2a33] rounded-lg text-xs text-[#71717a] hover:text-[#a1a1aa] hover:border-[#3d3d4a] transition-colors">
        + Add Zone
      </button>
    </div>
  );
}

// ─── Tab 4: Drivers ───
function DriversTab({ drivers, setDrivers, input }: { drivers: DriverData[]; setDrivers: (d: DriverData[]) => void; input: RentedFleetInput }) {
  const fuelT = (input.kmPerDay * input.fuelPer100km / 100) * 1.15; // fuel target with 15% buffer
  const addDriver = () => setDrivers([...drivers, { name: `Driver ${drivers.length+1}`, deliveriesPerDay: input.deliveriesPerVanPerDay, kmPerDay: input.kmPerDay, fuelActual: fuelT, attendance: 95 }]);
  const updateD = (i: number, k: keyof DriverData, v: string | number) => {
    const dd = [...drivers]; dd[i] = { ...dd[i], [k]: v }; setDrivers(dd);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {drivers.map((d, i) => {
          const score = driverScore(d, input.deliveriesPerVanPerDay, fuelT);
          const badgeColor = score >= 85 ? '#22c55e' : score >= 70 ? '#f97316' : '#ef4444';
          const badgeBg = score >= 85 ? '#22c55e20' : score >= 70 ? '#f9731620' : '#ef444420';
          return (
            <div key={i} className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <input value={d.name} onChange={e => updateD(i, 'name', e.target.value)}
                  className="bg-transparent text-xs font-semibold text-[#e4e4e7] w-28 focus:outline-none border-b border-transparent focus:border-[#3b82f6]" />
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono-data font-bold" style={{ color: badgeColor, backgroundColor: badgeBg }}>
                  {score}
                </span>
              </div>
              <div className="space-y-1.5">
                <DriverField label="Deliveries/day" value={d.deliveriesPerDay} onChange={v => updateD(i, 'deliveriesPerDay', v)} target={input.deliveriesPerVanPerDay} unit="" higher />
                <DriverField label="KM/day" value={d.kmPerDay} onChange={v => updateD(i, 'kmPerDay', v)} target={input.kmPerDay} unit="km" higher />
                <DriverField label="Fuel/day" value={d.fuelActual} onChange={v => updateD(i, 'fuelActual', v)} target={fuelT} unit="L" />
                <DriverField label="Attendance" value={d.attendance} onChange={v => updateD(i, 'attendance', v)} target={95} unit="%" higher />
              </div>
              {score < 70 && (
                <div className="mt-2 p-2 bg-[#ef4444]/10 rounded border border-[#ef4444]/20 text-[10px] text-[#ef4444]">
                  {d.deliveriesPerDay < input.deliveriesPerVanPerDay && <div>• Deliveries below target ({d.deliveriesPerDay} vs {input.deliveriesPerVanPerDay})</div>}
                  {d.fuelActual > fuelT && <div>• Fuel high ({d.fuelActual}L vs {fuelT.toFixed(1)}L target)</div>}
                  {d.attendance < 90 && <div>• Attendance below 90% ({d.attendance}%)</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button onClick={addDriver} className="w-full py-2 border border-dashed border-[#2a2a33] rounded-lg text-xs text-[#71717a] hover:text-[#a1a1aa] hover:border-[#3d3d4a] transition-colors">
        + Add Driver
      </button>
    </div>
  );
}

function DriverField({ label, value, onChange, target, unit, higher }: {
  label: string; value: number; onChange: (v: number) => void; target: number; unit: string; higher?: boolean;
}) {
  const ok = higher ? value >= target : value <= target;
  return (
    <div className="flex items-center justify-between text-[10px]">
      <span className="text-[#71717a]">{label}</span>
      <div className="flex items-center gap-1.5">
        <input type="number" value={value} onChange={e => { const n = parseFloat(e.target.value); if (!isNaN(n)) onChange(n); }} step={unit==='%'?1:0.5}
          className="w-14 bg-[#0a0a0b] border border-[#2a2a33] rounded px-1.5 py-0.5 font-mono-data text-[#e4e4e7] text-right focus:border-[#3b82f6] focus:outline-none" />
        <span className="text-[#52525b]">{unit}</span>
        <span className="text-[9px] text-[#52525b]">(t:{target})</span>
        <span className="text-[9px]" style={{ color: ok ? '#22c55e' : '#ef4444' }}>{ok ? '✓' : '↓'}</span>
      </div>
    </div>
  );
}

// ─── Tab 5: Monte Carlo ───
function MonteCarloTab({ mcRuns, setMcRuns, runMC, mcRunning, mcResult }: {
  mcRuns: number; setMcRuns: (n: number) => void; runMC: () => void; mcRunning: boolean; mcResult: MCResult | null;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2"><Activity className="w-4 h-4 text-[#3b82f6]" /><h3 className="text-sm font-semibold text-[#e4e4e7]">Monte Carlo Simulation</h3></div>
        <p className="text-xs text-[#a1a1aa]">Demand: −15% to +15% · Cost: −5% to +10% · Fuel: −10% to +15%</p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[11px] text-[#71717a]">Simulations:</span>
        {[500, 1000, 5000].map(n => (
          <button key={n} onClick={() => setMcRuns(n)}
            className={`px-3 py-1 rounded text-xs border transition-all ${mcRuns===n ? 'bg-[#3b82f6]/20 border-[#3b82f6] text-[#3b82f6]' : 'border-[#2a2a33] text-[#71717a] hover:text-[#a1a1aa]'}`}>
            {n.toLocaleString()}
          </button>
        ))}
        <button onClick={runMC} disabled={mcRunning}
          className={`px-4 py-1.5 rounded text-xs font-medium ${mcRunning ? 'bg-[#2a2a33] text-[#52525b] cursor-wait' : 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'}`}>
          {mcRunning ? 'Running...' : 'Run Simulation ↗'}
        </button>
      </div>
      {mcResult && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <KPI label="Loss Risk" value={`${mcResult.risk}%`} sub="of scenarios lose money"
              accent={parseFloat(mcResult.risk)>50 ? '#ef4444' : parseFloat(mcResult.risk)>30 ? '#f97316' : '#22c55e'} />
            <KPI label="Worst 10%" value={`SAR ${(mcResult.p10/1000).toFixed(1)}K`} sub="monthly profit" accent={mcResult.p10<0?'#ef4444':'#22c55e'} />
            <KPI label="Median" value={`SAR ${(mcResult.p50/1000).toFixed(1)}K`} sub="monthly profit" />
            <KPI label="Best 10%" value={`SAR ${(mcResult.p90/1000).toFixed(1)}K`} sub="monthly profit" accent="#22c55e" />
          </div>
          <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
            <h3 className="text-xs text-[#a1a1aa] mb-3">Profit Distribution — {mcRuns.toLocaleString()} runs</h3>
            <svg viewBox="0 0 400 100" className="w-full h-24">
              {mcResult.buckets.map((count, i) => {
                const bucketMid = mcResult.min + (i + 0.5) * ((mcResult.max - mcResult.min) / 20);
                const isLoss = bucketMid < 0;
                const maxC = Math.max(...mcResult.buckets);
                const h = Math.max(2, (count / maxC) * 96);
                return <rect key={i} x={i * 20} y={100 - h} width={19} height={h} fill={isLoss ? '#ef4444' : '#22c55e'} opacity={0.75} rx={1} />;
              })}
              <line x1={mcResult.p50 < mcResult.min ? 0 : ((mcResult.p50 - mcResult.min) / (mcResult.max - mcResult.min)) * 400} y1={0}
                x2={((mcResult.p50 - mcResult.min) / (mcResult.max - mcResult.min)) * 400} y2={100} stroke="#fff" strokeWidth={1} strokeDasharray="3,3" />
            </svg>
            <div className="flex justify-between text-[9px] text-[#52525b] mt-1">
              <span>SAR {(mcResult.min/1000).toFixed(0)}K</span><span>SAR 0</span><span>SAR {(mcResult.max/1000).toFixed(0)}K</span>
            </div>
          </div>
          <div className={`rounded-lg p-4 ${parseFloat(mcResult.risk)>50 ? 'bg-[#ef4444]/10 border border-[#ef4444]/20' : 'bg-[#22c55e]/10 border border-[#22c55e]/20'}`}>
            <h3 className={`text-xs font-semibold mb-3 ${parseFloat(mcResult.risk)>50?'text-[#ef4444]':'text-[#22c55e]'}`}>Risk Mitigation Levers</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Increase deliveries/van/day by 3-5', 'Largest impact on revenue'],
                ['Renegotiate fleet utilization to 95%+', 'Maximise active vans per rental'],
                ['Reduce admin overhead by 10%', 'Direct bottom-line improvement'],
                ['Optimize routes to reduce fuel 5%', 'Lowers variable cost per delivery'],
              ].map((tip, i) => (
                <div key={i} className="bg-[#0a0a0b] rounded p-2.5">
                  <p className="text-xs font-medium text-[#e4e4e7] mb-0.5">{tip[0]}</p>
                  <p className="text-[10px] text-[#71717a]">{tip[1]}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab 6: Investor ───
function InvestorTab({ costs, input, isProfitable }: { costs: RentedFleetOutput; input: RentedFleetInput; isProfitable: boolean }) {
  const revPerVan = costs.revenue / costs.activeVans;
  const contribPerVan = costs.monthlyContribPerVan;
  const irr = costs.annualROI.toFixed(1);
  const irrVerdict = costs.annualROI >= 25 ? 'Exceeds benchmark' : costs.annualROI >= 15 ? 'Approaching benchmark' : 'Below benchmark';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KPI label="EBITDA Margin" value={`${costs.ebitdaMargin.toFixed(1)}%`} sub="Target: 8-15%" accent={costs.ebitdaMargin>=8?'#22c55e':costs.ebitdaMargin>=5?'#f97316':'#ef4444'} />
        <KPI label="Payback Period" value={`${costs.paybackMonths} mo`} sub={costs.paybackMonths === '—' ? 'N/A' : Number(costs.paybackMonths) < 12 ? 'Strong' : 'Acceptable'} accent={costs.paybackMonths==='—'?'#ef4444':Number(costs.paybackMonths)<12?'#22c55e':'#f97316'} />
        <KPI label="Annual ROI" value={`${costs.annualROI.toFixed(1)}%`} sub="Benchmark: ≥25%" accent={costs.annualROI>=25?'#22c55e':costs.annualROI>=15?'#f97316':'#ef4444'} />
        <KPI label="Cost/Delivery" value={`SAR ${costs.costPerDel.toFixed(2)}`} sub={`Revenue: SAR ${input.revenuePerDelivery}`} accent={costs.costPerDel<=input.revenuePerDelivery?'#22c55e':'#ef4444'} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Revenue/Van/Month" value={`SAR ${(revPerVan/1000).toFixed(1)}K`} />
        <StatCard label="Contribution/Van/Month" value={`SAR ${(contribPerVan/1000).toFixed(1)}K`} accent={contribPerVan>0?'#22c55e':'#ef4444'} />
        <StatCard label="Fleet Revenue" value={`SAR ${(costs.revenue/1000).toFixed(1)}K/mo`} />
        <StatCard label="Fleet Profit" value={`SAR ${(costs.profit/1000).toFixed(1)}K/mo`} accent={isProfitable?'#22c55e':'#ef4444'} />
        <StatCard label="Break-Even" value={`${Math.round(costs.breakEvenDel)}/day`} sub={`Current: ${costs.delPerDay}/day`} />
        <StatCard label="Setup Capital" value={`SAR ${(costs.setupCost/1000).toFixed(0)}K`} sub="2mo rent + deposit" />
      </div>
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-[#e4e4e7] mb-2 flex items-center gap-2"><Target className="w-3.5 h-3.5 text-[#eab308]" />IRR Estimate</h3>
        <p className="text-xs text-[#a1a1aa] leading-relaxed">
          Annualised return on the setup capital of <span className="font-mono-data text-[#e4e4e7]">SAR {(costs.setupCost/1000).toFixed(0)}K</span> is
          <span className={`font-mono-data font-bold mx-1 ${costs.annualROI>=25?'text-[#22c55e]':'text-[#f97316]'}`}>{irr}%</span>
          — {irrVerdict} of 25%. Based on {costs.activeVans} active rental vans generating SAR {(revPerVan/1000).toFixed(1)}K/mo each at
          a {costs.margin.toFixed(1)}% net margin. The rental model eliminates upfront capex (SAR 95K/van purchase) and depreciation risk,
          replacing it with predictable monthly rent at SAR {input.vanRentPerMonth.toLocaleString()}/van.
          {costs.annualROI < 25 && ` To reach the 25% benchmark, you'd need ${Math.round(costs.setupCost*0.25/12-costs.profit > 0 ? costs.setupCost*0.25/12-costs.profit : 0)} SAR/mo more profit.`}
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
      <div className="text-[9px] text-[#52525b] uppercase tracking-wider">{label}</div>
      <div className="font-mono-data text-sm font-bold mt-0.5" style={{ color: accent||'#e4e4e7' }}>{value}</div>
      {sub && <div className="text-[9px] text-[#52525b] mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Tab 7: Ask Autoclaw ───
function AskTab({ askQ, setAskQ, askA, setAskA, recs, setRecs, costs, input }: {
  askQ: string; setAskQ: (v: string) => void; askA: string; setAskA: (v: string) => void;
  recs: { title: string; detail: string; priority: string; impact: string }[]; setRecs: (r: typeof recs) => void;
  costs: RentedFleetOutput; input: RentedFleetInput;
}) {
  const handleAsk = () => { if (!askQ.trim()) return; setAskA('AI features require API key configuration'); };
  const handleGenRecs = () => {
    setRecs([
      { title: 'Increase deliveries/van/day', detail: `Current: ${input.deliveriesPerVanPerDay}. Target: 40+. Each additional delivery adds SAR ${input.revenuePerDelivery} revenue/van/day.`, impact: `+SAR ${Math.round(costs.activeVans * 5 * input.revenuePerDelivery * 22)}/mo`, priority: 'High' },
      { title: 'Optimize zone pricing', detail: `Revenue ranges SAR 15-18/delivery. Increase high-demand zones to SAR ${Math.min(18, input.revenuePerDelivery+2)}.`, impact: `+${Math.round((2 * costs.delPerMonth) / 1000)}K SAR/mo`, priority: 'High' },
      { title: 'Reduce admin overhead', detail: `Fixed costs at SAR ${(costs.totalFixed/1000).toFixed(1)}K/mo. Negotiate warehouse or consolidate roles.`, impact: `Up to SAR ${Math.round(costs.totalFixed * 0.15)}/mo saved`, priority: 'Medium' },
      { title: 'Improve driver attendance', detail: `Target 95%+ attendance reduces idle van days and boosts fleet-wide deliveries.`, impact: `+${Math.round(costs.delPerDay * 0.05)} deliveries/day`, priority: 'Medium' },
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
        <div className="flex gap-2">
          <input value={askQ} onChange={e => setAskQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAsk()}
            placeholder="Ask about your fleet..." className="flex-1 bg-[#0a0a0b] border border-[#2a2a33] rounded px-3 py-2 text-xs text-[#e4e4e7] focus:border-[#3b82f6] focus:outline-none" />
          <button onClick={handleAsk} className="px-4 py-2 bg-[#3b82f6] text-white rounded text-xs font-medium hover:bg-[#2563eb]">Ask</button>
        </div>
        {askA && (
          <div className="mt-3 p-3 bg-[#0a0a0b] rounded border border-[#2a2a33] text-xs text-[#a1a1aa] whitespace-pre-wrap">{askA}</div>
        )}
      </div>
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-[#e4e4e7] flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-[#a855f7]" />Recommendations</h3>
          <button onClick={handleGenRecs} className="px-3 py-1.5 bg-[#a855f7]/20 border border-[#a855f7]/30 text-[#a855f7] rounded text-xs hover:bg-[#a855f7]/30">Generate Recommendations</button>
        </div>
        {recs.length === 0 ? (
          <p className="text-xs text-[#71717a]">Click &quot;Generate Recommendations&quot; to analyse your fleet.</p>
        ) : (
          <div className="space-y-2">
            {recs.map((r, i) => (
              <div key={i} className="bg-[#0a0a0b] border border-[#2a2a33] rounded p-3">
                <div className="flex items-start justify-between mb-1">
                  <span className="text-xs font-semibold text-[#e4e4e7]">{r.title}</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded font-medium ${
                    r.priority === 'High' ? 'bg-[#ef4444]/20 text-[#ef4444]' : r.priority === 'Medium' ? 'bg-[#f97316]/20 text-[#f97316]' : 'bg-[#22c55e]/20 text-[#22c55e]'
                  }`}>{r.priority}</span>
                </div>
                <p className="text-[11px] text-[#a1a1aa] mb-1">{r.detail}</p>
                <p className="text-[10px] font-mono-data text-[#22c55e]">Impact: {r.impact}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
