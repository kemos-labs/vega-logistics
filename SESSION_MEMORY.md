# Session Memory — VEGA Logistics OS

> Governance: `AGENTS.md` (strict rules R1–R10) · Roadmap authority: `docs/MASTER_PLAN.md` · Claims discipline: `docs/RESEARCH_DOSSIER.md`

## Authoritative state (2026-08-23, post review-contract C)
- Dev = http://vega.localhost:8080 (portless alias; localhost:3002 belongs to the Options Terminal project — never cite it here) · Pages deploy green · tsc clean · all tests passing (151: 106 prior + 45 backup) · ESLint 0/0
- package-lock.json 334KB committed & CI-healthy — never regenerate casually on NTFS
- BreakEvenAnalytics / @heroui fully removed from repo

## Current phase
**P1 backup core DONE through review contracts C→E plus stabilization F; **Backup core ACCEPTED; banner COMPLETE (Commit G); parser = Commit H.**
G additions: v1 duplicate-id dedupe now precedes contentLoss (duplicates warn + lossy + block scoped restore); reminder engine `src/lib/backupReminder.ts` (pure, clock-injected): key `vega-last-backup-at-v1` stores RAW ISO device metadata OUTSIDE backup files; visible reasons never/invalid/stale(>=7d); future stamps and empty models stay silent; dismissal scoped to calendar day via `vega-backup-banner-dismissed:<date>`; download handler marks stamp via lifted onBackedUp callback; BackupBanner presentational component (role=status aria-live, RTL-safe, keyboard buttons).**
F additions: validateRecoveryEntries() preserves/normalizes updatedAt+resolvedAt on every read path (E2E test proves timestamp survives write→read→export→parse→merge with newer-wins); ParsedBackup now separates legacyScopeMissing (expected for v1) from contentLoss (real corruption gates scoped restore); complete lossless-aware field validation (non-string notes/tomorrowNote/driverName/carNumber/plateNumber, non-object breakdown children, invalid reasonKey/customer/note/owner types, non-boolean done, fractional/negative ids); commitBundle aborts before ANY write when snapshot getItem fails.
E additions: language flows from real handler into exports and stores RAW en/ar (never JSON-stringified, matches ClientLayout/i18n.ts); v1 files get a scoped 'Restore legacy scope' action (adopts model/days/scenarios; NEVER replaces recovery/actions/language); every material sanitization drop/invalid timestamp/impossible date/bad enum/duplicate warns and flips lossless=false; commitBundle is transactional (snapshot→attempt-all→rollback-on-failure, rollback-failure = distinct critical message; preview stays open on failure).
Backup scope (final): `vega-financialInput-v2` · `vega-daily-reports-v2` · `vega-scenarios-v1` · `vega-recovery-board-v1` · `vega-followup-actions-v1` · `language`. `vega-vehicles`/`vega-zones` persistence removed (immutable seed catalogs — read-only consumers; truthful-design option b).
Engine facts: strict v2 containers (missing/malformed collection ⇒ whole-file reject); FinancialInput structurally validated BEFORE sanitize (`{}` rejected); per-record drops ⇒ warnings + Replace disabled (lossless flag); RecoveryEntry & FollowUpAction carry normalized-ISO `updatedAt`; numeric timestamp comparison; identical rows ignored (not conflicts); incoming duplicate ids → LAST wins + warning; merge never overwrites model inputs (one visible conflict when differing); persistBundle collects write failures — success never announced on partial failure.
D delivered (4bcea9f). E delivered this pass. Outstanding VERIFY register lives at the end of docs/RESEARCH_DOSSIER.md incl. explicit NOT RESEARCHED items.

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
