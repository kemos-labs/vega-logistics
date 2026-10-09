# Backend upgrade phase — 2026-10-09

## Decision and source evidence

The owner requested review of the original maintenance backend and continuation of the upgrade. The source at `/data/Nemow Logistics/work/maintenance-integration-2026-10-09/source` uses browser-to-Supabase maintenance CRUD, Supabase Auth, invoice/inspection Storage and two unrelated restaurant API routes. The evidence-backed source audit is `/data/Nemow Logistics/work/backend-phase-2026-10-09/SOURCE_BACKEND_AUDIT.md`.

No checked-in SQL schema, RLS/Storage policy definitions or server auth guard was found in that checkout. This does not prove the hosted database is insecure; its configuration remains unknown. The source login checks active-account status in the browser, invoice/inspection uploads construct public URLs, and one restaurant endpoint reads with server service-role privileges without a visible caller guard. Those patterns are not copied into VEGA.

## This implementation slice

Repair VEGA's existing backend seams before connecting any live database:

- Preserve the complete daily-record payload, including cash evidence, close state, attribution and operational identities. Historical relational rows remain readable without inventing missing cash evidence; malformed new payloads fail closed.
- Surface failed local persistence and corrupted reads instead of treating failed writes as successful or overwriting unreadable data.
- Require the documented explicit `NEXT_PUBLIC_SYNC=supabase` flag as well as public connection variables. Configuration alone must not switch persistence.
- Add owner-scoped maintenance-state persistence for the complete v2 vehicle/service/incident envelope with strict validation and an additive SQL migration.
- Harden signed session parsing and identity/expiry validation. This verifies server-issued tokens; it does not implement login, issue tokens or authenticate a production tenant by itself.

These are library adapters and checked-in migrations. Existing operator screens retain browser-local state. No source records, credentials, HR documents, invoices or tracking feeds are transferred. No external database migration is executed. GitHub Pages deployment remains static and excludes server routes; shipping the code there does not deploy a backend.

## Next integration increments

1. Obtain an authorized schema/export and identity mapping for the original maintenance data. Build a preview/reconciliation importer, preserving source identifiers, timestamps and unknown costs. Resolve vehicle identity before confirming imports.
2. Supply the intended VEGA database project and verify its region/transfer decision against `/data/Nemow Logistics/vega-logistics/docs/KSA_COMPLIANCE_MATRIX.md`. Confirm schema and ownership policies using separate non-admin identities. Apply migrations to a disposable staging database before the live project.
3. Complete R8 authentication, local-first outbox, conflict preview, deletion/tombstones and recovery. A whole-envelope maintenance save is not conflict-safe multi-device synchronization; no automatic overwrite/retry is enabled by this slice.
4. Connect private evidence storage with authorized short-lived access, file validation, retention and orphan cleanup. Do not migrate the original public-link behavior by assumption.
5. Validate source exports and real operator workflows, then extend employee identity/availability before protected HR/payroll modules. Telemetry and restaurant activity require authorized source contracts and freshness coverage.

## Acceptance boundary

Local unit tests verify adapters, owner query filters, migration compatibility and error handling. SQL source review is not a running PostgreSQL/RLS test. Without staging identities/project configuration, live authentication, storage policies, database isolation and cloud roundtrips remain unverified. Broader owner acceptance and R8 completion remain open.

## Verification receipt

All six local release gates passed: TypeScript, 596 Vitest tests across 54 files, ESLint with zero problems, production build, Python suite and whitespace check. Five maintenance-adapter tests also passed after a test-description correction. Logs: `/data/Nemow Logistics/work/backend-phase-2026-10-09/final-gates.log`. Luna performed source audit and final read-only review; Sol 6.1 implemented the bounded adapter changes. These native model runs are not claimed as verified-free routes. Live PostgreSQL/RLS tests were not run.

Optional configuration names are `NEXT_PUBLIC_SYNC`, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; keys must belong to the reviewed target project, never the cloned application's fallback. Server session configuration is `VEGA_RUNTIME_MODE` and server-only `VEGA_SESSION_SECRET`. Configuration does not provide an identity issuer or complete R8 synchronization.
