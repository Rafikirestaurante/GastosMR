-- Fase 23A - Cierre diario inteligente
-- Ejecutar en Supabase SQL Editor.

create table if not exists public.cierres_diarios (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  ventas_total numeric(12,2) not null default 0,
  gastos_total numeric(12,2) not null default 0,
  utilidad_aproximada numeric(12,2) not null default 0,
  pedidos_total integer not null default 0,
  pedidos_finalizados integer not null default 0,
  pedidos_pendientes integer not null default 0,
  pedidos_cancelados integer not null default 0,
  ventas_restaurante numeric(12,2) not null default 0,
  ventas_cafeteria numeric(12,2) not null default 0,
  gastos_por_categoria jsonb not null default '{}'::jsonb,
  pagos_por_metodo jsonb not null default '{}'::jsonb,
  observaciones text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists cierres_diarios_fecha_idx on public.cierres_diarios (fecha desc);

alter table public.cierres_diarios enable row level security;

drop policy if exists "cierres_diarios_select_authenticated" on public.cierres_diarios;
create policy "cierres_diarios_select_authenticated"
  on public.cierres_diarios for select
  to authenticated
  using (true);

drop policy if exists "cierres_diarios_insert_authenticated" on public.cierres_diarios;
create policy "cierres_diarios_insert_authenticated"
  on public.cierres_diarios for insert
  to authenticated
  with check (true);

drop policy if exists "cierres_diarios_update_authenticated" on public.cierres_diarios;
create policy "cierres_diarios_update_authenticated"
  on public.cierres_diarios for update
  to authenticated
  using (true)
  with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.cierres_diarios to authenticated;
