import { fechaISOColombia, generarId, normalizarTexto } from "./pedidos";
import { categoriasSolicitudProductos, productosRestauranteBase, STORAGE_INSUMOS_PENDIENTES } from "../../data/solicitudProductosData";

export function ordenarProductosPorNombre(productos) {
  return [...(productos || [])].sort((a, b) =>
    String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", { sensitivity: "base" })
  );
}

export function ordenarCategoriasPorLista(categorias) {
  return [...categorias].sort((a, b) => {
    const indiceA = categoriasSolicitudProductos.indexOf(a);
    const indiceB = categoriasSolicitudProductos.indexOf(b);
    if (indiceA !== -1 && indiceB !== -1) return indiceA - indiceB;
    if (indiceA !== -1) return -1;
    if (indiceB !== -1) return 1;
    return String(a).localeCompare(String(b), "es", { sensitivity: "base" });
  });
}


export function fechaMananaColombia() {
  const base = new Date(`${fechaISOColombia()}T00:00:00-05:00`);
  base.setDate(base.getDate() + 1);
  return fechaISOColombia(base);
}

export function crearProductosSolicitudInicial() {
  return ordenarProductosPorNombre(productosRestauranteBase).map((producto) => ({
    id: generarId("insumo-base"),
    categoria: producto.categoria,
    nombre: producto.nombre,
    cantidad: "",
    unidad: "und",
    nota: "",
    seleccionada: false
  }));
}

export function agruparProductosSolicitud(productos) {
  const grupos = (productos || []).reduce((resultado, producto) => {
    const categoria = producto.categoria || "Productos";

    if (!resultado[categoria]) {
      resultado[categoria] = [];
    }

    resultado[categoria].push(producto);
    return resultado;
  }, {});

  return ordenarCategoriasPorLista(Object.keys(grupos)).reduce((ordenado, categoria) => {
    ordenado[categoria] = ordenarProductosPorNombre(grupos[categoria]);
    return ordenado;
  }, {});
}


export function obtenerProductosSolicitudSeleccionados(productos) {
  return (productos || [])
    .map((producto) => ({
      ...producto,
      seleccionada: Boolean(producto.seleccionada),
      cantidad: String(producto.cantidad || "").trim(),
      unidad: String(producto.unidad || "und").trim(),
      nota: String(producto.nota || "").trim()
    }))
    .filter((producto) => producto.seleccionada);
}

export function crearMensajeSolicitudProductos({ fechaSolicitud, fechaPara, productos, observaciones }) {
  const grupos = agruparProductosSolicitud(productos);
  const lineas = [
    "Hola, esta es la solicitud de insumos para Rafiki:",
    "",
    `Fecha de solicitud: ${fechaSolicitud}`,
    `Insumos requeridos para: ${fechaPara}`,
    "",
    "Listado solicitado:"
  ];

  Object.entries(grupos).forEach(([categoria, items]) => {
    lineas.push("", `*${categoria}*`);

    items.forEach((item) => {
      const cantidad = String(item.cantidad || "").trim();
      const unidad = String(item.unidad || "und").trim();
      const cantidadTexto = cantidad ? `: ${cantidad}${unidad ? ` ${unidad}` : ""}` : "";
      const nota = item.nota ? ` — ${item.nota}` : "";
      lineas.push(`• ${item.nombre}${cantidadTexto}${nota}`);
    });
  });

  if (observaciones) {
    lineas.push("", `Observaciones: ${observaciones}`);
  }

  return lineas.join("\n");
}


export function crearClaveProducto(nombre) {
  return normalizarTexto(nombre).replace(/\s+/g, "-");
}

export function cargarEstadoPendientesCompra() {
  try {
    const guardado = localStorage.getItem(STORAGE_INSUMOS_PENDIENTES);
    return guardado ? JSON.parse(guardado) : {};
  } catch {
    return {};
  }
}

export function obtenerJornadaInsumos(fecha = new Date()) {
  const horaTexto = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    hour12: false,
    hourCycle: "h23"
  }).format(fecha);
  const hora = Number(horaTexto);
  return hora < 12 ? "AM" : "PM";
}

export function obtenerHoraInsumosColombia(fecha = new Date()) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23"
  }).format(fecha);
}

function normalizarJornadaInsumos(valor) {
  const texto = String(valor || "").trim().toUpperCase();
  if (texto === "AM" || texto === "PM") return texto;
  if (texto.includes("MAÑANA") || texto.includes("MANANA")) return "AM";
  if (texto.includes("TARDE") || texto.includes("NOCHE")) return "PM";
  return "";
}

function obtenerJornadaProductoSolicitud(producto = {}, solicitud = {}) {
  const directa = normalizarJornadaInsumos(
    producto.jornadaSolicitud ||
      producto.jornada_solicitud ||
      producto.jornada ||
      solicitud.jornadaSolicitud ||
      solicitud.jornada_solicitud ||
      solicitud.jornada
  );

  if (directa) return directa;

  const horaTexto = String(
    producto.horaSolicitud ||
      producto.hora_solicitud ||
      producto.solicitadoEn ||
      solicitud.horaSolicitud ||
      solicitud.hora_solicitud ||
      solicitud.created_at ||
      ""
  );

  const horaMatch = horaTexto.match(/(?:T|\s|^)(\d{1,2}):\d{2}/);
  if (!horaMatch) return "";

  const hora = Number(horaMatch[1]);
  if (!Number.isFinite(hora)) return "";

  return hora < 12 ? "AM" : "PM";
}

export function guardarEstadoPendientesCompra(estado) {
  try {
    localStorage.setItem(STORAGE_INSUMOS_PENDIENTES, JSON.stringify(estado));
  } catch {
    // Si el navegador bloquea localStorage, la app sigue funcionando en memoria.
  }
}

export function obtenerInsumosDeSolicitud(solicitud) {
  if (Array.isArray(solicitud?.insumos)) return solicitud.insumos;
  // Compatibilidad temporal por si existe alguna solicitud antigua con columna productos.
  if (Array.isArray(solicitud?.productos)) return solicitud.productos;
  return [];
}

export function obtenerProductosPendientesDesdeSolicitudes(solicitudes, fechaBase = fechaISOColombia()) {
  const mapa = new Map();

  (solicitudes || []).forEach((solicitud) => {
    const productos = obtenerInsumosDeSolicitud(solicitud);

    productos.forEach((producto) => {
      const nombre = String(producto.nombre || "").trim();
      if (!nombre) return;

      const fechaSolicitudBase = String(solicitud.fecha_solicitud || solicitud.created_at || fechaBase).slice(0, 10);
      const claveProducto = crearClaveProducto(nombre);
      const clave = `${fechaSolicitudBase}-${claveProducto}`;
      const existente = mapa.get(clave) || {
        id: clave,
        nombre,
        categoria: producto.categoria || "Productos",
        vecesSolicitado: 0,
        fechas: [],
        jornadas: [],
        fechaSolicitud: fechaSolicitudBase
      };

      existente.vecesSolicitado += 1;

      const fecha = solicitud.fecha_para || solicitud.fecha_solicitud || solicitud.created_at;
      if (fecha && !existente.fechas.includes(fecha)) {
        existente.fechas.push(fecha);
      }

      const jornada = obtenerJornadaProductoSolicitud(producto, solicitud);
      if (jornada && !existente.jornadas.includes(jornada)) {
        existente.jornadas.push(jornada);
      }

      existente.jornadaSolicitud = existente.jornadas.length ? existente.jornadas.join("/") : "";

      mapa.set(clave, existente);
    });
  });

  return Array.from(mapa.values()).sort((a, b) => {
    const categoriaA = categoriasSolicitudProductos.indexOf(a.categoria);
    const categoriaB = categoriasSolicitudProductos.indexOf(b.categoria);
    const ordenCategoriaA = categoriaA === -1 ? 999 : categoriaA;
    const ordenCategoriaB = categoriaB === -1 ? 999 : categoriaB;

    if (ordenCategoriaA !== ordenCategoriaB) return ordenCategoriaA - ordenCategoriaB;
    return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
  });
}

export function crearMensajeCompraProveedores(productos) {
  return productos
    .map((producto) => {
      const cantidad = String(producto.cantidadComprar || "").trim();
      return `• ${producto.nombre}${cantidad ? ` : ${cantidad}` : ""}`;
    })
    .join("\n");
}

