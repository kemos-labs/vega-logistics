'use client';

/* Legacy simulation module; its recommendation payload is intentionally unstructured. */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useCallback, useMemo, Fragment } from 'react';
import dynamic from 'next/dynamic';
import {
  calculateRentedFleet, runRentedMC, driverScore,
  DEFAULT_RENTED, DEFAULT_ZONES, DEFAULT_DRIVERS,
  RentedFleetInput, RentedFleetOutput, MCResult, ZoneData, DriverData,
} from '@/lib/rentedFleetEngine';
import {
  TrendingUp, Activity, Calculator, Zap, Truck,
  BarChart3, User, Target, Shield, ChevronDown, ChevronRight,
  AlertTriangle, CheckCircle, MapPin, Ban as XCircle,
} from 'lucide-react';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then(m => m.CircleMarker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false });

type Tab = 'overview' | 'costs' | 'breakeven' | 'zones' | 'drivers' | 'monte-carlo' | 'investor' | 'ask';

const RIYADH_DISTRICTS = [
  { name:'Al Olaya', lat:24.6930, lng:46.6867 }, { name:'Al Malaz', lat:24.6785, lng:46.7259 },
  { name:'Al Murabbaa', lat:24.6927, lng:46.7098 }, { name:'Al Nakheel', lat:24.7559, lng:46.6648 },
  { name:'Al Sulimaniyah', lat:24.7042, lng:46.6818 }, { name:'Al Shifa', lat:24.6145, lng:46.7108 },
  { name:'Al Rawdah', lat:24.7212, lng:46.6922 }, { name:'Al Aqiq', lat:24.7444, lng:46.6388 },
];

const TABS: { id:Tab; label:string; icon:React.ReactNode }[] = [
  { id:'overview', label:'Overview', icon:<BarChart3 className="w-3.5 h-3.5"/> },
  { id:'costs', label:'Cost Structure', icon:<Calculator className="w-3.5 h-3.5"/> },
  { id:'breakeven', label:'Break-Even', icon:<Target className="w-3.5 h-3.5"/> },
  { id:'zones', label:'Zones', icon:<MapPin className="w-3.5 h-3.5"/> },
  { id:'drivers', label:'Drivers', icon:<User className="w-3.5 h-3.5"/> },
  { id:'monte-carlo', label:'Monte Carlo', icon:<Activity className="w-3.5 h-3.5"/> },
  { id:'investor', label:'Investor View', icon:<TrendingUp className="w-3.5 h-3.5"/> },
  { id:'ask', label:'Ask Autoclaw', icon:<Zap className="w-3.5 h-3.5"/> },
];

export default function AutoclawUnified() {
  const [tab, setTab] = useState<Tab>('overview');
  const [input, setInput] = useState<RentedFleetInput>(DEFAULT_RENTED);
  const [zones, setZones] = useState<ZoneData[]>(DEFAULT_ZONES);
  const [drivers, setDrivers] = useState<DriverData[]>(DEFAULT_DRIVERS);
  const [mcRuns, setMcRuns] = useState(1000);
  const [mcResult, setMcResult] = useState<MCResult|null>(null);
  const [mcRunning, setMcRunning] = useState(false);
  const [askQ, setAskQ] = useState(''); const [recs, setRecs] = useState<any[]>([]);
  const [invQA, setInvQA] = useState('');

  const costs = useMemo(() => calculateRentedFleet(input), [input]);
  const up = useCallback(<K extends keyof RentedFleetInput>(k:K) => (v:number) => setInput(p=>({...p,[k]:v})),[]);
  const isProfitable = costs.profit >= 0;

  const runMC = () => { setMcRunning(true); setTimeout(()=>{setMcResult(runRentedMC(input,costs,mcRuns));setMcRunning(false);},50); };

  const breakEvenFormula = `Break-even = ${Math.round(costs.totalCost).toLocaleString()} SAR ÷ ${input.revenuePerDelivery} SAR/del ÷ ${input.workingDays} days`;

  return (
    <div className="p-4 overflow-y-auto flex-1 max-w-6xl mx-auto space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#e4e4e7] flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#3b82f6]"/>Autoclaw — Rented Fleet Intelligence
          </h2>
          <p className="text-[10px] text-[#71717a] mt-0.5">Rental Vans · Last-Mile · Saudi Arabia · All costs editable</p>
        </div>
        <div className="flex items-center gap-3">
          <InlineNum label="Fleet" v={input.fleetSize} onChange={up('fleetSize')} min={1} w={14}/>
          <InlineNum label="Days" v={input.workingDays} onChange={up('workingDays')} min={19} max={30} w={12}/>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#71717a]">Util</span>
            <input type="range" min={50} max={100} value={input.utilization} onChange={e=>up('utilization')(Number(e.target.value))} className="w-16"/>
            <span className="text-xs font-mono-data text-[#e4e4e7] w-8">{input.utilization}%</span>
            {input.utilization<85 && <AlertTriangle className="w-3 h-3 text-[#f97316]"/>}
          </div>
        </div>
      </div>
      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-[#2a2a33] overflow-x-auto">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} className={`flex items-center gap-1.5 px-2.5 py-2 text-[11px] font-medium whitespace-nowrap border-b-2 transition-all ${tab===t.id?'text-[#e4e4e7] border-[#3b82f6]':'text-[#71717a] border-transparent hover:text-[#a1a1aa]'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      {/* Tab Content */}
      {tab==='overview' && <OverviewTab costs={costs} input={input} up={up} isProfitable={isProfitable}/>}
      {tab==='costs' && <CostsTab input={input} up={up} costs={costs}/>}
      {tab==='breakeven' && <BreakEvenTab costs={costs} input={input} formula={breakEvenFormula}/>}
      {tab==='zones' && <ZonesTab zones={zones} setZones={setZones} costs={costs} input={input}/>}
      {tab==='drivers' && <DriversTab drivers={drivers} setDrivers={setDrivers} input={input}/>}
      {tab==='monte-carlo' && <MonteCarloTab mcRuns={mcRuns} setMcRuns={setMcRuns} runMC={runMC} mcRunning={mcRunning} mcResult={mcResult} costs={costs}/>}
      {tab==='investor' && <InvestorTab costs={costs} input={input} isProfitable={isProfitable} invQA={invQA} setInvQA={setInvQA}/>}
      {tab==='ask' && <AskTab askQ={askQ} setAskQ={setAskQ} recs={recs} setRecs={setRecs} costs={costs} input={input}/>}
    </div>
  );
}

// ─── Helpers ───
function InlineNum({label,v,onChange,min=0,max,step=1,w=16}:{label:string;v:number;onChange:(v:number)=>void;min?:number;max?:number;step?:number;w?:number}) {
  return <div className="flex items-center gap-1"><span className="text-[10px] text-[#71717a]">{label}</span>
    <input type="number" value={v} onChange={e=>{const n=parseFloat(e.target.value);if(!isNaN(n))onChange(max?Math.min(max,Math.max(min,n)):Math.max(min,n));}} step={step}
      className={`w-${w} bg-[#0a0a0b] border border-[#2a2a33] rounded px-1.5 py-0.5 text-xs font-mono-data text-[#e4e4e7] text-center focus:border-[#3b82f6] focus:outline-none`}/>
  </div>;
}
function KPI({label,value,sub,accent}:{label:string;value:string;sub:string;accent?:string}) {
  return <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3 hover:border-[#3d3d4a] transition-colors">
    <div className="text-[10px] text-[#71717a] uppercase tracking-wider mb-0.5">{label}</div>
    <div className="font-mono-data text-lg font-bold" style={{color:accent||'#e4e4e7'}}>{value}</div>
    <div className="text-[10px] text-[#52525b] mt-0.5">{sub}</div>
  </div>;
}
function Metric({label,value,sub,accent}:{label:string;value:string;sub?:string;accent?:string}) {
  return <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
    <div className="text-[9px] text-[#52525b] uppercase tracking-wider">{label}</div>
    <div className="font-mono-data text-sm font-bold mt-0.5" style={{color:accent||'#e4e4e7'}}>{value}</div>
    {sub && <div className="text-[9px] text-[#52525b] mt-0.5">{sub}</div>}
  </div>;
}

// ─── TAB 1: OVERVIEW ───
function OverviewTab({costs,input,up,isProfitable}:{costs:RentedFleetOutput;input:RentedFleetInput;up:(k:keyof RentedFleetInput)=>(v:number)=>void;isProfitable:boolean}) {
  const gapBE = Math.round(costs.delPerDay - costs.breakEvenDel);
  const bufferDays = gapBE > 0 ? Math.round(gapBE * 30 / costs.delPerDay) : 0;
  const idleCost = Math.round(input.vanRentPerMonth * input.fleetSize * (1 - input.utilization/100));
  const bars = [
    { label:'Van Rental', val: input.vanRentPerMonth*costs.activeVans, color:'#378ADD' },
    { label:'Fuel', val: costs.fuelPerVan*costs.activeVans, color:'#E85D3A' },
    { label:'Oil+Tires+Maint', val: (costs.oilPerVan+costs.tiresPerVan+input.otherMaintPerMonth)*costs.activeVans, color:'#9B6FE8' },
    { label:'Drivers', val: costs.driverTotal*costs.activeVans, color:'#40A9F3' },
    { label:'Fixed Overhead', val: costs.totalFixed, color:'#7F77DD' },
    { label:'Revenue', val: costs.revenue, color:'#1D9E75' },
  ];
  const maxV = Math.max(...bars.map(b=>b.val));
  const baseRev = costs.revenue, baseCost = costs.totalCost, baseProfit = costs.profit, baseMargin = costs.margin;
  const consProfit = baseRev*0.9 - baseCost*1.05, consMargin = baseRev>0?(consProfit/baseRev)*100:0;
  const optProfit = baseRev*1.1 - baseCost, optMargin = baseRev>0?(optProfit/baseRev)*100:0;

  return <div className="space-y-3">
    <div className="grid grid-cols-4 gap-3">
      <KPI label="Revenue" value={`SAR ${(costs.revenue/1000).toFixed(1)}K`} sub={`${costs.delPerDay} del/day`}/>
      <KPI label="Total Cost" value={`SAR ${(costs.totalCost/1000).toFixed(1)}K`} sub={`SAR ${costs.costPerDel.toFixed(1)}/del`}/>
      <KPI label="Profit" value={`SAR ${(costs.profit/1000).toFixed(1)}K`} sub={`${costs.margin.toFixed(1)}% margin`} accent={isProfitable?'#22c55e':'#ef4444'}/>
      <KPI label="Break-Even Gap" value={gapBE>=0?`+${gapBE}/day`:`${gapBE}/day`} sub={`BE: ${Math.round(costs.breakEvenDel)}/day`} accent={isProfitable?'#22c55e':'#ef4444'}/>
    </div>
    {/* Fleet Status + Waterfall */}
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
        <h3 className="text-[10px] text-[#71717a] uppercase tracking-wider mb-3">Fleet Status</h3>
        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
          <div><span className="text-[#71717a]">Total Vans:</span> <span className="font-mono-data text-[#e4e4e7]">{input.fleetSize}</span></div>
          <div><span className="text-[#71717a]">Active:</span> <span className="font-mono-data text-[#22c55e]">{costs.activeVans}</span></div>
          <div><span className="text-[#71717a]">Idle Vans:</span> <span className="font-mono-data text-[#f97316]">{input.fleetSize-costs.activeVans}</span></div>
          <div><span className="text-[#71717a]">Idle Cost:</span> <span className="font-mono-data text-[#ef4444]">SAR {idleCost.toLocaleString()}/mo</span></div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#71717a] mb-1">
          <span>Utilization</span><input type="range" min={50} max={100} value={input.utilization} onChange={e=>up('utilization')(Number(e.target.value))} className="flex-1"/>
          <span className={`font-mono-data font-bold ${input.utilization>=85?'text-[#22c55e]':'text-[#f97316]'}`}>{input.utilization}%</span>
        </div>
        <div className="h-1.5 bg-[#0a0a0b] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{width:`${input.utilization}%`,backgroundColor:input.utilization>=85?'#22c55e':'#f97316'}}/>
        </div>
        {input.utilization<85 && <div className="mt-2 flex items-center gap-1 text-[10px] text-[#f97316]"><AlertTriangle className="w-3 h-3"/> Utilization below 85% — idle vans cost SAR {idleCost.toLocaleString()}/mo</div>}
      </div>
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
        <h3 className="text-[10px] text-[#71717a] uppercase tracking-wider mb-2">Cost Waterfall</h3>
        {bars.map(b=><div key={b.label} className="mb-2"><div className="flex justify-between text-[10px] text-[#a1a1aa] mb-0.5"><span>{b.label}</span><span className="font-mono-data text-[#e4e4e7]">SAR {Math.round(b.val).toLocaleString()}</span></div>
          <div className="h-1.5 bg-[#0a0a0b] rounded-full"><div className="h-full rounded-full transition-all duration-500" style={{width:`${(b.val/maxV)*100}%`,backgroundColor:b.color}}/></div></div>)}
      </div>
    </div>
    {/* Cash Flow */}
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
      <h3 className="text-[10px] text-[#71717a] uppercase tracking-wider mb-3">3-Month Cash Flow Projection</h3>
      <div className="grid grid-cols-3 gap-3">
        {[{label:'Base',profit:baseProfit,margin:baseMargin,color:'#3b82f6'},
          {label:'Conservative (−10%/+5%)',profit:consProfit,margin:consMargin,color:'#f97316'},
          {label:'Optimistic (+10%/flat)',profit:optProfit,margin:optMargin,color:'#22c55e'},
        ].map(s=><div key={s.label} className="bg-[#0a0a0b] rounded p-3 text-center">
          <div className="text-[10px] text-[#71717a] mb-2">{s.label}</div>
          <div className="font-mono-data text-xl font-bold" style={{color:s.color}}>SAR {(s.profit/1000).toFixed(1)}K</div>
          <div className="text-[10px] text-[#52525b] mt-0.5">{s.margin.toFixed(1)}% margin</div>
          <div className={`text-[9px] mt-1 font-medium ${s.profit>=0?'text-[#22c55e]':'text-[#ef4444]'}`}>{s.profit>=0?'✓ Positive Cash Flow':'⚠ Negative Cash Flow'}</div>
        </div>)}
      </div>
    </div>
    {/* Status Bar */}
    <div className={`rounded-lg p-3 flex items-center gap-2 ${isProfitable?'bg-[#22c55e]/10 border border-[#22c55e]/20':'bg-[#ef4444]/10 border border-[#ef4444]/20'}`}>
      {isProfitable?<CheckCircle className="w-4 h-4 text-[#22c55e]"/>:<AlertTriangle className="w-4 h-4 text-[#ef4444]"/>}
      <p className={`text-xs font-medium ${isProfitable?'text-[#22c55e]':'text-[#ef4444]'}`}>
        {isProfitable?`${Math.abs(gapBE)} above break-even — ${bufferDays} days profit buffer`:`Need ${Math.abs(gapBE)} more deliveries/day to break even (${Math.round(costs.delPerDay/costs.breakEvenDel*100)}% of target)`}
      </p>
    </div>
  </div>;
}

// ─── TAB 2: COST STRUCTURE ───
function CostsTab({input,up,costs}:{input:RentedFleetInput;up:(k:keyof RentedFleetInput)=>(v:number)=>void;costs:RentedFleetOutput}) {
  const totalCost = costs.totalCost;
  const pct = (v:number) => totalCost>0?(v/totalCost)*100:0;

  const rows: {k:keyof RentedFleetInput; label:string; unit:string; val:number; total:number; step:number}[] = [
    {k:'vanRentPerMonth', label:'Van Rent', unit:'SAR/van', val:input.vanRentPerMonth, total:input.vanRentPerMonth*costs.activeVans, step:100},
    {k:'driverSalary', label:'Driver Salary', unit:'SAR', val:input.driverSalary, total:costs.driverTotal*costs.activeVans, step:100},
    {k:'driverBenefits', label:'Benefits', unit:'%', val:input.driverBenefits, total:(input.driverSalary*input.driverBenefits/100)*costs.activeVans, step:1},
    {k:'warehouseRent', label:'Warehouse', unit:'SAR', val:input.warehouseRent, total:input.warehouseRent, step:500},
    {k:'utilities', label:'Utilities', unit:'SAR', val:input.utilities, total:input.utilities, step:100},
    {k:'adminSalaries', label:'Admin', unit:'SAR', val:input.adminSalaries, total:input.adminSalaries, step:500},
    {k:'software', label:'Software', unit:'SAR', val:input.software, total:input.software, step:50},
    {k:'comms', label:'Comms', unit:'SAR', val:input.comms, total:input.comms, step:50},
    {k:'deliveriesPerVanPerDay', label:'Del/Van/Day', unit:'del', val:input.deliveriesPerVanPerDay, total:costs.delPerMonth, step:1},
    {k:'revenuePerDelivery', label:'Revenue/Del', unit:'SAR', val:input.revenuePerDelivery, total:costs.revenue, step:0.5},
  ];

  return <div className="space-y-3">
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
      <h3 className="text-[10px] text-[#71717a] uppercase tracking-wider mb-3">Cost Structure</h3>
      <div className="space-y-1">
        {rows.map((r,i)=><div key={i} className="flex items-center gap-2 py-1 border-b border-[#2a2a33]/30 last:border-0">
          <span className="text-[11px] text-[#a1a1aa] w-24 flex-shrink-0">{r.label}</span>
          <input type="number" value={r.val} onChange={e=>{const n=parseFloat(e.target.value);if(!isNaN(n))up(r.k)(n);}} step={r.step} min={0}
            className="w-20 bg-[#0a0a0b] border border-[#2a2a33] rounded px-2 py-1 text-xs font-mono-data text-[#e4e4e7] text-right focus:border-[#3b82f6] focus:outline-none"/>
          <span className="text-[10px] text-[#52525b] w-12">{r.unit}</span>
          <span className="text-[10px] font-mono-data text-[#e4e4e7] w-24 text-right">SAR {Math.round(r.total).toLocaleString()}</span>
          <span className="text-[10px] text-[#52525b] w-10 text-right">{pct(r.total).toFixed(1)}%</span>
        </div>)}
      </div>
    </div>
    {/* Totals */}
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div><span className="text-[#71717a]">Variable:</span> <span className="font-mono-data text-[#e4e4e7]">SAR {(costs.totalVar/1000).toFixed(1)}K</span></div>
        <div><span className="text-[#71717a]">Fixed:</span> <span className="font-mono-data text-[#e4e4e7]">SAR {(costs.totalFixed/1000).toFixed(1)}K</span></div>
        <div><span className="text-[#71717a]">Total:</span> <span className="font-mono-data text-[#e4e4e7] font-bold">SAR {(costs.totalCost/1000).toFixed(1)}K</span></div>
        <div><span className="text-[#71717a]">Cost/del:</span> <span className="font-mono-data text-[#e4e4e7] font-bold">SAR {costs.costPerDel.toFixed(2)}</span> <span className="text-[9px] text-[#52525b]">(benchmark SAR 14-18)</span></div>
      </div>
    </div>
  </div>;
}

// ─── TAB 3: BREAK-EVEN ───
function BreakEvenTab({costs,input,formula}:{costs:RentedFleetOutput;input:RentedFleetInput;formula:string}) {
  const beCurrent = Math.round(costs.breakEvenDel);
  const beIndustry = {min:200,max:220};
  const scenarios = [
    {label:'Base',rev:input.revenuePerDelivery,cost:costs.totalCost,profit:costs.profit,margin:costs.margin,color:'#3b82f6'},
    {label:'Conservative',rev:input.revenuePerDelivery*0.95,cost:costs.totalCost*1.05,profit:costs.revenue*0.9-costs.totalCost*1.05,
      margin:costs.revenue>0?((costs.revenue*0.9-costs.totalCost*1.05)/(costs.revenue*0.9))*100:0,color:'#f97316'},
    {label:'Optimistic',rev:input.revenuePerDelivery*1.05,cost:costs.totalCost*0.95,profit:costs.revenue*1.1-costs.totalCost*0.95,
      margin:costs.revenue>0?((costs.revenue*1.1-costs.totalCost*0.95)/(costs.revenue*1.1))*100:0,color:'#22c55e'},
  ];

  const recs = [
    {title:'Increase deliveries/van/day to 40',impact:`+SAR ${Math.round(costs.activeVans*(40-input.deliveriesPerVanPerDay)*input.revenuePerDelivery*22)}/mo`},
    {title:`Raise revenue/del to SAR ${(input.revenuePerDelivery+2).toFixed(0)}`,impact:`+${Math.round(2*costs.delPerMonth/1000)}K SAR/mo`},
    {title:'Reduce admin overhead 10%',impact:`Save SAR ${Math.round(costs.totalFixed*0.1)}/mo`},
  ];

  return <div className="space-y-3">
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
      <div className="text-[10px] text-[#52525b] font-mono-data">{formula}</div>
    </div>
    {/* Comparison Table */}
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead><tr className="border-b border-[#2a2a33] text-[#71717a] text-[10px] uppercase tracking-wider">
          <th className="text-left p-2">Metric</th><th className="p-2 text-right">Current</th><th className="p-2 text-right">Break-Even</th><th className="p-2 text-right">Industry</th>
        </tr></thead>
        <tbody>
          {[
            ['Deliveries/day',costs.delPerDay,beCurrent,`${beIndustry.min}-${beIndustry.max}`],
            ['Revenue/Month',Math.round(costs.revenue),Math.round(beCurrent*input.revenuePerDelivery*input.workingDays),`${beIndustry.min*input.revenuePerDelivery*input.workingDays}-${beIndustry.max*input.revenuePerDelivery*input.workingDays}`],
            ['Cost/Month',Math.round(costs.totalCost),Math.round(costs.totalCost),Math.round(costs.totalCost)],
          ].map((r,i)=><tr key={i} className="border-b border-[#2a2a33]/40">
            <td className="p-2 text-[#a1a1aa]">{r[0]}</td>
            <td className="p-2 text-right font-mono-data text-[#e4e4e7]">{typeof r[1]==='number'?r[1].toLocaleString():r[1]}</td>
            <td className="p-2 text-right font-mono-data text-[#e4e4e7]">{typeof r[2]==='number'?r[2].toLocaleString():r[2]}</td>
            <td className="p-2 text-right font-mono-data text-[#52525b]">{r[3]}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
    {/* Scenario Cards */}
    <div className="grid grid-cols-3 gap-3">
      {scenarios.map(s=>{const be=s.cost>0&&s.rev>0?Math.round(s.cost/s.rev/input.workingDays):0;
        return <div key={s.label} className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider mb-2" style={{color:s.color}}>{s.label}</div>
          <div className="font-mono-data text-lg font-bold text-[#e4e4e7]">{be}/day</div>
          <div className={`font-mono-data text-sm mt-1 ${s.profit>=0?'text-[#22c55e]':'text-[#ef4444]'}`}>SAR {(s.profit/1000).toFixed(1)}K</div>
          <div className="text-[10px] text-[#52525b]">{s.margin.toFixed(1)}% margin</div>
          <div className={`text-[9px] mt-1 font-medium ${s.profit>=0?'text-[#22c55e]':'text-[#ef4444]'}`}>{s.profit>=0?'✓ Cash Flow Positive':'⚠ Cash Flow Negative'}</div>
        </div>;
      })}
    </div>
    {/* Recommendations */}
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
      <h3 className="text-xs font-semibold text-[#e4e4e7] mb-2 flex items-center gap-2"><Target className="w-3.5 h-3.5 text-[#a855f7]"/>Top 3 Gap-Closing Actions</h3>
      {recs.map((r,i)=><div key={i} className="flex items-center justify-between py-1.5 border-b border-[#2a2a33]/40 last:border-0 text-xs">
        <div><span className="font-mono-data text-[#a855f7] mr-2">#{i+1}</span><span className="text-[#e4e4e7]">{r.title}</span></div>
        <span className="font-mono-data text-[#22c55e]">{r.impact}</span>
      </div>)}
    </div>
  </div>;
}

// ─── TAB 4: ZONES ───
function ZonesTab({zones,setZones,costs,input}:{zones:ZoneData[];setZones:(z:ZoneData[])=>void;costs:RentedFleetOutput;input:RentedFleetInput}) {
  const addZone = ()=>{const zd=zones.filter(z=>z.active).length>0?zones.filter(z=>z.active)[0]:{pricePerDelivery:17,deliveries:25};setZones([...zones,{name:`Zone ${zones.length+1}`,deliveries:zd.deliveries,pricePerDelivery:zd.pricePerDelivery,active:true}]);};
  const toggle = (i:number)=>{const zz=[...zones];zz[i]={...zz[i],active:!zz[i].active};setZones(zz);};
  const updZ = (i:number,k:keyof ZoneData,v:string|number|boolean)=>{const zz=[...zones];zz[i]={...zz[i],[k]:v};setZones(zz);};

  const zoneCostRate = costs.fuelPerVan+costs.oilPerVan+costs.tiresPerVan+input.otherMaintPerMonth;

  return <div className="flex gap-3" style={{minHeight:500}}>
    {/* Left Panel — Zone Cards */}
    <div className="w-[40%] space-y-2 overflow-y-auto" style={{maxHeight:'calc(100vh-220px)'}}>
      {zones.map((z,i)=>{
        const zRev=z.deliveries*z.pricePerDelivery*input.workingDays;
        const zCost=(zoneCostRate*z.deliveries/input.deliveriesPerVanPerDay)+(costs.driverTotal/4);
        const zProfit=zRev-zCost; const zMargin=zRev>0?(zProfit/zRev)*100:0;
        const contrib=zRev>0?zProfit/z.deliveries/input.workingDays:0;
        const badgeColor=contrib>=8?'#22c55e':contrib>=5?'#f97316':'#ef4444';
        return <div key={i} className={`bg-[#18181c] border rounded-lg p-3 transition-opacity ${z.active?'border-[#2a2a33]':'border-[#2a2a33]/40 opacity-50'}`}>
          <div className="flex items-center justify-between mb-2">
            <input value={z.name} onChange={e=>updZ(i,'name',e.target.value)} className="bg-transparent text-xs font-semibold text-[#e4e4e7] w-36 focus:outline-none border-b border-transparent focus:border-[#3b82f6]"/>
            <button onClick={()=>toggle(i)} className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${z.active?'bg-[#22c55e]/20 text-[#22c55e]':'bg-[#52525b]/20 text-[#52525b]'}`}>{z.active?'Active':'Disabled'}</button>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <div className="flex items-center gap-1"><span className="text-[#71717a]">Del:</span><input type="number" value={z.deliveries} onChange={e=>updZ(i,'deliveries',parseInt(e.target.value)||0)} className="w-12 bg-[#0a0a0b] border border-[#2a2a33] rounded px-1 py-0.5 font-mono-data text-[#e4e4e7] text-right focus:border-[#3b82f6] focus:outline-none"/></div>
            <div className="flex items-center gap-1"><span className="text-[#71717a]">SAR:</span><input type="number" value={z.pricePerDelivery} onChange={e=>updZ(i,'pricePerDelivery',parseFloat(e.target.value)||0)} step={0.5} className="w-14 bg-[#0a0a0b] border border-[#2a2a33] rounded px-1 py-0.5 font-mono-data text-[#e4e4e7] text-right focus:border-[#3b82f6] focus:outline-none"/></div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="font-mono-data text-sm font-bold text-[#e4e4e7]">SAR {(zRev/1000).toFixed(1)}K</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium`} style={{color:badgeColor,backgroundColor:badgeColor+'20'}}>SAR {contrib.toFixed(1)}/del</span>
            <span className={`text-[10px] font-mono-data ${zMargin>=0?'text-[#22c55e]':'text-[#ef4444]'}`}>{zMargin.toFixed(0)}%</span>
          </div>
        </div>;
      })}
      <button onClick={addZone} className="w-full py-2 border border-dashed border-[#2a2a33] rounded-lg text-xs text-[#71717a] hover:text-[#a1a1aa] transition-colors">+ Add Zone</button>
    </div>
    {/* Right Panel — Map */}
    <div className="w-[60%] bg-[#18181c] border border-[#2a2a33] rounded-lg overflow-hidden" style={{minHeight:500}}>
      <MapContainer center={[24.7136,46.6753]} zoom={11} style={{height:'100%',width:'100%',minHeight:500}} zoomControl={true}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; CartoDB'/>
        {RIYADH_DISTRICTS.map((d,i)=>{
          const zoneMatch=zones.find(z=>z.name.includes(d.name));
          const contrib=zoneMatch?(()=>{const r=zoneMatch.deliveries*zoneMatch.pricePerDelivery*input.workingDays;const c=(zoneCostRate*zoneMatch.deliveries/input.deliveriesPerVanPerDay)+(costs.driverTotal/4);return r>0?(r-c)/zoneMatch.deliveries/input.workingDays:0;})():6;
          const color=contrib>=8?'#22c55e':contrib>=5?'#f97316':'#ef4444';
          return <CircleMarker key={i} center={[d.lat,d.lng]} radius={10} pathOptions={{color,fillColor:color,fillOpacity:0.3,weight:2}}>
            <Popup><div className="text-[11px] text-[#e4e4e7]"><div className="font-semibold mb-1">{d.name}</div>
              <div className="text-[#71717a]">Deliveries: <span className="font-mono-data text-[#e4e4e7]">{zoneMatch?.deliveries||25}</span></div>
              <div className="text-[#71717a]">SAR/del: <span className="font-mono-data text-[#e4e4e7]">SAR {zoneMatch?.pricePerDelivery||17}</span></div>
              <div className="text-[#71717a]">Contribution: <span className="font-bold" style={{color}}>SAR {contrib.toFixed(1)}</span></div>
            </div></Popup>
          </CircleMarker>;
        })}
      </MapContainer>
    </div>
  </div>;
}

// ─── TAB 5: DRIVERS ───
function DriversTab({drivers,setDrivers,input}:{drivers:DriverData[];setDrivers:(d:DriverData[])=>void;input:RentedFleetInput}) {
  const fuelT = (input.kmPerDay*input.fuelPer100km/100)*1.15;
  const addDriver = ()=>setDrivers([...drivers,{name:`Driver ${drivers.length+1}`,deliveriesPerDay:input.deliveriesPerVanPerDay,kmPerDay:input.kmPerDay,fuelActual:fuelT,attendance:95}]);
  const remDriver = (i:number)=>{if(drivers.length<=1)return;setDrivers(drivers.filter((_,idx)=>idx!==i));};
  const updD = (i:number,k:keyof DriverData,v:string|number)=>{const dd=[...drivers];dd[i]={...dd[i],[k]:v};setDrivers(dd);};

  return <div className="space-y-3">
    <div className="grid grid-cols-3 gap-3">
      {drivers.map((d,i)=>{
        const score = driverScore(d,input.deliveriesPerVanPerDay,fuelT);
        const badge=score>=85?{color:'#22c55e',bg:'#22c55e20',text:'Bonus Eligible'}:score>=70?{color:'#f97316',bg:'#f9731620',text:'Monitor'}:{color:'#ef4444',bg:'#ef444420',text:'Intervention'};
        const missedDel = Math.max(0,input.deliveriesPerVanPerDay-d.deliveriesPerDay)*input.revenuePerDelivery*input.workingDays;
        const excessFuel = Math.max(0,d.fuelActual-fuelT)*input.workingDays*input.fuelPriceLiter;
        return <div key={i} className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <input value={d.name} onChange={e=>updD(i,'name',e.target.value)} className="bg-transparent text-xs font-semibold text-[#e4e4e7] w-24 focus:outline-none border-b border-transparent focus:border-[#3b82f6]"/>
              <button onClick={()=>remDriver(i)} className="text-[#52525b] hover:text-[#ef4444] transition-colors"><XCircle className="w-3 h-3"/></button>
            </div>
            <span className="text-[9px] px-2 py-0.5 rounded-full font-mono-data font-bold" style={{color:badge.color,backgroundColor:badge.bg}}>{score}</span>
          </div>
          <div className="space-y-1">
            {[['Del/day',d.deliveriesPerDay,input.deliveriesPerVanPerDay,'',true],
              ['KM/day',d.kmPerDay,input.kmPerDay,'km',false],
              ['Fuel/day',d.fuelActual,fuelT,'L',false],
              ['Attend%',d.attendance,95,'%',true]].map(([l,v,t,u,hi],j)=>(
              <div key={j} className="flex items-center justify-between text-[10px]"><span className="text-[#71717a]">{l}</span>
                <div className="flex items-center gap-1"><input type="number" value={Number(v)} onChange={e=>{const n=parseFloat(e.target.value);if(!isNaN(n))updD(i,l==='Del/day'?'deliveriesPerDay':l==='KM/day'?'kmPerDay':l==='Fuel/day'?'fuelActual':'attendance',n);}} step={u==='%'?1:0.5}
                  className="w-12 bg-[#0a0a0b] border border-[#2a2a33] rounded px-1 py-0.5 font-mono-data text-[#e4e4e7] text-right focus:border-[#3b82f6] focus:outline-none"/><span className="text-[#52525b] w-6">{u}</span>
                <span className={`text-[9px] ${hi?Number(v)>=Number(t):Number(v)<=Number(t)?'text-[#22c55e]':'text-[#ef4444]'}`}>{hi?Number(v)>=Number(t):Number(v)<=Number(t)?'✓':'↓'}</span></div>
              </div>))}
          </div>
          <div className="flex items-center justify-between mt-1.5"><span className="text-[9px] px-1.5 py-0.5 rounded" style={{color:badge.color,backgroundColor:badge.bg}}>{badge.text}</span></div>
          {score<70 && <div className="mt-2 p-2 bg-[#ef4444]/10 rounded border border-[#ef4444]/20 text-[9px] text-[#ef4444]">
            {d.deliveriesPerDay<input.deliveriesPerVanPerDay&&<div>• Missed deliveries: SAR {Math.round(missedDel)}/mo</div>}
            {d.fuelActual>fuelT&&<div>• Excess fuel: SAR {Math.round(excessFuel)}/mo</div>}
            {d.attendance<90&&<div>• Low attendance: {d.attendance}%</div>}
            <div className="mt-1 font-mono-data font-bold">Cost: SAR {Math.round(missedDel+excessFuel)}/mo</div>
          </div>}
        </div>;
      })}
    </div>
    <button onClick={addDriver} className="w-full py-2 border border-dashed border-[#2a2a33] rounded-lg text-xs text-[#71717a] hover:text-[#a1a1aa] transition-colors">+ Add Driver</button>
  </div>;
}

// ─── TAB 6: MONTE CARLO ───
const HIST_W = 400, HIST_H = 100;
function MonteCarloTab({mcRuns,setMcRuns,runMC,mcRunning,mcResult,costs}:{mcRuns:number;setMcRuns:(n:number)=>void;runMC:()=>void;mcRunning:boolean;mcResult:MCResult|null;costs:RentedFleetOutput}) {
  const riskNum=mcResult?parseFloat(mcResult.risk):0;
  const riskColor=riskNum>50?'#ef4444':riskNum>25?'#f97316':'#22c55e';

  return <div className="space-y-3">
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1"><Activity className="w-4 h-4 text-[#3b82f6]"/><h3 className="text-sm font-semibold text-[#e4e4e7]">Monte Carlo Simulation</h3></div>
      <p className="text-[11px] text-[#a1a1aa] leading-relaxed">We generate thousands of scenarios by randomly varying demand (−15% to +15%), costs (−5% to +10%), and fuel prices (−10% to +15%). Each scenario produces a profit/loss outcome. The distribution tells you the probability of losing money and the range of possible results.</p>
    </div>
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] text-[#71717a]">Simulations:</span>
      {[500,1000,5000].map(n=><button key={n} onClick={()=>setMcRuns(n)} className={`px-2.5 py-1 rounded text-[11px] border transition-all ${mcRuns===n?'bg-[#3b82f6]/20 border-[#3b82f6] text-[#3b82f6]':'border-[#2a2a33] text-[#71717a] hover:text-[#a1a1aa]'}`}>{n.toLocaleString()}</button>)}
      <button onClick={runMC} disabled={mcRunning} className={`px-3 py-1 rounded text-[11px] font-medium ${mcRunning?'bg-[#2a2a33] text-[#52525b]':'bg-[#3b82f6] text-white hover:bg-[#2563eb]'}`}>{mcRunning?'Running...':'Run Simulation ↗'}</button>
    </div>
    {mcResult && <>
      <div className="grid grid-cols-4 gap-3">
        <KPI label="Loss Risk" value={`${mcResult.risk}%`} sub={riskNum>50?'High risk':riskNum>25?'Moderate risk':'Low risk'} accent={riskColor}/>
        <KPI label="P10 (Worst)" value={`SAR ${(mcResult.p10/1000).toFixed(1)}K`} sub="10th percentile" accent={mcResult.p10<0?'#ef4444':'#22c55e'}/>
        <KPI label="P50 (Median)" value={`SAR ${(mcResult.p50/1000).toFixed(1)}K`} sub="50th percentile"/>
        <KPI label="P90 (Best)" value={`SAR ${(mcResult.p90/1000).toFixed(1)}K`} sub="90th percentile" accent="#22c55e"/>
      </div>
      {/* Histogram */}
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
        <h3 className="text-[10px] text-[#a1a1aa] mb-2">Profit Distribution — {mcRuns.toLocaleString()} scenarios</h3>
        <svg viewBox={`0 0 ${HIST_W} ${HIST_H}`} className="w-full h-24">
          {mcResult.buckets.map((count,i)=>{
            const bucketMid=mcResult.min+(i+0.5)*((mcResult.max-mcResult.min)/20);
            const isLoss=bucketMid<0; const maxC=Math.max(...mcResult.buckets);
            const h=Math.max(2,(count/maxC)*96);
            return <rect key={i} x={i*20} y={HIST_H-h} width={19} height={h} fill={isLoss?'#ef4444':'#22c55e'} opacity={0.75} rx={1}/>;
          })}
          <line x1={mcResult.p50<mcResult.min?0:((mcResult.p50-mcResult.min)/(mcResult.max-mcResult.min))*HIST_W} y1={0}
            x2={((mcResult.p50-mcResult.min)/(mcResult.max-mcResult.min))*HIST_W} y2={HIST_H} stroke="#fff" strokeWidth={1} strokeDasharray="3,3"/>
        </svg>
        <div className="flex justify-between text-[9px] text-[#52525b] mt-1"><span>SAR {(mcResult.min/1000).toFixed(0)}K</span><span>SAR 0</span><span>SAR {(mcResult.max/1000).toFixed(0)}K</span></div>
      </div>
      {/* Risk Assessment */}
      <div className={`rounded-lg p-3 ${riskNum>50?'bg-[#ef4444]/10 border border-[#ef4444]/20':riskNum>25?'bg-[#f97316]/10 border border-[#f97316]/20':'bg-[#22c55e]/10 border border-[#22c55e]/20'}`}>
        <h3 className={`text-xs font-semibold mb-1`} style={{color:riskColor}}>Risk Assessment: {riskNum>50?'High Risk':riskNum>25?'Moderate Risk':'Low Risk'}</h3>
        <p className="text-[10px] text-[#a1a1aa]">{riskNum>50?'More than half of scenarios show a loss — immediate action required.':riskNum>25?'Significant probability of losses — hedging recommended.':'Most scenarios profitable — proceed with confidence.'}</p>
      </div>
      {/* Levers */}
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
        <h3 className="text-xs font-semibold text-[#e4e4e7] mb-2 flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-[#a855f7]"/>Top 5 Risk Levers (ranked by SAR impact)</h3>
        <div className="space-y-1.5">
          {[['Increase deliveries/van/day by 5',`+SAR ${Math.round(costs.activeVans*5*costs.costPerDel*1.2*22)}/mo`,'High'],
            [`Raise revenue/del to SAR ${(costs.costPerDel+3).toFixed(0)}`,`+${Math.round(3*costs.delPerMonth/1000)}K SAR`,'High'],
            ['Push utilization to 95%+',`+SAR ${Math.round(costs.activeVans*0.08*costs.revenue/costs.activeVans)}/mo`,'Medium'],
            ['Reduce admin overhead 15%',`Save SAR ${Math.round(costs.totalFixed*0.15)}/mo`,'Medium'],
            ['Optimize routes −5% fuel',`Save SAR ${Math.round(costs.fuelPerVan*costs.activeVans*0.05)}/mo`,'Medium'],
          ].map((l,i)=><div key={i} className="flex items-center justify-between text-[11px] py-1 border-b border-[#2a2a33]/30 last:border-0">
            <span className="text-[#a1a1aa]"><span className="font-mono-data text-[#71717a] mr-1">#{i+1}</span>{l[0]}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium font-mono-data ${l[2]==='High'?'bg-[#ef4444]/20 text-[#ef4444]':'bg-[#f97316]/20 text-[#f97316]'}`}>{l[1]}</span>
          </div>)}
        </div>
      </div>
    </>}
  </div>;
}

// ─── TAB 7: INVESTOR VIEW ───
function InvestorTab({costs,input,isProfitable,invQA,setInvQA}:{costs:RentedFleetOutput;input:RentedFleetInput;isProfitable:boolean;invQA:string;setInvQA:(v:string)=>void}) {
  const revPerVan = costs.revenue/costs.activeVans;
  const irrVerdict=costs.annualROI>=25?'Exceeds benchmark':costs.annualROI>=15?'Approaching benchmark':'Below benchmark';
  const irrGap = costs.annualROI<25?Math.round(costs.setupCost*0.25/12-costs.profit):0;
  const qas = [
    {q:'What is the payback period?',a:`Setup capital of SAR ${(costs.setupCost/1000).toFixed(0)}K is recovered in ${costs.paybackMonths} months at current profit levels. ${Number(costs.paybackMonths)<12?'This is strong — under 12 months is ideal.':'Consider optimizing for faster payback.'}`},
    {q:'How does the rental model compare to owning vans?',a:`At SAR ${input.vanRentPerMonth}/van/month, renting avoids SAR 95K/van upfront purchase and eliminates depreciation/insurance risk. Total annual fleet rent: SAR ${(input.vanRentPerMonth*input.fleetSize*12/1000).toFixed(0)}K vs ~SAR ${Math.round(input.fleetSize*95*0.25)}K/yr depreciation on owned fleet.`},
    {q:'What are the key risks?',a:`Primary risks: fuel price volatility (at SAR ${input.fuelPriceLiter}/L), delivery volume drop, and driver turnover. Monte Carlo shows ${costs.annualROI>0?'profitable trajectory':'concerning risk profile'} — re-run for detailed loss probability.`},
    {q:'What is the EBITDA margin?',a:`EBITDA margin of ${costs.ebitdaMargin.toFixed(1)}% ${costs.ebitdaMargin>=8?'meets the 8-15% target for logistics operations.':costs.ebitdaMargin>=5?'is approaching target — aim for 8%+.':'is below the 8% target — focus on cost reduction.'}`},
    {q:'Why break-even matters for investors?',a:`At ${Math.round(costs.breakEvenDel)} deliveries/day break-even, you need only ${Math.round(costs.breakEvenDel)} daily orders to cover all costs. Every additional delivery is pure profit at SAR ${(input.revenuePerDelivery-costs.costPerDel).toFixed(2)}/del. Current volume: ${costs.delPerDay} deliveries/day.`},
  ];

  return <div className="space-y-3">
    <div className="grid grid-cols-4 gap-3">
      <KPI label="EBITDA Margin" value={`${costs.ebitdaMargin.toFixed(1)}%`} sub="Benchmark: 8-15%" accent={costs.ebitdaMargin>=8?'#22c55e':costs.ebitdaMargin>=5?'#f97316':'#ef4444'}/>
      <KPI label="Payback Period" value={`${costs.paybackMonths} mo`} sub={costs.paybackMonths==='—'?'N/A':Number(costs.paybackMonths)<12?'Strong <12mo':'Acceptable'} accent={costs.paybackMonths==='—'?'#ef4444':Number(costs.paybackMonths)<12?'#22c55e':'#f97316'}/>
      <KPI label="Annual ROI" value={`${costs.annualROI.toFixed(1)}%`} sub="Benchmark: ≥25%" accent={costs.annualROI>=25?'#22c55e':costs.annualROI>=15?'#f97316':'#ef4444'}/>
      <KPI label="Cost/Delivery" value={`SAR ${costs.costPerDel.toFixed(2)}`} sub={`Revenue: SAR ${input.revenuePerDelivery}`} accent={costs.costPerDel<=input.revenuePerDelivery?'#22c55e':'#ef4444'}/>
    </div>
    <div className="grid grid-cols-3 gap-3">
      <Metric label="Revenue/Van/Month" value={`SAR ${(revPerVan/1000).toFixed(1)}K`}/>
      <Metric label="Contribution/Van/Month" value={`SAR ${(costs.monthlyContribPerVan/1000).toFixed(1)}K`} accent={costs.monthlyContribPerVan>0?'#22c55e':'#ef4444'}/>
      <Metric label="Fleet Revenue" value={`SAR ${(costs.revenue/1000).toFixed(1)}K/mo`}/>
      <Metric label="Fleet Profit" value={`SAR ${(costs.profit/1000).toFixed(1)}K/mo`} accent={isProfitable?'#22c55e':'#ef4444'}/>
      <Metric label="Break-Even" value={`${Math.round(costs.breakEvenDel)}/day`} sub={`Current: ${costs.delPerDay}/day`}/>
      <Metric label="Setup Capital" value={`SAR ${(costs.setupCost/1000).toFixed(0)}K`} sub="2mo rent + deposit"/>
    </div>
    {/* IRR Section */}
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
      <h3 className="text-xs font-semibold text-[#e4e4e7] mb-2 flex items-center gap-2"><Target className="w-3.5 h-3.5 text-[#eab308]"/>IRR Estimate</h3>
      <p className="text-[11px] text-[#a1a1aa] leading-relaxed">Annualised return on <span className="font-mono-data text-[#e4e4e7]">SAR {(costs.setupCost/1000).toFixed(0)}K</span> setup capital is <span className={`font-mono-data font-bold ${costs.annualROI>=25?'text-[#22c55e]':'text-[#f97316]'}`}>{costs.annualROI.toFixed(1)}%</span> — {irrVerdict} of 25% target. Based on {costs.activeVans} rental vans at {costs.margin.toFixed(1)}% net margin. {costs.annualROI<25?`Gap to 25%: SAR ${irrGap.toLocaleString()}/mo additional profit needed.`:''}</p>
    </div>
    {/* Investor Q&A */}
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
      <h3 className="text-xs font-semibold text-[#e4e4e7] mb-2">Investor Q&A</h3>
      <div className="space-y-1.5">
        {qas.map((qa,i)=><button key={i} onClick={()=>setInvQA(invQA===`q${i}`?'':`q${i}`)}
          className="w-full text-left bg-[#0a0a0b] hover:bg-[#111114] border border-[#2a2a33] rounded px-3 py-2 text-[11px] text-[#a1a1aa] transition-colors">
          <div className="flex items-center justify-between"><span>{qa.q}</span>{invQA===`q${i}`?<ChevronDown className="w-3 h-3"/>:<ChevronRight className="w-3 h-3"/>}</div>
          {invQA===`q${i}` && <div className="mt-2 pt-2 border-t border-[#2a2a33] text-[#a1a1aa] leading-relaxed">{qa.a}</div>}
        </button>)}
      </div>
    </div>
  </div>;
}

// ─── TAB 8: ASK AUTOCLAW ───
function AskTab({askQ,setAskQ,recs,setRecs,costs,input}:{askQ:string;setAskQ:(v:string)=>void;recs:any[];setRecs:(r:any[])=>void;costs:RentedFleetOutput;input:RentedFleetInput}) {
  const fleetCost = Math.round(costs.totalFixed / 1000);
  const genRecs = ()=>{
    setRecs([
      {title:'Increase deliveries per van/day',detail:`Current ${input.deliveriesPerVanPerDay} — each additional delivery adds SAR ${input.revenuePerDelivery}/van/day. Push to ${Math.min(45,input.deliveriesPerVanPerDay+5)}.`,impact:`+SAR ${Math.round(costs.activeVans*5*input.revenuePerDelivery*22)}/mo`,priority:'High'},
      {title:'Raise revenue per delivery',detail:`Current SAR ${input.revenuePerDelivery}/del. Premium zones can absorb SAR ${(input.revenuePerDelivery+2).toFixed(0)}+.`,impact:`+${Math.round(2*costs.delPerMonth/1000)}K SAR/mo`,priority:'High'},
      {title:'Increase fleet utilization to 95%',detail:`${input.fleetSize-costs.activeVans} idle vans cost SAR ${Math.round(input.vanRentPerMonth*(input.fleetSize-costs.activeVans))}/mo. Activate them.`,impact:`+SAR ${Math.round((input.fleetSize*0.95-input.fleetSize*input.utilization/100)*costs.monthlyContribPerVan)}/mo`,priority:'High'},
      {title:'Reduce admin overhead 10-15%',detail:`Fixed costs of SAR ${fleetCost}K/mo. Consolidate warehouse, automate admin, renegotiate software.`,impact:`Save SAR ${Math.round(costs.totalFixed*0.12)}/mo`,priority:'Medium'},
      {title:'Optimize fuel consumption',detail:`Target 9L/100km (currently ${input.fuelPer100km}). Better routing, driver training.`,impact:`Save SAR ${Math.round(costs.fuelPerVan*costs.activeVans*0.1)}/mo`,priority:'Medium'},
    ]);
  };

  return <div className="space-y-3">
    {/* Context */}
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
      <h3 className="text-[10px] text-[#71717a] uppercase tracking-wider mb-2">Live Context</h3>
      <div className="grid grid-cols-4 gap-3 text-[10px]">
        <div><span className="text-[#52525b]">Fleet:</span> <span className="font-mono-data text-[#e4e4e7]">{input.fleetSize} vans ({costs.activeVans} active)</span></div>
        <div><span className="text-[#52525b]">Revenue:</span> <span className="font-mono-data text-[#e4e4e7]">SAR {(costs.revenue/1000).toFixed(1)}K</span></div>
        <div><span className="text-[#52525b]">Cost:</span> <span className="font-mono-data text-[#e4e4e7]">SAR {(costs.totalCost/1000).toFixed(1)}K</span></div>
        <div><span className="text-[#52525b]">Profit:</span> <span className={`font-mono-data ${costs.profit>=0?'text-[#22c55e]':'text-[#ef4444]'}`}>SAR {(costs.profit/1000).toFixed(1)}K ({costs.margin.toFixed(1)}%)</span></div>
      </div>
    </div>
    {/* Ask Bar */}
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
      <div className="flex gap-2">
        <input value={askQ} onChange={e=>setAskQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&askQ.trim()&&alert('AI features require API key configuration')}
          placeholder="e.g., How can I improve fleet profitability by 20%?" className="flex-1 bg-[#0a0a0b] border border-[#2a2a33] rounded px-3 py-2 text-xs text-[#e4e4e7] focus:border-[#3b82f6] focus:outline-none"/>
        <button onClick={()=>askQ.trim()&&alert('AI features require API key configuration')} className="px-4 py-2 bg-[#3b82f6] text-white rounded text-xs font-medium hover:bg-[#2563eb]">Ask</button>
      </div>
    </div>
    {/* Recommendations */}
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-[#e4e4e7] flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-[#a855f7]"/>Ask Autoclaw Recommendations</h3>
        <button onClick={genRecs} className="px-3 py-1.5 bg-[#a855f7]/20 border border-[#a855f7]/30 text-[#a855f7] rounded text-[11px] hover:bg-[#a855f7]/30 transition-colors">Generate Recommendations</button>
      </div>
      {recs.length===0?<p className="text-xs text-[#71717a]">Click Generate to get data-driven recommendations based on your current fleet configuration.</p>:
      <div className="space-y-2">
        {recs.map((r,i)=><div key={i} className="bg-[#0a0a0b] border border-[#2a2a33] rounded p-2.5">
          <div className="flex items-start justify-between mb-1">
            <span className="text-[11px] font-semibold text-[#e4e4e7]">{r.title}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${r.priority==='High'?'bg-[#ef4444]/20 text-[#ef4444]':r.priority==='Medium'?'bg-[#f97316]/20 text-[#f97316]':'bg-[#22c55e]/20 text-[#22c55e]'}`}>{r.priority}</span>
          </div>
          <p className="text-[10px] text-[#a1a1aa] mb-1">{r.detail}</p>
          <div className="flex items-center gap-2"><span className="text-[9px] text-[#71717a]">Impact:</span><span className="text-[10px] font-mono-data text-[#22c55e] font-bold">{r.impact}</span></div>
        </div>)}
      </div>}
    </div>
  </div>;
}
