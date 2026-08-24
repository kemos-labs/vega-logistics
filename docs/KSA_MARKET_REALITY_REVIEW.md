# KSA Logistics Market Reality — Deep Web Research Review
**Date:** 2026-08-24 · **Method:** live web research (operator blogs, B2B logistics marketplace analysis, consultancy articles) cross-checked against VEGA's shipped features and model defaults. Claim classes per AGENTS.md R8: blog/marketplace numbers are `[VENDOR]`/`[H]` unless independently confirmed — they inform defaults and priorities, never become product claims.

## Sources reviewed (live fetch this cycle)

1. **Flotia — "Last-Mile Delivery in Saudi Arabia"** (flotia.tech, 16 Jul 2026) `[VENDOR]`
2. **Nwafiz B2B logistics marketplace — "Last-Mile Delivery in Saudi Arabia: Challenges and 30% Growth"** (nwafizlogi.com, 9 Jun 2026, Arabic) `[VENDOR]` — operator-facing cost/market breakdown
3. **Trax Group — "Last Mile Delivery Issues Saudi"** (traxgroup.com) `[VENDOR]`
4. Grant Thornton KSA last-mile article — **404 at previously cited URL**; the `[VENDOR]` "last-mile ≈50% of logistics costs / ~40% demand outside major centres" citation in RESEARCH_DOSSIER needs re-sourcing or a dead-link mark.
5. Competitor reachability spot-check (headless Chromium): Traccar demo login-walled; Fleetbase demo subdomain dead; Tookan main domain TLS cert invalid. `[INT observation]`

## A. What KSA operator content says vs VEGA coverage

| Operator pain point (source) | Claim class | VEGA status |
|---|---|---|
| Address inaccuracy — "40% of shipments suffer inaccurate addresses"; fix = mandatory National Address | `[VENDOR]` (nwafiz) | **Covered** — R5 National Address completeness flag + Short Address format check; TGA 2026 mandate already `[PRIMARY]` in dossier |
| Failed delivery doubles cost per drop; windows reduce retries | `[VENDOR]` (flotia) | **Covered** — failed/returned first-class statuses with mandatory failure reason (R2/R4); service windows on stops |
| Returns (راجع) 15–22% of e-commerce shipments; neglected niche with 35–45% margins for specialists | `[VENDOR]` (nwafiz) | **Covered** — راجع is a first-class count + recovery board with aging (R4) |
| Vehicle economics: 6,750–9,150 SAR/month all-in per vehicle; breakeven 18–25 shipments/day @ 10 SAR | `[VENDOR]` (nwafiz) | **Covered by model, defaults drift** — see table B |
| Traffic density cuts drops/driver 25→14 in Riyadh peak | `[VENDOR]` (nwafiz) | **Partial** — model has avgDailyDistance + shipments/day but no per-window density factor; season-mode multiplier is the manual answer (R10: manual-first, OK) |
| Digital POD closes disputes; timestamped proof expected | `[VENDOR]` (flotia) | **Partial** — POD completeness tracked (R2–R4); photo/signature capture deliberately deferred (privacy, R10) |
| Real-time customer tracking now standard expectation | `[VENDOR]` (flotia) | **Rejected by design** pre-R8 (no "live tracking" claims allowed; local-first) |
| Subcontracting windows for big players (Aramex/SMSA) require: 3–15 vehicles, class-3 drivers, GPS, provider app | `[VENDOR]` (nwafiz) | **Out of scope** — VEGA serves the subcontractor's own ops; GPS = Traccar future row |
| COD still material in KSA e-commerce | SAMA 2023 `[PRIMARY]` (25% of last online purchase) | **Covered** — COD outstanding/remit-lag core to R1/R4 |

## B. Model-default drift check (VEGA defaults vs field numbers)

| Parameter | VEGA default | Field figure `[VENDOR]` | Verdict |
|---|---|---|---|
| Driver salary | 2,500 SAR | 3,500–4,500 SAR | **Optimistic** — owner-editable, but default understates cost ~30–45% |
| Vehicle rent/installment | 0 SAR (owned assumed) | 1,800–2,500 SAR | OK if purchase fields used; flag in UI copy? |
| Avg daily distance | 180 km | 250 km | **Low** vs delivery-intensity operation |
| Fuel price | 2.13 SAR/L | — (91-octane plausible) | Plausible; VERIFY against current pump price |
| Shipments/vehicle/day (implied) | 200/day ÷ 4 vehicles = 50 | 14–25 realistic, 18–25 breakeven @10 SAR | **High** — default scenario overstates capacity ~2× |
| Breakeven sanity | model computes | 18–25/day @10 SAR | Model math compatible ✓ |

**Action (proposed, needs approval):** nudge `mockData.ts` defaults toward the field range (salary 3,500; distance 220; per-vehicle 25/day) OR add a one-line "defaults are illustrative — set your real numbers" note. Defaults are the first numbers an owner sees; honest states matter (R10).

## C. Dead-link found in dossier
Grant Thornton article URL 404s. The "last-mile ≈50% of costs" claim is widely repeated but our cited instance is gone — mark `[VENDOR, dead link — re-source]` in RESEARCH_DOSSIER or find the archived/current URL.

## D. Competitive reachability (tools spot-check)
Traccar demo = login wall before any value; Fleetbase demo subdomain = dead DNS; Tookan domain = invalid TLS cert. VEGA loads in ~2.2s, 18 requests, 0 external origins, works offline with 0 console errors, no 375px overflow EN/AR. Differentiator confirmed: **zero-infrastructure, immediately usable, native Arabic.**

## Verdict
VEGA's release priorities match what KSA operator content actually complains about: address accuracy (R5 ✓), failed/returns handling (R2–R4 ✓), COD discipline (R1/R4 ✓), cost-per-stop economics (model ✓). Gaps are honest and mostly deliberate (live tracking, photos). The real fix list from this research is **B: default-value drift** — small, high-trust-value change.
