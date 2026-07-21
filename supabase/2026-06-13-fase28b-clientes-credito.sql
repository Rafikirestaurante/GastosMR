-- Fase 28B.1 - Clientes de Crédito
-- Ejecutar en Supabase SQL Editor antes de usar Crédito en Panel Mesas.
-- Esta tabla centraliza los nombres de clientes autorizados para crédito,
-- evitando variantes como "Sra Inés", "Inés Gaviria", "Dra Laura", etc.

create extension if not exists pgcrypto;

create table if not exists public.clientes_credito (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  alias text[] not null default '{}',
  telefono text,
  notas text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index if not exists clientes_credito_nombre_lower_uidx
  on public.clientes_credito (lower(nombre));

create index if not exists clientes_credito_activo_nombre_idx
  on public.clientes_credito (activo, nombre);

alter table public.clientes_credito enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.clientes_credito to authenticated;

drop policy if exists "clientes_credito_select_authenticated" on public.clientes_credito;
drop policy if exists "clientes_credito_insert_authenticated" on public.clientes_credito;
drop policy if exists "clientes_credito_update_authenticated" on public.clientes_credito;

create policy "clientes_credito_select_authenticated"
  on public.clientes_credito
  for select
  to authenticated
  using (true);

create policy "clientes_credito_insert_authenticated"
  on public.clientes_credito
  for insert
  to authenticated
  with check (auth.role() = 'authenticated');

create policy "clientes_credito_update_authenticated"
  on public.clientes_credito
  for update
  to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create or replace function public.set_actualizado_en_clientes_credito()
returns trigger as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists clientes_credito_set_actualizado_en on public.clientes_credito;
create trigger clientes_credito_set_actualizado_en
before update on public.clientes_credito
for each row execute function public.set_actualizado_en_clientes_credito();

insert into public.clientes_credito (nombre, alias)
values
  ('Sra. Inés', array['Sra Ines', 'Ines', 'Inés Gaviria']),
  ('Dra. Laura', array['Laura', 'Dra Laura'])
on conflict (lower(nombre)) do nothing;
