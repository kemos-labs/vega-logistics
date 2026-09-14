# Local `pi` Worker Policy

## Why workers are optional

The local `/home/kalde/Downloads/pi` installation exposes multiple provider/model routes (including Kilo, Cline, and OpenCode entries). Availability, quotas, credentials, and model catalogs can change. Therefore workers are an acceleration layer, not a dependency of route planning.

## Allowed jobs

- inspect a pasted sheet and propose column aliases;
- identify missing fields, suspicious duplicate rows, or ambiguous district/city combinations;
- produce EN/AR operator notes from already verified values;
- review a deterministic route output for contradictions or missing evidence;
- summarize official documentation with source links.

## Forbidden jobs

- route calculation, road-distance claims, geocoding, or coordinate invention;
- choosing a driver without the deterministic planner and operator review;
- changing files, browser storage, or external systems directly;
- sending WhatsApp/email/API requests;
- accepting import warnings, compliance claims, or Logestechs write actions.

## Reproducible handoff

Every worker call must receive a bounded text/JSON snapshot and return structured findings with:

```text
input_snapshot_id
task
findings[]
evidence[]
uncertainties[]
recommended_next_action
```

The parent agent must validate the output against VEGA domain rules and preserve the original input. If the worker is unavailable, the workflow continues manually with no feature degradation.

## Maintenance

Do not embed API keys, provider URLs, or model IDs in VEGA source. Read the local pi runbook when invoking a worker, verify the selected model is actually available, and treat its output as untrusted advisory text. Route and distance authority remains the configured road router or a clearly labelled manual/route-lite state.

