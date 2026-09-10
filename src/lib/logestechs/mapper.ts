// LogesTechs → VEGA mapper.
// Turns a LogesTechs sync snapshot into VEGA's FinancialInput slices
// (providers, drivers) plus dashboard KPI patches, so "pull data from provider
// to dashboard" is a one-click apply rather than manual re-typing.

import type { FinancialInput, Provider, DriverRecord } from '@/lib/types';
import type { LTDriver, LTSyncSummary } from './types';

const SOURCE_LABEL: Record<string, string> = {
  salla: 'Salla', zid: 'Zid', shopify: 'Shopify', woocommerce: 'WooCommerce',
  magento: 'Magento', expandcart: 'ExpandCart', matjrah: 'Matjrah',
  smsa: 'SMSA', aramex: 'Aramex', naqel: 'Naqel', jt: 'J&T Express',
  bosta: 'Bosta', imile: 'iMile', torod: 'Torod',
  manual: 'LogesTechs Direct', api: 'LogesTechs API', odoo: 'Odoo',
};

export function sourceLabel(source: string): string {
  return SOURCE_LABEL[source.toLowerCase()] ?? source;
}

/** Snapshot providers → VEGA Provider[] (ids stable across syncs). */
export function mapProviders(summary: LTSyncSummary): Provider[] {
  return summary.providers.map((p) => ({
    id: `lt-${p.source.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name: `LT · ${p.label}`,
    shipmentsPerDay: Math.round(p.shipmentsPerDay),
    pricePerShipment: Number(p.avgFeePerShipment.toFixed(2)),
    enabled: true,
  }));
}

/** Snapshot drivers → VEGA DriverRecord[]. */
export function mapDrivers(drivers: LTDriver[]): DriverRecord[] {
  return drivers.map((d, i) => ({
    id: d.id || `lt-drv-${i}`,
    fullName: d.name || `Driver ${i + 1}`,
    phone: d.phone ?? '',
    nationalId: d.nationalId ?? '',
    assignedVehicle: d.vehiclePlate || d.vehicleId || '',
    status: d.status === 'inactive' || d.status === 'off_duty' ? 'inactive' : 'active',
  }));
}

export interface ApplyResult {
  providers: Provider[];
  drivers: DriverRecord[];
  companyDriverCount: number;
  failedDeliveryRate: number;
  returnRate: number;
  kpis: {
    shipmentsToday: number;
    deliveredToday: number;
    failedToday: number;
    outForDelivery: number;
    codCollectedSar: number;
    avgFee: number;
    onTimeRatePct: number;
    firstAttemptRatePct: number;
  };
}

/**
 * Build the patch to apply onto FinancialInput. Strategy: REPLACE provider
 * list with live LogesTechs volumes (they are the source of truth for daily
 * shipments/revenue), MERGE drivers by id, and derive failure/return rates
 * from live status counts.
 */
export function buildApplyPatch(summary: LTSyncSummary, prev: FinancialInput): ApplyResult {
  const t = summary.totals;
  const total = Math.max(1, t.shipmentsToday);
  return {
    providers: mapProviders(summary),
    drivers: mapDrivers(summary.drivers),
    companyDriverCount: summary.drivers.filter((d) => d.status !== 'off_duty' && d.status !== 'inactive').length || prev.companyDriverCount,
    failedDeliveryRate: Number(((t.failedToday / total) * 100).toFixed(1)),
    returnRate: Number(((t.returnedToday / total) * 100).toFixed(1)),
    kpis: {
      shipmentsToday: t.shipmentsToday,
      deliveredToday: t.deliveredToday,
      failedToday: t.failedToday,
      outForDelivery: t.outForDelivery,
      codCollectedSar: t.codCollectedSar,
      avgFee: t.avgFeePerShipment,
      onTimeRatePct: t.onTimeRatePct,
      firstAttemptRatePct: t.firstAttemptRatePct,
    },
  };
}
