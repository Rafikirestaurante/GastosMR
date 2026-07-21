-- Fase 24B - Recetas iniciales de inventario: desechables + sándwich
-- Ejecutar completo en Supabase SQL Editor después de fase24a_inventario_base.sql.

alter table public.movimientos_inventario
  add column if not exists pedido_id uuid references public.pedidos(id) on delete set null,
  add column if not exists regla_codigo text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists movimientos_inventario_pedido_idx
  on public.movimientos_inventario (pedido_id);

create unique index if not exists movimientos_inventario_pedido_regla_unico_idx
  on public.movimientos_inventario (pedido_id, regla_codigo)
  where pedido_id is not null and regla_codigo is not null;

create table if not exists public.recetas_desechables (
  id uuid primary key default gen_random_uuid(),
  grupo_producto text not null,
  condicion text not null default 'para_llevar',
  insumo_nombre text not null,
  cantidad numeric not null default 1 check (cantidad > 0),
  regla_codigo text not null,
  activo boolean not null default true,
  notas text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index if not exists recetas_desechables_regla_unico_idx
  on public.recetas_desechables (regla_codigo);

alter table public.recetas_desechables enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'recetas_desechables' and policyname = 'recetas_desechables_authenticated_all') then
    create policy recetas_desechables_authenticated_all on public.recetas_desechables for all to authenticated using (true) with check (true);
  end if;
end $$;

grant select, insert, update, delete on public.recetas_desechables to authenticated;

insert into public.recetas_desechables (grupo_producto, condicion, insumo_nombre, cantidad, regla_codigo, notas) values
  ('almuerzo_estandar', 'para_llevar', 'Contenedor 3 divisiones negro', 1, 'empaque_almuerzo_estandar', 'Proteínas corrientes para llevar: pechuga, cerdo, carne, pollo guisado, etc.'),
  ('almuerzo_estandar', 'para_llevar', 'Bolsas plásticas 2K', 1, 'empaque_almuerzo_bolsa', 'Bolsa para almuerzo estándar.'),
  ('pasta', 'para_llevar', 'Contenedor C1', 1, 'empaque_pasta', 'Las pastas usan empaque distinto.'),
  ('pasta', 'para_llevar', 'Bolsas plásticas 2K', 1, 'empaque_pasta_bolsa', 'Bolsa para pasta.'),
  ('arroz', 'para_llevar', 'Contenedor J1 dorado', 1, 'empaque_arroz', 'Los arroces usan empaque distinto.'),
  ('arroz', 'para_llevar', 'Bolsas plásticas 2K', 1, 'empaque_arroz_bolsa', 'Bolsa para arroz.'),
  ('sancocho', 'para_llevar', 'Sopero 32 oz', 1, 'empaque_sancocho', 'Sancocho usa sopero grande.'),
  ('sancocho', 'para_llevar', 'Bolsas plásticas 10K', 1, 'empaque_sancocho_bolsa', 'Bolsa más grande para sancocho.'),
  ('sopa', 'para_llevar', 'Sopero 24 oz', 1, 'empaque_sopa', 'Sopas medianas usan sopero diferente al sancocho.'),
  ('sopa', 'para_llevar', 'Bolsas plásticas 2K', 1, 'empaque_sopa_bolsa', 'Bolsa para sopa mediana.'),
  ('sandwich', 'produccion', 'Pan', 1, 'sandwich_pan', 'Receta base del sándwich.'),
  ('sandwich', 'produccion', 'Jamón', 1, 'sandwich_jamon', 'Receta base del sándwich.'),
  ('sandwich', 'produccion', 'Queso mozzarella', 1, 'sandwich_queso', 'Receta base del sándwich.'),
  ('sandwich', 'produccion', 'Mantequilla', 1, 'sandwich_mantequilla', 'Receta base del sándwich.'),
  ('sandwich', 'produccion', 'Servilletas', 1, 'sandwich_servilletas', 'Servilleta por unidad.'),
  ('sandwich', 'para_llevar', 'Papel para sándwich', 1, 'empaque_sandwich_papel', 'Empaque para sándwich para llevar.'),
  ('sandwich', 'para_llevar', 'Bolsas plásticas 2K', 1, 'empaque_sandwich_bolsa', 'Bolsa para sándwich para llevar.'),
  ('bebida_12', 'para_llevar', 'Vasos Darnel 12 oz', 1, 'empaque_bebida_12_vaso', 'Bebidas/batidos 12 oz.'),
  ('bebida_12', 'para_llevar', 'Tapa Darnel plana', 1, 'empaque_bebida_12_tapa', 'Tapa para 12 oz.'),
  ('bebida_16', 'para_llevar', 'Vasos Darnel 16 oz', 1, 'empaque_bebida_16_vaso', 'Bebidas/batidos 16 oz.'),
  ('bebida_16', 'para_llevar', 'Tapa Darnel plana', 1, 'empaque_bebida_16_tapa', 'Tapa para 16 oz.'),
  ('bebida_22', 'para_llevar', 'Vasos Gold Carvajal 22 oz', 1, 'empaque_bebida_22_vaso', 'Bebidas/batidos 22 oz.'),
  ('bebida_22', 'para_llevar', 'Tapas Darnel domo', 1, 'empaque_bebida_22_tapa', 'Tapa para 22 oz.'),
  ('bebida', 'para_llevar', 'Pitillos batido 7 mm', 1, 'empaque_bebida_pitillo', 'Pitillo por bebida para llevar.')
on conflict (regla_codigo) do update set
  grupo_producto = excluded.grupo_producto,
  condicion = excluded.condicion,
  insumo_nombre = excluded.insumo_nombre,
  cantidad = excluded.cantidad,
  notas = excluded.notas,
  activo = true,
  actualizado_en = now();



update public.recetas_desechables
set activo = false, actualizado_en = now()
where regla_codigo in (
  'empaque_almuerzo_bolsa',
  'empaque_pasta_bolsa',
  'empaque_arroz_bolsa',
  'empaque_sancocho_bolsa',
  'empaque_sopa_bolsa',
  'sandwich_pan',
  'sandwich_jamon',
  'sandwich_queso',
  'sandwich_mantequilla',
  'sandwich_servilletas'
);

create or replace function public.registrar_salida_inventario_pedido(
  pedido_id uuid,
  insumo_nombre text,
  cantidad numeric,
  regla_codigo text,
  motivo text default null,
  usuario text default 'Pedidos Rafiki'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_insumo public.inventario_insumos;
  v_movimiento public.movimientos_inventario;
begin
  if pedido_id is null then
    return jsonb_build_object('estado', 'omitido', 'motivo', 'pedido_id vacío', 'insumo', insumo_nombre, 'regla', regla_codigo);
  end if;

  if cantidad is null or cantidad <= 0 then
    return jsonb_build_object('estado', 'omitido', 'motivo', 'cantidad inválida', 'insumo', insumo_nombre, 'regla', regla_codigo);
  end if;

  if exists (
    select 1 from public.movimientos_inventario mi
    where mi.pedido_id = registrar_salida_inventario_pedido.pedido_id
      and mi.regla_codigo = registrar_salida_inventario_pedido.regla_codigo
  ) then
    return jsonb_build_object('estado', 'duplicado', 'motivo', 'ya descontado para este pedido', 'insumo', insumo_nombre, 'regla', regla_codigo);
  end if;

  select * into v_insumo
  from public.inventario_insumos ii
  where lower(ii.nombre) = lower(trim(insumo_nombre))
    and ii.activo = true
  limit 1;

  if v_insumo.id is null then
    return jsonb_build_object('estado', 'sin_insumo', 'motivo', 'insumo no existe en inventario', 'insumo', insumo_nombre, 'regla', regla_codigo);
  end if;

  insert into public.movimientos_inventario (pedido_id, insumo_id, tipo, cantidad, motivo, fecha, usuario, regla_codigo, metadata)
  values (
    pedido_id,
    v_insumo.id,
    'salida',
    cantidad,
    coalesce(motivo, 'Salida automática por pedido'),
    (now() at time zone 'America/Bogota')::date,
    usuario,
    regla_codigo,
    jsonb_build_object('origen', 'pedido_finalizado', 'insumo_nombre', insumo_nombre)
  )
  returning * into v_movimiento;

  update public.inventario_insumos
  set stock_actual = stock_actual - cantidad,
      actualizado_en = now()
  where id = v_insumo.id;

  return jsonb_build_object(
    'estado', 'registrado',
    'movimiento_id', v_movimiento.id,
    'insumo_id', v_insumo.id,
    'insumo', v_insumo.nombre,
    'cantidad', cantidad,
    'regla', regla_codigo
  );
end;
$$;

grant execute on function public.registrar_salida_inventario_pedido(uuid, text, numeric, text, text, text) to authenticated;

notify pgrst, 'reload schema';

-- Fase 24B3 - Reglas con múltiples insumos
-- Este bloque permite que una misma regla descuente varios insumos.
-- Ejemplo: empaque_almuerzo_estandar puede descontar caja + bolsa + cubiertos + servilletas.

drop index if exists public.recetas_desechables_regla_unico_idx;
create unique index if not exists recetas_desechables_regla_insumo_unico_idx
  on public.recetas_desechables (regla_codigo, insumo_nombre);

drop index if exists public.movimientos_inventario_pedido_regla_unico_idx;
create unique index if not exists movimientos_inventario_pedido_regla_insumo_unico_idx
  on public.movimientos_inventario (pedido_id, regla_codigo, insumo_id)
  where pedido_id is not null and regla_codigo is not null and insumo_id is not null;

-- Ajuste de reglas iniciales para que algunas reglas agrupen varios insumos.
-- Si ya existen, se actualizan por regla + insumo.
insert into public.recetas_desechables (grupo_producto, condicion, insumo_nombre, cantidad, regla_codigo, notas, activo) values
  ('almuerzo_estandar', 'para_llevar', 'Contenedor 3 divisiones negro', 1, 'empaque_almuerzo_estandar', 'Regla agrupada: proteínas normales para llevar.', true),
  ('almuerzo_estandar', 'para_llevar', 'Bolsas plásticas 2K', 1, 'empaque_almuerzo_estandar', 'Regla agrupada: proteínas normales para llevar.', true),
  ('almuerzo_estandar', 'para_llevar', 'Cubiertos', 1, 'empaque_almuerzo_estandar', 'Regla agrupada: proteínas normales para llevar.', true),
  ('almuerzo_estandar', 'para_llevar', 'Servilletas', 2, 'empaque_almuerzo_estandar', 'Regla agrupada: proteínas normales para llevar.', true),
  ('pasta', 'para_llevar', 'Contenedor C1', 1, 'empaque_pasta', 'Regla agrupada: las pastas usan empaque distinto.', true),
  ('pasta', 'para_llevar', 'Bolsas plásticas 2K', 1, 'empaque_pasta', 'Regla agrupada: las pastas usan empaque distinto.', true),
  ('arroz', 'para_llevar', 'Contenedor J1 dorado', 1, 'empaque_arroz', 'Regla agrupada: los arroces usan empaque distinto.', true),
  ('arroz', 'para_llevar', 'Bolsas plásticas 2K', 1, 'empaque_arroz', 'Regla agrupada: los arroces usan empaque distinto.', true),
  ('sancocho', 'para_llevar', 'Sopero 32 oz', 1, 'empaque_sancocho', 'Regla agrupada: sancocho usa sopero grande.', true),
  ('sancocho', 'para_llevar', 'Bolsas plásticas 10K', 1, 'empaque_sancocho', 'Regla agrupada: sancocho usa bolsa grande.', true),
  ('sancocho', 'para_llevar', 'Cuchara', 1, 'empaque_sancocho', 'Regla agrupada: sancocho usa cuchara.', true),
  ('sopa', 'para_llevar', 'Sopero 24 oz', 1, 'empaque_sopa', 'Regla agrupada: sopas medianas usan sopero diferente al sancocho.', true),
  ('sopa', 'para_llevar', 'Bolsas plásticas 2K', 1, 'empaque_sopa', 'Regla agrupada: sopas medianas para llevar.', true),
  ('sopa', 'para_llevar', 'Cuchara', 1, 'empaque_sopa', 'Regla agrupada: sopas medianas para llevar.', true),
  ('sandwich', 'produccion', 'Pan', 1, 'sandwich_jamon_queso', 'Regla agrupada: receta base del sándwich.', true),
  ('sandwich', 'produccion', 'Jamón', 1, 'sandwich_jamon_queso', 'Regla agrupada: receta base del sándwich.', true),
  ('sandwich', 'produccion', 'Queso mozzarella', 1, 'sandwich_jamon_queso', 'Regla agrupada: receta base del sándwich.', true),
  ('sandwich', 'produccion', 'Mantequilla', 1, 'sandwich_jamon_queso', 'Regla agrupada: receta base del sándwich.', true),
  ('sandwich', 'produccion', 'Servilletas', 1, 'sandwich_jamon_queso', 'Regla agrupada: receta base del sándwich.', true)
on conflict (regla_codigo, insumo_nombre) do update set
  grupo_producto = excluded.grupo_producto,
  condicion = excluded.condicion,
  cantidad = excluded.cantidad,
  notas = excluded.notas,
  activo = excluded.activo,
  actualizado_en = now();

create or replace function public.registrar_salida_inventario_pedido(
  pedido_id uuid,
  insumo_nombre text,
  cantidad numeric,
  regla_codigo text,
  motivo text default null,
  usuario text default 'Pedidos Rafiki'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_insumo public.inventario_insumos;
  v_movimiento public.movimientos_inventario;
begin
  if pedido_id is null then
    return jsonb_build_object('estado', 'omitido', 'motivo', 'pedido_id vacío', 'insumo', insumo_nombre, 'regla', regla_codigo);
  end if;

  if cantidad is null or cantidad <= 0 then
    return jsonb_build_object('estado', 'omitido', 'motivo', 'cantidad inválida', 'insumo', insumo_nombre, 'regla', regla_codigo);
  end if;

  select * into v_insumo
  from public.inventario_insumos ii
  where lower(ii.nombre) = lower(trim(insumo_nombre))
    and ii.activo = true
  limit 1;

  if v_insumo.id is null then
    return jsonb_build_object('estado', 'sin_insumo', 'motivo', 'insumo no existe en inventario', 'insumo', insumo_nombre, 'regla', regla_codigo);
  end if;

  if exists (
    select 1 from public.movimientos_inventario mi
    where mi.pedido_id = registrar_salida_inventario_pedido.pedido_id
      and mi.regla_codigo = registrar_salida_inventario_pedido.regla_codigo
      and mi.insumo_id = v_insumo.id
  ) then
    return jsonb_build_object('estado', 'duplicado', 'motivo', 'ya descontado para este pedido', 'insumo', insumo_nombre, 'regla', regla_codigo);
  end if;

  insert into public.movimientos_inventario (pedido_id, insumo_id, tipo, cantidad, motivo, fecha, usuario, regla_codigo, metadata)
  values (
    pedido_id,
    v_insumo.id,
    'salida',
    cantidad,
    coalesce(motivo, 'Salida automática por pedido'),
    (now() at time zone 'America/Bogota')::date,
    usuario,
    regla_codigo,
    jsonb_build_object('origen', 'pedido_finalizado', 'insumo_nombre', insumo_nombre)
  )
  returning * into v_movimiento;

  update public.inventario_insumos
  set stock_actual = stock_actual - cantidad,
      actualizado_en = now()
  where id = v_insumo.id;

  return jsonb_build_object(
    'estado', 'registrado',
    'movimiento_id', v_movimiento.id,
    'insumo_id', v_insumo.id,
    'insumo', v_insumo.nombre,
    'cantidad', cantidad,
    'regla', regla_codigo
  );
end;
$$;

grant execute on function public.registrar_salida_inventario_pedido(uuid, text, numeric, text, text, text) to authenticated;
notify pgrst, 'reload schema';
