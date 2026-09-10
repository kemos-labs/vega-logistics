// LogesTechs 3PL — Canonical types
// LogesTechs (logestechs.com) is a Saudi DMS/WMS/OMS SaaS for delivery companies
// and fulfilment operations. There is NO public API doc portal — API access is
// provisioned per-tenant by their team (1–4 week onboarding). This module models
// the canonical 3PL surface (orders, AWBs/shipments, tracking, drivers, vehicles,
// hubs, inventory, returns, POD) so VEGA can pull provider data into its dashboard
// regardless of the exact LogesTechs endpoint revision.
//
// Research sources (Sep 2026): logestechs.com homepage + /integrations/ scrape,
// product pages (DMS/WMS/OMS/TMS/Returns/Accounting/Reports). Integration catalogue
// observed: WooCommerce, Salla, Zid, Shopify, Magento, ExpandCart, Matjrah (e-com);
// SMSA, Aramex, Naqel, J&T, Bosta, iMile, Torod (3PL); Odoo (ERP); WhatsApp/Twilio/
// MSEGAT (comms); STC Pay/ClickPay/nearpay/Stripe/ApplePay (payments);
// What3Words/Saudi National Address/Google Maps (location); Omni Llama/RedBox
// (smart lockers); Wasslz (IoT sensors).

// ─── Connection ──────────────────────────────────────────────────────────
export interface LogestechsConfig {
  baseUrl: string;      // e.g. https://api.logestechs.com  (tenant-specific)
  apiKey: string;       // Bearer token provisioned by LogesTechs team
  tenantId?: string;    // optional tenant / branch scope header
  webhookSecret?: string; // HMAC secret to verify inbound webhooks
  mode: 'live' | 'demo';  // demo = local mock, no network
  pollIntervalSec: number;
}

export function readLogestechsConfig(): LogestechsConfig {
  const mode =
    (process.env.LOGESTECHS_MODE as 'live' | 'demo' | undefined) ??
    (process.env.LOGESTECHS_API_KEY ? 'live' : 'demo');
  return {
    baseUrl: (process.env.LOGESTECHS_BASE_URL ?? 'https://api.logestechs.com').replace(/\/$/, ''),
    apiKey: process.env.LOGESTECHS_API_KEY ?? '',
    tenantId: process.env.LOGESTECHS_TENANT_ID,
    webhookSecret: process.env.LOGESTECHS_WEBHOOK_SECRET,
    mode,
    pollIntervalSec: Number(process.env.LOGESTECHS_POLL_SEC ?? 300),
  };
}

// ─── LogesTechs domain models (normalised from their DMS/WMS/OMS shape) ──
export type LTShipmentStatus =
  | 'created' | 'picked_up' | 'at_hub' | 'out_for_delivery'
  | 'delivered' | 'failed' | 'returned' | 'cancelled' | 'exception';

export interface LTMoney { amount: number; currency: 'SAR'; }

export interface LTShipment {
  id: string;                 // LogesTechs internal id
  awb: string;                // air waybill / tracking number
  reference?: string;         // merchant / Salla / Zid order ref
  status: LTShipmentStatus;
  codAmount?: number;         // cash-on-delivery SAR
  deliveryFee?: number;       // what the 3PL pays us per shipment (SAR)
  customerName?: string;
  customerPhone?: string;
  customerCity?: string;
  hub?: string;
  driverId?: string;
  driverName?: string;
  vehicleId?: string;
  createdAt: string;          // ISO
  updatedAt: string;          // ISO
  deliveredAt?: string;
  podUrl?: string;
  lat?: number;
  lng?: number;
  weightKg?: number;
  attempts?: number;
  exceptionCode?: string;
  source?: string;            // e.g. 'salla' | 'zid' | 'shopify' | 'woocommerce' | 'manual' | 'api'
}

export interface LTDriver {
  id: string;
  name: string;
  phone?: string;
  nationalId?: string;
  status: 'active' | 'inactive' | 'on_trip' | 'off_duty';
  vehicleId?: string;
  vehiclePlate?: string;
  hub?: string;
  completedToday?: number;
  assignedToday?: number;
}

export interface LTVehicle {
  id: string;
  plate: string;
  type?: string;              // van | pickup | truck | bike …
  status: 'active' | 'idle' | 'maintenance' | 'offline';
  lat?: number;
  lng?: number;
  speedKmh?: number;
  driverId?: string;
  odometerKm?: number;
  fuelPct?: number;
}

export interface LTHub { id: string; name: string; city: string; lat?: number; lng?: number; }

export interface LTInventoryItem {
  sku: string;
  name?: string;
  warehouseId?: string;
  onHand: number;
  reserved: number;
  available: number;
}

export interface LTReturn {
  id: string;
  awb: string;
  reason?: string;
  status: 'requested' | 'in_transit' | 'received' | 'refunded' | 'cancelled';
  createdAt: string;
}

// Paginated envelope (LogesTechs-style: data + meta)
export interface LTPaged<T> {
  data: T[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

// ─── Sync snapshot — what VEGA pulls into the dashboard ──────────────────
export interface LTProviderVolume {
  source: string;             // normalised provider key, e.g. 'salla'
  label: string;              // display name
  shipmentsPerDay: number;
  avgFeePerShipment: number;  // SAR — what LogesTechs pays us
}

export interface LTSyncSummary {
  syncedAt: string;
  mode: 'live' | 'demo';
  totals: {
    shipmentsToday: number;
    deliveredToday: number;
    failedToday: number;
    returnedToday: number;
    outForDelivery: number;
    codCollectedSar: number;
    avgFeePerShipment: number;
    onTimeRatePct: number;
    firstAttemptRatePct: number;
  };
  providers: LTProviderVolume[];   // → maps to FinancialInput.providers
  drivers: LTDriver[];
  vehicles: LTVehicle[];
  inventory: LTInventoryItem[];
  returns: LTReturn[];
  recentShipments: LTShipment[];   // latest ~50 for tables
  statusCounts: Record<LTShipmentStatus, number>;
}

// ─── Webhook inbound event ───────────────────────────────────────────────
export type LTWebhookTopic =
  | 'shipment.created' | 'shipment.status_changed' | 'shipment.delivered'
  | 'shipment.failed' | 'pod.captured' | 'return.requested' | 'inventory.adjusted'
  | 'driver.location';

export interface LTWebhookEvent {
  topic: LTWebhookTopic;
  occurredAt: string;
  shipment?: LTShipment;
  data?: Record<string, unknown>;
}
