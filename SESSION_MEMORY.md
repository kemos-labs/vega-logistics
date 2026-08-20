# VEGA Logistics OS — Session Memory

<!-- ===== AUTO-LOADED BY AGENTS.md ===== -->
<!-- This file is read automatically on every agent session start. -->

## Project Identity

| Field | Value |
|-------|-------|
| **Name** | VEGA Logistics OS / Levered Beta Logistics |
| **Version** | `0.4.0` |
| **Stack** | Next.js 16.2.6 + Turbopack + Tailwind CSS v4 + TypeScript 5 |
| **Path** | `/run/media/kalde/186E2FB96E2F8E96/Users/kalde/Downloads/Ai slop/vega-logistics` |
| **Dev Server** | `http://localhost:3002` (port 3000 taken by Gitea) |
| **Build Status** | ✅ PASSING — `next build` compiles, TypeScript clean (exit 0) |
| **Python Tests** | ✅ 25/25 passing (calculations: 9, feasibilityEngine: 10, ghostGrowth: 6) |
| **ESLint** | ✅ 0 errors, 204 warnings (mostly unused vars in `v2026/*` + legacy `AppContext.tsx`) |
| **Git** | 2 commits |

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
npm run dev    # starts on :3000, we use :3002

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
2. **Port 3002** — Port 3000 occupied by Gitea on this machine
3. **lightningcss `^1.25.0`** — Both `devDependencies` and `optionalDependencies` pinned to `^1.25.0`; v1.32.0 binaries are corrupted on NTFS. `package-lock.json` is stale — regenerate after `npm install`.
4. **SSR: false** — All 30+ modules use `next/dynamic` with `ssr: false` for SPA performance
5. **Dark only** — No light mode; theme is forced dark
6. **Arabic/RTL** — Supported via `react-i18next` with `html[dir='rtl']`
7. **BreakEvenAnalytics uses @heroui/react** — The only component using this library (Button, Card)

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

**Start**: June 20, 2026
**Dev Server**: http://localhost:3002 ✅ Running

```
vega-logistics-os@0.4.0 /run/media/kalde/186E2FB96E2F8E96/Users/kalde/Downloads/Ai slop/vega-logistics
├── @heroui/react@3.2.1 (extraneous — not in package.json)
├── 38 production deps
└── 10 dev deps
```
