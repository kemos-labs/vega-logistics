# VEGA KPI Dictionary
**Status:** authoritative definitions for every number VEGA displays · **Rule:** every KPI states formula, denominator, exclusions, window, missing-data handling, and threshold provenance. Thresholds are **[INT]** (VEGA internal, owner-set) unless a source is cited. No external benchmark is used without its source in `RESEARCH_DOSSIER.md`.

Legend: **R** = recorded data only · **D** = derived from model inputs + recorded data · window keys use local-timezone `YYYY-MM-DD` (never UTC slices).

---

## Close-derived measures (R4)

**Loaded** — recorded (`loadedShipments`) or stop-derived. **Returned/Pending** — recorded close counters derived from reviewed stop outcomes. **Unexplained difference** — loaded − (delivered+returned+pending), sign preserved; reconciled requires 0.
**COD expected** — Σ delivered-stop COD (source-labelled) or manual-adjusted w/ note. **Outstanding** = max(0, collected−remitted) · **Uncollected** = max(0, expected−collected) · **Over-remitted** = max(0, remitted−collected) — credit visible.
**Remittance lag** — day-granularity (single remitted amount per record); event-level timing deferred.
**Draft exclusion** — `isDefinitiveDailyRecord()` (operationsReporting.ts) is applied inside buildMonthlyRollup, buildCustomerPerformance, buildProjection and the Control Tower snapshot; legacy rows (no closeStatus) remain definitive. Tower shows a 'finish draft close' action. **Remittance lag IS computable at day granularity** via `codRemittedOn` (validated calendar date on DailyRecord).

## Daily operations

**Completion rate** — R — `completedShipments / (completedShipments + failedShipments) × 100`. Denominator = recorded attempts that day. Exclusions: none. Window: per record date. Missing: 0% when denominator 0 (displayed as "no data" in UI, not 0). Threshold [INT]: ≥90% healthy target line.

**Miss rate** — R — inverse of completion (`failed / attempts × 100`). Threshold [INT]: ≤8% warn, ≤3% healthy (pinned in tests).

**Recovered shipments** — R — operator-entered `recoveredShipments` (previous misses re-delivered today). Recovery close-rate computed on the recovery board: `closed / total entries` over selected window; aging by `createdAt`. Threshold [INT]: close ≥50%, >7 days old = hot.

**e-POD completeness** — R — categorical `podStatus ∈ {complete, partial, none}`; completeness score maps complete=100%, partial=50%, none=0%. Threshold [INT]: ≥98% daily. External context only: APQC cross-industry median 80.0% (n=1,144) `[BM, dossier]`.

**Fuel cost control** — R vs D — `record.fuelCost` vs model day-fuel allowance. Alert when actual >115% of model day (pinned in tests). Fuel is SAR cash only — never litres (operator language law).

**Cost per delivered stop** — D/R — `(dayAllocatedFixedCost + fuelCost + extraCosts) / completedShipments`, where day-allocated fixed cost = `totalCost / 26` [assumption: 26 working days]. Exclusions: days with zero completions. Trend compares to rolling 4-week baseline ±10% [INT]. **Labelled derived** wherever shown.

## Cash / COD

**COD expected** — R/D — `codShipments × avgCodValuePerShipment` when per-stop values absent (Release R4 adds optional explicit COD amounts per record).
**COD collected** — R — `cashCollectedSar`.
**COD remitted** — R — `cashRemittedSar`.
**Outstanding cash** — R — `Σ collected − Σ remitted` over window.
**Remittance lag** — R — days between collection date and matching remittance (per-day approximation until R4 introduces remittance events; lag = weighted average age of unremitted collections). Threshold [INT]: ≤2 working days.

## Reliability vocabulary (aligned to industry usage; VEGA counts are local)

**First-attempt delivery rate (FADR)** — share of stops delivered on first attempt. Today VEGA's daily record cannot distinguish first attempts from reattempts except via recoveredShipments; FADR is therefore **reported as completion rate with a caveat** until R2 stop-level data ships. External figure 99.22% US-domestic Q2-2025 is vendor-reported and NOT small-fleet/KSA comparable `[VENDOR, dossier]`.
**Return-to-origin (RTO)** — `returned / loaded` once provider messages supply loaded counts (parser); before that, unavailable rather than fabricated.
**OTIF** — not computable yet (needs promised-date vs delivery-date at stop level). Listed here to prevent ad-hoc invention; arrives with R2.

## Customer & driver analytics

**Customer miss rate** — R — per-customer `missed/(delivered+missed)` across all recorded days; trend = trailing-7-recorded-days rate minus lifetime rate (positive = worsening). Omitted when no attributed attempts.
**Driver attendance** — R — `driversPresent` per day; utilization % = attendance ÷ planned headcount [D].
**Vehicle downtime** — currently only via failureReasons `vehicleBreakdown` counts; proper downtime days arrive with fleet records (future evaluation). Never synthesized.

## Plan-vs-actual

**Variance %** — D/R — `(actualRevenue − plannedRevenue)/plannedRevenue × 100` where planned = model monthly revenue ÷ 26 × recordedDays. Missing-data rule: months with zero records produce no row.
**Projection series** — D — deterministic factor pattern for non-recorded days, always visually distinguished as simulated (dashed/labelled), never mixed into recorded KPIs (Rule 4 honest data states).

## GASTAT 2024 context figures (external, for orientation only — never VEGA targets)

Parcel/postal shipments >180M in 2024 (vs >140M 2023); licensed delivery-app orders 288.1M in 2024; sector on-time delivery 96%; average delivery time ~2 days. Source: GASTAT Warehousing & Logistics Statistics 2024 `[OFFICIAL STATISTICS, dossier addendum]`. These describe the national market, not this operator; they must never appear as benchmark targets inside the product.
