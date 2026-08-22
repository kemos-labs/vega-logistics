# Daily-ops pain points → VEGA upgrade map

*Resourced from 2025 industry surveys (DC Velocity, FarEye "Eye on the Last Mile",
JJ Keller Fleet Mgmt Study) and practitioner guidance (Bringg, AfterShip,
Smartsheet delivery-log templates). Researched 2026-08-22.*

## What the industry says hurts daily

| # | Pain point | Evidence | Status in VEGA |
|---|-----------|----------|----------------|
| 1 | **Failed deliveries have no follow-up loop** — exceptions get counted, not recovered; recovery metrics (reattempt success, notification latency) rarely tracked | AfterShip/UPS exception workflows; Bringg 2026 report | ✅ v0.5: structured miss reasons + `recoveredShipments` counter → recovery-rate insight, narrative line, Delivered KPI shows `+N recovered` |
| 2 | **Standardized miss reason codes** are the #1 requested spreadsheet field | Smartsheet shipping-log template guidance | ✅ v0.5: 7 fixed reason codes with reconciliation guard (`Σ reasons = failed count`) |
| 3 | **Real-time disruption** — 69% of companies replan routes daily | DC Velocity 2025 survey | ⏳ Roadmap: route-replan checklist in daily report (needs telematics feed first) |
| 4 | **Driver scorecards**: completed stops, first-attempt success, on-time % vs assigned stops | Curri metrics glossary; JJ Keller study | ⏳ Roadmap: per-driver day attribution (roster already exists) |
| 5 | **POD completeness gaps** (signature/photo/timestamp) cause disputes & payment delays | MangoApps POD audit template | ⏳ Roadmap: POD status per customer-day (no camera scope yet) |
| 6 | **Cost-per-stop blindness** — fuel, failed attempts, excess mileage | FarEye 2025 (cost = leading challenge) | ✅ Partial: daily profit + fuel-vs-model insight; ⏳ cost-per-stop KPI |
| 7 | Hybrid fleet visibility (owned + rented + freelance) | FarEye 2025 | ✅ Already modeled (providers/freelancers/fleet classes) |

## Open-source tools worth borrowing patterns from
- **Fleetbase** (AGPL) — dispatch/tracking/POD data model; good schema reference for our future backend
- **VROOM / PyVRP** — route optimization engines; candidate for a later "plan tomorrow's stops" feature
- **Traccar** — GPS tracking ingestion if telematics is added

## Deep-research loop findings (2026-08-22, round 2) — applied
- **Exception SLAs**: single queue + named owners (✓ board) + closure KPIs; operating target ≥85% closed <24h. → Board now shows overdue share (>7d escalation threshold) & hot-row aging
- **Reattempt recovery benchmarks**: ~20–30% unassisted vs **50–65% with contact/reschedule** → recovery chip shows "Target ≥50% close rate"
- **Cost per stop method**: fully loaded route cost (incl. fuel cash, retries/claims extras) ÷ COMPLETED stops → `buildCostPerStopSeries()` implements exactly this; sparkline in preview + vector trend in PDF
- **Customer health weights**: delivery ≈35%, recurrence/trend ≈20% of churn models → scorecard thresholds (warn >8%, bad >15% miss-rate, min 10 attempts) align; trend column queued
- **Saudi market notes**: COD/RTO tracking matters (mature ops RTO <10% benchmark); failure-reason codes ✓ already captured
- Sources: LateShipment exception playbook, Intugine KPI library, RouteAndFleet cost-per-stop economics, BCG cost-intelligence parcel report, McKinsey OTIF definitions

## Next increments (priority order)
1. **Recovery board view** — per-miss follow-up rows (reason → owner → reattempt date → outcome) persisted like scenarios; feeds recovery-rate trend into pro reports
2. **Per-customer delivered/missed breakdown** input (auto-suggest from provider plan) → customer scorecard panel
3. **POD status column** per recorded day (complete/partial/none) + dispute-risk flag when incomplete
4. **Cost-per-stop KPI** on summary (daily cost ÷ completed stops)
