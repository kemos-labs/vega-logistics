'use client';

import { useMemo, useState } from 'react';
import { Section, StatCard, Badge, Panel, PanelTitle, Bar } from './Shell';
import { useApp50 } from '@/lib/AppContext50';
import { getDriverLeaderboard } from '@/lib/engines/kpi50';
import {       Search, Star, Phone, IdCard, MapPin } from 'lucide-react';
import { Driver, DutyStatus } from '@/lib/types2026';

const STATUS_COLORS: Record<Driver['status'], string> = {
  available: '#22c55e',
  on_route: '#3b82f6',
  on_break: '#eab308',
  off_duty: '#71717a',
  suspended: '#ef4444',
};

const STATUS_LABEL: Record<Driver['status'], string> = {
  available: 'Available',
  on_route: 'On Route',
  on_break: 'On Break',
  off_duty: 'Off Duty',
  suspended: 'Suspended',
};

const DUTY_COLORS: Record<DutyStatus, string> = {
  on_duty: '#eab308',
  driving: '#3b82f6',
  off_duty: '#71717a',
  sleeper_berth: '#a855f7',
};

export default function DriverManagement() {
  const { snapshot, kpis } = useApp50();
  const [tab, setTab] = useState<'roster' | 'leaderboard' | 'dvir' | 'hos'>('roster');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(snapshot.drivers[0]?.id ?? null);

  const filtered = useMemo(
    () => snapshot.drivers.filter((d) => !search || d.fullName.toLowerCase().includes(search.toLowerCase()) || d.id.toLowerCase().includes(search.toLowerCase())),
    [snapshot.drivers, search]
  );
  const leaderboard = useMemo(() => getDriverLeaderboard(snapshot, 12), [snapshot]);
  const selected = useMemo(() => snapshot.drivers.find((d) => d.id === selectedId) ?? null, [snapshot.drivers, selectedId]);
  const dvirReports = useMemo(() => snapshot.dvirReports.filter((d) => d.driverId === selectedId), [snapshot.dvirReports, selectedId]);
  const hosLogs = useMemo(() => snapshot.hosLogs.filter((h) => h.driverId === selectedId), [snapshot.hosLogs, selectedId]);
  const scorecard = useMemo(() => snapshot.scorecards.find((s) => s.driverId === selectedId), [snapshot.scorecards, selectedId]);

  return (
    <Section
      title="Driver Management"
      subtitle="Profiles · HOS · DVIR · performance scorecards · leaderboards"
      actions={
        <div className="flex items-center gap-1 bg-[#18181c] border border-[#2a2a33] rounded p-0.5">
          {(['roster', 'leaderboard', 'dvir', 'hos'] as const).map((t) => (
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
        <StatCard label="Total Drivers" value={kpis.driversTotal} color="#3b82f6" />
        <StatCard label="On Route" value={kpis.driversOnRoute} color="#3b82f6" sub="Active ops" />
        <StatCard label="Available" value={kpis.driversAvailable} color="#22c55e" sub="Ready to assign" />
        <StatCard label="Avg Safety" value={`${kpis.avgSafetyScore}`} color="#22c55e" sub="/ 100" />
        <StatCard label="Avg On-Time" value={`${(kpis.avgOnTimeRate * 100).toFixed(1)}%`} color="#3b82f6" />
      </div>

      {tab === 'roster' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Panel className="p-0">
              <div className="p-3 border-b border-[#2a2a33] flex items-center justify-between">
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3 h-3 absolute left-2 top-2 text-[#52525b]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search drivers…"
                    className="w-full bg-[#0a0a0b] border border-[#2a2a33] rounded pl-7 pr-2 py-1.5 text-xs text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-[#3b82f6]"
                  />
                </div>
                <span className="text-[10px] text-[#52525b] font-mono-data">{filtered.length} drivers</span>
              </div>
              <div className="max-h-[540px] overflow-y-auto">
                {filtered.slice(0, 30).map((d) => (
                  <DriverRow key={d.id} driver={d} selected={d.id === selectedId} onClick={() => setSelectedId(d.id)} />
                ))}
              </div>
            </Panel>
          </div>
          <div>
            {selected && <DriverDetail driver={selected} scorecard={scorecard} complianceDocs={snapshot.complianceDocuments.filter((c) => c.ownerId === selected.id)} />}
          </div>
        </div>
      )}

      {tab === 'leaderboard' && (
        <Panel>
          <PanelTitle action={<Badge color="#22c55e">Top Performers</Badge>}>Driver Leaderboard (Last 30 Days)</PanelTitle>
          <div className="space-y-1">
            {leaderboard.map((d, i) => (
              <div key={d.driverId} className="grid grid-cols-12 gap-2 items-center p-2 rounded bg-[#0a0a0b] border border-[#2a2a33]">
                <div className="col-span-1 text-center">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] mx-auto" style={{ backgroundColor: i === 0 ? '#eab308' : i === 1 ? '#a1a1aa' : i === 2 ? '#f97316' : '#2a2a33', color: i < 3 ? '#000' : '#a1a1aa' }}>{i + 1}</div>
                </div>
                <div className="col-span-3 text-[11px] text-[#e4e4e7] truncate">{d.name}</div>
                <div className="col-span-2">
                  <div className="text-[9px] text-[#71717a] uppercase">Safety</div>
                  <Bar value={d.safetyScore} max={100} color="#22c55e" height={4} />
                  <div className="text-[10px] font-mono-data text-[#22c55e] mt-0.5">{d.safetyScore}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[9px] text-[#71717a] uppercase">On-Time</div>
                  <Bar value={d.onTimeRate} max={100} color="#3b82f6" height={4} />
                  <div className="text-[10px] font-mono-data text-[#3b82f6] mt-0.5">{d.onTimeRate.toFixed(1)}%</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[9px] text-[#71717a] uppercase">Fuel Eff</div>
                  <Bar value={d.fuelEfficiency} max={100} color="#06b6d4" height={4} />
                  <div className="text-[10px] font-mono-data text-[#06b6d4] mt-0.5">{d.fuelEfficiency}</div>
                </div>
                <div className="col-span-1 text-right">
                  <div className="text-[9px] text-[#71717a] uppercase">Score</div>
                  <div className="text-sm font-mono-data font-bold text-[#a855f7]">{d.compositeScore}</div>
                </div>
                <div className="col-span-1 text-right">
                  <div className="text-[9px] text-[#71717a] uppercase">Rating</div>
                  <div className="text-sm font-mono-data text-[#eab308] flex items-center justify-end gap-0.5">
                    <Star className="w-3 h-3 fill-[#eab308]" />
                    {d.rating.toFixed(1)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === 'dvir' && (
        <Panel>
          <PanelTitle>DVIR Inspections {selected && `— ${selected.fullName}`}</PanelTitle>
          {dvirReports.length === 0 ? (
            <div className="text-center text-[10px] text-[#52525b] py-8">No DVIR reports found</div>
          ) : (
            <div className="space-y-2">
              {dvirReports.map((r) => (
                <div key={r.id} className="p-3 rounded bg-[#0a0a0b] border border-[#2a2a33]">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-[11px] font-mono-data text-[#e4e4e7]">{r.id}</span>
                      <span className="ml-2 text-[10px] text-[#71717a]">{r.vehicleId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge color={r.type === 'pre_trip' ? '#3b82f6' : '#a855f7'}>{r.type.replace('_', ' ')}</Badge>
                      <Badge color={r.defects ? '#ef4444' : '#22c55e'}>{r.defects ? 'Defects' : 'Passed'}</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px]">
                    {r.items.map((it) => (
                      <div key={it.name} className="flex items-center justify-between py-0.5">
                        <span className="text-[#a1a1aa]">{it.name}</span>
                        <span style={{ color: it.status === 'ok' ? '#22c55e' : '#ef4444' }}>{it.status === 'ok' ? '✓' : '✗'}</span>
                      </div>
                    ))}
                  </div>
                  {r.defects && <div className="text-[10px] text-[#ef4444] mt-2">⚠ {r.defects}</div>}
                  <div className="text-[9px] text-[#52525b] mt-2 font-mono-data">
                    {new Date(r.completedAt ?? r.startedAt).toLocaleString('en-US', { hour12: false })} · {r.odometerKm.toLocaleString()} km
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {tab === 'hos' && (
        <Panel>
          <PanelTitle>HOS Log {selected && `— ${selected.fullName}`}</PanelTitle>
          {hosLogs.length === 0 ? (
            <div className="text-center text-[10px] text-[#52525b] py-8">No HOS entries</div>
          ) : (
            <div className="space-y-1">
              {hosLogs.map((h) => (
                <div key={h.id} className="flex items-center gap-3 p-2 rounded bg-[#0a0a0b] border border-[#2a2a33]">
                  <Badge color={DUTY_COLORS[h.dutyStatus]}>{h.dutyStatus.replace('_', ' ')}</Badge>
                  <span className="text-[10px] font-mono-data text-[#a1a1aa] flex-1">
                    {new Date(h.timestamp).toLocaleString('en-US', { hour12: false })}
                  </span>
                  <span className="text-[9px] text-[#52525b] font-mono-data">
                    {h.lat.toFixed(3)}, {h.lng.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </Section>
  );
}

function DriverRow({ driver, selected, onClick }: { driver: Driver; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full text-left p-2.5 border-b border-[#2a2a33] hover:bg-[#1c1c21] transition-colors flex items-center gap-3 ${selected ? 'bg-[#1c1c21]' : ''}`}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0" style={{ backgroundColor: driver.photoColor }}>
        {driver.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[#e4e4e7] truncate">{driver.fullName}</span>
          <Badge color={STATUS_COLORS[driver.status]}>{STATUS_LABEL[driver.status]}</Badge>
        </div>
        <div className="text-[9px] text-[#71717a] font-mono-data flex items-center gap-2 mt-0.5">
          <span>{driver.id}</span>
          <span>·</span>
          <span>{driver.depotId}</span>
          <span>·</span>
          <span>Safety {driver.safetyScore}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[10px] font-mono-data text-[#3b82f6]">{driver.totalKmThisMonth.toLocaleString()} km</div>
        <div className="text-[9px] text-[#52525b]">this month</div>
      </div>
    </button>
  );
}

function DriverDetail({ driver, scorecard, complianceDocs }: { driver: Driver; scorecard?: ReturnType<typeof useApp50>['snapshot']['scorecards'][number]; complianceDocs: ReturnType<typeof useApp50>['snapshot']['complianceDocuments'] }) {
  return (
    <Panel>
      <PanelTitle action={<Badge color={STATUS_COLORS[driver.status]}>{STATUS_LABEL[driver.status]}</Badge>}>
        {driver.fullName}
      </PanelTitle>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: driver.photoColor }}>
          {driver.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
        </div>
        <div className="text-[10px] text-[#71717a] space-y-0.5">
          <div className="flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{driver.phone}</div>
          <div className="flex items-center gap-1"><IdCard className="w-2.5 h-2.5" />{driver.iqamaNo}</div>
          <div className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{driver.depotId}</div>
        </div>
      </div>
      <div className="space-y-1.5 text-[10px]">
        <Row k="License" v={`${driver.licenseClass} · exp ${new Date(driver.licenseExpiry).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}`} />
        <Row k="Iqama" v={`exp ${new Date(driver.iqamaExpiry).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}`} />
        <Row k="Current Vehicle" v={driver.currentVehicleId ?? '—'} />
        <Row k="Hire Date" v={new Date(driver.hireDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
      </div>

      <div className="mt-3 pt-3 border-t border-[#2a2a33] space-y-1.5">
        <MetricRow label="Total Trips" value={driver.totalTrips.toLocaleString()} color="#3b82f6" />
        <MetricRow label="This Month" value={`${driver.totalKmThisMonth.toLocaleString()} km · ${driver.totalHoursThisMonth}h`} color="#06b6d4" />
        <MetricRow label="On-Time Rate" value={`${(driver.onTimeRate * 100).toFixed(1)}%`} color="#22c55e" />
        <MetricRow label="Fuel Efficiency" value={`${driver.fuelEfficiencyScore}/100`} color="#a855f7" />
        <MetricRow label="Rating" value={`★ ${driver.rating.toFixed(1)}`} color="#eab308" />
      </div>

      {scorecard && (
        <div className="mt-3 pt-3 border-t border-[#2a2a33]">
          <div className="text-[10px] text-[#71717a] uppercase tracking-wider mb-2">Safety Scorecard (30d)</div>
          <div className="space-y-1">
            {Object.entries(scorecard.components).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-[10px]">
                <span className="text-[#a1a1aa] capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                <div className="flex items-center gap-2">
                  <Bar value={v} max={100} color={v > 80 ? '#22c55e' : v > 60 ? '#eab308' : '#ef4444'} height={3} />
                  <span className="font-mono-data text-[10px] w-8 text-right" style={{ color: v > 80 ? '#22c55e' : v > 60 ? '#eab308' : '#ef4444' }}>{v}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-[#2a2a33]">
        <div className="text-[10px] text-[#71717a] uppercase tracking-wider mb-2">Documents</div>
        <div className="space-y-1">
          {complianceDocs.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-[10px]">
              <span className="text-[#a1a1aa] capitalize">{c.type}</span>
              <Badge color={c.status === 'valid' ? '#22c55e' : c.status === 'expiring_soon' ? '#eab308' : '#ef4444'}>{c.status.replace('_', ' ')}</Badge>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-2"><span className="text-[#71717a]">{k}</span><span className="font-mono-data text-[#e4e4e7] text-right">{v}</span></div>;
}

function MetricRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#71717a]">{label}</span>
      <span className="font-mono-data font-bold" style={{ color }}>{value}</span>
    </div>
  );
}
