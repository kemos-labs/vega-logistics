# VEGA Logistics OS — Master Plan
**Status:** ACTIVE · **Horizon:** 6 months · **Owner:** founder + coding agents
**Companion docs:** `docs/RESEARCH_AGENT_PROMPT.md` (research contract) · `docs/daily-ops-painpoints.md` · `AGENTS.md` (hard rules)

---

## 1. Vision

One screen the owner opens every morning and closes every night. It must
answer, in Arabic or English, in under 30 seconds:

> *What happened yesterday, what broke, who owes me what, what must happen today.*

Everything else — reports, compliance, routing, tracking — serves that sentence.

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
| Compliance (ZATCA / National Address / TGA) | ❌ none |
| Route planning | ❌ none |

## 3. KSA ground truth (sourced)

| Fact | Consequence for VEGA | Source |
|---|---|---|
| Carriers must **reject parcels without a valid National Address from 1 Jan 2026**; Short Address = 4 letters + 4 digits | Add National-Address field + format validation on every shipment/customer record; export manifests including it | splonline.com.sa |
| ZATCA Phase 2 e-invoicing waves since Jan 2023; simplified invoices require **compliant QR** (seller name, VAT no, timestamp, total incl VAT, VAT total); VAT 15% | Invoice/receipt generator with QR payload fields; keep invoice lines ZATCA-shaped so upgrade path is data-only | zatca.gov.sa |
| TGA freight licensing incl. light-freight rules ≤3,500 kg + electronic transport documents | Daily manifest doubles as TGA-style cargo statement export | tga.gov.sa |
| COD ≈ 22–25% of Saudi e-commerce value | COD reconciliation is core, not an edge case; add remittance-lag trend | SAMA 2023 study |
| Benchmarks: first-attempt success median 86–91% (top 95–97%), e-POD median 80%, target ≥98% | Our pinned targets (miss ≤8% good, POD target 98%) sit inside industry reality — keep them | Parcel Perform Q2'25, APQC |
| Ramadan/Hajj/Riyadh-season change demand + truck access windows | Season mode: shifted shift windows + demand multiplier on plan | SPA, Grant Thornton |

## 4. Target KPI board (app must compute all by P4)

| KPI | Formula | Target band |
|---|---|---|
| First-attempt success | delivered ÷ attempts | ≥90% (stretch 95%) |
| Miss rate | missed ÷ attempts | ≤8% warn, ≤3% healthy |
| Cost per delivered stop | (daily allocated cost + fuel SAR + extras) ÷ delivered | tracked vs 4-week baseline ±10% |
| e-POD completeness | days POD=complete ÷ tracked days | ≥98% |
| COD remittance lag | days cash unremitted (trend) | ≤2 working days |
| Recovery close rate | recovered ÷ closed | ≥50%, overdue>7d = hot row |
| Driver utilisation | delivered ÷ present-driver-days | baseline +5%/quarter |

## 5. Roadmap

### P0 — Hardening (DONE)
Redesign · report engine v2 · recovery board · daily rebuild · AR rewrite · Cairo typography · PWA · deploy pipeline. All gates green.

### P1 — Data durability *(next up, ~1 week)*
Nothing else matters if records die with the browser.
1. **One-tap full backup** (JSON download) + restore/import with merge-by-date.
2. **Backup nag**: banner after 7 days without export.
3. **CSV provider import**: paste Arabic WhatsApp text (`يعقوب عبدالقادر سياره 10 لوحه4684 تحميل 25 توصيل18 راجع2`) → parsed preview → confirm into Daily record.
4. Auto-download weekly backup prompt via PWA local notification pattern (no server).
**Accept:** wipe browser → restore → identical totals. Parser handles top-10 phrasings.

### P2 — Compliance lite (~2 weeks)
1. Customer/shipment fields: **National Address + Short Address (AAAA9999 validator)**.
2. Daily manifest PDF gains TGA-style cargo statement block (vehicle, plate, driver ID, stop list).
3. **Simple receipt/invoice generator**: VAT 15% lines, ZATCA Phase-1 QR payload (TLV base64), print/PDF.
**Accept:** short-address regex rejects bad codes; QR scans to correct TLV fields.

### P3 — Route-lite (~2 weeks)
1. Stop sequencing per driver: manual drag order + optional **OSRM public endpoint** (`NEXT_PUBLIC_OSRM_URL`) for drive-order suggestion; graceful offline fallback.
2. Distance estimate per route → fuel-cost sanity check against entered SAR.
3. Geocode cache in localStorage (Nominatim, 1 req/s policy).
**Accept:** a driver sheet ordered for tomorrow prints in <1 min; works offline after first load.

### P4 — Analytics depth (~2 weeks)
1. COD remittance-lag trend chart (replaces single outstanding number).
2. Driver leaderboard (utilisation, miss attribution, recoveries).
3. Fuel cost-per-stop control chart w/ alert >115% model day (already pinned).
4. Weekly digest auto-generated **via GitHub Actions cron**: builds report artifact on schedule, free.
**Accept:** digest lands without any human pressing export.

### P5 — Sync backend (opt-in, free tier)
1. **Supabase free tier** behind `NEXT_PUBLIC_SYNC=supabase`: Postgres mirror of DailyRecord/Recovery/Customer tables, email-link auth, RLS owner-only.
2. Local-first write-through: localStorage stays source of truth; sync is additive; conflicts resolved last-writer-wins per date key.
3. Known limits accepted: 500 MB DB, project pause after 1 wk inactivity → weekly ping via Actions cron.
**Accept:** two devices converge; airplane-mode edits reconcile.

### P6 — Live fleet (when hardware exists)
Traccar self-host adapter implementing existing telematics seam (`NEXT_PUBLIC_TELEMATICS=traccar`): position poll → map strip in Daily view, idle-time insight feeding fuel analysis. No SaaS fees.

### P7 — Scale-out options (evaluate only)
ERPNext Delivery Trip import/export; WhatsApp Cloud API outbound templates (cost trap: verify per-message pricing before committing); multi-company partitioning.

## 6. Free-stack decisions (locked unless research overturns)

| Need | Choice | Why | Catch we accept |
|---|---|---|---|
| Hosting | GitHub Pages | free, already green | static-only |
| Routing | OSRM (+VROOM later) | OSS, self-hostable | public demo endpoint rate-limited |
| Geocoding | Nominatim | free w/ policy | 1 rps, needs caching |
| GPS | Traccar | OSS, 200+ protocols | needs a $4 VPS when live |
| Backend | Supabase free tier | Postgres+auth+RLS | pauses, no PITR |
| Automation | GitHub Actions cron | free on public repo | repo-visible artifacts |
| Fonts/charts/PDF | self-hosted Cairo+IBM Plex, jsPDF vector, exceljs | zero CDN deps (CSP) | manual Arabic shaping in PDF |

**Banned:** paid SaaS per-seat tools, CDN font/script loads (CSP), litres-based fuel logic, server-required features while P5 not shipped.

## 7. Risk register (top 6)

| Risk | L×I | Mitigation | Early signal |
|---|---|---|---|
| localStorage loss (browser reset) | H×H | P1 backups + nag | days-since-backup counter |
| National Address non-compliance 2026 | M×H | P2 fields+validation now | % shipments missing address |
| ZATCA wave notification surprise | M×M | P2 QR-ready invoices | VAT threshold revenue watch |
| OSRM demo instability | M×L | env-flag endpoints + manual fallback | fetch failures logged |
| Supabase pause losing availability | M×M | weekly cron ping + local-first design | sync error streak |
| Arabic RTL regressions | M×L | locale parity test + letter-spacing rule in AGENTS.md | screenshot diffs |

## 8. Definition of Done (every phase)

`tsc ✓ · vitest 100% ✓ · lint 0/0 · build ✓ · Pages deploy ✓ · live-site spot-check ✓ · locales EN+AR parity ✓ · SESSION_MEMORY.md updated · this doc's checkboxes moved`.

---

*Research basis: ZATCA roll-out phases & Phase-2 prep (zatca.gov.sa), TGA licensing pages (tga.gov.sa), SPL National Address 2026 carrier obligation (splonline.com.sa), SAMA Payment Usage Study 2023, Parcel Perform US Q2-2025 benchmark, APQC e-POD measure, OSRM/VROOM/OpenRouteService docs, Traccar docs, Supabase pricing/docs. Full citations in research dossier.*
