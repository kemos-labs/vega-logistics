# VEGA Logistics OS — Master Plan
**Status:** ACTIVE · **Horizon:** 6 months · **Owner:** founder + coding agents
**Evidence base:** `docs/RESEARCH_DOSSIER.md` (verified source register — every factual claim below traces there) · `AGENTS.md` (hard rules)

Claim discipline: **[REG]** = regulatory requirement with primary source · **[BM]** = industry benchmark with source · **[INT]** = VEGA internal target, no external support. Anything unverified is marked VERIFY and blocks dependent product claims.

---

## 1. Vision

One screen the owner opens every morning and closes every night. It must answer, in Arabic or English, in under 30 seconds:

> *What happened yesterday, what broke, who owes me what, what must happen today.*

Everything else serves that sentence.

## 2. Where we are (audited)

| Capability | State |
|---|---|
| Daily ops entry (deliveries/misses/drivers/fuel-SAR/COD/POD/customer split) | ✅ live |
| Plan-vs-actual engine + variance history | ✅ live |
| Standard & Pro reports, EN/AR/both, PDF+Excel, vector charts | ✅ live |
| Recovery board (owners, aging, close-rate, weekly trend) | ✅ live |
| Customer scorecards w/ trend | ✅ live |
| Native Saudi Arabic UI (Cairo), PWA offline shell | ✅ live |
| Telematics seam (mock adapter) | ✅ seam only |
| Persistence | ⚠️ localStorage single-device |
| Compliance features | ❌ none (research stage) |
| Route planning | ❌ none |

## 3. KSA ground truth (sourced)

| Fact | Class | Consequence for VEGA | Source |
|---|---|---|---|
| From 1 Jan 2026 TGA enforces: parcel companies must not accept/carry postal shipments lacking recipient's National Address; fines SAR 5,000–50,000 [REG] | [PRIMARY] TGA news 198 (2026-01-01) | National-Address field + format validation on shipment/customer records; manifest exports carry it; **no compliance claim** until operator's licensing scope confirmed | tga.gov.sa/ar/MediaCenter/TGANewsDetails/198 |
| Short Address format = 4 letters + 4 numbers [REG-format only] | [PRIMARY] SPL portal | Client-side `AAAA9999` check is *format validation*; authoritative verification only via SPL services | splonline.com.sa/en/national-address-1 |
| ZATCA Phase 1 ("Generation", since 4 Dec 2021): compliant generation/storage of e-invoices; simplified B2C invoices require QR per ZATCA spec [REG] | [PRIMARY] zatca.gov.sa | Receipt generator stores invoice-shaped data + QR payload fields; never claims more than data-readiness | zatca.gov.sa Roll-out phases · Phase-1 How-to-prepare |
| ZATCA Phase 2 ("Integration", waves from 1 Jan 2023): Fatoora integration, XML or PDF/A-3 w/ embedded XML, clearance (B2B) vs 24h reporting (B2C), cryptographic stamp; wave assignment only via ZATCA notice ≥6 months ahead [REG] | [PRIMARY] docs; mechanism details VERIFY pending page-level extraction | VEGA can only keep data ZATCA-shaped. No "compliant" wording anywhere in UI. Operator checks own wave notice | zatca.gov.sa How-to-get-ready.pdf · Detailed Guideline · 19-May-2023 Resolution |
| TGA light-freight (≤3,500 kg) rules & electronic transport documents | **VERIFY** | P2 manifest export labelled "informed by TGA fields", explicitly non-authoritative | tga.gov.sa/ar/Regulations/Regulation/4786 |
| COD: 25% of surveyed consumers chose cash for their **last** online purchase (debit 50%) — survey of payment method, NOT value share | [PRIMARY] SAMA 2023, p.24 | COD reconciliation stays core; no market-value claims in copy | sama.gov.sa Report_on_Payments_Usage_Study_2023_en.pdf |
| Ramadan / Hajj / Riyadh-season alter demand patterns and truck-access windows | [SECONDARY] press/consultancy | Season mode = manual plan multiplier + shifted shift labels; no numeric claim | see dossier §4 (Grant Thornton piece, SPA items) |

## 4. Targets — three separate registers

**Industry benchmarks [BM]**
| Measure | Value | Source |
|---|---|---|
| e-POD completeness, cross-industry median | 80.0% (n=1,144 companies) | APQC measure 108931 |
| US domestic first-attempt success Q2-2025 | 99.22% (vendor-reported, not small-fleet/KSA comparable) | Parcel Perform `[VENDOR]` |

**VEGA internal operating targets [INT]** *(owner-set; no external support claimed)*
| Target | Value | Encoded in |
|---|---|---|
| Completion/FADR | ≥90% daily (stretch 95%) | scoreboard target line |
| Miss rate | ≤8% warn · ≤3% healthy | insight thresholds + tests |
| e-POD completeness | ≥98% (stretch above APQC median) | podLine/podShare |
| Recovery close rate | ≥50%, overdue>7d hot | RECOVERY_TARGETS |
| Fuel cost control | alert >115% model day | insight thresholds + tests |
| Cost per delivered stop | ±10% of rolling 4-week baseline | cost-trend view |

## 5. Roadmap

### P0 — Hardening (DONE)
Redesign · report engine v2 · recovery board · daily rebuild · native-Arabic rewrite · Cairo typography · PWA shell · deploy pipeline. Gates green.

### P1 — Backup integrity *(core done — review contract C)*
Nothing else matters if records die with the browser.
- [x] Audit persisted keys → final inventory: five data keys + `language`; `vega-vehicles`/`vega-zones` were immutable seeds and their persistence was REMOVED (truthful-design option b).
- [x] Strict versioned envelope v2 round-tripping FinancialInput, every DailyRecord field (incl. optionals), scenarios, recovery entries, follow-up actions, language pref. Missing/malformed collection ⇒ whole-file rejection; FinancialInput validated BEFORE sanitize (`{}` rejected); corrupt individual records ⇒ warnings + lossless=false.
- [x] Import preview with explicit **merge / replace / cancel**; deterministic conflicts via normalized-ISO `updatedAt` (numeric compare; newer incoming wins; ties keep local; identical ignored; visible counts). Merge never overwrites model inputs. Parse failure never touches state or localStorage.
- [x] Destructive-Replace guard: any dropped record disables Replace; localStorage write failures are collected and NEVER announced as success (`persistBundle`).
- [x] Legacy v1 import migration + explicit "v1 never stored recovery/actions" warning; Replace disabled for v1.
- [x] Tests: unit (17) + browser/component jsdom suite (7: cancel-changes-nothing, strict-fail-changes-nothing, merge persists keys, replace persists keys incl. language, v1 legacy note, lossy disables Replace, wipe→restore→reload deep equality).
- [ ] In-app backup-age banner after 7 days without export — **BLOCKED until owner accepts the backup-integrity commit**.
- [ ] Arabic WhatsApp paste-parser — same gate.
**Accept:** export→import deep-equality tests; corrupt file rejected without touching current data; v1 migration test; merge-conflict determinism test; malformed-import-cannot-change-state integration proof. ✅ delivered (all tests passing: 130).

### P2 — Compliance-lite data capture (~2 weeks)
1. National Address + Short Address fields w/ `^[A-Za-z]{4}\d{4}$` **format** validator (labelled format-only).
2. Manifest PDF gains cargo-statement-style block (vehicle, plate, driver, stop list) — explicitly non-authoritative pending TGA VERIFY.
3. Invoice-shaped receipt draft: VAT 15% lines, Phase-1-style QR payload; UI copy says "data-ready for e-invoicing", never "compliant".
**Accept:** validator tests; receipts render EN/AR; no regulatory claim strings in locales.

### P3 — Route-lite (~2 weeks)
1. Per-driver stop sequencing: manual drag order default; optional drive-order suggestion behind `NEXT_PUBLIC_OSRM_URL`.
2. **CSP reality:** app ships `connect-src 'self'`. Enabling public OSRM requires explicit CSP addition naming the origin + OSM attribution display + identifying User-Agent policy awareness (public demo ≈1 rps fair-use, no SLA → self-host is the production path). Without env var, feature stays offline-manual.
3. Geocode cache (localStorage) honouring Nominatim 1 rps / attribution / anti-bulk rules if geocoding ships at all.
**Accept:** driver sheet ordered for tomorrow prints <1 min; zero network calls when flag unset.

### P4 — Analytics depth (~2 weeks)
1. COD remittance-lag trend chart.
2. Driver leaderboard (utilisation, miss attribution, recoveries).
3. Fuel control chart w/ >115% alert (already pinned).
4. Weekly digest = **manual export flow** until backend exists (P5); no cron-on-static-hosting fiction.
**Accept:** all charts from recorded data; no server assumptions.

### P5 — Optional sync backend (free tier)
1. Supabase free tier behind `NEXT_PUBLIC_SYNC=supabase`: Postgres mirror, email-link auth, RLS owner-only.
2. Local-first write-through; conflicts last-writer-wins per record via updatedAt; localStorage remains boot source.
3. **Accepted platform limits** (no workarounds): ~500 MB DB, pause after ~1 week inactivity, no PITR. Pause consequence = temporary sync outage; recovery path = local data + P1 backups. Documented, not engineered around.
**Accept:** two devices converge; airplane-mode edits reconcile.

### P6 — Live fleet (when hardware exists)
Traccar self-host adapter implementing the existing telematics seam (`NEXT_PUBLIC_TELEMATICS=traccar`). Position poll → map strip in Daily view; idle-time feeds fuel analysis. Needs a small VPS when activated.

### P7 — Evaluate only
ERPNext Delivery Trip import/export; WhatsApp Cloud API outbound templates (verify per-message pricing first); multi-company partitioning.

## 6. Free-stack decisions (locked unless dossier overturns)

| Need | Choice | Why | Accepted catch |
|---|---|---|---|
| Hosting | GitHub Pages | free, green pipeline | static-only |
| Routing (opt-in) | OSRM self-host path; demo only for dev | OSS; demo has fair-use limits, no SLA | CSP extension needed for any public endpoint |
| Geocoding (if shipped) | Nominatim under OSMF policy | free w/ rules | 1 rps, attribution, anti-bulk, caching duty |
| GPS | Traccar | OSS, broad protocol support | needs VPS when live |
| Backend (opt-in) | Supabase free tier | Postgres+auth+RLS | pauses, no PITR — accepted, documented |
| Fonts/charts/PDF | self-hosted Cairo+IBM Plex, jsPDF vector, exceljs | zero CDN deps (CSP law) | manual Arabic shaping care in PDFs |

**Banned:** paid SaaS per-seat tools without approval · CDN font/script loads · litres-based fuel logic · server-required features while P5 unshipped · silent CSP loosening.

## 7. Risk register

| Risk | L×I | Mitigation | Early signal |
|---|---|---|---|
| localStorage loss | H×H | P1 backups + age banner | days-since-backup counter |
| National Address obligation scope | M×H | capture fields now; legal scope VERIFY | % shipments missing address |
| ZATCA wave notice arrives | L×H | data-shaped invoices ready; integrate then | revenue near VAT threshold |
| OSRM/Nominatim policy drift | M×L | env-flag + offline fallback; policy re-check at deploy | fetch failure streak |
| Supabase pause | M×L | local-first; backups are recovery path | sync outage reports |
| RTL/regression quality | M×L | AGENTS.md laws + locale parity checks | screenshot diffs |

## 8. Definition of Done (every phase)

`tsc ✓ · all tests passing ✓ · lint 0/0 · build ✓ · Pages workflow success ✓ · live-site spot-check ✓ · locale parity EN+AR ✓ · SESSION_MEMORY.md updated · roadmap checkboxes above moved for the shipped work · no unsupported claims introduced`.

---

*All sourced statements trace to `docs/RESEARCH_DOSSIER.md`. Items flagged VERIFY there block related product claims until resolved.*
