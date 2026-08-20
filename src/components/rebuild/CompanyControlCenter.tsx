'use client';

import { useMemo, useState } from 'react';
import {
  Activity, ArrowUpRight, BarChart3, Bell, CheckCircle2, ChevronRight, CircleDollarSign,
  ClipboardCheck, Database, Gauge, LayoutDashboard, Menu, RefreshCw, Search, ShieldAlert,
  Target, TrendingDown, Truck, Users, Wrench, X,
} from 'lucide-react';
import { useApp50 } from '@/lib/AppContext50';
import { useSimulatedData } from '@/hooks/useSimulatedData';

type View = 'overview' | 'analysis' | 'risks' | 'followups' | 'data';
type FollowUp = { id: number; title: string; owner: string; due: string; priority: 'critical' | 'high' | 'medium'; done: boolean };

const NAV = [
  { id: 'overview' as const, label: 'Control center', icon: LayoutDashboard },
  { id: 'analysis' as const, label: 'Analysis', icon: BarChart3 },
  { id: 'risks' as const, label: 'Risk register', icon: ShieldAlert },
  { id: 'followups' as const, label: 'Follow-ups', icon: ClipboardCheck },
  { id: 'data' as const, label: 'Data backbone', icon: Database },
];

const INITIAL_FOLLOWUPS: FollowUp[] = [
  { id: 1, title: 'Reprice loss-making customer lanes', owner: 'Commercial', due: 'Today', priority: 'critical', done: false },
  { id: 2, title: 'Resolve overdue maintenance work orders', owner: 'Fleet manager', due: 'Today', priority: 'high', done: false },
  { id: 3, title: 'Validate driver-to-vehicle coverage', owner: 'Operations', due: 'Tomorrow', priority: 'high', done: false },
  { id: 4, title: 'Reconcile fuel anomalies with card statements', owner: 'Finance', due: '22 Aug', priority: 'medium', done: false },
];

const money = (value: number) => `SAR ${Math.round(value).toLocaleString('en-US')}`;

export default function CompanyControlCenter({ onOpenPlanning, onOpenOperations }: { onOpenPlanning: () => void; onOpenOperations: () => void }) {
  const { kpis, freshness, refresh } = useApp50();
  const { financialOutput, financialInput } = useSimulatedData();
  const [view, setView] = useState<View>('overview');
  const [navOpen, setNavOpen] = useState(false);
  const [followUps, setFollowUps] = useState(INITIAL_FOLLOWUPS);

  const risks = useMemo(() => [
    { title: 'Unit economics are below target', signal: `${financialOutput.netMarginPercent.toFixed(1)}% net margin`, impact: money(Math.abs(Math.min(0, financialOutput.netMargin))), severity: 'critical', owner: 'Finance & commercial', action: 'Open planning' },
    { title: 'Fleet capacity is under-covered', signal: `${kpis.driversOnRoute + kpis.driversAvailable} ready drivers / ${kpis.fleetSize} vehicles`, impact: `${Math.max(0, kpis.fleetSize - kpis.driversOnRoute - kpis.driversAvailable)} uncovered`, severity: 'high', owner: 'Operations', action: 'Review roster' },
    { title: 'Maintenance backlog threatens uptime', signal: `${kpis.overdueMaintenance} overdue work orders`, impact: `${kpis.vehiclesInMaintenance} vehicles offline`, severity: kpis.overdueMaintenance > 0 ? 'high' : 'low', owner: 'Fleet manager', action: 'Open operations' },
    { title: 'Fuel exceptions need reconciliation', signal: `${kpis.fuelAnomalies} anomalous fills`, impact: money(kpis.fuelCostMonth), severity: kpis.fuelAnomalies > 2 ? 'high' : 'medium', owner: 'Finance', action: 'Review fuel' },
  ], [financialOutput, kpis]);

  const openTasks = followUps.filter((item) => !item.done).length;
  const sourceRows = [
    ['Operating snapshot', 'Fleet, jobs, alerts, maintenance', 'Simulation API', freshness.mode],
    ['Planning model', 'Revenue, cost, margin, cash runway', 'Local model', 'Editable'],
    ['Risk register', 'Severity, owner, response', 'Derived', 'Live'],
    ['Follow-up log', 'Actions, owners, due dates', 'Browser storage next', 'Prototype'],
  ];

  const select = (next: View) => { setView(next); setNavOpen(false); };

  return (
    <div className="cc-app">
      <a className="cc-skip" href="#company-main">Skip to main content</a>
      {navOpen && <button className="cc-scrim" aria-label="Close navigation" onClick={() => setNavOpen(false)} />}
      <aside className={`cc-sidebar ${navOpen ? 'is-open' : ''}`}>
        <div className="cc-brand"><span className="cc-brand-mark"><Activity size={18} /></span><div><strong>VEGA</strong><small>Company intelligence</small></div><button aria-label="Close navigation" onClick={() => setNavOpen(false)}><X size={17} /></button></div>
        <div className="cc-company"><span>Company workspace</span><strong>Logistics operations</strong><small>Riyadh · Saudi Arabia</small></div>
        <nav aria-label="Company workspace">
          <span className="cc-nav-label">Manage</span>
          {NAV.map((item) => { const Icon = item.icon; return <button key={item.id} aria-current={view === item.id ? 'page' : undefined} className={view === item.id ? 'is-active' : ''} onClick={() => select(item.id)}><Icon size={16} /><span>{item.label}</span>{item.id === 'risks' && <em>{risks.filter(r => r.severity !== 'low').length}</em>}{item.id === 'followups' && <em>{openTasks}</em>}</button>; })}
        </nav>
        <div className="cc-sidebar-foot"><span><i /> Simulation data</span><small>Production connectors are not active</small></div>
      </aside>

      <div className="cc-shell">
        <header className="cc-topbar">
          <button className="cc-menu" aria-label="Open navigation" onClick={() => setNavOpen(true)}><Menu size={19} /></button>
          <div className="cc-search"><Search size={15} /><span>Search company data, risks or actions</span><kbd>⌘ K</kbd></div>
          <div className="cc-top-actions"><button aria-label="Notifications"><Bell size={17} /><i /></button><button onClick={refresh}><RefreshCw size={16} /><span>Refresh data</span></button><span className="cc-avatar">VA</span></div>
        </header>

        <main className="cc-main" id="company-main">
          <div className="cc-page-head"><div><span>Company / {NAV.find(n => n.id === view)?.label}</span><h1>{view === 'overview' ? 'The decisions that need attention now.' : NAV.find(n => n.id === view)?.label}</h1><p>{view === 'overview' ? 'One operating picture for performance, downside risk and accountable follow-through.' : 'Trace every signal back to its source and next owner.'}</p></div><div className="cc-head-actions"><button onClick={onOpenPlanning}>Open planning model</button><button className="primary" onClick={onOpenOperations}>Run operations <ArrowUpRight size={15} /></button></div></div>

          {view === 'overview' && <>
            <section className="cc-health-strip"><div><span className="cc-pulse" /><p><strong>Company health: intervention required</strong><small>Negative modelled margin is the controlling risk. Operational activity alone will not correct it.</small></p></div><button onClick={() => setView('risks')}>Review {risks.length} active risks <ChevronRight size={15} /></button></section>
            <section className="cc-kpis">
              <Metric label="Modelled revenue" value={money(financialOutput.totalRevenue)} note={`${financialOutput.totalMonthlyShipments.toLocaleString()} shipments / month`} icon={CircleDollarSign} tone="green" />
              <Metric label="Net margin" value={`${financialOutput.netMarginPercent.toFixed(1)}%`} note={money(financialOutput.netMargin)} icon={TrendingDown} tone="red" />
              <Metric label="Fleet utilization" value={`${kpis.fleetUtilization.toFixed(0)}%`} note={`${kpis.vehiclesActive} of ${kpis.fleetSize} vehicles active`} icon={Truck} tone="blue" />
              <Metric label="Open follow-ups" value={String(openTasks)} note={`${followUps.filter(i => i.priority === 'critical' && !i.done).length} critical today`} icon={Target} tone="orange" />
            </section>
            <div className="cc-grid cc-grid-main">
              <section className="cc-card cc-performance"><CardHead eyebrow="Performance bridge" title="Where the model breaks" action="Open analysis" onAction={() => setView('analysis')} />
                <div className="cc-bridge"><BridgeRow label="Gross revenue" value={financialOutput.totalRevenue} max={Math.max(financialOutput.totalCost, financialOutput.totalRevenue)} tone="green" /><BridgeRow label="Fleet & delivery cost" value={-financialOutput.fleetMonthlyCost} max={financialOutput.totalCost} tone="orange" /><BridgeRow label="All other operating cost" value={-(financialOutput.totalCost - financialOutput.fleetMonthlyCost)} max={financialOutput.totalCost} tone="muted" /><BridgeRow label="Net result" value={financialOutput.netMargin} max={financialOutput.totalCost} tone="red" /></div>
                <div className="cc-insight"><Gauge size={17} /><p><strong>Management readout</strong><span>Current cost per shipment is {money(financialOutput.costPerShipment)} against average revenue of {money(financialOutput.avgRevenuePerShipment)}. Repricing or structural cost reduction is required before scaling volume.</span></p></div>
              </section>
              <section className="cc-card"><CardHead eyebrow="Risk queue" title="Highest exposure" action="Open register" onAction={() => setView('risks')} /><div className="cc-risk-list">{risks.slice(0,3).map((risk) => <RiskRow key={risk.title} {...risk} />)}</div></section>
            </div>
            <div className="cc-grid cc-grid-lower">
              <section className="cc-card"><CardHead eyebrow="Execution" title="Follow-ups by owner" action="Manage actions" onAction={() => setView('followups')} /><div className="cc-task-list">{followUps.slice(0,3).map(item => <TaskRow key={item.id} item={item} onToggle={() => setFollowUps(current => current.map(row => row.id === item.id ? {...row, done: !row.done} : row))} />)}</div></section>
              <section className="cc-card"><CardHead eyebrow="Operating pulse" title="Today’s control signals" /><div className="cc-signal-grid"><Signal icon={Truck} label="Active fleet" value={`${kpis.vehiclesActive}/${kpis.fleetSize}`} /><Signal icon={Users} label="Drivers available" value={String(kpis.driversAvailable)} /><Signal icon={Wrench} label="Overdue service" value={String(kpis.overdueMaintenance)} /><Signal icon={Activity} label="On-time delivery" value={`${kpis.onTimeDeliveryRate.toFixed(1)}%`} /></div></section>
            </div>
          </>}

          {view === 'analysis' && <section className="cc-card cc-wide"><CardHead eyebrow="Economics" title="Company performance analysis" /><div className="cc-analysis-grid"><AnalysisStat label="Revenue / shipment" value={money(financialOutput.avgRevenuePerShipment)} status="baseline" /><AnalysisStat label="Cost / shipment" value={money(financialOutput.costPerShipment)} status="risk" /><AnalysisStat label="Cash runway" value={`${financialOutput.cashRunway.toFixed(1)} months`} status="risk" /><AnalysisStat label="Payment delay" value={`${financialInput.clientPaymentDelay} days`} status="watch" /></div><div className="cc-narrative"><h2>Decision narrative</h2><p>The planning model is currently structurally loss-making. More delivery volume will only improve the outcome if contribution margin becomes positive first. The next decision should compare customer-level pricing, vehicle utilization and controllable overhead—not add more speculative modules.</p><button onClick={onOpenPlanning}>Test assumptions in planning <ArrowUpRight size={15} /></button></div></section>}
          {view === 'risks' && <section className="cc-card cc-wide"><CardHead eyebrow="Enterprise risk" title="Risk register" /><div className="cc-register-head"><span>Risk</span><span>Signal / exposure</span><span>Accountable owner</span><span>Response</span></div>{risks.map((risk) => <div className="cc-register-row" key={risk.title}><div><i className={`severity-${risk.severity}`} /><strong>{risk.title}</strong><small>{risk.severity} severity</small></div><div><strong>{risk.signal}</strong><small>{risk.impact}</small></div><div><span>{risk.owner}</span></div><button onClick={risk.action === 'Open planning' ? onOpenPlanning : onOpenOperations}>{risk.action}<ArrowUpRight size={13} /></button></div>)}</section>}
          {view === 'followups' && <section className="cc-card cc-wide"><CardHead eyebrow="Accountability" title="Company follow-up log" /><div className="cc-task-list cc-task-full">{followUps.map(item => <TaskRow key={item.id} item={item} onToggle={() => setFollowUps(current => current.map(row => row.id === item.id ? {...row, done: !row.done} : row))} />)}</div></section>}
          {view === 'data' && <section className="cc-card cc-wide"><CardHead eyebrow="Source transparency" title="Data backbone" /><div className="cc-data-note"><Database size={18} /><p><strong>This build is ready for real connectors, but it is not pretending to have them.</strong><span>Every current figure is labelled by source and freshness. Replace the simulation adapters with accounting, CRM, telematics and task-system repositories without changing the management views.</span></p></div><div className="cc-data-table"><div className="head"><span>Dataset</span><span>Coverage</span><span>Current source</span><span>Status</span></div>{sourceRows.map(row => <div key={row[0]}>{row.map(cell => <span key={cell}>{cell}</span>)}</div>)}</div></section>}
        </main>
      </div>
    </div>
  );
}

function Metric({ label, value, note, icon: Icon, tone }: { label:string; value:string; note:string; icon:typeof Activity; tone:string }) { return <article className={`cc-metric tone-${tone}`}><div><span>{label}</span><Icon size={16} /></div><strong>{value}</strong><small>{note}</small></article>; }
function CardHead({ eyebrow, title, action, onAction }: { eyebrow:string; title:string; action?:string; onAction?:()=>void }) { return <div className="cc-card-head"><div><span>{eyebrow}</span><h2>{title}</h2></div>{action && <button onClick={onAction}>{action}<ChevronRight size={14} /></button>}</div>; }
function BridgeRow({ label, value, max, tone }: { label:string; value:number; max:number; tone:string }) { const width = Math.max(4, Math.min(100, Math.abs(value) / Math.max(1,max) * 100)); return <div className="cc-bridge-row"><div><span>{label}</span><strong>{value < 0 ? '−' : ''}{money(Math.abs(value))}</strong></div><div><i className={`tone-${tone}`} style={{width:`${width}%`}} /></div></div>; }
function RiskRow({ title, signal, severity, owner }: { title:string; signal:string; severity:string; owner:string }) { return <div className="cc-risk-row"><i className={`severity-${severity}`} /><div><strong>{title}</strong><span>{signal}</span></div><small>{owner}</small></div>; }
function TaskRow({ item, onToggle }: { item:FollowUp; onToggle:()=>void }) { return <div className={`cc-task-row ${item.done ? 'is-done' : ''}`}><button aria-label={item.done ? `Reopen ${item.title}` : `Complete ${item.title}`} onClick={onToggle}>{item.done ? <CheckCircle2 size={18} /> : <span />}</button><div><strong>{item.title}</strong><span>{item.owner}</span></div><em className={`priority-${item.priority}`}>{item.priority}</em><small>{item.due}</small></div>; }
function Signal({ icon:Icon, label, value }: { icon:typeof Activity; label:string; value:string }) { return <div className="cc-signal"><Icon size={16} /><span>{label}</span><strong>{value}</strong></div>; }
function AnalysisStat({ label, value, status }: { label:string; value:string; status:string }) { return <div className="cc-analysis-stat"><span>{label}</span><strong>{value}</strong><small className={`status-${status}`}>{status}</small></div>; }
