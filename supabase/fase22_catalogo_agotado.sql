-- Fase 22A-22B-22D
-- Ejecutar una sola vez en Supabase SQL Editor si la columna agotado no existe.

alter table public.catalogo_productos
add column if not exists agotado boolean not null default false;

create index if not exists idx_catalogo_productos_operacion
on public.catalogo_productos (linea, categoria, activo, agotado, orden);
