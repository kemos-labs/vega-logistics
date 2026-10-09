-- Manual optional-sync migration; owner-only storage, no tenant sharing.
begin;
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

commit;
