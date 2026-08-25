# VEGA Logistics OS — Master Plan
**Status:** ACTIVE · **Authority:** this file is the execution roadmap · **Evidence base:** `RESEARCH_DOSSIER.md` (verified register) · `PRODUCT_TRUTH_AUDIT.md` (capability truth) · `KSA_COMPLIANCE_MATRIX.md` · `KPI_DICTIONARY.md` · `OPERATOR_WORKFLOW.md` · `COMPETITOR_AND_TOOLS_MATRIX.md` · `DATA_MODEL.md`

Claim discipline: **[REG]** regulatory w/ primary source · **[BM]** external benchmark w/ source · **[INT]** VEGA internal target · **[H]** operator hypothesis awaiting validation. Work is tracked by **product releases**, not review contracts.

---

## 1. Product promise

> One Arabic or English workspace that tells the owner, in under 30 seconds: what was planned, what was delivered, what failed, what cash is outstanding, what needs recovery, which vehicles/drivers need attention, and what must happen next.

Success measure: a Saudi owner runs tomorrow's operation more reliably, with less spreadsheet/WhatsApp confusion, zero unnecessary infrastructure cost, and full clarity about what the software can and cannot guarantee.

## 2. Where we are (audited — details in PRODUCT_TRUTH_AUDIT)

Shipped and verified: fleet-economics model + scenarios; daily ops entry with plan-vs-actual engine; Standard/Pro EN-AR reports (PDF vector + Excel); recovery board; native Saudi Arabic UI (Cairo, RTL law); PWA offline shell; backup v2 integrity system (merge/replace/cancel, transactional writes, legacy scoped restore) **accepted**; backup-age banner (`da133b8`); Arabic WhatsApp provider parser with review-gated confirm (`6d66bf1`). Seams only: telematics (mock), repositories/sync interfaces. Absent: stop-level planning/dispatch/close workflow, compliance-lite fields, driver analytics.

**P1 is closed** as of the Foundation commit (see R0). No further alphabetic review-contract loops.

## 3. KSA ground truth (sourced — full citations in dossier)

| Fact | Class | Consequence |
|---|---|---|
| From 1 Jan 2026 TGA bars carrying postal shipments without recipient National Address; fines SAR 5,000–50,000 | [PRIMARY] TGA news 198 | R5 address capture + manifest fields; no "verified" claims |
| Short Address = 4 letters + 4 digits | [PRIMARY] SPL | format-only validator |
| VAT standard rate 15% (VAT Law Art.2 verbatim Arabic; effective 1 Jul 2020) | [PRIMARY] ZATCA law PDF | `vatRate` default source-backed, configurable; drafts only |
| ZATCA Phase 1 live since Dec 2021; Phase 2 waves w/ ≥6-month notices | [PRIMARY→VERIFY mechanism pages] | data-shaped receipts; never "compliant" |
| GASTAT 2024: parcels >180M (+~29% YoY), delivery-app orders 288.1M, sector on-time 96%, avg delivery ~2 days | [OFFICIAL STATISTICS] GASTAT W&L 2024 | market context only — never internal targets |
| COD: cash = 25% of consumers' last online purchase (survey share, not value) | [PRIMARY] SAMA 2023 p.24 | COD reconciliation stays core |
| Ramadan surge real: 26M+ parcels Ramadan 1446 (+18% YoY), 1.1M peak day | [PRIMARY] SPA/TGA 2025-03-29 | season mode = manual plan multiplier |
| Last-mile up to 50% of logistics costs; ~40% of demand outside major urban centres | [VENDOR] Grant Thornton KSA | motivates non-Riyadh-friendly simplicity |

## 4. Targets — three registers

**Benchmarks [BM]:** APQC e-POD median 80.0% (n=1,144). Parcel Perform 99.22% US-domestic `[VENDOR]` — explicitly not KSA/small-fleet comparable.
**Internal [INT]:** completion ≥90% (stretch 95%) · miss ≤8% warn/≤3% healthy · ePOD ≥98% · recovery close ≥50%, >7d hot · fuel alert >115% model day · cost/stop ±10% of rolling 4-week baseline · COD remit lag ≤2 working days.
**Hypotheses [H]:** all workflow assumptions in OPERATOR_WORKFLOW.md until first real operator session.

---

## 5. Release roadmap

### R0 — Foundation: close P1 once (this cycle)
Batch-close the remaining parser/reminder defects in ONE commit, then freeze P1:
- [x] stale preview cleared when source text edited after parse
- [x] blank/invalid record date can never be confirmed
- [x] overwrite acknowledgement required for ANY existing date record (not only "valued" ones)
- [x] greetings/chatter stripped from driver-name extraction («السلام عليكم», «صباح الخير», «الحمد لله»…)
- [x] conflicting duplicate term values warn instead of silently taking first
- [x] parser warnings localized EN/AR (no raw tokens in UI)
- [x] reminder baseline uses LOCAL calendar days for dismissal (timezone law), dead code removed
- [x] modified model inputs count toward reminder eligibility (meaningful-data check)
- [x] governance reset (AGENTS durable-only, SESSION_MEMORY status moved out)
**Accept:** unit+UI tests per fix; gates green; deployed. ✅

### R1 — Daily Control Tower *(shipped this cycle — live verification pending owner)*
- [x] `src/lib/controlTower.ts` pure snapshot builder (8 tests) + `ControlTower.tsx` view (4 tests)
- [x] tower is the default landing view; nav entry «غرفة العمليات / Control Tower»
- [x] tiles: yesterday planned/delivered/failed/recovered (honest no-data), COD outstanding, recovery open+overdue, POD gaps, backup staleness
- [x] top-3 severity-ordered actions linking to daily/recovery/backup workflows
One home workspace answering the promise <30s: yesterday planned/delivered/failed/recovered; unreconciled differences; today's readiness; COD outstanding; POD gaps; open exceptions + recovery aging; backup staleness; top-3 actions.
Requirements: EN/AR; 375px mobile no overflow; honest empty/local-only states; everything derived from recorded data; every tile links to its corrective workflow.
**Accept:** component tests per tile; RTL visual check; live deploy verify.

### R2 — Shipment & stop planning *(shipped: R2-A `6b61b45`, R2-B this commit — owner live review pending)*
- [x] StopRecord domain (`stops.ts`): validation w/ field-level errors, normalize/create/update, stable day sort, duplicate identity hierarchy (reference → fingerprint; exact/conflict/probable; absence ≠ contradiction)
- [x] `vega-stops-v1` persisted via transactional seam; backup envelope v3 (v2/v1 migration preserves stops; Replace gated lossless)
- [x] StopPlanning workspace: date filter, search, manual add/edit w/ inline validation + focus, delete confirmation, totals, status chips, privacy + local-data copy (EN/AR)
- [x] Bulk paste/CSV: BOM, quotes, CRLF/TSV, Arabic headers+aliases, digit normalization, caps, binary rejection, unknown-header reporting, preview counts, atomic confirm, stale-preview invalidation, persistence-failure keeps preview open
**Accept:** import-cannot-mutate-on-reject tests; migration fixtures; backup envelope v3 round-trip.

### R3 — Morning dispatch & manifest *(shipped this cycle — owner live review pending)*
- [x] `dispatch.ts` pure domain: dispatchable = planned/pending ONLY (history never reassigned); active-driver adapter over the existing `FinancialInput.drivers` catalog (no second source of truth); assign/reassign/unassign preserving status+unrelated fields; gapless 1..N resequencing; boundary-safe move up/down; per-run workload (count/COD/windows/missing address/phone/reference)
- [x] DispatchBoard view: date selector, unassigned queue w/ accessible assign selects (aria-labels), per-run sections w/ keyboard-operable ▲/▼ + unassign, workload lines, transactional writes
- [x] Print-first bilingual driver sheet: ordered stops w/ all operational fields, per-run totals, signature/notes area, mandatory disclaimer «مستند تشغيلي داخلي — ليس مستند نقل نظامياً ولا يثبت صحة العنوان الوطني» + English equivalent on every page; no government seals/compliance styling; print CSS (repeating headers, unsplit rows, app chrome hidden)
- [x] Persistence through the existing stops key + v3 backups (assignments/sequence round-trip; no schema change, no version bump)
- [x] Opt-in keyless Maps aid on stop rows (this cycle): free Google embed iframe (`maps.google.com/…&output=embed`, no API key/billing) + always-present "open in Google Maps" fallback link; iframe renders only with build-time `NEXT_PUBLIC_MAPS_EMBED=on` (default OFF = zero network, CSP frame-src stays closed); lazy load on tap; bilingual labels
**Accept:** dispatcher prints a practical day plan <1 min, zero network calls.

### R4 — Evening close & exception loop *(R4-C stabilization this commit; owner review pending — NOT marked shipped until accepted)*
- [x] Close domain (`eveningClose.ts`): invariant with signed difference, failed-attempt mapping (metadata over pending/returned), COD formulas incl. visible over-remittance credit, recovery idempotency by stopId, draft/definitive predicate
- [x] DailyRecord close fields (optional, sanitized in backups, no version bump); RecoveryEntry.stopId
- [x] EveningClose guided UI: outcome buttons w/ reason picker, live signed difference, blocker list (role=alert), draft/reconciled/reopen flows, COD warnings, transactional daily+stops+recovery commit
- [x] KPI protection: drafts excluded from definitive metrics; tower prompts unfinished drafts (draft indicator on close screen; tower action lands with R6 polish)
**Accept:** invariant tests incl. impossible dates/timezones; blocked-unresolved-difference UI test.

### R5 — Compliance-lite data readiness *(code shipped this cycle — owner live review pending)*
- [x] Primary sources rechecked live: SPL short-address page (4 letters + 4 digits) [PRIMARY]; ZATCA QR guide PDF (TLV tags 1–5, base64, UTF-8) [PRIMARY]
- [x] `src/lib/compliance.ts` pure domain: format-only Short Address validator; National Address completeness flag; draft receipt builder (configurable `vatRate`, default 15 [REG]); Phase-1-shaped QR TLV payload reproducing the official ZATCA worked example byte-for-byte (15 tests)
- [x] Compliance-lite workspace view (`ComplianceLiteView.tsx`) wired into nav («جاهزية البيانات / Compliance-lite»); EN/AR locale parity; Arabic copy native (no calque), Latin digits; disclaimers on every surface
- [x] R8 lint-time grep test: prohibited claim strings absent from both locale trees (7 UI tests)
- [x] Rust migration evaluated and REJECTED (see §5.5 note below Future evaluation)
Short Address format validation; National Address completeness flag; document-expiry reminders where justified *(deferred within R5 — no expiry-bearing document class recorded yet)*; configurable-VAT receipt drafts (default 15 now [REG-backed]) + Phase-1-shaped QR payload; disclaimers everywhere; PDPL minimization labels.
**Accept:** no prohibited claim strings (lint-time locale grep); validator tests; EN/AR receipt render.

### R6 — Operational analytics *(code shipped this cycle — owner live review pending)*
- [x] Driver scorecard: `buildDriverPerformance()` aggregates stops by driver identity (driverName + carNumber + plateNumber), worst miss rate first, with trailing-7-day trend; rendered in ProReport with EN/AR labels + empty state
- [x] Customer scorecard: exists (`buildCustomerPerformance`), rendered in ProReport with trend
- [x] COD remittance-lag trend: `buildCodRemittanceLag()` computes days between operation date and remittance date per day; rendered in ProReport with EN/AR labels + empty state
- [x] Cost-per-delivered-stop: exists (`buildCostPerStopSeries`), rendered in ProReport
- [x] Fuel control: `buildFuelControl()` compares daily fuel cost vs model daily expectation with variance %; rendered in ProReport with EN/AR labels + empty state
- [x] Recovery aging/close-rate: exists (`summarizeRecoveryBoard`, `buildWeeklyRecoveryTrend`), rendered in ProReport
- [x] Failure Pareto: `buildFailurePareto()` computes count + share + cumulative share; rendered in ProReport with EN/AR labels + empty state
- [x] Every metric: definition + denominator + empty/insufficient states + drilldown + Arabic labels + tabular alternative
- [x] Recorded-data-only provenance tests for all new metrics
**Accept:** recorded-data-only provenance test per metric. ✅

### R7 — Route-lite (evaluate AFTER local loop stable)
Offline manual ordering ships first (R3). Optional OSRM suggestion behind `NEXT_PUBLIC_OSRM_URL`: CSP origin named, OSM attribution visible, timeout fallback, manual order always recoverable, demo-endpoint reliance banned for production.

### R8 — Optional sync (last)
Supabase free tier behind `NEXT_PUBLIC_SYNC=supabase`: magic-link auth, RLS owner-only, KSA-region project (PDPL transfer gate), local-first boot path, outbox retries, record-level conflict preview, tombstones, account/data deletion path, privacy note shipped in-app.

### Future evaluation — do NOT implement until justified
Traccar telemetry; maintenance work orders; customer tracking portal; WhatsApp Business outbound (pricing NOT RESEARCHED); vehicle inspections; AI assistant; predictive maintenance; carbon reporting; full ZATCA Phase-2 integration; multi-company tenancy. Seams stay clean; none distract from daily operations.

### Rejected alternative — Rust migration (decided this cycle)
"Run the app in Rust" reviewed against all options; **full rewrite rejected**. (1) Rewrite of TS/React UI+logic: discards 325 passing tests, backup v2/v3 migrations, and RTL/parity work for zero operator outcome — fails simplicity budget. (2) Domain logic → WASM: no measurable gain at 5–50 vehicle scale; adds a second toolchain and native-binary fragility class (NTFS mount hazard). (3) Rust backend server: contradicts local-first / zero-infrastructure thesis pre-R8. (4) **Tauri desktop shell** (Rust webview host around existing app, zero code rewrite): the only acceptable path *if* true offline-desktop distribution is ever needed — deferred as a post-R8 candidate requiring explicit owner approval before planning.

## 6. Free-stack decisions (locked)

GitHub Pages hosting · self-host-path OSRM/VROOM · Traccar (future) · Supabase free tier opt-in (pause-aware, no keep-alive hacks) · Nominatim policy-compliant if geocoding ever ships · self-hosted Cairo/IBM-Plex fonts · jsPDF vector charts · exceljs. **Banned:** paid SaaS without approval · CDN loads · litres fuel logic · server-required features pre-R8 · silent CSP loosening.

## 7. Risk register

| Risk | L×I | Mitigation | Signal |
|---|---|---|---|
| localStorage loss | H×H | backups + age banner (shipped) | days-since-backup |
| National Address scope misread | M×H | capture fields; legal scope VERIFY | % shipments missing address |
| ZATCA wave notice | L×H | data-shaped invoices ready | revenue near threshold |
| OSRM/Nominatim policy drift | M×L | env-flag + offline fallback | fetch-failure streak |
| Supabase pause / terms | M×L | local-first + backups are recovery | sync outage reports |
| Operator hypotheses wrong | M×M | interview guide ready; label everything [H] | first operator session |
| RTL/regression quality | M×L | typography laws + parity tests | screenshot diffs |

## 8. Definition of Done (every release)

`tsc clean ✓ · vitest all passing ✓ · lint 0 ✓ · build ✓ · python suite ✓ · git diff --check ✓ · Pages workflow success ✓ · live-site spot-check ✓ · locale parity EN+AR ✓ · docs updated (plan checkboxes, SESSION_MEMORY, DATA_MODEL if schema) ✓ · no unsupported claims introduced ✓`.

Release reports additionally state: user problem solved; research used; decisions; changed files; schema changes/migrations/persisted keys; backup compatibility; AR/EN behavior; browser evidence; tests added + exact total; commit hash; workflow URL; live URL; known limitations; next release.
