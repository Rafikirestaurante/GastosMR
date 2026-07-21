-- Fase 24C - Inventario por insumo -> productos que consumen ese insumo
-- Ejecutar completo en Supabase SQL Editor después de fase24a y fase24b.

create table if not exists public.inventario_producto_insumos (
  id uuid primary key default gen_random_uuid(),
  insumo_id uuid not null references public.inventario_insumos(id) on delete cascade,
  insumo_nombre text not null,
  producto_codigo text not null,
  producto_nombre text not null,
  linea text,
  categoria text,
  cantidad numeric not null default 1 check (cantidad > 0),
  condicion text not null default 'venta',
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index if not exists inventario_producto_insumos_unico_idx
  on public.inventario_producto_insumos (insumo_id, producto_codigo, condicion);

create index if not exists inventario_producto_insumos_producto_idx
  on public.inventario_producto_insumos (producto_codigo, producto_nombre);

alter table public.inventario_producto_insumos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'inventario_producto_insumos'
      and policyname = 'inventario_producto_insumos_authenticated_all'
  ) then
    create policy inventario_producto_insumos_authenticated_all
    on public.inventario_producto_insumos
    for all
    to authenticated
    using (true)
    with check (true);
  end if;
end $$;

grant select, insert, update, delete on public.inventario_producto_insumos to authenticated;

-- Ya no usaremos la pantalla de reglas iniciales. Se conserva la tabla anterior como respaldo histórico,
-- pero se desactivan las reglas para que el control principal sea insumo -> productos.
do $$
begin
  if to_regclass('public.recetas_desechables') is not null then
    update public.recetas_desechables
    set activo = false,
        actualizado_en = now();
  end if;
end $$;

notify pgrst, 'reload schema';
