-- Fase 29B - Cartera automática para pedidos con forma de pago Crédito
-- Ejecutar después de la Fase 29A.

create table if not exists public.cartera_movimientos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  cliente_credito_id uuid references public.clientes_credito(id) on delete set null,
  pedido_id text,
  numero_pedido bigint,
  cliente_nombre text not null,
  tipo_movimiento text not null default 'pedido_credito',
  concepto text,
  valor numeric(14,2) not null default 0,
  saldo_movimiento numeric(14,2) not null default 0,
  estado text not null default 'pendiente',
  fecha_movimiento timestamptz not null default now(),
  observaciones text
);

create unique index if not exists cartera_movimientos_pedido_credito_uidx
  on public.cartera_movimientos (pedido_id, tipo_movimiento)
  where pedido_id is not null and tipo_movimiento = 'pedido_credito';

create index if not exists cartera_movimientos_cliente_idx
  on public.cartera_movimientos (cliente_credito_id, estado, fecha_movimiento desc);

create index if not exists cartera_movimientos_estado_idx
  on public.cartera_movimientos (estado, fecha_movimiento desc);

alter table public.cartera_movimientos enable row level security;

drop policy if exists "cartera_movimientos_select_authenticated" on public.cartera_movimientos;
create policy "cartera_movimientos_select_authenticated"
  on public.cartera_movimientos for select
  to authenticated
  using (true);

drop policy if exists "cartera_movimientos_insert_authenticated" on public.cartera_movimientos;
create policy "cartera_movimientos_insert_authenticated"
  on public.cartera_movimientos for insert
  to authenticated
  with check (true);

drop policy if exists "cartera_movimientos_update_authenticated" on public.cartera_movimientos;
create policy "cartera_movimientos_update_authenticated"
  on public.cartera_movimientos for update
  to authenticated
  using (true)
  with check (true);

grant select, insert, update on public.cartera_movimientos to authenticated;
grant select, insert, update on public.cartera_movimientos to anon;
