-- FASE 21G — Catálogo de productos en Supabase
-- Ejecutar este archivo en el SQL Editor de Supabase después de 21A-21B.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.catalogo_productos_categorias (
  id uuid primary key default gen_random_uuid(),
  linea text not null default 'Cafetería',
  nombre text not null,
  orden integer not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists catalogo_productos_categorias_linea_nombre_lower_idx
  on public.catalogo_productos_categorias (lower(linea), lower(nombre));

create table if not exists public.catalogo_productos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid references public.catalogo_productos_categorias(id) on delete set null,
  linea text not null default 'Cafetería',
  categoria text not null,
  nombre text not null,
  precio numeric(12,2),
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists catalogo_productos_linea_categoria_nombre_lower_idx
  on public.catalogo_productos (lower(linea), lower(categoria), lower(nombre));
create index if not exists catalogo_productos_linea_idx on public.catalogo_productos (linea);
create index if not exists catalogo_productos_categoria_idx on public.catalogo_productos (categoria);
create index if not exists catalogo_productos_activo_idx on public.catalogo_productos (activo);

drop trigger if exists catalogo_productos_categorias_set_updated_at on public.catalogo_productos_categorias;
create trigger catalogo_productos_categorias_set_updated_at
  before update on public.catalogo_productos_categorias
  for each row execute function public.set_updated_at();

drop trigger if exists catalogo_productos_set_updated_at on public.catalogo_productos;
create trigger catalogo_productos_set_updated_at
  before update on public.catalogo_productos
  for each row execute function public.set_updated_at();

alter table public.catalogo_productos_categorias enable row level security;
alter table public.catalogo_productos enable row level security;
drop policy if exists "catalogo_productos_categorias_select_authenticated" on public.catalogo_productos_categorias;
create policy "catalogo_productos_categorias_select_authenticated" on public.catalogo_productos_categorias for select to authenticated using (true);
drop policy if exists "catalogo_productos_categorias_insert_authenticated" on public.catalogo_productos_categorias;
create policy "catalogo_productos_categorias_insert_authenticated" on public.catalogo_productos_categorias for insert to authenticated with check (true);
drop policy if exists "catalogo_productos_categorias_update_authenticated" on public.catalogo_productos_categorias;
create policy "catalogo_productos_categorias_update_authenticated" on public.catalogo_productos_categorias for update to authenticated using (true) with check (true);
drop policy if exists "catalogo_productos_categorias_delete_authenticated" on public.catalogo_productos_categorias;
create policy "catalogo_productos_categorias_delete_authenticated" on public.catalogo_productos_categorias for delete to authenticated using (true);
drop policy if exists "catalogo_productos_select_authenticated" on public.catalogo_productos;
create policy "catalogo_productos_select_authenticated" on public.catalogo_productos for select to authenticated using (true);
drop policy if exists "catalogo_productos_insert_authenticated" on public.catalogo_productos;
create policy "catalogo_productos_insert_authenticated" on public.catalogo_productos for insert to authenticated with check (true);
drop policy if exists "catalogo_productos_update_authenticated" on public.catalogo_productos;
create policy "catalogo_productos_update_authenticated" on public.catalogo_productos for update to authenticated using (true) with check (true);
drop policy if exists "catalogo_productos_delete_authenticated" on public.catalogo_productos;
create policy "catalogo_productos_delete_authenticated" on public.catalogo_productos for delete to authenticated using (true);

-- Semilla de categorías
insert into public.catalogo_productos_categorias (linea, nombre, orden, activa) values ('Cafetería', 'Parfait', 1, true)
on conflict (lower(linea), lower(nombre)) do update set orden = excluded.orden, activa = excluded.activa;
insert into public.catalogo_productos_categorias (linea, nombre, orden, activa) values ('Cafetería', 'Desayunos', 2, true)
on conflict (lower(linea), lower(nombre)) do update set orden = excluded.orden, activa = excluded.activa;
insert into public.catalogo_productos_categorias (linea, nombre, orden, activa) values ('Cafetería', 'Sándwiches y fritos', 3, true)
on conflict (lower(linea), lower(nombre)) do update set orden = excluded.orden, activa = excluded.activa;
insert into public.catalogo_productos_categorias (linea, nombre, orden, activa) values ('Cafetería', 'Postres y ensaladas', 4, true)
on conflict (lower(linea), lower(nombre)) do update set orden = excluded.orden, activa = excluded.activa;
insert into public.catalogo_productos_categorias (linea, nombre, orden, activa) values ('Cafetería', 'Bebidas', 5, true)
on conflict (lower(linea), lower(nombre)) do update set orden = excluded.orden, activa = excluded.activa;
insert into public.catalogo_productos_categorias (linea, nombre, orden, activa) values ('Cafetería', 'Batidos cremosos', 6, true)
on conflict (lower(linea), lower(nombre)) do update set orden = excluded.orden, activa = excluded.activa;
insert into public.catalogo_productos_categorias (linea, nombre, orden, activa) values ('Cafetería', 'Batidos refrescantes', 7, true)
on conflict (lower(linea), lower(nombre)) do update set orden = excluded.orden, activa = excluded.activa;
insert into public.catalogo_productos_categorias (linea, nombre, orden, activa) values ('Cafetería', 'Jugos tradicionales', 8, true)
on conflict (lower(linea), lower(nombre)) do update set orden = excluded.orden, activa = excluded.activa;
insert into public.catalogo_productos_categorias (linea, nombre, orden, activa) values ('Restaurante', 'Platos', 9, true)
on conflict (lower(linea), lower(nombre)) do update set orden = excluded.orden, activa = excluded.activa;
insert into public.catalogo_productos_categorias (linea, nombre, orden, activa) values ('Restaurante', 'Sopas', 10, true)
on conflict (lower(linea), lower(nombre)) do update set orden = excluded.orden, activa = excluded.activa;

-- Semilla de productos actuales
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Parfait', 'Parfait 12 oz', 12500, true, 1
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Parfait')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Parfait', 'Parfait 16 oz', 16000, true, 2
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Parfait')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Parfait', 'Parfait 22 oz', 19000, true, 3
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Parfait')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Desayunos', 'Huevos tomate y cebolla', 11000, true, 10
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Desayunos')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Desayunos', 'Huevos revueltos', 11000, true, 11
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Desayunos')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Desayunos', 'Huevos con jamón y queso', 13000, true, 12
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Desayunos')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Desayunos', 'Huevos con tocineta', 13000, true, 13
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Desayunos')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Desayunos', 'Omelette', 14000, true, 14
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Desayunos')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Sándwiches y fritos', 'Sándwich de jamón y queso', 12000, true, 30
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Sándwiches y fritos')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Sándwiches y fritos', 'Sándwich de pollo', 14000, true, 31
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Sándwiches y fritos')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Sándwiches y fritos', 'Deditos', 4700, true, 32
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Sándwiches y fritos')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Sándwiches y fritos', 'Empanada', 4700, true, 33
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Sándwiches y fritos')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Postres y ensaladas', 'Fresas con crema', 13000, true, 50
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Postres y ensaladas')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Postres y ensaladas', 'Ensalada de frutas con helado', 12000, true, 51
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Postres y ensaladas')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Bebidas', 'Café americano', 3500, true, 70
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Bebidas')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Bebidas', 'Té y aromáticas', 2500, true, 71
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Bebidas')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Bebidas', 'Capuchino', 5000, true, 72
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Bebidas')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Bebidas', 'Agua normal', 2500, true, 73
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Bebidas')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Bebidas', 'Agua con Gas', 2500, true, 74
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Bebidas')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Batidos cremosos', 'Frutos rojos', null, true, 90
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Batidos cremosos')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Batidos cremosos', 'Mambo', null, true, 91
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Batidos cremosos')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Batidos cremosos', 'Mufasa', null, true, 92
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Batidos cremosos')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Batidos cremosos', 'Simba', null, true, 93
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Batidos cremosos')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Batidos cremosos', 'Kakao', null, true, 94
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Batidos cremosos')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Batidos cremosos', 'Batido de café', null, true, 95
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Batidos cremosos')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Batidos refrescantes', 'Karibu', null, true, 120
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Batidos refrescantes')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Batidos refrescantes', 'Zawadi', null, true, 121
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Batidos refrescantes')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Batidos refrescantes', 'Kike', null, true, 122
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Batidos refrescantes')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Batidos refrescantes', 'Utamu', null, true, 123
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Batidos refrescantes')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Batidos refrescantes', 'Nala', null, true, 124
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Batidos refrescantes')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Batidos refrescantes', 'Pumba', null, true, 125
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Batidos refrescantes')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Batidos refrescantes', 'Yenye', null, true, 126
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Batidos refrescantes')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Batidos refrescantes', 'Simba (en agua)', null, true, 127
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Batidos refrescantes')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Batidos refrescantes', 'Verde', null, true, 128
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Batidos refrescantes')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Jugos tradicionales', 'Fresa', null, true, 150
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Jugos tradicionales')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Jugos tradicionales', 'Mora', null, true, 151
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Jugos tradicionales')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Jugos tradicionales', 'Zapote', null, true, 152
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Jugos tradicionales')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Cafetería', 'Jugos tradicionales', 'Níspero', null, true, 153
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Cafetería') and lower(c.nombre)=lower('Jugos tradicionales')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Restaurante', 'Platos', 'Pechuga asada sin salsa', 16000, true, 200
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Restaurante') and lower(c.nombre)=lower('Platos')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Restaurante', 'Platos', 'Cerdo asado sin salsa', 16000, true, 201
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Restaurante') and lower(c.nombre)=lower('Platos')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Restaurante', 'Sopas', 'Sopas medianas sin arroz', 7000, true, 210
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Restaurante') and lower(c.nombre)=lower('Sopas')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Restaurante', 'Sopas', 'Sopas medianas con arroz', 9000, true, 211
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Restaurante') and lower(c.nombre)=lower('Sopas')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Restaurante', 'Sopas', 'Sancocho de pollo con arroz', 15000, true, 212
from public.catalogo_productos_categorias c where lower(c.linea)=lower('Restaurante') and lower(c.nombre)=lower('Sopas')
on conflict (lower(linea), lower(categoria), lower(nombre)) do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
