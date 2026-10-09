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
