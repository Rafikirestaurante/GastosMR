-- Fase 26G - Estabilización Caja / RLS
-- Ejecutar en Supabase SQL Editor si Caja muestra:
-- new row violates row-level security policy for table "caja_arqueos"

create table if not exists public.caja_arqueos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  inicio_data jsonb,
  fin_data jsonb,
  inicio_total numeric(14,2) not null default 0,
  fin_total numeric(14,2) not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists idx_caja_arqueos_fecha on public.caja_arqueos (fecha desc);

alter table public.caja_arqueos enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.caja_arqueos to authenticated;

drop policy if exists "caja_arqueos_select_authenticated" on public.caja_arqueos;
drop policy if exists "caja_arqueos_insert_authenticated" on public.caja_arqueos;
drop policy if exists "caja_arqueos_update_authenticated" on public.caja_arqueos;
drop policy if exists "caja_arqueos_select_auth" on public.caja_arqueos;
drop policy if exists "caja_arqueos_insert_auth" on public.caja_arqueos;
drop policy if exists "caja_arqueos_update_auth" on public.caja_arqueos;
drop policy if exists "caja_arqueos_select" on public.caja_arqueos;
drop policy if exists "caja_arqueos_insert" on public.caja_arqueos;
drop policy if exists "caja_arqueos_update" on public.caja_arqueos;

create policy "caja_arqueos_select_authenticated"
  on public.caja_arqueos
  for select
  to authenticated
  using (true);

create policy "caja_arqueos_insert_authenticated"
  on public.caja_arqueos
  for insert
  to authenticated
  with check (auth.role() = 'authenticated');

create policy "caja_arqueos_update_authenticated"
  on public.caja_arqueos
  for update
  to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
