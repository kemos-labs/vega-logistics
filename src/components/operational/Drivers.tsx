'use client';

import { useMemo, useState } from 'react';
import { Section, StatCard, Badge, Panel, PanelTitle } from '@/components/v2026/Shell';
import { DriverRecord } from '@/lib/types';
import { Plus, Trash2, Search, Phone, IdCard, Truck, Archive, ArchiveRestore } from 'lucide-react';

interface DriversProps {
  drivers: DriverRecord[];
  onChange: (updater: (prev: DriverRecord[]) => DriverRecord[]) => void;
  onAdd: () => void;
  availableVehicles: string[];
}

export default function Drivers({ drivers, onChange, onAdd, availableVehicles }: DriversProps) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'active' | 'all' | 'inactive'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(drivers[0]?.id ?? null);

  const filtered = useMemo(() => {
    return drivers
      .filter((d) => {
        if (tab === 'active' && d.status !== 'active') return false;
        if (tab === 'inactive' && d.status !== 'inactive') return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          d.fullName.toLowerCase().includes(q) ||
          d.phone.toLowerCase().includes(q) ||
          d.nationalId.toLowerCase().includes(q) ||
          d.assignedVehicle.toLowerCase().includes(q)
        );
      });
  }, [drivers, search, tab]);

  const activeCount = drivers.filter((d) => d.status === 'active').length;
  const inactiveCount = drivers.length - activeCount;
  const selected = drivers.find((d) => d.id === selectedId);

  return (
    <Section
      title="Driver Management"
      subtitle={`${drivers.length} drivers · ${activeCount} active · ${inactiveCount} inactive`}
      actions={
        <button
          onClick={onAdd}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-colors"
        >
          <Plus className="w-3 h-3" /> Add Driver
        </button>
      }
    >
      <div className="grid grid-cols-4 gap-3 mb-4">
        <StatCard label="Total Drivers" value={drivers.length} color="#3b82f6" sub="Editable roster" />
        <StatCard label="Active" value={activeCount} color="#22c55e" sub="On the road" />
        <StatCard label="Inactive" value={inactiveCount} color="#71717a" sub="Archived / off duty" />
        <StatCard
          label="Fleet Utilization"
          value={`${drivers.length > 0 ? Math.round((activeCount / drivers.length) * 100) : 0}%`}
          color="#06b6d4"
          sub="Active / Total"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Panel className="p-0">
            <div className="p-3 border-b border-[#2a2a33] flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3 h-3 absolute left-2 top-2 text-[#52525b]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, phone, national ID…"
                  className="w-full bg-[#0a0a0b] border border-[#2a2a33] rounded pl-7 pr-2 py-1.5 text-xs text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-[#3b82f6]"
                />
              </div>
              <div className="flex items-center gap-1 bg-[#18181c] border border-[#2a2a33] rounded p-0.5">
                {(['all', 'active', 'inactive'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`text-[10px] px-2 py-1 rounded capitalize ${tab === t ? 'bg-[#3b82f6] text-white' : 'text-[#a1a1aa] hover:text-[#e4e4e7]'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-[#52525b] font-mono-data ml-auto">{filtered.length} drivers</span>
            </div>

            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[9px] uppercase tracking-wider text-[#52525b] border-b border-[#2a2a33] bg-[#0c0c0f]">
              <div className="col-span-1">Status</div>
              <div className="col-span-3">Full Name</div>
              <div className="col-span-2">Phone</div>
              <div className="col-span-2">National ID</div>
              <div className="col-span-2">Vehicle</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            <div className="max-h-[540px] overflow-y-auto divide-y divide-[#1f1f26]">
              {filtered.length === 0 && (
                <div className="p-6 text-center text-[10px] text-[#52525b]">No drivers match this view.</div>
              )}
              {filtered.map((d) => (
                <DriverRow
                  key={d.id}
                  driver={d}
                  availableVehicles={availableVehicles}
                  selected={d.id === selectedId}
                  onSelect={() => setSelectedId(d.id)}
                  onChange={(patch) => onChange((prev) => prev.map((x) => (x.id === d.id ? { ...x, ...patch } : x)))}
                  onDelete={() => onChange((prev) => prev.filter((x) => x.id !== d.id))}
                />
              ))}
            </div>
          </Panel>
        </div>

        <div>
          {selected ? (
            <Panel>
              <PanelTitle
                action={
                  <Badge color={selected.status === 'active' ? '#22c55e' : '#71717a'}>
                    {selected.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                }
              >
                Driver Profile
              </PanelTitle>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: selected.status === 'active' ? '#22c55e' : '#71717a' }}
                >
                  {selected.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="text-[10px] text-[#71717a] space-y-0.5">
                  <div className="flex items-center gap-1">
                    <Phone className="w-2.5 h-2.5" /> {selected.phone || '—'}
                  </div>
                  <div className="flex items-center gap-1">
                    <IdCard className="w-2.5 h-2.5" /> {selected.nationalId || '—'}
                  </div>
                  <div className="flex items-center gap-1">
                    <Truck className="w-2.5 h-2.5" /> {selected.assignedVehicle || '—'}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <EditField
                  label="Full Name"
                  value={selected.fullName}
                  onChange={(v) => onChange((prev) => prev.map((x) => (x.id === selected.id ? { ...x, fullName: v } : x)))}
                />
                <EditField
                  label="Phone"
                  value={selected.phone}
                  onChange={(v) => onChange((prev) => prev.map((x) => (x.id === selected.id ? { ...x, phone: v } : x)))}
                />
                <EditField
                  label="National ID"
                  value={selected.nationalId}
                  onChange={(v) => onChange((prev) => prev.map((x) => (x.id === selected.id ? { ...x, nationalId: v } : x)))}
                />
                <div>
                  <div className="text-[9px] text-[#71717a] uppercase tracking-wider mb-1">Assigned Vehicle</div>
                  <select
                    value={selected.assignedVehicle}
                    onChange={(e) => onChange((prev) => prev.map((x) => (x.id === selected.id ? { ...x, assignedVehicle: e.target.value } : x)))}
                    className="w-full bg-[#0a0a0b] border border-[#2a2a33] rounded px-2 py-1.5 text-xs text-[#e4e4e7] focus:outline-none focus:border-[#3b82f6]"
                  >
                    {availableVehicles.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-[9px] text-[#71717a] uppercase tracking-wider mb-1">Status</div>
                  <div className="flex gap-1">
                    {(['active', 'inactive'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => onChange((prev) => prev.map((x) => (x.id === selected.id ? { ...x, status: s } : x)))}
                        className={`flex-1 text-[10px] py-1.5 rounded border ${
                          selected.status === s
                            ? s === 'active'
                              ? 'bg-[#22c55e]/20 border-[#22c55e] text-[#22c55e]'
                              : 'bg-[#71717a]/20 border-[#71717a] text-[#a1a1aa]'
                            : 'bg-[#0a0a0b] border-[#2a2a33] text-[#71717a]'
                        }`}
                      >
                        {s === 'active' ? 'Active' : 'Inactive'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>
          ) : (
            <Panel>
              <div className="text-center text-[10px] text-[#52525b] py-6">Select a driver to see their profile.</div>
            </Panel>
          )}
        </div>
      </div>
    </Section>
  );
}

function DriverRow({
  driver,
  availableVehicles,
  selected,
  onSelect,
  onChange,
  onDelete,
}: {
  driver: DriverRecord;
  availableVehicles: string[];
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<DriverRecord>) => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`grid grid-cols-12 gap-2 items-center px-3 py-2 cursor-pointer transition-colors ${
        selected ? 'bg-[#131316]' : 'hover:bg-[#0e0e11]'
      }`}
    >
      <div className="col-span-1" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onChange({ status: driver.status === 'active' ? 'inactive' : 'active' })}
          className="flex items-center gap-1"
          title={driver.status === 'active' ? 'Click to archive' : 'Click to reactivate'}
        >
          {driver.status === 'active' ? (
            <Badge color="#22c55e">Active</Badge>
          ) : (
            <Badge color="#71717a">Inactive</Badge>
          )}
        </button>
      </div>
      <div className="col-span-3">
        <input
          value={driver.fullName}
          onChange={(e) => onChange({ fullName: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="w-full bg-transparent border-none text-xs text-[#e4e4e7] focus:outline-none focus:bg-[#0a0a0b] focus:px-2 focus:py-1 rounded"
        />
      </div>
      <div className="col-span-2">
        <input
          value={driver.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="w-full bg-transparent border-none text-[10px] font-mono-data text-[#a1a1aa] focus:outline-none focus:bg-[#0a0a0b] focus:px-2 focus:py-1 rounded"
        />
      </div>
      <div className="col-span-2">
        <input
          value={driver.nationalId}
          onChange={(e) => onChange({ nationalId: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="w-full bg-transparent border-none text-[10px] font-mono-data text-[#a1a1aa] focus:outline-none focus:bg-[#0a0a0b] focus:px-2 focus:py-1 rounded"
        />
      </div>
      <div className="col-span-2" onClick={(e) => e.stopPropagation()}>
        <select
          value={driver.assignedVehicle}
          onChange={(e) => onChange({ assignedVehicle: e.target.value })}
          className="w-full bg-transparent border-none text-[10px] text-[#a1a1aa] focus:outline-none focus:bg-[#0a0a0b] focus:px-2 focus:py-1 rounded"
        >
          {availableVehicles.map((v) => (
            <option key={v} value={v} className="bg-[#0a0a0b]">
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-2 flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onChange({ status: driver.status === 'active' ? 'inactive' : 'active' })}
          className="text-[#71717a] hover:text-[#3b82f6] transition-colors"
          title={driver.status === 'active' ? 'Archive' : 'Reactivate'}
        >
          {driver.status === 'active' ? <Archive className="w-3.5 h-3.5" /> : <ArchiveRestore className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onDelete}
          className="text-[#71717a] hover:text-[#ef4444] transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function EditField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="text-[9px] text-[#71717a] uppercase tracking-wider mb-1">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#0a0a0b] border border-[#2a2a33] rounded px-2 py-1.5 text-xs text-[#e4e4e7] focus:outline-none focus:border-[#3b82f6]"
      />
    </div>
  );
}
