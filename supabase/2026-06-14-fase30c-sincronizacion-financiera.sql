-- Fase 30C - Sincronización financiera centralizada
-- Ejecutar después de la Fase 29F.
-- Permite que la función central de cartera pueda corregir abonos cuando:
-- 1. un pedido cambia de cliente crédito,
-- 2. se reclasifica como crédito,
-- 3. se corrigen movimientos duplicados,
-- 4. se recalculan saldos después de abonos.

alter table public.cartera_abonos enable row level security;

drop policy if exists "cartera_abonos_update_authenticated" on public.cartera_abonos;
create policy "cartera_abonos_update_authenticated"
  on public.cartera_abonos for update
  to authenticated
  using (true)
  with check (true);

grant update on public.cartera_abonos to authenticated;
grant update on public.cartera_abonos to anon;

create index if not exists cartera_movimientos_pedido_estado_idx
  on public.cartera_movimientos (pedido_id, tipo_movimiento, estado);

create index if not exists cartera_abonos_movimiento_cliente_idx
  on public.cartera_abonos (cartera_movimiento_id, cliente_credito_id);
