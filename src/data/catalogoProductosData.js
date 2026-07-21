import {
  CAFETERIA_BATIDOS_CREMOSOS_SABORES,
  CAFETERIA_BATIDOS_REFRESCANTES_SABORES,
  CAFETERIA_BEBIDAS_CALIENTES,
  CAFETERIA_DESAYUNOS,
  CAFETERIA_JUGOS_TRADICIONALES_SABORES,
  CAFETERIA_POSTRES,
  CAFETERIA_SANDWICHES
} from "./menuCafeteria";

function normalizarId(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function crearProductoCatalogo(nombre, categoria, precio = "", linea = "Cafetería", orden = 0) {
  return {
    id: `${normalizarId(linea)}-${normalizarId(categoria)}-${normalizarId(nombre)}`,
    catalogoId: null,
    linea,
    categoria,
    nombre,
    precio: precio === "" || precio == null ? "" : Number(precio),
    activo: true,
    orden,
    origenCatalogo: "local"
  };
}

export const RESTAURANTE_PLATOS_BASE = [
  "Pechuga o cerdo en salsa BBQ",
  "Pechuga o cerdo en salsa de cebolla caramelizada",
  "Pechuga o cerdo en salsa de corozo",
  "Pechuga o cerdo en salsa de durazno",
  "Pechuga o cerdo en salsa de frutos rojos",
  "Pechuga o cerdo en salsa hawaiana",
  "Pechuga o cerdo en salsa de lulo",
  "Pechuga o cerdo en salsa de mandarina",
  "Pechuga o cerdo en salsa de maracuyá",
  "Pechuga o cerdo en salsa de miel mostaza",
  "Pechuga o cerdo en salsa de naranja",
  "Pechuga o cerdo en salsa de tamarindo",
  "Pechuga o cerdo en salsa teriyaki",
  "Pechuga o cerdo en salsa de uva",
  "Pechuga o cerdo en salsa blanca con verduras",
  "Pechuga o cerdo en salsa de bisteck de maíz",
  "Pechuga o cerdo en salsa de cebolla puerro",
  "Pechuga o cerdo en salsa de champiñones",
  "Pechuga o cerdo en salsa de espinaca",
  "Pechuga o cerdo en salsa de finas hierbas",
  "Pechuga o cerdo en salsa de maíz",
  "Pechuga o cerdo en salsa de pimentón amarillo",
  "Pechuga o cerdo en salsa de pimentón rojo",
  "Pechuga o cerdo en salsa de queso",
  "Pechuga o cerdo en salsa fricasé",
  "Albóndigas de carne",
  "Albóndigas de Cerdo",
  "Arroz con pollo",
  "Arroz de cerdo",
  "Arroz trifásico",
  "Arroz de camaron",
  "Carne asada",
  "Carne Chimichurri",
  "Carne en Bistec",
  "Carne desmechada",
  "Carne en posta",
  "Carne en posta a la pimienta",
  "Carne en posta cartagenera",
  "Carne en posta guisada",
  "Carne guisada",
  "Carne molida",
  "Cerdo guisado",
  "Chuleta ahumada",
  "Chuleta de cerdo",
  "Filete de tilapia",
  "Pollo guisado",
  "Salpicón",
  "Salpicón de pescado",
  "Sobrebarriga a la criolla",
  "Pastas al pesto con crema y con pollo",
  "Pastas Boloñesa",
  "Pastas carbonara con pollo",
  "Pastas con pollo en salsa de champiñones",
  "Pastas con pollo en salsa de 4 quesos",
  "Pastas con pollo en salsa de maíz y tocineta",
  "Pastas con camaron",
  "Pastas con pollo en salsa blanca"
];

export const RESTAURANTE_SOPAS_BASE = [
  "Ajiaco",
  "Mote de queso",
  "Mondongo",
  "Costilla",
  "Gallina",
  "Paticas de cerdo con zaragozas",
  "Sancocho de pollo"
];

export const RESTAURANTE_ACOMPANANTES_BASE = [
  "Arroz de cebolla",
  "Arroz de espinaca",
  "Arroz de maíz",
  "Arroz de palito",
  "Arroz de pimentón",
  "Arroz de verduras",
  "Arroz de zanahoria",
  "Arroz de Ahuyama",
  "Arroz de lentejas",
  "Arroz de frijol",
  "Bastones de plátano verde",
  "Zaragozas guisadas",
  "Lentejas guisadas",
  "Patacón",
  "Puré de papa",
  "Tajadas amarillas",
  "Croquetas de Lentejas",
  "Croquetas de Yuca",
  "Croquetas de Garbanzos",
  "Ensalada cocida",
  "Ensalada de remolacha",
  "Ensalada verde",
  "Tabule"
];

export const PRODUCTOS_CATALOGO_FALLBACK = [
  crearProductoCatalogo("Parfait 12 oz", "Parfait", 12500, "Cafetería", 1),
  crearProductoCatalogo("Parfait 16 oz", "Parfait", 16000, "Cafetería", 2),
  crearProductoCatalogo("Parfait 22 oz", "Parfait", 19000, "Cafetería", 3),
  ...CAFETERIA_DESAYUNOS.map((p, index) => crearProductoCatalogo(p.nombre, "Desayunos", p.precio, "Cafetería", 10 + index)),
  ...CAFETERIA_SANDWICHES.map((p, index) => crearProductoCatalogo(p.nombre, "Sándwiches y fritos", p.precio, "Cafetería", 30 + index)),
  ...CAFETERIA_POSTRES.map((p, index) => crearProductoCatalogo(p.nombre, "Postres y ensaladas", p.precio, "Cafetería", 50 + index)),
  ...CAFETERIA_BEBIDAS_CALIENTES.map((p, index) => crearProductoCatalogo(p.nombre, "Bebidas", p.precio, "Cafetería", 70 + index)),
  ...CAFETERIA_BATIDOS_CREMOSOS_SABORES.map((nombre, index) => crearProductoCatalogo(nombre, "Batidos cremosos", "", "Cafetería", 90 + index)),
  ...CAFETERIA_BATIDOS_REFRESCANTES_SABORES.map((nombre, index) => crearProductoCatalogo(nombre, "Batidos refrescantes", "", "Cafetería", 120 + index)),
  ...CAFETERIA_JUGOS_TRADICIONALES_SABORES.map((nombre, index) => crearProductoCatalogo(nombre, "Jugos tradicionales", "", "Cafetería", 150 + index)),
  crearProductoCatalogo("Pechuga asada sin salsa", "Platos", 16000, "Restaurante", 200),
  crearProductoCatalogo("Cerdo asado sin salsa", "Platos", 16000, "Restaurante", 201),
  crearProductoCatalogo("Sopas medianas sin arroz", "Sopas", 7000, "Restaurante", 210),
  crearProductoCatalogo("Sopas medianas con arroz", "Sopas", 9000, "Restaurante", 211),
  crearProductoCatalogo("Sancocho de pollo con arroz", "Sopas", 15000, "Restaurante", 212),
  ...RESTAURANTE_PLATOS_BASE.map((nombre, index) => crearProductoCatalogo(nombre, "Platos", "", "Restaurante", 300 + index)),
  ...RESTAURANTE_SOPAS_BASE.map((nombre, index) => crearProductoCatalogo(nombre, "Sopas", "", "Restaurante", 400 + index)),
  ...RESTAURANTE_ACOMPANANTES_BASE.map((nombre, index) => crearProductoCatalogo(nombre, "Acompañantes", "", "Restaurante", 500 + index)),
  crearProductoCatalogo("Papas Fritas", "Adicionales almuerzo", 5000, "Restaurante", 600),
  crearProductoCatalogo("Porción de Pechuga o cerdo", "Adicionales almuerzo", 7000, "Restaurante", 601)
];
