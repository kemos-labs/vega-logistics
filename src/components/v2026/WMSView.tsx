'use client';

import { useMemo, useState } from 'react';
import { Section, StatCard, Badge, Panel, PanelTitle, Bar } from './Shell';
import { useApp50 } from '@/lib/AppContext50';
import { Warehouse as WarehouseIcon, ThermometerSnowflake, Search } from 'lucide-react';
import { InventoryItem, Warehouse } from '@/lib/types2026';

const STATUS_COLORS: Record<InventoryItem['status'], string> = {
  in_stock: '#22c55e',
  low: '#eab308',
  out: '#ef4444',
  reserved: '#3b82f6',
  in_transit: '#a855f7',
};

export default function WMSView() {
  const { snapshot } = useApp50();
  const [tab, setTab] = useState<'warehouses' | 'inventory' | 'picklists' | 'loadplans'>('warehouses');
  const [search, setSearch] = useState('');
  const [selectedWh, setSelectedWh] = useState<string | null>(snapshot.warehouses[0]?.id ?? null);

  const filteredInv = useMemo(
    () => snapshot.inventory.filter((i) => !search || i.sku.toLowerCase().includes(search.toLowerCase()) || i.name.toLowerCase().includes(search.toLowerCase())),
    [snapshot.inventory, search]
  );

  return (
    <Section
      title="Warehouse & Inventory"
      subtitle={`${snapshot.warehouses.length} warehouses · ${snapshot.inventory.length} SKUs · ${snapshot.pickLists.length} pick lists · ${snapshot.loadPlans.length} load plans`}
      actions={
        <div className="flex items-center gap-1 bg-[#18181c] border border-[#2a2a33] rounded p-0.5">
          {(['warehouses', 'inventory', 'picklists', 'loadplans'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`text-[10px] px-3 py-1 rounded capitalize ${tab === t ? 'bg-[#3b82f6] text-white' : 'text-[#a1a1aa] hover:text-[#e4e4e7]'}`}>
              {t.replace('picklists', 'pick lists').replace('loadplans', 'load plans')}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-5 gap-3 mb-4">
        <StatCard label="Warehouses" value={snapshot.warehouses.length} color="#3b82f6" sub={`${snapshot.warehouses.reduce((s, w) => s + w.zonesCount, 0)} zones`} />
        <StatCard label="Total SKUs" value={snapshot.inventory.length} color="#22c55e" />
        <StatCard label="Low Stock" value={snapshot.inventory.filter((i) => i.status === 'low' || i.status === 'out').length} color="#f97316" sub="Needs reorder" />
        <StatCard label="Cold Chain" value={snapshot.inventory.filter((i) => i.requiresColdChain).length} color="#06b6d4" sub="Temp controlled" />
        <StatCard label="Pick Lists Today" value={snapshot.pickLists.length} color="#a855f7" />
      </div>

      {tab === 'warehouses' && (
        <div className="grid grid-cols-3 gap-3">
          {snapshot.warehouses.map((w) => (
            <WarehouseCard key={w.id} warehouse={w} inventory={snapshot.inventory.filter((i) => i.warehouseId === w.id)} selected={w.id === selectedWh} onClick={() => setSelectedWh(w.id)} />
          ))}
        </div>
      )}

      {tab === 'inventory' && (
        <Panel>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider">Inventory</h3>
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-2 text-[#52525b]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SKU…" className="bg-[#0a0a0b] border border-[#2a2a33] rounded pl-7 pr-2 py-1.5 text-xs text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-[#3b82f6] w-48" />
            </div>
          </div>
          <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
            <table className="w-full text-[10px]">
              <thead className="sticky top-0 bg-[#18181c] z-10">
                <tr className="text-[#71717a]">
                  <th className="text-left p-1.5">SKU</th>
                  <th className="text-left p-1.5">Name</th>
                  <th className="text-left p-1.5">Bin</th>
                  <th className="text-right p-1.5">Qty</th>
                  <th className="text-right p-1.5">Reserved</th>
                  <th className="text-right p-1.5">Value</th>
                  <th className="text-left p-1.5">Status</th>
                  <th className="text-left p-1.5">Tags</th>
                </tr>
              </thead>
              <tbody>
                {filteredInv.slice(0, 50).map((i) => (
                  <tr key={i.id} className="border-t border-[#2a2a33]">
                    <td className="p-1.5 font-mono-data text-[#e4e4e7]">{i.sku}</td>
                    <td className="p-1.5 text-[#a1a1aa]">{i.name}</td>
                    <td className="p-1.5 text-[#a1a1aa] font-mono-data">{i.binLocation}</td>
                    <td className="p-1.5 text-right font-mono-data" style={{ color: i.qty < 20 ? '#ef4444' : '#22c55e' }}>{i.qty}</td>
                    <td className="p-1.5 text-right text-[#a1a1aa] font-mono-data">{i.reservedQty}</td>
                    <td className="p-1.5 text-right text-[#f97316] font-mono-data">SAR {(i.qty * i.unitValueSar).toLocaleString()}</td>
                    <td className="p-1.5"><Badge color={STATUS_COLORS[i.status]}>{i.status.replace('_', ' ')}</Badge></td>
                    <td className="p-1.5 flex gap-1">
                      {i.requiresColdChain && <Badge color="#06b6d4"><ThermometerSnowflake className="w-2 h-2 inline" /></Badge>}
                      {i.rfidTag && <Badge color="#a855f7">RFID</Badge>}
                      {i.barcode && <Badge color="#3b82f6">BC</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === 'picklists' && (
        <Panel>
          <PanelTitle>Pick Lists</PanelTitle>
          <div className="grid grid-cols-2 gap-2 max-h-[540px] overflow-y-auto">
            {snapshot.pickLists.slice(0, 20).map((p) => (
              <div key={p.id} className="p-3 rounded bg-[#0a0a0b] border border-[#2a2a33]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono-data text-[#e4e4e7]">{p.id}</span>
                  <Badge color={p.status === 'completed' ? '#22c55e' : p.status === 'in_progress' ? '#eab308' : '#3b82f6'}>{p.status.replace('_', ' ')}</Badge>
                </div>
                <div className="text-[9px] text-[#71717a] mb-1">Job: {p.jobId} · Warehouse: {p.warehouseId}</div>
                <div className="space-y-0.5 max-h-32 overflow-y-auto">
                  {p.items.slice(0, 5).map((it, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px]">
                      <span className="text-[#a1a1aa] truncate flex-1">{it.sku}</span>
                      <span className="text-[#52525b] font-mono-data mx-2">{it.binLocation}</span>
                      <span className="font-mono-data" style={{ color: it.picked ? '#22c55e' : '#71717a' }}>{it.picked ? '✓' : `×${it.qty}`}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-[#2a2a33]">
                  <div className="flex justify-between text-[9px]">
                    <span className="text-[#71717a]">Progress</span>
                    <span className="font-mono-data text-[#3b82f6]">{p.picksCompleted}/{p.totalPicks}</span>
                  </div>
                  <Bar value={p.picksCompleted} max={p.totalPicks} color="#3b82f6" height={3} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === 'loadplans' && (
        <Panel>
          <PanelTitle>Vehicle Load Plans & Manifests</PanelTitle>
          <div className="space-y-2 max-h-[540px] overflow-y-auto">
            {snapshot.loadPlans.slice(0, 15).map((lp) => (
              <div key={lp.id} className="p-3 rounded bg-[#0a0a0b] border border-[#2a2a33]">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-[11px] font-mono-data text-[#e4e4e7]">{lp.id}</span>
                    <span className="ml-2 text-[9px] text-[#71717a]">{lp.vehicleId} · {lp.routeId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={lp.utilizationPct > 85 ? '#22c55e' : lp.utilizationPct > 60 ? '#eab308' : '#71717a'}>{lp.utilizationPct}% util</Badge>
                    {lp.verifiedAt && <Badge color="#22c55e">✓ Verified</Badge>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div>
                    <div className="text-[9px] text-[#71717a]">Weight</div>
                    <div className="text-[10px] font-mono-data text-[#e4e4e7]">{lp.totalWeightKg} kg</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-[#71717a]">Volume</div>
                    <div className="text-[10px] font-mono-data text-[#e4e4e7]">{lp.totalVolumeM3} m³</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-[#71717a]">Loading Bay</div>
                    <div className="text-[10px] font-mono-data text-[#3b82f6]">{lp.loadingBayId ?? '—'}</div>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-[#2a2a33] space-y-0.5">
                  {lp.manifest.map((m) => (
                    <div key={m.jobId} className="flex items-center justify-between text-[9px]">
                      <span className="text-[#a1a1aa] font-mono-data">#{m.sequence} {m.ref}</span>
                      <span className="text-[#71717a] font-mono-data">{m.weightKg} kg · {m.volumeM3} m³ · {m.pieces} pcs</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </Section>
  );
}

function WarehouseCard({ warehouse, inventory, selected, onClick }: { warehouse: Warehouse; inventory: InventoryItem[]; selected: boolean; onClick: () => void }) {
  const utilPct = (warehouse.usedCapacityM3 / warehouse.totalCapacityM3) * 100;
  const lowCount = inventory.filter((i) => i.status === 'low' || i.status === 'out').length;
  return (
    <button onClick={onClick} className={`text-left p-4 rounded-lg border transition-colors ${selected ? 'bg-[#1c1c21] border-[#3b82f6]' : 'bg-[#18181c] border-[#2a2a33] hover:border-[#3d3d4a]'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <WarehouseIcon className="w-4 h-4 text-[#3b82f6]" />
          <span className="text-[12px] font-semibold text-[#e4e4e7]">{warehouse.name}</span>
        </div>
        <Badge color={warehouse.type === 'main' ? '#a855f7' : '#06b6d4'}>{warehouse.type}</Badge>
      </div>
      <div className="text-[9px] text-[#71717a] mb-3">{warehouse.address}</div>
      <div className="space-y-1.5 text-[10px]">
        <div>
          <div className="flex justify-between mb-0.5">
            <span className="text-[#71717a]">Capacity</span>
            <span className="font-mono-data text-[#e4e4e7]">{Math.round(utilPct)}%</span>
          </div>
          <Bar value={utilPct} max={100} color={utilPct > 85 ? '#ef4444' : utilPct > 60 ? '#eab308' : '#22c55e'} height={4} />
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div>
            <div className="text-[9px] text-[#71717a]">SKUs</div>
            <div className="font-mono-data text-[#3b82f6]">{inventory.length}</div>
          </div>
          <div>
            <div className="text-[9px] text-[#71717a]">Low</div>
            <div className="font-mono-data" style={{ color: lowCount > 0 ? '#f97316' : '#22c55e' }}>{lowCount}</div>
          </div>
          <div>
            <div className="text-[9px] text-[#71717a]">Zones</div>
            <div className="font-mono-data text-[#a855f7]">{warehouse.zonesCount}</div>
          </div>
        </div>
      </div>
    </button>
  );
}
