# VEGA OS API contracts

These endpoints are the first BFF boundary for the frontend rebuild. They are simulation-only until identity, tenant isolation and persistence are implemented.

## `GET /api/health`

Returns service health and explicitly reports unconfigured production dependencies:

```json
{
  "status": "ok",
  "service": "vega-logistics-os",
  "dataMode": "simulation",
  "checks": {
    "application": "ok",
    "persistence": "not_configured",
    "authentication": "not_configured",
    "realtime": "not_configured"
  }
}
```

This endpoint must not be interpreted as a production readiness check.

## `GET /api/v1/operations/snapshot?seed=42`

Returns a deterministic demo read model:

```json
{
  "dataMode": "simulation",
  "freshness": {
    "mode": "simulation",
    "source": "deterministic mock generator",
    "asOf": "..."
  },
  "snapshot": {},
  "kpis": {}
}
```

`seed` is optional and must be an integer from `0` to `999999`. Invalid values return `400 invalid_seed`.

## Authorization policy groundwork

`src/lib/platform/authorization.ts` defines the shared permission vocabulary and role matrix. It is deliberately not authentication. API handlers must call it only after obtaining a server-validated session and must add resource-level checks for driver-owned jobs, depots and customer records.

## Production replacement requirements

Before this route can serve real operations data:

- Require a server-validated session.
- Derive `tenantId` from the session; never accept it from the browser.
- Enforce role/action permissions at the handler and service layer.
- Read from tenant-scoped persistence/read models.
- Return source timestamps and telemetry freshness.
- Add request/correlation IDs and audit events.
- Apply pagination, field selection and rate limits.
- Keep raw provider references out of unauthorized responses.
- Add contract tests for tenant isolation and stale-data behavior.

## Backend continuation boundaries — 2026-10-09

The maintenance backend increment is a library adapter and SQL migration, not a newly exposed public API. Owner identity is supplied by authenticated application wiring and enforced by database RLS; no multi-company sharing contract is implemented. Existing server-issued session verification is hardened without introducing a login/token issuer. GitHub Pages still excludes server routes. Activation and live verification follow `/data/Nemow Logistics/vega-logistics/docs/BACKEND_UPGRADE_PHASE.md`.

Custom `x-vega-session` tokens use `{userId, tenantId, role, exp}` where `exp` is an integer UTC epoch in **milliseconds**, not JWT seconds. Exactly two canonical base64url components and typed claims are required. `NODE_ENV=production` requires session checks by default; only explicitly selected `VEGA_RUNTIME_MODE=simulation` bypasses this for simulation handlers. Browser Supabase ownership and server sessions remain separate seams; there is no role/tenant identity bridge or login issuer in this increment.

## Provider access hardening — 2026-10-09

`/api/logestechs/sync` GET/POST, `/api/logestechs/status` GET and `/api/logestechs/webhook` GET check the caller before reading cached data or invoking the provider. Production builds/runtime or configured live mode require a validated server session, `operations.read`, and explicit server-only `VEGA_LOGESTECHS_TENANT_ID`. Missing session returns 401, missing tenant mapping returns 503, mismatched tenant/denied permission returns 403. The mapping identifies the VEGA tenant allowed to access the single configured provider account; it is independent of the provider branch header `LOGESTECHS_TENANT_ID`. Do not infer equality.

Provider cache/event entries carry their acquisition binding; rebinding cannot expose old entries. Replies use `Cache-Control: no-store`; upstream failures are sanitized. Webhook POST retains HMAC ingestion, rejects missing secrets in live/production even with explicit simulation, and rejects malformed event shapes before buffering. The in-memory event ring is not durable or replay-safe ingestion, and no operational state is automatically changed. Explicit simulation cannot disable provider privacy in a production build.

No provider credentials, endpoint contract, live network calls or runtime ownership have been verified by this implementation. An external trusted session issuer is still required for guarded routes. Static GitHub Pages omits these routes entirely.

Signed webhook ingestion also requires the explicit VEGA tenant binding in live/production mode: an unset or blank mapping returns 503 before buffering an event. The webhook sender uses its HMAC signature rather than a VEGA user session.
