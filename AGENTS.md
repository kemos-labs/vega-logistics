<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# VEGA Logistics OS — Agent Operating Rules (STRICT, durable)

These rules are durable; session status lives in `SESSION_MEMORY.md`, roadmap in `docs/MASTER_PLAN.md`. Violations = revert and redo.

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
