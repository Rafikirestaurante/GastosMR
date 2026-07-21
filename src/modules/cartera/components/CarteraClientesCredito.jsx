import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  activarClienteCredito,
  crearClienteCredito,
  desactivarClienteCredito,
  editarClienteCredito,
  listarClientesCredito,
} from "../../../services/clientesCreditoService";
import {
  listarAbonosCartera,
  listarMovimientosCartera,
  registrarAbonoClienteCredito,
  sincronizarCarteraCompleta,
} from "../../../services/carteraService";
import RafikiActionMenu from "../../../shared/components/RafikiActionMenu";
import RafikiBadge from "../../../shared/components/RafikiBadge";
import RafikiEmptyState from "../../../shared/components/RafikiEmptyState";
import RafikiModal from "../../../shared/components/RafikiModal";
import RafikiTabs from "../../../shared/components/RafikiTabs";
import { describirErrorSupabase, registrarErrorSupabase } from "../../../shared/utils/supabaseErrors";
import { FORMAS_PAGO_ABONO_CARTERA, METODOS_PAGO } from "../../../shared/constants/paymentMethods";
import { aPesosEnteros } from "../../../shared/utils/money";
import {
  esHoyColombia,
  fechaColombiaHaceDias,
  fechaColombiaYYYYMMDD,
  fechaDentroRangoColombia,
  formatearFechaColombia,
  formatearFechaHoraColombia,
} from "../../../shared/utils/fechasColombia";
import { listarPedidosPorCliente } from "../../../services/pedidosService";
import { formatearFechaTermica, imprimirReporteTermico } from "../../impresion/thermalReportService";
import ThermalPrintControls from "../../impresion/ThermalPrintControls";

const FORM_INICIAL = {
  nombre: "",
  telefono: "",
  observaciones: "",
};

const FILTROS_INICIALES = {
  texto: "",
  estado: "todos",
  clienteId: "",
  fechaInicio: "",
  fechaFin: "",
  soloConSaldo: true,
};

const METODOS_ABONO = FORMAS_PAGO_ABONO_CARTERA;

const VISTA_CARTERA_INICIAL = "resumen";

const ABONO_INICIAL = {
  valorAbono: "",
  metodoPago: METODOS_PAGO.EFECTIVO,
  observacion: "",
  fechaAbono: fechaColombiaYYYYMMDD(),
};

function dinero(valor) {
  return Number(valor || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function resumirPorEstadoMovimientos(movimientos = []) {
  const mapa = new Map();
  (Array.isArray(movimientos) ? movimientos : []).forEach((movimiento) => {
    const estado = estadoCartera(movimiento);
    const actual = mapa.get(estado) || { cantidad: 0, valor: 0, saldo: 0 };
    actual.cantidad += 1;
    if (estado !== "anulado") actual.valor += aPesosEnteros(movimiento.valor);
    if (movimientoPendiente(movimiento)) actual.saldo += saldoMovimiento(movimiento);
    mapa.set(estado, actual);
  });

  return Array.from(mapa.entries())
    .sort(([a], [b]) => String(a).localeCompare(String(b), "es", { sensitivity: "base" }))
    .map(([estado, datos]) => ({
      etiqueta: `${estado} (${datos.cantidad})`,
      valor: `${dinero(datos.valor)} · saldo ${dinero(datos.saldo)}`,
    }));
}

function resumirAbonosPorMetodo(abonos = []) {
  const mapa = new Map();
  (Array.isArray(abonos) ? abonos : []).forEach((abono) => {
    const metodo = String(abono.metodo_pago || abono.metodoPago || "Sin método").trim() || "Sin método";
    const actual = mapa.get(metodo) || { cantidad: 0, total: 0 };
    actual.cantidad += 1;
    actual.total += aPesosEnteros(abono.valor_abono);
    mapa.set(metodo, actual);
  });

  return Array.from(mapa.entries())
    .sort(([a], [b]) => String(a).localeCompare(String(b), "es", { sensitivity: "base" }))
    .map(([metodo, datos]) => ({
      etiqueta: `${metodo} (${datos.cantidad})`,
      valor: dinero(datos.total),
    }));
}


function escaparHtmlExcel(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function descargarArchivo(nombreArchivo, contenido, tipo = "application/vnd.ms-excel;charset=utf-8") {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

function nombreArchivoSeguro(valor) {
  return normalizarTexto(valor || "cartera")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "cartera";
}

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatearFecha(valor) {
  return formatearFechaColombia(valor);
}

function formatearFechaHora(valor) {
  return formatearFechaHoraColombia(valor);
}

function fechaDentroRango(valor, fechaInicio, fechaFin) {
  return fechaDentroRangoColombia(valor, fechaInicio, fechaFin);
}

function estadoCartera(movimiento) {
  return String(movimiento?.estado || "pendiente").trim().toLowerCase();
}

function saldoMovimiento(movimiento) {
  return Number(movimiento?.saldo_movimiento ?? movimiento?.valor ?? 0) || 0;
}

function movimientoPendiente(movimiento) {
  const estado = estadoCartera(movimiento);
  return estado !== "pagado" && estado !== "anulado" && saldoMovimiento(movimiento) > 0;
}

function telefonoWhatsApp(telefono) {
  const digitos = String(telefono || "").replace(/\D/g, "");
  if (!digitos) return "";
  if (digitos.length === 10) return `57${digitos}`;
  return digitos;
}

function resumirLineaPedidoTexto(texto = "") {
  return String(texto || "")
    .split(/\n+/)
    .map((linea) => linea.replace(/^[-•*\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" · ");
}

function nombreItemPedidoCompacto(item = {}) {
  const nombre = item.detalle_impresion
    || item.producto
    || item.nombre
    || item.plato
    || item.proteina
    || item.tipo
    || "Producto";
  const cantidad = Number(item.cantidad) || 1;
  const acompanantes = Array.isArray(item.acompanantes) && item.acompanantes.length > 0
    ? ` · ${item.acompanantes.slice(0, 3).join(", ")}`
    : "";
  const tamano = item.tamano ? ` · ${item.tamano}` : "";
  return `${cantidad} x ${nombre}${tamano}${acompanantes}`;
}

function resumenPedidoMovimiento(movimiento = {}) {
  const items = Array.isArray(movimiento.pedido_items) ? movimiento.pedido_items : [];
  if (items.length > 0) {
    const resumen = items.slice(0, 3).map(nombreItemPedidoCompacto).join(" + ");
    const restantes = items.length > 3 ? ` + ${items.length - 3} más` : "";
    return `${resumen}${restantes}`;
  }

  const textoPedido = resumirLineaPedidoTexto(movimiento.pedido_texto_detalle);
  if (textoPedido) return textoPedido;

  return movimiento.concepto || "Pedido crédito";
}

function textoBusquedaMovimiento(movimiento) {
  return [
    movimiento.numero_pedido,
    movimiento.cliente_nombre,
    movimiento.concepto,
    resumenPedidoMovimiento(movimiento),
    movimiento.estado,
    movimiento.observaciones,
  ]
    .filter(Boolean)
    .join(" ");
}

function conTiempoMaximo(promesa, ms = 18000, nombre = "consulta") {
  let timerId = null;
  const timeout = new Promise((_, reject) => {
    timerId = window.setTimeout(() => {
      reject(new Error(`${nombre} tardó demasiado en responder. Revisa la conexión e intenta actualizar nuevamente.`));
    }, ms);
  });

  return Promise.race([promesa, timeout]).finally(() => {
    if (timerId) window.clearTimeout(timerId);
  });
}

export default function CarteraClientesCredito() {
  const [clientes, setClientes] = useState([]);
  const [movimientosCartera, setMovimientosCartera] = useState([]);
  const [abonosCartera, setAbonosCartera] = useState([]);
  const [busquedaClientes, setBusquedaClientes] = useState("");
  const [mostrarInactivos, setMostrarInactivos] = useState(true);
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [cargando, setCargando] = useState(false);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);
  const [cargandoAbonos, setCargandoAbonos] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [auditando, setAuditando] = useState(false);
  const [resultadoAuditoria, setResultadoAuditoria] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [formulario, setFormulario] = useState(FORM_INICIAL);
  const [clienteEditandoId, setClienteEditandoId] = useState(null);
  const [clienteDetalleId, setClienteDetalleId] = useState(null);
  const [clienteAbonoId, setClienteAbonoId] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [formularioAbono, setFormularioAbono] = useState(ABONO_INICIAL);
  const [abonoPendienteConfirmacion, setAbonoPendienteConfirmacion] = useState(null);
  const [vistaCartera, setVistaCartera] = useState(VISTA_CARTERA_INICIAL);
  const [mostrarRankings, setMostrarRankings] = useState(false);
  const [pedidosClienteDetalle, setPedidosClienteDetalle] = useState([]);
  const [cargandoPedidosCliente, setCargandoPedidosCliente] = useState(false);
  const [errorPedidosCliente, setErrorPedidosCliente] = useState("");

  const cargarClientes = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const data = await conTiempoMaximo(
        listarClientesCredito({ busqueda: busquedaClientes, incluirInactivos: mostrarInactivos }),
        15000,
        "Clientes de cartera"
      );
      setClientes(Array.isArray(data) ? data : []);
    } catch (err) {
      registrarErrorSupabase("cargar clientes crédito", err);
      setError(describirErrorSupabase(err, "cargar los clientes de cartera"));
      setClientes([]);
    } finally {
      setCargando(false);
    }
  }, [busquedaClientes, mostrarInactivos]);

  const cargarMovimientos = useCallback(async ({ sincronizar = false } = {}) => {
    setCargandoMovimientos(true);
    try {
      let resultadoSync = null;
      if (sincronizar) {
        resultadoSync = await conTiempoMaximo(
          sincronizarCarteraCompleta({ limite: 2000 }),
          30000,
          "Auditoría automática de cartera"
        );
        setResultadoAuditoria(resultadoSync);
        if (Number(resultadoSync?.totalCorrecciones || 0) > 0) {
          setMensaje(`Auditoría aplicada: ${resultadoSync.totalCorrecciones} corrección(es), ${resultadoSync.anulados} movimiento(s) anulados y ${resultadoSync.valoresAjustados} saldo(s) ajustados.`);
        }
      }

      const data = await conTiempoMaximo(
        listarMovimientosCartera({ estado: "todos", limite: 2000 }),
        18000,
        "Movimientos de cartera"
      );
      setMovimientosCartera(Array.isArray(data) ? data : []);

      if (Number(resultadoSync?.totalCorrecciones || 0) > 0) {
        await cargarClientes();
      }
    } catch (err) {
      registrarErrorSupabase("cargar movimientos de cartera", err);
      setError(describirErrorSupabase(err, "cargar los movimientos de cartera"));
      setMovimientosCartera([]);
    } finally {
      setCargandoMovimientos(false);
    }
  }, [cargarClientes]);

  const cargarAbonos = useCallback(async () => {
    setCargandoAbonos(true);
    try {
      const data = await conTiempoMaximo(
        listarAbonosCartera({ limite: 1500 }),
        15000,
        "Abonos de cartera"
      );
      setAbonosCartera(Array.isArray(data) ? data : []);
    } catch (err) {
      registrarErrorSupabase("cargar abonos de cartera", err);
      setError(describirErrorSupabase(err, "cargar los abonos de cartera"));
      setAbonosCartera([]);
    } finally {
      setCargandoAbonos(false);
    }
  }, []);

  const actualizarTodo = useCallback(async () => {
    setMensaje("");
    await Promise.allSettled([cargarClientes(), cargarMovimientos({ sincronizar: false }), cargarAbonos()]);
  }, [cargarClientes, cargarMovimientos, cargarAbonos]);

  const auditarCartera = useCallback(async () => {
    if (auditando) return;
    setAuditando(true);
    setMensaje("");
    setError("");
    try {
      const resultado = await conTiempoMaximo(
        sincronizarCarteraCompleta({ limite: 3000 }),
        45000,
        "Auditoría manual de cartera"
      );
      setResultadoAuditoria(resultado);
      await Promise.all([cargarClientes(), cargarMovimientos({ sincronizar: false }), cargarAbonos()]);
      if (Number(resultado?.totalCorrecciones || 0) > 0) {
        setMensaje(`Auditoría finalizada: ${resultado.totalCorrecciones} corrección(es), ${resultado.anulados} movimiento(s) anulados, ${resultado.valoresAjustados} saldo(s) ajustados y ${resultado.clientesRecalculados?.length || 0} cliente(s) recalculados.`);
      } else {
        setMensaje("Auditoría finalizada: no se encontraron diferencias. La cartera está sincronizada.");
      }
    } catch (err) {
      registrarErrorSupabase("completar auditoría de cartera", err);
      setError(describirErrorSupabase(err, "completar la auditoría de cartera"));
    } finally {
      setAuditando(false);
    }
  }, [auditando, cargarAbonos, cargarClientes, cargarMovimientos]);

  useEffect(() => {
    cargarClientes();
  }, [cargarClientes]);

  useEffect(() => {
    cargarMovimientos();
  }, [cargarMovimientos]);

  useEffect(() => {
    cargarAbonos();
  }, [cargarAbonos]);

  const clienteEditando = useMemo(
    () => clientes.find((cliente) => cliente.id === clienteEditandoId) || null,
    [clientes, clienteEditandoId]
  );

  const clienteDetalle = useMemo(
    () => clientes.find((cliente) => cliente.id === clienteDetalleId) || null,
    [clientes, clienteDetalleId]
  );

  const clienteAbono = useMemo(
    () => clientes.find((cliente) => cliente.id === clienteAbonoId) || null,
    [clientes, clienteAbonoId]
  );

  const cargarPedidosClienteDetalle = useCallback(async (clienteSeleccionado) => {
    if (!clienteSeleccionado?.nombre) {
      setPedidosClienteDetalle([]);
      setErrorPedidosCliente("");
      return;
    }

    setCargandoPedidosCliente(true);
    setErrorPedidosCliente("");

    try {
      const { data, error: errorConsulta } = await listarPedidosPorCliente(clienteSeleccionado.nombre, { limite: 120 });
      if (errorConsulta) {
        registrarErrorSupabase("listar pedidos por cliente cartera", errorConsulta);
        setErrorPedidosCliente(describirErrorSupabase(errorConsulta, "consultar los pedidos del cliente"));
        setPedidosClienteDetalle([]);
        return;
      }
      setPedidosClienteDetalle(Array.isArray(data) ? data : []);
    } catch (err) {
      registrarErrorSupabase("listar pedidos por cliente cartera", err);
      setErrorPedidosCliente(describirErrorSupabase(err, "consultar los pedidos del cliente"));
      setPedidosClienteDetalle([]);
    } finally {
      setCargandoPedidosCliente(false);
    }
  }, []);

  useEffect(() => {
    if (clienteDetalle) {
      cargarPedidosClienteDetalle(clienteDetalle);
    } else {
      setPedidosClienteDetalle([]);
      setErrorPedidosCliente("");
    }
  }, [cargarPedidosClienteDetalle, clienteDetalle]);

  const hayFiltroFechaMovimientos = Boolean(filtros.fechaInicio || filtros.fechaFin);

  const movimientosFiltrados = useMemo(() => {
    const texto = normalizarTexto(filtros.texto);

    return movimientosCartera.filter((movimiento) => {
      const estado = estadoCartera(movimiento);
      if (filtros.estado !== "todos" && estado !== filtros.estado) return false;
      if (filtros.clienteId && String(movimiento.cliente_credito_id || "") !== String(filtros.clienteId)) return false;
      if (!fechaDentroRango(movimiento.fecha_movimiento || movimiento.created_at, filtros.fechaInicio, filtros.fechaFin)) return false;
      if (texto && !normalizarTexto(textoBusquedaMovimiento(movimiento)).includes(texto)) return false;
      return true;
    });
  }, [filtros, movimientosCartera]);

  const clientesVisibles = useMemo(() => {
    const texto = normalizarTexto(busquedaClientes);
    return clientes.filter((cliente) => {
      if (!mostrarInactivos && cliente.activo === false) return false;
      if (filtros.soloConSaldo && Number(cliente.saldo_pendiente || 0) <= 0) return false;
      if (!texto) return true;
      return normalizarTexto([
        cliente.nombre,
        cliente.telefono,
        cliente.observaciones,
        ...(Array.isArray(cliente.alias) ? cliente.alias : []),
      ].filter(Boolean).join(" ")).includes(texto);
    });
  }, [busquedaClientes, clientes, filtros.soloConSaldo, mostrarInactivos]);

  const clientesParaFiltroMovimientos = useMemo(() => {
    return [...clientes]
      .filter((cliente) => cliente?.id && cliente?.nombre)
      .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", { sensitivity: "base" }));
  }, [clientes]);

  const clienteFiltradoMovimientos = useMemo(() => {
    if (!filtros.clienteId) return null;
    return clientes.find((cliente) => String(cliente.id || "") === String(filtros.clienteId)) || null;
  }, [clientes, filtros.clienteId]);

  const indicadores = useMemo(() => {
    const activos = clientes.filter((cliente) => cliente.activo !== false);
    const clientesConSaldo = clientes.filter((cliente) => Number(cliente.saldo_pendiente || 0) > 0);
    const saldoTotal = clientes.reduce((total, cliente) => total + Number(cliente.saldo_pendiente || 0), 0);
    const pedidosPendientes = movimientosCartera.filter(movimientoPendiente).length;
    const carteraPagada = abonosCartera.reduce((total, abono) => total + Number(abono.valor_abono || 0), 0);
    const creditosOtorgadosHoy = movimientosCartera.reduce((total, movimiento) => {
      if (estadoCartera(movimiento) === "anulado") return total;
      if (!esHoyColombia(movimiento.fecha_movimiento || movimiento.created_at)) return total;
      return total + aPesosEnteros(movimiento.valor);
    }, 0);
    const abonosRecibidosHoy = abonosCartera.reduce((total, abono) => {
      if (!esHoyColombia(abono.fecha_abono || abono.created_at)) return total;
      return total + aPesosEnteros(abono.valor_abono);
    }, 0);
    const valorOriginalFiltrado = movimientosFiltrados.reduce((total, movimiento) => {
      if (estadoCartera(movimiento) === "anulado") return total;
      return total + aPesosEnteros(movimiento.valor);
    }, 0);
    const saldoFiltrado = movimientosFiltrados.reduce((total, movimiento) => {
      if (!movimientoPendiente(movimiento)) return total;
      return total + saldoMovimiento(movimiento);
    }, 0);

    return {
      activos: activos.length,
      clientesConSaldo: clientesConSaldo.length,
      saldoTotal,
      pedidosPendientes,
      carteraPagada,
      abonosRecibidos: abonosCartera.length,
      creditosOtorgadosHoy,
      abonosRecibidosHoy,
      valorOriginalFiltrado,
      saldoFiltrado,
      movimientosFiltrados: movimientosFiltrados.length,
    };
  }, [abonosCartera, clientes, movimientosCartera, movimientosFiltrados]);

  const rankingClientes = useMemo(() => {
    const activos = clientes.filter((cliente) => cliente.activo !== false);
    const topSaldo = [...activos]
      .filter((cliente) => Number(cliente.saldo_pendiente || 0) > 0)
      .sort((a, b) => Number(b.saldo_pendiente || 0) - Number(a.saldo_pendiente || 0))
      .slice(0, 5);
    const recientes = [...activos]
      .filter((cliente) => cliente.fecha_ultimo_pedido)
      .sort((a, b) => new Date(b.fecha_ultimo_pedido).getTime() - new Date(a.fecha_ultimo_pedido).getTime())
      .slice(0, 5);
    const sinTelefono = [...activos]
      .filter((cliente) => Number(cliente.saldo_pendiente || 0) > 0 && !String(cliente.telefono || "").trim())
      .sort((a, b) => Number(b.saldo_pendiente || 0) - Number(a.saldo_pendiente || 0))
      .slice(0, 5);
    return { topSaldo, recientes, sinTelefono };
  }, [clientes]);

  const movimientosClienteDetalle = useMemo(() => {
    if (!clienteDetalleId) return [];
    return movimientosFiltrados.filter((movimiento) => movimiento.cliente_credito_id === clienteDetalleId);
  }, [clienteDetalleId, movimientosFiltrados]);

  const abonosClienteDetalle = useMemo(() => {
    if (!clienteDetalleId) return [];
    return abonosCartera.filter((abono) => abono.cliente_credito_id === clienteDetalleId);
  }, [abonosCartera, clienteDetalleId]);

  const resumenDetalle = useMemo(() => {
    const total = movimientosClienteDetalle.reduce((acum, movimiento) => acum + Number(movimiento.valor || 0), 0);
    const saldo = movimientosClienteDetalle.reduce((acum, movimiento) => {
      if (!movimientoPendiente(movimiento)) return acum;
      return acum + saldoMovimiento(movimiento);
    }, 0);
    const pendientes = movimientosClienteDetalle.filter(movimientoPendiente).length;
    const abonado = abonosClienteDetalle.reduce((acum, abono) => acum + Number(abono.valor_abono || 0), 0);
    return { total, saldo, pendientes, abonado };
  }, [abonosClienteDetalle, movimientosClienteDetalle]);

  function limpiarFormulario() {
    setFormulario(FORM_INICIAL);
    setClienteEditandoId(null);
    setMostrarFormulario(false);
  }

  function abrirNuevoCliente() {
    setFormulario(FORM_INICIAL);
    setClienteEditandoId(null);
    setMostrarFormulario(true);
    setMensaje("");
    setError("");
  }

  function cambiarCampo(campo, valor) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  }

  function cambiarFiltro(campo, valor) {
    setFiltros((actual) => ({ ...actual, [campo]: valor }));
  }

  function filtrosBaseMovimientosConClienteActual() {
    return { ...FILTROS_INICIALES, clienteId: filtros.clienteId || "" };
  }

  function aplicarFiltroCreditosHoy() {
    const hoy = fechaColombiaYYYYMMDD();
    setFiltros({ ...filtrosBaseMovimientosConClienteActual(), estado: "todos", fechaInicio: hoy, fechaFin: hoy, soloConSaldo: false });
  }

  function aplicarFiltroAyer() {
    const ayer = fechaColombiaHaceDias(1);
    setFiltros({ ...filtrosBaseMovimientosConClienteActual(), estado: "todos", fechaInicio: ayer, fechaFin: ayer, soloConSaldo: false });
  }

  function aplicarFiltroUltimos7Dias() {
    setFiltros({
      ...filtrosBaseMovimientosConClienteActual(),
      estado: "todos",
      fechaInicio: fechaColombiaHaceDias(6),
      fechaFin: fechaColombiaYYYYMMDD(),
      soloConSaldo: false,
    });
  }

  function aplicarFiltroPendientes() {
    setFiltros({ ...filtrosBaseMovimientosConClienteActual(), estado: "pendiente", soloConSaldo: true });
  }


  function descripcionFiltrosMovimientos() {
    const partes = [];
    if (clienteFiltradoMovimientos?.nombre) partes.push(`Cliente: ${clienteFiltradoMovimientos.nombre}`);
    if (filtros.fechaInicio || filtros.fechaFin) partes.push(`Fechas: ${filtros.fechaInicio || "inicio"} a ${filtros.fechaFin || "hoy"}`);
    if (filtros.estado && filtros.estado !== "todos") partes.push(`Estado: ${filtros.estado}`);
    if (filtros.texto) partes.push(`Búsqueda: ${filtros.texto}`);
    return partes.length ? partes.join(" · ") : "Todos los movimientos filtrados";
  }

  function exportarMovimientosExcel() {
    const encabezados = ["Fecha", "Pedido", "Cliente", "Pedido realizado", "Valor", "Estado", "Saldo"];
    const filas = movimientosFiltrados.map((movimiento) => [
      formatearFechaHora(movimiento.fecha_movimiento || movimiento.created_at),
      movimiento.numero_pedido ? `#${movimiento.numero_pedido}` : "—",
      movimiento.cliente_nombre || "—",
      resumenPedidoMovimiento(movimiento),
      Number(movimiento.valor || 0),
      estadoCartera(movimiento),
      saldoMovimiento(movimiento),
    ]);

    const resumen = [
      ["Movimientos de cartera", ""],
      ["Fecha de exportación", formatearFechaHora(new Date())],
      ["Filtros", descripcionFiltrosMovimientos()],
      ["Movimientos", indicadores.movimientosFiltrados],
      ["Valor filtrado", indicadores.valorOriginalFiltrado],
      ["Saldo filtrado", indicadores.saldoFiltrado],
      ["", ""],
    ];

    const tabla = [...resumen, encabezados, ...filas]
      .map((fila, indiceFila) => `<tr>${fila.map((celda) => {
        const etiqueta = indiceFila === resumen.length ? "th" : "td";
        return `<${etiqueta}>${escaparHtmlExcel(celda)}</${etiqueta}>`;
      }).join("")}</tr>`)
      .join("");

    const contenido = `<!doctype html>
<html>
<head><meta charset="utf-8" /></head>
<body>
<table border="1">${tabla}</table>
</body>
</html>`;

    const clienteArchivo = clienteFiltradoMovimientos?.nombre ? `-${nombreArchivoSeguro(clienteFiltradoMovimientos.nombre)}` : "";
    descargarArchivo(`movimientos-cartera${clienteArchivo}-${fechaColombiaYYYYMMDD()}.xls`, contenido);
  }

  function construirTextoMovimientosWhatsApp() {
    const limite = 25;
    const lineas = [];
    const saludoCliente = clienteFiltradoMovimientos?.nombre ? `Hola ${clienteFiltradoMovimientos.nombre},` : "Hola,";
    lineas.push(saludoCliente);
    lineas.push("Te compartimos el resumen de movimientos de cartera Rafiki.");
    lineas.push("");
    lineas.push(`*Filtros:* ${descripcionFiltrosMovimientos()}`);
    lineas.push(`*Movimientos:* ${indicadores.movimientosFiltrados}`);
    lineas.push(`*Valor filtrado:* ${dinero(indicadores.valorOriginalFiltrado)}`);
    lineas.push(`*Saldo filtrado:* ${dinero(indicadores.saldoFiltrado)}`);

    if (movimientosFiltrados.length > 0) {
      lineas.push("");
      lineas.push("*Detalle:* ");
      movimientosFiltrados.slice(0, limite).forEach((movimiento) => {
        lineas.push(`- ${formatearFecha(movimiento.fecha_movimiento || movimiento.created_at)} · Pedido #${movimiento.numero_pedido || "—"} · ${resumenPedidoMovimiento(movimiento)} · Valor ${dinero(movimiento.valor)} · Saldo ${dinero(saldoMovimiento(movimiento))} · ${estadoCartera(movimiento)}`);
      });
      if (movimientosFiltrados.length > limite) {
        lineas.push(`... y ${movimientosFiltrados.length - limite} movimiento(s) más. Para el detalle completo, revisa el archivo de Excel exportado desde Rafiki.`);
      }
    }

    return lineas.join("\n");
  }

  function compartirMovimientosWhatsApp() {
    const texto = encodeURIComponent(construirTextoMovimientosWhatsApp());
    const telefono = telefonoWhatsApp(clienteFiltradoMovimientos?.telefono);
    const url = telefono ? `https://wa.me/${telefono}?text=${texto}` : `https://wa.me/?text=${texto}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function imprimirResumenCarteraTermico(formato = "80") {
    const topSaldo = rankingClientes.topSaldo || [];
    const recientes = rankingClientes.recientes || [];
    const ok = imprimirReporteTermico({
      formato,
      titulo: "Cartera",
      subtitulo: "Rafiki Gerencia · Resumen",
      meta: [
        { etiqueta: "Fecha impresión", valor: formatearFechaTermica(new Date()) },
        { etiqueta: "Clientes activos", valor: indicadores.activos },
        { etiqueta: "Clientes con saldo", valor: indicadores.clientesConSaldo },
        { etiqueta: "Movimientos cargados", valor: movimientosCartera.length },
      ],
      secciones: [
        {
          titulo: "Resumen general",
          filas: [
            { etiqueta: "Créditos otorgados hoy", valor: dinero(indicadores.creditosOtorgadosHoy), fuerte: true },
            { etiqueta: "Abonos recibidos hoy", valor: dinero(indicadores.abonosRecibidosHoy), fuerte: true },
            { etiqueta: "Cartera pendiente total", valor: dinero(indicadores.saldoTotal), fuerte: true },
            { etiqueta: "Clientes con saldo", valor: indicadores.clientesConSaldo },
            { etiqueta: "Pedidos pendientes", valor: indicadores.pedidosPendientes },
            { etiqueta: "Abonos acumulados", valor: dinero(indicadores.carteraPagada) },
            { etiqueta: "Cantidad de abonos", valor: indicadores.abonosRecibidos },
            { etiqueta: "Saldo según filtros", valor: dinero(indicadores.saldoFiltrado) },
          ],
        },
        {
          titulo: "Abonos por método",
          filas: resumirAbonosPorMetodo(abonosCartera),
        },
      ],
      listado: {
        titulo: "Top saldos pendientes",
        modo: "tabla",
        vacio: "Sin clientes activos con saldo pendiente.",
        items: topSaldo,
        campos: [
          { etiqueta: "Cliente", ancho: "44%", fuerte: true, valor: (cliente) => cliente.nombre || "Sin nombre" },
          { etiqueta: "Teléfono", ancho: "28%", valor: (cliente) => cliente.telefono || "Sin teléfono" },
          { etiqueta: "Saldo", ancho: "28%", alinear: "right", fuerte: true, valor: (cliente) => dinero(cliente.saldo_pendiente) },
        ],
      },
      pie: `Clientes recientes: ${recientes.length} · tabla compacta 58 mm / 80 mm`,
    });

    if (!ok) setError("No se pudo abrir la ventana de impresión. Revisa si el navegador bloqueó ventanas emergentes.");
  }

  function imprimirMovimientosCarteraTermico(formato = "80") {
    const lista = Array.isArray(movimientosFiltrados) ? movimientosFiltrados : [];
    const ok = imprimirReporteTermico({
      formato,
      titulo: "Movimientos cartera",
      subtitulo: "Rafiki Gerencia · Cartera",
      meta: [
        { etiqueta: "Fecha impresión", valor: formatearFechaTermica(new Date()) },
        { etiqueta: "Filtros", valor: descripcionFiltrosMovimientos() },
        { etiqueta: "Movimientos", valor: indicadores.movimientosFiltrados },
        { etiqueta: "Valor filtrado", valor: dinero(indicadores.valorOriginalFiltrado) },
        { etiqueta: "Saldo filtrado", valor: dinero(indicadores.saldoFiltrado) },
      ],
      secciones: [
        {
          titulo: "Resumen filtrado",
          filas: [
            { etiqueta: "Movimientos", valor: indicadores.movimientosFiltrados, fuerte: true },
            { etiqueta: "Valor filtrado", valor: dinero(indicadores.valorOriginalFiltrado), fuerte: true },
            { etiqueta: "Saldo filtrado", valor: dinero(indicadores.saldoFiltrado), fuerte: true },
            { etiqueta: "Cliente", valor: clienteFiltradoMovimientos?.nombre || "Todos los clientes" },
            { etiqueta: "Estado", valor: filtros.estado === "todos" ? "Todos los estados" : filtros.estado },
            { etiqueta: "Rango", valor: `${filtros.fechaInicio || "inicio"} a ${filtros.fechaFin || "hoy"}` },
          ],
        },
        {
          titulo: "Por estado",
          filas: resumirPorEstadoMovimientos(lista),
        },
      ],
      listado: {
        titulo: "Detalle movimientos",
        modo: "tabla",
        vacio: "Sin movimientos para imprimir con estos filtros.",
        items: lista,
        campos: [
          { etiqueta: "Pedido", ancho: "17%", fuerte: true, valor: (movimiento) => movimiento.numero_pedido ? `#${movimiento.numero_pedido}` : "—" },
          { etiqueta: "Cliente", ancho: "35%", valor: (movimiento) => movimiento.cliente_nombre || "—" },
          { etiqueta: "Estado", ancho: "22%", valor: (movimiento) => estadoCartera(movimiento) },
          { etiqueta: "Saldo", ancho: "26%", alinear: "right", fuerte: true, valor: (movimiento) => dinero(saldoMovimiento(movimiento)) },
        ],
      },
      pie: "Cartera · tabla compacta 58 mm / 80 mm",
    });

    if (!ok) setError("No se pudo abrir la ventana de impresión. Revisa si el navegador bloqueó ventanas emergentes.");
  }

  function cambiarCampoAbono(campo, valor) {
    setFormularioAbono((actual) => ({ ...actual, [campo]: valor }));
  }

  function abrirAbono(cliente) {
    if (!cliente?.id || Number(cliente.saldo_pendiente || 0) <= 0) return;
    setClienteDetalleId(cliente.id);
    setClienteAbonoId(cliente.id);
    setFormularioAbono(ABONO_INICIAL);
    setMensaje("");
    setError("");
  }

  function cerrarAbono() {
    if (guardando) return;
    setAbonoPendienteConfirmacion(null);
    setClienteAbonoId(null);
    setFormularioAbono(ABONO_INICIAL);
  }

  async function guardarAbono(evento) {
    evento.preventDefault();
    if (!clienteAbono?.id) return;

    const valor = aPesosEnteros(formularioAbono.valorAbono);
    if (!Number.isFinite(valor) || valor <= 0) {
      setError("El valor del abono debe ser mayor a cero.");
      return;
    }

    const saldoPendiente = aPesosEnteros(clienteAbono.saldo_pendiente);
    if (valor > saldoPendiente) {
      setError("El abono no puede ser mayor al saldo pendiente del cliente.");
      return;
    }

    setMensaje("");
    setError("");
    setAbonoPendienteConfirmacion({
      clienteId: clienteAbono.id,
      clienteNombre: clienteAbono.nombre,
      saldoPendiente,
      valor,
      metodoPago: formularioAbono.metodoPago,
      observacion: formularioAbono.observacion,
      fechaAbono: formularioAbono.fechaAbono,
    });
  }

  async function confirmarRegistroAbono() {
    const abono = abonoPendienteConfirmacion;
    if (!abono?.clienteId || guardando) return;

    setGuardando(true);
    setMensaje("");
    setError("");

    try {
      await registrarAbonoClienteCredito({
        clienteId: abono.clienteId,
        valorAbono: abono.valor,
        metodoPago: abono.metodoPago,
        observacion: abono.observacion,
        fechaAbono: abono.fechaAbono,
      });
      setMensaje("Abono registrado correctamente. La cartera fue actualizada.");
      setAbonoPendienteConfirmacion(null);
      setClienteAbonoId(null);
      setFormularioAbono(ABONO_INICIAL);
      await actualizarTodo();
    } catch (err) {
      registrarErrorSupabase("registrar abono de cartera", err);
      setError(describirErrorSupabase(err, "registrar el abono"));
    } finally {
      setGuardando(false);
    }
  }

  function editar(cliente) {
    setClienteEditandoId(cliente.id);
    setFormulario({
      nombre: cliente.nombre || "",
      telefono: cliente.telefono || "",
      observaciones: cliente.observaciones || "",
    });
    setMostrarFormulario(true);
    setMensaje("");
    setError("");
  }

  async function guardarCliente(evento) {
    evento.preventDefault();
    if (!formulario.nombre.trim()) {
      setError("El nombre del cliente es obligatorio.");
      return;
    }

    setGuardando(true);
    setMensaje("");
    setError("");

    try {
      if (clienteEditandoId) {
        await editarClienteCredito(clienteEditandoId, formulario);
        setMensaje("Cliente crédito actualizado correctamente.");
      } else {
        await crearClienteCredito(formulario);
        setMensaje("Cliente crédito creado correctamente.");
      }
      limpiarFormulario();
      await cargarClientes();
    } catch (err) {
      registrarErrorSupabase("guardar cliente crédito", err);
      setError(describirErrorSupabase(err, "guardar el cliente crédito"));
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(cliente) {
    setGuardando(true);
    setMensaje("");
    setError("");
    try {
      if (cliente.activo === false) {
        await activarClienteCredito(cliente.id);
        setMensaje("Cliente activado correctamente.");
      } else {
        await desactivarClienteCredito(cliente.id);
        setMensaje("Cliente desactivado correctamente.");
      }
      await cargarClientes();
    } catch (err) {
      registrarErrorSupabase("cambiar estado cliente crédito", err);
      setError(describirErrorSupabase(err, "cambiar el estado del cliente"));
    } finally {
      setGuardando(false);
    }
  }

  function abrirWhatsApp(cliente) {
    const telefono = telefonoWhatsApp(cliente.telefono);
    if (!telefono) return;
    const mensajeRecordatorio = encodeURIComponent(
      `Hola ${cliente.nombre}, te saludamos de Rafiki. Te compartimos el recordatorio de tu saldo pendiente en cartera: ${dinero(cliente.saldo_pendiente)}.`
    );
    window.open(`https://wa.me/${telefono}?text=${mensajeRecordatorio}`, "_blank", "noopener,noreferrer");
  }

  const tabsCartera = [
    { id: "resumen", label: "Resumen", icon: "📊" },
    { id: "clientes", label: "Clientes", icon: "👥", count: clientesVisibles.length },
    { id: "movimientos", label: "Movimientos", icon: "🧾", count: indicadores.movimientosFiltrados },
    { id: "detalle", label: "Detalle cliente", icon: "🔎", count: clienteDetalle ? 1 : null },
  ];

  return (
    <section className="cartera-clientes-panel cartera-profesional-panel cartera-ui-limpia">
      <style>{`
        .cartera-profesional-panel .cartera-indicadores { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; margin: 12px 0; }
        .cartera-profesional-panel .cartera-indicador { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 16px; padding: 12px; box-shadow: 0 8px 18px rgba(249,115,22,0.06); }
        .cartera-profesional-panel .cartera-indicador small { display: block; color: #9a3412; font-weight: 800; margin-bottom: 4px; }
        .cartera-profesional-panel .cartera-indicador strong { display: block; font-size: 18px; color: #431407; line-height: 1.15; }
        .cartera-profesional-panel .cartera-indicador.neutral { background: #f8fafc; border-color: #e2e8f0; }
        .cartera-profesional-panel .cartera-indicador.neutral small { color: #475569; }
        .cartera-profesional-panel .cartera-indicador.neutral strong { color: #0f172a; }
        .cartera-profesional-panel .cartera-form { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 10px; align-items: end; margin-top: 10px; }
        .cartera-profesional-panel .abono-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; align-items: end; }
        .cartera-profesional-panel .cartera-form textarea { grid-column: 1 / -1; }
        .cartera-profesional-panel input, .cartera-profesional-panel textarea, .cartera-profesional-panel select { width: 100%; min-height: 44px; border: 1px solid #e7e5e4; border-radius: 14px; padding: 10px 12px; font: inherit; background: #fff; }
        .cartera-profesional-panel textarea { min-height: 76px; resize: vertical; }
        .cartera-profesional-panel .cartera-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
        .cartera-profesional-panel .cartera-quick-filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 10px 0 4px; padding: 10px; border: 1px dashed #fed7aa; border-radius: 16px; background: #fffaf5; }
        .cartera-profesional-panel .cartera-movimientos-resumen { display: grid; grid-template-columns: repeat(3, minmax(150px, 1fr)); gap: 8px; color: #475569; font-size: 12px; min-width: min(100%, 520px); }
        .cartera-profesional-panel .cartera-resumen-chip { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 8px 10px; min-width: 0; }
        .cartera-profesional-panel .section-heading .cartera-resumen-chip span { display: block; background: transparent !important; color: #64748b; min-width: 0; height: auto; border-radius: 0; box-shadow: none; padding: 0; font-size: 11px; font-weight: 800; line-height: 1.15; text-align: left; }
        .cartera-profesional-panel .section-heading .cartera-resumen-chip strong { display: block; background: transparent !important; color: #0f172a; box-shadow: none; border-radius: 0; padding: 0; font-size: 13px; line-height: 1.2; word-break: keep-all; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cartera-profesional-panel .cartera-export-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
        .cartera-profesional-panel .cartera-filtros { display: grid; grid-template-columns: minmax(220px, 1.2fr) minmax(180px, 0.8fr) repeat(3, minmax(140px, 0.5fr)); gap: 8px; align-items: center; margin: 14px 0 8px; }
        .cartera-profesional-panel .pedidos-tabla-compacta { min-width: 1040px; }
        .cartera-profesional-panel .pedidos-tabla-compacta th { position: sticky; top: 0; z-index: 8; background: #fff7ed; box-shadow: 0 1px 0 #fed7aa; }
        .cartera-profesional-panel .detalle-cartera { margin-top: 14px; border: 1px solid #fed7aa; border-radius: 18px; background: #fffaf5; padding: 12px; }
        .cartera-profesional-panel .detalle-cartera h3 { margin: 0 0 8px; }
        .cartera-profesional-panel .detalle-cartera table { min-width: 780px; }
        .cartera-profesional-panel .ranking-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 12px 0; }
        .cartera-profesional-panel .ranking-card { border: 1px solid #e7e5e4; background: #fff; border-radius: 16px; padding: 12px; box-shadow: 0 8px 18px rgba(28,25,23,0.04); }
        .cartera-profesional-panel .ranking-card h3 { margin: 0 0 8px; font-size: 16px; }
        .cartera-profesional-panel .ranking-list { display: grid; gap: 8px; }
        .cartera-profesional-panel .ranking-item { display: flex; justify-content: space-between; gap: 10px; border-top: 1px dashed #e7e5e4; padding-top: 8px; }
        .cartera-profesional-panel .ranking-item:first-child { border-top: 0; padding-top: 0; }
        .cartera-profesional-panel .ranking-item strong, .cartera-profesional-panel td strong { display: block; }
        .cartera-profesional-panel .ranking-item small, .cartera-profesional-panel td small { display: block; color: #78716c; font-size: 11px; margin-top: 2px; }
        .cartera-profesional-panel .td-acciones { min-width: 160px; }
        .cartera-profesional-panel .td-pedido-detalle { min-width: 260px; max-width: 420px; white-space: normal; line-height: 1.35; }
        .cartera-profesional-panel .td-pedido-detalle small { display: block; color: #78716c; font-size: 11px; margin-top: 2px; }
        .cartera-profesional-panel .subtle-row { background: #fffaf5; }
        .cartera-profesional-panel .auditoria-resumen { border: 1px solid #bfdbfe; background: #eff6ff; color: #1e3a8a; border-radius: 16px; padding: 10px 12px; margin-top: 10px; }
        .cartera-profesional-panel .auditoria-resumen strong { display: block; margin-bottom: 4px; }
        .cartera-profesional-panel .auditoria-resumen span { display: inline-block; margin-right: 12px; font-size: 12px; font-weight: 800; }
        .cartera-profesional-panel .saldo-pendiente { color: #991b1b; font-weight: 900; }
        .cartera-profesional-panel .saldo-cero { color: #78716c; font-weight: 900; }
        .cartera-profesional-panel .pedidos-cliente-bloque { margin-top: 14px; border: 1px solid #dbeafe; background: #f8fbff; border-radius: 18px; padding: 12px; }
        .cartera-profesional-panel .abono-valor { color: #166534; font-weight: 900; }
        .cartera-ui-limpia .cartera-resumen-card { margin-top: 12px; }
        .cartera-ui-limpia .cartera-resumen-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; }
        .cartera-ui-limpia .cartera-resumen-header h3 { margin: 0; color: #9a3412; }
        .cartera-ui-limpia .cartera-table-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        @media (max-width: 980px) { .cartera-profesional-panel .cartera-indicadores { grid-template-columns: repeat(2, minmax(0, 1fr)); } .cartera-profesional-panel .ranking-grid { grid-template-columns: 1fr; } .cartera-profesional-panel .cartera-filtros, .cartera-profesional-panel .abono-form-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 760px) { .cartera-profesional-panel .cartera-indicadores, .cartera-profesional-panel .cartera-form, .cartera-profesional-panel .cartera-filtros, .cartera-profesional-panel .abono-form-grid, .cartera-profesional-panel .cartera-movimientos-resumen { grid-template-columns: 1fr; } .cartera-profesional-panel .cartera-form textarea { grid-column: auto; } .cartera-ui-limpia .cartera-resumen-header { align-items: stretch; flex-direction: column; } }
      `}</style>

      <div className="section-heading section-heading-pedidos-unificados">
        <div>
          <h2>Cartera</h2>
          <p className="muted small">Control gerencial de clientes crédito, saldos pendientes y pedidos asociados.</p>
        </div>
        <div className="cartera-actions" style={{ marginTop: 0 }}>
          <button type="button" className="mini-btn print" style={{ width: "auto", marginBottom: 0 }} onClick={actualizarTodo} disabled={cargando || cargandoMovimientos || cargandoAbonos || auditando}>
            {cargando || cargandoMovimientos || cargandoAbonos ? "Actualizando..." : "Actualizar cartera"}
          </button>
          <button type="button" className="mini-btn green" style={{ width: "auto", marginBottom: 0 }} onClick={auditarCartera} disabled={cargando || cargandoMovimientos || cargandoAbonos || auditando}>
            {auditando ? "Auditando..." : "Auditar cartera"}
          </button>
          <button type="button" className="mini-btn" style={{ width: "auto", marginBottom: 0 }} onClick={abrirNuevoCliente} disabled={auditando}>
            + Nuevo cliente
          </button>
          <ThermalPrintControls
            onPrint={imprimirResumenCarteraTermico}
            label="Resumen"
            title="Tamaño"
            buttonClassName="mini-btn print"
            className="cartera-thermal-control"
            compact
          />
        </div>
      </div>

      {mensaje && <div className="alert success" style={{ marginTop: 10 }}>{mensaje}</div>}
      {error && <div className="alert error" style={{ marginTop: 10 }}>{error}</div>}

      <RafikiTabs tabs={tabsCartera} activeTab={vistaCartera} onChange={setVistaCartera} ariaLabel="Secciones de cartera" />

      <RafikiModal
        open={mostrarFormulario}
        title={clienteEditando ? "Editar cliente crédito" : "Nuevo cliente crédito"}
        description="Guarda solo la información básica del cliente. Los saldos se actualizan automáticamente desde pedidos y abonos."
        onClose={limpiarFormulario}
        size="md"
      >
        <form onSubmit={guardarCliente}>
          <div className="cartera-form">
            <input value={formulario.nombre} onChange={(e) => cambiarCampo("nombre", e.target.value)} placeholder="Nombre del cliente" />
            <input value={formulario.telefono} onChange={(e) => cambiarCampo("telefono", e.target.value)} placeholder="Teléfono" />
            <textarea value={formulario.observaciones} onChange={(e) => cambiarCampo("observaciones", e.target.value)} placeholder="Observaciones" />
          </div>
          <div className="cartera-actions">
            <button type="submit" className="button" disabled={guardando}>{guardando ? "Guardando..." : clienteEditando ? "Guardar cambios" : "Crear cliente"}</button>
            <button type="button" className="button light" onClick={limpiarFormulario}>Cancelar</button>
          </div>
        </form>
      </RafikiModal>

      <RafikiModal
        open={Boolean(clienteAbono)}
        title="Registrar abono"
        description={clienteAbono ? `${clienteAbono.nombre} debe actualmente ${dinero(clienteAbono.saldo_pendiente)}. El abono se aplica automáticamente a los pedidos más antiguos.` : ""}
        onClose={cerrarAbono}
        size="lg"
      >
        {clienteAbono && (
          <form onSubmit={guardarAbono}>
            <div className="abono-form-grid">
              <label>
                Valor del abono
                <input type="number" min="0" step="100" value={formularioAbono.valorAbono} onChange={(e) => cambiarCampoAbono("valorAbono", e.target.value)} placeholder="Ej. 50000" required />
              </label>
              <label>
                Método de pago
                <select value={formularioAbono.metodoPago} onChange={(e) => cambiarCampoAbono("metodoPago", e.target.value)}>
                  {METODOS_ABONO.map((metodo) => <option key={metodo} value={metodo}>{metodo}</option>)}
                </select>
              </label>
              <label>
                Fecha
                <input type="date" value={formularioAbono.fechaAbono} onChange={(e) => cambiarCampoAbono("fechaAbono", e.target.value)} />
              </label>
              <label>
                Observación
                <input value={formularioAbono.observacion} onChange={(e) => cambiarCampoAbono("observacion", e.target.value)} placeholder="Opcional" />
              </label>
            </div>
            <div className="cartera-actions">
              <button type="submit" className="mini-btn green" style={{ width: "auto", marginBottom: 0 }} disabled={guardando}>{guardando ? "Guardando..." : "Guardar abono"}</button>
              <button type="button" className="mini-btn" style={{ width: "auto", marginBottom: 0 }} onClick={cerrarAbono} disabled={guardando}>Cancelar</button>
            </div>
          </form>
        )}
      </RafikiModal>

      <RafikiModal
        open={Boolean(abonoPendienteConfirmacion)}
        title="Confirmar abono"
        description={abonoPendienteConfirmacion ? `Vas a registrar un abono de ${dinero(abonoPendienteConfirmacion.valor)} para ${abonoPendienteConfirmacion.clienteNombre}.` : ""}
        onClose={() => !guardando && setAbonoPendienteConfirmacion(null)}
        size="sm"
        footer={(
          <>
            <button type="button" className="mini-btn" style={{ width: "auto", marginBottom: 0 }} onClick={() => setAbonoPendienteConfirmacion(null)} disabled={guardando}>Cancelar</button>
            <button type="button" className="mini-btn green" style={{ width: "auto", marginBottom: 0 }} onClick={confirmarRegistroAbono} disabled={guardando}>{guardando ? "Guardando..." : "Confirmar abono"}</button>
          </>
        )}
      >
        {abonoPendienteConfirmacion ? (
          <div className="cartera-correccion-resumen">
            <p><strong>Cliente:</strong> {abonoPendienteConfirmacion.clienteNombre}</p>
            <p><strong>Saldo actual:</strong> {dinero(abonoPendienteConfirmacion.saldoPendiente)}</p>
            <p><strong>Abono:</strong> {dinero(abonoPendienteConfirmacion.valor)}</p>
            <p><strong>Nuevo saldo estimado:</strong> {dinero(Math.max(0, abonoPendienteConfirmacion.saldoPendiente - abonoPendienteConfirmacion.valor))}</p>
            <p><strong>Método:</strong> {abonoPendienteConfirmacion.metodoPago}</p>
          </div>
        ) : null}
      </RafikiModal>

      {vistaCartera === "resumen" && (
        <section className="card card-pad cartera-resumen-card">
          <div className="cartera-indicadores">
            <div className="cartera-indicador"><small>Créditos otorgados hoy</small><strong>{dinero(indicadores.creditosOtorgadosHoy)}</strong></div>
            <div className="cartera-indicador neutral"><small>Abonos recibidos hoy</small><strong>{dinero(indicadores.abonosRecibidosHoy)}</strong></div>
            <div className="cartera-indicador"><small>Cartera pendiente total</small><strong>{dinero(indicadores.saldoTotal)}</strong></div>
            <div className="cartera-indicador"><small>Clientes con saldo</small><strong>{indicadores.clientesConSaldo}</strong></div>
            <div className="cartera-indicador"><small>Pedidos pendientes</small><strong>{indicadores.pedidosPendientes}</strong></div>
            <div className="cartera-indicador neutral"><small>Abonos acumulados</small><strong>{dinero(indicadores.carteraPagada)}</strong></div>
            <div className="cartera-indicador neutral"><small>Cantidad de abonos</small><strong>{indicadores.abonosRecibidos}</strong></div>
            <div className="cartera-indicador neutral"><small>Saldo según filtros</small><strong>{dinero(indicadores.saldoFiltrado)}</strong></div>
          </div>

          <div className="cartera-resumen-header">
            <div>
              <h3>Análisis rápido</h3>
              <p className="muted small">Los rankings quedan ocultos para que el panel cargue más limpio. Puedes abrirlos cuando necesites revisar prioridades de cobro.</p>
            </div>
            <button type="button" className="mini-btn print" style={{ width: "auto", marginBottom: 0 }} onClick={() => setMostrarRankings((valor) => !valor)}>
              {mostrarRankings ? "Ocultar rankings" : "📊 Ver rankings y estadísticas"}
            </button>
          </div>

          {mostrarRankings && (
            <div className="ranking-grid">
              <article className="ranking-card">
                <h3>Top saldos pendientes</h3>
                <div className="ranking-list">
                  {rankingClientes.topSaldo.length === 0 ? <RafikiEmptyState icon="✅" title="Sin saldos pendientes" description="No hay clientes activos con saldo pendiente." /> : rankingClientes.topSaldo.map((cliente) => (
                    <div key={cliente.id} className="ranking-item">
                      <span><strong>{cliente.nombre}</strong><small>{cliente.telefono || "Sin teléfono"}</small></span>
                      <strong className="saldo-pendiente">{dinero(cliente.saldo_pendiente)}</strong>
                    </div>
                  ))}
                </div>
              </article>
              <article className="ranking-card">
                <h3>Créditos recientes</h3>
                <div className="ranking-list">
                  {rankingClientes.recientes.length === 0 ? <RafikiEmptyState icon="🧾" title="Sin créditos recientes" description="Aún no hay últimos pedidos registrados para clientes crédito." /> : rankingClientes.recientes.map((cliente) => (
                    <div key={cliente.id} className="ranking-item">
                      <span><strong>{cliente.nombre}</strong><small>Último pedido: {formatearFecha(cliente.fecha_ultimo_pedido)}</small></span>
                      <strong className={Number(cliente.saldo_pendiente || 0) > 0 ? "saldo-pendiente" : "saldo-cero"}>{dinero(cliente.saldo_pendiente)}</strong>
                    </div>
                  ))}
                </div>
              </article>
              <article className="ranking-card">
                <h3>Clientes sin teléfono</h3>
                <div className="ranking-list">
                  {rankingClientes.sinTelefono.length === 0 ? <RafikiEmptyState icon="📱" title="Teléfonos completos" description="Todos los clientes con saldo pendiente tienen teléfono registrado." /> : rankingClientes.sinTelefono.map((cliente) => (
                    <div key={cliente.id} className="ranking-item">
                      <span><strong>{cliente.nombre}</strong><small>{Number(cliente.total_pedidos || 0)} pedido(s)</small></span>
                      <strong className="saldo-pendiente">{dinero(cliente.saldo_pendiente)}</strong>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          )}

          {resultadoAuditoria && (
            <div className="auditoria-resumen">
              <strong>Última auditoría de cartera</strong>
              <span>Revisados: {resultadoAuditoria.movimientosRevisados || 0}</span>
              <span>Anulados: {resultadoAuditoria.anulados || 0}</span>
              <span>Borrados: {resultadoAuditoria.anuladosBorrados || 0}</span>
              <span>No crédito: {resultadoAuditoria.anuladosNoCredito || 0}</span>
              <span>Huérfanos: {resultadoAuditoria.anuladosHuerfanos || 0}</span>
              <span>Duplicados: {resultadoAuditoria.duplicadosAnulados || 0}</span>
              <span>Saldos ajustados: {resultadoAuditoria.valoresAjustados || 0}</span>
            </div>
          )}
        </section>
      )}

      {vistaCartera === "clientes" && (
        <section className="card card-pad" style={{ marginTop: 12 }}>
          <div className="section-heading section-heading-pedidos-unificados">
            <div>
              <h3>Clientes con crédito</h3>
              <p className="muted small">Consulta saldos, estado, teléfono y detalle de pedidos por cliente.</p>
            </div>
          </div>

          <div className="cartera-filtros">
            <input value={busquedaClientes} onChange={(e) => setBusquedaClientes(e.target.value)} placeholder="Buscar cliente, teléfono u observación" />
            <button type="button" className="mini-btn" style={{ width: "auto", marginBottom: 0 }} onClick={() => cambiarFiltro("soloConSaldo", !filtros.soloConSaldo)}>
              {filtros.soloConSaldo ? "Ver todos" : "Solo con saldo"}
            </button>
            <button type="button" className="mini-btn" style={{ width: "auto", marginBottom: 0 }} onClick={() => setMostrarInactivos((valor) => !valor)}>
              {mostrarInactivos ? "Ocultar inactivos" : "Mostrar inactivos"}
            </button>
            <button type="button" className="mini-btn print" style={{ width: "auto", marginBottom: 0 }} onClick={cargarClientes} disabled={cargando}>
              {cargando ? "Cargando..." : "Actualizar clientes"}
            </button>
          </div>

          <div className="pedidos-tabla-wrap">
            <table className="pedidos-tabla-compacta">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Último pedido</th>
                  <th>Total pedidos</th>
                  <th>Saldo pendiente</th>
                  <th>Estado</th>
                  <th>Observaciones</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {clientesVisibles.length === 0 ? (
                  <tr><td colSpan="8"><RafikiEmptyState icon="👥" title={cargando ? "Cargando clientes..." : "Sin clientes visibles"} description={cargando ? "Estamos consultando el directorio de clientes crédito." : "No hay clientes para los filtros actuales. Puedes limpiar filtros o crear un cliente nuevo."} /></td></tr>
                ) : clientesVisibles.map((cliente) => {
                  const whatsapp = telefonoWhatsApp(cliente.telefono);
                  const saldoPendiente = Number(cliente.saldo_pendiente || 0);
                  return (
                    <tr key={cliente.id} className={cliente.activo === false ? "fila-borrada" : ""}>
                      <td><strong>{cliente.nombre}</strong><small>{Array.isArray(cliente.alias) && cliente.alias.length ? cliente.alias.join(", ") : "Sin alias"}</small></td>
                      <td>{cliente.telefono || "—"}</td>
                      <td>{formatearFecha(cliente.fecha_ultimo_pedido)}</td>
                      <td>{Number(cliente.total_pedidos || 0)}</td>
                      <td className={`td-total ${saldoPendiente > 0 ? "saldo-pendiente" : "saldo-cero"}`}>{dinero(cliente.saldo_pendiente)}</td>
                      <td><RafikiBadge estado={cliente.activo === false ? "Inactivo" : "Activo"} /></td>
                      <td className="td-obs">{cliente.observaciones || "—"}</td>
                      <td className="td-acciones">
                        <button type="button" className="mini-btn green" onClick={() => abrirAbono(cliente)} disabled={guardando || saldoPendiente <= 0}>Abono</button>
                        <RafikiActionMenu
                          disabled={guardando}
                          items={[
                            { id: "ver", label: "Ver cartera y pedidos", icon: "🔎", variant: "info", onClick: () => { setClienteDetalleId(cliente.id); setVistaCartera("detalle"); } },
                            { id: "editar", label: "Editar cliente", icon: "✏️", onClick: () => editar(cliente) },
                            whatsapp ? { id: "whatsapp", label: "Enviar WhatsApp", icon: "💬", variant: "success", disabled: saldoPendiente <= 0, onClick: () => abrirWhatsApp(cliente) } : null,
                            { id: "estado", label: cliente.activo === false ? "Activar cliente" : "Desactivar cliente", icon: cliente.activo === false ? "✅" : "🚫", variant: cliente.activo === false ? "success" : "danger", onClick: () => cambiarEstado(cliente) },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {vistaCartera === "movimientos" && (
        <section className="card card-pad" style={{ marginTop: 12 }}>
          <div className="section-heading section-heading-pedidos-unificados">
            <div>
              <h3>Movimientos de cartera</h3>
              <p className="muted small">Filtra por cliente, pedido, estado o rango de fechas. Los cortes se calculan con horario Colombia para evitar descuadres al cierre.</p>
            </div>
            <div className="cartera-movimientos-resumen">
              <div className="cartera-resumen-chip"><span>Movimientos</span><strong>{indicadores.movimientosFiltrados}</strong></div>
              <div className="cartera-resumen-chip"><span>Valor filtrado</span><strong title={dinero(indicadores.valorOriginalFiltrado)}>{dinero(indicadores.valorOriginalFiltrado)}</strong></div>
              <div className="cartera-resumen-chip"><span>Saldo filtrado</span><strong title={dinero(indicadores.saldoFiltrado)}>{dinero(indicadores.saldoFiltrado)}</strong></div>
            </div>
          </div>

          <div className="cartera-quick-filters" aria-label="Filtros rápidos de movimientos">
            <button type="button" className="mini-btn green" style={{ width: "auto", marginBottom: 0 }} onClick={aplicarFiltroCreditosHoy}>Créditos de hoy</button>
            <button type="button" className="mini-btn" style={{ width: "auto", marginBottom: 0 }} onClick={aplicarFiltroAyer}>Ayer</button>
            <button type="button" className="mini-btn" style={{ width: "auto", marginBottom: 0 }} onClick={aplicarFiltroUltimos7Dias}>Últimos 7 días</button>
            <button type="button" className="mini-btn" style={{ width: "auto", marginBottom: 0 }} onClick={aplicarFiltroPendientes}>Pendientes</button>
            {hayFiltroFechaMovimientos && <span className="muted small">Mostrando auditoría por fecha: los créditos pagados se mantienen visibles.</span>}
          </div>

          <div className="cartera-filtros">
            <input value={filtros.texto} onChange={(e) => cambiarFiltro("texto", e.target.value)} placeholder="Buscar por pedido, cliente o producto" />
            <select value={filtros.clienteId} onChange={(e) => cambiarFiltro("clienteId", e.target.value)} aria-label="Filtrar movimientos por cliente">
              <option value="">Todos los clientes</option>
              {clientesParaFiltroMovimientos.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>
              ))}
            </select>
            <select value={filtros.estado} onChange={(e) => cambiarFiltro("estado", e.target.value)}>
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="parcial">Parcial</option>
              <option value="pagado">Pagado</option>
              <option value="anulado">Anulado</option>
            </select>
            <input type="date" value={filtros.fechaInicio} onChange={(e) => cambiarFiltro("fechaInicio", e.target.value)} />
            <input type="date" value={filtros.fechaFin} onChange={(e) => cambiarFiltro("fechaFin", e.target.value)} />
          </div>
          <div className="cartera-actions">
            <button type="button" className="mini-btn" style={{ width: "auto", marginBottom: 0 }} onClick={() => setFiltros(FILTROS_INICIALES)}>Limpiar filtros</button>
            <button type="button" className="mini-btn print" style={{ width: "auto", marginBottom: 0 }} onClick={cargarMovimientos} disabled={cargandoMovimientos}>
              {cargandoMovimientos ? "Cargando..." : "Actualizar movimientos"}
            </button>
            <button type="button" className="mini-btn green" style={{ width: "auto", marginBottom: 0 }} onClick={exportarMovimientosExcel} disabled={movimientosFiltrados.length === 0}>
              Exportar Excel
            </button>
            <button type="button" className="mini-btn" style={{ width: "auto", marginBottom: 0 }} onClick={compartirMovimientosWhatsApp} disabled={movimientosFiltrados.length === 0}>
              Compartir WhatsApp
            </button>
            <ThermalPrintControls
              onPrint={imprimirMovimientosCarteraTermico}
              disabled={movimientosFiltrados.length === 0}
              label="Imprimir"
              title="Tamaño"
              buttonClassName="mini-btn print"
              className="cartera-thermal-control"
              compact
            />
          </div>
          <p className="muted small" style={{ margin: "4px 0 0" }}>WhatsApp comparte un resumen en texto. Para enviar el archivo completo, exporta Excel y adjúntalo manualmente.</p>

          <div className="pedidos-tabla-wrap" style={{ marginTop: 10 }}>
            <table className="pedidos-tabla-compacta">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Pedido realizado</th>
                  <th>Valor</th>
                  <th>Estado</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {movimientosFiltrados.length === 0 ? (
                  <tr><td colSpan="7"><RafikiEmptyState icon="🧾" title={cargandoMovimientos ? "Cargando movimientos..." : "Sin movimientos"} description={cargandoMovimientos ? "Estamos consultando los movimientos de cartera." : "No hay movimientos para los filtros actuales."} /></td></tr>
                ) : movimientosFiltrados.slice(0, 300).map((movimiento) => {
                  const estado = estadoCartera(movimiento);
                  const saldoPendiente = saldoMovimiento(movimiento);
                  return (
                    <tr key={movimiento.id} className={!hayFiltroFechaMovimientos && !movimientoPendiente(movimiento) ? "subtle-row" : ""}>
                      <td>{formatearFechaHora(movimiento.fecha_movimiento || movimiento.created_at)}</td>
                      <td>#{movimiento.numero_pedido || "—"}</td>
                      <td>{movimiento.cliente_nombre || "—"}</td>
                      <td className="td-pedido-detalle">{resumenPedidoMovimiento(movimiento)}<small>{movimiento.pedido_items?.length ? `${movimiento.pedido_items.length} item(s)` : "Detalle compacto"}</small></td>
                      <td className="td-total">{dinero(movimiento.valor)}</td>
                      <td><RafikiBadge estado={estado} /></td>
                      <td className={`td-total ${saldoPendiente > 0 && estado !== "pagado" && estado !== "anulado" ? "saldo-pendiente" : "saldo-cero"}`}>{dinero(movimiento.saldo_movimiento)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {movimientosFiltrados.length > 300 && <p className="muted small">Se muestran los primeros 300 movimientos. Usa filtros para acotar la búsqueda.</p>}
        </section>
      )}

      {vistaCartera === "detalle" && (
        <section className="detalle-cartera">
          {!clienteDetalle ? (
            <RafikiEmptyState
              icon="🔎"
              title="Selecciona un cliente"
              description="Desde la pestaña Clientes puedes abrir la cartera individual de cualquier cliente crédito."
              action={<button type="button" className="mini-btn print" style={{ width: "auto", marginBottom: 0 }} onClick={() => setVistaCartera("clientes")}>Ir a clientes</button>}
            />
          ) : (
            <>
              <div className="section-heading section-heading-pedidos-unificados">
                <div>
                  <h3>Cartera de {clienteDetalle.nombre}</h3>
                  <p className="muted small">Detalle del cliente según los filtros activos de movimientos.</p>
                </div>
                <div className="cartera-actions" style={{ marginTop: 0 }}>
                  <button type="button" className="mini-btn green" style={{ width: "auto", marginBottom: 0 }} onClick={() => abrirAbono(clienteDetalle)} disabled={Number(clienteDetalle.saldo_pendiente || 0) <= 0}>Registrar abono</button>
                  <button type="button" className="mini-btn" style={{ width: "auto", marginBottom: 0 }} onClick={() => setClienteDetalleId(null)}>Cerrar</button>
                </div>
              </div>

              <div className="cartera-indicadores" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
                <div className="cartera-indicador"><small>Saldo actual cliente</small><strong>{dinero(clienteDetalle.saldo_pendiente)}</strong></div>
                <div className="cartera-indicador"><small>Saldo filtrado</small><strong>{dinero(resumenDetalle.saldo)}</strong></div>
                <div className="cartera-indicador neutral"><small>Total filtrado</small><strong>{dinero(resumenDetalle.total)}</strong></div>
                <div className="cartera-indicador neutral"><small>Abonado</small><strong className="abono-valor">{dinero(resumenDetalle.abonado)}</strong></div>
                <div className="cartera-indicador neutral"><small>Pedidos pendientes</small><strong>{resumenDetalle.pendientes}</strong></div>
              </div>

              <div className="pedidos-tabla-wrap">
                <table className="pedidos-tabla-compacta">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Pedido</th>
                      <th>Pedido realizado</th>
                      <th>Valor</th>
                      <th>Estado</th>
                      <th>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientosClienteDetalle.length === 0 ? (
                      <tr><td colSpan="6"><RafikiEmptyState icon="🧾" title="Sin movimientos" description="Este cliente no tiene movimientos con los filtros actuales." /></td></tr>
                    ) : movimientosClienteDetalle.map((movimiento) => {
                      const estado = estadoCartera(movimiento);
                      const saldoPendiente = saldoMovimiento(movimiento);
                      return (
                        <tr key={movimiento.id}>
                          <td>{formatearFechaHora(movimiento.fecha_movimiento || movimiento.created_at)}</td>
                          <td>#{movimiento.numero_pedido || "—"}</td>
                          <td className="td-pedido-detalle">{resumenPedidoMovimiento(movimiento)}<small>{movimiento.pedido_items?.length ? `${movimiento.pedido_items.length} item(s)` : "Detalle compacto"}</small></td>
                          <td className="td-total">{dinero(movimiento.valor)}</td>
                          <td><RafikiBadge estado={estado} /></td>
                          <td className={`td-total ${saldoPendiente > 0 && estado !== "pagado" && estado !== "anulado" ? "saldo-pendiente" : "saldo-cero"}`}>{dinero(movimiento.saldo_movimiento)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>


              <div className="pedidos-cliente-bloque">
                <div className="section-heading section-heading-pedidos-unificados">
                  <div>
                    <h3>Pedidos realizados por el cliente</h3>
                    <p className="muted small">Consulta rápida de los últimos pedidos registrados con este nombre, incluyendo pedidos crédito, mesa, cliente y correcciones.</p>
                  </div>
                  <button type="button" className="mini-btn print" style={{ width: "auto", marginBottom: 0 }} onClick={() => cargarPedidosClienteDetalle(clienteDetalle)} disabled={cargandoPedidosCliente}>
                    {cargandoPedidosCliente ? "Cargando..." : "Actualizar pedidos"}
                  </button>
                </div>
                {errorPedidosCliente && <div className="alert error" style={{ marginTop: 8 }}>{errorPedidosCliente}</div>}
                <div className="pedidos-tabla-wrap">
                  <table className="pedidos-tabla-compacta">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Pedido</th>
                        <th>Ubicación</th>
                        <th>Mesero</th>
                        <th>Pago</th>
                        <th>Estado</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidosClienteDetalle.length === 0 ? (
                        <tr><td colSpan="7"><RafikiEmptyState icon="🍽️" title={cargandoPedidosCliente ? "Cargando pedidos..." : "Sin pedidos encontrados"} description={cargandoPedidosCliente ? "Estamos buscando los pedidos de este cliente." : "No se encontraron pedidos registrados con este nombre. Si el cliente aparece escrito diferente, búscalo desde Pedidos Hoy."} /></td></tr>
                      ) : pedidosClienteDetalle.map((pedido) => (
                        <tr key={pedido.id}>
                          <td>{formatearFechaHora(pedido.created_at)}</td>
                          <td>#{pedido.numero_pedido || "—"}</td>
                          <td>{pedido.ubicacion || pedido.mesa || "—"}</td>
                          <td>{pedido.mesero || "—"}</td>
                          <td>{pedido.tipo_pago || "—"}</td>
                          <td><RafikiBadge estado={pedido.estado || "—"} /></td>
                          <td className="td-total">{dinero(pedido.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {pedidosClienteDetalle.length >= 120 && <p className="muted small">Se muestran los últimos 120 pedidos encontrados para este cliente.</p>}
              </div>

              <div className="section-heading section-heading-pedidos-unificados" style={{ marginTop: 14 }}>
                <div>
                  <h3>Historial de abonos</h3>
                  <p className="muted small">Pagos registrados y aplicados a los pedidos de este cliente.</p>
                </div>
              </div>
              <div className="pedidos-tabla-wrap">
                <table className="pedidos-tabla-compacta">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Pedido aplicado</th>
                      <th>Valor abonado</th>
                      <th>Método</th>
                      <th>Saldo antes</th>
                      <th>Saldo después</th>
                      <th>Observación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abonosClienteDetalle.length === 0 ? (
                      <tr><td colSpan="7"><RafikiEmptyState icon="💵" title="Sin abonos" description="Este cliente aún no tiene abonos registrados." /></td></tr>
                    ) : abonosClienteDetalle.map((abono) => (
                      <tr key={abono.id} className="subtle-row">
                        <td>{formatearFechaHora(abono.fecha_abono || abono.created_at)}</td>
                        <td>#{abono.numero_pedido || "—"}</td>
                        <td className="td-total abono-valor">{dinero(abono.valor_abono)}</td>
                        <td>{abono.metodo_pago || "—"}</td>
                        <td className="td-total">{dinero(abono.saldo_anterior)}</td>
                        <td className="td-total">{dinero(abono.saldo_nuevo)}</td>
                        <td className="td-obs">{abono.observacion || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </section>
  );
}
