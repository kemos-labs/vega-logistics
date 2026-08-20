'use client';

import { useMemo, useState } from 'react';
import { Section, StatCard, Badge, Panel, PanelTitle } from './Shell';
import { useApp50 } from '@/lib/AppContext50';

import { WorkOrder } from '@/lib/types2026';

const SIMULATION_NOW = Date.parse('2026-06-20T00:00:00Z');

const STATUS_COLORS: Record<WorkOrder['status'], string> = {
  open: '#71717a',
  scheduled: '#3b82f6',
  in_progress: '#eab308',
  awaiting_parts: '#f97316',
  completed: '#22c55e',
  cancelled: '#ef4444',
};

const PRIORITY_COLORS: Record<WorkOrder['priority'], string> = {
  low: '#71717a',
  normal: '#3b82f6',
  high: '#f97316',
  critical: '#ef4444',
};

const TYPE_COLORS: Record<WorkOrder['type'], string> = {
  preventive: '#06b6d4',
  corrective: '#f97316',
  predictive: '#a855f7',
  inspection: '#3b82f6',
  recall: '#ef4444',
};

export default function MaintenanceView() {
  const { snapshot, kpis } = useApp50();
  const [tab, setTab] = useState<'work_orders' | 'parts' | 'rules'>('work_orders');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = useMemo(
    () => snapshot.workOrders.filter((w) => statusFilter === 'all' || w.status === statusFilter),
    [snapshot.workOrders, statusFilter]
  );

  const monthlyCost = useMemo(() => {
    const map = new Map<string, number>();
    snapshot.workOrders.filter((w) => w.status === 'completed').forEach((w) => {
      const m = new Date(w.completedAt ?? w.openedAt).toLocaleDateString('en-US', { month: 'short' });
      map.set(m, (map.get(m) ?? 0) + w.totalCostSar);
    });
    return Array.from(map.entries()).map(([m, c]) => ({ month: m, cost: c }));
  }, [snapshot.workOrders]);

  const lowStockParts = snapshot.parts.filter((p) => p.stockQty <= p.reorderLevel);

  return (
    <Section
      title="Maintenance Management"
      subtitle={`${snapshot.workOrders.length} work orders · ${snapshot.parts.length} parts · ${lowStockParts.length} low stock`}
      actions={
        <div className="flex items-center gap-1 bg-[#18181c] border border-[#2a2a33] rounded p-0.5">
          {(['work_orders', 'parts', 'rules'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-[10px] px-3 py-1 rounded capitalize ${tab === t ? 'bg-[#3b82f6] text-white' : 'text-[#a1a1aa] hover:text-[#e4e4e7]'}`}
            >
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-5 gap-3 mb-4">
        <StatCard label="Open WOs" value={kpis.openWorkOrders} color="#f97316" sub="In progress" />
        <StatCard label="Overdue" value={kpis.overdueMaintenance} color={kpis.overdueMaintenance > 0 ? '#ef4444' : '#22c55e'} sub="Past schedule" />
        <StatCard label="MTTR" value={`${kpis.fleetMTTR}h`} color="#3b82f6" sub="Mean time to repair" />
        <StatCard label="MTBF" value={`${kpis.fleetMTBF}d`} color="#22c55e" sub="Mean time between failures" />
        <StatCard label="In Maintenance" value={kpis.vehiclesInMaintenance} color="#eab308" sub="In workshop" />
      </div>

      {tab === 'work_orders' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Panel>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider">Work Orders</h3>
                <div className="flex gap-1">
                  {['all', 'open', 'scheduled', 'in_progress', 'awaiting_parts', 'completed'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`text-[9px] px-2 py-0.5 rounded font-mono-data uppercase ${statusFilter === s ? 'bg-[#3b82f6] text-white' : 'bg-[#0a0a0b] text-[#71717a] border border-[#2a2a33]'}`}
                    >
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="max-h-[500px] overflow-y-auto space-y-1.5">
                {filtered.slice(0, 30).map((w) => (
                  <div key={w.id} className="p-2.5 rounded bg-[#0a0a0b] border border-[#2a2a33]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono-data text-[#e4e4e7]">{w.id}</span>
                        <Badge color={TYPE_COLORS[w.type]}>{w.type}</Badge>
                        <Badge color={PRIORITY_COLORS[w.priority]}>{w.priority}</Badge>
                      </div>
                      <Badge color={STATUS_COLORS[w.status]}>{w.status.replace('_', ' ')}</Badge>
                    </div>
                    <div className="text-[11px] text-[#e4e4e7] mt-1">{w.title}</div>
                    <div className="text-[9px] text-[#71717a] mt-0.5">{w.description}</div>
                    <div className="grid grid-cols-4 gap-2 mt-2 text-[10px]">
                      <Cell label="Vehicle" value={w.vehicleId} />
                      <Cell label="Mileage" value={`${w.mileageKm.toLocaleString()} km`} />
                      <Cell label="Tech" value={w.technicianId ?? '—'} />
                      <Cell label="Total" value={`SAR ${w.totalCostSar.toLocaleString()}`} color="#f97316" />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
          <div className="space-y-3">
            <Panel>
              <PanelTitle>Monthly Maintenance Cost</PanelTitle>
              <div className="space-y-2">
                {monthlyCost.map((m, i) => {
                  const max = Math.max(...monthlyCost.map((x) => x.cost));
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-[#a1a1aa]">{m.month}</span>
                        <span className="font-mono-data text-[#f97316]">SAR {m.cost.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-[#0a0a0b] rounded-full overflow-hidden">
                        <div className="h-full bg-[#f97316]" style={{ width: `${(m.cost / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
            <Panel>
              <PanelTitle>Low Stock Parts</PanelTitle>
              {lowStockParts.length === 0 ? (
                <div className="text-[10px] text-[#52525b] text-center py-2">All parts stocked</div>
              ) : (
                <div className="space-y-1.5">
                  {lowStockParts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded bg-[#0a0a0b] border border-[#ef444433]">
                      <div>
                        <div className="text-[10px] text-[#e4e4e7]">{p.name}</div>
                        <div className="text-[9px] text-[#52525b] font-mono-data">{p.sku}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-mono-data text-[#ef4444]">{p.stockQty}</div>
                        <div className="text-[9px] text-[#52525b]">/{p.reorderLevel}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}

      {tab === 'parts' && (
        <Panel>
          <PanelTitle>Parts Inventory</PanelTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-[#71717a]">
                  <th className="text-left p-1.5">SKU</th>
                  <th className="text-left p-1.5">Name</th>
                  <th className="text-right p-1.5">Stock</th>
                  <th className="text-right p-1.5">Reorder</th>
                  <th className="text-right p-1.5">Unit Cost</th>
                  <th className="text-left p-1.5">Supplier</th>
                  <th className="text-right p-1.5">Lead</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.parts.map((p) => (
                  <tr key={p.id} className="border-t border-[#2a2a33]">
                    <td className="p-1.5 font-mono-data text-[#e4e4e7]">{p.sku}</td>
                    <td className="p-1.5 text-[#a1a1aa]">{p.name}</td>
                    <td className="p-1.5 text-right font-mono-data" style={{ color: p.stockQty <= p.reorderLevel ? '#ef4444' : '#22c55e' }}>{p.stockQty}</td>
                    <td className="p-1.5 text-right text-[#71717a] font-mono-data">{p.reorderLevel}</td>
                    <td className="p-1.5 text-right font-mono-data text-[#f97316]">SAR {p.unitCostSar}</td>
                    <td className="p-1.5 text-[#a1a1aa]">{p.supplier}</td>
                    <td className="p-1.5 text-right text-[#71717a] font-mono-data">{p.leadTimeDays}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === 'rules' && (
        <Panel>
          <PanelTitle>Preventive Maintenance Rules</PanelTitle>
          <div className="grid grid-cols-3 gap-2 max-h-[500px] overflow-y-auto">
            {snapshot.maintenanceRules.slice(0, 30).map((r) => {
              const overdueKm = r.nextDueMileageKm - (snapshot.vehicles.find((v) => v.id === r.id.split('-')[1])?.odometerKm ?? 0);
              const overdueDays = (Date.parse(r.nextDueAt) - SIMULATION_NOW) / (24 * 3600 * 1000);
              const overdue = overdueKm < 0 || overdueDays < 0;
              return (
                <div key={r.id} className="p-2.5 rounded bg-[#0a0a0b] border" style={{ borderColor: overdue ? '#ef4444' : '#2a2a33' }}>
                  <div className="text-[10px] text-[#e4e4e7] capitalize">{r.component.replace('_', ' ')}</div>
                  <div className="text-[9px] text-[#71717a] font-mono-data">{r.id}</div>
                  <div className="mt-2 space-y-0.5 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-[#71717a]">Trigger</span>
                      <span className="text-[#a1a1aa] font-mono-data">every {r.triggerValue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#71717a]">Next due</span>
                      <span className="font-mono-data" style={{ color: overdue ? '#ef4444' : '#22c55e' }}>{overdueKm < 0 ? `${-overdueKm} km overdue` : `in ${overdueKm.toLocaleString()} km`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#71717a]">Cost est.</span>
                      <span className="text-[#f97316] font-mono-data">SAR {r.costEstimateSar}</span>
                    </div>
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

function Cell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[9px] text-[#71717a] uppercase">{label}</div>
      <div className="font-mono-data text-[10px]" style={{ color: color ?? '#e4e4e7' }}>{value}</div>
    </div>
  );
}
