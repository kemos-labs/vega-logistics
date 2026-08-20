'use client';

import { useMemo, useState } from 'react';
import { Section, StatCard, Badge, Panel, PanelTitle, Bar } from './Shell';
import { useApp50 } from '@/lib/AppContext50';
import { Search, Package, Star, Bell, Download } from 'lucide-react';
import { Customer, Shipment } from '@/lib/types2026';

const TIER_COLORS: Record<Customer['tier'], string> = {
  standard: '#71717a',
  silver: '#a1a1aa',
  gold: '#eab308',
  platinum: '#a855f7',
};

const STATUS_COLORS: Record<string, string> = {
  unassigned: '#71717a',
  planned: '#3b82f6',
  assigned: '#3b82f6',
  en_route: '#22c55e',
  arrived: '#22c55e',
  delivered: '#22c55e',
  failed: '#ef4444',
  rescheduled: '#f97316',
  cancelled: '#71717a',
};

export default function CustomerPortal() {
  const { snapshot } = useApp50();
  const [tab, setTab] = useState<'tracking' | 'customers' | 'notifications'>('tracking');
  const [search, setSearch] = useState('');
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(snapshot.shipments[0]?.id ?? null);
  const [publicRef, setPublicRef] = useState('');

  const selectedShipment = useMemo(
    () => snapshot.shipments.find((s) => s.id === selectedShipmentId),
    [snapshot.shipments, selectedShipmentId]
  );

  const filteredShipments = useMemo(
    () => snapshot.shipments.filter((s) => !search || s.ref.toLowerCase().includes(publicRef.toLowerCase()) || s.id.toLowerCase().includes(publicRef.toLowerCase()) || (snapshot.customers.find((c) => c.id === s.customerId)?.name.toLowerCase().includes(search.toLowerCase()) ?? false)),
    [snapshot.shipments, search, publicRef, snapshot.customers]
  );

  const filteredCustomers = useMemo(
    () => snapshot.customers.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase())),
    [snapshot.customers, search]
  );

  return (
    <Section
      title="Customer Portal & Shipment Tracking"
      subtitle={`${snapshot.customers.length} customers · ${snapshot.shipments.length} shipments · ${snapshot.customerNotifications.length} notifications sent`}
      actions={
        <div className="flex items-center gap-1 bg-[#18181c] border border-[#2a2a33] rounded p-0.5">
          {(['tracking', 'customers', 'notifications'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`text-[10px] px-3 py-1 rounded capitalize ${tab === t ? 'bg-[#3b82f6] text-white' : 'text-[#a1a1aa] hover:text-[#e4e4e7]'}`}>
              {t}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-4 gap-3 mb-4">
        <StatCard label="Active Customers" value={snapshot.customers.filter((c) => c.status === 'active').length} color="#3b82f6" />
        <StatCard label="Avg Satisfaction" value={`${(snapshot.customers.reduce((s, c) => s + c.satisfactionScore, 0) / snapshot.customers.length).toFixed(1)}★`} color="#eab308" />
        <StatCard label="Platinum Tier" value={snapshot.customers.filter((c) => c.tier === 'platinum').length} color="#a855f7" sub="Premium SLAs" />
        <StatCard label="Total Shipments" value={snapshot.shipments.length.toLocaleString()} color="#22c55e" />
      </div>

      {tab === 'tracking' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-3">
            {/* Public tracking simulator */}
            <Panel>
              <PanelTitle action={<Badge color="#3b82f6">CUSTOMER-FACING</Badge>}>Public Tracking Portal</PanelTitle>
              <div className="flex gap-2">
                <input
                  value={publicRef}
                  onChange={(e) => setPublicRef(e.target.value)}
                  placeholder="Enter tracking number (e.g. VEGA123456789)"
                  className="flex-1 bg-[#0a0a0b] border border-[#2a2a33] rounded px-3 py-2 text-xs text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-[#3b82f6]"
                />
                <button className="bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-medium px-4 py-2 rounded flex items-center gap-2">
                  <Search className="w-3.5 h-3.5" /> Track
                </button>
              </div>
              <div className="text-[9px] text-[#52525b] mt-1.5">Try: VEGA prefix, customer name, or order ID</div>
            </Panel>

            <Panel className="p-0">
              <div className="max-h-[400px] overflow-y-auto">
                {filteredShipments.slice(0, 20).map((s) => (
                  <ShipmentRow
                    key={s.id}
                    shipment={s}
                    customer={snapshot.customers.find((c) => c.id === s.customerId)}
                    selected={s.id === selectedShipmentId}
                    onClick={() => setSelectedShipmentId(s.id)}
                  />
                ))}
              </div>
            </Panel>
          </div>

          <div>{selectedShipment && <ShipmentDetail shipment={selectedShipment} customer={snapshot.customers.find((c) => c.id === selectedShipment.customerId)} notifications={snapshot.customerNotifications.filter((n) => n.shipmentId === selectedShipment.id)} />}</div>
        </div>
      )}

      {tab === 'customers' && (
        <Panel>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider">Customers</h3>
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-2 text-[#52525b]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="bg-[#0a0a0b] border border-[#2a2a33] rounded pl-7 pr-2 py-1.5 text-xs text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-[#3b82f6] w-48" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 max-h-[540px] overflow-y-auto">
            {filteredCustomers.map((c) => (
              <CustomerCard key={c.id} customer={c} />
            ))}
          </div>
        </Panel>
      )}

      {tab === 'notifications' && (
        <Panel>
          <PanelTitle>Customer Notification Log</PanelTitle>
          <div className="space-y-1.5 max-h-[540px] overflow-y-auto">
            {snapshot.customerNotifications.slice(0, 40).map((n) => (
              <div key={n.id} className="p-2.5 rounded bg-[#0a0a0b] border border-[#2a2a33] flex items-start gap-3">
                <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${n.channel === 'whatsapp' ? '#22c55e22' : n.channel === 'sms' ? '#3b82f622' : '#a855f722'}` }}>
                  <Bell className="w-3.5 h-3.5" style={{ color: n.channel === 'whatsapp' ? '#22c55e' : n.channel === 'sms' ? '#3b82f6' : '#a855f7' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono-data text-[#e4e4e7]">{n.id}</span>
                    <Badge color={n.status === 'delivered' ? '#22c55e' : n.status === 'failed' ? '#ef4444' : '#eab308'}>{n.status}</Badge>
                    <Badge color="#71717a">{n.channel}</Badge>
                    <Badge color="#3b82f6">{n.type.replace(/_/g, ' ')}</Badge>
                  </div>
                  <div className="text-[10px] text-[#a1a1aa] mt-0.5">{n.message}</div>
                  <div className="text-[9px] text-[#52525b] mt-0.5">→ {n.recipient} · {new Date(n.sentAt).toLocaleString('en-US', { hour12: false })}</div>
                </div>
                <div className="text-[10px] font-mono-data text-[#f97316]">SAR {n.costSar.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </Section>
  );
}

function ShipmentRow({ shipment, customer, selected, onClick }: { shipment: Shipment; customer?: Customer; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full text-left p-2.5 border-b border-[#2a2a33] hover:bg-[#1c1c21] transition-colors flex items-center gap-3 ${selected ? 'bg-[#1c1c21]' : ''}`}>
      <Package className="w-4 h-4 text-[#3b82f6] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-mono-data text-[#e4e4e7]">{shipment.ref}</div>
        <div className="text-[9px] text-[#71717a] truncate">{customer?.name ?? '—'} → {shipment.destination.name}</div>
      </div>
      <Badge color={STATUS_COLORS[shipment.status]}>{shipment.status.replace(/_/g, ' ')}</Badge>
    </button>
  );
}

function ShipmentDetail({ shipment, customer, notifications }: { shipment: Shipment; customer?: Customer; notifications: ReturnType<typeof useApp50>['snapshot']['customerNotifications'] }) {
  return (
    <Panel>
      <PanelTitle action={<Badge color={STATUS_COLORS[shipment.status]}>{shipment.status.replace(/_/g, ' ')}</Badge>}>{shipment.ref}</PanelTitle>
      <div className="space-y-1.5 text-[10px]">
        <Row k="Customer" v={customer?.name ?? '—'} />
        <Row k="Service" v={shipment.serviceType.replace('_', ' ')} />
        <Row k="Origin" v={shipment.origin.name ?? '—'} />
        <Row k="Destination" v={shipment.destination.name ?? '—'} />
        <Row k="Pieces" v={`${shipment.pieces} pcs · ${shipment.weightKg} kg`} />
        <Row k="Booked" v={new Date(shipment.bookedAt).toLocaleString('en-US', { hour12: false })} />
        <Row k="Picked Up" v={shipment.pickedUpAt ? new Date(shipment.pickedUpAt).toLocaleString('en-US', { hour12: false }) : '—'} />
        <Row k="ETA Promised" v={new Date(shipment.etaPromised).toLocaleString('en-US', { hour12: false })} />
        <Row k="ETA Predicted" v={new Date(shipment.etaPredicted).toLocaleString('en-US', { hour12: false })} />
        <Row k="Delivered" v={shipment.deliveredAt ? new Date(shipment.deliveredAt).toLocaleString('en-US', { hour12: false }) : '—'} />
      </div>
      {shipment.specialInstructions && (
        <div className="mt-3 pt-3 border-t border-[#2a2a33] text-[10px] text-[#a1a1aa]">
          <span className="text-[#71717a]">Special:</span> {shipment.specialInstructions}
        </div>
      )}

      {shipment.podId && (
        <button className="mt-3 w-full bg-[#22c55e] hover:bg-[#16a34a] text-white text-xs font-medium py-2 rounded flex items-center justify-center gap-2">
          <Download className="w-3.5 h-3.5" /> Download POD
        </button>
      )}

      <div className="mt-3 pt-3 border-t border-[#2a2a33]">
        <div className="text-[9px] text-[#71717a] uppercase tracking-wider mb-2">Notifications Sent</div>
        {notifications.length === 0 ? (
          <div className="text-[10px] text-[#52525b]">No notifications</div>
        ) : (
          <div className="space-y-1">
            {notifications.map((n) => (
              <div key={n.id} className="text-[9px] text-[#a1a1aa] flex items-center gap-2">
                <Badge color={n.channel === 'whatsapp' ? '#22c55e' : n.channel === 'sms' ? '#3b82f6' : '#a855f7'}>{n.channel}</Badge>
                <span>{n.type.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

function CustomerCard({ customer }: { customer: Customer }) {
  return (
    <div className="p-3 rounded bg-[#0a0a0b] border border-[#2a2a33]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-[#e4e4e7]">{customer.name}</span>
        <Badge color={TIER_COLORS[customer.tier]}>{customer.tier}</Badge>
      </div>
      <div className="text-[9px] text-[#71717a] mb-2">{customer.type.toUpperCase()} · {customer.billingAddress}</div>
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <div className="text-[#71717a] text-[9px]">On-Time</div>
          <Bar value={customer.onTimeRate * 100} max={100} color="#22c55e" height={3} />
          <div className="text-[10px] font-mono-data text-[#22c55e] mt-0.5">{(customer.onTimeRate * 100).toFixed(0)}%</div>
        </div>
        <div>
          <div className="text-[#71717a] text-[9px]">Satisfaction</div>
          <div className="text-[12px] font-mono-data text-[#eab308] flex items-center gap-0.5"><Star className="w-3 h-3 fill-[#eab308]" />{customer.satisfactionScore.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-[#71717a] text-[9px]">Total Shipments</div>
          <div className="text-[10px] font-mono-data text-[#3b82f6]">{customer.totalShipments.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[#71717a] text-[9px]">Outstanding</div>
          <div className="text-[10px] font-mono-data text-[#f97316]">SAR {Math.round(customer.outstandingSar).toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-2"><span className="text-[#71717a]">{k}</span><span className="font-mono-data text-[#e4e4e7] text-right truncate">{v}</span></div>;
}
