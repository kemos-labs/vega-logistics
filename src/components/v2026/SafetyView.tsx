'use client';

import { useMemo, useState } from 'react';
import { Section, StatCard, Badge, Panel, PanelTitle } from './Shell';
import { useApp50 } from '@/lib/AppContext50';
import {   Video, Eye } from 'lucide-react';
import { SafetyEvent, SafetyEventSeverity, SafetyEventType } from '@/lib/types2026';

const SEVERITY_COLORS: Record<SafetyEventSeverity, string> = {
  low: '#22c55e',
  medium: '#eab308',
  high: '#f97316',
  critical: '#ef4444',
};

const TYPE_ICON: Record<SafetyEventType, string> = {
  harsh_brake: '🛑',
  harsh_accel: '⚡',
  lane_departure: '↔️',
  tailgating: '🚗',
  distraction: '📱',
  fatigue: '😴',
  speeding: '⏱️',
  phone_use: '📞',
  no_seatbelt: '🔓',
};

export default function SafetyView() {
  const { snapshot } = useApp50();
  const [tab, setTab] = useState<'events' | 'coaching' | 'scorecards'>('events');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(snapshot.safetyEvents[0]?.id ?? null);

  const filtered = useMemo(
    () => snapshot.safetyEvents.filter((e) => severityFilter === 'all' || e.severity === severityFilter),
    [snapshot.safetyEvents, severityFilter]
  );

  const selected = useMemo(() => snapshot.safetyEvents.find((e) => e.id === selectedEventId), [snapshot.safetyEvents, selectedEventId]);

  const criticalCount = snapshot.safetyEvents.filter((e) => e.severity === 'critical').length;
  const reviewedCount = snapshot.safetyEvents.filter((e) => e.reviewed).length;
  const reviewRate = (reviewedCount / snapshot.safetyEvents.length) * 100;
  const coachingCompleted = snapshot.coachingSessions.filter((c) => c.status === 'completed').length;

  return (
    <Section
      title="AI Safety & Driver Monitoring"
      subtitle={`${snapshot.safetyEvents.length} events captured · ${coachingCompleted} coaching sessions completed`}
      actions={
        <div className="flex items-center gap-1 bg-[#18181c] border border-[#2a2a33] rounded p-0.5">
          {(['events', 'coaching', 'scorecards'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`text-[10px] px-3 py-1 rounded capitalize ${tab === t ? 'bg-[#3b82f6] text-white' : 'text-[#a1a1aa] hover:text-[#e4e4e7]'}`}>
              {t}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-5 gap-3 mb-4">
        <StatCard label="Critical Events" value={criticalCount} color={criticalCount > 0 ? '#ef4444' : '#22c55e'} sub="7-day rolling" />
        <StatCard label="Total Events" value={snapshot.safetyEvents.length} color="#3b82f6" sub="Last 7 days" />
        <StatCard label="Reviewed" value={`${Math.round(reviewRate)}%`} color="#22c55e" sub="By managers" />
        <StatCard label="Coaching Done" value={coachingCompleted} color="#a855f7" sub="Completed sessions" />
        <StatCard label="Drivers on Watch" value={snapshot.drivers.filter((d) => d.safetyScore < 80).length} color="#f97316" sub="Score < 80" />
      </div>

      {tab === 'events' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Panel>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider">Dashcam Events</h3>
                <div className="flex gap-1">
                  {['all', 'low', 'medium', 'high', 'critical'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSeverityFilter(s)}
                      className={`text-[9px] px-2 py-0.5 rounded font-mono-data uppercase ${severityFilter === s ? 'bg-[#3b82f6] text-white' : 'bg-[#0a0a0b] text-[#71717a] border border-[#2a2a33]'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5 max-h-[520px] overflow-y-auto">
                {filtered.slice(0, 40).map((e) => (
                  <SafetyEventRow key={e.id} event={e} driver={snapshot.drivers.find((d) => d.id === e.driverId)} selected={e.id === selectedEventId} onClick={() => setSelectedEventId(e.id)} />
                ))}
              </div>
            </Panel>
          </div>
          <div>{selected && <SafetyEventDetail event={selected} driver={snapshot.drivers.find((d) => d.id === selected.driverId)} vehicle={snapshot.vehicles.find((v) => v.id === selected.vehicleId)} />}</div>
        </div>
      )}

      {tab === 'coaching' && (
        <Panel>
          <PanelTitle>Coaching Workflow</PanelTitle>
          <div className="grid grid-cols-2 gap-2 max-h-[540px] overflow-y-auto">
            {snapshot.coachingSessions.map((c) => (
              <div key={c.id} className="p-3 rounded bg-[#0a0a0b] border border-[#2a2a33]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono-data text-[#e4e4e7]">{c.id}</span>
                  <Badge color={c.status === 'completed' ? '#22c55e' : c.status === 'in_progress' ? '#eab308' : c.status === 'cancelled' ? '#ef4444' : '#3b82f6'}>{c.status.replace('_', ' ')}</Badge>
                </div>
                <div className="text-[11px] text-[#e4e4e7] mb-1">{snapshot.drivers.find((d) => d.id === c.driverId)?.fullName ?? c.driverId}</div>
                <div className="text-[10px] text-[#a1a1aa] italic">&quot;{c.notes}&quot;</div>
                <div className="mt-2 space-y-1">
                  {c.actionItems.map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px]">
                      <span className="text-[#a1a1aa] truncate flex-1">{a.description}</span>
                      <span className="ml-2" style={{ color: a.done ? '#22c55e' : '#eab308' }}>{a.done ? '✓' : '○'}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-[#2a2a33] flex items-center justify-between text-[9px]">
                  <span className="text-[#71717a]">Scheduled {new Date(c.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  {c.signedByDriver && <Badge color="#22c55e">Signed</Badge>}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === 'scorecards' && (
        <Panel>
          <PanelTitle>Driver Safety Scorecards (30d)</PanelTitle>
          <div className="grid grid-cols-4 gap-2 max-h-[540px] overflow-y-auto">
            {snapshot.scorecards.slice(0, 20).map((s) => {
              const d = snapshot.drivers.find((dr) => dr.id === s.driverId);
              return (
                <div key={s.driverId} className="p-3 rounded bg-[#0a0a0b] border border-[#2a2a33]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[#e4e4e7] truncate">{d?.fullName ?? s.driverId}</span>
                    <Badge color={s.trend === 'improving' ? '#22c55e' : s.trend === 'declining' ? '#ef4444' : '#eab308'}>{s.trend}</Badge>
                  </div>
                  <div className="text-[24px] font-mono-data font-bold" style={{ color: s.overallScore > 85 ? '#22c55e' : s.overallScore > 70 ? '#eab308' : '#ef4444' }}>{s.overallScore}</div>
                  <div className="text-[9px] text-[#71717a] mb-2">/ 100</div>
                  <div className="space-y-0.5 text-[9px]">
                    {Object.entries(s.components).slice(0, 4).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-[#71717a] capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="font-mono-data" style={{ color: v > 80 ? '#22c55e' : v > 60 ? '#eab308' : '#ef4444' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </Section>
  );
}

function SafetyEventRow({ event, driver, selected, onClick }: { event: SafetyEvent; driver?: { fullName: string }; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full text-left p-2.5 rounded border transition-colors flex items-center gap-3 ${selected ? 'bg-[#1c1c21] border-[#3b82f6]' : 'bg-[#0a0a0b] border-[#2a2a33] hover:border-[#3d3d4a]'}`}>
      <span className="text-xl">{TYPE_ICON[event.type]}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#e4e4e7] capitalize">{event.type.replace('_', ' ')}</span>
          <Badge color={SEVERITY_COLORS[event.severity]}>{event.severity}</Badge>
          {event.reviewed && <Badge color="#22c55e">Reviewed</Badge>}
        </div>
        <div className="text-[9px] text-[#71717a] mt-0.5">
          {driver?.fullName ?? event.driverId} · {event.speedKmh} km/h · {new Date(event.timestamp).toLocaleString('en-US', { hour12: false })}
        </div>
      </div>
      {event.clipUrl && <Video className="w-3.5 h-3.5 text-[#a855f7]" />}
    </button>
  );
}

function SafetyEventDetail({ event, driver, vehicle }: { event: SafetyEvent; driver?: { fullName: string; safetyScore: number; id: string }; vehicle?: { plate: string } }) {
  return (
    <Panel>
      <PanelTitle action={<Badge color={SEVERITY_COLORS[event.severity]}>{event.severity}</Badge>}>
        {event.type.replace('_', ' ')}
      </PanelTitle>
      <div className="space-y-1.5 text-[10px]">
        <Row k="Driver" v={driver?.fullName ?? event.driverId} />
        <Row k="Vehicle" v={vehicle?.plate ?? event.vehicleId} />
        <Row k="Time" v={new Date(event.timestamp).toLocaleString('en-US', { hour12: false })} />
        <Row k="Speed" v={`${event.speedKmh} km/h`} />
        <Row k="G-Force" v={event.gForce?.toFixed(2) ?? '—'} />
        <Row k="Duration" v={`${event.durationS}s`} />
        <Row k="GPS" v={`${event.lat.toFixed(4)}, ${event.lng.toFixed(4)}`} />
        <Row k="Status" v={event.reviewed ? 'Reviewed' : 'Pending review'} />
      </div>
      {event.clipUrl && (
        <div className="mt-3 pt-3 border-t border-[#2a2a33]">
          <div className="text-[9px] text-[#71717a] uppercase mb-1">Dashcam Clip</div>
          <div className="aspect-video bg-[#0a0a0b] border border-[#2a2a33] rounded flex items-center justify-center text-[#52525b]">
            <div className="text-center">
              <Video className="w-8 h-8 mx-auto mb-1" />
              <div className="text-[9px]">20s clip · 720p</div>
            </div>
          </div>
          <button className="mt-2 w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-medium py-1.5 rounded flex items-center justify-center gap-2">
            <Eye className="w-3.5 h-3.5" /> Open Coaching Workflow
          </button>
        </div>
      )}
    </Panel>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-2"><span className="text-[#71717a]">{k}</span><span className="font-mono-data text-[#e4e4e7] text-right truncate">{v}</span></div>;
}
