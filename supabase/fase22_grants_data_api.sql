-- Fase 22S - Grants explícitos para Supabase Data API
-- Ejecutar en Supabase SQL Editor.
-- Contexto: desde 2026 Supabase exige GRANT explícito para que tablas nuevas
-- del schema public puedan usarse desde PostgREST, GraphQL y supabase-js.
-- Nota: GRANT habilita acceso al API; las políticas RLS siguen definiendo qué filas
-- puede leer, crear, editar o eliminar cada rol.

grant usage on schema public to anon, authenticated;

do $$
declare
  tabla text;
  tablas_anon text[] := array[
    'pedidos',
    'auditoria_pedidos',
    'menu_diario',
    'catalogo_productos',
    'catalogo_productos_categorias',
    'catalogo_insumos',
    'catalogo_insumos_categorias',
    'gastos_diarios'
  ];
  tablas_solo_authenticated text[] := array[
    'usuarios_roles'
  ];
begin
  foreach tabla in array tablas_anon loop
    if to_regclass('public.' || tabla) is not null then
      execute format('grant select, insert, update, delete on table public.%I to anon, authenticated', tabla);
    end if;
  end loop;

  foreach tabla in array tablas_solo_authenticated loop
    if to_regclass('public.' || tabla) is not null then
      execute format('grant select on table public.%I to authenticated', tabla);
    end if;
  end loop;
end $$;
