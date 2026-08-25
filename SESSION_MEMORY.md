# Session Memory — VEGA Logistics OS

> Governance: `AGENTS.md` (durable rules) · Roadmap: `docs/MASTER_PLAN.md` · Claims: `docs/RESEARCH_DOSSIER.md` · Truth audit: `docs/PRODUCT_TRUTH_AUDIT.md`

## Driver identity + pre-close reports cycle (this commit)
Owner-requested sync slice (early R6): **(1)** `DriverRecord` gains distinct optional `carNumber`/`plateNumber` alongside phone; fleet roster UI gets two new columns (رقم السيارة / اللوحة). **(2)** Dispatch↔catalog sync: `assignableDrivers` carries car+plate; `assignStop` stamps complete identity onto stops (explicit catalog carNumber wins over legacy free-text `vehicle`, plate from catalog) → evening-close outcomes keep it → reports group runs by full driver+car+plate identity. **(3)** Reports before close: a date with recorded stops but no DailyRecord now shows honest per-driver delivery counts (stop-derived only — collected/remitted stay ABSENT, never zero-filled; print/export remain gated on a definitive close). Tests: +7 (dispatch identity propagation ×2 + fallback, backup old/new-format driver fixtures, pre-close reports UI ×3) → 389 total (35 files). Locale parity 1247↔1247 (`fleet.colCarNumber`, `fleet.colPlateNumber`, `reports.noCloseNote` both trees, native Arabic).

## Hygiene cycle (previous commit)
Full-app review follow-up, zero behavior change intended: (1) stale June-era root docs moved to `docs/archive/` with a README marking them non-authoritative — R9 hazard removed; stray dev logs deleted; (2) all 22 eslint warnings cleared — dead ~200-line `DailyReport` + `MonthlyVariance` components, unused imports/states/helpers in BusinessModelApp/StopPlanning/eveningClose/stops, mock-signature typing in 6 test files (vi.fn generics replace unused rest params); (3) dead empty locale key `businessModel.recovery.thActions` removed from BOTH trees (R3 parity 1244↔1244); (4) unnecessary `as never` cast dropped at backup-banner dismissal.
## Current state
- **Commit:** see `git log -1` · **Deploy:** https://kemos-labs.github.io/vega-logistics/ green
- **Tests:** 389 passing (35 files) · tsc clean · eslint 0 problems (0 warnings) · build ✓ · python suite ✓
- Dev URL: http://vega.localhost:8080 (`localhost:3002` = unrelated project)

## Completed releases
- **P0** — model, reports, recovery board, Arabic UI, PWA (prior cycles)
- **P1 backup integrity** — core ACCEPTED (contracts C–F); banner `da133b8`; parser `6d66bf1`
- **R0 Foundation** — P1 batch-close + truth reset + research pass + plan rewrite (this cycle; see below)

## R0 contents (this cycle)
- New docs: PRODUCT_TRUTH_AUDIT, KPI_DICTIONARY, KSA_COMPLIANCE_MATRIX, OPERATOR_WORKFLOW, COMPETITOR_AND_TOOLS_MATRIX, DATA_MODEL; MASTER_PLAN rewritten to releases R1–R8; visual SVG regenerated + render-verified.
- Research upgrades: VAT 15% VERIFY→PRIMARY (VAT Law Art.2 Arabic verbatim); GASTAT W&L 2024 added (>180M parcels, 288.1M app orders, 96% on-time) [OFFICIAL STATS]; PDPL obligations + 72h breach notice + transfer regulation added [PRIMARY].
- Code batch (same cycle): parser stale-preview clear, blank-date block, any-existing-record overwrite ack, greeting/chatter name filtering, conflicting-duplicate-term warnings, localized warnings EN/AR, reminder local-day dismissal baseline + dead-code removal, model-inputs-in-reminder-eligibility. Tests: 6 new (4 engine greeting/conflict + 2 UI stale/blank-date) → 193 total.

## Next release
**R4-C shipped, then R4-D review corrections** (`fix(close)` follow-up): single shared isDefinitiveDailyRecord (+filterDefinitiveRecords) enforced in reportEngine series/totals/monthly/customer/costPerStop/hasHistory too; strict localized parsers (exponent/hex rejected); real-calendar + ISO-timestamp validation in close domain; explicit fuel/attendance review (blank ≠ 0); COD note/remitted-date clearing semantics + remittance-date-required; tower PRIORITY pins draft-close (PROMPT-ONLY — no navigation yet); date-switch single reset helper. R4 NOT marked shipped — pending owner acceptance. **R5 compliance-lite code shipped** (owner live review pending): primary sources rechecked live (SPL short-address page; ZATCA QR guide PDF); `compliance.ts` domain (Short Address format-only validator, National Address completeness flag, draft receipt w/ configurable VAT default 15, Phase-1-shaped QR TLV reproducing ZATCA worked example byte-for-byte) — 15 tests; ComplianceLiteView wired to nav «جاهزية البيانات / Compliance-lite», EN/AR parity, disclaimers everywhere, R8 prohibited-claims locale grep — 7 UI tests; document-expiry reminders deferred within R5 (no expiry-bearing record class yet). Rust migration rejected (MASTER_PLAN §5.5). Tests: 382 passing (33 files), tsc clean, eslint 0 new problems, build ✓. **Next: owner acceptance of R2/R3/R4/R5 live review, then R6 operational analytics.** (30 files), exit 0, zero act warnings.

## This cycle addition
- **Opt-in keyless Google Maps on stop rows** (`StopMap.tsx`): free embed iframe (`maps.google.com/…&output=embed`), no API key, no billing. Iframe renders only with build-time `NEXT_PUBLIC_MAPS_EMBED=on` (default OFF = zero google.com traffic; CSP gains `frame-src https://www.google.com https://maps.google.com` only under the flag — connect-src untouched); "open in Google Maps" fallback link always renders (deep-links Maps app on phones); lazy load on tap; map chrome hl pinned ar/en; bilingual locale keys under `businessModel.stops.map`. Verified live: CSP header correct in both flag states; locales serve new keys.
## Arabic KSA overhaul + locale cleanup (this cycle)
- **Dead relic namespaces removed** (89add81): 17 old mock-era subtrees (aiAgents, digitalTwin, liveFleet, efficiency, …) had zero code refs and carried R8-prohibited wording («Real-Time Efficiency Dashboard», «Live Fleet Map»). Parity preserved.
- **Native KSA Arabic across live surfaces** (9a601bb, R3): وقفة→محطة · تشغيلة→جولة · أسند/الإسناد→عيّن/التعيين (52 strings); fixed provider vocabulary untouched. Bugs fixed: stray Latin «NOT» in close.draftSaved; «COD» acronym → التحصيل; Excel export headers de-calqued (COD متوقع→التحصيل المتوقع، POD→إثبات التسليم، مسارات→جولات). EN tree unchanged; parity 1245 keys; label-pinning test updated. All gates green; live via 6131376 green run (own push's CI vitest step flaked with unhandled errors that never reproduced locally — same tree passed minutes later).
