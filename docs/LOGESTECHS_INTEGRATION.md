# LogesTechs 3PL ↔ VEGA Logistics OS — Integration Guide

**Status:** ✅ Implemented (demo-live hybrid) · **Version:** 0.4.0+ · **Date:** 2026-09-10

## 1. Deep-research findings

### 1.1 What LogesTechs is
Saudi SaaS (logestechs.com) for e-commerce logistics: **Delivery Management (DMS),
Warehouse Management (WMS), Order Management (OMS), Transport (TMS), Returns,
Accounting, Reports & Analytics**. Built for delivery companies + fulfilment
operations. Bilingual (EN/AR) + driver mobile apps (iOS/Android) with POD,
barcode, route optimisation. Implementation is white-glove (1–4 weeks, no dev
needed on their side — their team onboards you).

### 1.2 Integration catalogue (scraped from /integrations/)
| Category | Observed integrations |
|---|---|
| E-commerce / marketplaces | WooCommerce, Salla, Zid, Ordable, Shopify, Magento, ExpandCart, Matjrah |
| 3PL / carriers | SMSA, Aramex, Torod, J&T Express, Naqel, SMB Express, Bosta, iMile (+ Gurtam/Traklink GPS) |
| Comms | WhatsApp, MSEGAT, Twilio, GatewayAPI, HotSMS, OurSMS, MobiShastra |
| Payments | STC Pay, ClickPay, InterPay, nearpay, Apple Pay, Stripe |
| Location | What3Words, Saudi National Address, Google Maps |
| Smart lockers | Omni Llama, RedBox |
| IoT | Wasslz sensors |
| ERP | Odoo |

### 1.3 API reality (important)
- **No public developer docs / sandbox portal** exist (verified Sep 2026 —
  homepage, /integrations/, /delivery-management-system/, /warehouse-management-system/,
  /order-management-system/ scraped; no api docs, no OpenAPI, no Postman collection).
- API credentials are **provisioned per-tenant by the LogesTechs team** — request via
  Contact Us / WhatsApp (+966 53 965 3210) / Book Demo, or Integrations → Request Integration.
- Therefore VEGA ships a **tolerant adapter**: configurable base URL + paths, Bearer auth,
  array/paged/object-tolerant parsing, per-section graceful degradation, and a **demo mode**
  with a realistic Saudi 3PL day so the dashboard is fully usable before keys arrive.

### 1.4 Data-flow direction (this integration)
```
LogesTechs (system of record: orders/AWBs/drivers/vehicles/hubs/stock/returns/POD)
   │  REST pull (/api/logestechs/sync) every 5 min  +  push webhooks (/api/logestechs/webhook)
   ▼
VEGA Logistics OS (executive/ops dashboard: revenue, cost/shipment, margin, fleet, KPIs)
   │  "Apply to dashboard" maps channels → FinancialInput.providers,
   │  drivers → DriverRecord[], failure/return rates → live costs
   ▼
calculateFinancials() recomputes every KPI instantly (no rewrite of finance engine)
```

## 2. Architecture

```
src/lib/logestechs/
  types.ts   canonical LT models (LTShipment, LTDriver, LTVehicle, LTHub,
             LTInventoryItem, LTReturn, LTSyncSummary, webhook events)
  mock.ts    deterministic demo dataset (~500 AWBs, 12 drivers, 10 vehicles)
  client.ts  server-only REST client (Bearer, 12s timeout, tolerant parsing,
             per-endpoint LOGESTECHS_PATH_* overrides, demo fallback)
  mapper.ts  snapshot → VEGA patch (providers/drivers/rates)

src/app/api/logestechs/
  status/route.ts    connection health (never leaks key)
  sync/route.ts      GET (60s cache) / POST (force) pull → LTSyncSummary JSON
  webhook/route.ts   POST receiver (HMAC-SHA256) + GET recent-events feed

src/hooks/useLogestechs.ts               polling + state (auto-sync 5 min)
src/components/integrations/LogestechsPanel.tsx   dashboard module:
  connection header · KPI cards · provider→VEGA mapping + Apply ·
  AWB table · drivers/vehicles · WMS/returns · webhook feed
```

**Security:** API key lives server-side only (`LOGESTECHS_*`, never `NEXT_PUBLIC_`).
Browser talks only to same-origin `/api/logestechs/*`, so no CSP change was needed.
Webhooks verified with `LOGESTECHS_WEBHOOK_SECRET` (HMAC-SHA256, timing-safe);
without a secret they are accepted + logged (dev convenience).

## 3. Setup

### 3.1 Demo (works now, zero keys)
`LOGESTECHS_MODE=demo` (default). Open **Network → LogesTechs Live** → *Sync now* →
*Apply to dashboard*. Providers become `LT · Salla / Zid / Shopify / …` with live
volumes; Command Center revenue/cost/margin recompute.

### 3.2 Live (real tenant)
1. Get from your LogesTechs AM: API base URL, Bearer key, tenant/branch id, webhook secret.
2. Set env (see `.env.local`):
   ```bash
   LOGESTECHS_MODE=live
   LOGESTECHS_BASE_URL=https://api.logestechs.com   # or tenant-specific host
   LOGESTECHS_API_KEY=lt_live_xxx
   LOGESTECHS_TENANT_ID=riyadh-branch-01
   LOGESTECHS_WEBHOOK_SECRET=whsec_xxx
   LOGESTECHS_POLL_SEC=300
   ```
3. If your tenant's paths differ (common across revisions), override without code changes:
   ```bash
   LOGESTECHS_PATH_SHIPMENTS=/api/v1/shipments
   LOGESTECHS_PATH_TRACK=/api/v1/shipments/track
   LOGESTECHS_PATH_DRIVERS=/api/v1/drivers
   LOGESTECHS_PATH_VEHICLES=/api/v1/vehicles
   LOGESTECHS_PATH_HUBS=/api/v1/hubs
   LOGESTECHS_PATH_INVENTORY=/api/v1/warehouse/inventory
   LOGESTECHS_PATH_RETURNS=/api/v1/returns
   LOGESTECHS_PATH_REPORTS=/api/v1/reports/daily
   ```
4. Verify: `GET /api/logestechs/status` → `mode: live, hasKey: true`; then Sync.
5. Push: in LogesTechs dashboard → Integrations → Webhooks → add
   `https://<your-host>/api/logestechs/webhook`, paste secret, subscribe to
   `shipment.*`, `pod.captured`, `return.requested`, `inventory.adjusted`.

## 4. Endpoint mapping (expected ↔ VEGA use)

| LogesTechs (expected) | VEGA consumes as |
|---|---|
| `GET /shipments?date=` / `GET /reports/daily` | daily volumes → `providers[]`, status counts → failed/return rates, AWB table |
| `GET /shipments/track?awb=` | Customer Portal tracking lookup (`trackByAwb()`) |
| `GET /drivers` | `DriverRecord[]` + headcount → driver cost |
| `GET /vehicles` | fleet panel (plate/type/status/speed/fuel/odo) |
| `GET /hubs` | hub labels on AWBs |
| `GET /warehouse/inventory` | WMS stock panel |
| `GET /returns` | returns panel + return-rate cost |
| Webhooks `shipment.* / pod.captured / return.* / inventory.*` | live feed; dashboard re-pulls via /sync |

Field mapping detail: `deliveryFee` (what the 3PL pays us per AWB) →
`Provider.pricePerShipment`; per-`source` aggregation (salla/zid/shopify/…) →
one VEGA provider row each (`LT · Salla`, …); `status` →
`failedToday/returnedToday/outForDelivery/deliveredToday`; `codAmount` sum → COD KPI.

## 5. Verification
```bash
curl -s localhost:3002/api/logestechs/status | head -c 600
curl -s -X POST localhost:3002/api/logestechs/sync | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['mode'], d['totals'], len(d['recentShipments']))"
curl -s -X POST localhost:3002/api/logestechs/webhook -H 'Content-Type: application/json' \
  -d '{"topic":"shipment.delivered","occurredAt":"2026-09-10T00:00:00Z","shipment":{"id":"LT-1","awb":"LT100001","status":"delivered","createdAt":"2026-09-10T00:00:00Z","updatedAt":"2026-09-10T00:00:00Z"}}'
npx tsc --noEmit   # must stay exit 0
npm run build      # must pass
```

## 6. Troubleshooting
| Symptom | Cause → Fix |
|---|---|
| `mode: demo` though key set | `LOGESTECHS_MODE` still `demo` → set `live`, restart dev server |
| 401/403 auth rejected | wrong/expired key or tenant → re-issue via AM; check `X-Tenant-Id` |
| 404 path not found | tenant revision differs → set matching `LOGESTECHS_PATH_*` |
| Empty providers after sync | zero shipments in window → pass `?date=` or check source field naming |
| Webhook 401 bad signature | secret mismatch → copy exact `whsec_` value; LogesTechs signs hex `sha256=` |
| Stale dashboard after Apply | localStorage cache — Apply writes through `useSimulatedData`, KPIs recompute; hard-refresh if a second tab holds old state |

## 7. Compliance & ops notes
- **PDPL:** AWB/customer PII (names/phones) is displayed masked-ready; restrict the
  LogesTechs Live module to ops roles (already: super_admin/fleet_manager/dispatcher/executive).
- **Data residency:** keep `LOGESTECHS_BASE_URL` on the Saudi tenant host; VEGA stores
  only aggregated day-volumes in localStorage, raw AWBs stay in-memory per sync.
- **Scale path:** replace the in-memory `lastSync`/webhook ring buffer with Redis/Postgres
  + persist `tracking_events` per LOGISTICS_OS_SPEC §3.9 when moving to multi-user prod.

## 8. What to ask LogesTechs (account-manager checklist)
1. REST base URL + auth scheme (Bearer presumed — confirm rotation policy).
2. Confirm/adjust the 8 paths in §3.2 (or send their OpenAPI/Postman).
3. Shipment `source` enum values (Salla/Zid store ids?) + `deliveryFee` field name.
4. Webhook signing scheme + retry policy + event catalogue.
5. Rate limits + daily-report endpoint availability (cheaper than paging 500+ AWBs).
6. Sandbox tenant for integration testing.
