# How the logistics industry works — tools & daily-report standards

*Deep-dive researched 2026-08-22 (CSCMP glossary, Inbound Logistics, Oracle TMS,
Infor WMS, DHL first-mile glossary, trade.gov export docs; report-writing:
Indeed, Smartsheet, SafetyCulture end-of-shift checklists, Jotform driver logs).*

## 1. End-to-end flow (where VEGA sits)

```
Plan → First mile → Warehouse → Middle mile → Last mile → POD → Returns
        pickup      WMS          line-haul      route+driver   confirm   inspect/
        label       pick/pack    hub/cross-dock dispatch        ePOD      restock
```

**VEGA targets the last-mile operator + owner's planning desk**: the daily
loop of *plan → dispatch → deliver → record → recover → report*. Documents that
flow alongside goods: labels, manifests, bills of lading/waybills, invoices,
exception reports, ePOD.

## 2. Provider roles (who does what)
| Role | Function | Assets |
|------|----------|--------|
| Carrier | moves freight | owns trucks |
| Freight broker | connects shipper ↔ carrier | none |
| 3PL | executes outsourced logistics (warehouse + transport) | mixed |
| 4PL | orchestrates network across 3PLs/carriers/systems | none |

VEGA's providers/freelancers model ≈ brokered/hybrid capacity — already modeled.

## 3. Software categories & the integration spine
`ERP/OMS → WMS → TMS → dispatch/driver app ↔ telematics → ePOD → billing`

| System | Job | VEGA analogue today |
|--------|-----|---------------------|
| WMS | warehouse execution & inventory | — (future) |
| TMS | planning, carrier selection, tendering, settlement | fleet/customers/costs engine |
| Dispatch board | daily driver/vehicle/stop assignment | planned (recovery board next) |
| Telematics | GPS, driver behaviour, compliance | roadmap adapter (Samsara/Geotab) |
| ePOD | signature/photo/timestamp/exceptions | roadmap (status tracking first) |

Lesson from integrations: **clear system ownership beats API count** — our
repository layer (`resolveRepository()`) is the seam where real systems plug in.

## 4. Daily ops report — professional structure (now implemented)

1. **Header** — date, coverage ✅ cover band
2. **Executive summary with RAG status** — ✅ narrative + `deriveStatus()` chip
   (red = any bad insight / safety incident, amber = warnings, else green)
3. **KPI scorecard: actual vs target + variance** ✅ KPI grid + monthly variance table
4. **Operational activity** ✅ 14-day delivered/missed chart vs target line
5. **Staffing / fleet / resources** ✅ new Fleet & Crew block (drivers present/planned,
   fuel spend vs model day, incidents, extra costs)
6. **Quality / safety / compliance** ✅ `safetyIncidents` counter → red-flag insight
7. **Issues & corrective actions with OWNER** ✅ open follow-up actions listed in dossier
8. **Next-day plan** ✅ `tomorrowNote` field → dedicated section in preview + PDF

Best practices applied: factual reporting separated from projection (bars only
on recorded days), consistent KPI definitions (one engine), every action has an
owner, reports close with tomorrow's priorities.

## 5. Fuel in cash, not litres
Drivers and owners think in money at the pump. `DailyRecord.fuelCost` (SAR) is
now the source of truth; legacy litres records auto-migrate at the stored pump
price on load (`migrateDailyRecords`). Model comparisons use SAR model-day
(`fuelMonthlyCost ÷ 26`).
