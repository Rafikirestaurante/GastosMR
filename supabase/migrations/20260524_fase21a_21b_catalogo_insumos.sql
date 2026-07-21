-- FASE 21A-21B — Catalogo de insumos en Supabase
-- Ejecutar este archivo en el SQL Editor de Supabase.
-- Objetivo: crear tablas de catalogo y migrar la lista local actual de insumos.

create extension if not exists pgcrypto;

create table if not exists public.catalogo_insumos_categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  orden integer not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists catalogo_insumos_categorias_nombre_lower_idx
  on public.catalogo_insumos_categorias (lower(nombre));

create table if not exists public.catalogo_insumos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid references public.catalogo_insumos_categorias(id) on delete set null,
  categoria text not null,
  nombre text not null,
  unidad_base text not null default 'und',
  proveedor text,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists catalogo_insumos_nombre_lower_idx
  on public.catalogo_insumos (lower(nombre));
create index if not exists catalogo_insumos_categoria_idx
  on public.catalogo_insumos (categoria);
create index if not exists catalogo_insumos_activo_idx
  on public.catalogo_insumos (activo);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists catalogo_insumos_categorias_set_updated_at on public.catalogo_insumos_categorias;
create trigger catalogo_insumos_categorias_set_updated_at
  before update on public.catalogo_insumos_categorias
  for each row execute function public.set_updated_at();

drop trigger if exists catalogo_insumos_set_updated_at on public.catalogo_insumos;
create trigger catalogo_insumos_set_updated_at
  before update on public.catalogo_insumos
  for each row execute function public.set_updated_at();

alter table public.catalogo_insumos_categorias enable row level security;
alter table public.catalogo_insumos enable row level security;

-- Politicas iniciales: acceso a usuarios autenticados. En fases posteriores se puede restringir a rol administrador.
drop policy if exists "catalogo_insumos_categorias_select_authenticated" on public.catalogo_insumos_categorias;
create policy "catalogo_insumos_categorias_select_authenticated" on public.catalogo_insumos_categorias for select to authenticated using (true);

drop policy if exists "catalogo_insumos_categorias_insert_authenticated" on public.catalogo_insumos_categorias;
create policy "catalogo_insumos_categorias_insert_authenticated" on public.catalogo_insumos_categorias for insert to authenticated with check (true);

drop policy if exists "catalogo_insumos_categorias_update_authenticated" on public.catalogo_insumos_categorias;
create policy "catalogo_insumos_categorias_update_authenticated" on public.catalogo_insumos_categorias for update to authenticated using (true) with check (true);

drop policy if exists "catalogo_insumos_categorias_delete_authenticated" on public.catalogo_insumos_categorias;
create policy "catalogo_insumos_categorias_delete_authenticated" on public.catalogo_insumos_categorias for delete to authenticated using (true);

drop policy if exists "catalogo_insumos_select_authenticated" on public.catalogo_insumos;
create policy "catalogo_insumos_select_authenticated" on public.catalogo_insumos for select to authenticated using (true);

drop policy if exists "catalogo_insumos_insert_authenticated" on public.catalogo_insumos;
create policy "catalogo_insumos_insert_authenticated" on public.catalogo_insumos for insert to authenticated with check (true);

drop policy if exists "catalogo_insumos_update_authenticated" on public.catalogo_insumos;
create policy "catalogo_insumos_update_authenticated" on public.catalogo_insumos for update to authenticated using (true) with check (true);

drop policy if exists "catalogo_insumos_delete_authenticated" on public.catalogo_insumos;
create policy "catalogo_insumos_delete_authenticated" on public.catalogo_insumos for delete to authenticated using (true);

-- Semilla de categorias
insert into public.catalogo_insumos_categorias (nombre, orden, activa) values ('Proteínas', 1, true)
on conflict (lower(nombre)) do update set orden = excluded.orden, activa = excluded.activa;
insert into public.catalogo_insumos_categorias (nombre, orden, activa) values ('Lácteos y huevos', 2, true)
on conflict (lower(nombre)) do update set orden = excluded.orden, activa = excluded.activa;
insert into public.catalogo_insumos_categorias (nombre, orden, activa) values ('Frutas, pulpas y congelados', 3, true)
on conflict (lower(nombre)) do update set orden = excluded.orden, activa = excluded.activa;
insert into public.catalogo_insumos_categorias (nombre, orden, activa) values ('Verduras, hortalizas y tubérculos', 4, true)
on conflict (lower(nombre)) do update set orden = excluded.orden, activa = excluded.activa;
insert into public.catalogo_insumos_categorias (nombre, orden, activa) values ('Abarrotes, secos y condimentos', 5, true)
on conflict (lower(nombre)) do update set orden = excluded.orden, activa = excluded.activa;
insert into public.catalogo_insumos_categorias (nombre, orden, activa) values ('Empaques y desechables', 6, true)
on conflict (lower(nombre)) do update set orden = excluded.orden, activa = excluded.activa;
insert into public.catalogo_insumos_categorias (nombre, orden, activa) values ('Aseo y limpieza', 7, true)
on conflict (lower(nombre)) do update set orden = excluded.orden, activa = excluded.activa;

-- Semilla de insumos actuales
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Proteínas', 'Pollo', 'und', true, 1
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Proteínas')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Proteínas', 'Pechuga', 'und', true, 2
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Proteínas')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Proteínas', 'Carne', 'und', true, 3
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Proteínas')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Proteínas', 'Cerdo', 'und', true, 4
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Proteínas')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Proteínas', 'Chuleta', 'und', true, 5
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Proteínas')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Proteínas', 'Atún', 'und', true, 6
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Proteínas')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Proteínas', 'Carne para guisar', 'und', true, 7
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Proteínas')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Proteínas', 'Carne para posta', 'und', true, 8
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Proteínas')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Proteínas', 'Costilla', 'und', true, 9
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Proteínas')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Proteínas', 'Gallina', 'und', true, 10
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Proteínas')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Proteínas', 'Panza', 'und', true, 11
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Proteínas')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Proteínas', 'Pata de cerdo', 'und', true, 12
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Proteínas')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Proteínas', 'Pata de res', 'und', true, 13
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Proteínas')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Proteínas', 'Sobrebarriga', 'und', true, 14
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Proteínas')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Proteínas', 'Tocineta', 'und', true, 15
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Proteínas')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Lácteos y huevos', 'Leche', 'und', true, 16
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Lácteos y huevos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Lácteos y huevos', 'Suero', 'und', true, 17
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Lácteos y huevos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Lácteos y huevos', 'Queso mozzarella', 'und', true, 18
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Lácteos y huevos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Lácteos y huevos', 'Queso parmesano', 'und', true, 19
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Lácteos y huevos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Lácteos y huevos', 'Queso duro', 'und', true, 20
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Lácteos y huevos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Lácteos y huevos', 'Mantequilla', 'und', true, 21
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Lácteos y huevos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Lácteos y huevos', 'Crema de leche', 'und', true, 22
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Lácteos y huevos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Proteínas', 'Jamón', 'und', true, 23
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Proteínas')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Lácteos y huevos', 'Huevos', 'und', true, 24
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Lácteos y huevos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Frutas, pulpas y congelados', 'Mango', 'und', true, 25
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Frutas, pulpas y congelados')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Frutas, pulpas y congelados', 'Arándanos', 'und', true, 26
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Frutas, pulpas y congelados')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Frutas, pulpas y congelados', 'Uva', 'und', true, 27
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Frutas, pulpas y congelados')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Frutas, pulpas y congelados', 'Fresa', 'und', true, 28
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Frutas, pulpas y congelados')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Frutas, pulpas y congelados', 'Kiwi', 'und', true, 29
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Frutas, pulpas y congelados')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Frutas, pulpas y congelados', 'Piña', 'und', true, 30
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Frutas, pulpas y congelados')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Frutas, pulpas y congelados', 'Banano', 'und', true, 31
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Frutas, pulpas y congelados')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Frutas, pulpas y congelados', 'Mora', 'und', true, 32
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Frutas, pulpas y congelados')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Frutas, pulpas y congelados', 'Melón', 'und', true, 33
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Frutas, pulpas y congelados')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Frutas, pulpas y congelados', 'Tomate de árbol', 'und', true, 34
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Frutas, pulpas y congelados')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Frutas, pulpas y congelados', 'Papaya', 'und', true, 35
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Frutas, pulpas y congelados')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Frutas, pulpas y congelados', 'Patilla', 'und', true, 36
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Frutas, pulpas y congelados')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Frutas, pulpas y congelados', 'Limón', 'und', true, 37
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Frutas, pulpas y congelados')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Frutas, pulpas y congelados', 'Pulpa de guanábana', 'und', true, 38
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Frutas, pulpas y congelados')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Frutas, pulpas y congelados', 'Pulpa de zapote', 'und', true, 39
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Frutas, pulpas y congelados')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Frutas, pulpas y congelados', 'Pulpa de níspero', 'und', true, 40
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Frutas, pulpas y congelados')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Frutas, pulpas y congelados', 'Pulpa de maracuyá', 'und', true, 41
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Frutas, pulpas y congelados')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Frutas, pulpas y congelados', 'Pulpa de mango', 'und', true, 42
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Frutas, pulpas y congelados')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Frutas, pulpas y congelados', 'Fresas para congelar', 'und', true, 43
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Frutas, pulpas y congelados')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Frutas, pulpas y congelados', 'Fresas para parfait', 'und', true, 44
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Frutas, pulpas y congelados')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Frutas, pulpas y congelados', 'Polvo chantillí', 'und', true, 45
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Frutas, pulpas y congelados')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Ahuyama', 'und', true, 46
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Ajo', 'und', true, 47
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Apio', 'und', true, 48
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Cebolla blanca', 'und', true, 49
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Cebolla larga', 'und', true, 50
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Cebolla puerro', 'und', true, 51
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Cebolla roja', 'und', true, 52
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Cilantro', 'und', true, 53
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Espinaca', 'und', true, 54
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Guineo verde', 'und', true, 55
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Habichuela corta', 'und', true, 56
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Lechuga batavia', 'und', true, 57
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Lechuga crespa', 'und', true, 58
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Lechuga romana', 'und', true, 59
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Ñame', 'und', true, 60
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Papa sucia', 'und', true, 61
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Papa amarilla', 'und', true, 62
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Pepino', 'und', true, 63
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Perejil', 'und', true, 64
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Pimentón amarillo', 'und', true, 65
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Pimentón rojo', 'und', true, 66
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Pimentón verde', 'und', true, 67
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Plátano amarillo', 'und', true, 68
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Plátano verde', 'und', true, 69
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Ají topito', 'und', true, 70
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Remolacha', 'und', true, 71
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Yuca', 'und', true, 72
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Zanahoria', 'und', true, 73
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Tomate', 'und', true, 74
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Mazorcas', 'und', true, 75
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Guascas', 'und', true, 76
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Champiñones', 'und', true, 77
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Mix de verduras', 'und', true, 78
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Verduras, hortalizas y tubérculos', 'Maíz', 'und', true, 79
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Verduras, hortalizas y tubérculos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Arroz', 'und', true, 80
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Zaragosa', 'und', true, 81
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Garbanzo', 'und', true, 82
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Lentejas', 'und', true, 83
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Pasta', 'und', true, 84
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Fideos', 'und', true, 85
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Harina de trigo', 'und', true, 86
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Harina amarilla', 'und', true, 87
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Avena', 'und', true, 88
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Granola y tostadas', 'und', true, 89
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Tostadas', 'und', true, 90
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Pan', 'und', true, 91
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Arepas', 'und', true, 92
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Papas fritas', 'und', true, 93
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Stevia', 'und', true, 94
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Azúcar', 'und', true, 95
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Azúcar en tubitos', 'und', true, 96
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Panela', 'und', true, 97
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Jugo de naranja', 'und', true, 98
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Jugo de mandarina', 'und', true, 99
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Jugo de uva', 'und', true, 100
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Ingredientes pulpa de café', 'und', true, 101
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Aceite', 'und', true, 102
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Sal', 'und', true, 103
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Mayonesa', 'und', true, 104
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Salsa de tomate', 'und', true, 105
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Picante', 'und', true, 106
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Finas hierbas', 'und', true, 107
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Orégano', 'und', true, 108
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Albahaca', 'und', true, 109
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Mostaza', 'und', true, 110
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Pimienta', 'und', true, 111
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Abarrotes, secos y condimentos', 'Fécula', 'und', true, 112
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Abarrotes, secos y condimentos')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Sopero 12 oz', 'und', true, 113
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Sopero 24 oz', 'und', true, 114
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Sopero 32 oz', 'und', true, 115
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Contenedor 3 divisiones negro', 'und', true, 116
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Contenedor C1', 'und', true, 117
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Contenedor J1 dorado', 'und', true, 118
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Tarinas 12 oz', 'und', true, 119
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Vasos Darnel 12 oz', 'und', true, 120
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Vasos Darnel 16 oz', 'und', true, 121
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Vasos Gold Carvajal 22 oz', 'und', true, 122
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Vasos de tinto 9 oz', 'und', true, 123
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Vasos de capuchino 12 oz', 'und', true, 124
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Tapa Darnel plana', 'und', true, 125
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Tapas Darnel domo', 'und', true, 126
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Tapas verdes', 'und', true, 127
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Pitillos batido 7 mm', 'und', true, 128
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Bolsas plásticas 2K', 'und', true, 129
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Bolsas plásticas 10K', 'und', true, 130
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Bolsas plásticas 15K', 'und', true, 131
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Bolsas para cubiertos', 'und', true, 132
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Bolsas de porcionar', 'und', true, 133
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Papel para sándwich', 'und', true, 134
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Servilletas', 'und', true, 135
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Empaques y desechables', 'Comandas', 'und', true, 136
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Empaques y desechables')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Aseo y limpieza', 'Cloro', 'und', true, 137
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Aseo y limpieza')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Aseo y limpieza', 'Detergente FAB', 'und', true, 138
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Aseo y limpieza')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Aseo y limpieza', 'Desinfectante', 'und', true, 139
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Aseo y limpieza')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Aseo y limpieza', 'Bolsas de basura normales', 'und', true, 140
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Aseo y limpieza')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Aseo y limpieza', 'Bolsas de basura grandes', 'und', true, 141
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Aseo y limpieza')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Aseo y limpieza', 'Papel higiénico', 'und', true, 142
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Aseo y limpieza')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Aseo y limpieza', 'Cinta pegante', 'und', true, 143
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Aseo y limpieza')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_insumos (categoria_id, categoria, nombre, unidad_base, activo, orden)
select c.id, 'Aseo y limpieza', 'Esponjas', 'und', true, 144
from public.catalogo_insumos_categorias c where lower(c.nombre) = lower('Aseo y limpieza')
on conflict (lower(nombre)) do update set categoria_id = excluded.categoria_id, categoria = excluded.categoria, activo = excluded.activo, orden = excluded.orden;

-- Verificacion rapida esperada: 7 categorias y 144 insumos
select 'categorias' as tabla, count(*) as total from public.catalogo_insumos_categorias
union all
select 'insumos' as tabla, count(*) as total from public.catalogo_insumos;
