# LogesTechs integration — current boundary

**Status:** demo/research adapter and guarded server seams; no verified live tenant integration. **Reviewed:** 2026-10-09.

The public GitHub Pages app is static and excludes `/api` routes. Local VEGA is `http://vega.localhost:8080`; port 3002 belongs to another product. Operator data remains browser-local. Prior demo instructions, vendor contacts, guessed endpoint paths and claims that there were no public developer docs are superseded and preserved only in `/data/Nemow Logistics/vega-logistics/docs/archive/LOGESTECHS_INTEGRATION_2026-09-10.md`.

## Source and schema authority

The dated boundary records [LogesTechs documentation](https://docs.logestechs.com/) and a [Postman collection](https://www.postman.com/winter-shuttle-965185/logestechs-apis/collection/4tu0gxu/logestechs-apis?sideView=agentMode). These are research references, not proof of credentials, tenant access or matching installed schemas. Follow `/data/Nemow Logistics/vega-logistics/docs/LOGESTECHS_INTEGRATION_BOUNDARY.md`. The adapter's configurable defaults are guesses; do not activate live mode against them without a captured authorized request/response contract.

## Implemented server safeguards

Sync GET/POST, status GET and webhook-feed GET guard before cached reads/provider calls. A production build/runtime or live configuration requires a validated server-issued session, `operations.read` and explicit server-only `VEGA_LOGESTECHS_TENANT_ID`. This maps a VEGA tenant to the single configured provider account; it is distinct from the provider branch/header `LOGESTECHS_TENANT_ID`. Unauthenticated=401, forbidden/mismatched=403, missing mapping=503. Responses use `no-store`; provider failures are sanitized. Cache/event scopes preserve the acquisition binding.

Webhook ingestion uses its separately configured HMAC signature, not a user session. Missing secrets or tenant binding reject production/live ingestion. Malformed event shapes reject before buffering. The in-memory ring is neither durable ingestion nor replay protection; signed events do not automatically change operational records. Explicit simulation cannot disable provider privacy in a production build. Session verification is a custom seam, not a login issuer or Supabase identity bridge. Details: `/data/Nemow Logistics/vega-logistics/docs/API_CONTRACTS.md`.

## Next integration gate

Obtain an authorized staging source, verify identity and account scope, then validate exact authentication, schemas, pagination, timestamps, statuses, rate limits, signing/replay rules and transfer/retention basis. Start with a harmless read and sanitized evidence. Preview/reconcile imported records before confirming. Failed/partial pulls must preserve existing local data. Creation, cancellation, returns, assignments and external sending need their separate action contracts and authorization.

Code tests and static deployment do not prove live provider integration. Live credentials, endpoint compatibility, production login, durable event handling and data-policy acceptance remain open.
