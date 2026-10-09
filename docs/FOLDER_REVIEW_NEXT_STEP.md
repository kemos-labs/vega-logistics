# Folder review and next implementation step — 2026-10-09

## Scope and evidence

The owner requested a folder-wide review of Markdown, report tools, the app and Saudi delivery research. Review artifacts and exact full/partial/executed-only coverage are under `/data/Nemow Logistics/work/folder-review-2026-10-09/`. An inventory or hash does not count as semantic reading. Archived/generated/vendor/private documents are separately classified. This is a bounded review across all named workstreams, not a claim that every file or historical PDF was read.

Root reporting and VEGA are separate products. Root reporting uses canonical contracts and staged PM/DM jobs; VEGA is browser-local. Neither system supplies live source credentials, regulatory permissions, cash receipts or food transport evidence by itself. No incoming private workbook, company record, standing signature asset or existing signed PDF was modified by this increment.

## Confirmed repairs

Root report text now reports recorded status instead of inventing dispatch/contact/retry events. Weekly cancellations preserve the recorded driver and leave cause/timing unresolved. Executive analysis segregates canonical source-test rows before account/revenue analysis; operating counts exclude tests while explicit full-file counts remain traceable. Index totals reconcile to operating delivered plus pending. Duplicate conflict detection includes consequential payment, integration/POD/address semantics. Undated delivered counts and physical spreadsheet row references are repaired. Approved visual templates and signature behavior remain unchanged.

VEGA roster updates now persist active headcount and roster in a single patch, retaining inactive identities. Monthly payroll rows use headcount and the same salary/team toggles as the financial engine. Shipment stops alone qualify for a backup reminder. No persisted shape, storage key, backup version or cloud configuration changed.

## KSA evidence refresh

SPL describes the Short Address as four letters and four numbers. VEGA checks format, not existence or recipient match. Source: https://splonline.com.sa/en/national-address-1/ (retrieved 2026-10-09).

Food handling requires a scoped product/route and applicable current food-transport requirements. Generic parcel status and delivery time cannot establish product temperature, sanitation, segregation or safe release. Current app has no food profiles, temperature history, hygiene/custody or excursion disposition workflow. SFDA guide: https://sfda.gov.sa/en/guide/general-requirements-food-transport . The logger FAQ was indexed but full-body refresh timed out; exact category requirements remain conditional pending current guide extraction. Research details: `/data/Nemow Logistics/work/folder-review-2026-10-09/KSA_RESEARCH_REVIEW.md`. No licence/company document was reviewed and no Nemow authorization claim is made.

SDAIA's transfer regulation defines conditional overseas-transfer routes and safeguards; it does not establish a universal localization rule. The project's KSA-hosting preference remains an internal design gate, not proof that a particular provider region exists or that a transfer assessment is complete. Primary text retrieved 2026-10-09: https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/details/RegulationonPersonalDataTransferOutsidetheKingdom .

Historical market figures are context, never Nemow targets. The 288.1M versus >290M delivery-app count conflict remains unresolved at publication-definition level. Neither figure is parcel volume or a defensible Nemow market-share denominator. The TGA National Address enforcement page could not be refreshed today; historical attribution remains dated evidence, not a newly verified legal gate. The freight/parcel licensing clause is an indexed lead requiring consolidated primary-text verification.

## Next step in dependency order

1. Repair connected app storage failures before new imports: reject failed writes, preserve unreadable bytes, keep derived views on the last durable state and show an actionable bilingual error. Existing repository and maintenance safeguards do not cover every generic `useLocalStorage` caller.
2. Define strict full-value timestamp parsing/timezone policy in the Python canonical reader, with compatibility fixtures. Current prefix parser can accept trailing garbage and loses seconds/offsets. Reconcile default direct accounting rates and old cost assumptions against owner-backed contracts; do not infer contracted fees.
3. Link stable vehicle identity with the driver roster through explicit reviewed mapping, preserving historical dispatch snapshots. Build read-only source-export preview/reconciliation only after the actual source schema/export is supplied; no fictional imported records.
4. Run the supervised parcel acceptance workflow against representative approved inputs. Record actual cash evidence, render/inspect selected Arabic modes and measure operator effort. Software gates are not owner acceptance.
5. Scope a food pilot separately with current product-specific handling requirements and evidence sources. Complete cloud staging/Auth/RLS/outbox/conflict/privacy gates before R8 activation; telemetry, external sending and unattended actions remain separate.
