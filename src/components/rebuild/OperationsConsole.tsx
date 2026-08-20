'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApp50 } from '@/lib/AppContext50';
import type { JobStatus, VehicleStatus } from '@/lib/types2026';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Battery,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Fuel,
  Gauge,
  LayoutDashboard,
  MapPin,
  Menu,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react';

type ViewId = 'overview' | 'fleet' | 'dispatch' | 'drivers' | 'planning' | 'maintenance' | 'fuel' | 'deliveries' | 'analytics';

type NavItem = {
  id: ViewId;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Command center', description: 'Today at a glance', icon: LayoutDashboard },
  { id: 'fleet', label: 'Live fleet', description: 'Vehicles & locations', icon: Truck },
  { id: 'dispatch', label: 'Dispatch board', description: 'Jobs & routes', icon: ClipboardList },
  { id: 'drivers', label: 'Drivers', description: 'Roster & performance', icon: Users },
  { id: 'planning', label: 'Planning', description: 'Set targets & assumptions', icon: SlidersHorizontal },
  { id: 'maintenance', label: 'Maintenance', description: 'Work orders & uptime', icon: Wrench },
  { id: 'fuel', label: 'Fuel control', description: 'Spend & anomalies', icon: Fuel },
  { id: 'deliveries', label: 'Deliveries', description: 'POD & exceptions', icon: PackageCheck },
  { id: 'analytics', label: 'Reports', description: 'KPI trends', icon: Activity },
];

const STATUS_COLOR: Record<VehicleStatus, string> = {
  moving: '#b8e34b',
  stopped: '#f4b942',
  idle: '#72b6ff',
  offline: '#737b86',
  in_maintenance: '#f28b5d',
};

const JOB_COLOR: Record<JobStatus, string> = {
  unassigned: '#8b929d',
  planned: '#a8b4c4',
  assigned: '#72b6ff',
  en_route: '#b8e34b',
  arrived: '#f4b942',
  delivered: '#8ed17a',
  failed: '#ee6b64',
  rescheduled: '#c5a8e8',
  cancelled: '#5d6672',
};

const VIEW_TITLES: Record<ViewId, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: 'Operations / Riyadh hub', title: 'Command center', description: 'The few signals that need a decision before the next dispatch wave.' },
  fleet: { eyebrow: 'Fleet / Live telemetry', title: 'Live fleet', description: 'A current operating picture for every vehicle, driver and depot.' },
  dispatch: { eyebrow: 'Dispatch / Today', title: 'Dispatch board', description: 'Move work from unassigned to delivered without losing the exception trail.' },
  drivers: { eyebrow: 'People / Driver operations', title: 'Drivers', description: 'Add, edit and activate your roster without leaving the operating picture.' },
  planning: { eyebrow: 'Plan / Operating assumptions', title: 'Planning', description: 'Set the numbers behind tomorrow’s dispatch wave and see the effect immediately.' },
  maintenance: { eyebrow: 'Assets / Reliability', title: 'Maintenance', description: 'Protect uptime by handling the next failure before it becomes a missed delivery.' },
  fuel: { eyebrow: 'Cost / Fuel control', title: 'Fuel control', description: 'Find abnormal fills and make cost per kilometre visible.' },
  deliveries: { eyebrow: 'Customer / Last mile', title: 'Deliveries', description: 'Proof of delivery, failed stops and customer-impacting exceptions.' },
  analytics: { eyebrow: 'Performance / 30 days', title: 'Reports', description: 'Operational trends for the owner, not a wall of decorative charts.' },
};

function money(value: number) {
  return `SAR ${Math.round(value).toLocaleString('en-US')}`;
}

function number(value: number) {
  return Math.round(value).toLocaleString('en-US');
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function timeSince(iso: string, now: number) {
  if (!now) return 'Syncing…';
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  return minutes < 1 ? 'Just now' : `${minutes}m ago`;
}

export default function OperationsConsole() {
  const { auth, snapshot, kpis, dataMode, freshness, plan, updatePlan, addDriver, updateDriver, addJob, updateJob, refresh } = useApp50();
  const [activeView, setActiveView] = useState<ViewId>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(snapshot.vehicles[0]?.id ?? null);
  const [now, setNow] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(0);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      setNow(Date.now());
      setLastRefresh(Date.now());
    }, 0);
    const clock = window.setInterval(() => setNow(Date.now()), 30_000);
    const liveSync = window.setInterval(() => {
      refresh();
      setLastRefresh(Date.now());
    }, 5_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(clock);
      window.clearInterval(liveSync);
    };
  }, [refresh]);

  const activeNav = NAV_ITEMS.find((item) => item.id === activeView) ?? NAV_ITEMS[0];
  const page = VIEW_TITLES[activeView];
  const resolvedSelectedVehicleId = snapshot.vehicles.some((vehicle) => vehicle.id === selectedVehicleId)
    ? selectedVehicleId
    : snapshot.vehicles[0]?.id ?? null;
  const openAlerts = useMemo(() => snapshot.alerts.filter((alert) => alert.status !== 'resolved' && alert.status !== 'dismissed').slice(0, 6), [snapshot.alerts]);
  const failedDeliveries = useMemo(() => snapshot.deliveryExceptions.filter((item) => !item.resolvedAt), [snapshot.deliveryExceptions]);
  const filteredVehicles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return snapshot.vehicles;
    return snapshot.vehicles.filter((vehicle) => `${vehicle.plate} ${vehicle.id} ${vehicle.make} ${vehicle.model}`.toLowerCase().includes(query));
  }, [search, snapshot.vehicles]);

  const selectView = (view: ViewId) => {
    setActiveView(view);
    setMobileNavOpen(false);
  };

  return (
    <div className="ops-app">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      {mobileNavOpen && <button className="ops-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

      <aside className={`ops-sidebar ${mobileNavOpen ? 'ops-sidebar-open' : ''}`} aria-label="Primary navigation">
        <div className="ops-brand">
          <div className="ops-brand-mark" aria-hidden="true"><Truck size={18} strokeWidth={2.4} /></div>
          <div>
            <div className="ops-brand-name">VEGA <span>OS</span></div>
            <div className="ops-brand-sub">Saudi fleet operations</div>
          </div>
          <button className="ops-icon-button ops-mobile-close" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={17} /></button>
        </div>

        <div className="ops-tenant">
          <div className="ops-tenant-avatar">RYD</div>
          <div className="ops-tenant-copy"><strong>Riyadh Central</strong><span>Primary operating hub</span></div>
          <ChevronRight size={15} aria-hidden="true" />
        </div>

        <nav className="ops-nav">
          <div className="ops-nav-label">Workspace</div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeView;
            return (
              <button key={item.id} className={`ops-nav-item ${active ? 'ops-nav-item-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => selectView(item.id)}>
                <Icon size={17} strokeWidth={active ? 2.3 : 1.8} aria-hidden="true" />
                <span><strong>{item.label}</strong><small>{item.description}</small></span>
                {active && <span className="ops-nav-pip" aria-hidden="true" />}
              </button>
            );
          })}
        </nav>

        <div className="ops-sidebar-foot">
          <button className="ops-nav-item ops-nav-item-muted"><ShieldCheck size={17} aria-hidden="true" /><span><strong>System health</strong><small><i className="ops-status-dot" /> All services nominal</small></span></button>
          <div className="ops-user"><div className="ops-user-avatar">{initials(auth.fullName)}</div><div><strong>{auth.fullName}</strong><span>{auth.role.replace('_', ' ')}</span></div><button className="ops-icon-button" aria-label="Open account menu"><ChevronRight size={15} /></button></div>
        </div>
      </aside>

      <div className="ops-main-shell">
        <header className="ops-topbar">
          <div className="ops-topbar-left">
            <button className="ops-icon-button ops-mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
            <div className="ops-breadcrumb"><span>VEGA OS</span><ChevronRight size={14} aria-hidden="true" /><strong>{activeNav.label}</strong></div>
          </div>
          <div className="ops-topbar-actions">
            <div className="ops-live" title={`${freshness.source} · as of ${new Date(freshness.asOf).toLocaleString('en-SA')}`}><i className="ops-status-dot" /> {dataMode === 'simulation' ? 'Simulation · read only' : 'Live sync'} <span>· {freshness.source} · {lastRefresh ? timeSince(new Date(lastRefresh).toISOString(), now) : 'Starting'}</span></div>
            <button className="ops-icon-button" aria-label="Refresh fleet data" onClick={() => { refresh(); setLastRefresh(Date.now()); setNow(Date.now()); }}><RefreshCw size={17} /></button>
            <div className="ops-topbar-divider" />
            <button className="ops-language" aria-label="Current language">EN <span>ع</span></button>
          </div>
        </header>

        <main id="main-content" className="ops-main">
          <div className="ops-page-head">
            <div><div className="ops-eyebrow">{page.eyebrow}</div><h1>{page.title}</h1><p>{page.description}</p></div>
            <div className="ops-page-actions"><label className="ops-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search vehicles</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vehicles, jobs…" /></label><button className="ops-button ops-button-primary" onClick={() => selectView('dispatch')}><Zap size={15} aria-hidden="true" /> Open dispatch board</button></div>
          </div>

          {activeView === 'overview' && <Overview snapshot={snapshot} kpis={kpis} openAlerts={openAlerts} failedDeliveries={failedDeliveries} onVehicleSelect={setSelectedVehicleId} selectedVehicleId={resolvedSelectedVehicleId} now={now} />}
          {activeView === 'fleet' && <FleetView snapshot={snapshot} kpis={kpis} vehicles={filteredVehicles} selectedVehicleId={resolvedSelectedVehicleId} onVehicleSelect={setSelectedVehicleId} />}
          {activeView === 'dispatch' && <DispatchView snapshot={snapshot} onAddJob={addJob} onUpdateJob={updateJob} />}
          {activeView === 'drivers' && <DriversView snapshot={snapshot} onAddDriver={addDriver} onUpdateDriver={updateDriver} />}
          {activeView === 'planning' && <PlanningView plan={plan} onUpdate={updatePlan} />}
          {activeView === 'maintenance' && <MaintenanceView snapshot={snapshot} kpis={kpis} />}
          {activeView === 'fuel' && <FuelView snapshot={snapshot} kpis={kpis} />}
          {activeView === 'deliveries' && <DeliveriesView snapshot={snapshot} failedDeliveries={failedDeliveries} />}
          {activeView === 'analytics' && <AnalyticsView snapshot={snapshot} kpis={kpis} />}
        </main>
      </div>
    </div>
  );
}

function Overview({ snapshot, kpis, openAlerts, failedDeliveries, onVehicleSelect, selectedVehicleId, now }: { snapshot: ReturnType<typeof useApp50>['snapshot']; kpis: ReturnType<typeof useApp50>['kpis']; openAlerts: ReturnType<typeof useApp50>['snapshot']['alerts']; failedDeliveries: ReturnType<typeof useApp50>['snapshot']['deliveryExceptions']; onVehicleSelect: (id: string) => void; selectedVehicleId: string | null; now: number }) {
  return (
    <>
      <div className="ops-kpi-grid">
        <MetricCard label="Fleet moving" value={`${kpis.vehiclesActive}/${kpis.fleetSize}`} meta={`${Math.round(kpis.fleetUtilization)}% utilization`} trend="+4.8%" icon={<Truck size={17} />} tone="lime" />
        <MetricCard label="Delivered today" value={number(kpis.jobsDeliveredToday)} meta={`${kpis.onTimeDeliveryRate}% on time`} trend="+2.1%" icon={<PackageCheck size={17} />} tone="blue" />
        <MetricCard label="Open exceptions" value={number(openAlerts.length + failedDeliveries.length)} meta={`${kpis.criticalAlerts} need action now`} trend="-8.4%" icon={<AlertTriangle size={17} />} tone="orange" />
        <MetricCard label="Fuel this month" value={money(kpis.fuelCostMonth)} meta={`${kpis.avgConsumptionL100km} L / 100 km`} trend="-3.2%" icon={<Fuel size={17} />} tone="violet" />
      </div>

      <div className="ops-content-grid ops-content-grid-main">
        <Panel className="ops-map-panel" title="Operating picture" action={<span className="ops-panel-meta"><i className="ops-status-dot" /> {snapshot.vehicles.length} vehicles tracked</span>}>
          <FleetMap snapshot={snapshot} selectedVehicleId={selectedVehicleId} onVehicleSelect={onVehicleSelect} />
        </Panel>
        <ExceptionPanel alerts={openAlerts} failedDeliveries={failedDeliveries} now={now} />
      </div>

      <div className="ops-content-grid ops-content-grid-lower">
        <DispatchSummary snapshot={snapshot} />
        <Panel title="Fleet pulse" action={<button className="ops-text-button" disabled title="Reports are read-only in simulation">View report <ArrowUpRight size={13} /></button>}>
          <div className="ops-pulse-list">
            <PulseRow label="Drivers on route" value={`${kpis.driversOnRoute} / ${kpis.driversTotal}`} percent={kpis.driversTotal ? (kpis.driversOnRoute / kpis.driversTotal) * 100 : 0} tone="blue" />
            <PulseRow label="Average safety score" value={`${kpis.avgSafetyScore} / 100`} percent={kpis.avgSafetyScore} tone="lime" />
            <PulseRow label="Maintenance uptime" value={`${kpis.fleetSize - kpis.vehiclesInMaintenance} / ${kpis.fleetSize}`} percent={kpis.fleetSize ? ((kpis.fleetSize - kpis.vehiclesInMaintenance) / kpis.fleetSize) * 100 : 0} tone="orange" />
            <PulseRow label="Customer satisfaction" value={`${kpis.customerSatisfaction.toFixed(1)} / 5`} percent={kpis.customerSatisfaction * 20} tone="violet" />
          </div>
        </Panel>
      </div>
    </>
  );
}

function FleetView({ snapshot, kpis, vehicles, selectedVehicleId, onVehicleSelect }: { snapshot: ReturnType<typeof useApp50>['snapshot']; kpis: ReturnType<typeof useApp50>['kpis']; vehicles: ReturnType<typeof useApp50>['snapshot']['vehicles']; selectedVehicleId: string | null; onVehicleSelect: (id: string) => void }) {
  return (
    <div className="ops-stack">
      <div className="ops-kpi-grid ops-kpi-grid-compact"><MetricCard label="Moving" value={kpis.vehiclesActive - kpis.vehiclesIdle} meta="Live now" trend="" icon={<Truck size={17} />} tone="lime" /><MetricCard label="Idle / stopped" value={kpis.vehiclesIdle} meta="Needs utilization" trend="" icon={<Clock3 size={17} />} tone="orange" /><MetricCard label="Offline" value={kpis.vehiclesOffline} meta="Telemetry gap" trend="" icon={<Activity size={17} />} tone="blue" /><MetricCard label="In maintenance" value={kpis.vehiclesInMaintenance} meta="Workshop" trend="" icon={<Wrench size={17} />} tone="violet" /></div>
      <div className="ops-content-grid ops-content-grid-main"><Panel className="ops-map-panel" title="Live vehicle map" action={<span className="ops-panel-meta">Simulation · deterministic refresh every 5s</span>}><FleetMap snapshot={snapshot} selectedVehicleId={selectedVehicleId} onVehicleSelect={onVehicleSelect} /></Panel><VehicleList vehicles={vehicles} selectedVehicleId={selectedVehicleId} onVehicleSelect={onVehicleSelect} /></div>
    </div>
  );
}

function FleetMap({ snapshot, selectedVehicleId, onVehicleSelect }: { snapshot: ReturnType<typeof useApp50>['snapshot']; selectedVehicleId: string | null; onVehicleSelect: (id: string) => void }) {
  const bounds = useMemo(() => {
    const lats = snapshot.vehicles.map((v) => v.lat);
    const lngs = snapshot.vehicles.map((v) => v.lng);
    return { minLat: Math.min(...lats) - 0.18, maxLat: Math.max(...lats) + 0.18, minLng: Math.min(...lngs) - 0.18, maxLng: Math.max(...lngs) + 0.18 };
  }, [snapshot.vehicles]);
  const point = (lat: number, lng: number) => ({ x: ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 1000, y: 560 - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 560 });

  return (
    <div className="ops-map-wrap">
      <svg className="ops-map" viewBox="0 0 1000 560" role="img" aria-label="Live fleet map showing vehicle locations">
        <defs><pattern id="ops-map-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#24303a" strokeWidth="0.8" /></pattern><filter id="ops-map-glow"><feGaussianBlur stdDeviation="5" /></filter></defs>
        <rect width="1000" height="560" fill="url(#ops-map-grid)" />
        <path d="M-40 420 C 170 330, 210 450, 410 330 S 700 170, 1040 245" fill="none" stroke="#2e4850" strokeWidth="17" opacity="0.32" />
        <path d="M-30 420 C 170 330, 210 450, 410 330 S 700 170, 1040 245" fill="none" stroke="#5e7e79" strokeWidth="1.2" opacity="0.45" strokeDasharray="7 10" />
        {snapshot.geofences.slice(0, 5).map((geofence) => { const p = point(geofence.center.lat, geofence.center.lng); return <g key={geofence.id}><circle cx={p.x} cy={p.y} r="28" fill="#b8e34b" fillOpacity="0.04" stroke="#b8e34b" strokeOpacity="0.3" strokeDasharray="3 5" /><text x={p.x} y={p.y + 45} textAnchor="middle" fill="#83909a" fontSize="10" letterSpacing="1">{geofence.name.split(' ').slice(0, 2).join(' ').toUpperCase()}</text></g>; })}
        {snapshot.vehicles.map((vehicle) => { const p = point(vehicle.lat, vehicle.lng); const color = STATUS_COLOR[vehicle.status]; const selected = vehicle.id === selectedVehicleId; return <g key={vehicle.id} transform={`translate(${p.x},${p.y})`} role="button" tabIndex={0} aria-label={`${vehicle.plate}, ${vehicle.status}`} onClick={() => onVehicleSelect(vehicle.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onVehicleSelect(vehicle.id); } }} className="ops-map-vehicle"><circle r={selected ? 17 : 12} fill={color} opacity="0.12" filter="url(#ops-map-glow)" /><circle r={selected ? 8 : 5.5} fill={color} stroke={selected ? '#f8faf7' : '#12202a'} strokeWidth={selected ? 2 : 1.5} /><line x1="0" y1="0" x2={Math.sin(vehicle.heading * Math.PI / 180) * 18} y2={-Math.cos(vehicle.heading * Math.PI / 180) * 18} stroke={color} strokeWidth="2" opacity="0.85" /><title>{vehicle.plate} · {vehicle.status}</title></g>; })}
      </svg>
      <div className="ops-map-legend"><span><i style={{ background: STATUS_COLOR.moving }} /> Moving</span><span><i style={{ background: STATUS_COLOR.idle }} /> Idle</span><span><i style={{ background: STATUS_COLOR.offline }} /> Offline</span></div>
      <div className="ops-map-caption"><MapPin size={13} /> Riyadh operating region <span>·</span> {snapshot.geofences.length} geofences <span>·</span> simulation</div>
    </div>
  );
}

function VehicleList({ vehicles, selectedVehicleId, onVehicleSelect }: { vehicles: ReturnType<typeof useApp50>['snapshot']['vehicles']; selectedVehicleId: string | null; onVehicleSelect: (id: string) => void }) {
  return <Panel title="Vehicles" action={<span className="ops-panel-meta">{vehicles.length} shown</span>}><div className="ops-list ops-vehicle-list">{vehicles.slice(0, 12).map((vehicle) => <button key={vehicle.id} className={`ops-vehicle-row ${vehicle.id === selectedVehicleId ? 'ops-vehicle-row-active' : ''}`} onClick={() => onVehicleSelect(vehicle.id)}><span className="ops-vehicle-status" style={{ background: STATUS_COLOR[vehicle.status] }} /><span className="ops-vehicle-copy"><strong>{vehicle.plate}</strong><small>{vehicle.make} {vehicle.model} · {vehicle.speedKmh} km/h</small></span><span className="ops-vehicle-value">{vehicle.fuelLevelPct}%<small>fuel</small></span></button>)}</div></Panel>;
}

function ExceptionPanel({ alerts, failedDeliveries, now }: { alerts: ReturnType<typeof useApp50>['snapshot']['alerts']; failedDeliveries: ReturnType<typeof useApp50>['snapshot']['deliveryExceptions']; now: number }) {
  return <Panel className="ops-exception-panel" title="Exception queue" action={<span className="ops-count-badge">{alerts.length + failedDeliveries.length}</span>}><div className="ops-list">{alerts.slice(0, 4).map((alert) => <div className="ops-exception" key={alert.id}><span className={`ops-severity ops-severity-${alert.severity}`} /><div><strong>{alert.title}</strong><p>{alert.description}</p><small>{timeSince(alert.timestamp, now)} · {alert.category}</small></div><ChevronRight size={15} aria-hidden="true" /></div>)}{failedDeliveries.slice(0, 2).map((item) => <div className="ops-exception" key={item.id}><span className="ops-severity ops-severity-high" /><div><strong>Delivery exception · {item.code.replaceAll('_', ' ')}</strong><p>{item.note}</p><small>{timeSince(item.reportedAt, now)} · needs resolution</small></div><ChevronRight size={15} aria-hidden="true" /></div>)}{alerts.length === 0 && failedDeliveries.length === 0 && <EmptyState icon={<Check size={18} />} title="No open exceptions" description="The operation is clear for now." />}</div><button className="ops-panel-link" disabled title="Exception commands require a connected backend">Open exception inbox <ArrowUpRight size={14} /></button></Panel>;
}

function DispatchSummary({ snapshot }: { snapshot: ReturnType<typeof useApp50>['snapshot'] }) {
  const lanes: { status: JobStatus; label: string }[] = [{ status: 'unassigned', label: 'Unassigned' }, { status: 'planned', label: 'Planned' }, { status: 'en_route', label: 'On route' }, { status: 'delivered', label: 'Delivered' }];
  return <Panel title="Today’s dispatch" action={<button className="ops-text-button" disabled title="Dispatch commands require a connected backend">Open board <ArrowUpRight size={13} /></button>}><div className="ops-dispatch-lanes">{lanes.map((lane) => { const jobs = snapshot.jobs.filter((job) => job.status === lane.status); return <div className="ops-dispatch-lane" key={lane.status}><div className="ops-lane-head"><span><i style={{ background: JOB_COLOR[lane.status] }} />{lane.label}</span><strong>{jobs.length}</strong></div><div className="ops-lane-stack">{jobs.slice(0, 3).map((job) => <div key={job.id} className="ops-job-chip"><span>{job.ref}</span><small>{job.pieces} pcs · {job.priority}</small></div>)}{jobs.length > 3 && <span className="ops-more">+{jobs.length - 3} more</span>}</div></div>; })}</div></Panel>;
}

function DispatchView({ snapshot, onAddJob, onUpdateJob }: { snapshot: ReturnType<typeof useApp50>['snapshot']; onAddJob: ReturnType<typeof useApp50>['addJob']; onUpdateJob: ReturnType<typeof useApp50>['updateJob'] }) {
  const lanes: { status: JobStatus; label: string; description: string }[] = [{ status: 'unassigned', label: 'Unassigned', description: 'Needs a route' }, { status: 'planned', label: 'Planned', description: 'Ready to assign' }, { status: 'assigned', label: 'Assigned', description: 'Driver confirmed' }, { status: 'en_route', label: 'On route', description: 'In progress' }, { status: 'delivered', label: 'Delivered', description: 'Closed today' }];
  const unassigned = snapshot.jobs.filter((job) => job.status === 'unassigned');
  const optimizeLocal = () => unassigned.slice(0, 3).forEach((job) => onUpdateJob(job.id, { status: 'planned' }));
  return <div className="ops-stack"><div className="ops-toolbar"><div><strong>{snapshot.jobs.length} jobs</strong><span>· {snapshot.routes.length} active routes · local simulation</span></div><div className="ops-toolbar-actions"><button className="ops-button ops-button-secondary" onClick={optimizeLocal} disabled={unassigned.length === 0} title="Moves up to three unassigned jobs to Planned in local simulation"><RefreshCw size={14} /> Plan next jobs</button><button className="ops-button ops-button-primary" onClick={() => onAddJob({ priority: 'normal' })}><Zap size={14} /> New simulated job</button></div></div><div className="ops-dispatch-board">{lanes.map((lane) => <section className="ops-board-lane" key={lane.status}><div className="ops-board-lane-head"><div><strong>{lane.label}</strong><small>{lane.description}</small></div><span>{snapshot.jobs.filter((job) => job.status === lane.status).length}</span></div><div className="ops-board-cards">{snapshot.jobs.filter((job) => job.status === lane.status).slice(0, 8).map((job) => <JobCard key={job.id} job={job} snapshot={snapshot} onUpdate={onUpdateJob} />)}</div></section>)}</div></div>;
}

function JobCard({ job, snapshot, onUpdate }: { job: ReturnType<typeof useApp50>['snapshot']['jobs'][number]; snapshot: ReturnType<typeof useApp50>['snapshot']; onUpdate: ReturnType<typeof useApp50>['updateJob'] }) {
  const customer = snapshot.customers.find((item) => item.id === job.customerId);
  const driver = snapshot.drivers.find((item) => item.id === job.assignedDriverId);
  const nextStatus: Partial<Record<JobStatus, JobStatus>> = { unassigned: 'planned', planned: 'assigned', assigned: 'en_route', en_route: 'delivered' };
  const next = nextStatus[job.status];
  return <article className="ops-job-card"><div className="ops-job-card-top"><strong>{job.ref}</strong><span className={`ops-priority ops-priority-${job.priority}`}>{job.priority}</span></div><h3>{customer?.name ?? 'Unassigned customer'}</h3><div className="ops-job-meta"><span><Clock3 size={12} /> {new Date(job.serviceWindowStart).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span><span><PackageCheck size={12} /> {job.pieces} pieces</span></div><div className="ops-job-card-foot"><span>{driver ? driver.fullName : 'No driver yet'}</span>{next ? <button className="ops-job-advance" onClick={() => onUpdate(job.id, { status: next })}>Move to {next.replace('_', ' ')}</button> : <ChevronRight size={14} />}</div></article>;
}

function DriversView({ snapshot, onAddDriver, onUpdateDriver }: { snapshot: ReturnType<typeof useApp50>['snapshot']; onAddDriver: ReturnType<typeof useApp50>['addDriver']; onUpdateDriver: ReturnType<typeof useApp50>['updateDriver'] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'on_route' | 'off_duty'>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [draft, setDraft] = useState({ fullName: '', phone: '+966 ', iqamaNo: '', licenseNo: '' });
  const active = snapshot.drivers.filter((driver) => driver.status === 'on_route' || driver.status === 'available').length;
  const visibleDrivers = snapshot.drivers.filter((driver) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${driver.fullName} ${driver.phone} ${driver.iqamaNo}`.toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'all' || driver.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const submit = () => {
    if (!draft.fullName.trim()) return;
    onAddDriver(draft);
    setDraft({ fullName: '', phone: '+966 ', iqamaNo: '', licenseNo: '' });
    setIsAddOpen(false);
  };

  return <div className="ops-stack">
    <div className="ops-section-intro"><div><span className="ops-kicker">Roster control</span><h2>People on the road</h2><p>Keep driver identity, availability and compliance details current.</p></div><button className="ops-button ops-button-primary" onClick={() => setIsAddOpen(true)}><Users size={15} /> Add driver</button></div>
    <div className="ops-kpi-grid ops-kpi-grid-compact"><MetricCard label="Total drivers" value={snapshot.drivers.length} meta="Editable roster" trend="" icon={<Users size={17} />} tone="blue" /><MetricCard label="Available / on route" value={active} meta={`${Math.round((active / Math.max(1, snapshot.drivers.length)) * 100)}% active`} trend="" icon={<Truck size={17} />} tone="lime" /><MetricCard label="Safety average" value={Math.round(snapshot.drivers.reduce((sum, driver) => sum + driver.safetyScore, 0) / Math.max(1, snapshot.drivers.length))} meta="Out of 100" trend="" icon={<ShieldCheck size={17} />} tone="violet" /><MetricCard label="Needs coaching" value={snapshot.drivers.filter((driver) => driver.safetyScore < 75).length} meta="Below threshold" trend="" icon={<AlertTriangle size={17} />} tone="orange" /></div>
    <Panel title="Driver roster" action={<span className="ops-panel-meta">{visibleDrivers.length} shown · saved in this browser</span>}>
      <div className="ops-roster-toolbar"><label className="ops-search"><Search size={15} aria-hidden="true" /><span className="sr-only">Search drivers</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, phone or Iqama…" /></label><div className="ops-filter-pills">{(['all', 'available', 'on_route', 'off_duty'] as const).map((status) => <button key={status} className={statusFilter === status ? 'ops-filter-pill-active' : ''} onClick={() => setStatusFilter(status)}>{status.replace('_', ' ')}</button>)}</div></div>
      <div className="ops-table-wrap"><table className="ops-table ops-driver-table"><thead><tr><th>Driver</th><th>Phone / Iqama</th><th>Status</th><th>Safety</th><th>Trips</th><th>Quick edit</th></tr></thead><tbody>{visibleDrivers.slice(0, 80).map((driver) => <tr key={driver.id}><td><div className="ops-person"><span className="ops-person-avatar">{initials(driver.fullName)}</span><span><strong>{driver.fullName}</strong><small>{driver.licenseNo || 'No license number'}</small></span></div></td><td><div className="ops-driver-contact"><input aria-label={`${driver.fullName} phone`} value={driver.phone} onChange={(event) => onUpdateDriver(driver.id, { phone: event.target.value })} /><small>{driver.iqamaNo || 'No Iqama number'}</small></div></td><td><select className="ops-inline-select" aria-label={`${driver.fullName} status`} value={driver.status} onChange={(event) => onUpdateDriver(driver.id, { status: event.target.value as typeof driver.status })}><option value="available">Available</option><option value="on_route">On route</option><option value="on_break">On break</option><option value="off_duty">Off duty</option><option value="suspended">Suspended</option></select></td><td><span className={driver.safetyScore < 75 ? 'ops-number-alert' : 'ops-number-good'}>{driver.safetyScore}</span> / 100</td><td>{number(driver.totalTrips)}</td><td><button className="ops-inline-edit" onClick={() => onUpdateDriver(driver.id, { safetyScore: Math.min(100, driver.safetyScore + 1) })}>+ safety</button></td></tr>)}</tbody></table></div>
      {visibleDrivers.length === 0 && <EmptyState icon={<Users size={18} />} title="No matching drivers" description="Try another search or add a new driver." />}
    </Panel>
    {isAddOpen && <div className="ops-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setIsAddOpen(false); }}><section className="ops-modal" role="dialog" aria-modal="true" aria-labelledby="add-driver-title"><div className="ops-modal-head"><div><span className="ops-kicker">Roster control</span><h2 id="add-driver-title">Add a driver</h2><p>The new record is saved locally as a simulation override.</p></div><button className="ops-icon-button" aria-label="Close add driver form" onClick={() => setIsAddOpen(false)}><X size={17} /></button></div><div className="ops-form-grid"><label><span>Full name</span><input autoFocus value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} placeholder="e.g. Ahmed Al-Rashid" /></label><label><span>Phone</span><input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label><label><span>Iqama number</span><input inputMode="numeric" value={draft.iqamaNo} onChange={(event) => setDraft({ ...draft, iqamaNo: event.target.value })} placeholder="10 digits" /></label><label><span>License number</span><input value={draft.licenseNo} onChange={(event) => setDraft({ ...draft, licenseNo: event.target.value })} placeholder="License reference" /></label></div><div className="ops-modal-foot"><button className="ops-button ops-button-secondary" onClick={() => setIsAddOpen(false)}>Cancel</button><button className="ops-button ops-button-primary" disabled={!draft.fullName.trim()} onClick={submit}>Save driver</button></div></section></div>}
  </div>;
}

function PlanningView({ plan, onUpdate }: { plan: ReturnType<typeof useApp50>['plan']; onUpdate: ReturnType<typeof useApp50>['updatePlan'] }) {
  const monthlyDeliveries = plan.dailyDeliveryTarget * 26;
  const monthlyRevenue = monthlyDeliveries * plan.revenuePerDelivery;
  const estimatedFuel = plan.fleetSize * 180 * 26 / 9.5 * plan.fuelPricePerLiter;
  const coverage = Math.round((plan.activeDriverTarget / Math.max(1, plan.fleetSize)) * 100);
  return <div className="ops-stack"><div className="ops-section-intro"><div><span className="ops-kicker">Simulation controls</span><h2>Set the numbers</h2><p>Adjust the operating assumptions used for this browser-only planning view.</p></div><span className="ops-readonly-chip">Local plan · not live data</span></div><div className="ops-plan-layout"><Panel title="Operating assumptions" action={<span className="ops-panel-meta">26 working days</span>}><div className="ops-number-grid"><PlanNumber label="Fleet size" hint="vehicles" value={plan.fleetSize} min={1} max={50} step={1} onChange={(value) => onUpdate({ fleetSize: value })} /><PlanNumber label="Daily delivery target" hint="stops / day" value={plan.dailyDeliveryTarget} min={0} max={5000} step={10} onChange={(value) => onUpdate({ dailyDeliveryTarget: value })} /><PlanNumber label="Revenue per delivery" hint="SAR / stop" value={plan.revenuePerDelivery} min={0} max={1000} step={0.5} onChange={(value) => onUpdate({ revenuePerDelivery: value })} /><PlanNumber label="Fuel price" hint="SAR / litre" value={plan.fuelPricePerLiter} min={0} max={10} step={0.01} onChange={(value) => onUpdate({ fuelPricePerLiter: value })} /><PlanNumber label="Active driver target" hint="drivers" value={plan.activeDriverTarget} min={0} max={100} step={1} onChange={(value) => onUpdate({ activeDriverTarget: value })} /></div><div className="ops-plan-note"><SlidersHorizontal size={15} /><span>Changing fleet size updates the map and fleet KPIs. Other inputs update the planning estimate below.</span></div></Panel><div className="ops-plan-side"><MetricCard label="Monthly delivery target" value={number(monthlyDeliveries)} meta={`${number(plan.dailyDeliveryTarget)} per working day`} trend="" icon={<PackageCheck size={17} />} tone="blue" /><MetricCard label="Planned revenue" value={money(monthlyRevenue)} meta={`${money(plan.revenuePerDelivery)} per stop`} trend="" icon={<CircleDollarSign size={17} />} tone="lime" /><MetricCard label="Estimated fuel" value={money(estimatedFuel)} meta={`${coverage}% driver coverage`} trend="" icon={<Fuel size={17} />} tone="orange" /></div></div><Panel title="What changes now"><div className="ops-plan-checks"><Outcome label="Fleet capacity" value={`${plan.fleetSize} vehicles`} percent={Math.min(100, plan.fleetSize / 50 * 100)} tone="lime" /><Outcome label="Driver coverage" value={`${plan.activeDriverTarget} target drivers`} percent={Math.min(100, coverage)} tone="blue" /><Outcome label="Daily workload" value={`${number(plan.dailyDeliveryTarget)} stops`} percent={Math.min(100, plan.dailyDeliveryTarget / Math.max(1, plan.fleetSize * 12) * 100)} tone="violet" /></div></Panel></div>;
}

function PlanNumber({ label, hint, value, min, max, step, onChange }: { label: string; hint: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className="ops-plan-number"><span>{label}<small>{hint}</small></span><input type="number" value={value} min={min} max={max} step={step} onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next))); }} /></label>;
}


function MaintenanceView({ snapshot, kpis }: { snapshot: ReturnType<typeof useApp50>['snapshot']; kpis: ReturnType<typeof useApp50>['kpis'] }) {
  const workOrders = snapshot.workOrders.filter((workOrder) => workOrder.status !== 'completed').slice(0, 12);
  return <div className="ops-stack"><div className="ops-kpi-grid ops-kpi-grid-compact"><MetricCard label="Open work orders" value={kpis.openWorkOrders} meta="Across fleet" trend="" icon={<Wrench size={17} />} tone="orange" /><MetricCard label="Overdue" value={kpis.overdueMaintenance} meta="Requires action" trend="" icon={<AlertTriangle size={17} />} tone="red" /><MetricCard label="MTTR" value={`${kpis.fleetMTTR}h`} meta="Mean time to repair" trend="" icon={<Clock3 size={17} />} tone="blue" /><MetricCard label="Parts below reorder" value={snapshot.parts.filter((part) => part.stockQty <= part.reorderLevel).length} meta="Procurement queue" trend="" icon={<PackageCheck size={17} />} tone="violet" /></div><Panel title="Work order queue" action={<button className="ops-button ops-button-secondary" disabled title="Maintenance commands require a connected backend"><Wrench size={14} /> New work order</button>}><div className="ops-work-list">{workOrders.map((workOrder) => <div className="ops-work-row" key={workOrder.id}><div className={`ops-work-icon ops-work-icon-${workOrder.priority}`}><Wrench size={16} /></div><div className="ops-work-copy"><div><strong>{workOrder.title}</strong><StatusLabel label={workOrder.status.replace('_', ' ')} tone={workOrder.priority === 'critical' ? 'red' : workOrder.status === 'in_progress' ? 'blue' : 'muted'} /></div><span>{workOrder.vehicleId} · {workOrder.description}</span></div><div className="ops-work-cost"><strong>{money(workOrder.totalCostSar)}</strong><small>{workOrder.priority} priority</small></div><ChevronRight size={15} aria-hidden="true" /></div>)}</div></Panel></div>;
}

function FuelView({ snapshot, kpis }: { snapshot: ReturnType<typeof useApp50>['snapshot']; kpis: ReturnType<typeof useApp50>['kpis'] }) {
  const maxFuel = Math.max(...snapshot.fuelEvents.slice(0, 10).map((event) => event.costSar), 1);
  return <div className="ops-stack"><div className="ops-kpi-grid ops-kpi-grid-compact"><MetricCard label="Spend · 30 days" value={money(kpis.fuelCostMonth)} meta="Across all vehicles" trend="-3.2%" icon={<CircleDollarSign size={17} />} tone="orange" /><MetricCard label="Average efficiency" value={`${kpis.avgConsumptionL100km} L/100km`} meta="Fleet average" trend="+1.4%" icon={<Gauge size={17} />} tone="lime" /><MetricCard label="Anomalies" value={kpis.fuelAnomalies} meta="Needs review" trend="" icon={<AlertTriangle size={17} />} tone="red" /><MetricCard label="Cards active" value={snapshot.fuelCards.filter((card) => card.status === 'active').length} meta={`${snapshot.fuelCards.length} issued`} trend="" icon={<Battery size={17} />} tone="blue" /></div><div className="ops-content-grid ops-content-grid-main"><Panel title="Recent fuel events" action={<button className="ops-text-button" disabled title="Exports are not enabled for simulation data">Export CSV <ArrowUpRight size={13} /></button>}><div className="ops-fuel-list">{snapshot.fuelEvents.slice(0, 12).map((event) => <div className="ops-fuel-row" key={event.id}><div className={`ops-fuel-mark ${event.isAnomaly ? 'ops-fuel-mark-alert' : ''}`}><Fuel size={15} /></div><div><strong>{event.stationBrand}</strong><small>{event.vehicleId} · {event.source}</small></div><div className="ops-fuel-bar"><span style={{ width: `${Math.min(100, (event.costSar / maxFuel) * 100)}%` }} /></div><div className="ops-fuel-number"><strong>{money(event.costSar)}</strong><small>{event.consumptionLPer100km.toFixed(1)} L/100km</small></div>{event.isAnomaly && <span className="ops-anomaly-label">Review</span>}</div>)}</div></Panel><Panel title="Control notes"><div className="ops-note-stack"><Note icon={<Check size={14} />} tone="lime" title="Card controls nominal" body="No cards exceeded their daily limit in the current period." /><Note icon={<AlertTriangle size={14} />} tone="orange" title={`${kpis.fuelAnomalies} anomaly flags`} body="Review high-consumption events before the next supplier settlement." /><Note icon={<ArrowUpRight size={14} />} tone="blue" title="Target: -8% / km" body="Compare route density before reducing fuel allocation." /></div></Panel></div></div>;
}

function DeliveriesView({ snapshot, failedDeliveries }: { snapshot: ReturnType<typeof useApp50>['snapshot']; failedDeliveries: ReturnType<typeof useApp50>['snapshot']['deliveryExceptions'] }) {
  const deliveries = snapshot.jobs.filter((job) => job.status === 'delivered' || job.status === 'failed').slice(0, 20);
  return <div className="ops-stack"><div className="ops-toolbar"><div><strong>{deliveries.length} closed jobs</strong><span>· {failedDeliveries.length} exceptions open</span></div><button className="ops-button ops-button-secondary" disabled title="Reports are read-only in simulation"><PackageCheck size={14} /> Delivery report</button></div><div className="ops-content-grid ops-content-grid-main"><Panel title="Delivery ledger"><div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Reference</th><th>Customer</th><th>Status</th><th>Service window</th><th>Proof</th></tr></thead><tbody>{deliveries.map((job) => { const customer = snapshot.customers.find((item) => item.id === job.customerId); const pod = snapshot.pods.find((item) => item.jobId === job.id); return <tr key={job.id}><td><strong>{job.ref}</strong></td><td>{customer?.name ?? '—'}</td><td><StatusLabel label={job.status} tone={job.status === 'delivered' ? 'lime' : 'red'} /></td><td>{new Date(job.serviceWindowStart).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} – {new Date(job.serviceWindowEnd).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td><td>{pod ? <span className="ops-proof"><Check size={13} /> POD captured</span> : <span className="ops-number-alert">Missing</span>}</td></tr>; })}</tbody></table></div></Panel><Panel title="Open delivery exceptions" action={<span className="ops-count-badge">{failedDeliveries.length}</span>}><div className="ops-list">{failedDeliveries.slice(0, 8).map((item) => <div className="ops-exception" key={item.id}><span className="ops-severity ops-severity-high" /><div><strong>{item.code.replaceAll('_', ' ')}</strong><p>{item.note}</p><small>{item.jobId} · {item.reportedBy}</small></div></div>)}{failedDeliveries.length === 0 && <EmptyState icon={<Check size={18} />} title="No delivery exceptions" description="Every failed stop has a resolution." />}</div></Panel></div></div>;
}

function AnalyticsView({ snapshot, kpis }: { snapshot: ReturnType<typeof useApp50>['snapshot']; kpis: ReturnType<typeof useApp50>['kpis'] }) {
  const trend = [64, 68, 66, 72, 70, 76, 79, 77, 82, 80, 84, Math.round(kpis.fleetUtilization)];
  const max = Math.max(...trend); const min = Math.min(...trend); const points = trend.map((value, index) => `${(index / (trend.length - 1)) * 100},${82 - ((value - min) / Math.max(1, max - min)) * 64}`).join(' ');
  return <div className="ops-stack"><div className="ops-kpi-grid"><MetricCard label="OTIF" value={`${kpis.onTimeDeliveryRate}%`} meta="Target ≥ 92%" trend="+2.1%" icon={<PackageCheck size={17} />} tone="blue" /><MetricCard label="Safety score" value={kpis.avgSafetyScore} meta="Target ≥ 85" trend="+3.6%" icon={<ShieldCheck size={17} />} tone="lime" /><MetricCard label="MTBF" value={`${kpis.fleetMTBF}d`} meta="Mean time between failures" trend="+5.2%" icon={<Activity size={17} />} tone="violet" /><MetricCard label="Open alerts" value={kpis.openAlerts} meta={`${kpis.criticalAlerts} critical`} trend="-8.4%" icon={<AlertTriangle size={17} />} tone="orange" /></div><div className="ops-content-grid ops-content-grid-main"><Panel title="Fleet utilization · 12-day signal" action={<span className="ops-panel-meta">Target 80%</span>}><div className="ops-chart"><div className="ops-chart-y"><span>90</span><span>80</span><span>70</span><span>60</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Fleet utilization trend"><line x1="0" y1="18" x2="100" y2="18" /><line x1="0" y1="50" x2="100" y2="50" /><line x1="0" y1="82" x2="100" y2="82" /><polyline points={points} /></svg><div className="ops-chart-x"><span>12 days ago</span><span>Today</span></div></div><div className="ops-chart-callout"><strong>{trend[trend.length - 1]}%</strong><span>Current fleet utilization</span><em>+{trend[trend.length - 1] - trend[0]} pts vs. start</em></div></Panel><Panel title="Operating outcomes"><div className="ops-outcome-list"><Outcome label="Vehicles GPS-visible" value={`${kpis.fleetSize - kpis.vehiclesOffline}/${kpis.fleetSize}`} percent={kpis.fleetSize ? ((kpis.fleetSize - kpis.vehiclesOffline) / kpis.fleetSize) * 100 : 0} tone="lime" /><Outcome label="First-attempt delivery" value={`${kpis.firstAttemptRate}%`} percent={kpis.firstAttemptRate} tone="blue" /><Outcome label="Documents current" value={`${snapshot.complianceDocuments.length - kpis.expiredDocuments}/${snapshot.complianceDocuments.length}`} percent={snapshot.complianceDocuments.length ? ((snapshot.complianceDocuments.length - kpis.expiredDocuments) / snapshot.complianceDocuments.length) * 100 : 0} tone="violet" /><Outcome label="Customer satisfaction" value={`${kpis.customerSatisfaction}/5`} percent={kpis.customerSatisfaction * 20} tone="orange" /></div></Panel></div></div>;
}

function MetricCard({ label, value, meta, trend, icon, tone }: { label: string; value: string | number; meta: string; trend: string; icon: React.ReactNode; tone: 'lime' | 'blue' | 'orange' | 'violet' | 'red' }) {
  return <article className={`ops-metric-card ops-tone-${tone}`}><div className="ops-metric-top"><span className="ops-metric-icon">{icon}</span>{trend && <span className="ops-metric-trend">{trend}</span>}</div><div className="ops-metric-label">{label}</div><div className="ops-metric-value">{value}</div><div className="ops-metric-meta">{meta}</div></article>;
}

function Panel({ title, action, children, className = '' }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`ops-panel ${className}`}><div className="ops-panel-head"><h2>{title}</h2>{action}</div>{children}</section>;
}

function PulseRow({ label, value, percent, tone }: { label: string; value: string; percent: number; tone: string }) {
  return <div className="ops-pulse-row"><div><span>{label}</span><strong>{value}</strong></div><div className="ops-progress"><span className={`ops-progress-${tone}`} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div></div>;
}

function Outcome({ label, value, percent, tone }: { label: string; value: string; percent: number; tone: string }) {
  return <div className="ops-outcome"><div><span>{label}</span><strong>{value}</strong></div><div className="ops-progress"><span className={`ops-progress-${tone}`} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div></div>;
}

function StatusLabel({ label, tone }: { label: string; tone: string }) { return <span className={`ops-status-label ops-status-label-${tone}`}><i />{label}</span>; }
function Note({ icon, title, body, tone }: { icon: React.ReactNode; title: string; body: string; tone: string }) { return <div className={`ops-note ops-note-${tone}`}><span>{icon}</span><div><strong>{title}</strong><p>{body}</p></div></div>; }
function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) { return <div className="ops-empty"><span>{icon}</span><strong>{title}</strong><p>{description}</p></div>; }