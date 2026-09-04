<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# VEGA Logistics OS — Agent Operating Rules (STRICT, durable)

These rules are durable; session status lives in `SESSION_MEMORY.md`, roadmap in `docs/MASTER_PLAN.md`. Violations = revert and redo.

## START HERE — read order & current position
New sessions read, in order: **this file** → `SESSION_MEMORY.md` (exact state, last cycles, handoff list) → `docs/MASTER_PLAN.md` (release roadmap R0–R8) → `docs/DATA_MODEL.md` (storage shapes). Then run the full gate suite (see "The proven working loop") BEFORE changing anything, and continue from the resume point below.

**Resume point (this block is updated in every shipped commit):**
- HEAD `$(git rev-parse --short HEAD)` — shipped this stretch: repo-hygiene (`f304b7d`), driver identity sync + pre-close reports (`bb9ee52`), R6 operational analytics (425 tests, parity 1272↔1272), nav simplification (`b21ee3a`), then R7 Phase 1 route-lite (offline suggestion + stop address/coordinate capture, OSRM network deferred — all gates green, 457 tests, parity 1298↔1298).
- **Awaiting owner live acceptance:** R2 stop planning · R3 morning dispatch · R4 evening close · R5 compliance-lite · driver/pre-close slice · R6 analytics · R7 Phase 1. They are coded + tested + deployed but NOT marked shipped in MASTER_PLAN until the owner accepts them live.
- **Next release:** R7 Phase 2 (self-hosted OSRM — needs approval + coordinate coverage) per MASTER_PLAN §5-R7, then R8 optional sync.
- Open blockers: none. Known limitations live in SESSION_MEMORY.

## The proven working loop (operationalizes R1)
This exact shape has produced only green deploys since adoption:

1. **Baseline first** — run ALL gates before changing anything; catches drift left by prior sessions.
2. **Explore before design** — read the domain file(s), locale keys and existing tests of the touched area; reuse its vocabulary and patterns. One source of truth per concept; derived data flows outward (e.g. driver identity lives ONLY in the roster catalog; dispatch stamps copies onto stops; close preserves them; reports group by them).
3. **Minimal coherent scope** — types → pure domain → UI wiring → locales (**BOTH trees, same commit**) → tests (**same commit** as any behavior/schema change, incl. previous-format fixtures for persisted shapes).
4. **Programmatic edits** — assert exact boundary CONTENT before slicing/deleting (never trust remembered line numbers; they shift), verify markers after, delete later ranges first when index-based.
5. **Gates, in order:** `npx tsc --noEmit` → `npx vitest run` → `npx eslint .` → `npm run build` → `python3 src/__tests__/run_all_tests.py` → `git diff --check`. All green locally, no exceptions.
6. **Land** — conventional commit subject (`feat|fix|chore(scope): summary`) whose body states what, why, and gate results; then `git push origin main`.
7. **Verify live** — `gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId') --exit-status` reaching `completed success`, then curl https://kemos-labs.github.io/vega-logistics/ (key-level changes: `curl …/locales/<lang>/translation.json`). Not confirmed live = not done (R1).
8. **Docs in the same commit** — MASTER_PLAN checkboxes if a release item moved; SESSION_MEMORY always.

### Hard-won gotchas (do not relearn these)
- CI runs `eslint . --quiet` — warnings never fail CI. Hold LOCAL eslint at literally 0 problems; 22 warnings once accumulated unnoticed.
- Test mock spies: type via vitest generics `vi.fn<(...callArgs: unknown[]) => Result>(() => ({…}))` — keeps spread-forwarding call sites type-safe AND lint-clean (unused rest params fail lint).
- `toMatchObject` distinguishes absent-key vs `undefined` value; assert optional absence with `.toBeUndefined()`.
- UI tests have no global setup: rendering `BusinessModelApp` pulls in `@/lib/i18n` → English strings; rendering components directly relies on `defaultValue` fallbacks. Always `localStorage.clear(); cleanup()` in `beforeEach`.
- Locale parity: flatten both trees and compare key counts (currently 1247↔1247) before every push.
- One CI vitest flake occurred (`9a601bb` run) — unhandled errors never reproduced locally; identical tree passed minutes later. Re-run the workflow before suspecting the tree.

## R1 — Truth gates before every push
All must pass: `npx tsc --noEmit` · `npx vitest run` (all passing) · `npx eslint .` (0 problems) · `npm run build` · `python3 src/__tests__/run_all_tests.py` · `git diff --check`. After push: Pages workflow must reach `completed success`, then curl the live site to confirm the change actually shipped. A feature not verified live is not done.

## R2 — NTFS mount hazard
Repo sits on an NTFS mount; native `.node` binaries corrupt during installs (lightningcss pinned `^1.25.0` on purpose). Pure-JS dependencies only without explicit user approval. Never regenerate `package-lock.json` casually. Bun is never the package manager (CI pins npm).

## R3 — Bilingual parity, native Saudi Arabic
Every user-facing string exists in BOTH locale trees, same commit. Arabic is native operational language — never machine calque. Fuel = SAR cash, never litres. Latin digits (`ar-SA-u-nu-latn`). Fixed provider vocabulary: تحميل · توصيل · راجع · الفوات · إثبات التسليم · العنوان الوطني.

## R4 — Typography & RTL law
Arabic UI renders in Cairo (`--font-cairo`). NEVER letter-spacing on Arabic script (breaks joining). Archivo must not host Arabic containers. RTL contexts neutralize tracking.

## R5 — Patch discipline
Programmatic patches MUST `assert old in src` before replace and verify the new marker after. Silent no-op replaces have shipped broken features before.

## R6 — CSP is law
`connect-src 'self'`; fonts/scripts self-hosted only; no CDN loads. PDFs embed TTFs from `public/fonts/`. Any new runtime external URL needs an env flag + offline fallback.

## R7 — Data durability first
Browser storage is the source of truth until optional sync ships (R8). Every schema change ships with a versioned migration + previous-format test fixtures in the same commit. New persisted keys must join `STORAGE_KEYS` + backup inventory or be documented as disposable device metadata. Breaking user records is the one unrecoverable sin.

## R8 — Claim discipline
Regulatory/operational claims need a source in `docs/RESEARCH_DOSSIER.md` or a VERIFY mark. Prohibited wording without full verification: "production ready" (for server claims), "compliant", "live tracking", "real-time", "AI-powered", "ZATCA compliant", "verified National Address", "legally valid transport document". Allowed: "format appears valid", "draft invoice data", "informed by TGA documentation".

## R9 — Roadmap authority
`docs/MASTER_PLAN.md` defines releases R0–R8 and acceptance criteria. Work happens by release order; jumping requires user approval. Update plan checkboxes + `SESSION_MEMORY.md` in the same commit as shipped work. Track by product release and user outcome — no review-contract loops.

## R10 — Simplicity budget
One owner, 5–50 vehicles. Every feature usable <30s and saving ≥30 min/week, or it gets cut. Manual-first before integrations. Honest data states always: recorded vs planned vs derived vs simulated vs stale vs missing.

## Authoritative environment facts
- Dev URL: http://vega.localhost:8080 (portless alias). `localhost:3002` = unrelated Options Trading Terminal — never cite for VEGA.
- Public: https://kemos-labs.github.io/vega-logistics/
- Storage inventory & privacy classes: `docs/DATA_MODEL.md`.
