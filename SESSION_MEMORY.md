# Session Memory — VEGA Logistics OS

> Governance: `AGENTS.md` (strict rules R1–R10) · Roadmap authority: `docs/MASTER_PLAN.md` · Claims discipline: `docs/RESEARCH_DOSSIER.md`

## Authoritative state (2026-08-23)
- Dev :3002 running · Pages deploy green (kemos-labs.github.io/vega-logistics) · tsc clean · vitest 106/106 · ESLint 0/0 · python suite passing
- package-lock.json 334KB committed & CI-healthy — never regenerate casually on NTFS
- BreakEvenAnalytics / @heroui fully removed from repo

## Current phase
**P1 Backup integrity** (MASTER_PLAN §5-P1): versioned v2 backup envelope round-tripping all persisted keys (`vega-financialInput-v2`, `vega-daily-reports-v2`, `vega-scenarios-v1`, `vega-recovery-board-v1`, `vega-followup-actions-v1`, `vega-vehicles`, `vega-zones`, language), import preview w/ merge|replace|cancel, updatedAt conflict rule + visible count, v1 backward compat, corrupt-file safety, in-app 7-day backup banner. Reminder/parser only AFTER backup integrity lands.

## Recently shipped (this session, commits in order)
1933b75 deploy fix → 7bda133 Excel recovery-trend sheet → 0467f98 native-Arabic rewrite (~180 strings, costs.* gaps filled) → 215c4e9 Cairo typography root-fix (Archivo had no AR glyphs; RTL letter-spacing law) → 6beded0 master plan v1 + AGENTS R1–R10 → **remediation commit A** (dossier/plan/governance corrections per review).

## Corrections locked by review (do not regress)
- SAMA COD = 25% of respondents' last e-commerce purchase payment method (survey), NOT value share (PDF p.24 verbatim archived).
- Parcel Perform 99.22% is US-domestic vendor data; the 86–91% medians were withdrawn. FADR ≥90% & e-POD ≥98% are VEGA internal targets; APQC 80.0% median is the only external ePOD benchmark.
- National Address rule cited to TGA news 198 (2026-01-01, verbatim Arabic saved); format-vs-authoritative validation split.
- ZATCA Phase 1 vs Phase 2 strictly separated; no "compliant" UI wording ever.
- No Actions-cron-on-localStorage digest, no scheduled local-notification claims, no Supabase keep-alive workaround.

## Test conventions
fixtures `record(date, completed, failed, extra)` + `fullTotalsShared()`/`fullMetrics()`; FOCUS 2026-08-14; NOW 2026-08-22 (recoveryBoard tests); insight thresholds pinned.

## Gotchas
BusinessModelApp SSRs Summary view only — verify Daily-tab via client chunk grep. Dev-server restart recipe in git history (setsid nohup …). Arabic PDF shaping not yet visually confirmed by owner.

## Next candidates (after P1, in order)
P2 compliance-lite capture → P3 route-lite (CSP-gated) → P4 analytics depth → P5 opt-in sync. VERIFY queue: TGA light-freight reg text; ZATCA guideline page-level quotes; five-field QR enumeration.
