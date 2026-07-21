-- Fase 22P - Gastos Diarios
-- Ejecutar en Supabase SQL Editor antes de usar la pestaña Admin > Gastos Diarios.

create extension if not exists pgcrypto;

create table if not exists public.gastos_diarios (
  id uuid primary key default gen_random_uuid(),
  numero_factura text,
  fecha date not null default current_date,
  proveedor text not null,
  articulos text,
  valor numeric(12,2) not null default 0,
  categoria text not null default '',
  metodo_pago text not null default '',
  observacion text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);


-- Ajuste Fase 22Q1: categoría y método de pago vacíos por defecto.
alter table if exists public.gastos_diarios alter column categoria set default '';
alter table if exists public.gastos_diarios alter column metodo_pago set default '';

create index if not exists gastos_diarios_fecha_idx on public.gastos_diarios (fecha desc);
create index if not exists gastos_diarios_proveedor_idx on public.gastos_diarios (proveedor);
create index if not exists gastos_diarios_categoria_idx on public.gastos_diarios (categoria);

alter table public.gastos_diarios enable row level security;

-- Políticas: cualquier usuario autenticado del panel puede registrar; solo rol admin en usuarios_roles puede consultar, editar o eliminar el informe.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gastos_diarios' and policyname = 'gastos_diarios_select_authenticated'
  ) then
    create policy gastos_diarios_select_authenticated
    on public.gastos_diarios for select
    to authenticated
    using (exists (select 1 from public.usuarios_roles ur where lower(ur.email) = lower(coalesce(auth.jwt() ->> 'email', '')) and lower(ur.rol) = 'admin'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gastos_diarios' and policyname = 'gastos_diarios_insert_authenticated'
  ) then
    create policy gastos_diarios_insert_authenticated
    on public.gastos_diarios for insert
    to authenticated
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gastos_diarios' and policyname = 'gastos_diarios_update_authenticated'
  ) then
    create policy gastos_diarios_update_authenticated
    on public.gastos_diarios for update
    to authenticated
    using (exists (select 1 from public.usuarios_roles ur where lower(ur.email) = lower(coalesce(auth.jwt() ->> 'email', '')) and lower(ur.rol) = 'admin'))
    with check (exists (select 1 from public.usuarios_roles ur where lower(ur.email) = lower(coalesce(auth.jwt() ->> 'email', '')) and lower(ur.rol) = 'admin'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gastos_diarios' and policyname = 'gastos_diarios_delete_authenticated'
  ) then
    create policy gastos_diarios_delete_authenticated
    on public.gastos_diarios for delete
    to authenticated
    using (exists (select 1 from public.usuarios_roles ur where lower(ur.email) = lower(coalesce(auth.jwt() ->> 'email', '')) and lower(ur.rol) = 'admin'));
  end if;
end $$;

create or replace function public.set_actualizado_en_gastos_diarios()
returns trigger as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists gastos_diarios_set_actualizado_en on public.gastos_diarios;
create trigger gastos_diarios_set_actualizado_en
before update on public.gastos_diarios
for each row execute function public.set_actualizado_en_gastos_diarios();
