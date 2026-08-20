'use client';

import { useMemo, useState } from 'react';
import { Section, StatCard, Badge, Panel, PanelTitle } from './Shell';
import { useApp50 } from '@/lib/AppContext50';
import {  CheckCircle2, Camera, Signature } from 'lucide-react';
import { POD, DeliveryException } from '@/lib/types2026';

export default function DeliveryView() {
  const { snapshot, kpis } = useApp50();
  const [tab, setTab] = useState<'pods' | 'exceptions' | 'timeline'>('pods');
  const [selectedPodId, setSelectedPodId] = useState<string | null>(snapshot.pods[0]?.id ?? null);
  const selectedPod = useMemo(() => snapshot.pods.find((p) => p.id === selectedPodId), [snapshot.pods, selectedPodId]);

  return (
    <Section
      title="Delivery Management & POD"
      subtitle={`${snapshot.pods.length} PODs · ${snapshot.deliveryExceptions.length} exceptions · ${snapshot.jobs.length} total jobs`}
      actions={
        <div className="flex items-center gap-1 bg-[#18181c] border border-[#2a2a33] rounded p-0.5">
          {(['pods', 'exceptions', 'timeline'] as const).map((t) => (
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
        <StatCard label="Delivered" value={kpis.jobsDeliveredToday} color="#22c55e" sub="Today" />
        <StatCard label="Failed" value={kpis.jobsFailed} color="#ef4444" sub="Need recovery" />
        <StatCard label="On-Time Rate" value={`${kpis.onTimeDeliveryRate}%`} color="#3b82f6" sub="vs target 92%" />
        <StatCard label="First-Attempt" value={`${kpis.firstAttemptRate}%`} color="#22c55e" />
        <StatCard label="PODs Captured" value={snapshot.pods.length} color="#a855f7" sub="With GPS + signature" />
      </div>

      {tab === 'pods' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Panel className="p-0">
              <div className="max-h-[540px] overflow-y-auto">
                {snapshot.pods.slice(0, 30).map((p) => (
                  <PodRow key={p.id} pod={p} job={snapshot.jobs.find((j) => j.id === p.jobId)} stop={snapshot.stops.find((s) => s.id === p.stopId)} selected={p.id === selectedPodId} onClick={() => setSelectedPodId(p.id)} />
                ))}
              </div>
            </Panel>
          </div>
          <div>{selectedPod && <PodDetail pod={selectedPod} job={snapshot.jobs.find((j) => j.id === selectedPod.jobId)} stop={snapshot.stops.find((s) => s.id === selectedPod.stopId)} />}</div>
        </div>
      )}

      {tab === 'exceptions' && (
        <Panel>
          <PanelTitle>Delivery Exceptions</PanelTitle>
          {snapshot.deliveryExceptions.length === 0 ? (
            <div className="text-center text-[10px] text-[#52525b] py-8">No exceptions</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-[540px] overflow-y-auto">
              {snapshot.deliveryExceptions.map((e) => <ExceptionCard key={e.id} exc={e} job={snapshot.jobs.find((j) => j.id === e.jobId)} />)}
            </div>
          )}
        </Panel>
      )}

      {tab === 'timeline' && (
        <Panel>
          <PanelTitle>Delivery Lifecycle (State Machine)</PanelTitle>
          <div className="space-y-2 max-h-[540px] overflow-y-auto">
            {snapshot.jobs.slice(0, 25).map((j) => (
              <div key={j.id} className="p-3 rounded bg-[#0a0a0b] border border-[#2a2a33]">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-[11px] font-mono-data text-[#e4e4e7]">{j.ref}</div>
                    <div className="text-[9px] text-[#71717a]">{snapshot.customers.find((c) => c.id === j.customerId)?.name}</div>
                  </div>
                  <Badge color={j.status === 'delivered' ? '#22c55e' : j.status === 'failed' ? '#ef4444' : '#3b82f6'}>{j.status.replace('_', ' ')}</Badge>
                </div>
                <div className="flex items-center gap-1 text-[9px]">
                  {(['unassigned', 'planned', 'assigned', 'en_route', 'arrived', 'delivered'] as const).map((s, i, arr) => {
                    const currentIdx = arr.indexOf(j.status as typeof arr[number]);
                    const reached = currentIdx >= i;
                    return (
                      <div key={s} className="flex items-center">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: reached ? '#22c55e' : '#2a2a33' }} />
                        <span className="ml-1 capitalize" style={{ color: reached ? '#22c55e' : '#52525b' }}>{s.replace('_', ' ')}</span>
                        {i < arr.length - 1 && <div className="w-6 h-px mx-1" style={{ backgroundColor: reached ? '#22c55e' : '#2a2a33' }} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </Section>
  );
}

function PodRow({ pod, stop, selected, onClick }: { pod: POD; job?: { ref: string }; stop?: { address: string }; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full text-left p-2.5 border-b border-[#2a2a33] hover:bg-[#1c1c21] transition-colors flex items-center gap-3 ${selected ? 'bg-[#1c1c21]' : ''}`}>
      <div className="w-8 h-8 rounded bg-[#22c55e22] flex items-center justify-center flex-shrink-0">
        <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-mono-data text-[#e4e4e7]">{pod.id}</div>
        <div className="text-[9px] text-[#71717a] truncate">{stop?.address ?? '—'}</div>
      </div>
      <div className="text-right">
        <div className="text-[10px] text-[#a1a1aa] font-mono-data">{pod.recipientName}</div>
        <div className="text-[9px] text-[#52525b]">{new Date(pod.capturedAt).toLocaleString('en-US', { hour12: false, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </button>
  );
}

function PodDetail({ pod, job }: { pod: POD; job?: { ref: string }; stop?: { address: string } }) {
  return (
    <Panel>
      <PanelTitle action={<Badge color="#22c55e">Captured</Badge>}>{pod.id}</PanelTitle>
      <div className="space-y-1.5 text-[10px]">
        <Row k="Job" v={job?.ref ?? '—'} />
        <Row k="Recipient" v={pod.recipientName} />
        <Row k="ID Type" v={pod.recipientIdType ?? '—'} />
        <Row k="ID Number" v={pod.recipientIdNumber ?? '—'} />
        <Row k="Captured" v={new Date(pod.capturedAt).toLocaleString('en-US', { hour12: false })} />
        <Row k="GPS" v={`${pod.gpsLat.toFixed(4)}, ${pod.gpsLng.toFixed(4)}`} />
        <Row k="Device" v={pod.deviceId} />
        <Row k="App" v={`v${pod.appVersion}`} />
      </div>

      {pod.notes && (
        <div className="mt-3 pt-3 border-t border-[#2a2a33]">
          <div className="text-[9px] text-[#71717a] uppercase mb-1">Driver Note</div>
          <div className="text-[10px] text-[#a1a1aa] italic">&quot;{pod.notes}&quot;</div>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-[#2a2a33]">
        <div className="text-[9px] text-[#71717a] uppercase mb-2">Captures</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="aspect-video bg-[#0a0a0b] border border-[#2a2a33] rounded flex flex-col items-center justify-center text-[#52525b]">
            <Camera className="w-6 h-6 mb-1" />
            <div className="text-[9px]">Photo {pod.photoUrls.length}</div>
          </div>
          <div className="aspect-video bg-white border border-[#2a2a33] rounded flex items-center justify-center p-2">
            <Signature className="w-12 h-12 text-[#18181c]" />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function ExceptionCard({ exc, job }: { exc: DeliveryException; job?: { ref: string } }) {
  return (
    <div className="p-3 rounded bg-[#0a0a0b] border border-[#ef444433]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono-data text-[#e4e4e7]">{exc.id}</span>
        <Badge color={exc.resolvedAt ? '#22c55e' : '#ef4444'}>{exc.resolvedAt ? 'Resolved' : 'Open'}</Badge>
      </div>
      <div className="text-[10px] text-[#a1a1aa] mb-1">{job?.ref}</div>
      <div className="text-[9px] text-[#71717a] uppercase tracking-wider mb-0.5">Code</div>
      <div className="text-[11px] text-[#ef4444] mb-1 capitalize">{exc.code.replace(/_/g, ' ')}</div>
      <div className="text-[10px] text-[#a1a1aa] italic">&quot;{exc.note}&quot;</div>
      {exc.resolution && (
        <div className="mt-2 pt-2 border-t border-[#2a2a33]">
          <Badge color="#22c55e">{exc.resolution.replace(/_/g, ' ')}</Badge>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-2"><span className="text-[#71717a]">{k}</span><span className="font-mono-data text-[#e4e4e7] text-right truncate">{v}</span></div>;
}
