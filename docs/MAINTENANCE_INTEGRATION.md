# Maintenance integration — 9 October 2026

## Verified source

Repository: https://github.com/mohamed3946/car-maintenance-system
Declared homepage: https://car-maintenance-system-one.vercel.app
Reviewed revision: `0e40e35faa164e99114cc154e1aa483b82fcece5` (main).
Read-only checkout: `/data/Nemow Logistics/work/maintenance-integration-2026-10-09/source`.
The deployed login page is branded Nemow. Its protected application uses Supabase authentication and database tables; no tenant login/data access was attempted.

Source code paths reviewed: `app/cars/page.tsx`, `app/maintenance/add/page.tsx`, `app/oil-changes/add/page.tsx`, `app/inspections/page.tsx`, `app/login/page.tsx`, and `components/AppLayout.tsx`. Vehicles, oil changes, repairs and six-component inspections informed the native VEGA workflow. Source scripts/dependencies were not executed or installed; VEGA's implementation uses its existing UI and local data system.

## Implemented inside VEGA

More → Maintenance, or Drivers & vehicles → Open vehicle maintenance.
- Register individual vehicles by car number/plate; track odometer and operator-recorded availability.
- Record oil changes, repairs and inspections with service date, optional odometer, nullable cost, details and operator-specified next date/km intervals.
- Six explicit inspection checks: tyres, brakes, oil, battery, lights, bodywork. No preselected good results; worst recorded outcome is derived. Repair-needed marks the vehicle in workshop.
- View latest date/km due states independently; missing interval or odometer stays unknown. Historical service records remain visible; blank cost is unknown and explicit zero stays zero.
- Save failure leaves current state unchanged. Invalid stored data is preserved, blocks editing/export/Merge and can be recovered through an explicit valid v4 Replace.
- Maintenance is included in transactional backup v4, preview counts, merge and full replacement. Older v1–v3 backups preserve maintenance on merge/scoped restore; full replacement is disabled when an older backup lacks the complete inventory.
- Bilingual controls use VEGA's styles and RTL layout.

## Boundaries and next integration work

This is a native local maintenance slice, not the whole upstream enterprise app. No Supabase credentials, live records, employee documents/payroll, location tracking or auth implementation were brought across. The original app remains available via a separate link; it has separate login/data. No iframe, database synchronization or remote writes were added.

Recorded service costs stay separate from the existing forecast maintenance budget and daily costs, so they are not silently double counted or treated as payment evidence. Workshop state is visible but does not automatically block dispatch. Service intervals are operator supplied, not inferred manufacturer/regulatory schedules. Available status and inspection entries are operator records, not roadworthiness certification.

Backups merge by stable IDs and numeric timestamps. Distinct imported IDs with the same plate are not silently collapsed; operators must review such duplicates. Planned vehicle classes remain financial assumptions; physical vehicle records are separate. Maintenance attachments, import of original-app exports, insurance/incident detail, cross-app vehicle identity mapping and reviewed multiuser sync remain future integration work.

## Validation

Fresh baseline: six gates passed before code changes, 530 Vitest tests. Domain/backup focused verification: 53 tests passed. UI focused verification includes vehicle registration, persisted service history, missing cost, incomplete inspection rejection, repair/workshop result, corruption preservation, failed storage and odometer protection.

Final verification: all six gates passed, 545 Vitest tests across 51 files, and matching 1439-key English/Arabic locale trees. English full-page and Arabic viewport screenshots were inspected; native history headers have spacing and short labels. A pre-existing initial hydration error reproduced during browser QA and was repaired by mounting the browser-storage dashboard after hydration; actual SSR/hydration regression tests cover persisted English/Arabic state without overwriting storage. A fresh production browser tab reported no console errors.

Final gate results and browser QA are recorded under `/data/Nemow Logistics/work/maintenance-integration-2026-10-09`. Initial slice owner acceptance was open; the verified publication checkpoint below supersedes its deployment status.

## Six-category continuation — 2026-10-09

More → Maintenance now opens the maintenance dashboard, with Vehicles, Repairs, Oil changes, Periodic inspections, Accidents & breakdowns, and filtered Service history. Optional vehicle model/city/insurance expiry can be recorded/edited. Dashboard attention uses latest service per kind, independent date/km due states, workshop status, due/expired insurance and open incidents; no invented early-reminder window. Missing usable schedules and insurance dates are explicitly counted. Incident estimates are nullable and excluded from recorded service costs; incident resolution does not return a vehicle to service. No driver blame, signature, salary deduction or insurance claim is generated. Service history expands all recorded inspection components and exports a local filtered CSV with cost coverage and formula protection.

Envelope migration: storage key `vega-vehicle-maintenance-v1` now stores MaintenanceState v2. Valid old state v1 migrates in memory; no raw data rewrite until an explicit save. Backup v5 contains incidents and optional vehicle details. Historical v4 is incomplete for the new inventory: Merge/scoped helper restore preserves current incidents and missing optional metadata; full Replace is disabled. Valid current v5 supports intentional row-field clearing and full Replace.

The original six maintenance categories now have native local screens; feature parity remains partial. Source record import, evidence attachments, richer source CRUD/statuses, employee/HR suite, tracking, restaurant demand and payroll remain open. Source placeholders are not counted as working features. Complete original navigation comparison and the remaining sequence: `/data/Nemow Logistics/vega-logistics/docs/SOURCE_APP_TAB_COVERAGE.md`.

Continuation validation: all six local gates passed, 558 tests/52 files, and 1485 matching EN/AR keys. Desktop production preview visited every maintenance section; EN/AR dashboard screenshots inspected. Root report generators/templates and signed outputs remain unchanged. The public deployment receipt is recorded separately under `/data/Nemow Logistics/work/maintenance-expansion-2026-10-09/`.

## Verified publication checkpoint

Code release `d26f9dd7ba09dce1965a5401a8861a2d9f9228ba` was pushed to main; [Pages workflow 37942529747](https://github.com/kemos-labs/vega-logistics/actions/runs/37942529747) completed successfully. The hosted browser shows all six maintenance categories plus Service History and no console errors. Local checks: 558 tests/52 files, all six gates, 1485 matching locale keys. Owner acceptance remains separate.
