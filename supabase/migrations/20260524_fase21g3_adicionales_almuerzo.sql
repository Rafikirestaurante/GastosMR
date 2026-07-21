-- FASE 21G3 — Adicionales de almuerzo en catálogo de productos
-- Ejecutar en Supabase después del SQL de Fase 21G.

insert into public.catalogo_productos_categorias (linea, nombre, orden, activa)
values ('Restaurante', 'Adicionales almuerzo', 11, true)
on conflict (lower(linea), lower(nombre))
do update set orden = excluded.orden, activa = excluded.activa;

insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Restaurante', 'Adicionales almuerzo', 'Papas Fritas', 5000, true, 220
from public.catalogo_productos_categorias c
where lower(c.linea)=lower('Restaurante') and lower(c.nombre)=lower('Adicionales almuerzo')
on conflict (lower(linea), lower(categoria), lower(nombre))
do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;

insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, 'Restaurante', 'Adicionales almuerzo', 'Porción de Pechuga o cerdo', 7000, true, 221
from public.catalogo_productos_categorias c
where lower(c.linea)=lower('Restaurante') and lower(c.nombre)=lower('Adicionales almuerzo')
on conflict (lower(linea), lower(categoria), lower(nombre))
do update set categoria_id = excluded.categoria_id, precio = excluded.precio, activo = excluded.activo, orden = excluded.orden;
