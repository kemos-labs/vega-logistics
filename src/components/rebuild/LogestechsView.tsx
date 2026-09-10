'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownToLine, Copy, PlugZap, RefreshCw } from 'lucide-react';
import { useLogestechs } from '@/hooks/useLogestechs';
import { buildApplyPatch } from '@/lib/logestechs/mapper';
import type { DriverRecord, FinancialInput, Provider } from '@/lib/types';

interface Props {
  input: FinancialInput;
  setProviders: (u: (prev: Provider[]) => Provider[]) => void;
  setDrivers: (u: (prev: DriverRecord[]) => DriverRecord[]) => void;
  updateFinancialInput: (patch: Partial<FinancialInput>) => void;
}

type Tab = 'shipments' | 'fleet' | 'stock';

export default function LogestechsView({ input, setProviders, setDrivers, updateFinancialInput }: Props) {
  const { t } = useTranslation();
  const { status, summary, loading, syncing, lastSync, autoSync, setAutoSync, resync, staticFallback } = useLogestechs(300);
  const [tab, setTab] = useState<Tab>('shipments');
  const [appliedAt, setAppliedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const patch = useMemo(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    () => (summary ? buildApplyPatch(summary, input) : null),
    [summary],
  );

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/logestechs/webhook` : '/api/logestechs/webhook';

  const applyToDashboard = () => {
    if (!patch) return;
    setProviders(() => patch.providers);
    setDrivers(() => patch.drivers);
    updateFinancialInput({
      companyDriverCount: patch.companyDriverCount,
      failedDeliveryRate: patch.failedDeliveryRate,
      returnRate: patch.returnRate,
    });
    setAppliedAt(new Date().toLocaleTimeString());
  };

  return (
    <div>
      <div className="bm-panel">
        <div className="bm-panel-head">
          <div>
            <span>{t('businessModel.logestechs.kicker', { defaultValue: '3PL integration' })}</span>
            <h2>{t('businessModel.logestechs.title', { defaultValue: 'LogesTechs live feed' })}</h2>
            <p>{status ? `${status.mode.toUpperCase()} · ${status.baseUrl}` : t('businessModel.logestechs.connecting', { defaultValue: 'Connecting…' })}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} />
              {t('businessModel.logestechs.autosync', { defaultValue: 'Auto-sync 5m' })}
            </label>
            <button className="bm-add" onClick={resync} disabled={syncing}>
              <RefreshCw size={15} /> {syncing ? t('businessModel.logestechs.syncing', { defaultValue: 'Syncing…' }) : t('businessModel.logestechs.syncNow', { defaultValue: 'Sync now' })}
            </button>
          </div>
        </div>
        {staticFallback && (
          <p className="bm-import-note">
            {t('businessModel.logestechs.staticNote', { defaultValue: 'Static demo data (GitHub Pages has no API server). Deploy with LOGESTECHS_* env for your live tenant.' })}
          </p>
        )}
        {loading && !summary ? (
          <p className="bm-import-note">{t('businessModel.logestechs.pulling', { defaultValue: 'Pulling LogesTechs snapshot…' })}</p>
        ) : summary && (
          <div className="bm-inline-total">
            <span>{t('businessModel.logestechs.today', { defaultValue: 'Today' })} <strong>{summary.totals.shipmentsToday}</strong></span><span>·</span>
            <span>{t('businessModel.logestechs.delivered', { defaultValue: 'Delivered' })} <strong>{summary.totals.deliveredToday}</strong> ({summary.totals.onTimeRatePct}%)</span><span>·</span>
            <span>{t('businessModel.logestechs.failedReturned', { defaultValue: 'Failed/returned' })} <strong>{summary.totals.failedToday}/{summary.totals.returnedToday}</strong></span><span>·</span>
            <span>{t('businessModel.logestechs.avgFee', { defaultValue: 'Avg fee' })} <strong>SAR {summary.totals.avgFeePerShipment.toFixed(2)}</strong></span><span>·</span>
            <span>{lastSync ? lastSync.toLocaleTimeString() : '—'}</span>
            {appliedAt && <span>✓ {appliedAt}</span>}
          </div>
        )}
      </div>

      {summary && patch && (
        <div className="bm-panel" style={{ marginTop: 16 }}>
          <div className="bm-panel-head">
            <div>
              <span>{t('businessModel.logestechs.mapKicker', { defaultValue: 'Channels → customers' })}</span>
              <h2>{t('businessModel.logestechs.mapTitle', { defaultValue: 'Provider volumes → dashboard' })}</h2>
              <p>{t('businessModel.logestechs.mapDesc', { defaultValue: 'Replaces Customers & revenue with live LogesTechs channel volumes (Salla / Zid / Shopify / WooCommerce…). Revenue recomputes instantly.' })}</p>
            </div>
            <button className="bm-add" onClick={applyToDashboard}>
              <ArrowDownToLine size={15} /> {t('businessModel.logestechs.apply', { defaultValue: 'Apply to dashboard' })}
            </button>
          </div>
          <div className="bm-roster">
            <div className="bm-roster-head"><h2>{t('businessModel.logestechs.channels', { defaultValue: 'Channels' })}</h2><span>{patch.providers.length}</span></div>
            {patch.providers.map((p) => {
              const monthly = p.shipmentsPerDay * 26 * p.pricePerShipment;
              const share = summary.totals.shipmentsToday ? (p.shipmentsPerDay / summary.totals.shipmentsToday) * 100 : 0;
              return (
                <div className="bm-table-row bm-customer-row" key={p.id}>
                  <span><PlugZap size={13} style={{ display: 'inline', verticalAlign: -2 }} /> {p.name}</span>
                  <span>{p.shipmentsPerDay}/day</span>
                  <span>SAR {p.pricePerShipment.toFixed(2)}</span>
                  <strong>SAR {monthly.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo</strong>
                  <span>{share.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, margin: '16px 0' }} role="tablist" aria-label={t('businessModel.logestechs.title', { defaultValue: 'LogesTechs' })}>
        {(['shipments', 'fleet', 'stock'] as Tab[]).map((id) => (
          <button key={id} role="tab" aria-selected={tab === id} className="bm-add" style={tab === id ? undefined : { opacity: 0.55 }} onClick={() => setTab(id)}>
            {t(`businessModel.logestechs.tab_${id}`, { defaultValue: id === 'shipments' ? 'Shipments' : id === 'fleet' ? 'Drivers & fleet' : 'Stock & returns' })}
          </button>
        ))}
      </div>

      {summary && tab === 'shipments' && (
        <div className="bm-panel">
          <div className="bm-panel-head"><div><span>AWB</span><h2>{t('businessModel.logestechs.latestAwb', { defaultValue: 'Latest AWBs' })} ({summary.recentShipments.length})</h2></div></div>
          <div className="bm-roster">
            {summary.recentShipments.map((s) => (
              <div className="bm-table-row" key={s.id}>
                <strong style={{ fontFamily: 'monospace' }}>{s.awb}</strong>
                <span>{s.source} · {s.reference}</span>
                <span>{s.customerCity} · {s.hub}</span>
                <span>{s.driverName ?? '—'}</span>
                <span>SAR {(s.deliveryFee ?? 0).toFixed(2)}</span>
                <span>{s.status.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary && tab === 'fleet' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="bm-panel">
            <div className="bm-panel-head"><div><span>{t('businessModel.logestechs.drivers', { defaultValue: 'Drivers' })}</span><h2>{t('businessModel.logestechs.drivers', { defaultValue: 'Drivers' })} ({summary.drivers.length})</h2></div></div>
            <div className="bm-roster">
              {summary.drivers.map((d) => (
                <div className="bm-table-row bm-driver-row" key={d.id}>
                  <span>{d.name}</span><span>{d.vehiclePlate ?? d.vehicleId}</span><span>{d.hub}</span>
                  <span>{d.completedToday}/{d.assignedToday}</span><span>{d.status}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bm-panel">
            <div className="bm-panel-head"><div><span>{t('businessModel.logestechs.vehicles', { defaultValue: 'Vehicles' })}</span><h2>{t('businessModel.logestechs.vehicles', { defaultValue: 'Vehicles' })} ({summary.vehicles.length})</h2></div></div>
            <div className="bm-roster">
              {summary.vehicles.map((v) => (
                <div className="bm-table-row bm-fleet-row" key={v.id}>
                  <span style={{ fontFamily: 'monospace' }}>{v.plate}</span><span>{v.type}</span>
                  <span>{v.speedKmh ?? 0} km/h · {t('businessModel.logestechs.fuel', { defaultValue: 'fuel' })} {v.fuelPct ?? '—'}%</span>
                  <span>{v.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {summary && tab === 'stock' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="bm-panel">
            <div className="bm-panel-head"><div><span>WMS</span><h2>{t('businessModel.logestechs.inventory', { defaultValue: 'Warehouse inventory' })}</h2></div></div>
            <div className="bm-roster">
              {summary.inventory.map((it) => (
                <div className="bm-table-row" key={it.sku}>
                  <span>{it.name ?? it.sku}</span><span style={{ fontFamily: 'monospace' }}>{it.sku}</span>
                  <span>{it.warehouseId}</span><strong>{it.available.toLocaleString()}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="bm-panel">
            <div className="bm-panel-head">
              <div><span>{t('businessModel.logestechs.returns', { defaultValue: 'Returns' })}</span><h2>{t('businessModel.logestechs.returns', { defaultValue: 'Returns' })} ({summary.returns.length})</h2>
              <p>{t('businessModel.logestechs.webhookHint', { defaultValue: 'Push URL (server deploys):' })} <code style={{ fontSize: 11 }}>{webhookUrl}</code>
              <button className="bm-remove" style={{ marginInlineStart: 8 }} onClick={() => { navigator.clipboard.writeText(webhookUrl).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              <Copy size={13} /> {copied ? '✓' : t('businessModel.logestechs.copy', { defaultValue: 'Copy' })}
              </button></p></div>
            </div>
            <div className="bm-roster">
              {summary.returns.length === 0 && <p className="bm-import-note">{t('businessModel.logestechs.noReturns', { defaultValue: 'No returns in window.' })}</p>}
              {summary.returns.map((r) => (
                <div className="bm-table-row" key={r.id}>
                  <strong style={{ fontFamily: 'monospace' }}>{r.awb}</strong><span>{r.reason}</span><span>{r.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
