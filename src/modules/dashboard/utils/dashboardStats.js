import {
  calcularTotalItem,
  dinero,
  formatearFechaHora,
  normalizarTexto,
  obtenerCliente,
  obtenerCodigoPedido,
  obtenerEstadoPedido,
  obtenerItemsPedido,
  valorParaLlevarItem
} from "../../../shared/utils/pedidos";
import { crearContenidoBusquedaAvanzada, coincideBusquedaAvanzada } from "../../../shared/utils/busquedaAvanzada";

const MESAS_VALIDAS_RAFA = ["1a", "1b", "2a", "2b", "3a", "3b", "4a", "4b", "5b"];

function obtenerMesaValidaRafaDesdeTexto(texto) {
  const normalizado = normalizarTexto(texto).replace(/[^a-z0-9]+/g, " ").trim();
  if (!normalizado) return "";

  const tokens = normalizado.split(/\s+/);
  const encontrada = MESAS_VALIDAS_RAFA.find((mesa) => tokens.includes(mesa) || normalizado === mesa);
  return encontrada ? encontrada.toUpperCase() : "";
}

function obtenerMesaValidaRafaPedido(pedido) {
  const candidatos = [
    obtenerCliente(pedido),
    pedido.cliente,
    pedido.nombre_cliente,
    pedido.nombre,
    pedido.ubicacion,
    pedido.mesa,
    pedido.numero_mesa,
    pedido.mesa_numero
  ];

  for (const candidato of candidatos) {
    const mesa = obtenerMesaValidaRafaDesdeTexto(candidato);
    if (mesa) return mesa;
  }

  return "";
}

function obtenerLineaItemRafa(item) {
  return item?.categoria === "cafeteria" ? "Cafetería" : "Restaurante";
}

function crearResumenMesasVsLlevar(pedidos) {
  const resumen = {
    mesas: { restaurante: { total: 0, cantidad: 0 }, cafeteria: { total: 0, cantidad: 0 } },
    llevar: { restaurante: { total: 0, cantidad: 0 }, cafeteria: { total: 0, cantidad: 0 } },
    lista: new Map()
  };

  pedidos.forEach((pedido) => {
    const grupo = obtenerMesaValidaRafaPedido(pedido) ? "mesas" : "llevar";
    const grupoNombre = grupo === "mesas" ? "Pedidos en mesa" : "Pedidos para llevar";
    const items = obtenerItemsPedido(pedido);
    const totalesPorLinea = { restaurante: 0, cafeteria: 0 };

    if (!items.length) {
      totalesPorLinea.restaurante = Number(pedido.total) || 0;
    } else {
      items.forEach((item) => {
        const totalItem = calcularTotalItem(item);
        const linea = obtenerLineaItemRafa(item) === "Cafetería" ? "cafeteria" : "restaurante";
        totalesPorLinea[linea] += totalItem;
      });
    }

    Object.entries(totalesPorLinea).forEach(([claveLinea, totalLinea]) => {
      if (totalLinea <= 0) return;
      const lineaNombre = claveLinea === "cafeteria" ? "Cafetería" : "Restaurante";
      resumen[grupo][claveLinea].total += totalLinea;
      resumen[grupo][claveLinea].cantidad += 1;
      sumarEnMapa(resumen.lista, `${grupoNombre} · ${lineaNombre}`, 1, totalLinea);
    });
  });

  return {
    ...resumen,
    lista: ordenarResumen(resumen.lista)
  };
}


function sumarEnMapa(mapa, clave, cantidad, total) {
  const nombre = clave || "Sin clasificar";
  const actual = mapa.get(nombre) || { nombre, cantidad: 0, total: 0 };
  actual.cantidad += Number(cantidad) || 0;
  actual.total += Number(total) || 0;
  mapa.set(nombre, actual);
}

function ordenarResumen(mapa) {
  return Array.from(mapa.values()).sort((a, b) => b.total - a.total || b.cantidad - a.cantidad);
}

function obtenerGrupoAdicionalParaLlevar(item) {
  if (!item?.paraLlevar) return "";

  const tipo = normalizarTexto(item?.tipo);
  const categoria = normalizarTexto(item?.categoria);
  const nombre = normalizarTexto(item?.producto || item?.plato || item?.proteina || item?.nombre);

  if (categoria === "cafeteria" || tipo.includes("desayuno") || nombre.includes("desayuno")) {
    return valorParaLlevarItem(item) > 0 ? "Desayunos" : "";
  }

  if (categoria.includes("sopa") || ["sopa", "sancocho", "ajiaco", "mote", "mondongo"].some((palabra) => nombre.includes(palabra))) {
    return valorParaLlevarItem(item) > 0 ? "Sopas" : "";
  }

  return valorParaLlevarItem(item) > 0 ? "Almuerzos" : "";
}

export function crearResumenVentas(pedidos) {
  const resumen = {
    restaurante: { total: 0, cantidad: 0 },
    cafeteria: { total: 0, cantidad: 0 },
    subcategoriasCafeteria: new Map(),
    productosCafeteria: new Map(),
    proteinas: new Map(),
    acompanantes: new Map(),
    adicionalesParaLlevar: new Map(),
    tabla: new Map()
  };

  pedidos.forEach((pedido) => {
    const items = obtenerItemsPedido(pedido);

    if (!items.length) {
      const totalPedido = Number(pedido.total) || 0;
      resumen.restaurante.total += totalPedido;
      resumen.restaurante.cantidad += 1;
      sumarEnMapa(resumen.tabla, "Restaurante · Sin detalle", 1, totalPedido);
      return;
    }

    items.forEach((item) => {
      const cantidad = Number(item.cantidad) || 1;
      const totalItem = calcularTotalItem(item);
      const valorAdicionalParaLlevar = valorParaLlevarItem(item) * cantidad;
      const grupoAdicionalParaLlevar = obtenerGrupoAdicionalParaLlevar(item);
      if (grupoAdicionalParaLlevar && valorAdicionalParaLlevar > 0) {
        sumarEnMapa(resumen.adicionalesParaLlevar, grupoAdicionalParaLlevar, cantidad, valorAdicionalParaLlevar);
      }
      const esCafeteria = item.categoria === "cafeteria";

      if (esCafeteria) {
        const tipo = item.tipo || "Cafetería";
        resumen.cafeteria.total += totalItem;
        resumen.cafeteria.cantidad += cantidad;
        const productoCafeteria = obtenerFamiliaProductoCafeteriaRafa(item);
        const detalleProductoCafeteria = obtenerDetalleProductoCafeteriaRafa(item, productoCafeteria);
        sumarEnMapa(resumen.subcategoriasCafeteria, tipo, cantidad, totalItem);
        sumarDetalleEnMapa(resumen.productosCafeteria, productoCafeteria, detalleProductoCafeteria, cantidad, totalItem);
        sumarEnMapa(resumen.tabla, `Cafetería · ${tipo}`, cantidad, totalItem);
        return;
      }

      const proteina = item.plato || item.proteina || item.producto || "Almuerzo";
      const familiaProteina = obtenerFamiliaProteinaRafa(proteina);
      const presentacionProteina = obtenerPresentacionProteinaRafa(proteina, familiaProteina);
      resumen.restaurante.total += totalItem;
      resumen.restaurante.cantidad += cantidad;
      sumarDetalleEnMapa(resumen.proteinas, familiaProteina, presentacionProteina, cantidad, totalItem);
      sumarEnMapa(resumen.tabla, "Restaurante · Almuerzos", cantidad, totalItem);

      if (Array.isArray(item.acompanantes)) {
        item.acompanantes.forEach((acompanante) => {
          if (!acompanante) return;
          if (normalizarTexto(acompanante) === "con todo") return;
          sumarEnMapa(resumen.acompanantes, acompanante, cantidad, 0);
        });
      }
    });
  });

  return {
    restaurante: resumen.restaurante,
    cafeteria: resumen.cafeteria,
    subcategoriasCafeteria: ordenarResumen(resumen.subcategoriasCafeteria),
    productosCafeteria: ordenarResumenConDetalles(resumen.productosCafeteria),
    proteinas: ordenarResumenConDetalles(resumen.proteinas),
    acompanantes: ordenarResumen(resumen.acompanantes).sort((a, b) => b.cantidad - a.cantidad),
    adicionalesParaLlevar: ordenarResumen(resumen.adicionalesParaLlevar),
    tabla: ordenarResumen(resumen.tabla)
  };
}

function obtenerFamiliaProteinaRafa(nombreProducto) {
  const limpio = String(nombreProducto || "").replace(/\s+/g, " " ).trim();
  const texto = normalizarTexto(limpio);

  if (texto.includes("pechuga")) return "Pechugas";
  if (texto.includes("cerdo")) return "Cerdos";
  if (["sopa", "sopas", "sancocho", "ajiaco", "mote", "mondongo"].some((palabra) => texto.includes(palabra))) return "Sopas";

  return limpio || "Almuerzo";
}

function limpiarDetalleTexto(valor) {
  const limpio = String(valor || "").replace(/\s+/g, " " ).trim();
  if (!limpio) return "";
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

function obtenerPresentacionProteinaRafa(nombreProducto, familia) {
  const original = String(nombreProducto || "").replace(/\s+/g, " " ).trim();
  if (!original) return "";

  if (familia === "Sopas") {
    const detalleSopa = original
      .replace(/^sopas?\s*[|:-]?\s*/ig, "")
      .replace(/\s+/g, " " )
      .trim();
    return limpiarDetalleTexto(detalleSopa || original);
  }

  if (familia !== "Pechugas" && familia !== "Cerdos") return "";

  const detalle = original
    .replace(/pechuga\s+o\s+cerdo/ig, "")
    .replace(/pechugas?/ig, "")
    .replace(/cerdos?/ig, "")
    .replace(/^\s*[-–:|]+\s*/, "")
    .replace(/\s+/g, " " )
    .trim();

  return limpiarDetalleTexto(detalle);
}

function sumarDetalleEnMapa(mapa, clavePrincipal, claveDetalle, cantidad, total) {
  const nombre = clavePrincipal || "Sin clasificar";
  const detalleNombre = claveDetalle || "";
  const actual = mapa.get(nombre) || { nombre, cantidad: 0, total: 0, detallesMap: new Map() };
  actual.cantidad += Number(cantidad) || 0;
  actual.total += Number(total) || 0;

  if (detalleNombre && normalizarTexto(detalleNombre) !== normalizarTexto(nombre)) {
    const detalle = actual.detallesMap.get(detalleNombre) || { nombre: detalleNombre, cantidad: 0, total: 0 };
    detalle.cantidad += Number(cantidad) || 0;
    detalle.total += Number(total) || 0;
    actual.detallesMap.set(detalleNombre, detalle);
  }

  mapa.set(nombre, actual);
}

function ordenarResumenConDetalles(mapa) {
  return Array.from(mapa.values())
    .map((item) => ({
      nombre: item.nombre,
      cantidad: item.cantidad,
      total: item.total,
      detalles: Array.from((item.detallesMap || new Map()).values())
        .sort((a, b) => b.cantidad - a.cantidad || b.total - a.total || a.nombre.localeCompare(b.nombre))
    }))
    .sort((a, b) => b.cantidad - a.cantidad || b.total - a.total || a.nombre.localeCompare(b.nombre));
}

function obtenerFamiliaProductoCafeteriaRafa(item) {
  const base = item.producto || item.nombre || item.plato || item.proteina || item.tipo || "Producto cafetería";
  const texto = normalizarTexto(base);
  const tipo = normalizarTexto(item.tipo);

  if (texto.includes("parfait") || tipo.includes("parfait")) return "Parfaits";
  if (tipo.includes("cremoso") || texto.includes("cremoso")) return "Batidos cremosos";
  if (tipo.includes("refrescante") || texto.includes("refrescante")) return "Batidos refrescantes";
  if (tipo.includes("jugo tradicional") || tipo.includes("tradicional") || texto.includes("jugo tradicional") || texto.includes("tradicional")) return "Jugos tradicionales";
  if (texto.includes("batido") || tipo.includes("batido")) return "Batidos";

  return String(base || "Producto cafetería").replace(/\s+/g, " " ).trim();
}

function extraerTamanoCafeteriaRafa(item) {
  const candidatos = [item?.tamano, item?.producto, item?.nombre, item?.detalle_impresion].filter(Boolean);
  for (const candidato of candidatos) {
    const texto = String(candidato || "");
    const match = texto.match(/\b(12|16|22)\s*oz\b/i);
    if (match) return `${match[1]} oz`;
  }
  return "";
}

function limpiarSaborCafeteriaRafa(valor) {
  return limpiarDetalleTexto(
    String(valor || "")
      .replace(/^parfaits?\s*/ig, "")
      .replace(/^batidos?\s+cremosos?\s*/ig, "")
      .replace(/^batidos?\s+refrescantes?\s*/ig, "")
      .replace(/^jugos?\s+tradicional(es)?\s*/ig, "")
      .replace(/^batidos?\s*/ig, "")
      .replace(/\s+-\s+frutas?:.*$/ig, "")
      .replace(/\b(12|16|22)\s*oz\b/ig, "")
      .replace(/\s+/g, " " )
      .trim()
  );
}

function obtenerDetalleProductoCafeteriaRafa(item, familia) {
  if (!["Parfaits", "Batidos cremosos", "Batidos refrescantes", "Jugos tradicionales", "Batidos"].includes(familia)) {
    return "";
  }

  const tamano = extraerTamanoCafeteriaRafa(item);
  const base = item.producto || item.nombre || item.plato || item.proteina || "";
  const sabor = limpiarSaborCafeteriaRafa(base);

  if (tamano && sabor && !["Parfaits"].includes(familia)) return `${tamano} · ${sabor}`;
  if (tamano) return tamano;
  if (sabor && normalizarTexto(sabor) !== normalizarTexto(familia)) return sabor;

  return "";
}


function esPagoPendiente(tipoPago) {
  const texto = normalizarTexto(tipoPago);
  return ["pendiente", "credito", "fiado", "debe", "despues", "pagar despues", "por pagar"].some((palabra) => texto.includes(palabra));
}

function obtenerNombreProductoCliente(item) {
  const base = item.producto || item.plato || item.proteina || item.nombre || "Producto";
  const detalles = [];

  if (item.tipo && item.categoria === "cafeteria") detalles.push(item.tipo);
  if (item.tamano) detalles.push(item.tamano);
  if (item.base) detalles.push(`Base ${item.base}`);
  if (item.acompanante) detalles.push(item.acompanante);
  if (item.bebida) detalles.push(`Bebida ${item.bebida}`);

  return detalles.length ? `${base} · ${detalles.join(" · ")}` : base;
}

export function crearFilasClientes(pedidos) {
  return pedidos.flatMap((pedido) => {
    const items = obtenerItemsPedido(pedido);
    const cliente = obtenerCliente(pedido);
    const telefono = pedido.telefono || "";
    const formaPago = pedido.tipo_pago || "No especificado";
    const estado = obtenerEstadoPedido(pedido);
    const base = {
      idPedido: pedido.id || pedido.numero_pedido || pedido.created_at,
      codigo: obtenerCodigoPedido(pedido),
      fecha: pedido.created_at,
      cliente,
      telefono,
      formaPago,
      estado,
      pagoPendiente: esPagoPendiente(formaPago),
      ubicacion: pedido.ubicacion || pedido.mesa || "",
      observaciones: pedido.observaciones || ""
    };

    if (!items.length) {
      return [{
        ...base,
        producto: pedido.pedido_texto || "Pedido sin detalle de productos",
        cantidad: 1,
        total: Number(pedido.total) || 0
      }];
    }

    return items.map((item, index) => ({
      ...base,
      idFila: `${base.idPedido}-${index}`,
      producto: obtenerNombreProductoCliente(item),
      cantidad: Number(item.cantidad) || 1,
      total: calcularTotalItem(item),
      observaciones: item.observacionesItem || item.observacionAcompanantes || base.observaciones
    }));
  });
}

export function crearResumenClientes(filas) {
  const mapa = new Map();

  filas.forEach((fila) => {
    const clave = `${normalizarTexto(fila.cliente)}|${normalizarTexto(fila.telefono)}`;
    const actual = mapa.get(clave) || {
      clave,
      cliente: fila.cliente || "Cliente",
      telefono: fila.telefono || "",
      pedidos: new Set(),
      cantidad: 0,
      total: 0,
      pendiente: 0,
      ultimaCompra: fila.fecha
    };

    actual.pedidos.add(fila.codigo);
    actual.cantidad += Number(fila.cantidad) || 0;
    actual.total += Number(fila.total) || 0;
    if (fila.pagoPendiente) actual.pendiente += Number(fila.total) || 0;
    if (fila.fecha && (!actual.ultimaCompra || new Date(fila.fecha) > new Date(actual.ultimaCompra))) {
      actual.ultimaCompra = fila.fecha;
    }

    mapa.set(clave, actual);
  });

  return Array.from(mapa.values())
    .map((cliente) => ({ ...cliente, pedidos: cliente.pedidos.size }))
    .sort((a, b) => b.total - a.total || b.cantidad - a.cantidad);
}

function obtenerContenidoBusquedaCliente(fila) {
  return crearContenidoBusquedaAvanzada([
    fila.cliente,
    fila.telefono,
    fila.producto,
    fila.formaPago,
    fila.ubicacion,
    fila.codigo,
    fila.estado,
    fila.observaciones,
    fila.linea,
    fila.fecha,
    fila.pagoPendiente ? "pendiente credito fiado debe por pagar" : ""
  ]);
}

export function filtrarFilasClientes(filas, busqueda) {
  if (!busqueda) return filas;
  return filas.filter((fila) => coincideBusquedaAvanzada(obtenerContenidoBusquedaCliente(fila), busqueda));
}





function obtenerMesaPedido(pedido) {
  return obtenerMesaValidaRafaPedido(pedido);
}

function obtenerEtiquetaOrigenPedido(pedido) {
  return obtenerMesaValidaRafaPedido(pedido) ? "Pedidos en mesa" : "Pedidos para llevar";
}

function obtenerEtiquetaPagoPedido(pedido) {
  const pago = String(pedido.tipo_pago || pedido.forma_pago || pedido.metodo_pago || "No especificado").trim();
  return pago || "No especificado";
}


function obtenerEtiquetaMeseroPedido(pedido) {
  const mesero = String(pedido.mesero || pedido.nombre_mesero || pedido.atendido_por || "Sin mesero").trim();
  return mesero || "Sin mesero";
}

function obtenerHoraColombia(fecha) {
  if (!fecha) return null;
  try {
    const hora = new Intl.DateTimeFormat("es-CO", {
      timeZone: "America/Bogota",
      hour: "2-digit",
      hour12: false
    }).format(new Date(fecha));
    const numero = Number(hora);
    return Number.isFinite(numero) ? numero : null;
  } catch {
    return null;
  }
}

function etiquetaHoraDashboard(hora) {
  const sufijo = hora < 12 ? "a. m." : "p. m.";
  const hora12 = hora === 12 ? 12 : hora > 12 ? hora - 12 : hora;
  return `${hora12}:00 ${sufijo}`;
}

function crearMapaHorasDashboard() {
  const mapa = new Map();
  for (let hora = 7; hora <= 18; hora += 1) {
    const nombre = etiquetaHoraDashboard(hora);
    mapa.set(nombre, { nombre, cantidad: 0, total: 0, orden: hora });
  }
  return mapa;
}

export function crearDashboardRafa(pedidos, filasClientes, resumenClientes, resumenVentas) {
  const porHora = crearMapaHorasDashboard();
  const porPago = new Map();
  const porOrigen = new Map();
  const porEstado = new Map();
  const porProducto = new Map();
  const porMesa = new Map();
  const porMesero = new Map();
  const resumenMesasVsLlevar = crearResumenMesasVsLlevar(pedidos);

  pedidos.forEach((pedido) => {
    const totalPedido = Number(pedido.total) || obtenerItemsPedido(pedido).reduce((suma, item) => suma + calcularTotalItem(item), 0);
    const horaPedido = obtenerHoraColombia(pedido.created_at);
    if (horaPedido >= 7 && horaPedido <= 18) {
      sumarEnMapa(porHora, etiquetaHoraDashboard(horaPedido), 1, totalPedido);
    }
    sumarEnMapa(porPago, obtenerEtiquetaPagoPedido(pedido), 1, totalPedido);
    sumarEnMapa(porOrigen, obtenerEtiquetaOrigenPedido(pedido), 1, totalPedido);
    sumarEnMapa(porEstado, obtenerEstadoPedido(pedido), 1, totalPedido);
    sumarEnMapa(porMesero, obtenerEtiquetaMeseroPedido(pedido), 1, totalPedido);
    const mesa = obtenerMesaPedido(pedido);
    if (mesa) sumarEnMapa(porMesa, mesa, 1, totalPedido);
  });

  filasClientes.forEach((fila) => {
    sumarEnMapa(porProducto, fila.producto, Number(fila.cantidad) || 1, Number(fila.total) || 0);
  });

  const horas = Array.from(porHora.values()).sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const ventasPorPago = ordenarResumen(porPago);
  const ventasPorOrigen = ordenarResumen(porOrigen);
  const ventasPorEstado = ordenarResumen(porEstado);
  const ventasPorMesero = ordenarResumen(porMesero);
  const productosTop = ordenarResumen(porProducto);
  const mesasTop = ordenarResumen(porMesa);
  const mejorHora = ordenarResumen(porHora)[0] || null;
  const productoTop = productosTop[0] || null;
  const clienteTop = resumenClientes[0] || null;
  const mesaTop = mesasTop[0] || null;
  const totalVentas = (resumenVentas?.restaurante?.total || 0) + (resumenVentas?.cafeteria?.total || 0);
  const participacionRestaurante = totalVentas > 0 ? Math.round(((resumenVentas.restaurante.total || 0) / totalVentas) * 100) : 0;
  const participacionCafeteria = totalVentas > 0 ? Math.round(((resumenVentas.cafeteria.total || 0) / totalVentas) * 100) : 0;

  return {
    horas,
    ventasPorPago,
    ventasPorOrigen,
    ventasPorEstado,
    ventasPorMesero,
    productosTop,
    mesasTop,
    mejorHora,
    productoTop,
    clienteTop,
    mesaTop,
    resumenMesasVsLlevar,
    participacionRestaurante,
    participacionCafeteria
  };
}



function obtenerTotalPedidoRafa(pedido) {
  return Number(pedido.total) || obtenerItemsPedido(pedido).reduce((suma, item) => suma + calcularTotalItem(item), 0);
}

function obtenerProductosTextoPedido(pedido) {
  const items = obtenerItemsPedido(pedido);
  if (!items.length) return pedido.pedido_texto || "Sin detalle";
  return items.map((item) => {
    const cantidad = Number(item.cantidad) || 1;
    return `${cantidad} x ${obtenerNombreProductoCliente(item)}`;
  }).join(" · ");
}

function obtenerObservacionesPedidoRafa(pedido, item = null) {
  return item?.observacionesItem || item?.observacionAcompanantes || pedido.observaciones || pedido.nota || "";
}

function crearFilaPedidoProfunda(pedido) {
  const mesa = obtenerMesaValidaRafaPedido(pedido);
  return [
    obtenerCodigoPedido(pedido),
    formatearFechaHora(pedido.created_at),
    obtenerCliente(pedido),
    mesa || "Para llevar",
    obtenerProductosTextoPedido(pedido),
    obtenerEstadoPedido(pedido),
    obtenerEtiquetaPagoPedido(pedido),
    dinero(obtenerTotalPedidoRafa(pedido))
  ];
}

function crearFilasItemsProfundas(pedidosValidos, filtro = () => true) {
  return pedidosValidos
    .slice()
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .flatMap((pedido) => {
      const items = obtenerItemsPedido(pedido);
      const mesa = obtenerMesaValidaRafaPedido(pedido);
      const base = {
        codigo: obtenerCodigoPedido(pedido),
        fecha: formatearFechaHora(pedido.created_at),
        cliente: obtenerCliente(pedido),
        ubicacion: mesa || "Para llevar",
        estado: obtenerEstadoPedido(pedido),
        pago: obtenerEtiquetaPagoPedido(pedido)
      };

      if (!items.length) {
        const filaVirtual = { categoria: "restaurante", producto: pedido.pedido_texto || "Pedido sin detalle" };
        if (!filtro(pedido, filaVirtual)) return [];
        return [[base.codigo, base.fecha, base.cliente, base.ubicacion, "Restaurante", obtenerNombreProductoCliente(filaVirtual), 1, base.estado, base.pago, dinero(obtenerTotalPedidoRafa(pedido)), obtenerObservacionesPedidoRafa(pedido)]];
      }

      return items.filter((item) => filtro(pedido, item)).map((item) => [
        base.codigo,
        base.fecha,
        base.cliente,
        base.ubicacion,
        obtenerLineaItemRafa(item),
        obtenerNombreProductoCliente(item),
        Number(item.cantidad) || 1,
        base.estado,
        base.pago,
        dinero(calcularTotalItem(item)),
        obtenerObservacionesPedidoRafa(pedido, item)
      ]);
    });
}

function crearFilasPedidosProfundas(pedidosValidos, filtro = () => true) {
  return pedidosValidos
    .slice()
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .filter(filtro)
    .map(crearFilaPedidoProfunda);
}

export function crearDetalleDashboardSeleccionado(tipo, contexto) {
  if (!tipo) return null;

  const {
    pedidosValidos,
    resumenVentas,
    totalVentas,
    totalItemsVendidos,
    dashboardRafa
  } = contexto;

  const columnasPedidos = ["Pedido", "Fecha", "Cliente", "Ubicación", "Productos", "Estado", "Pago", "Total"];
  const columnasItems = ["Pedido", "Fecha", "Cliente", "Ubicación", "Línea", "Producto", "Cant.", "Estado", "Pago", "Total", "Obs."];

  if (tipo === "venta-linea") {
    return {
      titulo: "Detalle profundo · Venta por línea",
      descripcion: "Cada fila muestra los productos vendidos, separados por restaurante y cafetería.",
      resumen: [
        { label: "Restaurante", valor: `${resumenVentas.restaurante.cantidad} · ${dinero(resumenVentas.restaurante.total)}` },
        { label: "Cafetería", valor: `${resumenVentas.cafeteria.cantidad} · ${dinero(resumenVentas.cafeteria.total)}` },
        { label: "Total", valor: dinero(totalVentas) }
      ],
      columnas: columnasItems,
      filas: crearFilasItemsProfundas(pedidosValidos)
    };
  }

  if (tipo === "mesa-linea" || tipo === "llevar-linea") {
    const esMesa = tipo === "mesa-linea";
    const grupo = esMesa ? dashboardRafa.resumenMesasVsLlevar.mesas : dashboardRafa.resumenMesasVsLlevar.llevar;
    return {
      titulo: `Detalle profundo · ${esMesa ? "Pedidos en mesa" : "Pedidos para llevar"}`,
      descripcion: esMesa
        ? "Pedidos detectados como mesas válidas: 1A, 1B, 2A, 2B, 3A, 3B, 4A, 4B y 5B."
        : "Pedidos que no corresponden a las mesas válidas y se clasifican como para llevar.",
      resumen: [
        { label: "Restaurante", valor: `${grupo.restaurante.cantidad} · ${dinero(grupo.restaurante.total)}` },
        { label: "Cafetería", valor: `${grupo.cafeteria.cantidad} · ${dinero(grupo.cafeteria.total)}` },
        { label: "Total", valor: dinero(grupo.restaurante.total + grupo.cafeteria.total) }
      ],
      columnas: columnasItems,
      filas: crearFilasItemsProfundas(pedidosValidos, (pedido) => Boolean(obtenerMesaValidaRafaPedido(pedido)) === esMesa)
    };
  }

  if (tipo === "horas") {
    return {
      titulo: "Detalle profundo · Ventas por hora",
      descripcion: "Pedidos reales del periodo, ordenados del más reciente al más antiguo, con hora y detalle del pedido.",
      resumen: [
        { label: "Total vendido", valor: dinero(totalVentas) },
        { label: "Horas con venta", valor: dashboardRafa.horas.length },
        { label: "Mejor hora", valor: dashboardRafa.mejorHora ? `${dashboardRafa.mejorHora.nombre} · ${dinero(dashboardRafa.mejorHora.total)}` : "Sin datos" }
      ],
      columnas: ["Hora", ...columnasPedidos],
      filas: pedidosValidos
        .slice()
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .map((pedido) => [`${obtenerHoraColombia(pedido.created_at)}:00`, ...crearFilaPedidoProfunda(pedido)])
    };
  }

  if (tipo === "productos") {
    return {
      titulo: "Detalle profundo · Top productos",
      descripcion: "Productos vendidos con el pedido, cliente, ubicación y observación asociada.",
      resumen: [
        { label: "Unidades", valor: totalItemsVendidos },
        { label: "Productos diferentes", valor: dashboardRafa.productosTop.length },
        { label: "Total vendido", valor: dinero(totalVentas) }
      ],
      columnas: columnasItems,
      filas: crearFilasItemsProfundas(pedidosValidos)
    };
  }

  if (tipo === "mesas-top") {
    return {
      titulo: "Detalle profundo · Mesas que más venden",
      descripcion: "Pedidos de mesas válidas con productos, cliente, estado, pago y total.",
      resumen: [
        { label: "Mesas con venta", valor: dashboardRafa.mesasTop.length },
        { label: "Mesa líder", valor: dashboardRafa.mesaTop ? `${dashboardRafa.mesaTop.nombre} · ${dinero(dashboardRafa.mesaTop.total)}` : "Sin datos" }
      ],
      columnas: ["Mesa", ...columnasPedidos],
      filas: pedidosValidos
        .slice()
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .filter((pedido) => obtenerMesaValidaRafaPedido(pedido))
        .map((pedido) => [obtenerMesaValidaRafaPedido(pedido), ...crearFilaPedidoProfunda(pedido)])
    };
  }

  if (tipo === "origen-linea") {
    return {
      titulo: "Detalle profundo · Pedidos por línea y origen",
      descripcion: "Cuenta pedidos de restaurante y cafetería separados entre mesa y para llevar.",
      resumen: [
        { label: "Restaurante en mesa", valor: `${dashboardRafa.resumenMesasVsLlevar.mesas.restaurante.cantidad} · ${dinero(dashboardRafa.resumenMesasVsLlevar.mesas.restaurante.total)}` },
        { label: "Restaurante para llevar", valor: `${dashboardRafa.resumenMesasVsLlevar.llevar.restaurante.cantidad} · ${dinero(dashboardRafa.resumenMesasVsLlevar.llevar.restaurante.total)}` },
        { label: "Cafetería en mesa", valor: `${dashboardRafa.resumenMesasVsLlevar.mesas.cafeteria.cantidad} · ${dinero(dashboardRafa.resumenMesasVsLlevar.mesas.cafeteria.total)}` },
        { label: "Cafetería para llevar", valor: `${dashboardRafa.resumenMesasVsLlevar.llevar.cafeteria.cantidad} · ${dinero(dashboardRafa.resumenMesasVsLlevar.llevar.cafeteria.total)}` }
      ],
      columnas: columnasItems,
      filas: crearFilasItemsProfundas(pedidosValidos)
    };
  }

  if (tipo === "meseros") {
    return {
      titulo: "Detalle profundo · Ventas por mesero",
      descripcion: "Pedidos agrupados por mesero, con valor vendido y número de pedidos.",
      resumen: [
        { label: "Meseros detectados", valor: dashboardRafa.ventasPorMesero.length },
        { label: "Total vendido", valor: dinero(totalVentas) }
      ],
      columnas: ["Mesero", ...columnasPedidos],
      filas: pedidosValidos
        .slice()
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .map((pedido) => [obtenerEtiquetaMeseroPedido(pedido), ...crearFilaPedidoProfunda(pedido)])
    };
  }

  if (tipo === "pagos") {
    return {
      titulo: "Detalle profundo · Métodos de pago",
      descripcion: "Pedidos reales con método de pago para revisar efectivo, transferencia, pendientes o no especificados.",
      resumen: [
        { label: "Métodos detectados", valor: dashboardRafa.ventasPorPago.length },
        { label: "Total vendido", valor: dinero(totalVentas) }
      ],
      columnas: columnasPedidos,
      filas: crearFilasPedidosProfundas(pedidosValidos)
    };
  }

  if (tipo === "origen") {
    return {
      titulo: "Detalle profundo · Origen de pedidos",
      descripcion: "Pedidos reales clasificados como mesa o para llevar según cliente/ubicación.",
      resumen: [
        { label: "Pedidos en mesa", valor: dashboardRafa.resumenMesasVsLlevar.mesas.restaurante.cantidad + dashboardRafa.resumenMesasVsLlevar.mesas.cafeteria.cantidad },
        { label: "Para llevar", valor: dashboardRafa.resumenMesasVsLlevar.llevar.restaurante.cantidad + dashboardRafa.resumenMesasVsLlevar.llevar.cafeteria.cantidad },
        { label: "Total vendido", valor: dinero(totalVentas) }
      ],
      columnas: columnasPedidos,
      filas: crearFilasPedidosProfundas(pedidosValidos)
    };
  }

  return null;
}


