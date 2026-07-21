-- Fase 33 - Blindaje de Cartera
-- Ejecutar en Supabase SQL Editor después de Fase 29F y Fase 30C.
-- Objetivo: abonos transaccionales, clientes crédito únicos, métodos de pago controlados
-- y valores monetarios enteros en pesos colombianos.

create extension if not exists pgcrypto;

-- 33B. Normalización estable de nombres de clientes crédito.
create or replace function public.normalizar_nombre_credito(p_nombre text)
returns text
language sql
immutable
as $$
  select trim(
    regexp_replace(
      regexp_replace(
        translate(lower(coalesce(p_nombre, '')), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
        '[^a-z0-9]+',
        ' ',
        'g'
      ),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
$$;

alter table public.clientes_credito
  add column if not exists nombre_normalizado text;

update public.clientes_credito
set nombre_normalizado = public.normalizar_nombre_credito(nombre)
where coalesce(nombre_normalizado, '') <> public.normalizar_nombre_credito(nombre);

-- Si ya existían clientes duplicados antes de esta fase, se conserva uno como principal,
-- se mueven sus movimientos/abonos al principal y el duplicado queda inactivo.
drop table if exists pg_temp._clientes_credito_merge;
create temp table _clientes_credito_merge on commit drop as
with ranked as (
  select
    id,
    nombre,
    nombre_normalizado,
    first_value(id) over (
      partition by nombre_normalizado
      order by activo desc, creado_en asc nulls last, id
    ) as keep_id,
    row_number() over (
      partition by nombre_normalizado
      order by activo desc, creado_en asc nulls last, id
    ) as rn
  from public.clientes_credito
  where coalesce(nombre_normalizado, '') <> ''
)
select id as dup_id, keep_id, nombre_normalizado
from ranked
where rn > 1 and id <> keep_id;

update public.cartera_movimientos cm
set cliente_credito_id = m.keep_id
from _clientes_credito_merge m
where cm.cliente_credito_id = m.dup_id;

update public.cartera_abonos ca
set cliente_credito_id = m.keep_id
from _clientes_credito_merge m
where ca.cliente_credito_id = m.dup_id;

update public.clientes_credito c
set
  activo = false,
  total_pedidos = 0,
  saldo_pendiente = 0,
  nombre_normalizado = concat(c.nombre_normalizado, ' duplicado ', left(c.id::text, 8)),
  observaciones = trim(concat_ws(' ', c.observaciones, '[Fase 33] Cliente duplicado unificado automáticamente con:', k.nombre)),
  actualizado_en = now()
from _clientes_credito_merge m
join public.clientes_credito k on k.id = m.keep_id
where c.id = m.dup_id;

create unique index if not exists clientes_credito_nombre_normalizado_uidx
  on public.clientes_credito (nombre_normalizado)
  where coalesce(nombre_normalizado, '') <> '';

create or replace function public.set_nombre_normalizado_clientes_credito()
returns trigger
language plpgsql
as $$
begin
  new.nombre = trim(regexp_replace(coalesce(new.nombre, ''), '[[:space:]]+', ' ', 'g'));
  new.nombre_normalizado = public.normalizar_nombre_credito(new.nombre);
  return new;
end;
$$;

drop trigger if exists clientes_credito_set_nombre_normalizado on public.clientes_credito;
create trigger clientes_credito_set_nombre_normalizado
before insert or update of nombre on public.clientes_credito
for each row execute function public.set_nombre_normalizado_clientes_credito();

-- 33C. Métodos de pago controlados para cartera.
create or replace function public.normalizar_metodo_pago_cartera(p_metodo text, p_permitir_credito boolean default true)
returns text
language plpgsql
immutable
as $$
declare
  v_texto text := public.normalizar_nombre_credito(p_metodo);
begin
  if v_texto = '' then
    return 'Efectivo';
  elsif v_texto like '%efect%' then
    return 'Efectivo';
  elsif v_texto like '%bancolombia%' then
    return 'Bancolombia';
  elsif v_texto like '%trans%' or v_texto = 'banco' then
    return 'Transferencia';
  elsif v_texto like '%data%' or v_texto like '%tarjeta%' then
    return 'Datafono';
  elsif v_texto like '%nequi%' then
    return 'Nequi';
  elsif p_permitir_credito and (v_texto like '%credito%' or v_texto like '%fiado%' or v_texto like '%pendiente%') then
    return 'Crédito';
  elsif v_texto like '%otro%' then
    return 'Otro';
  end if;

  return null;
end;
$$;

-- 33D. Valores monetarios enteros. Se redondean saldos actuales y se obliga a que
-- nuevos registros entren como pesos enteros.
update public.clientes_credito
set saldo_pendiente = round(coalesce(saldo_pendiente, 0));

update public.cartera_movimientos
set
  valor = round(coalesce(valor, 0)),
  saldo_movimiento = round(coalesce(saldo_movimiento, 0));

update public.cartera_abonos
set
  valor_abono = round(coalesce(valor_abono, 0)),
  saldo_anterior = round(coalesce(saldo_anterior, 0)),
  saldo_nuevo = round(coalesce(saldo_nuevo, 0));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clientes_credito_saldo_entero_chk') then
    alter table public.clientes_credito
      add constraint clientes_credito_saldo_entero_chk
      check (saldo_pendiente = round(saldo_pendiente)) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cartera_movimientos_valores_enteros_chk') then
    alter table public.cartera_movimientos
      add constraint cartera_movimientos_valores_enteros_chk
      check (valor = round(valor) and saldo_movimiento = round(saldo_movimiento)) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cartera_abonos_valores_enteros_chk') then
    alter table public.cartera_abonos
      add constraint cartera_abonos_valores_enteros_chk
      check (valor_abono = round(valor_abono) and saldo_anterior = round(saldo_anterior) and saldo_nuevo = round(saldo_nuevo)) not valid;
  end if;
end $$;

-- 33A. Abonos seguros con RPC transaccional.
create or replace function public.registrar_abono_cliente_credito(
  p_cliente_id uuid,
  p_valor_abono numeric,
  p_metodo_pago text default 'Efectivo',
  p_observacion text default '',
  p_fecha_abono timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente public.clientes_credito%rowtype;
  v_mov public.cartera_movimientos%rowtype;
  v_abono public.cartera_abonos%rowtype;
  v_valor integer := round(coalesce(p_valor_abono, 0))::integer;
  v_restante integer;
  v_saldo_total integer;
  v_saldo_anterior integer;
  v_valor_aplicado integer;
  v_saldo_nuevo integer;
  v_estado_nuevo text;
  v_metodo text;
  v_abonos jsonb := '[]'::jsonb;
begin
  if p_cliente_id is null then
    raise exception 'Cliente crédito no válido.';
  end if;

  select * into v_cliente
  from public.clientes_credito
  where id = p_cliente_id
  for update;

  if not found then
    raise exception 'Cliente crédito no encontrado.';
  end if;

  if v_valor <= 0 then
    raise exception 'El valor del abono debe ser mayor a cero.';
  end if;

  v_metodo := public.normalizar_metodo_pago_cartera(p_metodo_pago, false);
  if v_metodo is null then
    raise exception 'Método de pago no permitido para abonos de cartera: %', coalesce(p_metodo_pago, '');
  end if;

  select coalesce(sum(round(coalesce(saldo_movimiento, valor, 0))::integer), 0)
    into v_saldo_total
  from public.cartera_movimientos
  where cliente_credito_id = p_cliente_id
    and tipo_movimiento = 'pedido_credito'
    and lower(coalesce(estado, 'pendiente')) not in ('pagado', 'anulado')
    and round(coalesce(saldo_movimiento, valor, 0)) > 0;

  if v_saldo_total <= 0 then
    raise exception 'Este cliente no tiene cartera pendiente para abonar.';
  end if;

  if v_valor > v_saldo_total then
    raise exception 'El abono no puede ser mayor al saldo pendiente del cliente.';
  end if;

  v_restante := v_valor;

  for v_mov in
    select *
    from public.cartera_movimientos
    where cliente_credito_id = p_cliente_id
      and tipo_movimiento = 'pedido_credito'
      and lower(coalesce(estado, 'pendiente')) not in ('pagado', 'anulado')
      and round(coalesce(saldo_movimiento, valor, 0)) > 0
    order by fecha_movimiento asc, created_at asc, id asc
    for update
  loop
    exit when v_restante <= 0;

    v_saldo_anterior := round(coalesce(v_mov.saldo_movimiento, v_mov.valor, 0))::integer;
    v_valor_aplicado := least(v_restante, v_saldo_anterior);
    v_saldo_nuevo := greatest(0, v_saldo_anterior - v_valor_aplicado);
    v_estado_nuevo := case when v_saldo_nuevo <= 0 then 'pagado' else 'parcial' end;

    update public.cartera_movimientos
    set saldo_movimiento = v_saldo_nuevo,
        estado = v_estado_nuevo
    where id = v_mov.id;

    insert into public.cartera_abonos (
      cliente_credito_id,
      cartera_movimiento_id,
      pedido_id,
      numero_pedido,
      cliente_nombre,
      valor_abono,
      metodo_pago,
      observacion,
      fecha_abono,
      saldo_anterior,
      saldo_nuevo
    ) values (
      p_cliente_id,
      v_mov.id,
      v_mov.pedido_id,
      v_mov.numero_pedido,
      v_mov.cliente_nombre,
      v_valor_aplicado,
      v_metodo,
      trim(coalesce(p_observacion, '')),
      coalesce(p_fecha_abono, now()),
      v_saldo_anterior,
      v_saldo_nuevo
    ) returning * into v_abono;

    v_abonos := v_abonos || to_jsonb(v_abono);
    v_restante := v_restante - v_valor_aplicado;
  end loop;

  update public.clientes_credito c
  set
    total_pedidos = coalesce(resumen.total_pedidos, 0),
    saldo_pendiente = coalesce(resumen.saldo_pendiente, 0),
    fecha_ultimo_pedido = resumen.fecha_ultimo_pedido,
    actualizado_en = now()
  from (
    select
      count(*) filter (where lower(coalesce(estado, 'pendiente')) <> 'anulado')::integer as total_pedidos,
      coalesce(sum(
        case
          when lower(coalesce(estado, 'pendiente')) in ('pagado', 'anulado') then 0
          else round(coalesce(saldo_movimiento, valor, 0))
        end
      ), 0) as saldo_pendiente,
      max(fecha_movimiento) filter (where lower(coalesce(estado, 'pendiente')) <> 'anulado') as fecha_ultimo_pedido
    from public.cartera_movimientos
    where cliente_credito_id = p_cliente_id
      and tipo_movimiento = 'pedido_credito'
  ) resumen
  where c.id = p_cliente_id
  returning c.* into v_cliente;

  return jsonb_build_object(
    'valor_abono', v_valor,
    'abonos', v_abonos,
    'saldo_anterior_total', v_saldo_total,
    'saldo_nuevo_total', greatest(0, v_saldo_total - v_valor),
    'cliente', to_jsonb(v_cliente)
  );
end;
$$;

revoke all on function public.registrar_abono_cliente_credito(uuid, numeric, text, text, timestamptz) from public;
grant execute on function public.registrar_abono_cliente_credito(uuid, numeric, text, text, timestamptz) to anon, authenticated;

grant execute on function public.normalizar_nombre_credito(text) to anon, authenticated;
grant execute on function public.normalizar_metodo_pago_cartera(text, boolean) to anon, authenticated;
