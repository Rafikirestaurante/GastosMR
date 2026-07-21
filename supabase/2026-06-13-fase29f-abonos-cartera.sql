-- Fase 29F - Abonos y seguimiento de pagos de cartera
-- Ejecutar después de la Fase 29E.

create table if not exists public.cartera_abonos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  cliente_credito_id uuid references public.clientes_credito(id) on delete set null,
  cartera_movimiento_id uuid references public.cartera_movimientos(id) on delete set null,
  pedido_id text,
  numero_pedido bigint,
  cliente_nombre text,
  valor_abono numeric(14,2) not null default 0,
  metodo_pago text not null default 'Efectivo',
  observacion text,
  fecha_abono timestamptz not null default now(),
  saldo_anterior numeric(14,2) not null default 0,
  saldo_nuevo numeric(14,2) not null default 0
);

create index if not exists cartera_abonos_cliente_idx
  on public.cartera_abonos (cliente_credito_id, fecha_abono desc);

create index if not exists cartera_abonos_movimiento_idx
  on public.cartera_abonos (cartera_movimiento_id, fecha_abono desc);

create index if not exists cartera_abonos_pedido_idx
  on public.cartera_abonos (pedido_id, fecha_abono desc);

alter table public.cartera_abonos enable row level security;

drop policy if exists "cartera_abonos_select_authenticated" on public.cartera_abonos;
create policy "cartera_abonos_select_authenticated"
  on public.cartera_abonos for select
  to authenticated
  using (true);

drop policy if exists "cartera_abonos_insert_authenticated" on public.cartera_abonos;
create policy "cartera_abonos_insert_authenticated"
  on public.cartera_abonos for insert
  to authenticated
  with check (true);

grant select, insert on public.cartera_abonos to authenticated;
grant select, insert on public.cartera_abonos to anon;

-- Asegura que los estados usados por la Fase 29F queden documentados:
-- cartera_movimientos.estado: pendiente | parcial | pagado | anulado
-- cartera_movimientos.saldo_movimiento se reduce con cada abono.
-- clientes_credito.saldo_pendiente se recalcula después de registrar abonos.
