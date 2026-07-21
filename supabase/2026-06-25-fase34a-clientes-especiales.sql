-- Fase 34A - Base SQL Clientes Especiales
-- Ejecutar en Supabase SQL Editor antes de activar códigos especiales en /cliente.
-- Esta subfase NO modifica /cliente ni /mesas. Solo crea la base segura para futuros códigos VIP.
--
-- Objetivo operativo futuro:
-- 1. Validar un código especial desde /cliente.
-- 2. Mostrar mensaje de bienvenida.
-- 3. Precargar nombre, teléfono y ubicación.
-- 4. Permitir pedir Cafetería desde /cliente.
-- 5. Eliminar restricción de acompañantes para clientes especiales.
-- 6. Dejar reglas flexibles para promociones, regalos y descuentos posteriores.

create extension if not exists pgcrypto;

-- Normaliza códigos para evitar duplicados por mayúsculas, espacios o guiones.
-- Ejemplo: " VIP-001 " y "vip001" se guardan como el mismo código normalizado.
create or replace function public.normalizar_codigo_cliente_especial(p_codigo text)
returns text
language sql
immutable
as $$
  select upper(
    regexp_replace(
      coalesce(p_codigo, ''),
      '[^a-zA-Z0-9]+',
      '',
      'g'
    )
  );
$$;

create table if not exists public.clientes_especiales (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  codigo_normalizado text,
  nombre text not null,
  telefono text,
  ubicacion text,
  activo boolean not null default true,
  mensaje_bienvenida text,
  sin_restriccion_acompanantes boolean not null default true,
  habilita_cafeteria boolean not null default true,
  permite_modificar_datos boolean not null default true,
  reglas_json jsonb not null default '{}'::jsonb,
  observaciones text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint clientes_especiales_codigo_chk check (length(public.normalizar_codigo_cliente_especial(codigo)) >= 3),
  constraint clientes_especiales_nombre_chk check (length(trim(nombre)) >= 2)
);

-- Compatibilidad si la tabla existía en una prueba previa incompleta.
alter table public.clientes_especiales
  add column if not exists codigo_normalizado text,
  add column if not exists telefono text,
  add column if not exists ubicacion text,
  add column if not exists activo boolean not null default true,
  add column if not exists mensaje_bienvenida text,
  add column if not exists sin_restriccion_acompanantes boolean not null default true,
  add column if not exists habilita_cafeteria boolean not null default true,
  add column if not exists permite_modificar_datos boolean not null default true,
  add column if not exists reglas_json jsonb not null default '{}'::jsonb,
  add column if not exists observaciones text,
  add column if not exists creado_en timestamptz not null default now(),
  add column if not exists actualizado_en timestamptz not null default now();

update public.clientes_especiales
set codigo_normalizado = public.normalizar_codigo_cliente_especial(codigo)
where coalesce(codigo_normalizado, '') <> public.normalizar_codigo_cliente_especial(codigo);

drop index if exists public.clientes_especiales_codigo_normalizado_uidx;
create unique index clientes_especiales_codigo_normalizado_uidx
  on public.clientes_especiales (codigo_normalizado);

create index if not exists clientes_especiales_activo_nombre_idx
  on public.clientes_especiales (activo, nombre);

create or replace function public.set_clientes_especiales_normalizados()
returns trigger
language plpgsql
as $$
begin
  new.codigo = upper(trim(regexp_replace(coalesce(new.codigo, ''), '[[:space:]]+', '', 'g')));
  new.codigo_normalizado = public.normalizar_codigo_cliente_especial(new.codigo);
  new.nombre = trim(regexp_replace(coalesce(new.nombre, ''), '[[:space:]]+', ' ', 'g'));
  new.telefono = nullif(trim(coalesce(new.telefono, '')), '');
  new.ubicacion = nullif(trim(regexp_replace(coalesce(new.ubicacion, ''), '[[:space:]]+', ' ', 'g')), '');
  new.mensaje_bienvenida = nullif(trim(regexp_replace(coalesce(new.mensaje_bienvenida, ''), '[[:space:]]+', ' ', 'g')), '');
  new.observaciones = nullif(trim(regexp_replace(coalesce(new.observaciones, ''), '[[:space:]]+', ' ', 'g')), '');
  new.reglas_json = coalesce(new.reglas_json, '{}'::jsonb);
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists clientes_especiales_set_normalizados on public.clientes_especiales;
create trigger clientes_especiales_set_normalizados
before insert or update on public.clientes_especiales
for each row execute function public.set_clientes_especiales_normalizados();

-- RPC segura para /cliente: permite validar un código sin exponer toda la tabla al público.
-- Devuelve solo datos necesarios para precargar el pedido y aplicar reglas permitidas.
create or replace function public.validar_cliente_especial_codigo(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text := public.normalizar_codigo_cliente_especial(p_codigo);
  v_cliente public.clientes_especiales%rowtype;
begin
  if coalesce(v_codigo, '') = '' then
    return null;
  end if;

  select * into v_cliente
  from public.clientes_especiales
  where codigo_normalizado = v_codigo
    and activo = true
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_cliente.id,
    'codigo', v_cliente.codigo,
    'nombre', v_cliente.nombre,
    'telefono', coalesce(v_cliente.telefono, ''),
    'ubicacion', coalesce(v_cliente.ubicacion, ''),
    'mensaje_bienvenida', coalesce(v_cliente.mensaje_bienvenida, concat('Bienvenido, ', v_cliente.nombre)),
    'sin_restriccion_acompanantes', coalesce(v_cliente.sin_restriccion_acompanantes, true),
    'habilita_cafeteria', coalesce(v_cliente.habilita_cafeteria, true),
    'permite_modificar_datos', coalesce(v_cliente.permite_modificar_datos, true),
    'reglas_json', coalesce(v_cliente.reglas_json, '{}'::jsonb)
  );
end;
$$;

alter table public.clientes_especiales enable row level security;

grant usage on schema public to anon, authenticated;
grant execute on function public.validar_cliente_especial_codigo(text) to anon, authenticated;
grant select, insert, update on public.clientes_especiales to authenticated;

-- No se concede SELECT directo a anon. /cliente debe usar la RPC validar_cliente_especial_codigo.
revoke all on public.clientes_especiales from anon;

drop policy if exists "clientes_especiales_select_authenticated" on public.clientes_especiales;
drop policy if exists "clientes_especiales_insert_authenticated" on public.clientes_especiales;
drop policy if exists "clientes_especiales_update_authenticated" on public.clientes_especiales;

create policy "clientes_especiales_select_authenticated"
  on public.clientes_especiales
  for select
  to authenticated
  using (true);

create policy "clientes_especiales_insert_authenticated"
  on public.clientes_especiales
  for insert
  to authenticated
  with check (auth.role() = 'authenticated');

create policy "clientes_especiales_update_authenticated"
  on public.clientes_especiales
  for update
  to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

comment on table public.clientes_especiales is 'Clientes especiales/VIP para desbloquear reglas controladas en /cliente sin afectar /mesas.';
comment on column public.clientes_especiales.reglas_json is 'Base flexible para promociones, regalos, descuentos y reglas futuras.';
comment on function public.validar_cliente_especial_codigo(text) is 'Valida un código activo desde /cliente sin exponer el listado completo de clientes especiales.';

-- Dato opcional de prueba. Cambiar o eliminar antes de producción si no se necesita.
insert into public.clientes_especiales (
  codigo,
  nombre,
  telefono,
  ubicacion,
  mensaje_bienvenida,
  observaciones,
  reglas_json
)
values (
  'RAFIKI-VIP',
  'Cliente Especial Rafiki',
  '',
  'Ubicación predeterminada',
  'Bienvenido, Cliente Especial Rafiki',
  'Registro de prueba Fase 34A. Puede editarse o desactivarse desde el panel futuro.',
  '{"promociones": false, "regalo": null, "descuento": null, "prioridad": "normal"}'::jsonb
)
on conflict (codigo_normalizado) do nothing;
