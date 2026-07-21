-- Fase 24A - Inventario base Rafiki Pedidos
-- Ejecutar en Supabase SQL Editor.

create table if not exists public.inventario_insumos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null default 'Otros',
  unidad text not null default 'unidad',
  stock_actual numeric not null default 0,
  stock_minimo numeric not null default 0,
  costo_promedio numeric not null default 0,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index if not exists inventario_insumos_nombre_unico_idx
  on public.inventario_insumos (lower(nombre));

create index if not exists inventario_insumos_categoria_idx
  on public.inventario_insumos (categoria);

create table if not exists public.movimientos_inventario (
  id uuid primary key default gen_random_uuid(),
  insumo_id uuid not null references public.inventario_insumos(id) on delete restrict,
  tipo text not null check (tipo in ('entrada', 'salida', 'ajuste', 'merma')),
  cantidad numeric not null check (cantidad > 0),
  motivo text,
  fecha date not null default ((now() at time zone 'America/Bogota')::date),
  usuario text,
  creado_en timestamptz not null default now()
);

create index if not exists movimientos_inventario_insumo_fecha_idx
  on public.movimientos_inventario (insumo_id, fecha desc);

create table if not exists public.recetas_productos (
  id uuid primary key default gen_random_uuid(),
  producto_nombre text not null,
  producto_categoria text,
  insumo_id uuid not null references public.inventario_insumos(id) on delete restrict,
  cantidad numeric not null check (cantidad > 0),
  unidad text not null default 'unidad',
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists recetas_productos_producto_idx
  on public.recetas_productos (lower(producto_nombre));

create or replace function public.registrar_movimiento_inventario(
  insumo_id uuid,
  tipo text,
  cantidad numeric,
  motivo text default null,
  fecha date default ((now() at time zone 'America/Bogota')::date),
  usuario text default null
)
returns public.movimientos_inventario
language plpgsql
security definer
set search_path = public
as $$
declare
  nuevo_movimiento public.movimientos_inventario;
begin
  if cantidad is null or cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;

  if tipo not in ('entrada', 'salida', 'ajuste', 'merma') then
    raise exception 'Tipo de movimiento no válido';
  end if;

  insert into public.movimientos_inventario (insumo_id, tipo, cantidad, motivo, fecha, usuario)
  values (insumo_id, tipo, cantidad, motivo, coalesce(fecha, (now() at time zone 'America/Bogota')::date), usuario)
  returning * into nuevo_movimiento;

  update public.inventario_insumos
  set stock_actual = case
      when tipo = 'entrada' then stock_actual + cantidad
      when tipo in ('salida', 'merma') then stock_actual - cantidad
      when tipo = 'ajuste' then cantidad
      else stock_actual
    end,
    actualizado_en = now()
  where id = insumo_id;

  return nuevo_movimiento;
end;
$$;

alter table public.inventario_insumos enable row level security;
alter table public.movimientos_inventario enable row level security;
alter table public.recetas_productos enable row level security;

-- Políticas operativas: usuarios autenticados del panel pueden gestionar inventario.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'inventario_insumos' and policyname = 'inventario_insumos_authenticated_all') then
    create policy inventario_insumos_authenticated_all on public.inventario_insumos for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'movimientos_inventario' and policyname = 'movimientos_inventario_authenticated_all') then
    create policy movimientos_inventario_authenticated_all on public.movimientos_inventario for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'recetas_productos' and policyname = 'recetas_productos_authenticated_all') then
    create policy recetas_productos_authenticated_all on public.recetas_productos for all to authenticated using (true) with check (true);
  end if;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.inventario_insumos to authenticated;
grant select, insert, update, delete on public.movimientos_inventario to authenticated;
grant select, insert, update, delete on public.recetas_productos to authenticated;
grant execute on function public.registrar_movimiento_inventario(uuid, text, numeric, text, date, text) to authenticated;

-- Sincronización inicial segura: usa catalogo_insumos como base del inventario.
-- No duplica nombres que ya existan en inventario_insumos.
do $$
begin
  if to_regclass('public.catalogo_insumos') is not null then
    insert into public.inventario_insumos (nombre, categoria, unidad, stock_actual, stock_minimo, costo_promedio, activo)
    select
      ci.nombre,
      coalesce(nullif(ci.categoria, ''), 'Otros') as categoria,
      case lower(coalesce(ci.unidad_base, 'unidad'))
        when 'kg' then 'kg'
        when 'g' then 'g'
        when 'gr' then 'g'
        when 'lt' then 'litro'
        when 'l' then 'litro'
        when 'ml' then 'ml'
        when 'und' then 'unidad'
        else 'unidad'
      end as unidad,
      0,
      0,
      0,
      true
    from public.catalogo_insumos ci
    where coalesce(ci.activo, true) = true
      and not exists (
        select 1
        from public.inventario_insumos ii
        where lower(ii.nombre) = lower(ci.nombre)
      );
  end if;
end $$;

-- Fase 24A2 - Enlace opcional Gastos -> Inventario
-- Permite que una compra registrada en Gastos cree entradas de inventario sin obligar a todos los gastos.
alter table public.movimientos_inventario
  add column if not exists gasto_id uuid references public.gastos_diarios(id) on delete set null;

create index if not exists movimientos_inventario_gasto_idx
  on public.movimientos_inventario (gasto_id);

create or replace function public.registrar_entrada_inventario_desde_gasto(
  gasto_id uuid,
  insumo_id uuid,
  cantidad numeric,
  motivo text default null,
  fecha date default ((now() at time zone 'America/Bogota')::date),
  usuario text default 'Gastos Rafiki'
)
returns public.movimientos_inventario
language plpgsql
security definer
set search_path = public
as $$
declare
  nuevo_movimiento public.movimientos_inventario;
begin
  if cantidad is null or cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;

  insert into public.movimientos_inventario (gasto_id, insumo_id, tipo, cantidad, motivo, fecha, usuario)
  values (gasto_id, insumo_id, 'entrada', cantidad, coalesce(motivo, 'Compra registrada desde Gastos'), coalesce(fecha, (now() at time zone 'America/Bogota')::date), usuario)
  returning * into nuevo_movimiento;

  update public.inventario_insumos
  set stock_actual = stock_actual + cantidad,
      actualizado_en = now()
  where id = insumo_id;

  return nuevo_movimiento;
end;
$$;

grant execute on function public.registrar_entrada_inventario_desde_gasto(uuid, uuid, numeric, text, date, text) to authenticated;
