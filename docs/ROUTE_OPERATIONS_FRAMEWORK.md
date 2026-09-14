# VEGA Route Operations Framework

**Status:** active operating design · **Owner:** Nemow Logistics operations manager  
**Scope:** Riyadh last-mile planning for one local operator, 5–50 vehicles  
**Authority:** `AGENTS.md` → `SESSION_MEMORY.md` → `docs/MASTER_PLAN.md`

## Purpose

When a new order sheet arrives, VEGA should turn the operator's own shipment data into a reviewable driver plan: clean stops, expose missing address data, group nearby work, suggest a visit order, and print a driver sheet. It must not pretend to know an exact road distance when no road router was run.

This is a Riyadh operating framework, not a claim that every street, traffic condition, or address is already known. District names are planning hints; coordinates and a road router are required for measured driving distance.

## Daily workflow

1. **Select the operation date.** Do not mix a new sheet with another day.
2. **Import or paste the order rows** in Stop Planning. CSV and `.xlsx` workbooks are converted into the same preview path. Keep the original barcode/reference as `reference`.
3. **Review the preview before confirming.** Resolve invalid rows, exact/conflicting duplicates, unknown headers, and missing customer/address/phone data. Rejected data must not mutate storage.
4. **Enrich only from evidence.** Enter a National Short Address and/or latitude/longitude when supplied by the customer, official source, or an operator-verified map pin. Do not invent coordinates from a district name.
5. **Assign by geographic cluster.** Start with broad Riyadh zones (East/Central, North/West, or a different split justified by the actual stops). The labels are operational groups, not hard-coded truth. A stop near a zone boundary remains review-required.
   Dispatch now offers a two-driver coordinate-clustering proposal. It is a reviewable proposal, not an automatic decision; stops without coordinates remain explicitly excluded until enriched.
6. **Use Dispatch Board → Suggest** for each driver run. The current offline suggestion respects service windows first, then uses nearest-neighbour only among stops with valid coordinates. With insufficient coordinates it preserves manual order and says so.
7. **Review the side-by-side order.** Accept only when it helps the day. Discard or manually reorder when a customer promise, building access rule, cash constraint, or driver knowledge is more important.
8. **Print the bilingual driver sheet.** The sheet is an internal operational document, not proof of National Address validity or a transport document.
9. **Open or download the driver handoff.** Dispatch exposes a multi-stop Google Maps link and a UTF-8 CSV route file. The link uses coordinates when present and otherwise adds `Riyadh, Saudi Arabia`; the CSV is for driver handoff, not a route-distance report.
10. **Close the day in Evening Close** and use recorded outcomes for reports. Do not infer delivery completion from route order.

## Decision table

| Data condition | VEGA action | What the operator may claim |
|---|---|---|
| 0–1 valid coordinate in a run | Keep current/manual order | No geographic optimization performed |
| At least 2 valid coordinates, no road router | Suggest within service-window groups | Coordinate heuristic only; not road km |
| Self-hosted OSRM/VROOM approved and reachable | Evaluate road route with timeout fallback | Road estimate from the configured router, with timestamp and provider |
| Router unavailable or stale | Fall back to manual/route-lite order | No fresh road distance; do not show zero |
| Logestechs API credentials/tenant contract absent | Use manual import or verified export | No sync claim and no write-back |
| Address ambiguity or duplicate district name | Block/flag for operator review | No guessing; force Riyadh context in external lookup |

## Riyadh grouping policy

Use the actual coordinate or verified address as the source of truth. The following names are suggested labels for the dispatch conversation only:

- **East/Central:** Al Waha (حي الواحة), Al Olaya (العليا), Al Muhammadiyah (المحمدية), Al Yarmouk (اليرموك), Al Munisiyah (المونسية).
- **North/West:** Al Yasmin (الياسمين), Al Arid (العارض), Hittin (حطين), Diplomatic Quarter/Safarat (حي السفارات), Laban (لبن), Al Mahdiyah (المهدية).

These labels must not silently assign an order. If the row says only a district, the operator must confirm the city and pin before distance measurement. A future zone catalog may assist with labels, but it must never replace geocoding or routing evidence.

## Exact road-distance phase

The next routing phase is deliberately gated:

1. Collect real coordinate coverage from several normal Riyadh order days.
2. Owner approves a self-hosted OSRM endpoint and its operating cost/maintenance.
3. Add a named `NEXT_PUBLIC_OSRM_URL` origin, timeout, attribution, cache policy, and offline fallback. VEGA now contains this opt-in adapter; it is inert until the environment variable is supplied.
4. Record router name/version, request time, route distance, duration, waypoint order, and failure reason.
5. Add visual/operator acceptance with known routes before using distance in driver totals.

The public OSRM demo is not a production dependency. Google Maps links may remain an operator verification aid, but a link is not evidence that VEGA measured a route unless the result was actually recorded. OSRM output is labelled an estimate and includes provider/time metadata in the runtime result; it is not silently persisted as an official distance.

## Research sources

- [Google Maps URLs — official developer documentation](https://developers.google.com/maps/documentation/urls/get-started): `api=1`, encoded directions parameters, driving mode, waypoints, and URL limits.
- [OSRM API documentation](https://project-osrm.org/docs/v26.4.0/): Route, Table, and Trip services; the Trip service is an approximation and not a guarantee of the fastest route.
- [Logestechs API documentation](https://docs.logestechs.com/) and [Logestechs Postman collection](https://www.postman.com/winter-shuttle-965185/logestechs-apis/collection/4tu0gxu/logestechs-apis?sideView=agentMode): external integration references; tenant authorization and exact contract remain unverified.

## Model-worker boundary

Optional local `pi` workers may review column mappings, translate district names, detect suspicious duplicates, or critique a proposed plan. They may not:

- invent a coordinate, route distance, duration, road, driver, or delivery status;
- bypass import warnings or validation;
- call Logestechs write endpoints;
- change persisted VEGA data or accept a route without the operator;
- replace deterministic route calculations or source citations.

The worker contract is documented in `docs/PI_WORKER_POLICY.md`. Any worker output is advisory and must be reproducible from the input snapshot.

## Operator acceptance checklist

The daily task is operationally ready when the manager can complete this sequence with a real sheet:

- upload the Excel sheet and see the preview;
- resolve or acknowledge warnings before import;
- enter/verify coordinates for the stops that need geographic grouping;
- request the two-driver split and inspect excluded rows;
- accept or reject the split;
- enter the depot/start point and choose return-to-depot when required;
- open each Google Maps route and download the driver CSV;
- print the bilingual driver sheet;
- close the day using recorded outcomes.

Any step that cannot be completed from recorded evidence stays marked as missing or review-required.

## Time-saving test

Keep a feature only if a normal operator can use it in under 30 seconds at the decision point and it saves at least 30 minutes per week. If it increases review work, adds a second source of truth, or hides uncertainty, remove or defer it.
