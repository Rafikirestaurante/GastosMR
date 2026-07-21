-- FASE 21H — Catálogo restaurante separado en Supabase
-- Ejecutar después de 21G y 21G3.

insert into public.catalogo_productos_categorias (linea, nombre, orden, activa) values
  ('Restaurante', 'Platos', 1, true),
  ('Restaurante', 'Sopas', 2, true),
  ('Restaurante', 'Acompañantes', 3, true)
on conflict (lower(linea), lower(nombre))
do update set orden = excluded.orden, activa = excluded.activa;

-- Platos
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, v.linea, v.categoria, v.nombre, v.precio, true, v.orden
from (values
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa BBQ', null::numeric, 300),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa de cebolla caramelizada', null::numeric, 301),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa de corozo', null::numeric, 302),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa de durazno', null::numeric, 303),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa de frutos rojos', null::numeric, 304),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa hawaiana', null::numeric, 305),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa de lulo', null::numeric, 306),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa de mandarina', null::numeric, 307),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa de maracuyá', null::numeric, 308),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa de miel mostaza', null::numeric, 309),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa de naranja', null::numeric, 310),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa de tamarindo', null::numeric, 311),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa teriyaki', null::numeric, 312),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa de uva', null::numeric, 313),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa blanca con verduras', null::numeric, 314),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa de bisteck de maíz', null::numeric, 315),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa de cebolla puerro', null::numeric, 316),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa de champiñones', null::numeric, 317),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa de espinaca', null::numeric, 318),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa de finas hierbas', null::numeric, 319),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa de maíz', null::numeric, 320),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa de pimentón amarillo', null::numeric, 321),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa de pimentón rojo', null::numeric, 322),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa de queso', null::numeric, 323),
  ('Restaurante', 'Platos', 'Pechuga o cerdo en salsa fricasé', null::numeric, 324),
  ('Restaurante', 'Platos', 'Albóndigas de carne', null::numeric, 325),
  ('Restaurante', 'Platos', 'Albóndigas de Cerdo', null::numeric, 326),
  ('Restaurante', 'Platos', 'Arroz con pollo', null::numeric, 327),
  ('Restaurante', 'Platos', 'Arroz de cerdo', null::numeric, 328),
  ('Restaurante', 'Platos', 'Arroz trifásico', null::numeric, 329),
  ('Restaurante', 'Platos', 'Arroz de camaron', null::numeric, 330),
  ('Restaurante', 'Platos', 'Carne asada', null::numeric, 331),
  ('Restaurante', 'Platos', 'Carne Chimichurri', null::numeric, 332),
  ('Restaurante', 'Platos', 'Carne en Bistec', null::numeric, 333),
  ('Restaurante', 'Platos', 'Carne desmechada', null::numeric, 334),
  ('Restaurante', 'Platos', 'Carne en posta', null::numeric, 335),
  ('Restaurante', 'Platos', 'Carne en posta a la pimienta', null::numeric, 336),
  ('Restaurante', 'Platos', 'Carne en posta cartagenera', null::numeric, 337),
  ('Restaurante', 'Platos', 'Carne en posta guisada', null::numeric, 338),
  ('Restaurante', 'Platos', 'Carne guisada', null::numeric, 339),
  ('Restaurante', 'Platos', 'Carne molida', null::numeric, 340),
  ('Restaurante', 'Platos', 'Cerdo guisado', null::numeric, 341),
  ('Restaurante', 'Platos', 'Chuleta ahumada', null::numeric, 342),
  ('Restaurante', 'Platos', 'Chuleta de cerdo', null::numeric, 343),
  ('Restaurante', 'Platos', 'Filete de tilapia', null::numeric, 344),
  ('Restaurante', 'Platos', 'Pollo guisado', null::numeric, 345),
  ('Restaurante', 'Platos', 'Salpicón', null::numeric, 346),
  ('Restaurante', 'Platos', 'Salpicón de pescado', null::numeric, 347),
  ('Restaurante', 'Platos', 'Sobrebarriga a la criolla', null::numeric, 348),
  ('Restaurante', 'Platos', 'Pastas al pesto con crema y con pollo', null::numeric, 349),
  ('Restaurante', 'Platos', 'Pastas Boloñesa', null::numeric, 350),
  ('Restaurante', 'Platos', 'Pastas carbonara con pollo', null::numeric, 351),
  ('Restaurante', 'Platos', 'Pastas con pollo en salsa de champiñones', null::numeric, 352),
  ('Restaurante', 'Platos', 'Pastas con pollo en salsa de 4 quesos', null::numeric, 353),
  ('Restaurante', 'Platos', 'Pastas con pollo en salsa de maíz y tocineta', null::numeric, 354),
  ('Restaurante', 'Platos', 'Pastas con camaron', null::numeric, 355),
  ('Restaurante', 'Platos', 'Pastas con pollo en salsa blanca', null::numeric, 356)
) as v(linea, categoria, nombre, precio, orden)
join public.catalogo_productos_categorias c on lower(c.linea)=lower(v.linea) and lower(c.nombre)=lower(v.categoria)
on conflict (lower(linea), lower(categoria), lower(nombre))
do update set categoria_id = excluded.categoria_id, precio = coalesce(public.catalogo_productos.precio, excluded.precio), activo = true, orden = excluded.orden;

-- Sopas
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, v.linea, v.categoria, v.nombre, v.precio, true, v.orden
from (values
  ('Restaurante', 'Sopas', 'Ajiaco', null::numeric, 400),
  ('Restaurante', 'Sopas', 'Mote de queso', null::numeric, 401),
  ('Restaurante', 'Sopas', 'Mondongo', null::numeric, 402),
  ('Restaurante', 'Sopas', 'Costilla', null::numeric, 403),
  ('Restaurante', 'Sopas', 'Gallina', null::numeric, 404),
  ('Restaurante', 'Sopas', 'Paticas de cerdo con zaragozas', null::numeric, 405),
  ('Restaurante', 'Sopas', 'Sancocho de pollo', null::numeric, 406)
) as v(linea, categoria, nombre, precio, orden)
join public.catalogo_productos_categorias c on lower(c.linea)=lower(v.linea) and lower(c.nombre)=lower(v.categoria)
on conflict (lower(linea), lower(categoria), lower(nombre))
do update set categoria_id = excluded.categoria_id, precio = coalesce(public.catalogo_productos.precio, excluded.precio), activo = true, orden = excluded.orden;

-- Acompañantes
insert into public.catalogo_productos (categoria_id, linea, categoria, nombre, precio, activo, orden)
select c.id, v.linea, v.categoria, v.nombre, v.precio, true, v.orden
from (values
  ('Restaurante', 'Acompañantes', 'Arroz de cebolla', null::numeric, 500),
  ('Restaurante', 'Acompañantes', 'Arroz de espinaca', null::numeric, 501),
  ('Restaurante', 'Acompañantes', 'Arroz de maíz', null::numeric, 502),
  ('Restaurante', 'Acompañantes', 'Arroz de palito', null::numeric, 503),
  ('Restaurante', 'Acompañantes', 'Arroz de pimentón', null::numeric, 504),
  ('Restaurante', 'Acompañantes', 'Arroz de verduras', null::numeric, 505),
  ('Restaurante', 'Acompañantes', 'Arroz de zanahoria', null::numeric, 506),
  ('Restaurante', 'Acompañantes', 'Arroz de Ahuyama', null::numeric, 507),
  ('Restaurante', 'Acompañantes', 'Arroz de lentejas', null::numeric, 508),
  ('Restaurante', 'Acompañantes', 'Arroz de frijol', null::numeric, 509),
  ('Restaurante', 'Acompañantes', 'Bastones de plátano verde', null::numeric, 510),
  ('Restaurante', 'Acompañantes', 'Zaragozas guisadas', null::numeric, 511),
  ('Restaurante', 'Acompañantes', 'Lentejas guisadas', null::numeric, 512),
  ('Restaurante', 'Acompañantes', 'Patacón', null::numeric, 513),
  ('Restaurante', 'Acompañantes', 'Puré de papa', null::numeric, 514),
  ('Restaurante', 'Acompañantes', 'Tajadas amarillas', null::numeric, 515),
  ('Restaurante', 'Acompañantes', 'Croquetas de Lentejas', null::numeric, 516),
  ('Restaurante', 'Acompañantes', 'Croquetas de Yuca', null::numeric, 517),
  ('Restaurante', 'Acompañantes', 'Croquetas de Garbanzos', null::numeric, 518),
  ('Restaurante', 'Acompañantes', 'Ensalada cocida', null::numeric, 519),
  ('Restaurante', 'Acompañantes', 'Ensalada de remolacha', null::numeric, 520),
  ('Restaurante', 'Acompañantes', 'Ensalada verde', null::numeric, 521),
  ('Restaurante', 'Acompañantes', 'Tabule', null::numeric, 522)
) as v(linea, categoria, nombre, precio, orden)
join public.catalogo_productos_categorias c on lower(c.linea)=lower(v.linea) and lower(c.nombre)=lower(v.categoria)
on conflict (lower(linea), lower(categoria), lower(nombre))
do update set categoria_id = excluded.categoria_id, precio = coalesce(public.catalogo_productos.precio, excluded.precio), activo = true, orden = excluded.orden;
