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
| **Vitest** | ✅ 71/71 passing (`npx vitest run`) |
| **Git** | 5 commits + `archive/v2026-modules` branch |

| **Live site** | https://kemos-labs.github.io/vega-logistics/ (GitHub Pages, static export) |
| **Git** | remote `kemos-labs/vega-logistics`, branch `main` |

## Deployment
- Workflow: `.github/workflows/deploy-pages.yml` (pre-existing; do NOT add a second Pages workflow — shared `pages` concurrency group cancels runs)
- Pages build strips `src/app/api` (force-dynamic handlers can't export) and relies on `GITHUB_ACTIONS=true` in next.config.ts for `output: export` + basePath `/vega-logistics`
- Local test: `GITHUB_ACTIONS=true GITHUB_REPOSITORY=kemos-labs/vega-logistics npx next build` → inspect `out/`

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

### Dashboard depth: 4 new analytical panels (Aug 21)
- Summary dashboard now renders, all from real engine output (no mock data): **Customer concentration** horizontal bars (top 8 by revenue, share %, colored by provider rating good/average/bad), **Profit waterfall** SVG (revenue → fleet/people/facilities/per-shipment/other → net, compact SAR labels), **Capacity & cash gauges** (daily volume vs break-even, cash runway /12mo meter, fleet utilization), and a **fuel × volume sensitivity grid** (5×5 matrix of net margin % — every cell re-runs `calculateFinancials` on a cloned input).
- New keys under `businessModel.charts.*` in both en/ar locales; CSS appended to business-model.css (`.bm-cust-*`, `.bm-waterfall`, `.bm-gauge*`, `.bm-sens`). Waterfall built with reduce (React Compiler-safe, no render-scope mutation). All gates green.

### i18n wired + Supabase data layer scaffolded (Aug 21)
- **i18n DECIDED & DONE**: `BusinessModelApp` fully translated via `useTranslation` — new `businessModel` section in `public/locales/{en,ar}/translation.json` (~170 keys each). Header language toggle (العربية/English) dispatches `vega:set-language`; ClientLayout listens and flips dir/RTL. Locale-aware SAR/date formatting (`ar-SA-u-nu-latn` keeps Latin digits). Risk levels now stable keys ('critical'/'high'/'controlled') translated at render. RTL CSS tweaks appended to business-model.css. Tests still pin English strings (default en) — all 64 legacy tests unchanged.
- **Supabase scaffold** (`src/lib/platform/db/` + `repositories.ts`): `@supabase/supabase-js` added (pure JS, 0 native .node binaries — NTFS safe). `db/schema.sql` = Postgres schema + RLS (auth.uid-owned rows) mirroring the 3 localStorage keys; `db/client.ts` = lazy env-gated singleton; `ModelRepository` interface + LocalModelRepository (today's behavior) + SupabaseModelRepository (defensive row mapping) + `resolveRepository()` factory (Supabase iff configured + signed in, else local). 7 new repository tests → **71 total**.
- **NEXT for backend**: wire `useSimulatedData`/`useLocalStorage` call sites through `resolveRepository()`; add Supabase auth (magic link) + session bridge into platform/session.ts; run schema.sql in a Supabase project; set NEXT_PUBLIC_SUPABASE_URL / ANON_KEY.

### Review + 2025 tooling research (Aug 21)
- **Fixed fleet/driver sync race**: `changeVehicle`/`removeVehicle` captured `nextTotal` inside the `setVehicleClasses` updater and used it synchronously — only worked because the hook invokes updaters eagerly. Next list now computed outside the setter (`enabledTotal` helper).
- **Follow-up actions persisted**: moved from `useState` to `useLocalStorage('vega-followup-actions-v1')`.
- **2025 tools research saved** → `docs/2025-tools-review.md`. Headline picks: **Supabase** for the backend (RLS ↔ authorization.ts groundwork), **Workbox+Dexie.js** for PWA/offline, **MapLibre GL JS** for maps, **Samsara/Geotab** telematics adapters, **Vercel AI SDK + LangGraph** for audited AI recs, **Better Stack/GlitchTip** for error monitoring.
- All gates green post-change: build ✓ tsc ✓ eslint ✓ vitest 64/64 ✓

### Daily follow-up reporting engine delivered (Aug 22)
- **Engine**: `src/lib/reportEngine.ts` — pure & adaptive: `buildDeliverySeries` (trailing window; bars ONLY on recorded days), `buildTotals`, `deriveInsights` (rule thresholds: target ±2%/85%, miss ≤3% good / >8% bad, fuel >115% of model day, driver shortfall, loss day), `buildReportModel` factory; locale formatters keep Latin digits in AR
- **Two report types** (segmented control in Daily view): Standard = bilingual one-page PDF facts sheet; **Pro** = full-screen WYSIWYG dossier (`ProReport.tsx`): pine cover band + donut completion + SVG stacked delivered/missed vs target-line chart (14d) + insights + monthly variance table + window history table; EN⇄AR toggle inside preview rebuilds everything live
- **Bilingual PDFs**: `reportExport.ts` rewritten — `ReportDoc` class handles RTL column mirroring + Helvetica/PlexArabic style mapping ('semibold'→'bold'); Arabic via self-hosted IBM Plex Sans Arabic TTFs (`public/fonts/`, OFL) fetched same-origin → base64 → jsPDF VFS (CSP-safe); pro exporter draws vector KPI cards, stacked-bar chart w/ brass target ticks, insights box, 2-page tables, page footers
- **Print pipeline**: preview Print button → A4 @media-print rules hide app, only sheet prints (browser-perfect Arabic shaping as fallback to jsPDF)
- `NEXT_PUBLIC_BASE_PATH` env added in next.config for GH Pages font URLs
- Tests: +10 engine tests (series truthiness, totals, adaptation/noRecords, insight bands, formatters) → **81 vitest total**
- Gates after: build ✓ tsc ✓ eslint 0/0 ✓ vitest 81/81 ✓ fonts served 200 ✓

### Reporting engine v2 + research-driven recovery loop (Aug 22, later pass)
- **Richer daily inputs** (user demand: "not enough input"): 7 structured miss-reason counters w/ reconciliation chip (`Σ reasons vs failed`), extra costs, customer visits, weather select, **recoveredShipments** (previous misses re-delivered today)
- **Tri-state report language**: EN / العربية / **EN+AR bilingual** — stacked dual-language headings/KPI labels/table headers in preview AND PDFs (`ReportDoc.dual()`, `bilingual?: boolean` on ReportModel); both fonts embedded when bilingual
- **Executive narrative**: `buildNarrativeFacts` → localized sentences (lead/target-gap/miss-reasons/fuel/crew/extras/visits/recovered) rendered in preview + PDF
- **Miss-analysis panel/chart**: reason bars in preview; vector red bars in pro PDF
- Engine: `aggregateFailureReasons`, totals.{extraCosts,customerVisits,recovered,reasonTotals}, insights topMissReason/extraCosts/visitsLogged/recoveries
- **Web research → docs/daily-ops-painpoints.md**: #1 pain = no failed-delivery recovery loop (done), then recovery board, per-customer breakdown, POD status, cost-per-stop; Fleetbase/VROOM/Traccar noted as pattern sources
- Tests: +3 (reason aggregation, zero-counter filtering, narrative adaptation) → **84 vitest**
- Gates: build ✓ tsc ✓ lint 0/0 ✓ vitest 84/84 ✓ dev 200 ✓

### Fuel-in-cash migration + research-driven report standard (Aug 22, pass 3)
- **fuelLitres → fuelCost (SAR)** across model/engine/forms/PDF/Excel/repositories/schema.sql; `migrateDailyRecords()` converts legacy v2 records at stored pump price on load; rollup no longer needs price param
- **Report-writing research applied** (docs/logistics-deep-research.md): RAG status chip (`deriveStatus`: red=bad insight/safety incident, amber=warn, else green) in preview cover + PDF meta; Fleet & Crew block (drivers present/planned, fuel vs model day SAR, incidents, extras); `safetyIncidents` counter → red-flag insight (unshifted first); open follow-up actions w/ owners listed in dossier; `tomorrowNote` field → "Next-day focus" section (standard closing)
- **Deep research docs**: docs/daily-ops-painpoints.md (pain→feature map) + docs/logistics-deep-research.md (industry flow, 3PL/4PL, WMS/TMS/dispatch/telematics/ePOD categories, integration spine, VEGA positioning)
- Gates: build ✓ tsc ✓ lint 0/0 ✓ vitest 84/84 ✓

### Recovery board delivered — #1 industry pain point (Aug 22, pass 4)
- **New view** `Recovery Board` (nav item w/ pending-count badge): log missed shipments → owner + reason + customer → mark recovered / write off / reopen / remove
- `src/lib/recoveryBoard.ts`: typed entries, defensive `validateRecoveryEntries` (localStorage junk-proof), `summarizeRecoveryBoard` (pending/recovered/written-off/close-rate/oldest-pending age), `sortForAction` (pending first, oldest top)
- Persisted `vega-recovery-board-v1`; chips show open count · close rate · oldest pending age
- **Pro report integration**: recovery snapshot section (preview panel + PDF) via `model.recoveryBoard` attached at open time; **cost-per-delivered-stop** added to Fleet & Crew block (preview + PDF)
- Tests +7 → **91 vitest**; gates all green

### Company costs view reorganized (Aug 22, pass 5)
- Vehicles & fuel card: total badge in header, computed-note, editable quantity per row (driver-synced via changeVehicle), **2 live computed columns** — Fuel SAR/mo & Row total SAR/mo — formulas mirror calculations.ts exactly (`qty × km/100 × L/100km × price × 26`, global-input fallbacks), so columns always reconcile with model readouts
- Each cost group card ends with a **section-total footer**: subtotal from costBreakdown + share-of-costs mini bar
- CSS: 8-col grid w/ min-width scroll on mobile; `.bm-computed` mono right-aligned; RTL mirrored alignment
- Gates: build ✓ tsc ✓ lint ✓ vitest 91/91 ✓

### Customer scorecards + POD tracking (Aug 22, pass 6)
- **Customer breakdown input**: Daily view card lists enabled providers w/ delivered/missed CellNumbers + attributed-share chip (`Σ attributed vs completed`); stored on `DailyRecord.customerBreakdown` (per-providerId, partial attribution allowed)
- **POD status**: segmented control (complete/partial/none) per day → dispute-risk signal
- Engine: `buildCustomerPerformance()` aggregates all recorded days worst-first; ReportModel.customerPerformance; totals.podIncompleteDays; insights `customerMisses` (bad >15%, warn >8% w/ ≥10 attempts) + `podGap`
- Pro dossier: Customer scorecard table (worst first, EN/AR/both headers), POD line in Fleet & Crew block, both in preview + PDF
- Tests +4 → **95 vitest**; gates all green
- Remaining roadmap: recovery board deep-link in PDF, cost-per-stop trend over time

### Deep-research loop #2 → recovery SLAs + cost-per-stop trend (Aug 22, pass 7)
- Research rounds: exception-management playbooks, cost-per-stop economics, customer-health weighting, Saudi COD/RTO context → docs/daily-ops-painpoints.md updated
- `recoveryBoard.ts`: RECOVERY_TARGETS {closeRate≥50%, overdue>7d}, entryAgeDays(), summary.overdueSharePercent
- Board UI: overdue % chip (amber), oldest chip (red), target hint line, hot rows (>7d pending) w/ age badge
- Engine: buildCostPerStopSeries() — fully-loaded daily cost (allocation+fuel cash+extras) ÷ completed stops, chronological
- Pro dossier: cost-per-stop SVG sparkline (preview) + vector polyline (PDF); full open-recovery table in PDF (date/shipments/owner/days-open, overdue red)
- Fixed a brace-eating regression from pass-3 prop threading (TS1005)
- Gates: build ✓ tsc ✓ lint 0/0 ✓ vitest 95/95 ✓ dev 200 ✓

### Preview panels restored + trend/POD share finished (Aug 22, pass 8)
- **Root cause found**: several earlier ProReport preview patches silently failed (python .replace without assert) — chart→insights gap had NO miss-analysis/scorecard/sparkline/recovery/fleet-crew/open-actions panels
- Rebuilt with assert-guarded patch: preview now has miss-analysis bars, customer scorecard w/ trend arrows (▲▼ vs trailing-7d, ≥1pp threshold), cost-per-stop sparkline w/ tooltips + last-value badge, recovery snapshot (bilingual in both mode), fleet & crew block (drivers/fuel-vs-model/incidents/cost-per-stop/extras/POD share), open actions w/ owners; insights resolve reasonKey names + AR line in both-mode
- Engine: CustomerPerformanceRow.recentMissRatePercent/trendDelta (trailing-7d vs lifetime); totals.podTrackedDays/podIncompleteDays
- PDF: scorecard trend glyph column, POD share row — verified present
- Tests +3 → 98 vitest; gates all green. LESSON: always assert python patches.

### Weekly recovery trend + Excel scorecard/recovery sheets (Aug 22, pass 9)
- `buildWeeklyRecoveryTrend(entries, weeks=4, now)` — ISO-Monday buckets of resolvedAt; recovered vs written-off shipments, oldest first
- Recovery Board view: nothing new needed (chips cover it); **Pro dossier**: weekly mini-bars (pine=recovered, brass=written-off) in preview + PDF under the recovery snapshot
- **Excel export extended**: optional extras param {records, recoveryEntries} → 'Customer scorecard' sheet (delivered/missed/attempts/miss%/trend pp) + 'Recovery board' sheet (created/shipments/reason/customer/owner/status/days-open); Daily view passes live draft+history+board
- Tests +2 → **100 vitest**; gates all green
- Roadmap fully cleared; next candidates: COD/prepaid split fields, telematics adapter seam, PWA offline

### Bun verdict + COD/prepaid split (Aug 22, pass 10)
- **Bun**: keep npm as package-manager source of truth (CI pins npm ci+lockfile; NTFS native-binary corruption history) — bun fine as fast script runner/bunx only
- **COD split shipped**: DailyRecord.{codShipments,prepaidShipments,cashCollectedSar}; form inputs in ops-extras; totals aggregation; narrative paymentsLine fact; Fleet&Crew dd rows; PDF rows; Excel daily sheet columns
- Tests +2 → **102 vitest**; gates all green

### PWA manifest + telematics adapter seam (Aug 22, pass 11)
- **PWA step 1**: `src/app/manifest.ts` metadata route (name/short_name/standalone/pine theme) + generated brand icons (public/icons/icon-{192,512}.png via sharp from scripts/brand-icon.svg); /manifest.webmanifest live
- **Telematics seam**: `src/lib/platform/telematics/{types,mock,index}.ts` — TelematicsAdapter interface (listVehicles/getVehicleTelemetry/getDriverDayStats), deterministic mock adapter (seeded pseudo-random, Riyadh bbox), resolveTelematicsProvider() factory gated on NEXT_PUBLIC_TELEMATICS env (vendor branches pending); sidebar bm-source now shows "Telematics: demo simulator" truth instead of hardcoded no-connections text
- Tests +3 → **105 vitest**; gates all green
- Remaining roadmap: real Samsara/Geotab adapter, service worker offline (PWA step 2), COD remittance lag tracking

### PWA offline shell + COD remittance (Aug 22, pass 12)
- **Service worker** (public/sw.js, hand-rolled — no build-plugin dependency under Turbopack): navigations network-first w/ cached-shell fallback; _next/static + icons cache-first w/ bg refresh; /api/* never cached; version-stamped cache cleanup. Registrar component prod-only (HMR-safe), mounted in BusinessModelApp; scope './' so GH Pages subpath works
- **basePath bug fixed**: manifest icons now prefix NEXT_PUBLIC_BASE_PATH (would have 404'd on GH Pages); start_url '.'
- **COD remittance**: DailyRecord.cashRemittedSar → totals.cashOutstandingSar (collected−remitted); form input; Fleet&Crew dd (red when >0); PDF row ordered after collected; Excel column
- Tests +1 → **106 vitest**; gates all green; sw.js 200

### Driver/plate fields + provider 3-day Excel (Aug 22, pass 13)
- **DailyRecord.{driverName,carNumber,plateNumber}**: form inputs at top of Actual Ops; Fleet & Crew dossier dd (driver · car · plate); PDF identity line; Excel Daily sheet rows
- **Provider data mapped** (terminology: تحميل=loaded/attempts, توصيل=delivered, راجع=returned): Yaquob Abdulqader, car 10 — 20/8 plate 4684 (25/16/9, cash→warehouse ✓), 21/8 plate 4468 as-reported (26/21/5, cash ✓), 22/8 no shipments at warehouse
- `scripts/make-provider-report.mjs` → reports/provider-daily-report-2026-08-20_22.xlsx (RTL sheet, pine header, totals row: تحميل 51 · توصيل 37 · راجع 14 · 72.5%)
- Gates: build ✓ tsc ✓ lint ✓ vitest 106/106 ✓

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
