-- VEGA production persistence boundary (PostgreSQL)
-- This migration is intentionally additive and is not used by the simulation runtime.

create table if not exists tenants (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key,
  email text not null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  tenant_id uuid not null references tenants(id),
  user_id uuid not null references users(id),
  role text not null check (role in ('super_admin','fleet_manager','dispatcher','driver','warehouse_operator','maintenance_tech','customer_support','executive')),
  primary key (tenant_id, user_id)
);

create table if not exists vehicles (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  plate text not null,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, plate)
);

create table if not exists drivers (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  full_name text not null,
  phone text not null,
  iqama_no text,
  license_no text,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists jobs (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  ref text not null,
  customer_id uuid,
  status text not null,
  priority text not null,
  assigned_vehicle_id uuid references vehicles(id),
  assigned_driver_id uuid references drivers(id),
  service_window_start timestamptz,
  service_window_end timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, ref)
);

create table if not exists audit_events (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  actor_user_id uuid references users(id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  request_id text,
  occurred_at timestamptz not null default now()
);

create index if not exists jobs_tenant_status_idx on jobs (tenant_id, status);
create index if not exists audit_tenant_occurred_idx on audit_events (tenant_id, occurred_at desc);
