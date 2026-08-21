# VEGA Logistics OS — Session Memory

<!-- ===== AUTO-LOADED BY AGENTS.md ===== -->
<!-- This file is read automatically on every agent session start. -->

## Project Identity

| Field | Value |
|-------|-------|
| **Name** | VEGA Logistics OS / Levered Beta Logistics |
| **Version** | `0.4.0` |
| **Stack** | Next.js 16.3.1 + Turbopack + Tailwind CSS v4 + TypeScript 5 |
| **Path** | `/data/Ai slop/vega-logistics` (NTFS-mounted) |
| **Dev Server** | `http://vega.localhost:8080` via portless proxy (old `localhost:3003` retired) |
| **Build Status** | ✅ PASSING — `next build` compiles, TypeScript clean (exit 0) |
| **Python Tests** | ✅ 25/25 passing (calculations: 9, feasibilityEngine: 10, ghostGrowth: 6) |
| **ESLint** | ✅ 0 errors, 0 warnings (fully clean; fonts migrated to `next/font/google`) |
| **Vitest** | ✅ 40/40 passing (`npx vitest run`) |
| **Git** | 5 commits + `archive/v2026-modules` branch |

## Filesystem Warning

**NTFS (ntfs3)** — This project lives on an NTFS-mounted drive. Native `.node` binaries can get corrupted/truncated during `npm install`. Verified fixes:
- `@next/swc-linux-x64-gnu` — must be ~130MB (was 4.2MB when corrupted)
- `@tailwindcss/oxide-linux-x64-gnu` — must be ~2.98MB (was 2.1MB when corrupted)
- `lightningcss-linux-x64-gnu` — pinned to `^1.25.0` (v1.32.0 binaries corrupt on NTFS); currently installed at 1.32.0 (10MB, working) — must align after reinstall
- **After any `npm install`, verify `.node` file sizes with `ls -la`**

## Dependency Status

| Status | Package | Notes |
|--------|---------|-------|
| ✅ | next@16.2.6 | Custom docs in `node_modules/next/dist/docs/` |
| ✅ | react@19.2.4, react-dom@19.2.4 | |
| ✅ | typescript@^5 | |
| ✅ | tailwindcss@^4 | via @tailwindcss/postcss |
| ✅ | framer-motion@12.40.0 | |
| ✅ | leaflet@1.9.4, react-leaflet@5.0.0 | Map rendering |
| ✅ | recharts@3.8.1, react-plotly.js@2.6.0 | Charts |
| ✅ | i18next@26.3.0, react-i18next@17.0.8 | i18n/AR-RTL support |
| ✅ | jspdf@4.2.1, html2canvas@1.4.1, xlsx@0.18.5 | Export |
| ✅ | lucide-react@1.16.0 | Icons |
| ✅ | @heroui/react@3.2.1 | In deps; only used by orphaned `BreakEvenAnalytics.tsx` (Button, Card); requires `@import "@heroui/styles"` in `globals.css` |

## DevOps Info

```bash
# Dev server
npm run dev:portless   # http://vega.localhost:8080 (preferred)
npm run dev            # plain next dev (choose own port)

# Build
npm run build  # ✅ compiles + typechecks

# TypeScript
npx tsc --noEmit  # ✅ exit 0

# Python tests
cd src/__tests__ && python3 run_all_tests.py  # ✅ 25/25

# Lint
npm run lint   # ✅ 0 errors, 204 warnings
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout (RTL, i18n, fonts)
│   ├── page.tsx            # Main workspace route (planning + operations switcher)
│   └── globals.css         # Tailwind + custom styles
├── components/
│   ├── layout/             # ClientLayout, Header, Sidebar, LanguageSwitcher
│   ├── fleet/              # FleetHub, FleetMap
│   ├── risk/               # RiskCalculator, RiskSurface, MonteCarloPanel, etc.
│   ├── financial/          # FinancialEngine
│   ├── feasibility/        # FeasibilityStudy
│   ├── ghost/              # GhostGrowthEngine
│   ├── saudi/              # AutoclawUnified, NexusFleet, SaudiFleetPlanner, RentedFleetPlanner
│   ├── v2026/              # 15+ next-gen modules (AI, Carbon, Digital Twin, etc.)
│   ├── breakeven/          # BreakEvenAnalytics
│   ├── export/             # PDFReport
│   ├── error/              # ErrorBoundary
│   ├── charts/             # HexCostGraph
│   └── operational/        # FleetVehicles, Drivers, Maintenance, Providers, Freelancers
├── lib/
│   ├── engines/            # agents, carbon, computerVision, digitalTwin, dispatch, kpi50, etc.
│   ├── types.ts            # Core TypeScript types
│   ├── types2026.ts        # v2026 module types
│   ├── calculations.ts     # Financial calculation engine
│   ├── riskEngine.ts       # Risk analytics engine
│   ├── advancedKPIs.ts     # Advanced KPI generation
│   ├── mockData.ts         # Simulated data
│   ├── apiHooks.ts         # Free API hooks
│   ├── exportUtils.ts      # Export utilities
│   ├── i18n.ts             # i18n config
│   ├── *.py                # Python backend engines
│   └── AppContext.tsx      # React context (legacy)
│   └── AppContext50.tsx    # React context (v2026 50-fleet)
├── hooks/
│   └── useSimulatedData.ts # Data simulation hook
└── __tests__/              # Python unit tests (25 tests)
```

## Module Inventory (30+)

| Module | Key | File | Type |
|--------|-----|------|------|
| Command Center | `command-center` | page.tsx inline | Dashboard |
| Nexus Fleet | `autoclaw` | AutoclawUnified.tsx | Fleet intelligence |
| Ghost Growth | `ghost-growth` | GhostGrowthEngine.tsx | Detection |
| Fleet Map | `fleet` | FleetMap.tsx | Visualisation |
| Risk Manager | `risk` | AdvancedRiskPanel.tsx | Analytics |
| 3D Risk Analytics | `analytics` | RiskSurface.tsx | Visualisation |
| Feasibility Study | `feasibility` | FeasibilityStudy.tsx | Study |
| AI Agents | `ai-agents` | AIAgentsView.tsx | AI |
| Digital Twin | `digital-twin` | DigitalTwinView.tsx | Simulator |
| Carbon/Sustainability | `carbon` | CarbonView.tsx | ESG |
| Predictive Maintenance | `predictive-maintenance` | PredictiveMaintenanceView.tsx | ML |
| Computer Vision | `computer-vision` | ComputerVisionView.tsx | CV |
| RL Route Optimizer | `rl-route` | RLRouteView.tsx | AI |
| Live Fleet Map | `live-map` | LiveFleetMap.tsx | Real-time |
| Dispatch Board | `dispatch` | DispatchBoard.tsx | Ops |
| Driver Management | `drivers` | Drivers.tsx | Ops |
| Maintenance Ops | `maintenance` | Maintenance.tsx | Ops |
| Fuel & Cost | `fuel` | FuelView.tsx | Cost |
| Compliance & Audit | `compliance` | ComplianceView.tsx | Compliance |
| Delivery & POD | `delivery` | DeliveryView.tsx | Ops |
| Customer Portal | `customer` | CustomerPortal.tsx | Portal |
| Warehouse/Inventory | `wms` | WMSView.tsx | WMS |
| AI Safety | `safety` | SafetyView.tsx | Safety |
| Analytics & Reporting | `analytics50` | Analytics50View.tsx | Analytics |
| Admin Panel | `admin` | AdminPanel.tsx | Admin |
| Shipment Providers | `providers` | Providers.tsx | Ops |
| Freelancer Model | `freelancers` | Freelancers.tsx | Ops |
| Fleet & Vehicles | `fleet-vehicles` | FleetVehicles.tsx | Ops |

## Key Decisions Log

1. **Database: NONE** — All data is simulated client-side via `useSimulatedData()` hook
2. **Port 3003** — 3000 = Gitea, 3002 = lore-engine (unrelated project). Never use 3002.
3. **lightningcss `^1.25.0`** — Both `devDependencies` and `optionalDependencies` pinned to `^1.25.0`; v1.32.0 binaries are corrupted on NTFS. `package-lock.json` is stale — regenerate after `npm install`.
4. **SSR: false** — All modules use `next/dynamic` with `ssr: false` for SPA performance
5. **Dark only** — No light mode; theme is forced dark
6. **Arabic/RTL** — i18next wired in ClientLayout but the live UI (`BusinessModelApp`) is hardcoded English — P1 decision pending: wire translations or drop i18next
7. **Dead code archived, not deleted** — 67 orphaned modules (~17.9k LOC) live on branch `archive/v2026-modules`. Recover via `git checkout archive/v2026-modules -- <path>`
8. **Excel export = exceljs** — replaced vulnerable xlsx@0.18.5 (prototype-pollution/ReDoS CVEs); same 5-sheet workbook, dynamically imported
9. **CSP strict** — no external origins (fonts self-hosted); `unsafe-eval` dev-only for Turbopack HMR
10. **sharp/libvips CVEs inherited from next@16** — not actionable until Next ships an update; re-check after upgrades

## Known Issues

1. **Recharts dimension warnings — STALE**: No live route renders `AdvancedCharts.tsx` (recharts); both it and `BreakEvenAnalytics.tsx` are orphaned (no importers). Warnings not observed in current app.
2. **ESLint debt** — 0 errors, 204 warnings. Remaining warnings are mostly unused imports/variables in legacy modules.
3. **No proper PWA** — No service worker, no manifest, no offline support
4. **No real backend** — All data is mock/simulated
5. **NTFS corruption risk** — Native binaries must be verified after npm install

## Priority Roadmap

### DONE (current pass)
- [x] Restored an editable planning workspace as the primary route
- [x] Connected financial engine, fleet, drivers, providers, freelancers, risk and feasibility views
- [x] Added truthful simulation metadata and responsive planning styling
- [x] Connected `AppContext50` reads to the validated operations snapshot API adapter
- [x] Added local simulation job creation, planning and status transitions
- [x] Added signed-session production guard groundwork and PostgreSQL core schema

### NEXT
- [ ] Add integration tests for signed sessions, job transitions and local persistence
- [ ] Replace local simulation persistence with PostgreSQL repositories and real auth
- [ ] Complete maintenance, fuel, compliance, POD and customer command mutations
- [ ] Reduce remaining legacy ESLint warnings and dependency vulnerabilities
- [ ] Verify all major modules in browser at desktop/mobile/RTL sizes

### FUTURE
- [ ] Telematics and routing provider adapters
- [ ] PWA/offline driver workflows
- [ ] Audited AI recommendations after event quality is proven

## Current Session

**Start**: Aug 21, 2026
**Dev Server**: http://localhost:3003 ✅ Running (`npx next dev -p 3003`)

### P0 hardening complete (Aug 21)
- Fixed stale NumberInput/CellNumber drafts (null-draft pattern, no effects)
- Fixed UTC date bug — shared `toDateString()` local-time helper (report keys + projections)
- Archived 67 orphaned files / ~17.9k LOC → branch `archive/v2026-modules`; repo now ~6k LOC of live code
- Pruned 12 unused deps (plotly, leaflet, framer-motion, dompurify, canvg, clsx, tailwind-merge, cva, html2canvas, xlsx…); added exceljs
- Rewrote Excel export on exceljs; removed unpkg Leaflet link + dead CSS overrides
- Tightened CSP: no external origins, unsafe-eval dev-only
- All gates green post-change: build ✓ tsc ✓ eslint 0/0 ✓ vitest 40/40 ✓ python 25/25 ✓ NTFS binaries verified ✓

### Stress test results (Aug 21)
- **HTTP (prod standalone)**: page 344 rps p50 45ms; health 447 rps; zero errors at c=100 spike
- **Fixed**: NaN/∞ engine contamination → `sanitizeFinancialInput()` boundary clamp; O(n²) driver sync (23.5s @ 50k) → O(n); roster 160k `<option>` nodes → shared datalist (fleet view 11.3s → 1.16s jsdom)
- **Kept as regression guards**: `src/lib/__tests__/stress.test.ts` + `src/__tests__/ui-stress.test.tsx` (57 vitest tests total now)
- **Known/deferred**: snapshot API ships ~923KB JSON (~41 rps, p50 ~650ms) — demo endpoint for archived v2026 modules; shrink payload when they return. sharp/libvips CVEs inherited from next@16.

### Web-researched recommendations (Aug 21)
- **Applied**: next 16.3.1 (9 CVEs cleared), sharp override ^0.35.3 (GHSA-f88m-g3jw-g9cj), transitive audit fixes. Prod audit: 2 moderate left (uuid via exceljs — accepted, not attacker-facing).
- **Next.js 16.3+ auto-generates AGENTS.md** managed block on `next dev` — don't hand-delete; commit it.
- **Backlog, referenced**: TanStack Virtual if tables need >1k rows; IndexedDB for daily records when localStorage ~5MiB becomes real; NDJSON/section-filtering for the 923KB snapshot endpoint; scenario-comparison UX per ProjectionLab/cinder patterns (baseline + what-if overlays, side-by-side deltas).

### Portless setup (Aug 21)
- App now runs behind [portless](https://github.com/vercel-labs/portless): **http://vega.localhost:8080**
- Proxy mode: `--no-tls --port 8080` (HTTPS/443 needs interactive sudo for CA trust — unavailable here; browsers resolve `*.localhost` → 127.0.0.1 natively)
- Start order matters: `portless proxy start --no-tls --port 8080` (persists config), then `npm run dev:portless`
- Portless assigns a random PORT env (4000–4999); Next.js respects it — no port conflicts with Gitea/lore-engine
- `vega.localhost` added to `allowedDevOrigins`; portless installed globally (v0.15.5)

### P1 delivered (Aug 21)
- **Scenarios view**: save/load/delete named model snapshots + side-by-side compare table with Δ net vs current (`src/lib/scenarios.ts`, `applyFinancialInput` on the hook)
- **Backup/restore**: JSON export/import of inputs+records+scenarios, strict validation (corrupt records dropped)
- **Plan-vs-actual**: `buildMonthlyRollup` monthly variance table under daily history
- **Break-even line** on the 14-day trend chart
- **Removed AppProvider/AppProvider50** from ClientLayout — killed the ~923KB snapshot fetch on every page load; archived 5 newly-orphaned files (AppContext×2, feasibility/rentedFleet/saudi engines .ts)
- Tests now 64; live code ~4.5k LOC

### Next candidates (P1)
- Scenario manager (save/load/diff named scenarios)
- Plan-vs-actual monthly variance report
- i18n decision: wire BusinessModelApp translations or remove i18next
- Un-wrap unused AppProvider/AppProvider50 or wire them properly
- Model backup/restore as JSON export/import

```
vega-logistics-os@0.4.0 /run/media/kalde/186E2FB96E2F8E96/Users/kalde/Downloads/Ai slop/vega-logistics
├── @heroui/react@3.2.1 (extraneous — not in package.json)
├── 38 production deps
└── 10 dev deps
```
