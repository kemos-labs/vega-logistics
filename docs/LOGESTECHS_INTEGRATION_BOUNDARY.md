# Logestechs Integration Boundary

**Review date:** 2026-09-15  
**Mode:** research and boundary definition; no tenant data was changed

## Official references

- [Logestechs API documentation](https://docs.logestechs.com/)
- [Logestechs APIs Postman collection](https://www.postman.com/winter-shuttle-965185/logestechs-apis/collection/4tu0gxu/logestechs-apis?sideView=agentMode)

The public documentation site exposes an API base displayed as `https://apisv5.logestechs.com/api` and pages for shipment creation, cancellation, return, AWB generation, package statuses, cities/regions, schedules, geofence data, and a package-status webhook. This identifies the public surface; it does **not** prove that this installation has a tenant token, permission, stable response contract, or authorization to call it.

## Safe integration order

1. **Offline first:** paste/import a user-owned export into VEGA and route locally.
2. **Read-only discovery:** after the owner supplies an authorized sandbox or token, verify one harmless status lookup and capture the exact request/response shape without storing secrets.
3. **Read-only daily pull:** map shipment identifiers, recipient/address fields, status, and driver fields into the StopRecord import contract. Reconcile counts before confirmation.
4. **Optional webhook intake:** only after signature/authentication, replay protection, and status mapping are documented and tested.
5. **Write operations last:** create/cancel/return/AWB actions require a separate explicit approval, dry-run preview, idempotency strategy, audit log, and rollback/compensation plan.

## Unverified items that must remain blocked

- authentication header and token lifecycle;
- tenant/account scoping and rate limits;
- exact request and response schemas for the pages above;
- pagination, timezone semantics, status vocabulary, and webhook signing;
- whether route/driver assignment fields are available and writable;
- data residency, retention, and PDPL transfer basis for any cloud sync.

No agent may fill these gaps from memory or from a model response. The source page, a sanitized captured response, or an owner-confirmed contract is required.

## Mapping rule

Logestechs remains the external operational source when a verified sync is enabled; VEGA remains the local planning and review surface. Imported identifiers must remain traceable to the source row. A failed or partial pull must never replace the last good local data or silently create zero/blank distances.

