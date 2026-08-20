# VEGA Logistics OS — Product Reset Plan

**Status:** Phase 0–2 prototype pass complete; production persistence/integrations remain gated
**Current verdict:** The recent rebuild was a regression in product usefulness. The primary route now restores the editable planning surface and keeps operations as a separate, truthful simulation workspace. Do not label the app production-ready until the backend gates below are complete.

### Completed in this pass

- Restored a primary Plan & economics workspace at `/` with editable financial, fleet, driver, provider, freelancer, risk and feasibility views.
- Kept `FinancialInput` as the source of truth and added explicit optional freelancer volume semantics.
- Added a workspace switch into the operations console instead of replacing planning with it.
- Connected `AppContext50` reads through the validated operations API data-source adapter.
- Added local simulation job creation, planning and status transitions with browser persistence.
- Added signed-session verification groundwork, production-mode API rejection without a validated session, and a PostgreSQL core schema.
- Added RTL planning styles, responsive navigation, focused data/source labels, and 33 passing TypeScript tests.
- Reduced ESLint to 0 errors; 204 legacy warnings remain.

## 0. What I misunderstood

The old application was not only “slop dashboard UI.” It contained the product behavior the user depends on:

- `FinancialEngine` edits the actual `FinancialInput` model.
- `FleetVehicles` edits vehicle-class quantities and costs.
- `Drivers` adds, edits, archives and assigns drivers.
- `Providers` edits shipment volume and price, with live revenue evaluation.
- `Freelancers` edits pass-through economics.
- Cost-line toggles, per-unit mode and calculated P&L are connected.
- State is persisted through the existing application context/local-storage layer.

The rebuild made the app look like a control tower but removed those workflows. Adding an unrelated “Planning” view with a few numbers is not parity: those numbers do not drive `FinancialInput`, provider revenue, cost breakdowns, risk outputs or the original editable tables.

### Regression rule

> No new dashboard, AI panel or visual redesign may remove an existing editable workflow.

The next implementation must restore the old workflows first, then redesign them deliberately.

---

## 1. Product definition

VEGA is a **fleet planning and operating workspace** for a Saudi regional carrier. It has two connected jobs:

1. **Plan the business:** fleet composition, drivers, providers, costs, revenue, risk and feasibility.
2. **Run the day:** dispatch, vehicles, exceptions, deliveries, maintenance, fuel and compliance.

The product is not a wall of KPIs. Each screen must let the operator inspect, change or prove something.

### Primary users

| User | Primary task | Required result |
|---|---|---|
| Owner / executive | Change assumptions and understand economics | Traceable monthly P&L and risk |
| Fleet manager | Set vehicle classes and driver coverage | Correct fleet cost and availability |
| Dispatcher | Assign work and resolve exceptions | Jobs move through a real lifecycle |
| Finance / planner | Change rates, volumes and costs | Recalculated outputs with visible formulas |
| Driver operations | Maintain driver records and assignments | No duplicate or lost roster edits |

### Product promise

> Change an assumption once, see every dependent result update, and know exactly which inputs produced it.

---

## 2. Immediate correction to the current implementation

### 2.1 Stop treating the rebuild as the primary product

The current `src/app/page.tsx` renders only `ClientOperationsConsole`. That hides the existing planning modules and creates the regression.

Required correction:

- Restore the existing application workspace as the primary route, or expose it at a stable `/planning` route while parity is rebuilt.
- Keep the operations console as a separate `/operations` workspace until it reaches feature parity.
- Do not delete or bypass `AppContext` and the `FinancialInput` model.
- Remove the newly added duplicate planning controls from the critical path unless they are wired to `FinancialInput`.
- Do not call the application “finished” while the old editable flows are inaccessible.

### 2.2 Preserve the real source of truth

For the prototype phase, the source of truth remains:

- `src/lib/types.ts` → `FinancialInput`, `FinancialOutput`, `VehicleClass`, `DriverRecord`, `Provider`, `MaintenanceEntry`
- `src/lib/AppContext.tsx` → persisted editable planning state
- `src/lib/calculations.ts` → financial formulas
- `src/lib/riskEngine.ts` → scenario analysis
- Existing editable components under `src/components/financial` and `src/components/operational`

The 2026 operational model under `types2026.ts` can remain an operational read model, but it must not replace the financial/planning model until a deliberate mapping exists.

---

## 3. Research that changes the plan

Research was checked against official and product sources. These are product lessons, not claims that VEGA is already compliant or production-ready.

| Source | What it confirms | VEGA decision |
|---|---|---|
| [Geotab fleet management solutions](https://www.geotab.com/fleet-management-solutions/) | Mature fleet products join real-time monitoring with fuel, driver coaching, routing/dispatching, maintenance and a usable dashboard. | Feature adjacency matters: planning and operations must connect. A map alone is insufficient. |
| [Geotab fleet management software](https://www.geotab.com/fleet-management-software/) | Fleet software is evaluated through vehicle monitoring, fuel consumption, safety events, maintenance integrations and routing/dispatch. | Use a traceable operational data model and prioritize workflows over decorative cards. |
| [Motive fleet management](https://www.motive.io/products/fleet-management) | Fleet platforms package workflows around safety, equipment, drivers, visibility and operational control. | Driver and asset records are working entities, not read-only dashboard rows. |
| [GOV.UK validation pattern](https://design-system.service.gov.uk/patterns/validation/) | Validation should explain what is wrong and how to fix it, while preserving user-entered answers. | Every editable number needs bounds, inline error text, preserved input and an obvious save state. |
| [GOV.UK text input](https://design-system.service.gov.uk/components/text-input/) | Inputs need clear labels, useful hints, appropriate types and accessible states. | Do not use tiny unlabeled number fields buried inside dense rows. |
| [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Keyboard access, focus, contrast, error identification and responsive access are acceptance criteria. | Tables, modals, tabs and numeric controls must work without a mouse. |
| [Saudi TGA regulations](https://www.tga.gov.sa/en/Regulations) | Transport and logistics activities operate inside Saudi regulatory requirements. | Driver, vehicle, permit and document fields need ownership and expiry semantics, not fake “connected” badges. |
| [ZATCA E-Invoicing](https://zatca.gov.sa/en/E-Invoicing/Pages/default.aspx) | Saudi e-invoicing is a controlled digital process. | Finance work must distinguish simulation calculations from invoice clearance and VAT evidence. |
| [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework) | AI requires governance, measurement, mapping and management. | No AI/autonomy work until the editable operational records and event provenance are reliable. |
| [GS1 EPCIS](https://www.gs1.org/standards/epcis) | Event standards describe what happened, where, when and why. | Later integrations should append events; they should not overwrite the user’s planning assumptions. |

### Research conclusion

The correct benchmark is not “make VEGA look like a modern SaaS dashboard.” It is:

- preserve the operator’s ability to change assumptions;
- connect changes to calculations and actions;
- use a dashboard as a decision layer above real workflows;
- make errors, freshness and simulation status explicit;
- only add intelligence after the underlying records are trustworthy.

---

## 4. Correct product information architecture

Do not put planning inputs behind a decorative control-tower shell. Use two clear workspaces with a stable switcher:

### Workspace A — Plan & economics

1. **Overview** — revenue, cost, margin, breakeven and risk summary.
2. **Fleet & vehicles** — editable vehicle classes and per-class economics.
3. **Drivers** — editable driver roster, status and assignment.
4. **Providers** — editable shipment volumes and prices.
5. **Freelancers** — pass-through pricing and payout.
6. **Cost lines** — grouped toggles and assumptions.
7. **Risk** — scenarios linked to current inputs.
8. **Feasibility** — capital, cash flow and recommendations.

### Workspace B — Daily operations

1. **Command center** — exceptions and operating health.
2. **Live fleet** — map plus selected vehicle detail.
3. **Dispatch** — job lifecycle and assignment.
4. **Deliveries / POD** — evidence and failed stops.
5. **Maintenance** — work orders and return-to-service.
6. **Fuel** — event ledger and anomaly review.
7. **Compliance** — documents, expiries and ownership.
8. **Analytics** — definitions, trends and drill-through.

The two workspaces may share navigation primitives and entity IDs, but they must not pretend that a generated `FleetSnapshot` is the same thing as editable financial state.

---

## 5. Phase 0 — Regression recovery and parity gate

**Goal:** make the old product behavior reachable and testable again.

### Required work

- Restore access to the existing `FinancialEngine`, `FleetVehicles`, `Drivers`, `Providers`, `Freelancers`, `RiskCalculator` and `FeasibilityStudy`.
- Keep existing `FinancialInput` fields and status values unless a migration is documented.
- Add a workspace switcher instead of replacing one product with another.
- Remove fake “live” language from generated operations data.
- Remove any action that looks editable but silently does nothing.
- Make local simulation edits functional and label them `Saved locally · simulation`.
- Do not add a second `FleetPlan` model for values already represented by `FinancialInput`.

### Parity acceptance criteria

- A user can add a driver, edit name/phone/ID/status/vehicle and delete/archive it.
- A user can add a vehicle class and change quantity, rent, variable cost, driver salary, fuel type, efficiency, daily distance, purchase price and depreciation.
- A user can add/delete providers and change shipments/day, price and enabled state.
- Cost toggles change the correct output lines.
- Per-unit mode changes display without changing the underlying monthly totals.
- All edits persist after refresh and browser restart.
- Financial outputs update from the same edit event.
- At least one test covers every add/edit/delete path and one persistence reload path.

### Gate

Do not begin visual polish until these interactions work on the local prototype.

---

## 6. Phase 1 — Redesign the working screens, not a replacement dashboard

### Design direction: calm operational workstation

- **Density:** controlled density; useful table rows and formulas, not tiny text everywhere.
- **Hierarchy:** one clear page title, one primary action, one main work surface, one contextual summary.
- **Typography:** use the existing display/body pairing consistently; minimum readable body size 13–14px, labels 11–12px, monospace only for IDs/numbers.
- **Color:** neutral charcoal/stone base, one green positive accent, blue action accent, orange/red only for attention. No rainbow KPI cards.
- **Surfaces:** fewer cards; use a proper table/editor where the task is editing a list.
- **Forms:** visible labels, units beside fields, hints where assumptions are non-obvious, inline validation and error summaries.
- **Motion:** restrained transitions only; respect `prefers-reduced-motion`.
- **Responsive:** table becomes stacked record editor on mobile; controls remain touchable; no horizontal maze for the primary task.

### Screen-specific redesign

#### Fleet & vehicles

Use a spreadsheet-like editor with:

- sticky class name and quantity columns;
- visible units (`SAR / vehicle / month`, `L/100 km`, `km/day`);
- expand/collapse details for fuel and depreciation;
- add class, duplicate class, archive class;
- summary footer showing enabled fleet, rent, variable cost, driver cost and fuel estimate;
- unsaved/local-save indicator.

#### Drivers

Use a roster table plus detail drawer:

- Add driver opens a focused form, not a disabled button.
- Required: full name, phone, national/Iqama identifier, status.
- Optional: assigned vehicle, license number and expiry.
- Validation is explicit and preserves entered values.
- Archive requires confirmation; delete is only for an unused local record.
- Duplicate phone/ID warnings are visible before save.

#### Financial engine

Keep the current grouped cost-line model, but improve it:

- show editable assumption and calculated result together;
- show formula or source hint for every KPI;
- separate revenue, fixed cost, variable cost and per-shipment cost;
- show changed inputs and reset-to-default per section;
- make `Simulation` and `Saved locally` visible without pretending to be live.

#### Operations console

Only after parity:

- map/list split with a real selected-vehicle detail pane;
- exception queue with owner, age, reason and next action;
- no auto-refresh every five seconds for fake data;
- manual “Regenerate simulation” control, with timestamp and seed;
- command buttons either perform a local simulation mutation or are not shown;
- no “Live fleet” label for generated positions.

---

## 7. Phase 2 — Correctness and shared contracts

### Data model policy

Keep two explicit models temporarily:

1. `FinancialInput` / `FinancialOutput` for planning and economics.
2. `FleetSnapshot` / operational entities for the operations demo.

Create mapping functions only where the mapping is real. Do not force financial `DriverRecord` into the richer telematics `Driver` type or silently drop fields.

### KPI contract

Every KPI must define:

```ts
{
  id: string;
  label: string;
  formulaVersion: string;
  value: number;
  unit: string;
  period: { start: string; end: string };
  source: string[];
  asOf: string;
  mode: 'simulation' | 'live' | 'delayed' | 'offline';
}
```

Required formula fixtures:

- total fleet count;
- active driver count;
- monthly shipments;
- revenue;
- variable/fixed/per-shipment cost;
- cost per shipment;
- margin;
- cash runway;
- failed delivery impact;
- customer payment delay impact;
- fleet utilization.

### Financial correctness

- Keep the double-counting fix and regression tests.
- Verify variable vehicle overhead is counted once.
- Make failed delivery rate affect the stated revenue/cost assumption, not an unrelated risk score only.
- Make payment delay affect cash/working-capital output with a documented approximation.
- Show assumptions beside outputs so a user can challenge the model.

---

## 8. Phase 3 — Persistence and security

Do this after the prototype has parity, not before inventing more UI:

1. PostgreSQL schema and migrations.
2. Tenant, user, role and membership tables.
3. Server-validated authentication; local role switching is demo-only.
4. Tenant-scoped repositories and authorization checks.
5. Input validation at API boundary.
6. Audit event table for add/edit/archive/assign/status changes.
7. Object storage for driver/vehicle documents and POD evidence.
8. Idempotency and request/correlation IDs.
9. Contract tests and tenant-isolation tests.

First persisted slice:

`tenant → user → vehicle class → driver → provider → job → event`

No real customer or driver data enters the app before server-side authorization exists.

---

## 9. Phase 4 — Operations workflows

Build one complete vertical slice rather than eight read-only modules:

### Dispatch slice

- create job;
- assign driver and vehicle;
- validate capacity and service window;
- move through status transitions;
- record reassignment reason;
- record delivery/POD or failed reason;
- create audit event;
- show customer-facing status.

Then add maintenance, fuel, compliance and customer workflows one at a time.

### Integration order

1. One telematics provider adapter.
2. One routing/map provider adapter.
3. Notification provider.
4. ZATCA boundary after invoice model and VAT evidence are defined.
5. TGA/Wasl only after official access, licensing and data requirements are confirmed.

---

## 10. Phase 5 — AI only after evidence quality

Every recommendation requires:

- source events and time window;
- confidence and limitations;
- human approval;
- action preview;
- audit record;
- evaluation set and rollback path.

Initial AI scope:

- late-risk explanation;
- maintenance risk ranking;
- POD quality check;
- natural-language search over authorized records.

No autonomous dispatch, customer promises or financial decisions in the first pilot.

---

## 11. Quality gates

### Product gate

- Existing workflows are not removed.
- Every visible editable control changes a real model.
- Every visible action either works or is clearly unavailable with a reason.
- Simulation and live states are unambiguous.

### UX/accessibility gate

- Keyboard-only add/edit/archive flow works.
- Focus is visible in tables, drawers, tabs and dialogs.
- Labels and units are associated with controls.
- Validation identifies the field and explains the fix.
- No critical information relies on color alone.
- Arabic/RTL layout is tested for tables, numbers, dates and forms.
- Mobile driver workflow has touch targets and an offline/error state.

### Engineering gate

- TypeScript and build pass.
- Unit tests cover formulas and editable state transitions.
- API contract tests cover malformed data and stale data.
- Tenant-boundary tests pass before persistence is called production-ready.
- No high-severity dependency vulnerabilities are ignored without a decision record.
- Full lint debt is reduced in batches; modified files stay clean.

### Pilot gate

Pilot one Riyadh shift only after the dispatch slice works. Measure:

- time to add/edit a driver;
- time to change a fleet assumption and understand margin impact;
- time from exception creation to ownership;
- OTIF and first-attempt delivery;
- missing POD rate;
- data freshness and stale-telemetry rate;
- KPI traceability from result back to source event.

---

## 12. Immediate implementation order

1. **Do not add more new dashboard UI.**
2. Restore the old planning workspace and expose it from the main route.
3. Remove or isolate the duplicate `FleetPlan`/demo-driver model from the main product path.
4. Add interaction tests for `FinancialEngine`, `FleetVehicles`, `Drivers` and `Providers`.
5. Redesign one screen: `Fleet & Vehicles`, keeping every old editable field.
6. Redesign `Drivers` with a working add/edit/archive drawer.
7. Redesign `FinancialEngine` with formula/source clarity.
8. Reintroduce the operations console as a separate workspace, using truthful simulation data.
9. Only then start PostgreSQL/authentication work.

**The next coding task is Phase 0, item 2: restore access to the old editable planning workspace.**
