import { supabase } from "../supabaseClient";
import { generarId } from "../shared/utils/pedidos";
import { ordenarProductosPorNombre } from "../shared/utils/solicitudProductos";
import { productosRestauranteBase } from "../data/solicitudProductosData";
import { describirErrorSupabase } from "../shared/utils/supabaseErrors";

const FALLBACK_MOTIVO = "fallback_local";

function normalizarInsumoCatalogo(insumo, index = 0) {
  const nombre = String(insumo?.nombre || "").trim();
  if (!nombre) return null;

  return {
    id: insumo?.id ? `insumo-bd-${insumo.id}` : generarId("insumo-bd"),
    catalogoId: insumo?.id || null,
    categoria: String(insumo?.categoria || "Productos").trim() || "Productos",
    nombre,
    cantidad: "",
    unidad: String(insumo?.unidad_base || "und").trim() || "und",
    nota: "",
    seleccionada: false,
    orden: Number.isFinite(Number(insumo?.orden)) ? Number(insumo.orden) : index + 1,
    origenCatalogo: "bd"
  };
}

export function crearProductosSolicitudFallback() {
  return ordenarProductosPorNombre(productosRestauranteBase).map((producto) => ({
    id: generarId("insumo-base"),
    categoria: producto.categoria,
    nombre: producto.nombre,
    cantidad: "",
    unidad: "und",
    nota: "",
    seleccionada: false,
    origenCatalogo: "local"
  }));
}

export function reconciliarCatalogoConSolicitudActual(catalogo, productosActuales = []) {
  const estadoPorNombre = new Map(
    (productosActuales || []).map((producto) => [String(producto?.nombre || "").trim().toLowerCase(), producto])
  );

  const nombresCatalogo = new Set();
  const productosReconciliados = (catalogo || []).map((producto) => {
    const clave = String(producto?.nombre || "").trim().toLowerCase();
    nombresCatalogo.add(clave);
    const previo = estadoPorNombre.get(clave);

    return {
      ...producto,
      id: previo?.id || producto.id,
      cantidad: previo?.cantidad || "",
      unidad: previo?.unidad || producto.unidad || "und",
      nota: previo?.nota || "",
      seleccionada: Boolean(previo?.seleccionada)
    };
  });

  const productosTemporales = (productosActuales || [])
    .filter((producto) => {
      const clave = String(producto?.nombre || "").trim().toLowerCase();
      return clave && !nombresCatalogo.has(clave) && producto.seleccionada;
    })
    .map((producto) => ({
      ...producto,
      origenCatalogo: producto.origenCatalogo || "temporal"
    }));

  return [...productosReconciliados, ...productosTemporales];
}

export async function cargarCatalogoInsumosSolicitud() {
  try {
    const { data, error } = await supabase
      .from("catalogo_insumos")
      .select("id, categoria, nombre, unidad_base, activo, orden")
      .eq("activo", true)
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });

    if (error) {
      return {
        ok: false,
        productos: crearProductosSolicitudFallback(),
        fuente: "local",
        motivo: FALLBACK_MOTIVO,
        mensaje: describirErrorSupabase(error, "cargar el catálogo de insumos")
      };
    }

    const productos = (data || [])
      .map(normalizarInsumoCatalogo)
      .filter(Boolean);

    if (productos.length === 0) {
      return {
        ok: false,
        productos: crearProductosSolicitudFallback(),
        fuente: "local",
        motivo: FALLBACK_MOTIVO,
        mensaje: "La tabla catalogo_insumos no tiene insumos activos."
      };
    }

    return {
      ok: true,
      productos,
      fuente: "bd",
      motivo: "catalogo_bd",
      mensaje: `Catálogo cargado desde Supabase (${productos.length} insumos).`
    };
  } catch (error) {
    return {
      ok: false,
      productos: crearProductosSolicitudFallback(),
      fuente: "local",
      motivo: FALLBACK_MOTIVO,
      mensaje: describirErrorSupabase(error, "consultar el catálogo de insumos")
    };
  }
}

export function normalizarInsumoAdmin(insumo, index = 0) {
  const nombre = String(insumo?.nombre || "").trim();
  if (!nombre) return null;

  return {
    id: insumo?.id ? String(insumo.id) : generarId("insumo-admin"),
    catalogoId: insumo?.id || null,
    categoria: String(insumo?.categoria || "Productos").trim() || "Productos",
    nombre,
    unidadBase: String(insumo?.unidad_base || insumo?.unidadBase || "und").trim() || "und",
    proveedor: String(insumo?.proveedor || "").trim(),
    activo: insumo?.activo !== false,
    orden: Number.isFinite(Number(insumo?.orden)) ? Number(insumo.orden) : index + 1,
    origenCatalogo: insumo?.origenCatalogo || "bd"
  };
}

export async function cargarCatalogoInsumosAdmin() {
  try {
    const { data, error } = await supabase
      .from("catalogo_insumos")
      .select("id, categoria, nombre, unidad_base, proveedor, activo, orden")
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });

    if (error) {
      return { ok: false, insumos: [], mensaje: describirErrorSupabase(error, "cargar el catálogo de insumos") };
    }

    return {
      ok: true,
      insumos: (data || []).map(normalizarInsumoAdmin).filter(Boolean),
      mensaje: `Catálogo de insumos cargado desde Supabase (${(data || []).length} registros).`
    };
  } catch (error) {
    return { ok: false, insumos: [], mensaje: describirErrorSupabase(error, "cargar el catálogo de insumos") };
  }
}

export async function crearInsumoCatalogoAdmin({ categoria, nombre, unidadBase = "und", proveedor = "", orden = 0 }) {
  const payload = {
    categoria: String(categoria || "Productos").trim() || "Productos",
    nombre: String(nombre || "").trim(),
    unidad_base: String(unidadBase || "und").trim() || "und",
    proveedor: String(proveedor || "").trim() || null,
    activo: true,
    orden: Number.isFinite(Number(orden)) ? Number(orden) : 0
  };

  const { data, error } = await supabase
    .from("catalogo_insumos")
    .insert(payload)
    .select("id, categoria, nombre, unidad_base, proveedor, activo, orden")
    .single();

  if (error) throw error;
  return normalizarInsumoAdmin(data);
}

export async function actualizarInsumoCatalogoAdmin(id, cambios) {
  const payload = {};
  if (Object.prototype.hasOwnProperty.call(cambios, "categoria")) payload.categoria = String(cambios.categoria || "Productos").trim() || "Productos";
  if (Object.prototype.hasOwnProperty.call(cambios, "nombre")) payload.nombre = String(cambios.nombre || "").trim();
  if (Object.prototype.hasOwnProperty.call(cambios, "unidadBase")) payload.unidad_base = String(cambios.unidadBase || "und").trim() || "und";
  if (Object.prototype.hasOwnProperty.call(cambios, "proveedor")) payload.proveedor = String(cambios.proveedor || "").trim() || null;
  if (Object.prototype.hasOwnProperty.call(cambios, "activo")) payload.activo = Boolean(cambios.activo);
  if (Object.prototype.hasOwnProperty.call(cambios, "orden")) payload.orden = Number.isFinite(Number(cambios.orden)) ? Number(cambios.orden) : 0;

  const { data, error } = await supabase
    .from("catalogo_insumos")
    .update(payload)
    .eq("id", id)
    .select("id, categoria, nombre, unidad_base, proveedor, activo, orden")
    .single();

  if (error) throw error;
  return normalizarInsumoAdmin(data);
}
