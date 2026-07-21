-- Fase 27F — Ajustes financieros en Informe Caja
-- Agrega un campo JSON para guardar ajustes manuales del informe:
-- gastosRafa y cuentasPorCobrar.

alter table public.caja_arqueos
add column if not exists ajustes_data jsonb default '{}'::jsonb;

comment on column public.caja_arqueos.ajustes_data is
'Ajustes manuales del Informe Caja: gastosRafa y cuentasPorCobrar.';

grant select, insert, update on public.caja_arqueos to authenticated;
