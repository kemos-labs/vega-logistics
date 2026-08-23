<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:session-memory -->
# Session Memory — Auto-Load on Every Agent Start

Read `SESSION_MEMORY.md` for full history, then `docs/MASTER_PLAN.md` (roadmap authority) and `docs/RESEARCH_DOSSIER.md` (claim discipline).

## Authoritative running state (verified 2026-08-23, review contract C)
- **Dev URL (authoritative)**: http://vega.localhost:8080 via the portless alias. `localhost:3002` is the unrelated Options Trading Terminal project — never cite it for VEGA.
- **Public**: https://kemos-labs.github.io/vega-logistics/ — deploy workflow green
- **TypeScript**: clean · **Tests**: all passing (187: includes 45 backup + 25 provider-parser) · **ESLint**: 0 errors, 0 warnings ("all tests passing" replaces unmeasured "100%" claims; no coverage tool is configured)
- **package-lock.json**: 334KB, committed, `npm ci` green in CI — do NOT regenerate casually on this NTFS mount
- **Archived**: BreakEvenAnalytics and @heroui are fully removed from the repo — do not reference them
- **Persisted user-state keys** (backup scope, single source of truth = `src/lib/backup.ts` STORAGE_KEYS): vega-financialInput-v2 · vega-daily-reports-v2 · vega-scenarios-v1 · vega-recovery-board-v1 · vega-followup-actions-v1 · language. `vega-vehicles`/`vega-zones` persistence REMOVED (immutable seeds, review C3-b).
- **Review status**: P1 backup core ACCEPTED (post-F). Commit G delivered backup-age banner + v1-duplicate edge fix. Commit H delivered the Arabic WhatsApp parser (pure engine + review/confirm UI). P1 is now feature-complete pending live verification.

## Quick commands
```bash
npm run dev          # start dev server — open it via the portless alias http://vega.localhost:8080
npm run build        # production build
npx tsc --noEmit     # TS check
npx vitest run       # unit tests
npm run lint         # ESLint
```
<!-- END:session-memory -->

# VEGA Logistics OS — Agent Operating Rules (STRICT)

These rules override any default habits. Violations = failed work, revert and redo.

## R1 — Truth gates before every commit
Run ALL, all must pass: `npx tsc --noEmit` · `npx vitest run` (100%) · `npm run lint` (0 errors) · `npm run build`. Then push, wait for the Pages workflow (`completed success`), and **curl the live site** to verify the change actually shipped. A feature that isn't verified live is not done — this exact failure burned us once for 24h.

## R2 — NTFS mount hazard
This repo sits on an NTFS mount. Native `.node` binaries corrupt during installs. NEVER add/upgrade packages with native builds (lightningcss is pinned `^1.25.0` on purpose). Pure-JS deps only unless the user approves explicitly. After ANY install, verify binary sizes (swc ≈130MB, oxide ≈2.98MB).

## R3 — Bilingual parity, native Arabic
Every user-facing string lives in BOTH `public/locales/en/translation.json` AND `ar/translation.json`, same commit, same keys. Arabic must be **native Saudi business Arabic** — never machine-calque English structures (no نافذة/محوري-style literalism). Fuel = SAR cash only, never litres. Digits Latin (`ar-SA-u-nu-latn`). Provider terms are fixed vocabulary: تحميل · توصيل · راجع · الفوات · إثبات التسليم · العنوان الوطني.

## R4 — Typography & RTL law
Arabic UI renders in Cairo (`--font-cairo`). Never apply letter-spacing to Arabic text — tracking breaks letter joining; RTL contexts neutralize it. Never reintroduce a bare `font-family:'Archivo'` on containers that host Arabic.

## R5 — Patch discipline
Python/regex patches MUST assert: `assert old in src` before replace and assert the new marker exists after. Silent no-op replaces have shipped missing features before — never trust `.replace()` unchecked.

## R6 — CSP is law
`connect-src 'self'`; fonts/scripts self-hosted only. No CDN loads. PDFs embed TTFs from `public/fonts/`. Any new external dependency on a runtime URL needs an env-flag + offline fallback.

## R7 — Data durability first
localStorage is the source of truth until P5 sync ships. Every schema change ships with a migration function in the same commit (`migrateDailyRecords()` pattern) + test fixture coverage. Breaking users' records is the one unrecoverable sin.

## R8 — Scope of truth for claims
Operational/regulatory claims (ZATCA/TGA/National Address/benchmarks) must carry a source or be marked VERIFY in docs. Vendor claims flagged `[vendor]`.

## R9 — Roadmap authority
`docs/MASTER_PLAN.md` defines phase order and Definition-of-Done. Agents pick work from the current phase; jumping phases requires user approval. Update plan checkboxes + `SESSION_MEMORY.md` (pass-N entry) in the same commit as the work.

## R10 — Simplicity budget
The owner is one person. Every feature must be usable in <30s and save ≥30 min/week. If it needs training, cut it. Free/self-hostable tooling only (see plan §6); paid anything requires explicit approval.
