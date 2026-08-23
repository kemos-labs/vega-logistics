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

## 5. Workstream W2 — KPI evidence & evidence gaps (formal)

| KPI | Best external evidence | Gap | VEGA stance |
|---|---|---|---|
| FADR | Parcel Perform 99.22% US-domestic [VENDOR, no methodology] | No small-fleet/KSA distribution published | Internal target ≥90%; no benchmark claim |
| e-POD completeness | APQC measure 108931 median **80.0%**, n=1,144 [PRIMARY]; quartiles behind login | Percentile spread unavailable publicly | Use median as context only; VEGA target ≥98% internal |
| Cost per delivered stop | Grant Thornton: last mile ≈ "up to 50% of total logistics costs" (KSA) [VENDOR] | No SAR small-fleet baseline published | Rolling ±10% control band vs own 4-week baseline |
| Recovery close rate | Industry playbooks 50–65% w/ contact/reschedule [SECONDARY, docs/daily-ops-painpoints.md] | Vendor-sourced | ≥50% internal target (pinned in tests) |
| COD prevalence | SAMA p.24 verbatim — 25% of respondents' last online purchase [PRIMARY survey] | Survey ≠ value share; 2023 data | COD first-class feature; no value-share claims |
| Ramadan surge | SPA/TGA verbatim: 26M+ parcels Ramadan 1446 (+18% YoY), 1.1M peak day [PRIMARY press arm of state agency] | City-level split not in lede | Season-mode multiplier, no numeric plan claim |

## 6. Workstream W3 — tooling register (license + operational catch)

| Tool | Role | License (verified via GitHub license API, 2026-08-23) | Operational catch | Source |
|---|---|---|---|---|
| OSRM backend | routing/matrix | BSD-2-Clause | demo server fair-use ~1rps no SLA → self-host for production; Trip endpoint = single-vehicle ordering only | github.com/Project-OSRM/osrm-backend |
| VROOM | multi-vehicle VRP | BSD-2-Clause | needs OSRM matrix; separate service to operate | github.com/vroom-project/vroom |
| Traccar | GPS ingestion | Apache-2.0 | tracking layer only — dispatch/POD/accounting are integrations; needs a small VPS | traccar.org · github.com/traccar/traccar |
| Nominatim (public) | geocoding | ODbL (data); code GPL | 1 req/s cap; identifying UA/Referer; attribution duty; anti-bulk; self-install for scale | operations.osmfoundation.org/policies/nominatim |
| Supabase Free | future sync backend | platform T&C | **verbatim:** "Supabase pauses Free Plan projects that show low activity over a 7-day period"; warning email ~1 week prior; restore possible "for up to 1 year"; "a few user requests to the database each day" prevents pausing — normal operator usage qualifies; no artificial keep-alive needed or permitted | supabase.com/docs/guides/platform/free-project-pausing · /pricing |
| ERPNext / Odoo | future ERP bridge | GPL-3 / LGPL+OPL modules | Delivery-Trip models differ from VEGA schema; export/import adapter work | docs.frappe.io/erpnext/delivery-trip · odoo.com/documentation |

**CSP interaction (engineering fact):** app ships `connect-src 'self'`; any browser-side OSRM/Nominatim call requires explicit CSP origin additions + attribution UI + policy-compliant UA, else the feature ships offline-manual. No silent loosening (AGENTS.md R6).

## 7. Workstream W4 — Riyadh daily workflow & ten friction points

Basis: founder-operator workflow as captured in `docs/daily-ops-painpoints.md` (industry surveys DC Velocity/FarEye/JJ-Keller + practitioner guidance Bringg/AfterShip/Smartsheet, researched 2026-08-22) `[SECONDARY]`; corroborated by GT structural-challenge list [VENDOR].

Operator day (as-built): WhatsApp manifests at dawn → drivers dispatched → mid-day exception calls → evening cash/count reconciliation → owner types yesterday's numbers into VEGA → weekly report to provider.

| # | Friction moment | VEGA answer (status) |
|---|---|---|
| 1 | Miss reasons scattered across chats | 7 fixed codes + Σ-reconciliation guard ✅ |
| 2 | Recoveries never closed out | Recovery board + close-rate ✅ |
| 3 | Cash counted ≠ deliveries claimed | payments ≤ deliveries checklist ✅ |
| 4 | Fuel receipts vs litres confusion | fuel-in-SAR-only model ✅ |
| 5 | Plan numbers polluted by actuals | plan/actual separation ✅ |
| 6 | Month-end report assembly by hand | one-click EN/AR PDF/Excel ✅ |
| 7 | Provider wants driver/car/plate per day | identity fields + manifest block ✅ |
| 8 | Customer blame disputes | per-customer breakdown → scorecards ✅ |
| 9 | Data trapped in one browser | P1 backups (done) / P5 sync (opt-in) ⏳ |
| 10 | Tomorrow's priorities lost in chat | next-day-focus field → Pro report closing note ✅ |

## 8. Workstream W5 — minimal schema, migration & sync design

Storage today (localStorage JSON):
`vega-financialInput-v2 {FinancialInput}` · `vega-daily-reports-v2 {date→DailyRecord}` · `vega-scenarios-v1 [Scenario{id}]` · `vega-recovery-board-v1 [RecoveryEntry{id}]` · `vega-followup-actions-v1 [FollowUpAction{id}]` · `language "en"|"ar"`.

Migration ledger: v1→v2 DailyRecord (fuelLitres→fuelCost, +optional fields) `migrateDailyRecords()` ✅; backup v1→v2 envelope (adds recovery/actions/language; warns about absent scope) ✅; row-level `updatedAt` backfill on write paths ✅ (absent = oldest).

Future Supabase mirror (P5, opt-in): table-per-collection with text PK (=existing ids/date), jsonb payload column, `updated_at timestamptz`, RLS `auth.uid() = owner_id`; sync = push local rows where local.updatedAt > remote, pull where remote newer; conflicts resolved LWW per row with server timestamp tiebreak identical to backup rules; localStorage remains boot source (offline-first). No schema break required — payloads already serialize.

## 9. Workstream W6 — risk register (twelve items)

| # | Risk | L×I | Mitigation | Early signal |
|---|---|---|---|---|
| 1 | localStorage loss (reset/clear) | H×H | P1 backups + banner (post-acceptance) | days-since-backup |
| 2 | National Address obligation scope ambiguity | M×H | capture fields now; legal scope VERIFY | % shipments missing address |
| 3 | ZATCA wave notice arrives | M×M | invoice-shaped data ready; integrate then | **official ZATCA wave notification received** (sole authoritative signal) |
| 4 | OSRM/Nominatim policy or availability drift | M×L | env-flag endpoints; offline-manual fallback | fetch-failure streak |
| 5 | Supabase free pause | M×L | local-first; restore ≤1yr documented | pause-warning email |
| 6 | RTL/Arabic regression | M×L | typography laws + parity checks | screenshot diff |
| 7 | Backup file user error (replace wrong device) | M×M | preview counts + lossless gate + cancel default | support question |
| 8 | Quota exhaustion on big history | L×M | persistBundle failure surfacing; prune guidance | partialSaveMessage seen |
| 9 | Single-maintainer bus factor | M×H | AGENTS rules + dossier + this plan | session gaps |
| 10 | Provider API/report format change | M×L | parser isolated behind tests | parse warnings spike |
| 11 | Currency/VAT parameter drift | L×M | single config constants; ZATCA notice watch | invoice mismatch |
| 12 | Scope creep past simplicity budget | M×M | R10 budget + phase gates | phase overrun |

## 10. Build-next top 10 (priority order)

| # | Item | Workstream | Pain solved | Stack | Effort | Depends on |
|---|---|---|---|---|---|---|
| 1 | Backup-age banner (in-app) | W5/W6 | silent data rot | none | S | Commit C accepted |
| 2 | Arabic WhatsApp paste-parser | W4 | manual daily entry | none | M | Commit C accepted |
| 3 | National Address fields + AAAA9999 validator | W1 | 2026 carrier rule | none | S | — |
| 4 | Cargo-statement-style manifest block | W1 | provider/TGA paperwork | jsPDF | S | #3 |
| 5 | Invoice-shaped receipt draft (rate configurable) | W1 | billing readiness | jsPDF QR | M | #3 |
| 6 | Driver leaderboard | W2 | performance visibility | existing data | M | — |
| 7 | COD remittance-lag trend | W2 | cash discipline | existing data | S | — |
| 8 | Stop sequencing UI (offline manual) | W3 | tomorrow's routes | none | M | — |
| 9 | OSRM suggestion behind CSP-flagged env | W3 | drive-order sanity | OSRM self-host path | L | #8, CSP decision |
| 10 | Supabase opt-in sync | W5 | multi-device | supabase free | L | stable P1–P2 |

---

## Addendum citations — principal research pass (2026-08-23)

- **GASTAT Warehousing & Logistics Statistics 2024** — General Authority for Statistics (GASTAT), stats.gov.sa publication PDF EN/AR (accessed 2026-08-23; examined directly via search extraction of the publication text and GASTAT news 137). Verbatim Arabic (news 137): «ارتفع عدد الشحنات إلى أكثر من 180 مليون شحنة مقارنة بأكثر من 140 مليون شحنة في عام 2023» · «بلغ متوسط زمن التسليم يومين وارتفاع معدل التسليم في الوقت المحدد إلى 96%» (96% vs 94% in 2023). Figures: parcel/postal shipments **>180M in 2024** (>140M 2023); licensed delivery-app orders **288.1M in 2024** (Q4 peak ≈77.6M per Argaam summary of same report `[SECONDARY confirming GASTAT report]`); **12,234** licensed commercial warehouses (~22M m²); **23** activated logistics centers (34.6M m², Makkah largest at 20.4M m² across six centers). Classification `[OFFICIAL STATISTICS]`. Applicability: market context only — never VEGA targets; small-fleet operator shares are NOT derivable from these aggregates.
- **PDPL core obligations** — Personal Data Protection Law (Royal Decree M/19 dated 9/2/1443H incl. amendments) + Implementing Regulations (SDAIA official PDFs; laws.boe.gov.sa entry, accessed 2026-08-23) `[PRIMARY]`. Controller duties: lawful transparent purpose-specific processing with notice of identity/legal basis/purpose/retention; minimization; security measures; processor safeguards; data-subject rights (inform/access/copy/correct/destruct). Breach notification Implementing Regulations Art.24 verbatim: «تشعر جهة التحكم الجهة المختصة في حالة وقوع حادثة تسّرب للبيانات الشخصية خلال مدة لا تتجاوز (72) ساعة من وقت علمها بالحادثة، إذا كان من شأن تلك الحادثة الإضرار بالبيانات الشخصية أو صاحب البيانات…» + subject notice without undue delay. In force 14 Sep 2023 with compliance adjustment window to 14 Sep 2024 (DLA Piper timeline `[SECONDARY]`).
- **PDPL cross-border transfers** — SDAIA Regulation on Personal Data Transfer Outside the Kingdom (Aug 2024) `[PRIMARY]`: permitted purposes + adequacy list + SCCs/BCRs/accreditation safeguards + risk assessments for exemption routes; onward-transfer continuity; emergency/vital-interest exception. Consequence: R8 sync must select KSA-region hosting and document transfer basis BEFORE any enablement.
- **TGA quarterly parcel bulletins (context)** — Q4-2024: >48M postal parcels delivered (TGA quarterly bulletin via Saudi Gazette/Zawya `[SECONDARY reporting TGA]`); H1-2024 >85M postal shipments transported/delivered (SPA N2185501 `[PRIMARY state press attributing TGA]`). Consistent with GASTAT annual figure.

*Items flagged VERIFY above block any product claim that depends on them. They are queued for direct document extraction before related features ship.*


## Explicitly NOT RESEARCHED (contract E — truth labels)

| Item | Status | What completing it requires |
|---|---|---|
| Labour / driver-hours rules & vehicle inspection regime (KSA) | **NOT RESEARCHED** | Primary texts: TGA driver-hours circulars; periodic technical inspection (Fahes/muroor) official pages |
| OpenRouteService (self-host vs cloud, optimization endpoint parity) | **NOT RESEARCHED** | ORS docs + license (Apache?) + self-host resource sizing |
| n8n / GitHub Actions automation options | **NOT RESEARCHED** | Pricing/self-host matrix; repo-visibility constraints |
| WhatsApp Business API pricing & operational catches | **NOT RESEARCHED** | Meta per-message pricing page quote; template approval flow; BSP comparison |
| Hijri calendar / prayer-time data sources | **NOT RESEARCHED** | Official Umm-al-Qura source or library with citation |
| W5 extended schema: WhatsApp ingestion mapping, invoice lines, National Address columns | **PARTIALLY SPECIFIED** (storage keys + row shapes defined; ingestion mapping & invoice-line table deferred to P2 design) | P2 detailed design doc |

Until researched, these items carry **zero weight in plan decisions** and must not be cited as support.

## Addendum citations (contract D)

- **Grant Thornton KSA last-mile article** — *"Transforming last-mile delivery in Saudi Arabia: From cost burden to competitive advantage"*, Grant Thornton Saudi Arabia, grantthornton.sa/en/insights/articles-and-publications/transforming_last_mile_delivery_in_saudi_arabia/ (undated; accessed 2026-08-23). Verbatim: *"…last-mile delivery remains the most challenging and expensive element of logistics, often accounting for up to 50% of total logistics costs."* · *"Cash-on-Delivery dependency, resulting in failed deliveries, higher return rates, and working capital pressure"* · *"Network coverage gaps, with approximately 40% of demand originating outside major urban centres."* `[VENDOR]`
- **SPA / TGA Ramadan parcel volume** — *"TGA: Over 26 Million Shipments Delivered during Ramadan, Marking 18% Growth"*, Saudi Press Agency (state agency), spa.gov.sa/en/N2290417, published Riyadh March 29, 2025 (accessed 2026-08-23). Verbatim (og:description lede): *"The Transport General Authority (TGA) announced that licensed parcel transport companies delivered more than 26 million shipments and postal parcels during Ramadan 1446 AH, reflecting an 18% increase compared to the same period last year."* · *"the highest daily delivery rate was recorded on the 24th of Ramadan, surpassing 1.1 million shipments within 24 hours… capacity to handle seasonal surges in demand."* Series: ~22M (Ramadan 1445/2024), 14M (1444/2023). `[PRIMARY]` (state press; figures attributed by SPA to TGA)
- **VAT standard rate 15% [UPGRADED VERIFY→PRIMARY 2026-08-23]** — نظام ضريبة القيمة المضافة (VAT Law), Royal Decree M/113 as amended by M/52 and Royal Order A/638, official ZATCA law PDF (zatca.gov.sa/ar/RulesRegulations/Taxes/Documents/…نظام ضريبة القيمة المضافة…pdf, accessed 2026-08-23). Article 2 verbatim Arabic: «تطبـق الضريـبـة بنسبـة أساسـية قـدره (%15) مـن قيمـة التوريـد أو الاسـتيرياد، مالم يرد نص…». Effective-date confirmation: ZATCA news 320/342 («رفع نسبة ضريبة القيمة المضافة من 5% إلى 15% … في الأول من شهر يوليو 2020م»). Simplified-invoice contents remain cited to the VAT portal page (date, supplier name/address, description, amount, VAT value); quarterly-return threshold ≤40M SAR supplies same page. Product consequence: `vatRate` default 15 is now source-backed; configurable; UI copy stays "draft invoice data". `[PRIMARY]`
- **Supabase project pausing (correction)** — *"Project Pausing | Supabase Docs"*, supabase.com/docs/guides/platform/free-project-pausing (accessed 2026-08-23). Verbatim: *"Supabase pauses Free Plan projects that show low activity over a 7-day period to save server resources."* · *"Typically a few user requests to the database each day over the previous week is enough to keep the project from being paused."* · warning email ~one week before pause · *"You can restore a paused project for up to 1 year after it was paused."* `[VENDOR doc]` — corrects the earlier dossier line that implied indefinite loss; normal operator activity is sufficient, and no artificial keep-alive is used.
- **Tool licenses** — GitHub license API, 2026-08-23: Project-OSRM/osrm-backend LICENSE.TXT → **BSD-2-Clause**; vroom-project/vroom LICENSE → **BSD-2-Clause**; traccar/traccar LICENSE.txt → **Apache-2.0**. `[PRIMARY]`
