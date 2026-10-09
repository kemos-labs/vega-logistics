# Food and parcel daily-workflow readiness — 8 October 2026

VEGA currently supports a supervised parcel-operations workflow. Passing software gates does not establish food-transport suitability or owner acceptance. Nemow is the carrier and owns the fleet; Tard is a client.

## Source checked in this continuation

The official [SFDA General Requirements for Food Transport](https://sfda.gov.sa/sites/default/files/2021-10/GeneralRequirementsFoodTransport_0.pdf) was retrieved on 8 October 2026, Asia/Riyadh. The PDF has 26 pages; its edition/effective date is not established from the retrieved cover. The English translation says the Arabic original prevails. A newer SFDA listing appeared in search results but its current document endpoint returned 404, so this review does not claim the retrieved guide is the newest applicable instrument.

PDF pages 4–6 describe transporter responsibilities for sanitation, separation, suitable vehicles and product-appropriate transport temperatures, with retained continuous temperature readings for refrigerated transport. Product tables vary by food category. This is evidence for a requirements gap, not a universal temperature threshold or legal certification of Nemow's activity. Specific activity, product and applicable version need confirmation before operational enforcement.

## Gap between source requirements and current app

| Operating evidence | Current VEGA boundary | Work required before food pilot |
|---|---|---|
| Product category and transport conditions | Generic stops and time windows; no product-specific food profile | Capture an agreed product/packaging profile and evidenced handling requirements |
| Temperature history | No continuous logger ingestion or readings record | Agree logger/evidence source, timestamps, device identity, custody and retention; do not infer temperature from arrival time |
| Sanitation and segregation | No vehicle/container hygiene record | Define operator-reviewed inspection evidence and corrective actions |
| Excursion or contamination | Generic delivery-failure/recovery codes | Define hold/escalation/disposition authority and traceable exceptions; never automate food-release decisions from missing data |
| Prepared-meal timing | Broad morning/afternoon/evening windows | Obtain actual client preparation/pickup/promise/handoff timestamps and SLA; no generic SLA is asserted |

## Daily workflow automation boundary

Existing deterministic helpers cover import preview, source checks, assignment proposals, ordered handoff, close arithmetic, report generation and backups. Operator confirmation remains necessary for imports, assignments, corrections, cash evidence and final reports. Browser-local VEGA storage and the Python reporting folder are separate systems; the root report-job pipeline is not an automatic bridge into app storage.

Before unattended operation: establish the input source/tenant contract, retry and reconciliation evidence, a review queue, run-level costs, failure alerts and operator recovery. External sending and tenant writes remain unimplemented. Advisory Pi workers may review bounded snapshots; they do not make driver decisions, invent distances, change app state or send messages.

## Acceptance checklist for the next supervised pilot

Use a representative export without changing existing signed reports. Reconcile source totals, excluded integrations, status buckets, drivers, expected COD and recorded collection/remittance separately. Exercise one missing-cash day, a draft close, a failed stop and a restored backup. Measure time and manual interventions. Record owner acceptance explicitly. A food pilot adds actual food profiles and transport evidence above; parcel tests cannot stand in for them.
