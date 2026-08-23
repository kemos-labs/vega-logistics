# KSA Compliance Matrix — evidence-tracked
**Date:** 2026-08-23 · **Purpose:** map every regulatory touchpoint to VEGA product decisions, with applicability by operator activity and vehicle class. Every row carries a source class from the dossier. **Nothing in this document authorizes compliance wording in UI** (AGENTS.md Rule 8).

## Applicability axes

VEGA's assumed operator: a licensed **parcel/courier transport provider** running light vehicles (typical vans/pickups ≤3,500 kg) under TGA licensing, moving e-commerce parcels for providers/customers, collecting COD cash.

| # | Obligation / fact | Applies to VEGA operator? | Primary source & date | Product consequence | Status |
|---|---|---|---|---|---|
| 1 | Parcel companies must not accept/carry postal shipments without recipient National Address; fines SAR 5,000–50,000 | **Yes — core activity** (parcel carrying) | TGA news 198, effective 2026-01-01 `[PRIMARY]` (verbatim Arabic archived in dossier) | R5: National Address field + completeness flag on shipments/manifest; never claim "verified" | Field capture planned R5 |
| 2 | Short Address = 4 letters + 4 digits format | Yes (address data quality) | SPL national address portal `[PRIMARY]` | `^[A-Za-z]{4}\d{4}$` **format-only** validator labelled "تنسيق فقط / format check only" | Planned R5 |
| 3 | VAT standard rate 15% of supply/import value unless zero-rated/exempt | Yes if VAT-registered (owner confirms registration) | VAT Law Art.2 (Royal Decree M/113 as amended by M/52 + Royal Order A/638): «تطبـق الضريـبـة بنسبـة أساسـية قـدره (%15) من قيمة التوريد أو الاستيراد» — ZATCA official law PDF `[PRIMARY]`; effective 1 Jul 2020 per ZATCA news 320/342 | R5 receipt drafts: configurable `vatRate` default 15 now source-backed; UI copy "draft invoice data" only | Default unblocked |
| 4 | Simplified tax invoice required contents (date, supplier name/address, description, amount, VAT value); quarterly return threshold ≤40M SAR supplies | Conditional (B2C issuer) | ZATCA VAT portal `[PRIMARY]` | Receipt draft field list mirrors these; QR payload Phase-1-shaped | Planned R5 |
| 5 | ZATCA Phase 2 integration (XML/PDF-A-3, clearance/reporting, crypto stamp) | Only when operator receives wave notice ≥6 months ahead | ZATCA roll-out docs; mechanism details partially VERIFY `[PRIMARY→VERIFY]` | Data-shape readiness only; **never** "ZATCA compliant" | Deferred by design |
| 6 | Light-freight (≤3,500 kg) operating-card/driver-card/transport-document specifics | Likely yes for vehicle class — text not yet extracted | TGA regulation entry 4786 `[VERIFY]` (JS-rendered portal blocks direct extraction) | Manifest fields labelled "informed by TGA documentation"; non-authoritative wording until extracted | VERIFY queue |
| 7 | Driver-hours/rest rules (light freight scope unknown) | Unknown — NOT RESEARCHED | TGA circulars `[NOT RESEARCHED]` | None built; no shift-length features that imply legal limits | Not researched |
| 8 | PDPL controller obligations: purpose limitation, minimization, transparency notice, retention limits, security measures | **Yes** once any recipient/driver personal data is stored (names, phones, plates, addresses) | PDPL (M/19 1443H) + Implementing Regulations `[PRIMARY]` (SDAIA official PDFs) | Privacy labels on fields (R2 data model); collect phone ONLY with justification; export = local file, no third-party transfer | Design rule active now |
| 9 | PDPL breach notification: authority within **72h** of awareness where harm likely; data subjects without undue delay | Yes (controller duty) | Implementing Regulations Art.24 Arabic verbatim: «تشعر جهة التحكم الجهة المختصة … خلال مدة لا تتجاوز (72) ساعة من وقت علمها بالحادثة» `[PRIMARY]` | Documented in this matrix + OPERATOR_WORKFLOW guidance; no product feature can satisfy it automatically — owner procedure note in backup/docs screen (R5) | Documented |
| 10 | Cross-border transfer rules (adequacy list / SCCs / risk assessments) | Triggers only if data leaves the Kingdom (e.g., future cloud sync region choice) | SDAIA Transfer Regulation (Aug 2024) `[PRIMARY]` | R8 sync design must pick KSA-region hosting and record the privacy note before enabling | Gate on R8 |
| 11 | COD prevalence (context) | Context only | SAMA 2023 payments study p.24: cash = 25% of respondents' last online purchase `[OFFICIAL STATISTICS]` | COD reconciliation stays first-class; no market-value claims | Live |

## Vehicle-class caution

Rules verified for heavy freight must not be silently extended to light courier vehicles (dossier correction log). Until item 6 is extracted verbatim, every manifest/export says: **«مستند تشغيلي داخلي — ليس مستنداً نظامياً» / "Internal operational document — not an official transport document."**

## Prohibited claims register (enforced at review)

"National Address verified" · "TGA compliant" · "ZATCA compliant" · "PDPL certified" · "legally valid transport document" · "production ready" (for server-dependent claims) · "real-time/live tracking" (until a real adapter exists).
