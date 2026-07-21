-- Fase 26H1 - Historial de arqueos de Caja
-- Ejecutar una sola vez en Supabase antes de probar el historial de arqueos.

create extension if not exists pgcrypto;

create table if not exists public.caja_arqueos_historial (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  arqueo_data jsonb,
  arqueo_total numeric not null default 0,
  creado_en timestamptz not null default now(),
  usuario_id uuid default auth.uid()
);

create index if not exists caja_arqueos_historial_fecha_creado_idx
on public.caja_arqueos_historial (fecha, creado_en desc);

alter table public.caja_arqueos_historial enable row level security;

grant select, insert, update, delete on public.caja_arqueos_historial to authenticated;

drop policy if exists "caja_arqueos_historial_select_auth" on public.caja_arqueos_historial;
drop policy if exists "caja_arqueos_historial_insert_auth" on public.caja_arqueos_historial;
drop policy if exists "caja_arqueos_historial_update_auth" on public.caja_arqueos_historial;
drop policy if exists "caja_arqueos_historial_delete_auth" on public.caja_arqueos_historial;

create policy "caja_arqueos_historial_select_auth"
on public.caja_arqueos_historial
for select
to authenticated
using (true);

create policy "caja_arqueos_historial_insert_auth"
on public.caja_arqueos_historial
for insert
to authenticated
with check (true);

create policy "caja_arqueos_historial_update_auth"
on public.caja_arqueos_historial
for update
to authenticated
using (true)
with check (true);

create policy "caja_arqueos_historial_delete_auth"
on public.caja_arqueos_historial
for delete
to authenticated
using (true);
