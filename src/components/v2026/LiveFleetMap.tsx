'use client';

import { useMemo, useState } from 'react';
import { Section, StatCard, Badge, Panel, PanelTitle } from './Shell';
import { useApp50 } from '@/lib/AppContext50';
import {      Search, Eye, EyeOff } from 'lucide-react';
import { Vehicle, VehicleStatus } from '@/lib/types2026';

const SIMULATION_NOW = Date.parse('2026-06-20T00:00:00Z');

const STATUS_COLOR: Record<VehicleStatus, string> = {
  moving: '#22c55e',
  stopped: '#eab308',
  idle: '#3b82f6',
  offline: '#71717a',
  in_maintenance: '#f97316',
};

const STATUS_LABEL: Record<VehicleStatus, string> = {
  moving: 'Moving',
  stopped: 'Stopped',
  idle: 'Idle',
  offline: 'Offline',
  in_maintenance: 'In Maint.',
};

export default function LiveFleetMap() {
  const { snapshot, kpis } = useApp50();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | 'all'>('all');
  const [showGeofences, setShowGeofences] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(snapshot.vehicles[0]?.id ?? null);

  const filtered = useMemo(() => {
    return snapshot.vehicles.filter((v) => {
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      if (search && !v.plate.toLowerCase().includes(search.toLowerCase()) && !v.id.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [snapshot.vehicles, search, statusFilter]);

  const selected = useMemo(() => snapshot.vehicles.find((v) => v.id === selectedId) ?? null, [snapshot.vehicles, selectedId]);

  return (
    <Section
      title="Live Fleet Map"
      subtitle={`${snapshot.vehicles.length} vehicles · ${snapshot.geofences.length} geofences · updates every 5s`}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGeofences(!showGeofences)}
            className="text-[10px] px-2 py-1 rounded bg-[#18181c] border border-[#2a2a33] text-[#a1a1aa] hover:text-[#e4e4e7] flex items-center gap-1"
          >
            {showGeofences ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            Geofences
          </button>
        </div>
      }
    >
      {/* KPI strip */}
      <div className="grid grid-cols-6 gap-3 mb-4">
        <StatCard label="Active" value={kpis.vehiclesActive} color="#22c55e" sub={`${Math.round(kpis.fleetUtilization)}% of fleet`} />
        <StatCard label="Moving" value={snapshot.vehicles.filter((v) => v.status === 'moving').length} color="#22c55e" sub={`avg ${Math.round(kpis.avgSpeedKmh)} km/h`} />
        <StatCard label="Idle/Stopped" value={kpis.vehiclesIdle} color="#eab308" />
        <StatCard label="In Maintenance" value={kpis.vehiclesInMaintenance} color="#f97316" />
        <StatCard label="Offline" value={kpis.vehiclesOffline} color="#ef4444" sub={kpis.vehiclesOffline > 0 ? 'Needs attention' : 'All online'} />
        <StatCard label="Geofence Events 24h" value={snapshot.geofenceEvents.length} color="#3b82f6" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Map visualization */}
        <div className="col-span-2">
          <Panel className="p-0 overflow-hidden">
            <div className="relative" style={{ height: '540px' }}>
              <RiyadhMap
                vehicles={filtered}
                geofences={snapshot.geofences}
                showGeofences={showGeofences}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          </Panel>
        </div>

        {/* Right panel: filters + selected vehicle */}
        <div className="space-y-3">
          <Panel>
            <PanelTitle>Filters</PanelTitle>
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-2 text-[#52525b]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search plate or ID…"
                  className="w-full bg-[#0a0a0b] border border-[#2a2a33] rounded pl-7 pr-2 py-1.5 text-xs text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-[#3b82f6]"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {(['all', 'moving', 'stopped', 'idle', 'in_maintenance', 'offline'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`text-[9px] px-2 py-1 rounded font-mono-data uppercase tracking-wider transition-colors ${
                      statusFilter === s
                        ? 'bg-[#3b82f6] text-white'
                        : 'bg-[#0a0a0b] text-[#71717a] hover:text-[#a1a1aa] border border-[#2a2a33]'
                    }`}
                  >
                    {s === 'all' ? 'All' : STATUS_LABEL[s as VehicleStatus]}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-[10px] text-[#52525b] mt-2">{filtered.length} of {snapshot.vehicles.length} vehicles</div>
          </Panel>

          {selected && <SelectedVehiclePanel vehicle={selected} snapshot={snapshot} />}

          <Panel>
            <PanelTitle>Fleet Composition</PanelTitle>
            <div className="space-y-1.5">
              {Object.entries(snapshot.vehicles.reduce<Record<string, number>>((acc, v) => {
                acc[v.type] = (acc[v.type] ?? 0) + 1;
                return acc;
              }, {})).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between text-[10px]">
                  <span className="text-[#a1a1aa] capitalize">{type.replace('_', ' ')}</span>
                  <span className="font-mono-data text-[#e4e4e7]">{count}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </Section>
  );
}

function SelectedVehiclePanel({ vehicle, snapshot }: { vehicle: Vehicle; snapshot: ReturnType<typeof useApp50>['snapshot'] }) {
  const driver = snapshot.drivers.find((d) => d.id === vehicle.assignedDriverId);
  const recentTrips = snapshot.trips.filter((t) => t.vehicleId === vehicle.id).slice(0, 3);
  const openWO = snapshot.workOrders.filter((w) => w.vehicleId === vehicle.id && w.status !== 'completed').slice(0, 3);

  return (
    <Panel>
      <PanelTitle action={<Badge color={STATUS_COLOR[vehicle.status]}>{STATUS_LABEL[vehicle.status]}</Badge>}>
        {vehicle.plate}
      </PanelTitle>
      <div className="space-y-2 text-[10px]">
        <Row k="Vehicle" v={`${vehicle.make} ${vehicle.model} (${vehicle.year})`} />
        <Row k="ID" v={vehicle.id} />
        <Row k="Type" v={vehicle.type.replace('_', ' ')} />
        <Row k="Driver" v={driver ? driver.fullName : '— Unassigned —'} />
        <Row k="Speed" v={`${vehicle.speedKmh} km/h · ${vehicle.heading}°`} />
        <Row k="Fuel" v={`${vehicle.fuelLevelPct}%`} />
        <Row k="Odometer" v={`${vehicle.odometerKm.toLocaleString()} km`} />
        <Row k="Engine" v={`${vehicle.engineHours.toLocaleString()} h`} />
        <Row k="Last ping" v={`${Math.round((SIMULATION_NOW - Date.parse(vehicle.lastPingAt)) / 60000)}m ago`} />

        <div className="pt-2 mt-2 border-t border-[#2a2a33]">
          <div className="text-[#71717a] text-[9px] uppercase tracking-wider mb-1">Recent Trips</div>
          {recentTrips.length === 0 && <div className="text-[#52525b]">No recent trips</div>}
          {recentTrips.map((t) => (
            <div key={t.id} className="flex justify-between py-0.5">
              <span className="text-[#a1a1aa]">{new Date(t.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              <span className="font-mono-data text-[#3b82f6]">{t.distanceKm} km</span>
            </div>
          ))}
        </div>

        {openWO.length > 0 && (
          <div className="pt-2 mt-2 border-t border-[#2a2a33]">
            <div className="text-[#f97316] text-[9px] uppercase tracking-wider mb-1">Open Work Orders</div>
            {openWO.map((w) => (
              <div key={w.id} className="flex justify-between py-0.5">
                <span className="text-[#a1a1aa] truncate flex-1">{w.title}</span>
                <Badge color={w.priority === 'critical' ? '#ef4444' : w.priority === 'high' ? '#f97316' : '#eab308'}>{w.priority}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[#71717a]">{k}</span>
      <span className="text-[#e4e4e7] font-mono-data text-right truncate">{v}</span>
    </div>
  );
}

// Simple SVG map of Riyadh with vehicle dots
function RiyadhMap({ vehicles, geofences, showGeofences, selectedId, onSelect }: {
  vehicles: Vehicle[];
  geofences: ReturnType<typeof useApp50>['snapshot']['geofences'];
  showGeofences: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  // Bounds: Riyadh metro area
  const minLat = 24.5, maxLat = 24.95, minLng = 46.55, maxLng = 46.85;
  const W = 1000, H = 540;

  function toXY(lat: number, lng: number) {
    const x = ((lng - minLng) / (maxLng - minLng)) * W;
    const y = H - ((lat - minLat) / (maxLat - minLat)) * H;
    return { x, y };
  }

  return (
    <div className="relative w-full h-full bg-[#0a0a0b]">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="w-full h-full">
        {/* Grid */}
        <defs>
          <pattern id="grid50" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#1c1c21" strokeWidth="0.5" />
          </pattern>
          <pattern id="grid200" width="200" height="200" patternUnits="userSpaceOnUse">
            <path d="M 200 0 L 0 0 0 200" fill="none" stroke="#2a2a33" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid50)" />
        <rect width={W} height={H} fill="url(#grid200)" />

        {/* Geofences */}
        {showGeofences && geofences.map((gf) => {
          const c = toXY(gf.center.lat, gf.center.lng);
          const r = (gf.radiusM / 1000 / 111) * ((W / (maxLng - minLng))) * 0.7; // approx km→deg→px
          const color = gf.type === 'depot' ? '#06b6d4' : gf.type === 'service_zone' ? '#3b82f6' : gf.type === 'restricted' ? '#ef4444' : '#a855f7';
          return (
            <g key={gf.id}>
              <circle cx={c.x} cy={c.y} r={Math.max(r, 30)} fill={`${color}11`} stroke={color} strokeWidth="1" strokeDasharray={gf.type === 'restricted' ? '4 4' : 'none'} opacity="0.5" />
              <text x={c.x} y={c.y - r - 4} fill={color} fontSize="9" textAnchor="middle" fontFamily="monospace" opacity="0.7">{gf.name.split(' ').slice(0, 2).join(' ')}</text>
            </g>
          );
        })}

        {/* Vehicles */}
        {vehicles.map((v) => {
          const p = toXY(v.lat, v.lng);
          const color = STATUS_COLOR[v.status];
          const isSelected = v.id === selectedId;
          return (
            <g key={v.id} transform={`translate(${p.x},${p.y})`} onClick={() => onSelect(v.id)} style={{ cursor: 'pointer' }}>
              {v.status === 'moving' && (
                <circle r="8" fill={color} opacity="0.3">
                  <animate attributeName="r" from="8" to="18" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.3" to="0" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle r={isSelected ? 7 : 5} fill={color} stroke={isSelected ? '#fff' : 'transparent'} strokeWidth="1.5" />
              {v.heading !== undefined && v.status === 'moving' && (
                <line x1="0" y1="0" x2={Math.sin((v.heading * Math.PI) / 180) * 12} y2={-Math.cos((v.heading * Math.PI) / 180) * 12} stroke={color} strokeWidth="1.5" />
              )}
              {isSelected && (
                <text y="-12" fontSize="9" fill="#fff" textAnchor="middle" fontFamily="monospace">{v.plate}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="absolute top-2 left-2 bg-[#18181c]/80 backdrop-blur border border-[#2a2a33] rounded px-2 py-1.5 text-[9px] space-y-1">
        <div className="font-mono-data text-[#a1a1aa] uppercase tracking-wider mb-1">Status</div>
        {Object.entries(STATUS_COLOR).map(([k, c]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
            <span className="text-[#a1a1aa]">{STATUS_LABEL[k as VehicleStatus]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
