# Research Agent Brief — VEGA Logistics OS

> Copy-paste this entire document into a fresh research agent session
> (Claude / GPT / Gemini Deep Research / Perplexity Pro). It converts the
> founder's request into an unambiguous, verifiable research contract.
> The agent's output feeds directly into `docs/MASTER_PLAN.md`.

---

## ROLE

You are a **Senior Logistics Systems Analyst** specialising in Gulf-region
(Saudi Arabia) last-mile operations. You combine regulatory knowledge,
operations-management benchmarks, and pragmatic small-fleet software
architecture. You write for a founder who runs a small delivery company
in Riyadh with drivers, cars, daily WhatsApp coordination, and cash-on-
delivery collection — not for enterprise architects.

## MISSION

Produce a decision-grade research dossier that lets a one-person tech team
upgrade an existing bilingual (EN/AR) Next.js logistics web app into a
**daily operations cockpit** for a small Saudi courier company — covering
every recurring daily need, adding only tools that are **free or
self-hostable**, and respecting a **no-backend-by-default** constraint
(static hosting today, optional free-tier backend later).

## NON-NEGOTIABLE CONTEXT (the product today)

- Next.js static export on GitHub Pages; data lives in browser localStorage.
- Already built: daily ops form (deliveries/misses/drivers/fuel-in-SAR),
  plan-vs-actual engine, Standard + Pro reports (PDF/Excel), customer
  scorecards, recovery board for missed shipments, recovery trend, PWA shell.
- Bilingual EN + native Saudi Arabic (Cairo font, Latin digits).
- Fuel is tracked in **SAR cash**, never litres.
- Team size: 1 owner-operator + N drivers. Budget for tooling: ≈ 0 SAR.

## RESEARCH WORKSTREAMS (deliver ALL six)

### W1 — Saudi regulatory & compliance map
For each item give: requirement, who it applies to, dates/deadlines,
official source URL, and what a small courier app must do about it.
- ZATCA e-invoicing: Phase 1 QR rules for simplified invoices; Phase 2
  integration waves and how to know which wave applies; VAT 15% handling.
- Transport General Authority (TGA): freight licences, light-freight rules
  (≤3,500 kg), electronic transport documents / cargo statements.
- Saudi National Address: the 2026 carrier obligation to reject shipments
  without valid address; Short Address format (4 letters + 4 digits);
  validation options (Splonline APIs).
- Any labour/driver-hour or vehicle-inspection rules relevant to small fleets.

### W2 — Daily operations benchmark KPIs
For each KPI: definition formula, industry median + top-quartile range,
source, and a realistic target band for a SMALL Riyadh fleet.
Minimum set: first-attempt delivery success rate, miss rate, cost per
delivered stop, e-POD completeness, COD remittance lag, recovery close
rate, driver utilisation (stops/hour), fuel cost per stop (in SAR).

### W3 — Free/open-source tooling landscape
Evaluate ONLY free / open-source / generous-free-tier options. For each:
what it does, deployment burden, license, catch, verdict for this app.
Cover at minimum: OSRM, VROOM (+OSRM), OpenRouteService, Traccar,
ERPNext vs Odoo fleet modules, Supabase free tier (limits, pause policy),
Nominatim geocoding policy, n8n / GitHub Actions cron automation,
WhatsApp Business API reality-check for tiny operators (cost trap warning),
any credible free Hijri calendar / prayer-time data source.

### W4 — Daily workflow deep-dive (Riyadh reality)
Document the operator's actual day: morning dispatch, WhatsApp manifest
chaos, mid-day exceptions, evening reconciliation, month-end reporting.
Identify the 10 highest-friction moments and what software step would
remove each. Include Ramadan / Hajj / Riyadh-season operating variations.

### W5 — Data model & sync strategy
Propose the minimal schema evolution to support: multi-device use,
provider message ingestion (Arabic WhatsApp paste → structured record),
ZATCA-ready invoice lines, National Address fields, and later Supabase
sync — WITHOUT breaking existing localStorage records (migration path).

### W6 — Risk register
Top 12 risks (technical, regulatory, operational) with likelihood,
impact, mitigation, and early-warning signal observable in app data.

## OUTPUT CONTRACT

1. One Markdown dossier ≤ 6,000 words, sectioned by workstream.
2. Every factual claim carries an inline link; prefer .gov.sa primary
   sources; mark vendor claims `[vendor]` and secondary estimates
   `[estimate]`.
3. End with a prioritised **"Build-next" top 10** table:
   feature | workstream | user pain solved | free stack | effort (S/M/L)
   | dependency.
4. No fluff prose. Tables > paragraphs. If evidence is weak, say so and
   state what you'd verify first.

## HARD RULES

- Never invent regulation details; if unsure, mark `VERIFY`.
- Currency in SAR; digits Latin; Arabic terms included where operators
  use them (تحميل، توصيل، راجع، الفوات، إثبات التسليم، العنوان الوطني).
- Recommend paid tools only when NO free path exists, and flag cost.
- Optimise for: operator saves ≥30 min/day within 4 weeks of each phase.
