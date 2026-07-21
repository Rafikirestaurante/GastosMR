import { supabase } from "../supabaseClient";

const SELECT_INSUMOS = "id, nombre, categoria, unidad, stock_actual, stock_minimo, costo_promedio, activo, creado_en, actualizado_en";
const SELECT_MOVIMIENTOS = "id, insumo_id, tipo, cantidad, motivo, fecha, usuario, creado_en";
const SELECT_RECETAS = "id, grupo_producto, condicion, insumo_nombre, cantidad, regla_codigo, activo, notas, creado_en, actualizado_en";
const SELECT_RELACIONES_PRODUCTOS = "id, insumo_id, insumo_nombre, producto_codigo, producto_nombre, linea, categoria, cantidad, condicion, activo, creado_en, actualizado_en";

export const CATEGORIAS_INVENTARIO = ["Carnes", "Verduras", "Granos", "Lácteos", "Frutas", "Bebidas", "Desechables", "Aseo", "Otros"];
export const UNIDADES_INVENTARIO = ["kg", "g", "lb", "unidad", "paquete", "litro", "ml", "bolsa", "caja"];
export const TIPOS_MOVIMIENTO_INVENTARIO = ["entrada", "salida", "ajuste", "merma"];

export function formatearFechaInventarioColombia(fecha = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(fecha);
}

export function obtenerFechaInventarioHoy() {
  return formatearFechaInventarioColombia(new Date());
}

export function normalizarInsumoInventario(item) {
  if (!item) return null;
  return {
    id: item.id,
    nombre: item.nombre || "",
    categoria: item.categoria || "Otros",
    unidad: item.unidad || "unidad",
    stockActual: Number(item.stock_actual || 0),
    stockMinimo: Number(item.stock_minimo || 0),
    costoPromedio: Number(item.costo_promedio || 0),
    activo: item.activo !== false,
    creadoEn: item.creado_en || "",
    actualizadoEn: item.actualizado_en || ""
  };
}

export function normalizarRecetaInventario(item) {
  if (!item) return null;
  return {
    id: item.id,
    grupoProducto: item.grupo_producto || "",
    condicion: item.condicion || "para_llevar",
    insumoNombre: item.insumo_nombre || "",
    cantidad: Number(item.cantidad || 0),
    reglaCodigo: item.regla_codigo || "",
    activo: item.activo !== false,
    notas: item.notas || "",
    creadoEn: item.creado_en || "",
    actualizadoEn: item.actualizado_en || ""
  };
}


export function normalizarRelacionInventarioProducto(item) {
  if (!item) return null;
  return {
    id: item.id,
    insumoId: item.insumo_id || "",
    insumoNombre: item.insumo_nombre || "",
    productoCodigo: item.producto_codigo || "",
    productoNombre: item.producto_nombre || "",
    linea: item.linea || "",
    categoria: item.categoria || "",
    cantidad: Number(item.cantidad || 0),
    condicion: item.condicion || "venta",
    activo: item.activo !== false,
    creadoEn: item.creado_en || "",
    actualizadoEn: item.actualizado_en || ""
  };
}

function crearCodigoRegla(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function prepararPayloadReceta(receta) {
  const grupoProducto = String(receta.grupoProducto || receta.grupo_producto || "").trim().toLowerCase();
  const condicion = String(receta.condicion || "para_llevar").trim().toLowerCase();
  const insumoNombre = String(receta.insumoNombre || receta.insumo_nombre || "").trim();
  const cantidad = Number(receta.cantidad || 0);
  const reglaCodigo = crearCodigoRegla(receta.reglaCodigo || receta.regla_codigo || `${grupoProducto}_${insumoNombre}`);

  if (!grupoProducto) throw new Error("El grupo de la regla es obligatorio.");
  if (!insumoNombre) throw new Error("Selecciona el insumo que se va a descontar.");
  if (!Number.isFinite(cantidad) || cantidad <= 0) throw new Error("La cantidad debe ser mayor a cero.");
  if (!reglaCodigo) throw new Error("El código de regla no es válido.");

  return {
    grupo_producto: grupoProducto,
    condicion,
    insumo_nombre: insumoNombre,
    cantidad,
    regla_codigo: reglaCodigo,
    activo: receta.activo !== false,
    notas: String(receta.notas || "").trim() || null,
    actualizado_en: new Date().toISOString()
  };
}

export async function cargarRecetasInventario({ incluirInactivas = true } = {}) {
  let consulta = supabase
    .from("recetas_desechables")
    .select(SELECT_RECETAS)
    .order("grupo_producto", { ascending: true })
    .order("condicion", { ascending: true })
    .order("regla_codigo", { ascending: true })
    .order("insumo_nombre", { ascending: true });

  if (!incluirInactivas) consulta = consulta.eq("activo", true);
  const { data, error } = await consulta;
  if (error) throw error;
  return (data || []).map(normalizarRecetaInventario).filter(Boolean);
}

export async function guardarRecetaInventario(receta) {
  const payload = prepararPayloadReceta(receta);

  if (receta.id) {
    const { data, error } = await supabase
      .from("recetas_desechables")
      .update(payload)
      .eq("id", receta.id)
      .select(SELECT_RECETAS)
      .single();
    if (error) throw error;
    return normalizarRecetaInventario(data);
  }

  const { data, error } = await supabase
    .from("recetas_desechables")
    .insert(payload)
    .select(SELECT_RECETAS)
    .single();
  if (error) throw error;
  return normalizarRecetaInventario(data);
}

export async function guardarReglaInventario(regla, { reglaCodigoAnterior = "" } = {}) {
  const insumos = Array.isArray(regla.insumos) ? regla.insumos : [];
  if (!insumos.length) throw new Error("Agrega por lo menos un insumo a la regla.");

  const baseCodigo = regla.reglaCodigo || reglaCodigoAnterior || `${regla.grupoProducto}_${regla.condicion}`;
  const reglaCodigo = crearCodigoRegla(baseCodigo);
  if (!reglaCodigo) throw new Error("El código de regla no es válido.");

  const payloads = insumos
    .map((item) => prepararPayloadReceta({
      grupoProducto: regla.grupoProducto,
      condicion: regla.condicion,
      reglaCodigo,
      activo: regla.activo !== false,
      notas: regla.notas,
      insumoNombre: item.insumoNombre,
      cantidad: item.cantidad
    }))
    .filter((item) => item.insumo_nombre);

  const insumosUnicos = new Set(payloads.map((item) => item.insumo_nombre.trim().toLowerCase()));
  if (insumosUnicos.size !== payloads.length) throw new Error("La regla tiene insumos repetidos. Deja cada insumo una sola vez.");

  const codigoAEliminar = crearCodigoRegla(reglaCodigoAnterior || reglaCodigo);
  if (codigoAEliminar) {
    const { error: deleteError } = await supabase
      .from("recetas_desechables")
      .delete()
      .eq("regla_codigo", codigoAEliminar);
    if (deleteError) throw deleteError;
  }

  const { data, error } = await supabase
    .from("recetas_desechables")
    .insert(payloads)
    .select(SELECT_RECETAS);
  if (error) throw error;
  return (data || []).map(normalizarRecetaInventario).filter(Boolean);
}

export async function cambiarEstadoReglaInventario(reglaCodigo, activo) {
  const codigo = crearCodigoRegla(reglaCodigo);
  if (!codigo) throw new Error("La regla no tiene código válido.");
  const { data, error } = await supabase
    .from("recetas_desechables")
    .update({ activo: activo !== false, actualizado_en: new Date().toISOString() })
    .eq("regla_codigo", codigo)
    .select(SELECT_RECETAS);
  if (error) throw error;
  return (data || []).map(normalizarRecetaInventario).filter(Boolean);
}

function prepararPayloadInsumo(insumo) {
  return {
    nombre: String(insumo.nombre || "").trim(),
    categoria: String(insumo.categoria || "Otros").trim() || "Otros",
    unidad: String(insumo.unidad || "unidad").trim() || "unidad",
    stock_actual: Number(insumo.stockActual || 0),
    stock_minimo: Number(insumo.stockMinimo || 0),
    costo_promedio: Number(insumo.costoPromedio || 0),
    activo: insumo.activo !== false,
    actualizado_en: new Date().toISOString()
  };
}

export async function cargarInventarioInsumos({ incluirInactivos = false } = {}) {
  let consulta = supabase.from("inventario_insumos").select(SELECT_INSUMOS).order("categoria", { ascending: true }).order("nombre", { ascending: true });
  if (!incluirInactivos) consulta = consulta.eq("activo", true);
  const { data, error } = await consulta;
  if (error) throw error;
  return (data || []).map(normalizarInsumoInventario).filter(Boolean);
}

export async function guardarInventarioInsumo(insumo) {
  const payload = prepararPayloadInsumo(insumo);
  if (!payload.nombre) throw new Error("El nombre del insumo es obligatorio.");
  if (!Number.isFinite(payload.stock_actual)) throw new Error("El stock actual no es válido.");

  if (insumo.id) {
    const { data, error } = await supabase.from("inventario_insumos").update(payload).eq("id", insumo.id).select(SELECT_INSUMOS).single();
    if (error) throw error;
    return normalizarInsumoInventario(data);
  }

  const { data, error } = await supabase.from("inventario_insumos").insert(payload).select(SELECT_INSUMOS).single();
  if (error) throw error;
  return normalizarInsumoInventario(data);
}


export async function cargarRelacionesInventarioProductos({ incluirInactivas = false } = {}) {
  let consulta = supabase
    .from("inventario_producto_insumos")
    .select(SELECT_RELACIONES_PRODUCTOS)
    .order("linea", { ascending: true })
    .order("categoria", { ascending: true })
    .order("producto_nombre", { ascending: true });

  if (!incluirInactivas) consulta = consulta.eq("activo", true);
  const { data, error } = await consulta;
  if (error) throw error;
  return (data || []).map(normalizarRelacionInventarioProducto).filter(Boolean);
}

export async function guardarRelacionesInsumoProducto(insumo, productosSeleccionados = []) {
  if (!insumo?.id) throw new Error("Selecciona un insumo válido.");

  const { error: deleteError } = await supabase
    .from("inventario_producto_insumos")
    .delete()
    .eq("insumo_id", insumo.id);
  if (deleteError) throw deleteError;

  const payloads = (productosSeleccionados || [])
    .map((producto) => ({
      insumo_id: insumo.id,
      insumo_nombre: String(insumo.nombre || "").trim(),
      producto_codigo: String(producto.productoCodigo || producto.producto_codigo || "").trim(),
      producto_nombre: String(producto.productoNombre || producto.producto_nombre || "").trim(),
      linea: String(producto.linea || "").trim() || null,
      categoria: String(producto.categoria || "").trim() || null,
      cantidad: Number(producto.cantidad || 0),
      condicion: String(producto.condicion || "venta").trim() || "venta",
      activo: true,
      actualizado_en: new Date().toISOString()
    }))
    .filter((item) => item.producto_codigo && item.producto_nombre && Number.isFinite(item.cantidad) && item.cantidad > 0);

  if (!payloads.length) return [];

  const codigos = new Set(payloads.map((item) => item.producto_codigo));
  if (codigos.size !== payloads.length) throw new Error("Hay productos repetidos en la configuración del insumo.");

  const { data, error } = await supabase
    .from("inventario_producto_insumos")
    .insert(payloads)
    .select(SELECT_RELACIONES_PRODUCTOS);
  if (error) throw error;
  return (data || []).map(normalizarRelacionInventarioProducto).filter(Boolean);
}

export async function registrarMovimientoInventario({ insumoId, tipo, cantidad, motivo, usuario }) {
  const payload = {
    insumo_id: insumoId,
    tipo,
    cantidad: Number(cantidad || 0),
    motivo: String(motivo || "").trim() || null,
    fecha: obtenerFechaInventarioHoy(),
    usuario: String(usuario || "").trim() || null
  };
  if (!payload.insumo_id) throw new Error("Selecciona un insumo.");
  if (!TIPOS_MOVIMIENTO_INVENTARIO.includes(payload.tipo)) throw new Error("Tipo de movimiento no válido.");
  if (!Number.isFinite(payload.cantidad) || payload.cantidad <= 0) throw new Error("La cantidad debe ser mayor a cero.");

  const consultaMovimiento = supabase.rpc("registrar_movimiento_inventario", payload);
  const { data, error } = await consultaMovimiento.select(SELECT_MOVIMIENTOS);
  if (error) throw error;
  return data;
}

export async function registrarEntradaInventarioDesdeGasto({ gastoId, insumoId, cantidad, motivo, fecha, usuario }) {
  const payload = {
    gasto_id: gastoId || null,
    insumo_id: insumoId,
    cantidad: Number(cantidad || 0),
    motivo: String(motivo || "Compra registrada desde Gastos").trim() || "Compra registrada desde Gastos",
    fecha: fecha || obtenerFechaInventarioHoy(),
    usuario: String(usuario || "Gastos").trim() || "Gastos"
  };

  if (!payload.insumo_id) throw new Error("Selecciona un insumo para actualizar inventario.");
  if (!Number.isFinite(payload.cantidad) || payload.cantidad <= 0) throw new Error("La cantidad de inventario debe ser mayor a cero.");

  const { data, error } = await supabase
    .rpc("registrar_entrada_inventario_desde_gasto", payload);

  if (error) throw error;
  return data;
}

function normalizarUnidadDesdeCatalogo(unidadBase) {
  const unidad = String(unidadBase || "unidad").trim().toLowerCase();
  if (["kg", "kilo", "kilos"].includes(unidad)) return "kg";
  if (["g", "gr", "gramo", "gramos"].includes(unidad)) return "g";
  if (["lt", "l", "litro", "litros"].includes(unidad)) return "litro";
  if (["ml", "mililitro", "mililitros"].includes(unidad)) return "ml";
  if (["und", "unidad", "unidades"].includes(unidad)) return "unidad";
  if (UNIDADES_INVENTARIO.includes(unidad)) return unidad;
  return "unidad";
}

export async function sincronizarInventarioDesdeCatalogoInsumos(insumosInventarioActuales = []) {
  const existentes = new Set(
    (insumosInventarioActuales || [])
      .map((item) => String(item?.nombre || "").trim().toLowerCase())
      .filter(Boolean)
  );

  const { data, error } = await supabase
    .from("catalogo_insumos")
    .select("categoria, nombre, unidad_base, activo, orden")
    .eq("activo", true)
    .order("categoria", { ascending: true })
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });

  if (error) throw error;

  const nuevos = (data || [])
    .filter((item) => {
      const nombre = String(item?.nombre || "").trim();
      return nombre && !existentes.has(nombre.toLowerCase());
    })
    .map((item) => ({
      nombre: String(item.nombre || "").trim(),
      categoria: String(item.categoria || "Otros").trim() || "Otros",
      unidad: normalizarUnidadDesdeCatalogo(item.unidad_base),
      stock_actual: 0,
      stock_minimo: 0,
      costo_promedio: 0,
      activo: true,
      actualizado_en: new Date().toISOString()
    }));

  if (!nuevos.length) return [];

  const { data: insertados, error: insertError } = await supabase
    .from("inventario_insumos")
    .insert(nuevos)
    .select(SELECT_INSUMOS);

  if (insertError) throw insertError;
  return (insertados || []).map(normalizarInsumoInventario).filter(Boolean);
}


function textoNormalizadoInventario(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function nombreItemPedido(item) {
  return item?.producto || item?.plato || item?.proteina || item?.nombre || "Producto";
}

function cantidadItemPedido(item) {
  const cantidad = Number(item?.cantidad || 1);
  return Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1;
}

function pedidoOItemParaLlevar(pedido, item) {
  const textoMesa = textoNormalizadoInventario(pedido?.mesa || pedido?.ubicacion || pedido?.tipo_pedido);
  return Boolean(item?.paraLlevar) || textoMesa.includes("llevar") || textoNormalizadoInventario(pedido?.tipo_pedido) === "llevar";
}

function agregarSalida(mapa, insumoNombre, cantidad, reglaCodigo, descripcion) {
  const clave = String(insumoNombre || "").trim();
  if (!clave || !Number.isFinite(Number(cantidad)) || Number(cantidad) <= 0) return;
  const codigo = String(reglaCodigo || clave).trim();
  const claveMapa = `${codigo}::${clave.toLowerCase()}`;
  const actual = mapa.get(claveMapa) || { insumoNombre: clave, cantidad: 0, reglaCodigo: codigo, descripcion: descripcion || clave };
  actual.cantidad += Number(cantidad);
  mapa.set(claveMapa, actual);
}

function clasificarEmpaqueParaLlevar(item) {
  const nombre = textoNormalizadoInventario(nombreItemPedido(item));
  const categoria = textoNormalizadoInventario(item?.categoria || item?.tipo);
  const tipo = textoNormalizadoInventario(item?.tipo);
  const tamano = textoNormalizadoInventario(item?.tamano || nombre);

  if (nombre.includes("sandwich") || nombre.includes("sanduche") || tipo.includes("sandwich") || tipo.includes("sanduche")) {
    return "sandwich";
  }
  if (nombre.includes("sancocho")) return "sancocho";
  if (categoria.includes("sopa") || nombre.includes("sopa") || nombre.includes("mondongo") || nombre.includes("ajiaco")) return "sopa";
  if (nombre.includes("pasta") || categoria.includes("pasta")) return "pasta";
  if (nombre.includes("arroz") || categoria.includes("arroz")) return "arroz";
  if (tipo.includes("batido") || tipo.includes("jugo") || nombre.includes("batido") || nombre.includes("jugo")) {
    if (tamano.includes("22")) return "bebida_22";
    if (tamano.includes("16")) return "bebida_16";
    return "bebida_12";
  }
  if (tipo.includes("parfait") || nombre.includes("parfait")) {
    if (tamano.includes("22")) return "parfait_22";
    if (tamano.includes("16")) return "parfait_16";
    return "parfait_12";
  }
  return "almuerzo_estandar";
}


function crearCodigoProductoInventario({ linea, categoria, nombre }) {
  return `${textoNormalizadoInventario(linea)}_${textoNormalizadoInventario(categoria)}_${textoNormalizadoInventario(nombre)}`
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function clavesProductoPedido(item) {
  const nombre = nombreItemPedido(item);
  const linea = item?.linea || item?.seccion || "";
  const categoria = item?.categoria || item?.tipo || "";
  return new Set([
    textoNormalizadoInventario(nombre),
    crearCodigoProductoInventario({ linea, categoria, nombre }),
    crearCodigoProductoInventario({ linea: item?.linea, categoria: item?.categoria, nombre }),
    crearCodigoProductoInventario({ linea: item?.seccion, categoria: item?.tipo, nombre })
  ].filter(Boolean));
}

export function calcularSalidasInventarioPorProductos(pedido, relacionesActivas = []) {
  const mapa = new Map();
  const items = Array.isArray(pedido?.items) ? pedido.items : [];
  const relaciones = (relacionesActivas || []).filter((relacion) => relacion?.activo !== false);

  items.forEach((item) => {
    const cantidadItem = cantidadItemPedido(item);
    const claves = clavesProductoPedido(item);
    relaciones
      .filter((relacion) => claves.has(textoNormalizadoInventario(relacion.productoCodigo)) || claves.has(textoNormalizadoInventario(relacion.productoNombre)))
      .forEach((relacion) => {
        agregarSalida(
          mapa,
          relacion.insumoNombre,
          Number(relacion.cantidad || 0) * cantidadItem,
          `producto_${textoNormalizadoInventario(relacion.insumoNombre)}_${textoNormalizadoInventario(relacion.productoCodigo || relacion.productoNombre)}`,
          `Producto: ${nombreItemPedido(item)}`
        );
      });
  });

  return Array.from(mapa.values()).filter((item) => item.cantidad > 0);
}

export function calcularSalidasInventarioPedido(pedido, recetasActivas = []) {
  const mapa = new Map();
  const items = Array.isArray(pedido?.items) ? pedido.items : [];
  const recetas = (recetasActivas || []).filter((receta) => receta?.activo !== false);

  function aplicarRecetas(grupos, condicion, item, cantidad) {
    const gruposSet = new Set((Array.isArray(grupos) ? grupos : [grupos]).map((g) => textoNormalizadoInventario(g)).filter(Boolean));
    recetas
      .filter((receta) => gruposSet.has(textoNormalizadoInventario(receta.grupoProducto || receta.grupo_producto)))
      .filter((receta) => textoNormalizadoInventario(receta.condicion) === textoNormalizadoInventario(condicion))
      .forEach((receta) => {
        agregarSalida(
          mapa,
          receta.insumoNombre || receta.insumo_nombre,
          Number(receta.cantidad || 0) * cantidad,
          receta.reglaCodigo || receta.regla_codigo,
          receta.notas || `${condicion}: ${nombreItemPedido(item)}`
        );
      });
  }

  items.forEach((item) => {
    const cantidad = cantidadItemPedido(item);
    const nombreNormalizado = textoNormalizadoInventario(nombreItemPedido(item));
    const tipoNormalizado = textoNormalizadoInventario(item?.tipo);
    const esSandwich = nombreNormalizado.includes("sandwich") || nombreNormalizado.includes("sanduche") || tipoNormalizado.includes("sandwich") || tipoNormalizado.includes("sanduche");

    if (esSandwich) {
      aplicarRecetas("sandwich", "produccion", item, cantidad);
    }

    if (!pedidoOItemParaLlevar(pedido, item)) return;

    const grupoEmpaque = clasificarEmpaqueParaLlevar(item);
    const gruposParaLlevar = [grupoEmpaque];
    if (["bebida_12", "bebida_16", "bebida_22"].includes(grupoEmpaque)) gruposParaLlevar.push("bebida");
    aplicarRecetas(gruposParaLlevar, "para_llevar", item, cantidad);
  });

  return Array.from(mapa.values()).filter((item) => item.cantidad > 0);
}

export async function registrarDescuentoInventarioPedido(pedido, { usuario = "Pedidos Rafiki" } = {}) {
  const relacionesActivas = await cargarRelacionesInventarioProductos({ incluirInactivas: false }).catch(() => []);
  let salidas = calcularSalidasInventarioPorProductos(pedido, relacionesActivas);

  // Respaldo temporal: si todavía no hay relaciones insumo -> producto configuradas,
  // mantiene funcionando las reglas antiguas de desechables para no frenar la operación.
  if (!salidas.length) {
    const recetasActivas = await cargarRecetasInventario({ incluirInactivas: false }).catch(() => []);
    salidas = calcularSalidasInventarioPedido(pedido, recetasActivas);
  }

  if (!pedido?.id || salidas.length === 0) {
    return { total: 0, aplicadas: [], omitidas: [], salidas };
  }

  const resultados = [];

  for (const salida of salidas) {
    const { data, error } = await supabase.rpc("registrar_salida_inventario_pedido", {
      pedido_id: pedido.id,
      insumo_nombre: salida.insumoNombre,
      cantidad: salida.cantidad,
      regla_codigo: salida.reglaCodigo,
      motivo: `Salida automática por pedido #${pedido.numero_pedido || pedido.id}: ${salida.descripcion}`,
      usuario
    });

    if (error) throw error;
    resultados.push(data);
  }

  return {
    total: resultados.filter((item) => item?.estado === "registrado").length,
    aplicadas: resultados.filter((item) => item?.estado === "registrado"),
    omitidas: resultados.filter((item) => item?.estado !== "registrado"),
    salidas
  };
}

export function calcularResumenInventario(insumos = []) {
  const activos = insumos.filter((item) => item.activo !== false);
  const stockBajo = activos.filter((item) => item.stockActual <= item.stockMinimo);
  const agotados = activos.filter((item) => item.stockActual <= 0);
  const valorEstimado = activos.reduce((total, item) => total + item.stockActual * item.costoPromedio, 0);
  return { totalInsumos: activos.length, stockBajo: stockBajo.length, agotados: agotados.length, valorEstimado };
}
