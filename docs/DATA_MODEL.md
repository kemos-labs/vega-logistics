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

## 3. Planned extension — Stop/Shipment record (Release R2)

```
StopRecord {
  id: string                 // stable uuid-ish, generated client-side
  date: string               // operation date (local key)
  customerProviderId: string // FK to providers catalog
  reference?: string         // shipment/tracking ref (no ID numbers by default)
  stopLabel: string          // recipient or descriptive label (privacy: personal if name)
  shortAddress?: string      // AAAA9999 format-check only [R5 validator]
  addressNotes?: string      // free text landmark/district
  phone?: string             // OPTIONAL — only when justified; privacy-labelled field
  codAmountSar?: number
  serviceWindow?: 'morning'|'afternoon'|'evening'
  driverName?: string; carNumber?: string; plateNumber?: string
  sequence?: number          // manual ordering (R3)
  status: 'planned'|'delivered'|'failed'|'returned'|'pending'
  failureReasonKey?: FailureReasonKey   // required when status failed/returned
  podStatus?: 'complete'|'partial'|'none'|undefined
  exceptionOwner?: string    // recovery board linkage
  createdAt/updatedAt: ISO
}
```
New key would be `vega-stops-v1`; joins backup envelope v3 (versioned migration, old-file compatibility per Rule 7). Failed stops create/update recovery entries deterministically (idempotent link by `stopId`).

## 4. Invariants enforced at save/close time

- Provider totals: `loaded − (delivered + returned)` must be 0 to confirm an import; otherwise difference shown and confirmation blocked (shipped).
- Evening close (R4): same invariant extended with `pending/unexplained` bucket visible at all times; draft saves allowed but labelled unreconciled and excluded from definitive KPIs.
- Never auto-balance; never fabricate zero records from ambiguous input.

## 5. Migration & backup rules (binding)

Every schema change ships in one commit with: version bump of the affected envelope, a pure migrate function (`migrateDailyRecords` pattern), fixtures of the previous format in tests, backup import acceptance of both formats, and rollback-safe transactional writes. New persisted keys may not ship unless added to this file + STORAGE_KEYS + backup inventory, or explicitly documented as disposable device metadata.

## 6. Privacy classification summary

Names/phones/addresses/plates = personal data under PDPL once collected (KSA_COMPLIANCE_MATRIX item 8). Defaults: collect minimum; label optional fields; exports remain local files (no third-party transfer); any future sync must document residency + transfer basis before enabling.
