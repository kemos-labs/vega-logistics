'use client';

import { useMemo, useState } from 'react';
import { Section, StatCard, Badge, Panel, PanelTitle } from './Shell';
import { useApp50 } from '@/lib/AppContext50';
import { buildDispatchBoard, optimizeRoute, predictETA } from '@/lib/engines/dispatch';
import {   Clock, Package, Search, Zap } from 'lucide-react';
import { Job, JobStatus } from '@/lib/types2026';

const PRIORITY_COLORS: Record<string, string> = {
  low: '#71717a',
  normal: '#3b82f6',
  high: '#f97316',
  urgent: '#ef4444',
};

const COLUMN_DEFS: { key: JobStatus | 'inProgress'; label: string; color: string }[] = [
  { key: 'unassigned', label: 'Unassigned', color: '#71717a' },
  { key: 'planned', label: 'Planned', color: '#3b82f6' },
  { key: 'inProgress', label: 'In Progress', color: '#22c55e' },
  { key: 'delivered', label: 'Delivered', color: '#22c55e' },
  { key: 'failed', label: 'Failed', color: '#ef4444' },
];

export default function DispatchBoard() {
  const { snapshot } = useApp50();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);

  const board = useMemo(() => buildDispatchBoard(snapshot.jobs), [snapshot.jobs]);
  const filtered = (jobs: Job[]) =>
    jobs.filter((j) => !search || j.ref.toLowerCase().includes(search.toLowerCase()) || j.id.includes(search));

  const selected = useMemo(() => snapshot.jobs.find((j) => j.id === selectedId) ?? null, [snapshot.jobs, selectedId]);
  const selectedStops = useMemo(() => (selected ? snapshot.stops.filter((s) => s.jobId === selected.id) : []), [selected, snapshot.stops]);

  const handleOptimize = () => {
    setOptimizing(true);
    setTimeout(() => setOptimizing(false), 1500);
  };

  const optimizationResult = useMemo(() => {
    if (!selected || selectedStops.length < 2) return null;
    const v = snapshot.vehicles.find((vh) => vh.id === selected.assignedVehicleId) ?? snapshot.vehicles[0];
    return optimizeRoute(
      {
        vehicleId: v.id,
        driverId: selected.assignedDriverId ?? 'unassigned',
        stopIds: selectedStops.map((s) => s.id),
        timeWindows: selectedStops.map((s) => ({ stopId: s.id, start: selected.serviceWindowStart, end: selected.serviceWindowEnd })),
        trafficAware: true,
        startDepotId: v.homeDepotId,
      },
      selectedStops,
      v,
      1.15
    );
  }, [selected, selectedStops, snapshot.vehicles]);

  return (
    <Section
      title="Dispatch Board"
      subtitle="Drag-style board · live status · one-click route optimization"
      actions={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-2 text-[#52525b]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ref…"
              className="bg-[#18181c] border border-[#2a2a33] rounded pl-7 pr-2 py-1.5 text-xs text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-[#3b82f6] w-40"
            />
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-5 gap-3 mb-4">
        <StatCard label="Unassigned" value={board.unassigned.length} color="#71717a" sub="Needs planner" />
        <StatCard label="Planned" value={board.planned.length} color="#3b82f6" />
        <StatCard label="In Progress" value={board.inProgress.length} color="#22c55e" sub="Live ops" />
        <StatCard label="Delivered" value={board.delivered.length} color="#22c55e" sub="Today" />
        <StatCard label="Failed" value={board.failed.length} color="#ef4444" sub="Needs recovery" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 grid grid-cols-5 gap-2">
          {COLUMN_DEFS.map((col) => {
            const jobs = col.key === 'inProgress' ? board.inProgress : col.key === 'unassigned' ? board.unassigned : col.key === 'planned' ? board.planned : col.key === 'delivered' ? board.delivered : board.failed;
            const list = filtered(jobs).slice(0, 12);
            return (
              <div key={col.key} className="bg-[#111114] border border-[#2a2a33] rounded-lg p-2" style={{ minHeight: '480px' }}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: col.color }}>{col.label}</span>
                  <span className="text-[9px] font-mono-data text-[#52525b]">{list.length}</span>
                </div>
                <div className="space-y-1.5">
                  {list.length === 0 && <div className="text-[9px] text-[#52525b] text-center py-4">No jobs</div>}
                  {list.map((j) => (
                    <JobCard key={j.id} job={j} customer={snapshot.customers.find((c) => c.id === j.customerId)} selected={selectedId === j.id} onClick={() => setSelectedId(j.id)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: detail + optimizer */}
        <div className="space-y-3">
          {selected ? (
            <>
              <Panel>
                <PanelTitle action={<Badge color={PRIORITY_COLORS[selected.priority]}>{selected.priority}</Badge>}>
                  {selected.ref}
                </PanelTitle>
                <div className="space-y-1.5 text-[10px]">
                  <Row k="Customer" v={snapshot.customers.find((c) => c.id === selected.customerId)?.name ?? '—'} />
                  <Row k="Type" v={selected.type} />
                  <Row k="Status" v={selected.status.replace('_', ' ')} />
                  <Row k="Pieces" v={`${selected.pieces} pcs · ${selected.weightKg} kg`} />
                  <Row k="Window" v={`${new Date(selected.serviceWindowStart).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} – ${new Date(selected.serviceWindowEnd).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`} />
                  <Row k="Vehicle" v={selected.assignedVehicleId ?? '—'} />
                  <Row k="Driver" v={selected.assignedDriverId ?? '—'} />
                  {selected.specialHandling.length > 0 && (
                    <div className="flex gap-1 flex-wrap pt-1">
                      {selected.specialHandling.map((s) => <Badge key={s} color="#a855f7">{s}</Badge>)}
                      {selected.requiresColdChain && <Badge color="#06b6d4">Cold chain</Badge>}
                      {selected.requiresSignature && <Badge color="#22c55e">Signature</Badge>}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleOptimize}
                  disabled={optimizing}
                  className="mt-3 w-full bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-50 text-white text-xs font-medium py-2 rounded flex items-center justify-center gap-2"
                >
                  <Zap className={`w-3.5 h-3.5 ${optimizing ? 'animate-pulse' : ''}`} />
                  {optimizing ? 'Optimizing…' : 'Optimize Route (Traffic-Aware)'}
                </button>
              </Panel>

              {optimizationResult && (
                <Panel>
                  <PanelTitle action={<Badge color="#22c55e">SCORE {optimizationResult.score}</Badge>}>
                    Optimization Result
                  </PanelTitle>
                  <div className="space-y-1 text-[10px]">
                    <Row k="Algorithm" v={optimizationResult.algorithm.replace('_', ' ')} />
                    <Row k="Distance" v={`${optimizationResult.totalDistanceKm} km`} />
                    <Row k="Duration" v={`${optimizationResult.totalDurationMin} min`} />
                    <Row k="Fuel est." v={`${optimizationResult.fuelEstimateL} L`} />
                    <Row k="Cost est." v={`SAR ${optimizationResult.costSar}`} />
                    <Row k="Traffic" v={`×${optimizationResult.trafficFactor}`} />
                    <Row k="Improvement" v={`${optimizationResult.improvementPctVsNaive}%`} positive />
                  </div>
                </Panel>
              )}

              <Panel>
                <PanelTitle>Stops ({selectedStops.length})</PanelTitle>
                <div className="space-y-1.5">
                  {selectedStops.map((s, i) => {
                    const v = snapshot.vehicles.find((vh) => vh.id === selected.assignedVehicleId);
                    const eta = v ? predictETA(v, s.lat, s.lng, 1.15) : null;
                    return (
                      <div key={s.id} className="p-2 rounded bg-[#0a0a0b] border border-[#2a2a33]">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-[#71717a] font-mono-data">#{i + 1}</span>
                          <Badge color={s.type === 'pickup' ? '#3b82f6' : '#22c55e'}>{s.type}</Badge>
                        </div>
                        <div className="text-[11px] text-[#e4e4e7] mt-1 truncate">{s.address}</div>
                        {eta && <div className="text-[9px] text-[#52525b] font-mono-data mt-0.5">ETA: {eta.etaMin} min · {eta.distanceKm} km</div>}
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </>
          ) : (
            <Panel>
              <div className="text-center text-[10px] text-[#52525b] py-8">Select a job to see details</div>
            </Panel>
          )}
        </div>
      </div>
    </Section>
  );
}

function JobCard({ job, customer, selected, onClick }: { job: Job; customer?: { name: string }; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-2 rounded border transition-colors ${
        selected ? 'bg-[#1c1c21] border-[#3b82f6]' : 'bg-[#18181c] border-[#2a2a33] hover:border-[#3d3d4a]'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono-data text-[#e4e4e7] truncate">{job.ref.split('-').pop()}</span>
        <Badge color={PRIORITY_COLORS[job.priority]}>{job.priority[0].toUpperCase()}</Badge>
      </div>
      <div className="text-[10px] text-[#a1a1aa] mt-0.5 truncate">{customer?.name ?? '—'}</div>
      <div className="flex items-center gap-1.5 mt-1 text-[9px] text-[#52525b] font-mono-data">
        <Package className="w-2.5 h-2.5" />
        {job.pieces}
        <Clock className="w-2.5 h-2.5 ml-1" />
        {new Date(job.serviceWindowStart).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </button>
  );
}

function Row({ k, v, positive }: { k: string; v: string; positive?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[#71717a]">{k}</span>
      <span className="font-mono-data text-right" style={{ color: positive ? '#22c55e' : '#e4e4e7' }}>{v}</span>
    </div>
  );
}
