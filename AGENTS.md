<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:session-memory -->
# Session Memory — Auto-Load on Every Agent Start

Read `SESSION_MEMORY.md` first for full project context, then follow this prioritized plan.

## Running State
- **Dev Server**: `http://localhost:3002` — running
- **Build**: ✅ passing (TS clean, exit 0)
- **Python Tests**: ✅ 25/25
- **ESLint**: ✅ 0 errors, 204 warnings

## Current Priority Stack

### 🔴 HIGH — Do First
1. **Reconcile lightningcss pin** — `devDependencies`/`optionalDependencies` both `^1.25.0` (v1.32.0 binaries corrupt on NTFS); `package-lock.json` is stale (45KB) — regenerate after install
2. **Wire-in or remove `BreakEvenAnalytics`** — orphaned (no importers) but imports `@heroui/react`; needs `@import "@heroui/styles"` in `globals.css` (now present) to render styled
3. **Browser verify** — check all 30+ modules load correctly

### 🟡 MEDIUM — Next
4. **ESLint automated cleanup** — run `npm run lint -- --fix`
5. **next.config.ts optimizations** — add image domains, webpack config
6. **Evaluate MCP / AI agent integration** — check if useful

### 🔵 FUTURE — Planned
7. **AAA+ upgrades**: Control Tower, Real-time tracking, Carbon, Predictive Maintenance
8. **PWA support** for mobile field operations
9. **Real backend** per LOGISTICS_OS_SPEC.md
10. **NTFS migration warning** — after `npm install`, verify `.node` binary sizes

## Quick Commands
```bash
npm run dev          # Start dev (use port 3002)
npm run build        # Production build
npx tsc --noEmit     # TypeScript check
npm run lint         # ESLint
python3 src/__tests__/run_all_tests.py  # Python tests
```
<!-- END:session-memory -->
