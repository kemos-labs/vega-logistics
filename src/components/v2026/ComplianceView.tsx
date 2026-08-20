'use client';

import { useMemo, useState } from 'react';
import { Section, StatCard, Badge, Panel, PanelTitle } from './Shell';
import { useApp50 } from '@/lib/AppContext50';
import {      Search } from 'lucide-react';
import { ComplianceDocument, ComplianceDocStatus } from '@/lib/types2026';

const SIMULATION_NOW = Date.parse('2026-06-20T00:00:00Z');

const STATUS_COLORS: Record<ComplianceDocStatus, string> = {
  valid: '#22c55e',
  expiring_soon: '#eab308',
  expired: '#ef4444',
  missing: '#71717a',
  pending_review: '#3b82f6',
};

const TYPE_LABEL: Record<ComplianceDocument['type'], string> = {
  license: 'Driving License',
  registration: 'Vehicle Registration',
  insurance: 'Insurance',
  permit: 'Permit',
  iqama: 'Iqama (Residency)',
  medical_certificate: 'Medical Certificate',
  hazmat: 'Hazmat Cert',
  commercial_permit: 'Commercial Permit',
};

const TYPE_ICON: Record<ComplianceDocument['type'], string> = {
  license: '🪪',
  registration: '🚗',
  insurance: '🛡',
  permit: '📋',
  iqama: '🪪',
  medical_certificate: '⚕️',
  hazmat: '☣️',
  commercial_permit: '🏢',
};

export default function ComplianceView() {
  const { snapshot, kpis } = useApp50();
  const [filter, setFilter] = useState<'all' | 'expired' | 'expiring' | 'vehicles' | 'drivers'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return snapshot.complianceDocuments.filter((c) => {
      if (filter === 'expired' && c.status !== 'expired') return false;
      if (filter === 'expiring' && c.status !== 'expiring_soon') return false;
      if (filter === 'vehicles' && c.ownerType !== 'vehicle') return false;
      if (filter === 'drivers' && c.ownerType !== 'driver') return false;
      if (search) {
        const s = search.toLowerCase();
        if (!c.documentNumber.toLowerCase().includes(s) && !c.ownerId.toLowerCase().includes(s) && !c.issuedBy.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [snapshot.complianceDocuments, filter, search]);

  const byType = useMemo(() => {
    const map = new Map<string, { valid: number; expiring: number; expired: number }>();
    snapshot.complianceDocuments.forEach((c) => {
      const cur = map.get(c.type) ?? { valid: 0, expiring: 0, expired: 0 };
      if (c.status === 'valid') cur.valid++;
      else if (c.status === 'expiring_soon') cur.expiring++;
      else if (c.status === 'expired') cur.expired++;
      map.set(c.type, cur);
    });
    return Array.from(map.entries());
  }, [snapshot.complianceDocuments]);

  return (
    <Section
      title="Compliance & Audit"
      subtitle={`${snapshot.complianceDocuments.length} documents · ${snapshot.auditEvents.length} audit events`}
      actions={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-2 text-[#52525b]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search docs…"
              className="bg-[#18181c] border border-[#2a2a33] rounded pl-7 pr-2 py-1.5 text-xs text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-[#3b82f6] w-48"
            />
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-5 gap-3 mb-4">
        <StatCard label="Total Documents" value={snapshot.complianceDocuments.length} color="#3b82f6" />
        <StatCard label="Valid" value={snapshot.complianceDocuments.filter((c) => c.status === 'valid').length} color="#22c55e" />
        <StatCard label="Expiring Soon" value={kpis.expiringSoonDocuments} color="#eab308" sub="< 30 days" />
        <StatCard label="Expired" value={kpis.expiredDocuments} color={kpis.expiredDocuments > 0 ? '#ef4444' : '#22c55e'} sub="Action required" />
        <StatCard label="Audit Events" value={snapshot.auditEvents.length} color="#a855f7" sub="Last 24h" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-3">
          <Panel>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider">Documents</h3>
              <div className="flex gap-1">
                {[
                  { k: 'all', l: 'All' },
                  { k: 'expired', l: 'Expired' },
                  { k: 'expiring', l: 'Expiring' },
                  { k: 'vehicles', l: 'Vehicles' },
                  { k: 'drivers', l: 'Drivers' },
                ].map((f) => (
                  <button
                    key={f.k}
                    onClick={() => setFilter(f.k as typeof filter)}
                    className={`text-[9px] px-2 py-0.5 rounded font-mono-data uppercase ${filter === f.k ? 'bg-[#3b82f6] text-white' : 'bg-[#0a0a0b] text-[#71717a] border border-[#2a2a33]'}`}
                  >
                    {f.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[480px] overflow-y-auto space-y-1.5">
              {filtered.slice(0, 40).map((c) => <DocRow key={c.id} doc={c} />)}
            </div>
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel>
            <PanelTitle>Compliance by Type</PanelTitle>
            <div className="space-y-2">
              {byType.map(([type, stats]) => {
                const total = stats.valid + stats.expiring + stats.expired;
                const validPct = total > 0 ? (stats.valid / total) * 100 : 0;
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between text-[10px] mb-0.5">
                      <span className="text-[#a1a1aa]">{TYPE_LABEL[type as ComplianceDocument['type']]}</span>
                      <span className="font-mono-data text-[#e4e4e7]">{stats.valid}/{total}</span>
                    </div>
                    <div className="h-2 bg-[#0a0a0b] rounded-full overflow-hidden flex">
                      <div className="h-full bg-[#22c55e]" style={{ width: `${validPct}%` }} />
                      <div className="h-full bg-[#eab308]" style={{ width: `${total > 0 ? (stats.expiring / total) * 100 : 0}%` }} />
                      <div className="h-full bg-[#ef4444]" style={{ width: `${total > 0 ? (stats.expired / total) * 100 : 0}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
          <Panel>
            <PanelTitle>Recent Audit Trail</PanelTitle>
            <div className="space-y-1 max-h-[280px] overflow-y-auto">
              {snapshot.auditEvents.slice(0, 12).map((e) => (
                <div key={e.id} className="p-2 rounded bg-[#0a0a0b] border border-[#2a2a33] text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#e4e4e7] capitalize">{e.action.replace('_', ' ')}</span>
                    <span className="text-[#52525b] font-mono-data text-[9px]">{new Date(e.timestamp).toLocaleTimeString('en-US', { hour12: false })}</span>
                  </div>
                  <div className="text-[9px] text-[#71717a]">{e.actorName} · {e.resource}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </Section>
  );
}

function DocRow({ doc }: { doc: ComplianceDocument }) {
  const daysToExpiry = Math.round((Date.parse(doc.expiresAt) - SIMULATION_NOW) / (24 * 3600 * 1000));
  return (
    <div className="p-2.5 rounded bg-[#0a0a0b] border border-[#2a2a33] flex items-center gap-3">
      <span className="text-xl">{TYPE_ICON[doc.type]}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono-data text-[#e4e4e7]">{doc.documentNumber}</span>
          <Badge color={STATUS_COLORS[doc.status]}>{doc.status.replace('_', ' ')}</Badge>
        </div>
        <div className="text-[10px] text-[#a1a1aa] mt-0.5">{TYPE_LABEL[doc.type]} · {doc.ownerType} {doc.ownerId}</div>
        <div className="text-[9px] text-[#52525b] mt-0.5">
          Issued by {doc.issuedBy} · expires {new Date(doc.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ({daysToExpiry > 0 ? `${daysToExpiry}d` : `${-daysToExpiry}d ago`})
        </div>
      </div>
    </div>
  );
}
