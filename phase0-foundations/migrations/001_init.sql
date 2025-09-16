-- 001_init.sql
-- Phase 0 lean schema with tenant isolation + RLS + monthly events partition
-- Run this in Supabase SQL editor or via Supabase CLI

-- Extensions
create extension if not exists "pgcrypto";

-- Helper: consistently extract owner_id from JWT
create or replace function public.jwt_owner_id()
returns uuid language sql stable as $$
  select (current_setting('request.jwt.claims', true)::json ->> 'owner_id')::uuid;
$$;

-- Owners (tenants)
create table if not exists public.owners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

-- App users (profile mirror for Supabase auth users)
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  owner_id uuid not null references public.owners(id) on delete cascade,
  email citext not null,
  role text not null default 'member',
  created_at timestamptz not null default now()
);

-- Locations (unique composite for FK safety)
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  name text not null,
  timezone text not null default 'America/Chicago',
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);

-- Devices (FK includes owner_id -> cross-tenant safety)
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  location_id uuid not null,
  model text,
  fw_version text,
  status text not null default 'active',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (location_id, owner_id) references public.locations(id, owner_id) on delete cascade
);

-- Events: parent partitioned by month
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  device_id uuid not null,
  occurred_at timestamptz not null,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (device_id, owner_id) references public.devices(id, owner_id) on delete cascade
) partition by range (occurred_at);

-- Current month partition
create table if not exists public.events_2025_09
  partition of public.events
  for values from ('2025-09-01') to ('2025-10-01');

-- Indexes
create index if not exists events_2025_09_idx_owner_device_time
  on public.events_2025_09 (owner_id, device_id, occurred_at desc);

create index if not exists events_2025_09_idx_payload_gin
  on public.events_2025_09 using gin (payload);

create index if not exists devices_idx_owner_location on public.devices(owner_id, location_id);
create index if not exists locations_idx_owner on public.locations(owner_id);
create index if not exists app_users_idx_owner on public.app_users(owner_id);

-- Device health snapshot
create table if not exists public.device_health (
  device_id uuid primary key,
  owner_id uuid not null,
  battery numeric,
  rssi numeric,
  temp_c numeric,
  last_event_id uuid,
  updated_at timestamptz not null default now(),
  foreign key (device_id, owner_id) references public.devices(id, owner_id) on delete cascade,
  foreign key (last_event_id) references public.events(id) on delete set null
);

-- RLS
alter table public.owners enable row level security;
alter table public.app_users enable row level security;
alter table public.locations enable row level security;
alter table public.devices enable row level security;
alter table public.events enable row level security;
alter table public.device_health enable row level security;

-- Deny by default (Supabase denies to anon; make tenant policies for authenticated)
-- Owners: users may see only their owner row
drop policy if exists owners_tenant_select on public.owners;
create policy owners_tenant_select on public.owners
for select to authenticated
using (id = public.jwt_owner_id());

-- app_users: tenant scoped
drop policy if exists app_users_select on public.app_users;
create policy app_users_select on public.app_users
for select to authenticated
using (owner_id = public.jwt_owner_id());

drop policy if exists app_users_insert on public.app_users;
create policy app_users_insert on public.app_users
for insert to authenticated
with check (owner_id = public.jwt_owner_id());

drop policy if exists app_users_update on public.app_users;
create policy app_users_update on public.app_users
for update to authenticated
using (owner_id = public.jwt_owner_id())
with check (owner_id = public.jwt_owner_id());

-- locations
drop policy if exists locations_select on public.locations;
create policy locations_select on public.locations
for select to authenticated
using (owner_id = public.jwt_owner_id());

drop policy if exists locations_insert on public.locations;
create policy locations_insert on public.locations
for insert to authenticated
with check (owner_id = public.jwt_owner_id());

drop policy if exists locations_update on public.locations;
create policy locations_update on public.locations
for update to authenticated
using (owner_id = public.jwt_owner_id())
with check (owner_id = public.jwt_owner_id());

-- devices
drop policy if exists devices_select on public.devices;
create policy devices_select on public.devices
for select to authenticated
using (owner_id = public.jwt_owner_id());

drop policy if exists devices_insert on public.devices;
create policy devices_insert on public.devices
for insert to authenticated
with check (owner_id = public.jwt_owner_id());

drop policy if exists devices_update on public.devices;
create policy devices_update on public.devices
for update to authenticated
using (owner_id = public.jwt_owner_id())
with check (owner_id = public.jwt_owner_id());

-- events
drop policy if exists events_select on public.events;
create policy events_select on public.events
for select to authenticated
using (owner_id = public.jwt_owner_id());

drop policy if exists events_insert on public.events;
create policy events_insert on public.events
for insert to authenticated
with check (owner_id = public.jwt_owner_id());

-- device_health
drop policy if exists device_health_select on public.device_health;
create policy device_health_select on public.device_health
for select to authenticated
using (owner_id = public.jwt_owner_id());

drop policy if exists device_health_upsert on public.device_health;
create policy device_health_upsert on public.device_health
for insert to authenticated
with check (owner_id = public.jwt_owner_id());

create policy device_health_update on public.device_health
for update to authenticated
using (owner_id = public.jwt_owner_id())
with check (owner_id = public.jwt_owner_id());

-- Optional: block deletes for safety in Phase 0
drop policy if exists devices_delete on public.devices;
create policy devices_delete on public.devices
for delete to authenticated
using (false);

drop policy if exists events_delete on public.events;
create policy events_delete on public.events
for delete to authenticated
using (false);

-- Done
-- Optional helper: device settings table + RPC
create table if not exists public.device_settings (
  device_id uuid primary key references public.devices(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.upsert_device_settings(p_device_id uuid, p_settings jsonb)
returns void language plpgsql as $$
begin
  insert into public.device_settings(device_id, settings, updated_at)
  values (p_device_id, coalesce(p_settings, '{}'::jsonb), now())
  on conflict (device_id)
  do update set settings = excluded.settings, updated_at = now();
end;
$$;
