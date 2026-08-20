'use client';

import { useMemo } from 'react';
import { Section, StatCard, Badge, Panel, PanelTitle, Bar } from '@/components/v2026/Shell';
import { Provider, ProviderEvaluation } from '@/lib/types';
import { Plus, Trash2, TrendingUp, Award, AlertTriangle, Users } from 'lucide-react';

interface ProvidersProps {
  providers: Provider[];
  onChange: (updater: (prev: Provider[]) => Provider[]) => void;
  onAdd: () => void;
  evaluations: ProviderEvaluation[];
  totalDailyShipments: number;
  totalMonthlyRevenue: number;
}

const RATING_COLORS = {
  good: { color: '#22c55e', label: 'Good', icon: Award },
  average: { color: '#eab308', label: 'Average', icon: TrendingUp },
  bad: { color: '#ef4444', label: 'Bad', icon: AlertTriangle },
};

export default function Providers({
  providers,
  onChange,
  onAdd,
  evaluations,
  totalDailyShipments,
  totalMonthlyRevenue,
}: ProvidersProps) {
  const enabledProviders = useMemo(() => providers.filter((p) => p.enabled), [providers]);
  const weightedAvgPrice = useMemo(() => {
    const total = enabledProviders.reduce((s, p) => s + p.shipmentsPerDay * p.pricePerShipment, 0);
    const vol = enabledProviders.reduce((s, p) => s + p.shipmentsPerDay, 0);
    return vol > 0 ? total / vol : 0;
  }, [enabledProviders]);

  return (
    <Section
      title="Shipment Providers"
      subtitle={`${enabledProviders.length} active · ${totalDailyShipments.toLocaleString()} shipments/day · SAR ${totalMonthlyRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })} / month`}
      actions={
        <button
          onClick={onAdd}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-colors"
        >
          <Plus className="w-3 h-3" /> Add Provider
        </button>
      }
    >
      <div className="grid grid-cols-4 gap-3 mb-4">
        <StatCard label="Active Providers" value={enabledProviders.length} color="#3b82f6" sub={`${providers.length} total`} />
        <StatCard label="Daily Shipments" value={totalDailyShipments.toLocaleString()} color="#22c55e" sub="Aggregated volume" />
        <StatCard label="Monthly Revenue" value={`SAR ${(totalMonthlyRevenue / 1000).toFixed(1)}K`} color="#f97316" sub="All providers combined" />
        <StatCard label="Avg Price / Shipment" value={weightedAvgPrice > 0 ? `SAR ${weightedAvgPrice.toFixed(2)}` : '—'} color="#a855f7" sub="Volume-weighted" />
      </div>

      <Panel className="p-0">
        <div className="p-3 border-b border-[#2a2a33]">
          <PanelTitle>Provider Roster</PanelTitle>
        </div>

        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[9px] uppercase tracking-wider text-[#52525b] border-b border-[#2a2a33] bg-[#0c0c0f]">
          <div className="col-span-1">On</div>
          <div className="col-span-3">Provider Name</div>
          <div className="col-span-2 text-right">Shipments / Day</div>
          <div className="col-span-2 text-right">Price / Shipment (SAR)</div>
          <div className="col-span-2 text-right">Monthly Revenue</div>
          <div className="col-span-1 text-right">Volume %</div>
          <div className="col-span-1 text-right"></div>
        </div>

        <div className="divide-y divide-[#1f1f26]">
          {providers.length === 0 && (
            <div className="p-6 text-center text-[10px] text-[#52525b]">No providers yet. Click &ldquo;Add Provider&rdquo; to create one.</div>
          )}
          {providers.map((p) => {
            const monthly = p.shipmentsPerDay * 26 * p.pricePerShipment;
            const evalEntry = evaluations.find((e) => e.id === p.id);
            const volShare = evalEntry ? evalEntry.volumeShare : 0;
            return (
              <div key={p.id} className="grid grid-cols-12 gap-2 items-center px-3 py-2 hover:bg-[#131316] transition-colors">
                <div className="col-span-1">
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    onChange={(e) => onChange((prev) => prev.map((x) => (x.id === p.id ? { ...x, enabled: e.target.checked } : x)))}
                    className="w-3.5 h-3.5 accent-[#3b82f6]"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    value={p.name}
                    onChange={(e) => onChange((prev) => prev.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))}
                    placeholder="Provider name"
                    className={`w-full bg-transparent border-none text-xs text-[#e4e4e7] focus:outline-none focus:bg-[#0a0a0b] focus:px-2 focus:py-1 rounded ${p.enabled ? '' : 'opacity-50'}`}
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min={0}
                    value={p.shipmentsPerDay}
                    onChange={(e) => onChange((prev) => prev.map((x) => (x.id === p.id ? { ...x, shipmentsPerDay: Math.max(0, parseInt(e.target.value) || 0) } : x)))}
                    className={`w-full bg-transparent text-right text-xs font-mono-data text-[#e4e4e7] focus:outline-none focus:bg-[#0a0a0b] focus:px-2 focus:py-1 rounded ${p.enabled ? '' : 'opacity-50'}`}
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={p.pricePerShipment}
                    onChange={(e) => onChange((prev) => prev.map((x) => (x.id === p.id ? { ...x, pricePerShipment: Math.max(0, parseFloat(e.target.value) || 0) } : x)))}
                    className={`w-full bg-transparent text-right text-xs font-mono-data text-[#22c55e] focus:outline-none focus:bg-[#0a0a0b] focus:px-2 focus:py-1 rounded ${p.enabled ? '' : 'opacity-50'}`}
                  />
                </div>
                <div className="col-span-2 text-right font-mono-data text-[10px]" style={{ color: p.enabled ? '#f97316' : '#52525b' }}>
                  SAR {monthly.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </div>
                <div className="col-span-1 text-right font-mono-data text-[10px] text-[#a1a1aa]">
                  {(volShare * 100).toFixed(0)}%
                </div>
                <div className="col-span-1 text-right">
                  <button
                    onClick={() => onChange((prev) => prev.filter((x) => x.id !== p.id))}
                    className="text-[#71717a] hover:text-[#ef4444] transition-colors"
                    title="Delete provider"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-12 gap-2 px-3 py-2.5 border-t border-[#2a2a33] bg-[#0c0c0f]">
          <div className="col-span-6 text-[10px] text-[#71717a] uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3 h-3" /> All Providers
          </div>
          <div className="col-span-2 text-right font-mono-data text-xs font-bold text-[#3b82f6]">{totalDailyShipments.toLocaleString()}</div>
          <div className="col-span-2 text-right font-mono-data text-[10px] text-[#71717a]">
            {weightedAvgPrice > 0 ? `SAR ${weightedAvgPrice.toFixed(2)} avg` : '—'}
          </div>
          <div className="col-span-2 text-right font-mono-data text-xs font-bold text-[#22c55e]">
            SAR {totalMonthlyRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <Panel>
          <PanelTitle>Volume Share by Provider</PanelTitle>
          <div className="space-y-2">
            {providers.length === 0 && <div className="text-[10px] text-[#52525b]">No providers</div>}
            {providers
              .filter((p) => p.enabled)
              .map((p) => {
                const ev = evaluations.find((e) => e.id === p.id);
                const share = (ev?.volumeShare ?? 0) * 100;
                return (
                  <div key={p.id}>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-[#e4e4e7]">{p.name}</span>
                      <span className="font-mono-data text-[#3b82f6]">{p.shipmentsPerDay.toLocaleString()} / day · {share.toFixed(1)}%</span>
                    </div>
                    <Bar value={share} max={100} color="#3b82f6" height={6} />
                  </div>
                );
              })}
          </div>
        </Panel>
        <Panel>
          <PanelTitle>Provider Evaluation</PanelTitle>
          <div className="space-y-2">
            {providers.length === 0 && <div className="text-[10px] text-[#52525b]">No providers</div>}
            {providers
              .filter((p) => p.enabled)
              .map((p) => {
                const ev = evaluations.find((e) => e.id === p.id);
                if (!ev) return null;
                const r = RATING_COLORS[ev.rating];
                const Icon = r.icon;
                return (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded bg-[#0a0a0b] border border-[#2a2a33]">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5" style={{ color: r.color }} />
                      <div>
                        <div className="text-[11px] text-[#e4e4e7]">{p.name}</div>
                        <div className="text-[9px] text-[#52525b] font-mono-data">
                          SAR {p.pricePerShipment.toFixed(2)}/ship · {((ev.priceVsAverage - 1) * 100).toFixed(0)}% vs avg
                        </div>
                      </div>
                    </div>
                    <Badge color={r.color}>{r.label}</Badge>
                  </div>
                );
              })}
          </div>
        </Panel>
      </div>
    </Section>
  );
}
