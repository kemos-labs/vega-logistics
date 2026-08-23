# Competitor & Tools Matrix
**Date:** 2026-08-23 · **Method:** documentation-level study (no paid accounts); workflow patterns extracted, not feature lists. Sources classified per dossier rules. Purpose: choose proven interaction patterns VEGA can adopt **simpler** — never to clone.

## A. Workflow pattern matrix

| Capability | Fleetbase (OSS) | ERPNext / Odoo fleet+delivery | Traccar | Paid dispatch SaaS (Tookan/Onfleet/Bringg class) `[VENDOR]` | VEGA stance |
|---|---|---|---|---|---|
| Dispatch model | Order→driver assignment, live map-centric | Delivery Trip documents; ERP-form heavy | None (tracking only) | Auto-assign + route optimization engines | Manual-first board; optimization optional later |
| Stop lifecycle | status pipeline w/ proof events | delivery-status doc states | — | granular event stream | Minimal explicit states: planned→done/failed(returned)/pending; failure reason required |
| Driver assignment | teams/drivers entities | employee + vehicle records | driver field only | drag/kanban | Simple per-day assignment; workload counts |
| POD | photo/signature uploads | attachment-based | — | native apps, barcode scans | POD completeness first (R2–R4); photos deferred (privacy) |
| COD | payment-on-delivery flags | accounting journal integration | — | cash reconciliation dashboards | Expected/collected/remitted invariant at close (R4) |
| Returns/RTO | exception workflows | return docs | — | RTO flows in parcel products | راجع is a first-class count; recovery entries from failures |
| Customer comms | notifications modules | email templates | alerts | automated SMS/WA notifications | Out of scope until WhatsApp Business pricing researched |
| Route planning | OSRM integration built-in | basic sequencing | — | optimization core selling point | R7: manual order always; env-gated OSRM suggestion; no "optimization" claims |
| Maintenance | vehicle service logs | asset maintenance module | maintenance flags | — | Future evaluation; document-expiry reminders only where justified (R5) |
| Reporting | standard dashboards | strong general reports | rich telemetry reports | executive dashboards | Owner-first daily view (R1), then scorecards (R6) |
| Arabic/RTL | partial translations | translation frameworks vary | UI translations exist | varies, rarely native | **Native Saudi Arabic by construction** — differentiator, not checkbox |
| Offline use | requires server | server-required | mobile app offline modes | cloud-required | Local-first PWA — works with zero infrastructure |
| Integration model | API-first platform | REST/RPC everywhere | APIs | closed + webhooks | File import/export now; sync adapter later |
| Price/licence | free OSS (Apache-2.0) but self-host ops burden | OSS editions + hosting burden | Apache-2.0 self-host | per-driver/month fees `[VENDOR]` | Zero-cost stack locked unless dossier overturns |

**Patterns adopted:** explicit stop-state vocabulary with mandatory failure reasons (industry-standard pipelines); recovery/exception aging boards (Fleetbase-style exceptions); close-of-day reconciliation discipline (courier back-office practice); print manifest as the dispatcher's artifact of record.

**Patterns rejected for now:** live-map operations theatre; auto-assignment algorithms before data quality exists; per-seat SaaS economics.

## B. Free/open-source tooling register

| Tool | Role | License | Real cost/catch | Data-residency | Verdict |
|---|---|---|---|---|---|
| localStorage (current) | persistence | n/a | ~5MB, single device, clearable | on-device ✓ | Keep until volume demands more |
| IndexedDB/Dexie | future local store | MIT/Apache | migration work; quota varies | on-device ✓ | Adopt when stop-level history grows (R2 decision point) |
| Workbox/SW patterns | offline shell | MIT | hand-rolled SW already adequate | n/a | Keep current minimal SW |
| Supabase free tier | opt-in sync | vendor free tier | pauses after 7d low activity (documented); region choice = PDPL item 10 gate | pick KSA-region project when enabling | R8 only |
| Appwrite / PocketBase | sync alternatives | BSD/MIT-ish, self-host | needs a VPS + ops time | self-chosen ✓ | Alternates if Supabase terms drift |
| MapLibre GL | maps | BSD-3 | bundle size; tile source needed (attribution) | tiles origin matters | Only with R7 map strip |
| OSRM (+VROOM) | routing | BSD-2-Clause `[PRIMARY: GitHub license API]` | public demo ≈1 rps fair-use, no SLA → self-host for production; CSP addition needed | self-host ✓ | R7 behind env flag |
| OpenRouteService | routing alt | NOT RESEARCHED yet | — | — | Not adopted |
| Nominatim | geocoding | ODbL + usage policy | 1 rps max, bulk bans; attribution duty | queries leave device ⚠ | Policy-compliant use only if shipped |
| Traccar | GPS | Apache-2.0 `[PRIMARY]` | needs VPS when live | self-host ✓ | P6/future |
| jsPDF + exceljs | exports | MIT | Arabic shaping handled via embedded TTFs (already solved) | local ✓ | Keep |
| QR library (e.g., qrcode) | receipt QR | MIT-class | payload per ZATCA Phase-1 shape; decorative QR banned | local ✓ | R5 |
| GlitchTip | error reporting | AGPL/self-host or free tier | another service to run | third-party ⚠ | Deferred — console-error gates suffice today |
| n8n / GitHub Actions automation | digests | NOT RESEARCHED (Actions-cron on static host already banned as fiction) | — | — | Blocked pending research |
| WhatsApp Business Cloud API | outbound messaging | Meta pricing `[NOT RESEARCHED]` | per-message costs; template approval | Meta infra ⚠ | Blocked pending pricing research |

**Rule applied:** "open source" ≠ zero operating cost — every self-host row above carries an ops-burden note before adoption.
