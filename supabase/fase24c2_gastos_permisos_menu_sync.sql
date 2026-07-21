-- Fase 24C2 - Permisos Gastos y sincronización del menú diario
-- Ejecutar en Supabase SQL Editor después de subir esta versión.
-- Objetivo:
-- 1) Permitir que cualquier usuario autenticado/registrado pueda guardar gastos.
-- 2) Mantener el informe, edición y eliminación de gastos restringidos a administradores.
-- 3) Asegurar grants para Data API/PostgREST y refrescar caché del esquema.

alter table if exists public.gastos_diarios enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.gastos_diarios to authenticated;

-- Rehacer políticas para evitar que una política antigua bloquee el insert.
drop policy if exists gastos_diarios_insert_authenticated on public.gastos_diarios;
drop policy if exists gastos_diarios_select_authenticated on public.gastos_diarios;
drop policy if exists gastos_diarios_update_authenticated on public.gastos_diarios;
drop policy if exists gastos_diarios_delete_authenticated on public.gastos_diarios;

create policy gastos_diarios_insert_authenticated
on public.gastos_diarios
for insert
to authenticated
with check (true);

create policy gastos_diarios_select_admin
on public.gastos_diarios
for select
to authenticated
using (
  exists (
    select 1
    from public.usuarios_roles ur
    where lower(ur.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and lower(ur.rol) = 'admin'
  )
);

create policy gastos_diarios_update_admin
on public.gastos_diarios
for update
to authenticated
using (
  exists (
    select 1
    from public.usuarios_roles ur
    where lower(ur.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and lower(ur.rol) = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.usuarios_roles ur
    where lower(ur.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and lower(ur.rol) = 'admin'
  )
);

create policy gastos_diarios_delete_admin
on public.gastos_diarios
for delete
to authenticated
using (
  exists (
    select 1
    from public.usuarios_roles ur
    where lower(ur.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and lower(ur.rol) = 'admin'
  )
);

-- Menú diario: asegurar que la app pueda leer el menú activo publicado.
grant select on public.menu_diario to anon, authenticated;
grant insert, update on public.menu_diario to authenticated;

notify pgrst, 'reload schema';
