// LogesTechs REST client (server-side only — keeps API key off the browser).
// Canonical guess of the LogesTechs enterprise surface, based on the product
// catalogue (DMS/WMS/OMS/TMS/Returns/Accounting/Reports). All paths are
// configurable via LOGESTECHS_* env so any tenant revision can be adapted
// without code changes. Every fetcher degrades to demo mock when mode=demo.

import { readLogestechsConfig, type LTHub, type LTInventoryItem, type LTPaged, type LTShipment, type LTSyncSummary, type LTDriver, type LTReturn, type LTVehicle } from './types';
import { buildDemoDrivers, buildDemoShipments, buildDemoSummary, buildDemoVehicles } from './mock';

const DEFAULT_PATHS = {
  shipments: '/api/v1/shipments',
  shipmentByAwb: '/api/v1/shipments/track',
  drivers: '/api/v1/drivers',
  vehicles: '/api/v1/vehicles',
  hubs: '/api/v1/hubs',
  inventory: '/api/v1/warehouse/inventory',
  returns: '/api/v1/returns',
  reportsDaily: '/api/v1/reports/daily',
};

function paths() {
  return {
    shipments: process.env.LOGESTECHS_PATH_SHIPMENTS ?? DEFAULT_PATHS.shipments,
    shipmentByAwb: process.env.LOGESTECHS_PATH_TRACK ?? DEFAULT_PATHS.shipmentByAwb,
    drivers: process.env.LOGESTECHS_PATH_DRIVERS ?? DEFAULT_PATHS.drivers,
    vehicles: process.env.LOGESTECHS_PATH_VEHICLES ?? DEFAULT_PATHS.vehicles,
    hubs: process.env.LOGESTECHS_PATH_HUBS ?? DEFAULT_PATHS.hubs,
    inventory: process.env.LOGESTECHS_PATH_INVENTORY ?? DEFAULT_PATHS.inventory,
    returns: process.env.LOGESTECHS_PATH_RETURNS ?? DEFAULT_PATHS.returns,
    reportsDaily: process.env.LOGESTECHS_PATH_REPORTS ?? DEFAULT_PATHS.reportsDaily,
  };
}

async function ltFetch<T>(path: string, search?: Record<string, string>): Promise<T> {
  const cfg = readLogestechsConfig();
  const url = new URL(cfg.baseUrl + path);
  for (const [k, v] of Object.entries(search ?? {})) url.searchParams.set(k, v);
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
        ...(cfg.tenantId ? { 'X-Tenant-Id': cfg.tenantId } : {}),
        'User-Agent': 'vega-logistics-os/0.4 (+logestechs-adapter)',
      },
      cache: 'no-store',
    });
    if (res.status === 401 || res.status === 403) throw new Error('LogesTechs auth rejected (401/403) — check LOGESTECHS_API_KEY / tenant.');
    if (res.status === 404) throw new Error(`LogesTechs path not found (404): ${path} — override via LOGESTECHS_PATH_* env.`);
    if (!res.ok) throw new Error(`LogesTechs HTTP ${res.status}: ${await res.text().then((t) => t.slice(0, 300)).catch(() => '')}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

// Accepts either {data:[...]} , paged {data,meta}, or raw arrays — tolerant parser.
function toArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const o = payload as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as T[];
    if (Array.isArray(o.items)) return o.items as T[];
    if (Array.isArray(o.shipments)) return o.shipments as T[];
    if (o.result && typeof o.result === 'object') return toArray<T>(o.result);
  }
  return [];
}

export async function fetchShipments(day?: string): Promise<LTShipment[]> {
  const cfg = readLogestechsConfig();
  if (cfg.mode === 'demo' || !cfg.apiKey) return buildDemoShipments();
  const p = paths();
  // Try daily report first (aggregated), fall back to shipment list
  try {
    const rep = await ltFetch<unknown>(p.reportsDaily, day ? { date: day } : undefined);
    const arr = toArray<LTShipment>(rep);
    if (arr.length) return arr;
  } catch { /* fall through to list */ }
  const payload = await ltFetch<LTPaged<LTShipment> | LTShipment[]>(p.shipments, {
    per_page: '200', ...(day ? { date: day } : {}),
  });
  return toArray<LTShipment>(payload);
}

export async function fetchDrivers(): Promise<LTDriver[]> {
  const cfg = readLogestechsConfig();
  if (cfg.mode === 'demo' || !cfg.apiKey) return buildDemoDrivers();
  return toArray<LTDriver>(await ltFetch(paths().drivers, { per_page: '200' }));
}

export async function fetchVehicles(): Promise<LTVehicle[]> {
  const cfg = readLogestechsConfig();
  if (cfg.mode === 'demo' || !cfg.apiKey) return buildDemoVehicles();
  return toArray<LTVehicle>(await ltFetch(paths().vehicles, { per_page: '200' }));
}

export async function fetchHubs(): Promise<LTHub[]> {
  const cfg = readLogestechsConfig();
  if (cfg.mode === 'demo' || !cfg.apiKey) {
    return [
      { id: 'hub-olaya', name: 'Olaya Hub', city: 'Riyadh' },
      { id: 'hub-malaz', name: 'Malaz Hub', city: 'Riyadh' },
      { id: 'hub-jeddah', name: 'Jeddah Hub', city: 'Jeddah' },
    ];
  }
  return toArray<LTHub>(await ltFetch(paths().hubs));
}

export async function fetchInventory(): Promise<LTInventoryItem[]> {
  const cfg = readLogestechsConfig();
  if (cfg.mode === 'demo' || !cfg.apiKey) return buildDemoSummary().inventory;
  return toArray<LTInventoryItem>(await ltFetch(paths().inventory, { per_page: '200' }));
}

export async function fetchReturns(): Promise<LTReturn[]> {
  const cfg = readLogestechsConfig();
  if (cfg.mode === 'demo' || !cfg.apiKey) return buildDemoSummary().returns;
  return toArray<LTReturn>(await ltFetch(paths().returns, { per_page: '100' }));
}

export async function trackByAwb(awb: string): Promise<LTShipment | null> {
  const cfg = readLogestechsConfig();
  if (cfg.mode === 'demo' || !cfg.apiKey) {
    return buildDemoShipments().find((s) => s.awb === awb) ?? null;
  }
  const payload = await ltFetch<LTShipment | { data: LTShipment }>(paths().shipmentByAwb, { awb });
  if (payload && typeof payload === 'object' && 'data' in payload) return (payload as { data: LTShipment }).data;
  return payload as LTShipment;
}

// Full pull → normalised snapshot. Partial failures degrade gracefully:
// each section falls back to empty/demo so one broken endpoint never kills sync.
export async function pullSyncSnapshot(): Promise<LTSyncSummary> {
  const cfg = readLogestechsConfig();
  if (cfg.mode === 'demo' || !cfg.apiKey) return buildDemoSummary();
  const [shipments, drivers, vehicles, inventory, returns] = await Promise.all([
    fetchShipments().catch(() => [] as LTShipment[]),
    fetchDrivers().catch(() => [] as LTDriver[]),
    fetchVehicles().catch(() => [] as LTVehicle[]),
    fetchInventory().catch(() => [] as LTInventoryItem[]),
    fetchReturns().catch(() => [] as LTReturn[]),
  ]);
  if (!shipments.length) return { ...buildDemoSummary([]), mode: 'live', syncedAt: new Date().toISOString() };
  const demo = buildDemoSummary(shipments);
  return {
    ...demo,
    drivers: drivers.length ? drivers : demo.drivers,
    vehicles: vehicles.length ? vehicles : demo.vehicles,
    inventory: inventory.length ? inventory : demo.inventory,
    returns: returns.length ? returns : demo.returns,
    mode: 'live',
    syncedAt: new Date().toISOString(),
  };
}

export function connectionInfo() {
  const cfg = readLogestechsConfig();
  return {
    mode: cfg.mode,
    baseUrl: cfg.mode === 'demo' ? '(demo mock — no network)' : cfg.baseUrl,
    hasKey: Boolean(cfg.apiKey),
    tenantId: cfg.tenantId ?? null,
    pollIntervalSec: cfg.pollIntervalSec,
    endpoints: paths(),
  };
}
