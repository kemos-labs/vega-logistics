# VEGA Logistics OS — Full Review & 2025 Tooling Research

_Date: Aug 2026 session · Gates at time of writing: tsc ✓, vitest 64/64 ✓, python 25/25 ✓_

## Part 1 — App State Review

### What the app is today
A lean (~3.1k LOC live) client-side **business model planner**: fleet/driver sync,
customer contracts, company costs, daily ops reports, plan-vs-actual variance,
scenarios + JSON backup, PDF/Excel export. All persistence is localStorage.
Platform groundwork (`src/lib/platform/`: session, authorization, data-source,
contracts) plus a guarded `/api/v1/operations/snapshot` demo route prepare for
the real backend.

### Fixes applied this session
1. **Fleet/driver sync race hardened** (`BusinessModelApp.tsx`): `changeVehicle`
   and `removeVehicle` captured `nextTotal` from inside the `setVehicleClasses`
   updater and used it synchronously. That only worked because
   `useSimulatedData.setVehicleClasses` invokes its updater eagerly (it is not a
   React setState). Now the next list is computed outside the setter, so the
   synchronized `companyDriverCount` never depends on updater timing.
2. **Follow-up actions persisted**: moved from `useState` to
   `useLocalStorage('vega-followup-actions-v1', …)` so completed items survive
   refresh like every other record.

### Remaining known items
| Priority | Item |
|---|---|
| P1 | i18n decision: wire BusinessModelApp translations or drop i18next/react-i18next |
| P1 | Integration tests for signed sessions, job transitions, local persistence |
| P2 | Search dropdown keyboard navigation / ARIA combobox pattern |
| P2 | Patch-level dep updates (next 16.3.2, tailwind 4.3.3) — verify NTFS `.node` sizes after install |

## Part 2 — 2025 Tools Research (mapped to roadmap)

### Backend (NEXT priority): Supabase
Roadmap says "PostgreSQL repositories + real auth". Verdict from research:
- **Supabase** = strongest default: Postgres + Auth + Row-Level Security +
  Realtime + Storage. RLS maps directly onto existing tenant/session groundwork
  in `authorization.ts`. ✅ Recommended.
- Appwrite: self-hosted SDK-first alternative, less SQL-centric.
- PocketBase: docs warn against production-critical use before v1.0 — avoid.

### PWA / offline driver workflows: Workbox + Dexie.js
- Workbox for service-worker caching/routing; Dexie.js over IndexedDB for
  durable daily records (localStorage ~5MiB ceiling is real).
- RxDB if reactive local-first replication across devices becomes central.
- Robust sync needs an IndexedDB outbox + idempotent mutations + retry/backoff;
  Background Sync alone is not sufficient.

### Telematics & routing adapters (explicit roadmap item)
| Need | Recommendation |
|---|---|
| GPS/telematics API | Samsara (clean REST + webhooks) or Geotab (MyGeotab `GetFeed` checkpointed sync, better for large pipelines); Motive / Verizon Connect as alternates |
| Route optimization API | Google Route Optimization (managed), GraphHopper / Geoapify (OSM-based, published pricing), OR-Tools (free, self-hosted) |
| Reference open-source TMS stack | Fleetbase (orders/dispatch, AGPL-3.0) + Traccar (self-hosted GPS) + VROOM (routing solver) — inferred combo, not pre-integrated |

### Fleet maps (when v2026 map modules return): MapLibre GL JS
Free/open-source, vector rendering, scales to larger datasets vs Leaflet.
Avoid raw OSM public tiles in production; Google Maps is SKU-metered — verify
current pricing before budgeting.

### Audited AI recommendations: Vercel AI SDK + LangGraph
Recommended architecture for operational apps: AI SDK for typed tools/streaming
in the Next.js UI; LangGraph backend orchestration where checkpoints, approvals,
retries, and audit trails are required — matches the "audited AI
recommendations" roadmap item.

### Error monitoring (currently none)
Better Stack (100k exceptions/mo free tier), or GlitchTip (open-source,
Sentry-SDK-compatible, self-hostable).

### Market validation 🇸🇦
Vision 2030 / National Transport & Logistics Strategy is driving real logistics
digitization momentum (truck management systems, port automation, cargo
appointment platforms). SAR-denominated Saudi fleet focus targets the right
market.

## Sources
- https://supabase.com/docs/guides/database/overview · https://appwrite.io/docs · https://pocketbase.io/docs/
- https://developer.chrome.com/docs/workbox/what-is-workbox · https://dexie.org/docs/Dexie.js · https://rxdb.info/offline-first.html
- https://vercel.com/blog/ai-sdk-5 · https://www.langchain.com/blog/langgraph-platform-ga
- https://developers.samsara.com/docs/tms-gps-tracking · https://geotab.github.io/sdk/software/guides/data-feed/
- https://fleetbase.io/docs · https://github.com/traccar/traccar · https://github.com/VROOM-Project/vroom
- https://developers.google.com/maps/documentation/route-optimization/overview · https://www.graphhopper.com/pricing/
- https://maplibre.org/maplibre-gl-js/docs · https://mapsplatform.google.com/pricing/
- https://betterstack.com/pricing · https://glitchtip.com/
- https://mot.gov.sa/en/ntls
