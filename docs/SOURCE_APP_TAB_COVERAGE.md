# Original app tab inventory versus VEGA

**Audit date:** 2026-10-09 (Asia/Riyadh)
**Compared:** read-only cloned source at `/data/Nemow Logistics/work/maintenance-integration-2026-10-09/source` against current VEGA at `/data/Nemow Logistics/vega-logistics`.

## Finding

The original app has two menus, not one: a vehicle-maintenance system (six navigation entries) and an employee-operations system (nine top-level entries, six nested under Operations). VEGA is a distinct logistics workspace with 16 views across its primary and More menus. This audit does **not** find a wholesale integration of the original tabs. VEGA has a real, partial vehicle-maintenance overlap (vehicles, oil/service, inspections); it has no employee/HR system. Similar labels such as reports, costs, and operations do not establish feature parity.

The original system chooser labels Accounting “Soon” and links it to `/accounting`, for which the clone contains no page route. The employee menu also links `/employees/reports` and `/employees/settings`, with no corresponding `page.tsx` in the clone. These are navigation placeholders, not implemented tabs. The source README is the stock Next.js starter; `/data/Nemow Logistics/work/maintenance-integration-2026-10-09/source/CLAUDE.md` only points to its agent instructions. Navigation evidence is in `/data/Nemow Logistics/work/maintenance-integration-2026-10-09/source/components/AppLayout.tsx` and `/data/Nemow Logistics/work/maintenance-integration-2026-10-09/source/app/systems/page.tsx`.

## Original navigation inventory

| Original tab / route | Evidence of source implementation | Current VEGA coverage | Gap / bounded next slice |
|---|---|---|---|
| Maintenance dashboard `/dashboard` | Dashboard page queries vehicles, maintenance records, oil changes and incidents; summary cards/charts and links. `/app/dashboard/page.tsx` | Partial: VEGA Summary and Control Tower show logistics and maintenance-related operational views; no matching maintenance overview/dashboard aggregating source categories. | Extend the existing maintenance view with a small fleet health summary only after deciding which fields from the source are needed. |
| Vehicles `/cars` (add `/cars/add`, details `/cars/[id]`, edit `/cars/[id]/edit`) | Vehicle list and CRUD pages are present and query `vehicles`. | Partial: VEGA Fleet supports driver/vehicle planning data; Vehicle Maintenance workspace has a separate vehicle inventory with identity and odometer. No evidence of source CRUD parity or migration of source records. | Reconcile a single vehicle identity/schema and decide whether fleet setup and maintenance inventory should share it. |
| Maintenance entry `/maintenance/add` | Form writes `maintenance_records`, includes type/status, description, cost and related vehicle; route also lists/searches records. | Partial: VEGA maintenance workspace records oil, repair, inspection, date, cost, odometer, due date/km and description in local app state. No source-specific statuses or source record migration indicated. | Map source maintenance fields and records into VEGA’s maintenance schema with explicit provenance. |
| Oil changes `/oil-changes/add` | Dedicated oil-change history and add/edit flow using `oil_changes`, linked to vehicle. | Partial: VEGA records `kind='oil'` in the unified maintenance log and supports service date/cost/odometer/next due. | Confirm whether a distinct oil log and its fields/history are required; otherwise document unified-log mapping. |
| Accidents/incidents `/maintenance/incidents` | Incident listing and CRUD using `vehicle_incidents`; uploads evidence to maintenance storage. | Gap: VEGA has no incident/accident record view or evidence attachment flow found. Its recovery board is shipment recovery, not vehicle incidents. | Add vehicle incident log and evidence workflow as a bounded maintenance slice if operators still use it. |
| Periodic inspections `/inspections` (per vehicle `/inspections/[vehicleId]`, view `/inspections/[vehicleId]/view/[inspectionId]`) | Inspection dashboard, checklist submission and detail views use `vehicle_inspections`. | Partial: VEGA maintenance supports inspection records and a set of component outcomes; no evidence found of source checklist/history detail parity or source data. | Compare checklist components/outcomes and migrate inspection history before claiming parity. |
| Employee dashboard `/employees` | Dashboard page has workforce and operations summaries, shortcuts to list/performance/tracking/shifts/cash. | Gap: VEGA Summary/Control Tower concern parcel logistics and planning, not employee administration or workforce dashboards. | No HR work in the present VEGA scope; if requested, first define identity, access, and data boundary. |
| Employees `/employees/list` (add, detail/edit `/employees/[id]`) | Employee roster CRUD and profile pages; source reads/writes employee records. | Gap: VEGA Fleet driver roster is operational planning data, not HR employee profiles, contracts, or records. | Keep distinct unless explicitly scoped; define minimum employee schema and access model first. |
| Iqama expiry `/employees/iqama-expiry` | Expiry tracking and renewal workflow; dashboard notifications also query expiry dates. | Gap: no immigration/iqama workflow in VEGA. | Separate HR/compliance slice; requires protected-data and role design. |
| Performance `/employees/performance` | Upload/report parsers and platform performance/bonus engines, tables and insights for Hunger/Keeta. | Partial adjacent capability only: VEGA Daily/Reports/ProReport summarizes shipment stops and operational results. It does not parse those platform reports or calculate rider platform bonuses. | If needed, port one input/report format and its calculations as a standalone validated performance slice. |
| Live tracking `/employees/live-tracking` | Uses rider live locations, daily tracking and shifts, with map/status UI. | Gap: VEGA Dispatch/Stop Map are stop planning and assignment views; no live rider location feed is evidenced by those screens. | Connect an authorized telemetry source and show freshness/coverage before calling it live tracking. |
| Rider shifts `/employees/shifts` | Dedicated shift scheduling and operations using employee/shift data. | Gap: VEGA Dispatch assigns stop rows to drivers; it does not provide shift scheduling/availability. | Add a lightweight availability/shift layer only if it is an operational requirement. |
| Restaurant Activity Radar `/employees/restaurant-demand` | Demand view is backed by `/api/restaurant-demand/hotspots`. | Gap: no restaurant demand/hotspot screen in VEGA. | Treat as separate product capability; validate source/API and intended use before porting. |
| Cash Management `/employees/cash-management` | Upload report, rider balances, cash actions and transaction history via cash services. | Partial adjacent capability: VEGA handles COD evidence and includes cash summaries in reports, but no rider cash ledger, transaction history or cash-action workflow equivalent found. | Build reconciliation/ledger only after defining cash evidence sources and reconciliation rules. |
| Rider Applications `/employees/applications` | Application review, document downloads, approve/reject/delete flow; dashboard notification count. | Gap: no recruitment/application workflow in VEGA. | Separate HR slice if needed; include document permissions and approval audit. |
| Notifications & warnings `/employees/notices` (new/detail routes) | Case/notice list, creation and case detail/update pages. | Gap: VEGA Risks are computed business alerts; Recovery is parcel follow-up. Neither is an employee notice/case record. | Do not conflate alerts with case management; implement only with explicit employee case requirements. |
| Payroll `/employees/payroll` (employee details and receipt subroutes) | Payroll pages and per-employee receipts are present. | Gap: VEGA cost assumptions and profitability views are planning estimates, not payroll runs, employee entitlements or receipts. | HR/finance boundary decision required before a payroll slice. |
| Reports `/employees/reports` | Menu item exists, but clone has no matching page route. | Partial by label only: VEGA has Daily reports/ReportsView and ProReport for logistics operations. | Source route is a dead link in clone; no feature can be transferred until an implementation is identified. |
| Settings `/employees/settings` | Menu item exists, but clone has no matching page route. | Partial: VEGA has app-level language/local-storage controls, no employee-system settings page. | Source route is a dead link in clone; determine desired settings separately. |
| Accounting `/accounting` | System chooser card explicitly says “Soon”; route absent. | Partial adjacent capability: VEGA has planning Costs and Scenarios, not a source accounting system or accounting ledger. | Not an existing source feature; exclude from integration claims. |

## Current VEGA tabs (scope check)

VEGA `BusinessModelApp.tsx` declares six Primary views: Summary, Control Tower, Stops, Dispatch, Evening Close, and Daily Reports. Its More menu declares Recovery, Compliance, Vehicle Maintenance, Fleet, Customers, LogesTechs, Costs, Scenarios, Actions, and Risks. These are actual rendered views. The source employee tabs are not present in that menu. Evidence: `/data/Nemow Logistics/vega-logistics/src/components/rebuild/BusinessModelApp.tsx`.

## Recommended next slice

The narrowest defensible continuation is **vehicle-maintenance parity**, not employee management: first reconcile vehicle identity and source fields; then decide whether to migrate oil/service and inspection history into VEGA’s existing maintenance workspace; next add the source incident log/evidence flow if still needed. Keep the employee suite out of this slice: it entails employee records, iqama, location, shifts, recruitment documents, notices, and payroll, with different data access and business boundaries.

## Evidence limits

This is a static source-to-source audit of navigation, route files, and relevant implementation references. No app was executed, no dependencies were installed, and no tenant/database was accessed. “Coverage” means code-level capability visible in the current VEGA checkout, not a live-data or deployment claim. Similar business labels are treated as partial only where there is an identifiable shared workflow; they are not counted as full integration.

## Native maintenance continuation — 9 October 2026

The inventory above records the starting state. The continuation adds native VEGA navigation for all six maintenance categories plus filtered Service History: Maintenance dashboard, Vehicles, Repairs, Oil changes, Periodic inspections, and Accidents & breakdowns. This is category coverage, not complete source feature/data parity.

Delivered code: dashboard computes latest-per-kind due/attention, unknown schedules/insurance and known-cost coverage; individual vehicle details include optional model/city/insurance date; incident log records open/resolved cases and estimated costs; service history filters by vehicle/kind, expands recorded inspection components and exports a local CSV with explicit cost coverage and formula protection. Incident estimates never enter service totals or payroll. Recording an incident marks the vehicle in workshop; resolving it does not certify availability.

### Remaining integration sequence

1. Physical vehicle identity: link the existing driver catalog to stable vehicle IDs with reviewed mapping; preserve dispatch/history snapshots. Current financial vehicle classes remain forecasts.
2. Source export import: read-only preview/reconciliation for original vehicle/oil/repair/inspection/incident exports, preserving source IDs, timestamps and unknowns; no Supabase credentials or automatic writes.
3. Evidence: local attachment references, reviewed service/incident corrections and insurance details. No source salary-deduction acknowledgment or signature flow was copied.
4. Employee foundation: distinct employee identity, minimum fields and backup/access inventory; operational driver roster is not an HR record.
5. Employee operations: shifts and availability, platform-report performance, then cash ledger reconciliation; existing COD reports do not establish parity.
6. Employee documents/cases: expiry, applications and notices with minimized protected data and audit history.
7. Payroll and receipts: define reviewed inputs/calculations and evidence before implementing money/entitlement workflows. No automatic deductions.
8. Live location and restaurant demand: obtain authorized data contract, freshness/coverage and opt-in runtime configuration before adding feeds.
9. Source dead links (Employee Reports, Settings, Accounting): define required outcomes rather than claiming non-existent implementations were imported.

Optional sync remains R8 and separate from native local category coverage. The authoritative maintenance behavior/migrations are in `/data/Nemow Logistics/vega-logistics/docs/MAINTENANCE_INTEGRATION.md`; daily operations acceptance stays governed by `/data/Nemow Logistics/vega-logistics/docs/MASTER_PLAN.md`.
