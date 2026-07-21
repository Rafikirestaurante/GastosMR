-- Fase 23A3 — Catálogo editable de gastos
-- Ejecutar en Supabase SQL Editor.

create table if not exists public.categorias_gasto (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true,
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.proveedores_gasto (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  categoria text not null default 'Otros',
  descripcion_sugerida text,
  activo boolean not null default true,
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists idx_categorias_gasto_activo_orden on public.categorias_gasto (activo, orden, nombre);
create index if not exists idx_proveedores_gasto_activo_orden on public.proveedores_gasto (activo, orden, nombre);
create index if not exists idx_proveedores_gasto_categoria on public.proveedores_gasto (categoria);

insert into public.categorias_gasto (nombre, activo, orden)
values
  ('Carnes', true, 10),
  ('Verduras', true, 20),
  ('Trabajadores', true, 30),
  ('Batidos', true, 40),
  ('Aseo y Desechables', true, 50),
  ('Mercado', true, 60),
  ('Servicios', true, 70),
  ('Otros', true, 999)
on conflict (nombre) do update set
  activo = excluded.activo,
  orden = excluded.orden,
  actualizado_en = now();

insert into public.proveedores_gasto (nombre, categoria, descripcion_sugerida, activo, orden)
values
  ('Alexa', 'Trabajadores', 'Pago día Alexa', true, 10),
  ('Jesús', 'Trabajadores', 'Pago día Jesús', true, 20),
  ('Kathe', 'Trabajadores', 'Pago día Kathe', true, 30),
  ('Paola', 'Trabajadores', 'Pago día Paola', true, 40)
on conflict (nombre) do update set
  categoria = excluded.categoria,
  descripcion_sugerida = excluded.descripcion_sugerida,
  activo = excluded.activo,
  orden = excluded.orden,
  actualizado_en = now();

alter table public.categorias_gasto enable row level security;
alter table public.proveedores_gasto enable row level security;

drop policy if exists "categorias_gasto_select" on public.categorias_gasto;
drop policy if exists "categorias_gasto_insert" on public.categorias_gasto;
drop policy if exists "categorias_gasto_update" on public.categorias_gasto;
drop policy if exists "proveedores_gasto_select" on public.proveedores_gasto;
drop policy if exists "proveedores_gasto_insert" on public.proveedores_gasto;
drop policy if exists "proveedores_gasto_update" on public.proveedores_gasto;

create policy "categorias_gasto_select" on public.categorias_gasto for select using (true);
create policy "categorias_gasto_insert" on public.categorias_gasto for insert with check (true);
create policy "categorias_gasto_update" on public.categorias_gasto for update using (true) with check (true);
create policy "proveedores_gasto_select" on public.proveedores_gasto for select using (true);
create policy "proveedores_gasto_insert" on public.proveedores_gasto for insert with check (true);
create policy "proveedores_gasto_update" on public.proveedores_gasto for update using (true) with check (true);

grant select, insert, update on public.categorias_gasto to anon, authenticated;
grant select, insert, update on public.proveedores_gasto to anon, authenticated;
