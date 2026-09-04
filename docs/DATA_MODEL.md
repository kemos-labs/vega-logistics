# VEGA Data Model
**Date:** 2026-08-23 · **Scope:** persisted shapes, ownership, privacy class, migration rules, and the planned stop-level extension. Single source of truth for storage keys: `STORAGE_KEYS` in `src/lib/backup.ts`.

## 1. Persisted keys (current inventory)

| Key | Shape | Backup scope | Class |
|---|---|---|---|
| `vega-financialInput-v2` | FinancialInput (model inputs) | yes | user data |
| `vega-daily-reports-v2` | `Record<dateISO, DailyRecord>` | yes | user data |
| `vega-scenarios-v1` | Scenario[] | yes | user data |
| `vega-recovery-board-v1` | RecoveryEntry[] | yes | user data |
| `vega-followup-actions-v1` | FollowUpAction[] | yes | user data |
| `vega-stops-v1` | StopRecord[] | yes | user data (R2) |
| `language` | raw `'en'`\|`'ar'` (never JSON-stringified) | yes | preference |
| `vega-last-backup-at-v1` | raw ISO timestamp | **NO — device metadata** (restoring old backups must not suppress reminders) | device metadata |
| `vega-backup-banner-dismissed:<YYYY-MM-DD>` | `'1'` | no — day-scoped dismissal | device metadata |

`vega-vehicles` / `vega-zones`: persistence deliberately REMOVED (immutable seeds) — review C decision; do not reintroduce without a migration story.

## 2. DailyRecord field inventory (with privacy + derivation classes)

Operational counters (recorded): `completedShipments`, `failedShipments`, `recoveredShipments?`, `driversPresent`.
Failure attribution: `failureReasons?: Partial<Record<FailureReasonKey, number>>` (7 fixed keys).
Customer attribution: `customerBreakdown?: Record<customerId, {delivered, missed}>`.
Money: `fuelCost` (SAR cash — litres banned), `extraCosts?`, `codShipments?`, `prepaidShipments?`, `cashCollectedSar?`, `cashRemittedSar?`. Derived elsewhere: revenue = completions × model avg (never stored).
Quality/safety: `podStatus?`, `safetyIncidents?`, `weatherCondition?`.
Fleet/driver identity (provider-side): `driverName?`, `carNumber?`, `plateNumber?` — **privacy class: personal data (name), operational identifiers**; minimization rule = collect only what provider reports.
Free text: `notes`, `tomorrowNote?`.
Timestamps: `date` (local YYYY-MM-DD key), `updatedAt` (ISO, normalized on every read path).

**Known mixing flagged in PRODUCT_TRUTH_AUDIT §7:** the 26-working-days constant and day-cost allocation are derived assumptions that must stay visually labelled wherever shown.

## 3. Stop/Shipment record — IMPLEMENTED (Release R2, extended R7; key `vega-stops-v1`)

```
StopRecord {
  id: string                 // stable uuid-ish, generated client-side
  operationDate: string      // operation date, local YYYY-MM-DD key (real calendar date)
  customerId?: string        // FK to providers catalog when known
  customerName: string       // SNAPSHOT (catalog renames never break stops)
  reference?: string         // shipment/tracking ref (no ID numbers by default)
  stopLabel: string          // recipient or descriptive label (privacy: personal if name)
  addressNotes?: string      // free text landmark/district (≤300)
  shortAddress?: string      // R7: SPL Short Address, NORMALIZED (spaces stripped,
                             //   uppercased) + FORMAT-ONLY validated (AAAA9999 via
                             //   compliance.ts); blank ⇒ absent; never "verified"
  phone?: string             // OPTIONAL — only when justified; privacy-labelled field
  codAmountSar?: number
  serviceWindow?: 'morning'|'afternoon'|'evening'
  lat?: number; lng?: number // R7: OPTIONAL manual coordinates (±6dp), range-checked
                             //   (lat −90…90, lng −180…180); offline suggestion input only
  driverName?: string; carNumber?: string; plateNumber?: string
  sequence?: number          // manual ordering (R3); suggestion accept rewrites 1..N
  status: 'planned'|'delivered'|'failed'|'returned'|'pending'
  failureReasonKey?: FailureReasonKey   // required when status failed/returned
  podStatus?: 'complete'|'partial'|'none'|undefined
  exceptionOwner?: string    // recovery board linkage
  createdAt/updatedAt: ISO
}
```
Shipped as specified here (source of truth: `src/lib/stops.ts`). R2 additions locked during implementation: `customerName` is a snapshot (catalog renames never break stops); real-calendar-date validation; `failureReasonKey` REQUIRED for failed/returned; reference-basis duplicate comparison treats ABSENT optional fields as non-contradicting (import rows without a COD column stay compatible with existing stops that have one; `shortAddress` joined that rule in R7); phone/addressNotes length-capped, privacy-minimized. R7 additions: `shortAddress` (bulk-import aliases EN/AR incl. العنوان المختصر; invalid ⇒ row-level error in planning/import, lossy-warn-and-clear in backups); `lat`/`lng` (manual entry + import aliases lat/lng/خط العرض/خط الطول; unparseable ⇒ NaN-survives-to-validation, never silent 0,0). Backup envelope is v3: v3 strict (missing stops key = malformed), v2/v1 migrate with `stops: []` + `legacyScopeMissing` + lossless=false so older formats can NEVER erase current stops; merge = numeric `updatedAt` newer-wins; commitBundle covers the stops key transactionally. Previous-format stops (without the R7 keys) validate and import losslessly — no envelope bump (same rule as R4 close fields). Failed-stop→recovery auto-linking arrives with R4 (evening close).

## 3b. Evening-close fields (R4, optional on DailyRecord — backward compatible)

`loadedShipments?` · `returnedShipments?` · `pendingShipments?` · `codExpectedSar?` · `closeStatus?: 'draft'|'reconciled'` · `closedAt?` (reconciled only) · `codRemittedOn?` (validated calendar date — day-granularity remittance lag) · `codAdjustmentNote?` (required for manual expected-COD). RecoveryEntry += `stopId?` (**preserved through validateRecoveryEntries** — linkage survives refresh; refresh idempotency regression-tested).
**Vocabulary (authoritative):** Loaded = declared loaded for the date · Delivered = completed · Returned = to origin/provider, reason required · Pending = loaded still unresolved · **Failed attempt = metadata over a pending/returned outcome, never an extra bucket** · Unexplained difference = loaded − (delivered+returned+pending), sign preserved.
**Invariant (reconciled):** `loaded = delivered + returned + pending`. Nothing auto-balances.
**Draft KPI rule:** `isDefinitiveDailyRecord()` — draft=false, reconciled=true, missing closeStatus=true (legacy rows stay definitive).
**Recovery idempotency:** one pending entry per non-delivered stop carrying a reason, linked by `stopId`; repeated saves create nothing; operator edits kept; delivered never erases history; returned stops sit on the board as write-off review.
**COD:** expected = Σ delivered-with-COD stops unless manually adjusted (note required); codShipments counts delivered stops carrying COD only; failureReasons is derived from reviewed stop outcomes and its sum equals failedShipments (each exception counted exactly once — returned is never double-counted; persisted legacy `failed` status maps to pending arithmetic + reason metadata) · outstanding = max(0, collected−remitted) · uncollected = max(0, expected−collected) · overRemitted = max(0, remitted−collected) (credit visible, never hidden). Remittance timing is day-granularity (single remitted amount per record); per-event `codRemittances[]` deferred until multi-remittance days are observed.
**Backup:** all new fields sanitized (malformed ⇒ warn + lossy); NO envelope version bump (structure unchanged).

## 4. Invariants enforced at save/close time

- Provider totals: `loaded − (delivered + returned)` must be 0 to confirm an import; otherwise difference shown and confirmation blocked (shipped).
- Evening close (R4): same invariant extended with `pending/unexplained` bucket visible at all times; draft saves allowed but labelled unreconciled and excluded from definitive KPIs.
- Never auto-balance; never fabricate zero records from ambiguous input.

## 5. Migration & backup rules (binding)

Every schema change ships in one commit with: version bump of the affected envelope, a pure migrate function (`migrateDailyRecords` pattern), fixtures of the previous format in tests, backup import acceptance of both formats, and rollback-safe transactional writes. New persisted keys may not ship unless added to this file + STORAGE_KEYS + backup inventory, or explicitly documented as disposable device metadata.

## 6. Privacy classification summary

Names/phones/addresses/plates = personal data under PDPL once collected (KSA_COMPLIANCE_MATRIX item 8). Defaults: collect minimum; label optional fields; exports remain local files (no third-party transfer); any future sync must document residency + transfer basis before enabling.
