import { supabase } from "../supabaseClient";
import { describirErrorSupabase } from "../shared/utils/supabaseErrors";

export const CATEGORIAS_GASTOS_FALLBACK = ["Carnes", "Verduras", "Trabajadores", "Batidos", "Aseo y Desechables", "Mercado", "Servicios", "Otros"];
export const PROVEEDORES_GASTOS_FALLBACK = [
  { nombre: "Alexa", categoria: "Trabajadores", descripcion: "Pago día Alexa" },
  { nombre: "Jesús", categoria: "Trabajadores", descripcion: "Pago día Jesús" },
  { nombre: "Kathe", categoria: "Trabajadores", descripcion: "Pago día Kathe" },
  { nombre: "Paola", categoria: "Trabajadores", descripcion: "Pago día Paola" }
];

const SELECT_CATEGORIAS = "id, nombre, activo, orden, creado_en, actualizado_en";
const SELECT_PROVEEDORES = "id, nombre, categoria, descripcion_sugerida, activo, orden, creado_en, actualizado_en";

export function normalizarCategoriaGasto(item, index = 0) {
  const nombre = String(item?.nombre || "").trim();
  if (!nombre) return null;
  return {
    id: item?.id || `cat-${nombre}`,
    catalogoId: item?.id || null,
    nombre,
    categoria: nombre,
    activo: item?.activo !== false,
    orden: Number.isFinite(Number(item?.orden)) ? Number(item.orden) : index + 1,
    origenCatalogo: item?.origenCatalogo || "bd"
  };
}

export function normalizarProveedorGasto(item, index = 0) {
  const nombre = String(item?.nombre || "").trim();
  if (!nombre) return null;
  return {
    id: item?.id || `prov-${nombre}`,
    catalogoId: item?.id || null,
    nombre,
    categoria: String(item?.categoria || "Otros").trim() || "Otros",
    descripcionSugerida: String(item?.descripcion_sugerida || item?.descripcionSugerida || "").trim(),
    activo: item?.activo !== false,
    orden: Number.isFinite(Number(item?.orden)) ? Number(item.orden) : index + 1,
    origenCatalogo: item?.origenCatalogo || "bd"
  };
}

export function fallbackCategoriasGasto() {
  return CATEGORIAS_GASTOS_FALLBACK.map((nombre, index) => normalizarCategoriaGasto({ nombre, activo: true, orden: index + 1, origenCatalogo: "local" }, index));
}

export function fallbackProveedoresGasto() {
  return PROVEEDORES_GASTOS_FALLBACK.map((item, index) => normalizarProveedorGasto({ ...item, descripcion_sugerida: item.descripcion, activo: true, orden: index + 1, origenCatalogo: "local" }, index));
}

export async function cargarCategoriasGastoAdmin() {
  try {
    const { data, error } = await supabase.from("categorias_gasto").select(SELECT_CATEGORIAS).order("orden", { ascending: true }).order("nombre", { ascending: true });
    if (error) return { ok: false, categorias: fallbackCategoriasGasto(), mensaje: describirErrorSupabase(error, "cargar el catálogo de gastos") };
    const categorias = (data || []).map(normalizarCategoriaGasto).filter(Boolean);
    return { ok: true, categorias: categorias.length ? categorias : fallbackCategoriasGasto(), mensaje: "Categorías de gasto cargadas." };
  } catch (error) {
    return { ok: false, categorias: fallbackCategoriasGasto(), mensaje: describirErrorSupabase(error, "cargar las categorías de gasto") };
  }
}

export async function cargarProveedoresGastoAdmin() {
  try {
    const { data, error } = await supabase.from("proveedores_gasto").select(SELECT_PROVEEDORES).order("orden", { ascending: true }).order("nombre", { ascending: true });
    if (error) return { ok: false, proveedores: fallbackProveedoresGasto(), mensaje: describirErrorSupabase(error, "cargar el catálogo de gastos") };
    const proveedores = (data || []).map(normalizarProveedorGasto).filter(Boolean);
    return { ok: true, proveedores: proveedores.length ? proveedores : fallbackProveedoresGasto(), mensaje: "Proveedores de gasto cargados." };
  } catch (error) {
    return { ok: false, proveedores: fallbackProveedoresGasto(), mensaje: describirErrorSupabase(error, "cargar los proveedores de gasto") };
  }
}

export async function cargarCatalogoGastos() {
  const [categoriasResultado, proveedoresResultado] = await Promise.all([cargarCategoriasGastoAdmin(), cargarProveedoresGastoAdmin()]);
  return {
    ok: categoriasResultado.ok && proveedoresResultado.ok,
    categorias: categoriasResultado.categorias,
    proveedores: proveedoresResultado.proveedores,
    mensaje: [categoriasResultado.mensaje, proveedoresResultado.mensaje].filter(Boolean).join(" ")
  };
}

export async function crearCategoriaGasto({ nombre, orden = 0 }) {
  const payload = { nombre: String(nombre || "").trim(), activo: true, orden: Number(orden || 0) };
  if (!payload.nombre) throw new Error("El nombre de la categoría es obligatorio.");
  const { data, error } = await supabase.from("categorias_gasto").insert(payload).select(SELECT_CATEGORIAS).single();
  if (error) throw error;
  return normalizarCategoriaGasto(data);
}

export async function actualizarCategoriaGasto(id, cambios) {
  const payload = { actualizado_en: new Date().toISOString() };
  if (Object.prototype.hasOwnProperty.call(cambios, "nombre")) payload.nombre = String(cambios.nombre || "").trim();
  if (Object.prototype.hasOwnProperty.call(cambios, "activo")) payload.activo = Boolean(cambios.activo);
  if (Object.prototype.hasOwnProperty.call(cambios, "orden")) payload.orden = Number(cambios.orden || 0);
  const { data, error } = await supabase.from("categorias_gasto").update(payload).eq("id", id).select(SELECT_CATEGORIAS).single();
  if (error) throw error;
  return normalizarCategoriaGasto(data);
}

export async function crearProveedorGasto({ nombre, categoria = "Otros", descripcionSugerida = "", orden = 0 }) {
  const payload = {
    nombre: String(nombre || "").trim(),
    categoria: String(categoria || "Otros").trim() || "Otros",
    descripcion_sugerida: String(descripcionSugerida || "").trim() || null,
    activo: true,
    orden: Number(orden || 0)
  };
  if (!payload.nombre) throw new Error("El nombre del proveedor es obligatorio.");
  const { data, error } = await supabase.from("proveedores_gasto").insert(payload).select(SELECT_PROVEEDORES).single();
  if (error) throw error;
  return normalizarProveedorGasto(data);
}

export async function actualizarProveedorGasto(id, cambios) {
  const payload = { actualizado_en: new Date().toISOString() };
  if (Object.prototype.hasOwnProperty.call(cambios, "nombre")) payload.nombre = String(cambios.nombre || "").trim();
  if (Object.prototype.hasOwnProperty.call(cambios, "categoria")) payload.categoria = String(cambios.categoria || "Otros").trim() || "Otros";
  if (Object.prototype.hasOwnProperty.call(cambios, "descripcionSugerida")) payload.descripcion_sugerida = String(cambios.descripcionSugerida || "").trim() || null;
  if (Object.prototype.hasOwnProperty.call(cambios, "activo")) payload.activo = Boolean(cambios.activo);
  if (Object.prototype.hasOwnProperty.call(cambios, "orden")) payload.orden = Number(cambios.orden || 0);
  const { data, error } = await supabase.from("proveedores_gasto").update(payload).eq("id", id).select(SELECT_PROVEEDORES).single();
  if (error) throw error;
  return normalizarProveedorGasto(data);
}
