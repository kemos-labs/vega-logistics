# Session Memory — VEGA Logistics OS

> Governance: `AGENTS.md` (durable rules) · Roadmap: `docs/MASTER_PLAN.md` · Claims: `docs/RESEARCH_DOSSIER.md` · Truth audit: `docs/PRODUCT_TRUTH_AUDIT.md`

## Current state
- **Commit:** `6d66bf1` + governance/truth-audit docs commit (this cycle) · **Deploy:** https://kemos-labs.github.io/vega-logistics/ green
- **Tests:** 187 passing (21 files) at last code commit · tsc clean · eslint 0 · build ✓ · python suite ✓
- Dev URL: http://vega.localhost:8080 (`localhost:3002` = unrelated project)

## Completed releases
- **P0** — model, reports, recovery board, Arabic UI, PWA (prior cycles)
- **P1 backup integrity** — core ACCEPTED (contracts C–F); banner `da133b8`; parser `6d66bf1`
- **R0 Foundation** — P1 batch-close + truth reset + research pass + plan rewrite (this cycle; see below)

## R0 contents (this cycle)
- New docs: PRODUCT_TRUTH_AUDIT, KPI_DICTIONARY, KSA_COMPLIANCE_MATRIX, OPERATOR_WORKFLOW, COMPETITOR_AND_TOOLS_MATRIX, DATA_MODEL; MASTER_PLAN rewritten to releases R1–R8; visual SVG regenerated + render-verified.
- Research upgrades: VAT 15% VERIFY→PRIMARY (VAT Law Art.2 Arabic verbatim); GASTAT W&L 2024 added (>180M parcels, 288.1M app orders, 96% on-time) [OFFICIAL STATS]; PDPL obligations + 72h breach notice + transfer regulation added [PRIMARY].
- Code batch (same cycle): parser stale-preview clear, blank-date block, any-existing-record overwrite ack, greeting/chatter name filtering, conflicting-duplicate-term warnings, localized warnings EN/AR, reminder local-day dismissal baseline + dead-code removal, model-inputs-in-reminder-eligibility.

## Next release
**R1 Daily Control Tower** per MASTER_PLAN §5. Then R2 stop planning.

## Blockers / VERIFY queue
- TGA light-freight reg 4786 text extraction (JS-rendered portal) → gates manifest wording
- ZATCA Phase-2 mechanism page-level quotes → gates nothing shipped today
- NOT RESEARCHED register in dossier (driver-hours, ORS, n8n/GH pricing, WhatsApp API pricing, Hijri sources, W5 extended fields)
- No real operator interview yet — OPERATOR_WORKFLOW.md carries the guide; all workflows [H]

## Storage inventory
See `docs/DATA_MODEL.md` §1 (authoritative). Device metadata keys stay OUT of backups.

## Gotchas (durable)
jsdom: `IS_REACT_ACT_ENVIRONMENT=false` + `findBy*` for parse continuations; RTL tests need act-env disabled. BusinessModelApp SSRs Summary only. TGA/SPA sites JS-rendered — curl og:description for verbatim. SAMA PDF via curl w/ referer. SVG render check via cairosvg needs IBM Plex Sans Arabic/Noto Naskh fallback named explicitly or Arabic shows tofu locally (browsers fine).
