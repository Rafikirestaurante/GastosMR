import { supabase } from "../supabaseClient";
import { generarId } from "../shared/utils/pedidos";
import { describirErrorSupabase, esErrorEsquemaSupabase } from "../shared/utils/supabaseErrors";

export function normalizarProductoAdmin(producto, index = 0) {
  const nombre = String(producto?.nombre || "").trim();
  if (!nombre) return null;

  const precioNormalizado = producto?.precio === null || producto?.precio === undefined || producto?.precio === "" ? "" : Number(producto.precio);

  return {
    id: producto?.id ? String(producto.id) : generarId("producto-admin"),
    catalogoId: producto?.id || null,
    linea: String(producto?.linea || "Cafetería").trim() || "Cafetería",
    categoria: String(producto?.categoria || "Productos").trim() || "Productos",
    nombre,
    precio: Number.isFinite(precioNormalizado) ? precioNormalizado : "",
    activo: producto?.activo !== false,
    agotado: producto?.agotado === true,
    orden: Number.isFinite(Number(producto?.orden)) ? Number(producto.orden) : index + 1,
    origenCatalogo: producto?.origenCatalogo || "bd"
  };
}

const SELECT_PRODUCTOS_BASE = "id, linea, categoria, nombre, precio, activo, orden";
const SELECT_PRODUCTOS_COMPLETO = "id, linea, categoria, nombre, precio, activo, agotado, orden";

function errorColumnaAgotado(error) {
  return esErrorEsquemaSupabase(error, ["agotado"]);
}

function aplicarOrdenCatalogo(query) {
  return query
    .order("linea", { ascending: true })
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });
}

async function seleccionarProductos({ conAgotado = true } = {}) {
  return aplicarOrdenCatalogo(
    supabase
      .from("catalogo_productos")
      .select(conAgotado ? SELECT_PRODUCTOS_COMPLETO : SELECT_PRODUCTOS_BASE)
  );
}

export async function cargarCatalogoProductosAdmin() {
  try {
    const { data, error } = await seleccionarProductos({ conAgotado: true });

    let productosData = data;
    let productosError = error;

    if (productosError && errorColumnaAgotado(productosError)) {
      const respaldo = await seleccionarProductos({ conAgotado: false });
      productosData = respaldo.data;
      productosError = respaldo.error;
    }

    if (productosError) {
      return { ok: false, productos: [], mensaje: describirErrorSupabase(productosError, "cargar el catálogo de productos") };
    }

    return {
      ok: true,
      productos: (productosData || []).map(normalizarProductoAdmin).filter(Boolean),
      mensaje: `Catálogo de productos cargado desde Supabase (${(productosData || []).length} registros).`
    };
  } catch (error) {
    return { ok: false, productos: [], mensaje: describirErrorSupabase(error, "cargar el catálogo de productos") };
  }
}

export async function crearProductoCatalogoAdmin({ linea = "Cafetería", categoria, nombre, precio = "", orden = 0 }) {
  const payload = {
    linea: String(linea || "Cafetería").trim() || "Cafetería",
    categoria: String(categoria || "Productos").trim() || "Productos",
    nombre: String(nombre || "").trim(),
    precio: precio === "" || precio == null ? null : Number(precio),
    activo: true,
    agotado: false,
    orden: Number.isFinite(Number(orden)) ? Number(orden) : 0
  };

  let { data, error } = await supabase
    .from("catalogo_productos")
    .insert(payload)
    .select(SELECT_PRODUCTOS_COMPLETO)
    .single();

  if (error && errorColumnaAgotado(error)) {
    const payloadSinAgotado = { ...payload };
    delete payloadSinAgotado.agotado;
    const respaldo = await supabase
      .from("catalogo_productos")
      .insert(payloadSinAgotado)
      .select(SELECT_PRODUCTOS_BASE)
      .single();
    data = respaldo.data;
    error = respaldo.error;
  }

  if (error) throw error;
  return normalizarProductoAdmin(data);
}

export async function actualizarProductoCatalogoAdmin(id, cambios) {
  const payload = {};
  if (Object.prototype.hasOwnProperty.call(cambios, "linea")) payload.linea = String(cambios.linea || "Cafetería").trim() || "Cafetería";
  if (Object.prototype.hasOwnProperty.call(cambios, "categoria")) payload.categoria = String(cambios.categoria || "Productos").trim() || "Productos";
  if (Object.prototype.hasOwnProperty.call(cambios, "nombre")) payload.nombre = String(cambios.nombre || "").trim();
  if (Object.prototype.hasOwnProperty.call(cambios, "precio")) payload.precio = cambios.precio === "" || cambios.precio == null ? null : Number(cambios.precio);
  if (Object.prototype.hasOwnProperty.call(cambios, "activo")) payload.activo = Boolean(cambios.activo);
  if (Object.prototype.hasOwnProperty.call(cambios, "agotado")) payload.agotado = Boolean(cambios.agotado);
  if (Object.prototype.hasOwnProperty.call(cambios, "orden")) payload.orden = Number.isFinite(Number(cambios.orden)) ? Number(cambios.orden) : 0;

  let { data, error } = await supabase
    .from("catalogo_productos")
    .update(payload)
    .eq("id", id)
    .select(SELECT_PRODUCTOS_COMPLETO)
    .single();

  if (error && errorColumnaAgotado(error) && !Object.prototype.hasOwnProperty.call(payload, "agotado")) {
    const respaldo = await supabase
      .from("catalogo_productos")
      .update(payload)
      .eq("id", id)
      .select(SELECT_PRODUCTOS_BASE)
      .single();
    data = respaldo.data;
    error = respaldo.error;
  }

  if (error) throw error;
  return normalizarProductoAdmin(data);
}
