# VEGA Research Dossier — verified source register
**Compiled:** 2026-08-23 · **Compiler:** coding agent under review contract · **Scope:** KSA regulatory map, operations benchmarks, free-tooling constraints feeding `docs/MASTER_PLAN.md`.

Every claim below carries: exact source title · direct URL · issuing organisation · publication/effective date (or "undated" + page last-update) · access date (2026-08-23 for all) · verbatim quotation or precise document reference · classification `[PRIMARY] | [SECONDARY] | [VENDOR] | [ESTIMATE] | VERIFY`.

---

## 0. Corrections log (review findings → disposition)

| # | Prior claim (rejected) | Disposition |
|---|---|---|
| C1 | "COD ≈22–25% of Saudi e-commerce value" | **Corrected.** SAMA figure is survey data on respondents' **last** e-commerce purchase payment method (25% of respondents), not a share of transaction value. See §1.1. |
| C2 | "First-attempt success median 86–91% / top quartile 95–97%" attributed to Parcel Perform Q2-2025 | **Removed.** That source reports **99.22% US domestic** and contains no median/quartile distribution; the 86–91% figures originated from a third-party blog (`theleaninitiative.com`, vendor-adjacent) with no stated methodology. VEGA's ≥90% FADR is reclassified as an **internal operating target**, not a benchmark claim. See §2.1, §3. |
| C3 | "e-POD target ≥98%" implied industry-supported | **Relabelled.** APQC supports only the 80.0% cross-industry median. The ≥98% figure is a **VEGA internal target** with no external source. See §2.2. |
| C4 | National Address 2026 parcel rule cited to SPL marketing page + secondary press | **Re-cited to official TGA enforcement announcement** (news item 198, dated 2026-01-01), verbatim Arabic quoted. Format-validation vs authoritative-address-validation distinguished in §1.2. |
| C5 | Five-field TLV QR presented as sufficient for ZATCA compliance | **Separated by phase.** Phase 1 = generation + QR per spec. Phase 2 = integration (XML/PDF-A-3, Fatoora portal, clearance vs reporting, cryptographic stamp) in waves with ≥6-month notice; five-field QR alone does **not** make a Phase-2 invoice compliant. Wave applicability is taxpayer-specific — VEGA cannot self-declare a wave. See §1.3. |
| C6 | "PDF manifest doubles as TGA-style cargo statement" implying legal sufficiency | **Downgraded.** TGA provides electronic transport-document services; evidence that a self-made PDF manifest satisfies any per-trip legal requirement is inconclusive. Marked VERIFY; P2 deliverable renamed "manifest export *informed by* TGA fields", no compliance claim. See §1.4. |
| C7 | GitHub-Actions cron digest reading localStorage | **Removed from plan.** A static GH-Pages app keeps user data in the browser; server-side cron cannot read it. Replaced by manual export workflow until a backend exists (P5). |
| C8 | Scheduled local-notification backup reminders | **Removed.** Web push/local notifications require a service-worker push subscription and typically a server; unreliable as claimed. Replaced by in-app banner keyed off last-backup timestamp. |
| C9 | Supabase keep-alive via Actions cron | **Removed.** Free-tier project pausing after ~1 week inactivity is accepted platform behaviour; circumvention violates the spirit of the tier. Local-first design makes pauses tolerable; restore-from-backup is the recovery path. |

---

## 1. Saudi regulatory map

### 1.1 COD prevalence — SAMA Payment Usage Study 2023
- **Source title:** *Report on Payments Usage Study* (2023)
- **URL:** https://www.sama.gov.sa/en-US/Documents/Report_on_Payments_Usage_Study_2023_en.pdf
- **Organisation:** Saudi Central Bank (SAMA)
- **Publication date:** 2023 (report year 2023); **Access:** 2026-08-23
- **Reference:** PDF p.24, section on e-commerce payment methods (§4.x)
- **Verbatim:** *"When asked about the last e-commerce purchase payment method debit cards emerge as the preferred method of payment for e-commerce transactions, with 50% of users opting for this method. Cash on delivery (COD) is the second most preferred method of payment for online purchases, wherein 25% of respondents reported it as a preferred method of payment."*
- **Classification:** `[PRIMARY]`
- **Consequence:** COD reconciliation stays a core feature. Correct framing: 25% **of surveyed consumers** used/preferred cash for their most recent online purchase — directionally supports keeping COD first-class, but is **not** a market-value share.

### 1.2 National Address — parcel-carrier obligation
- **Source title:** TGA news item: تطبيقات توصيل الطلبات البريدية (enforcement announcement)
- **URL:** https://www.tga.gov.sa/ar/MediaCenter/TGANewsDetails/198
- **Organisation:** Transport General Authority (TGA), Saudi Arabia
- **Effective/publication date:** 2026-01-01 (page-dated); **Access:** 2026-08-23
- **Verbatim (Arabic):**
  > «بدأت الهيئة العامة للنقل اليوم، تطبيق قرار إلزام شركات نقل الطرود بعدم استلام أو نقل أي شحنة بريدية لا تتضمن العنوان الوطني، مؤكدة أنه ستُنفذ العقوبات النظامية بحق الشركات التي لم تلتزم بالقرار.»
  > «…الغرامات تبدأ من 5 آلاف ريال وتصل إلى 50 ألف ريال على الشركات غير الملتزمة بهذا القرار…»
- **Translation (working):** As of today [1 Jan 2026], parcel transport companies must not accept or carry any postal shipment lacking the recipient's National Address; regulatory penalties apply, SAR 5,000–50,000 for non-compliant companies.
- **Classification:** `[PRIMARY]`
- **Short Address format** — *National Address portal*, Splonline, https://splonline.com.sa/en/national-address-1/ (undated; accessed 2026-08-23): *"A short address that is easy to memorize, consists of 4 letters and 4 numbers"*; components enumerated as Building #, Street, Secondary #, District, Postal Code, City. `[PRIMARY]`
- **Validation boundary (design rule):** regex `^[A-Za-z]{4}\d{4}$` checks **format only**. Authoritative address verification exists solely through SPL channels; VEGA must never present format-passing strings as *verified addresses*. Any future authoritative check requires SPL services/API access.
- **Applicability note:** announcement targets companies in the **postal-parcels activity (نشاط نقل الشحنات البريدية)**. Whether it extends to every courier arrangement is a legal question — VERIFY with TGA/licensing advisor before treating it as binding on VEGA's exact activity.

### 1.3 ZATCA e-invoicing (FATOORAH)
- **Roll-out phases** — *"E-invoicing (FATOORAH) implementation in KSA — Roll-out phases"*, ZATCA, https://zatca.gov.sa/en/E-Invoicing/Introduction/Pages/Roll-out-phases.aspx (undated; accessed 2026-08-23):
  - *"Phase 1, known as the Generation phase, will require taxpayers to generate and store tax invoices and notes through electronic solutions compliant with Phase 1 requirements."*
  - *"Phase 1 is enforceable as of December 4th, 2021, for all taxpayers (excluding non-resident taxpayers)…"*
  - *"Phase 2, known as the Integration phase and rolled-out in waves by targeted taxpayer group, will involve … the integration of these electronic solutions with ZATCA's systems."*
  - *"ZATCA will notify taxpayers of their Phase 2 wave at least six months in advance…"*
  `[PRIMARY]`
- **Phase-2 technical requirements** — *"How to Get Ready?"* (Phase 2), ZATCA, https://zatca.gov.sa/en/E-Invoicing/PreparingYourBusiness/Phase2/Documents/How%20to%20get%20ready.pdf (accessed 2026-08-23):
  - Verbatim (PDF p.1): *"The system must be capable of generating and storing electronic invoices in the required format (XML) or (PDF/A-3 with embedded XML) including all mandatory fields"*
  - Verbatim: *"Integrate e-invoicing solution with ZATCA's Fatoora portal"* (3-step integration overview).
  `[PRIMARY]`
- **Clearance vs reporting, cryptographic stamp** — documents: *E-Invoicing Detailed Guideline*, https://zatca.gov.sa/en/E-Invoicing/Introduction/Guidelines/Documents/E-Invoicing_Detailed__Guideline.pdf ; *E-Invoicing Implementation Resolution (19 May 2023)*, https://zatca.gov.sa/en/E-Invoicing/Introduction/LawsAndRegulations/Documents/20230519_E-Invoicing%20Implementation%20Resolution%20English.pdf . Working understanding: standard (B2B) invoices are **cleared** by ZATCA before sharing; simplified (B2C) invoices are **reported** within 24 hours; Phase-2 EGS units stamp invoices cryptographically with a ZATCA-issued CSID and render a multi-tag TLV/Base64 QR. **Page-level quotations pending full extraction → `VERIFY`** (classification of mechanism: SECONDARY synthesis of PRIMARY documents).
- **Phase-1 simplified-invoice QR mandate** — *"How to get ready? (Phase 1)"*, ZATCA, https://zatca.gov.sa/en/E-Invoicing/PreparingYourBusiness/Phase1/Pages/How-to-prepare.aspx (accessed 2026-08-23): *"Simplified Tax Invoices (B2C): A mandatory QR code generated by the taxpayer's E-Invoicing solution based on ZATCA's specifications…"* `[PRIMARY]`. The widely-published five-field content list (seller name, VAT number, timestamp, invoice total incl VAT, VAT total) is **VERIFY** — enumerate only after quoting the Detailed Guideline directly.
- **Wave applicability:** determined solely by ZATCA notifications tied to taxpayer revenue bands; VEGA must store invoice-shaped data but can never claim Phase-2 compliance without the operator's actual wave notice and an integrated EGS.

### 1.4 TGA freight licensing & transport documents
- **Regulation reference:** TGA regulations index entry https://www.tga.gov.sa/ar/Regulations/Regulation/4786 ; general licensing pages https://www.tga.gov.sa/en/abouttga (both accessed 2026-08-23).
- **Light-freight definition (≤3,500 kg)** and licensing prerequisites (CR, insurance, inspection, driver credentials): reported consistently across secondary Arabic legal portals referencing TGA regulation → **`VERIFY` against the current regulation text before any product claim.**
- **Electronic transport documents:** TGA operates electronic goods-transport-document services (my.gov.sa service 19520, https://my.gov.sa/en/services/19520 `[PRIMARY]` for existence of the service). **No evidence found that an ordinary self-generated PDF manifest legally substitutes for any required document.** VEGA P2 therefore ships a *cargo-statement-style manifest export* explicitly labelled non-authoritative.

## 2. Operations benchmarks

### 2.1 First-attempt delivery success (FADR)
- **Source:** *"Domestic Delivery Performance in the United States (Q1 vs Q2 2025)"*, Parcel Perform insights page, https://www.parcelperform.com/insights/united-states-delivery-performance-q2-2025-ai-commerce (publication date not shown on page; accessed 2026-08-23).
- **Verbatim:** *"First-attempt delivery success rose slightly from 99.10% to 99.22%, reinforcing the U.S. market's reputation for near-perfect doorstep reliability."* Also FAQ: *"The U.S. achieved a first-attempt success rate of 99.22% in Q2, one of the highest globally."*
- **Methodology:** none published on page ("we use Parcel Perform's Q1 and Q2 2025 data"); scope implicitly US domestic carrier networks.
- **Classification:** `[VENDOR]`.
- **Disposition:** NOT comparable to a small Riyadh fleet (different density, network, denominator definitions). The previously-cited 86–91%/95–97% medians traced to https://theleaninitiative.com/blog/lean-six-sigma-last-mile-delivery-first-attempt-success `[VENDOR/SECONDARY]` — **withdrawn** as a benchmark. VEGA FADR ≥90% = internal operating target (§3).

### 2.2 Electronic proof-of-delivery completeness
- **Source:** *Percentage of deliveries with electronic proof of delivery*, APQC Open Standards Benchmarking measure ID 108931, https://www.apqc.org/what-we-do/benchmarking/open-standards-benchmarking/measures/percentage-deliveries-electronic-proof (accessed 2026-08-23).
- **Verbatim data row:** Total sample size **1,144** companies; **Median 80.0%** (25th/75th percentile values behind login). Measure text: *"calculates percentage of deliveries with electronic proof (this may include customer electronic signoff, delivery snapshots, etc.) of delivery."*
- **Classification:** `[PRIMARY]` benchmark publisher (values as displayed publicly).
- **VEGA ≥98% POD-completeness goal:** internal target, no external support — labelled internal everywhere.

## 3. VEGA internal operating targets (no external source; set by owner contract)

| Target | Value | Rationale |
|---|---|---|
| FADR / completion | ≥90% daily (stretch 95%) | Owner-set; consistent with small-fleet economics |
| Miss rate | ≤8% warn · ≤3% healthy | Pinned in report-engine tests since v2 |
| e-POD completeness | ≥98% | Internal stretch above APQC 80.0% median |
| Recovery close rate | ≥50%; overdue>7d hot | Owner-set, encoded in RECOVERY_TARGETS |
| Fuel cost control | alert >115% of model day | Encoded in insight thresholds |
| Cost per delivered stop | ±10% of rolling 4-week baseline | Internal control-chart logic |

## 4. Tooling constraints (verified policies)

### 4.1 Nominatim public instance — *OSMF usage policy*
- **URL:** https://operations.osmfoundation.org/policies/nominatim/ · OSM Foundation · undated policy page · accessed 2026-08-23 · `[PRIMARY]`
- **Verbatim:** *"No heavy uses (an absolute maximum of 1 request per second)."* · *"Provide a valid HTTP Referer or User-Agent identifying the application (stock User-Agents as set by http libraries will not do)."* · *"Clearly display attribution as suitable for your medium."* · Data *"provided under the ODbL license"* · *"periodic requests from apps are considered bulk geocoding and as such are strongly discouraged"* · *"If your requirements are even larger you can install your own instance of Nominatim."*

### 4.2 OSRM demo server
- **URLs:** https://github.com/Project-OSRM/osrm-backend (wiki: Demo-server), https://project-osrm.org/docs/ · accessed 2026-08-23 · `[SECONDARY]` (policy details via project wiki/aggregator; `VERIFY` current demo policy at deployment time).
- Working constraints: demo server is fair-use (~1 rps, no SLA), unsuitable for production; production path = self-host or managed provider. Trip endpoint ≈ single-vehicle ordering; multi-vehicle VRP needs VROOM (https://github.com/vroom-project/vroom).

### 4.3 CSP interaction (VEGA-specific engineering fact)
VEGA ships `connect-src 'self'`. Therefore **any** browser-side call to OSRM/Nominatim public endpoints requires either (a) explicit CSP extension naming those origins + their attribution/UI duties, or (b) self-hosted/proxied endpoints later. No silent CSP loosening is permitted (AGENTS.md R6). Offline behaviour: routing features degrade to manual ordering when fetch fails; nothing blocks core daily flow.

### 4.4 Platform limits (vendor statements)
- **Supabase Free tier:** https://supabase.com/pricing and https://supabase.com/docs/guides/platform/database-size (accessed 2026-08-23): 500 MB database, 1 GB file storage, projects may pause after ~1 week of inactivity, no automatic backups/PITR on free. `[VENDOR]`
- **Traccar:** https://www.traccar.org/ , https://github.com/traccar/traccar/ (accessed 2026-08-23): open-source GPS tracking platform, live tracking/history/geofences/reports; tracking layer only — dispatch/POD/accounting remain integrations. `[PRIMARY]` project docs / `[VENDOR]` positioning.

---
*Items flagged VERIFY above block any product claim that depends on them. They are queued for direct document extraction before related features ship.*
