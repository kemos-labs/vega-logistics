# VEGA Product Truth Audit
**Date:** 2026-08-23 · **Method:** full repository read (src/, docs/, workflows, tests) against running app · **Rule:** nothing here is taken from a document's own claim of "done"; every row traces to code that was opened and read during this audit.

---

## 1. What is VEGA today?

A **static Next.js 16 single-page application** hosted on GitHub Pages (`https://kemos-labs.github.io/vega-logistics/`), storing all user data in **browser localStorage** on one device. It is a bilingual (EN/native-Saudi-AR) financial-model-plus-daily-operations workbook for a small Saudi logistics operator: plan a fleet economics model, record each operating day, reconcile misses into a recovery board, export EN/AR PDF/Excel reports, and back up/restore everything through a versioned file envelope.

It is **not** (today): multi-user, multi-device, server-backed, authenticated, realtime, or regulatory-compliant in any certified sense.

## 2. Who can use it today?

One operator, on one browser/device, who:
- runs ~5–50 vehicles as a subcontracted parcel-fleet provider;
- receives daily WhatsApp summaries from providers and keys numbers into VEGA;
- needs Arabic-first UI (Cairo typography, RTL) with English available;
- accepts manual backup-file discipline until optional sync ships (P5/R7 of the master plan).

There is no login, no tenant isolation, no shared state. Two people using two devices see two independent copies of the data.

## 3. What data is real, simulated, seeded, or manually entered?

| Data | Class | Evidence |
|---|---|---|
| FinancialInput (model inputs) | **Manually entered**, defaults seeded from `mockData.ts` | `defaultFinancialInput`; user edits persist to `vega-financialInput-v2` |
| DailyRecord rows | **Manually entered** or **imported from WhatsApp preview after explicit confirm** | `DailyReport` forms; `ProviderImportCard` confirm path |
| Scenarios | Manually created what-if snapshots | `ScenarioView` |
| Recovery entries / follow-up actions | Derived-from-user-input (created when misses recorded) then manually managed | `recoveryBoard.ts`, RecoveryBoard component |
| Telematics positions | **Simulated** — mock adapter only; clearly seam-labelled | `src/lib/platform/telematics/mock.ts`; no live adapter exists |
| Vehicles/zones catalogs | Immutable seed arrays (read-only; their persistence keys were removed in review C) | seed modules; STORAGE_KEYS excludes them |
| Backup reminder stamp / dismissal keys | Device metadata, deliberately outside backups | `backupReminder.ts` |

No production data ships inside the repo beyond illustrative defaults.

## 4. Which modules are fully operational?

Verified by reading implementation + passing test suites (187 tests at audit time):

- **Report engine v2** (`reportEngine.ts`) — plan-vs-actual, variance history, insights with pinned thresholds.
- **Standard & Pro reports** (`ProReport.tsx`, `reportExport.ts`) — EN/AR/both, PDF (jsPDF vector charts, embedded Cairo/IBM Plex Arabic TTFs) and Excel (exceljs, incl. weekly recovery-trend sheet).
- **Recovery board** (`recoveryBoard.ts`) — owners, aging, close-rate, weekly trend, validated entries preserving `updatedAt`.
- **Backup integrity system** (`backup.ts`) — versioned v2 envelope, strict parse, merge/replace/cancel, transactional persistence, legacy-v1 scoped restore, language round-trip. Core accepted after review contracts C–F.
- **Backup-age banner** (`backupReminder.ts`) — pure clock-injected engine + UI banner (commit `da133b8`).
- **Arabic WhatsApp parser** (`providerMessageParser.ts`) — pure deterministic engine + review/confirm card (commit `6d66bf1`); unreconciled totals block confirmation.
- **PWA offline shell** — hand-written service worker; app loads offline after first visit.
- **i18n** — full key parity EN/AR asserted by tests; native operational Arabic (fixed provider vocabulary: تحميل · توصيل · راجع · الفوات · إثبات التسليم · العنوان الوطني).

## 5. Which features are frontend seams only?

- **Telematics**: types + registry + mock adapter exist (`platform/telematics/*`); no real Samsara/Geotab/Traccar adapter; no map UI consumes it yet.
- **Storage repositories seam** (`platform/repositories.ts`, `platform/db`) — interfaces exist so sync can be added later; today every write path is localStorage.
- **Supabase client is installed but unused** — no sync, auth, or RLS anywhere. Its presence in `package.json` is preparation, not capability.

## 6. Which documents overstate implementation?

- `LOGISTICS_OS_SPEC.md` describes microservices/Kafka/Timescale/AI/multi-tenant target architecture — none exists; it is a future-direction paper (see §8–9 below).
- `API_CONTRACTS.md` defines endpoints for a backend that is not deployed; valid as a contract draft only.
- Historical session notes once used phrases like "production ready" for features that were local-only; current governance (AGENTS.md R8, this audit) replaces them. No unsupported claim survives in current UI copy or MASTER_PLAN as of the same-day rewrite.

## 7. Where do data structures mix financial assumptions with operational records?

- `DailyRecord.revenue` is **derived at render time** from `completedShipments × output.avgRevenuePerShipment` — good separation. But the *model* average lives in `FinancialOutput`, and monthly rollups compare recorded revenue to `(totalRevenue/26)×days`: the **26-working-days constant** (`WORKING_DAYS_PER_MONTH`) is an assumption embedded in engine math, not captured data. Ramadan/peak months violate it silently.
- `calculateDailyMetrics` allocates the full monthly fixed cost ÷ 26 to every day regardless of actual attendance — an assumption presented next to recorded fuel cash without labelling which numbers are derived vs recorded.
- Customer breakdown keys mix IDs and raw names (`nameOf.get(id) ?? id`) — acceptable fallback, but it means attribution quality depends on provider naming consistency.
- COD fields on `DailyRecord` (`cashCollectedSar`, `cashRemittedSar`, `codShipments`) sit beside ops counters without a reconciliation invariant enforced at save time — Release R3 (evening close) addresses this.

## 8. LOGISTICS_OS_SPEC.md — what stays valid?

Still-valid direction: domain-driven module boundaries; explicit shipment lifecycle states; POD/COD evidence retention ideas; import/export openness; eventual optional sync with conflict semantics. These survive into the release roadmap.

## 9. What is premature enterprise architecture?

Explicitly deferred (requires business scale + budget justification before any build): Kafka/event bus, Kubernetes, TimescaleDB, microservice decomposition, AI assistants/predictive maintenance, mobile-native apps, multi-company tenancy, ZATCA Phase-2 integration engineering, live telematics infrastructure. None of these appear in any active phase; they live under "Future evaluation — do not implement until justified."

## 10. Smallest credible path from today to a daily logistics OS

1. **Close P1 leftovers in one batch** (parser staleness/date/name/warning-localization fixes; reminder baseline) — no new review-contract loops.
2. **Release R1 — Daily Control Tower**: one screen answering yesterday/today/cash/exceptions in <30s, derived purely from recorded data.
3. **R2 — Shipment/stop planning**: minimal stop-level data model, manual entry + safe paste/CSV preview, duplicate detection, explicit confirmation.
4. **R3 — Morning dispatch & manifest**: driver/vehicle assignment, accessible ordering, bilingual printable manifest labelled "operational export".
5. **R4 — Evening close**: guided reconciliation enforcing `loaded = delivered + returned + pending/unexplained` with visible differences; failed stops feed recovery without duplicates; COD expected/collected/remitted/outstanding.
6. **R5 — Compliance-lite**: Short Address format-only validation, National Address completeness flag, configurable-VAT receipt drafts — zero compliance claims.
7. **R6 — Analytics depth** from recorded data only; **R7 — route-lite behind env flag**; **R8 — opt-in sync** last.

---

## Capability matrix (audit verdicts)

| Capability | Verdict |
|---|---|
| Fleet economics model + scenarios | Production (local-only persistence) |
| Daily ops entry + plan-vs-actual | Production |
| Standard/Pro reports PDF+Excel EN/AR | Production (Arabic PDF shaping not owner-visually confirmed) |
| Recovery board | Production |
| Backup v2 export/import/merge/replace | Production |
| Backup-age banner + WhatsApp parser | Shipped this cycle; pending owner live verification |
| PWA offline shell | Working local-only |
| Provider WhatsApp import | Working local-only (manual paste) |
| CSV bulk import (shipments) | Documented-but-absent (planned R2) |
| Stop/route planning | Absent (planned R2/R3) |
| Evening-close guided reconciliation | Absent (planned R4; totals currently advisory) |
| National Address / Short Address capture | Absent (planned R5; format-check only) |
| Invoice/receipt drafts | Absent (planned R5; data-shaped, never "compliant") |
| Driver/customer scorecards | Partially present (customer side live; driver side planned R6) |
| Telematics | Seam + simulation only |
| Sync/auth/multi-device | Absent (planned R8, opt-in) |
| Live tracking / realtime anything | Not built — banned wording until it exists |

**Unsupported claims removed by this audit:** none remained in shipped UI copy; spec documents relabelled (§6). Banned vocabulary henceforth: "production ready", "compliant", "live tracking", "AI-powered", "real-time", "ZATCA compliant", "verified National Address" — outside evidence-backed contexts.
