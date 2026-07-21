-- Fase 29A - Directorio de Clientes Crédito
-- Ejecutar en Supabase SQL Editor después de la Fase 28B.
-- Amplía clientes_credito para usarlo como directorio administrativo en Gerencia > Cartera.

alter table public.clientes_credito
  add column if not exists observaciones text,
  add column if not exists fecha_ultimo_pedido timestamptz,
  add column if not exists total_pedidos integer not null default 0,
  add column if not exists saldo_pendiente numeric(12,2) not null default 0;

-- Compatibilidad con el campo anterior "notas" de Fase 28B, sin fallar si la columna no existe.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clientes_credito'
      and column_name = 'notas'
  ) then
    execute 'update public.clientes_credito set observaciones = coalesce(observaciones, notas) where observaciones is null';
  end if;
end $$;

create index if not exists clientes_credito_saldo_pendiente_idx
  on public.clientes_credito (saldo_pendiente);

create index if not exists clientes_credito_fecha_ultimo_pedido_idx
  on public.clientes_credito (fecha_ultimo_pedido desc);

create index if not exists clientes_credito_telefono_idx
  on public.clientes_credito (telefono);

grant select, insert, update on public.clientes_credito to authenticated;
