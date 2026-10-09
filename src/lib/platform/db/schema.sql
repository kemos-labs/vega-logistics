-- VEGA Logistics OS — PostgreSQL core schema (Supabase)
-- Model mirrors the client-side localStorage keys:
--   vega-financialInput-v2 → financial_inputs
--   vega-daily-reports-v2  → daily_records
--   vega-scenarios-v1      → scenarios
-- Row ownership uses supabase auth.uid(); RLS denies everything else.

create extension if not exists "pgcrypto";

-- ── Financial inputs ────────────────────────────────────────────────────────
create table if not exists public.financial_inputs (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- ── Daily operations records ────────────────────────────────────────────────
create table if not exists public.daily_records (
  user_id             uuid not null references auth.users (id) on delete cascade,
  report_date         date not null,
  completed_shipments integer not null default 0 check (completed_shipments >= 0),
  failed_shipments    integer not null default 0 check (failed_shipments >= 0),
  fuel_cost           numeric(12, 2) not null default 0 check (fuel_cost >= 0),
  drivers_present     integer not null default 0 check (drivers_present >= 0),
  notes               text not null default '',
  record_payload      jsonb constraint daily_records_payload_v1_check check (record_payload is null or (
    jsonb_typeof(record_payload) = 'object'
    and record_payload ?& array['version', 'record']
    and record_payload @> '{"version":1}'::jsonb
    and jsonb_typeof(record_payload -> 'record') = 'object'
    and (record_payload -> 'record') ? 'date'
    and jsonb_typeof(record_payload -> 'record' -> 'date') = 'string'
    and record_payload -> 'record' ->> 'date' = report_date::text
  )),
  updated_at          timestamptz not null default now(),
  primary key (user_id, report_date)
);

create index if not exists daily_records_user_date_idx
  on public.daily_records (user_id, report_date desc);

-- ── Saved scenarios ─────────────────────────────────────────────────────────
create table if not exists public.scenarios (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users (id) on delete cascade,
  name     text not null check (length(name) between 1 and 60),
  input    jsonb not null,
  saved_at timestamptz not null default now()
);

create index if not exists scenarios_user_saved_idx
  on public.scenarios (user_id, saved_at desc);

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.financial_inputs enable row level security;
alter table public.daily_records    enable row level security;
alter table public.scenarios        enable row level security;

create policy "own financial input" on public.financial_inputs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own daily records" on public.daily_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own scenarios" on public.scenarios
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Optional owner-only maintenance snapshot; not a tenant-sharing model.
create table if not exists public.maintenance_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null check (
    jsonb_typeof(data) = 'object' and data ?& array['version', 'vehicles', 'records', 'incidents']
    and data @> '{"version":2}'::jsonb
    and jsonb_typeof(data -> 'vehicles') = 'array'
    and jsonb_typeof(data -> 'records') = 'array'
    and jsonb_typeof(data -> 'incidents') = 'array'
  ),
  updated_at timestamptz not null default now()
);
alter table public.maintenance_state enable row level security;
drop policy if exists "own maintenance state" on public.maintenance_state;
create policy "own maintenance state" on public.maintenance_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
