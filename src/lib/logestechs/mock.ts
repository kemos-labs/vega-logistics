// LogesTechs — Demo dataset (used when LOGESTECHS_MODE=demo or no API key).
// Realistic Saudi 3PL day: ~500 shipments across Salla/Zid/Shopify/WooCommerce,
// mixed statuses, 12 drivers, 10 vehicles, Riyadh hubs, WMS stock, returns.

import type {
  LTDriver, LTHub, LTReturn, LTShipment, LTSyncSummary, LTVehicle,
} from './types';

const CITIES = ['Riyadh', 'Jeddah', 'Dammam', 'Makkah', 'Madinah', 'Khobar'];
const SOURCES = ['salla', 'zid', 'shopify', 'woocommerce', 'manual'] as const;
const HUBS: LTHub[] = [
  { id: 'hub-olaya', name: 'Olaya Hub', city: 'Riyadh', lat: 24.6937, lng: 46.67 },
  { id: 'hub-malaz', name: 'Malaz Hub', city: 'Riyadh', lat: 24.6728, lng: 46.7416 },
  { id: 'hub-jeddah', name: 'Jeddah Hub', city: 'Jeddah', lat: 21.4858, lng: 39.1925 },
];

const DRIVER_NAMES = [
  'Ahmed Al-Rashid', 'Mohammed Al-Otaibi', 'Khalid Al-Qahtani', 'Faisal Al-Harbi',
  'Sultan Al-Shammari', 'Abdullah Al-Ghamdi', 'Nasser Al-Dosari', 'Omar Al-Mutairi',
  'Yousef Al-Shehri', 'Bandar Al-Anazi', 'Turki Al-Subaie', 'Saad Al-Zahrani',
];

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildDemoShipments(count = 500, seed = 20260910): LTShipment[] {
  const rnd = mulberry(seed);
  const now = Date.now();
  const out: LTShipment[] = [];
  for (let i = 0; i < count; i++) {
    const r = rnd();
    const status =
      r < 0.52 ? 'delivered'
      : r < 0.68 ? 'out_for_delivery'
      : r < 0.78 ? 'at_hub'
      : r < 0.86 ? 'picked_up'
      : r < 0.91 ? 'failed'
      : r < 0.95 ? 'returned'
      : r < 0.97 ? 'exception' : 'created';
    const src = SOURCES[Math.floor(rnd() * SOURCES.length)];
    const hub = HUBS[Math.floor(rnd() * HUBS.length)];
    const driverIdx = Math.floor(rnd() * DRIVER_NAMES.length);
    const createdAgoHrs = rnd() * 20;
    const createdAt = new Date(now - createdAgoHrs * 3600_000).toISOString();
    const fee = 7 + rnd() * 5; // SAR 7–12 per shipment
    out.push({
      id: `LT-${100000 + i}`,
      awb: `LT${(100000 + i).toString()}`,
      reference: `${src.toUpperCase()}-${5000 + i}`,
      status: status as LTShipment['status'],
      codAmount: rnd() < 0.35 ? Math.round(rnd() * 400) : 0,
      deliveryFee: Number(fee.toFixed(2)),
      customerName: `Customer ${i + 1}`,
      customerCity: CITIES[Math.floor(rnd() * CITIES.length)],
      hub: hub.name,
      driverId: `drv-${driverIdx + 1}`,
      driverName: DRIVER_NAMES[driverIdx],
      vehicleId: `veh-${(driverIdx % 10) + 1}`,
      createdAt,
      updatedAt: createdAt,
      deliveredAt: status === 'delivered' ? createdAt : undefined,
      lat: 24.6 + rnd() * 0.25,
      lng: 46.6 + rnd() * 0.25,
      weightKg: Number((0.5 + rnd() * 8).toFixed(1)),
      attempts: status === 'failed' ? 2 + Math.floor(rnd() * 2) : 1,
      source: src,
    });
  }
  return out;
}

export function buildDemoDrivers(): LTDriver[] {
  return DRIVER_NAMES.map((name, i) => ({
    id: `drv-${i + 1}`,
    name,
    phone: `+966 50 ${100 + i} ${1000 + i * 111}`,
    nationalId: `10${87654321 - i * 111111}`,
    status: i < 9 ? 'on_trip' : i < 11 ? 'active' : 'off_duty',
    vehicleId: `veh-${(i % 10) + 1}`,
    vehiclePlate: `${1000 + i * 7} XYZ`,
    hub: i % 3 === 2 ? 'Jeddah Hub' : i % 2 ? 'Malaz Hub' : 'Olaya Hub',
    completedToday: 20 + ((i * 7) % 30),
    assignedToday: 40 + ((i * 5) % 20),
  }));
}

export function buildDemoVehicles(): LTVehicle[] {
  const rnd = mulberry(77);
  return Array.from({ length: 10 }, (_, i) => ({
    id: `veh-${i + 1}`,
    plate: `${1000 + i * 7} XYZ`,
    type: i < 7 ? 'van' : 'pickup',
    status: i < 7 ? 'active' : i < 9 ? 'idle' : 'maintenance',
    lat: 24.6 + rnd() * 0.25,
    lng: 46.6 + rnd() * 0.25,
    speedKmh: Math.round(rnd() * 90),
    driverId: `drv-${i + 1}`,
    odometerKm: 40000 + i * 9000,
    fuelPct: 30 + Math.round(rnd() * 65),
  }));
}

export function buildDemoSummary(shipments?: LTShipment[]): LTSyncSummary {
  const list = shipments ?? buildDemoShipments();
  const today = list; // demo = single-day window
  const count = (s: LTShipment['status']) => today.filter((x) => x.status === s).length;
  const delivered = count('delivered');
  const failed = count('failed');
  const returned = count('returned');
  const out = count('out_for_delivery');
  const cod = today.reduce((a, x) => a + (x.codAmount ?? 0), 0);
  const fees = today.map((x) => x.deliveryFee ?? 9);
  const avgFee = fees.reduce((a, b) => a + b, 0) / Math.max(1, fees.length);

  const bySource = new Map<string, { n: number; fee: number }>();
  for (const s of today) {
    const k = (s.source ?? 'manual').toLowerCase();
    const e = bySource.get(k) ?? { n: 0, fee: 0 };
    e.n += 1; e.fee += s.deliveryFee ?? 9;
    bySource.set(k, e);
  }
  const LABELS: Record<string, string> = {
    salla: 'Salla', zid: 'Zid', shopify: 'Shopify', woocommerce: 'WooCommerce', manual: 'Manual / API',
  };
  const providers = [...bySource.entries()].map(([source, v]) => ({
    source,
    label: LABELS[source] ?? source,
    shipmentsPerDay: v.n,
    avgFeePerShipment: Number((v.fee / Math.max(1, v.n)).toFixed(2)),
  }));

  const returns: LTReturn[] = today
    .filter((x) => x.status === 'returned')
    .slice(0, 20)
    .map((x) => ({ id: `ret-${x.id}`, awb: x.awb, reason: 'Customer request', status: 'in_transit' as const, createdAt: x.updatedAt }));

  const statusCounts = {
    created: count('created'), picked_up: count('picked_up'), at_hub: count('at_hub'),
    out_for_delivery: out, delivered, failed, returned,
    cancelled: 0, exception: count('exception'),
  };

  return {
    syncedAt: new Date().toISOString(),
    mode: 'demo',
    totals: {
      shipmentsToday: today.length,
      deliveredToday: delivered,
      failedToday: failed,
      returnedToday: returned,
      outForDelivery: out,
      codCollectedSar: Math.round(cod),
      avgFeePerShipment: Number(avgFee.toFixed(2)),
      onTimeRatePct: 93.4,
      firstAttemptRatePct: 90.1,
    },
    providers,
    drivers: buildDemoDrivers(),
    vehicles: buildDemoVehicles(),
    inventory: [
      { sku: 'SKU-PACK-BOX-M', name: 'Shipping box M', warehouseId: 'hub-olaya', onHand: 4200, reserved: 600, available: 3600 },
      { sku: 'SKU-BUBBLE-100', name: 'Bubble wrap roll', warehouseId: 'hub-olaya', onHand: 800, reserved: 120, available: 680 },
      { sku: 'SKU-LABEL-4x6', name: 'AWB labels 4x6', warehouseId: 'hub-malaz', onHand: 15000, reserved: 2000, available: 13000 },
      { sku: 'SKU-TAPE-48', name: 'Packing tape', warehouseId: 'hub-jeddah', onHand: 950, reserved: 150, available: 800 },
    ],
    returns,
    recentShipments: [...today].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 50),
    statusCounts,
  };
}
