import React, { useCallback, useEffect, useMemo, useState } from "react";
import { dinero, formatearFechaHora, normalizarTexto, esItemCafeteria, obtenerCliente, obtenerCodigoPedido, obtenerEstadoPedido, obtenerItemsPedido } from "../../../../shared/utils/pedidos";
import AdminRealtimeStatus from "./AdminRealtimeStatus";
import AdminPedidosFiltros from "./AdminPedidosFiltros";
import AdminPedidoGrupo from "./AdminPedidoGrupo";
import { MESAS_DISPONIBLES } from "../../../../shared/utils/mesas";
import { FORMAS_PAGO_ABONO_CARTERA, FORMAS_PAGO_MESA, METODOS_PAGO, esMetodoPagoCredito, normalizarMetodoPago } from "../../../../shared/constants/paymentMethods";
import { PedidoCocina, TablaPedidosCompacta, resumirItemsPedidoCompacto } from "../../../pedidos/components/PedidosAdmin";
import { corregirClienteCreditoDePedido } from "../../../../services/carteraService";
import { listarClientesCreditoActivos } from "../../../../services/clientesCreditoService";
import RafikiEmptyState from "../../../../shared/components/RafikiEmptyState";
import RafikiTabs from "../../../../shared/components/RafikiTabs";
import RafikiModal from "../../../../shared/components/RafikiModal";
import { useAlertaRafiki } from "../../../../shared/components/common";
import { formatearFechaTermica, imprimirReporteTermico } from "../../../impresion/thermalReportService";
import ThermalPrintControls from "../../../impresion/ThermalPrintControls";


function normalizarMesaPedido(pedido) {
  const valor = String(pedido?.mesa || pedido?.ubicacion || "").trim().toUpperCase();
  return MESAS_DISPONIBLES.find((mesa) => valor === mesa || valor.includes(mesa)) || "";
}

function compararFechaPedidoDesc(a, b) {
  return new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime();
}


function obtenerUbicacionTicketPedido(pedido) {
  return String(pedido?.ubicacion || pedido?.mesa || pedido?.cliente || "Sin ubicación").trim() || "Sin ubicación";
}

function itemEsCafeteriaPedidoHoy(item) {
  return esItemCafeteria(item);
}

function itemEsRestaurantePedidoHoy(item) {
  return Boolean(item) && !itemEsCafeteriaPedidoHoy(item);
}

function pedidoItemsPedidoHoy(pedido) {
  return obtenerItemsPedido(pedido);
}

function textoOperativoPedido(pedido) {
  return normalizarTexto([
    pedido?.ubicacion,
    pedido?.mesa,
    pedido?.tipo_pedido,
    pedido?.pedido_texto,
    pedido?.observaciones,
  ].filter(Boolean).join(" "));
}

function itemMarcadoParaLlevar(item) {
  const valor = item?.paraLlevar ?? item?.para_llevar ?? item?.para_llevar_item ?? item?.llevar;

  if (typeof valor === "boolean") return valor;
  if (typeof valor === "number") return valor === 1;

  const texto = normalizarTexto(valor);
  return ["true", "1", "si", "sí", "para llevar", "llevar"].includes(texto);
}

function pedidoEsComerEnRestaurante(pedido) {
  const texto = textoOperativoPedido(pedido);
  const tipoPedido = normalizarTexto(pedido?.tipo_pedido);
  const mesa = normalizarTexto(pedido?.mesa);
  const ubicacion = normalizarTexto(pedido?.ubicacion);

  if (texto.includes("comer en restaurante")) return true;
  if (texto.includes("para llevar") || texto.includes("llevar") || texto.includes("domicilio") || texto.includes("recoger")) return false;
  if (tipoPedido === "cliente") return false;

  return tipoPedido === "mesa" && Boolean(mesa || ubicacion) && mesa !== "llevar" && ubicacion !== "llevar";
}

function pedidoPareceParaLlevar(pedido) {
  if (pedidoEsComerEnRestaurante(pedido)) return false;

  const tipoPedido = normalizarTexto(pedido?.tipo_pedido);
  const texto = textoOperativoPedido(pedido);
  const items = pedidoItemsPedidoHoy(pedido);

  if (tipoPedido === "cliente" || tipoPedido === "llevar") return true;
  if (texto.includes("para llevar") || texto.includes("llevar") || texto.includes("domicilio") || texto.includes("recoger")) return true;
  return items.some((item) => itemMarcadoParaLlevar(item));
}

function pedidoPareceEnMesa(pedido) {
  if (pedidoPareceParaLlevar(pedido)) return false;
  if (pedidoEsComerEnRestaurante(pedido)) return true;

  const texto = textoOperativoPedido(pedido);
  return /\b[1-5][ab]\b/.test(texto) || texto.includes("mesa");
}

function textoItemsPedidoHoy(pedido) {
  return pedidoItemsPedidoHoy(pedido)
    .map((item) => [
      item?.categoria,
      item?.area,
      item?.tipo,
      item?.producto,
      item?.plato,
      item?.proteina,
      item?.nombre,
    ].filter(Boolean).join(" "))
    .join(" ");
}

function pedidoSinItemsPareceCafeteria(pedido) {
  const texto = normalizarTexto([pedido?.pedido_texto, pedido?.cliente, pedido?.observaciones, textoItemsPedidoHoy(pedido)].filter(Boolean).join(" "));
  return ["parfait", "batido", "jugo", "cafe", "capuchino", "desayuno", "sandwich", "sanduche", "postre", "bebida", "fresas con crema", "ensalada de frutas"].some((palabra) => texto.includes(palabra));
}

function pedidoCumpleFiltroTipoPedido(pedido, filtro) {
  const items = pedidoItemsPedidoHoy(pedido);
  const paraLlevarGeneral = pedidoPareceParaLlevar(pedido);
  const enMesaGeneral = pedidoPareceEnMesa(pedido);

  if (items.length === 0) {
    const pareceCafeteria = pedidoSinItemsPareceCafeteria(pedido);
    const pareceRestaurante = !pareceCafeteria;

    if (filtro === "restauranteParaLlevar") return pareceRestaurante && paraLlevarGeneral;
    if (filtro === "cafeteriaParaLlevar") return pareceCafeteria && paraLlevarGeneral;
    if (filtro === "restauranteMesa") return pareceRestaurante && enMesaGeneral;
    if (filtro === "cafeteriaMesa") return pareceCafeteria && enMesaGeneral;
    return false;
  }

  return items.some((item) => {
    const cafeteria = itemEsCafeteriaPedidoHoy(item);
    const restaurante = itemEsRestaurantePedidoHoy(item);
    const paraLlevar = itemMarcadoParaLlevar(item) || paraLlevarGeneral;
    const enMesa = !paraLlevar && enMesaGeneral;

    if (filtro === "restauranteParaLlevar") return restaurante && paraLlevar;
    if (filtro === "cafeteriaParaLlevar") return cafeteria && paraLlevar;
    if (filtro === "restauranteMesa") return restaurante && enMesa;
    if (filtro === "cafeteriaMesa") return cafeteria && enMesa;
    return false;
  });
}

function fechaISOColombiaDesdeValor(valor) {
  const fecha = valor ? new Date(valor) : new Date();
  if (Number.isNaN(fecha.getTime())) return "";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(fecha);
}

function pedidoDebeVerseEntregadoPorCorte(pedido, ahora = new Date()) {
  if (obtenerEstadoPedido(pedido) !== "Pendiente") return false;

  const fechaPedido = fechaISOColombiaDesdeValor(pedido?.created_at);
  if (!fechaPedido) return false;

  const corte = new Date(`${fechaPedido}T19:30:00-05:00`);
  if (Number.isNaN(corte.getTime())) return false;

  return ahora.getTime() >= corte.getTime();
}

function aplicarEstadoVisualEntregadoPorCorte(pedido, ahora = new Date()) {
  if (!pedidoDebeVerseEntregadoPorCorte(pedido, ahora)) return pedido;

  return {
    ...pedido,
    estado: "Finalizado",
    estado_visual_auto: "entregado_por_corte_730pm",
  };
}

function aplicarEstadoVisualListaPedidos(pedidos = [], ahora = new Date()) {
  return (Array.isArray(pedidos) ? pedidos : []).map((pedido) => aplicarEstadoVisualEntregadoPorCorte(pedido, ahora));
}

function aplicarFiltrosRapidosPedidos(pedidos = [], filtrosTipo = {}, filtroPago = "") {
  const filtrosActivos = Object.entries(filtrosTipo || {}).filter(([, activo]) => Boolean(activo)).map(([clave]) => clave);
  const pagoNormalizado = normalizarTexto(filtroPago);

  return pedidos.filter((pedido) => {
    const cumpleTipo = filtrosActivos.length === 0 || filtrosActivos.some((filtro) => pedidoCumpleFiltroTipoPedido(pedido, filtro));
    if (!cumpleTipo) return false;

    if (!pagoNormalizado) return true;
    return normalizarTexto(pedido?.tipo_pago || "").includes(pagoNormalizado);
  });
}

function sumarTotalPedidosTermicos(pedidos = []) {
  return (Array.isArray(pedidos) ? pedidos : []).reduce((suma, pedido) => suma + Number(pedido?.total || 0), 0);
}

function describirRangoBusquedaPedidosTermico({ filtroPedidos, fechaSeleccionada, fechaInicioRangoPedidos, fechaFinRangoPedidos, busqueda, busquedaNumeroPedido }) {
  const partes = [];

  if (filtroPedidos === "dia" && fechaSeleccionada) partes.push(`Día: ${fechaSeleccionada}`);
  else if (filtroPedidos === "rango") partes.push(`Rango: ${fechaInicioRangoPedidos || "inicio"} a ${fechaFinRangoPedidos || fechaInicioRangoPedidos || "fin"}`);
  else partes.push("Hoy");

  if (String(busqueda || "").trim()) partes.push(`Búsqueda: ${String(busqueda).trim()}`);
  if (String(busquedaNumeroPedido || "").trim()) partes.push(`# pedido: ${String(busquedaNumeroPedido).trim()}`);

  return partes.join(" · ");
}


function construirMetaFiltrosPedidosTermicos({ fechaReferencia, resumenFiltrosRapidos, cantidad, rangoBusqueda, orden, totalCargados }) {
  return [
    { etiqueta: "Fecha impresión", valor: formatearFechaTermica(fechaReferencia || new Date()) },
    { etiqueta: "Rango / búsqueda", valor: rangoBusqueda || "Hoy" },
    { etiqueta: "Filtros rápidos", valor: resumenFiltrosRapidos || "Sin filtros rápidos activos" },
    { etiqueta: "Orden", valor: orden === "primeros" ? "Primeros pedidos primero" : "Últimos pedidos primero" },
    { etiqueta: "Pedidos impresos", valor: `${cantidad}${Number.isFinite(totalCargados) ? ` de ${totalCargados} cargados` : ""}` },
  ];
}

function crearSeccionesPedidosTermicos(lista) {
  const pedidos = Array.isArray(lista) ? lista : [];
  const total = sumarTotalPedidosTermicos(pedidos);

  return [
    {
      titulo: "Resumen",
      filas: [
        { etiqueta: "Pedidos", valor: pedidos.length, fuerte: true },
        { etiqueta: "Total", valor: dinero(total), fuerte: true },
      ],
    },
  ];
}

function crearCamposPedidosTermicos() {
  return [
    {
      etiqueta: "Pedido",
      etiquetaCorta: "Ped",
      ancho: "17%",
      chars58: 5,
      chars80: 7,
      fuerte: true,
      valor: (pedido) => `#${obtenerCodigoPedido(pedido)}`,
    },
    {
      etiqueta: "Cliente",
      etiquetaCorta: "Cli",
      ancho: "29%",
      chars58: 7,
      chars80: 13,
      valor: obtenerCliente,
    },
    {
      etiqueta: "Ubicación",
      etiquetaCorta: "Ubic",
      ancho: "31%",
      chars58: 8,
      chars80: 13,
      valor: obtenerUbicacionTicketPedido,
    },
    {
      etiqueta: "Total",
      etiquetaCorta: "Total",
      ancho: "23%",
      chars58: 7,
      chars80: 9,
      alinear: "right",
      fuerte: true,
      valor: (pedido) => dinero(pedido?.total || 0),
    },
  ];
}

function imprimirResumenPedidosFiltradosTermico({
  pedidos = [],
  fechaReferencia = new Date(),
  titulo = "Pedidos filtrados",
  resumenFiltros = "Sin filtros rápidos activos",
  rangoBusqueda = "Hoy",
  orden = "ultimos",
  totalCargados = null,
  formato = "80",
}) {
  const lista = Array.isArray(pedidos) ? pedidos : [];

  return imprimirReporteTermico({
    formato,
    titulo,
    subtitulo: "Rafiki Pedidos · Pedidos Hoy",
    meta: construirMetaFiltrosPedidosTermicos({
      fechaReferencia: fechaReferencia || lista[0]?.created_at || new Date(),
      resumenFiltrosRapidos: resumenFiltros,
      cantidad: lista.length,
      rangoBusqueda,
      orden,
      totalCargados,
    }),
    secciones: crearSeccionesPedidosTermicos(lista),
    listado: {
      titulo: "Pedidos",
      modo: "tabla",
      vacio: "Sin pedidos para imprimir con estos filtros.",
      items: lista,
      campos: crearCamposPedidosTermicos(),
    },
    pie: "Pedidos Hoy · tabla compacta 58 mm / 80 mm",
  });
}

function ResumenMesasHoy({ pedidosActivos = [], cambiarEstadoPedido, guardandoEstadoPedidoId, puedeEditarPedido = false, onEditarPedido, editandoPedidoId }) {
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [mostrarTresPedidos, setMostrarTresPedidos] = useState(false);

  const pedidosPorMesa = useMemo(() => {
    const mapa = new Map(MESAS_DISPONIBLES.map((mesa) => [mesa, []]));

    pedidosActivos.forEach((pedido) => {
      const estado = obtenerEstadoPedido(pedido);
      if (estado === "Borrado") return;
      const mesa = normalizarMesaPedido(pedido);
      if (!mesa || !mapa.has(mesa)) return;
      mapa.get(mesa).push(pedido);
    });

    MESAS_DISPONIBLES.forEach((mesa) => {
      mapa.set(mesa, mapa.get(mesa).slice().sort(compararFechaPedidoDesc));
    });

    return mapa;
  }, [pedidosActivos]);

  const pedidosMesaSeleccionada = mesaSeleccionada ? pedidosPorMesa.get(mesaSeleccionada) || [] : [];
  const totalMesaSeleccionada = pedidosMesaSeleccionada.reduce((total, pedido) => total + Number(pedido?.total || 0), 0);

  return (
    <div className="admin-mesas-hoy-card">
      <div className="step-title admin-mesas-hoy-title">
        <span className="step-number">3</span>
        <div>
          <h4>Mesas y últimos pedidos</h4>
          <p className="muted small">Vista rápida por mesa, similar al paso de datos de entrega.</p>
        </div>
        <button
          type="button"
          className="button light admin-mesas-toggle"
          onClick={() => setMostrarTresPedidos((actual) => !actual)}
        >
          {mostrarTresPedidos ? "Ver solo último" : "Mostrar últimos 3"}
        </button>
      </div>

      <div className="admin-mesas-grid" aria-label="Resumen de mesas del día">
        {MESAS_DISPONIBLES.map((mesa) => {
          const pedidosMesa = pedidosPorMesa.get(mesa) || [];
          const ultimosPedidos = pedidosMesa.slice(0, mostrarTresPedidos ? 3 : 1);
          return (
            <article key={mesa} className={`admin-mesa-card ${mesa === "5B" ? "mesa-sola" : ""} ${pedidosMesa.length > 0 ? "con-pedidos" : "sin-pedidos"}`}>
              <div className="admin-mesa-card-head">
                <strong>{mesa}</strong>
                <span>{pedidosMesa.length} pedido{pedidosMesa.length === 1 ? "" : "s"}</span>
              </div>

              {ultimosPedidos.length > 0 ? (
                <div className="admin-mesa-ultimos">
                  {ultimosPedidos.map((pedido) => (
                    <div key={pedido.id} className="admin-mesa-pedido-mini">
                      <div>
                        <strong>#{obtenerCodigoPedido(pedido)}</strong>
                        <span>{formatearFechaHora(pedido.created_at)}</span>
                      </div>
                      <p>{resumirItemsPedidoCompacto(pedido)}</p>
                      <b>{dinero(pedido.total)}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="admin-mesa-vacia">Sin pedidos registrados hoy.</div>
              )}

              <button
                type="button"
                className="button light admin-mesa-ver"
                onClick={() => setMesaSeleccionada(mesa)}
                disabled={pedidosMesa.length === 0}
              >
                Ver pedido completo
              </button>

            </article>
          );
        })}
      </div>

      {mesaSeleccionada && (
        <div className="admin-mesa-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Pedido completo mesa ${mesaSeleccionada}`}>
          <div className="admin-mesa-modal">
            <div className="admin-mesa-modal-head">
              <div>
                <span>Mesa</span>
                <h3>{mesaSeleccionada}</h3>
                <p>{pedidosMesaSeleccionada.length} pedido{pedidosMesaSeleccionada.length === 1 ? "" : "s"} · Total {dinero(totalMesaSeleccionada)}</p>
              </div>
              <button type="button" className="button light" onClick={() => setMesaSeleccionada(null)}>
                Cerrar
              </button>
            </div>

            <div className="admin-mesa-modal-body">
              {pedidosMesaSeleccionada.map((pedido) => (
                <PedidoCocina
                  key={pedido.id}
                  pedido={pedido}
                  onCambiarEstado={cambiarEstadoPedido}
                  guardandoEstado={guardandoEstadoPedidoId === pedido.id}
                  puedeEditarPedido={puedeEditarPedido}
                  onEditarPedido={onEditarPedido}
                  editandoPedido={editandoPedidoId === pedido.id}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function formatearFechaInputPedido(valor) {
  const fecha = valor ? new Date(valor) : new Date();
  if (Number.isNaN(fecha.getTime())) return new Date().toISOString().slice(0, 10);
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatearHoraInputPedido(valor) {
  const fecha = valor ? new Date(valor) : new Date();
  if (Number.isNaN(fecha.getTime())) return "12:00";
  return `${String(fecha.getHours()).padStart(2, "0")}:${String(fecha.getMinutes()).padStart(2, "0")}`;
}

function CambiarFechaPedidoModal({ pedido, onCerrar, onGuardar, guardando = false }) {
  const [fecha, setFecha] = useState(() => formatearFechaInputPedido(pedido?.created_at));
  const [hora, setHora] = useState(() => formatearHoraInputPedido(pedido?.created_at));
  const [error, setError] = useState("");

  const guardar = async (event) => {
    event.preventDefault();
    setError("");

    if (!fecha || !hora) {
      setError("Selecciona la fecha y la hora del pedido.");
      return;
    }

    const fechaCompleta = new Date(`${fecha}T${hora}:00`);
    if (Number.isNaN(fechaCompleta.getTime())) {
      setError("La fecha seleccionada no es válida.");
      return;
    }

    const ok = await onGuardar?.(pedido, fechaCompleta.toISOString());
    if (ok) onCerrar?.();
  };

  return (
    <div className="admin-mesa-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Cambiar fecha pedido ${obtenerCodigoPedido(pedido)}`}>
      <form className="admin-mesa-modal editar-pedido-modal" onSubmit={guardar}>
        <div className="admin-mesa-modal-head">
          <div>
            <span>Cambiar fecha</span>
            <h3>Pedido #{obtenerCodigoPedido(pedido)}</h3>
            <p>Solo administrador. El pedido se moverá al informe y caja de la fecha seleccionada.</p>
          </div>
          <button type="button" className="button light" onClick={onCerrar} disabled={guardando}>Cerrar</button>
        </div>

        <div className="admin-mesa-modal-body editar-pedido-form">
          <label>
            Fecha real del pedido
            <input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} required />
          </label>
          <label>
            Hora aproximada
            <input type="time" value={hora} onChange={(event) => setHora(event.target.value)} required />
          </label>
          <div className="editar-pedido-form-full box soft">
            <strong>Resumen</strong>
            <p className="muted small">#{obtenerCodigoPedido(pedido)} · {obtenerCliente(pedido)} · {dinero(pedido?.total || 0)}</p>
            <p className="muted small">Fecha actual: {formatearFechaHora(pedido?.created_at)}</p>
          </div>
          {error ? <div className="alert alert-warning editar-pedido-form-full">{error}</div> : null}
        </div>

        <div className="editar-pedido-actions">
          <button type="button" className="button light" onClick={onCerrar} disabled={guardando}>Cancelar</button>
          <button type="submit" className="button green" disabled={guardando}>{guardando ? "Guardando..." : "Cambiar fecha"}</button>
        </div>
      </form>
    </div>
  );
}

function EditarPedidoModal({ pedido, onCerrar, onGuardar, guardando = false }) {
  const [form, setForm] = useState(() => ({
    cliente: pedido?.cliente || pedido?.cliente_nombre || "",
    telefono: pedido?.telefono || "",
    ubicacion: pedido?.ubicacion || "",
    mesa: pedido?.mesa || "",
    mesero: pedido?.mesero || "",
    tipo_pago: normalizarMetodoPago(pedido?.tipo_pago, { permitirCredito: true, fallback: METODOS_PAGO.EFECTIVO }),
    observaciones: pedido?.observaciones || "",
    pedido_texto: pedido?.pedido_texto || "",
    total: Number(pedido?.total || 0),
  }));

  const cambiarCampo = (campo) => (event) => {
    const valor = campo === "total" ? event.target.value : event.target.value;
    setForm((actual) => ({ ...actual, [campo]: valor }));
  };

  const guardar = async (event) => {
    event.preventDefault();
    const ok = await onGuardar?.(pedido.id, { ...form, total: Number(form.total || 0) });
    if (ok) onCerrar?.();
  };

  return (
    <div className="admin-mesa-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Editar pedido ${obtenerCodigoPedido(pedido)}`}>
      <form className="admin-mesa-modal editar-pedido-modal" onSubmit={guardar}>
        <div className="admin-mesa-modal-head">
          <div>
            <span>Editar pedido</span>
            <h3>#{obtenerCodigoPedido(pedido)}</h3>
            <p>Solo rol administrador. Los cambios quedan en auditoría.</p>
          </div>
          <button type="button" className="button light" onClick={onCerrar} disabled={guardando}>Cerrar</button>
        </div>

        <div className="admin-mesa-modal-body editar-pedido-form">
          <label>
            Cliente / mesa
            <input value={form.cliente} onChange={cambiarCampo("cliente")} required />
          </label>
          <label>
            Teléfono
            <input value={form.telefono} onChange={cambiarCampo("telefono")} />
          </label>
          <label>
            Ubicación
            <input value={form.ubicacion} onChange={cambiarCampo("ubicacion")} />
          </label>
          <label>
            Mesa
            <select value={form.mesa} onChange={cambiarCampo("mesa")}>
              <option value="">Sin mesa</option>
              {MESAS_DISPONIBLES.map((mesa) => <option key={mesa} value={mesa}>{mesa}</option>)}
              <option value="Llevar">Llevar</option>
            </select>
          </label>
          <label>
            Mesero
            <input value={form.mesero} onChange={cambiarCampo("mesero")} />
          </label>
          <label>
            Método de pago
            <select value={form.tipo_pago} onChange={cambiarCampo("tipo_pago")}>
              {FORMAS_PAGO_MESA.map((metodo) => (
                <option key={metodo} value={metodo}>{metodo}</option>
              ))}
            </select>
          </label>
          <label>
            Total
            <input type="number" min="0" step="100" value={form.total} onChange={cambiarCampo("total")} required />
          </label>
          <label className="editar-pedido-form-full">
            Observaciones
            <textarea rows="3" value={form.observaciones} onChange={cambiarCampo("observaciones")} />
          </label>
          <label className="editar-pedido-form-full">
            Detalle manual del pedido
            <textarea rows="5" value={form.pedido_texto} onChange={cambiarCampo("pedido_texto")} placeholder="Opcional. Útil para correcciones rápidas cuando el pedido no tiene items estructurados." />
          </label>
        </div>

        <div className="editar-pedido-actions">
          <button type="button" className="button light" onClick={onCerrar} disabled={guardando}>Cancelar</button>
          <button type="submit" className="button green" disabled={guardando}>{guardando ? "Guardando..." : "Guardar cambios"}</button>
        </div>
      </form>
    </div>
  );
}

function CorregirClienteCreditoModal({ pedido, onCerrar, onGuardar, onRetirar, guardando = false, mensaje = "" }) {
  const [nombre, setNombre] = useState(() => pedido?.cliente_nombre || pedido?.cliente || "");
  const [clientesCredito, setClientesCredito] = useState([]);
  const [cargandoClientes, setCargandoClientes] = useState(false);
  const [formaPagoRetiro, setFormaPagoRetiro] = useState(METODOS_PAGO.EFECTIVO);
  const pedidoEsCredito = esMetodoPagoCredito(pedido?.tipo_pago);

  useEffect(() => {
    let activo = true;

    async function cargarClientesCredito() {
      setCargandoClientes(true);
      try {
        const lista = await listarClientesCreditoActivos();
        if (!activo) return;
        setClientesCredito(Array.isArray(lista) ? lista : []);
      } catch (error) {
        console.warn("No se pudieron cargar clientes crédito para Pedidos Hoy:", error?.message || error);
      } finally {
        if (activo) setCargandoClientes(false);
      }
    }

    cargarClientesCredito();
    return () => {
      activo = false;
    };
  }, []);

  const clientesOrdenados = useMemo(() => {
    return clientesCredito
      .map((cliente) => cliente?.nombre)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [clientesCredito]);

  const guardar = async (event) => {
    event.preventDefault();
    const ok = await onGuardar?.(pedido, nombre);
    if (ok) onCerrar?.();
  };

  const retirar = async () => {
    const ok = await onRetirar?.(pedido, formaPagoRetiro);
    if (ok) onCerrar?.();
  };

  return (
    <div className="admin-mesa-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Clasificar pedido ${obtenerCodigoPedido(pedido)} como crédito`}>
      <form className="admin-mesa-modal editar-pedido-modal" onSubmit={guardar}>
        <div className="admin-mesa-modal-head">
          <div>
            <span>{pedidoEsCredito ? "Gestionar crédito" : "Clasificar como crédito"}</span>
            <h3>Pedido #{obtenerCodigoPedido(pedido)}</h3>
            <p>{pedidoEsCredito ? "Puedes corregir el cliente crédito o retirar este pedido de cartera si realmente fue pagado por otro medio." : "Esta acción cambia el pedido a Crédito, ajusta el nombre del cliente y registra la cuenta por cobrar."}</p>
          </div>
          <button type="button" className="button light" onClick={onCerrar} disabled={guardando}>Cerrar</button>
        </div>

        <div className="admin-mesa-modal-body editar-pedido-form">
          <label className="editar-pedido-form-full">
            Cliente crédito existente
            <select
              value={clientesOrdenados.includes(nombre) ? nombre : ""}
              onChange={(event) => event.target.value && setNombre(event.target.value)}
              disabled={guardando || cargandoClientes}
            >
              <option value="">{cargandoClientes ? "Cargando clientes..." : "Seleccionar de la lista"}</option>
              {clientesOrdenados.map((cliente) => (
                <option key={cliente} value={cliente}>{cliente}</option>
              ))}
            </select>
          </label>
          <label className="editar-pedido-form-full">
            Nombre del cliente
            <input
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder="Escribe o corrige el nombre del cliente"
              list="clientes-credito-pedidos-hoy"
              required
              autoFocus
            />
            <datalist id="clientes-credito-pedidos-hoy">
              {clientesOrdenados.map((cliente) => (
                <option key={cliente} value={cliente} />
              ))}
            </datalist>
            <small className="muted">Puedes escoger un cliente fijo o escribir un nuevo nombre para crearlo en Clientes Crédito.</small>
          </label>
          <div className="editar-pedido-form-full cartera-correccion-resumen">
            <strong>Valor a cartera:</strong> {dinero(pedido?.total || 0)} · <strong>Pago actual:</strong> {pedido?.tipo_pago || "—"}
          </div>

          {pedidoEsCredito ? (
            <div className="editar-pedido-form-full cartera-retiro-credito-box">
              <h4>¿Este pedido no era crédito?</h4>
              <p className="muted small">Retíralo de cartera y cambia la forma de pago real. El pedido no se borra; solo se anula el movimiento de cartera y se recalcula el saldo del cliente.</p>
              <label>
                Forma de pago real
                <select value={formaPagoRetiro} onChange={(event) => setFormaPagoRetiro(event.target.value)} disabled={guardando}>
                  {FORMAS_PAGO_ABONO_CARTERA.map((metodo) => (
                    <option key={metodo} value={metodo}>{metodo}</option>
                  ))}
                </select>
              </label>
              <button type="button" className="button danger" onClick={retirar} disabled={guardando}>
                {guardando ? "Guardando..." : "Quitar de crédito"}
              </button>
            </div>
          ) : null}

          {mensaje ? <div className="alert alert-warning editar-pedido-form-full">{mensaje}</div> : null}
        </div>

        <div className="editar-pedido-actions">
          <button type="button" className="button light" onClick={onCerrar} disabled={guardando}>Cancelar</button>
          <button type="submit" className="button green" disabled={guardando}>{guardando ? "Guardando..." : pedidoEsCredito ? "Actualizar cliente crédito" : "Pasar a crédito"}</button>
        </div>
      </form>
    </div>
  );
}

function AdminPedidosSectionBase({
  tituloPedidos,
  setRecargaPedidos,
  alertaPedidoNuevo,
  setAlertaPedidoNuevo,
  estadoRealtimePedidos,
  realtimeAdminActivo = true,
  cambiarEstadoRealtimeAdmin,
  filtroPedidos,
  setFiltroPedidos,
  fechaSeleccionada,
  setFechaSeleccionada,
  fechaInicioRangoPedidos,
  setFechaInicioRangoPedidos,
  fechaFinRangoPedidos,
  setFechaFinRangoPedidos,
  hayBusquedaPedidos,
  setBusqueda,
  busqueda,
  busquedaNumeroPedido = "",
  setBusquedaNumeroPedido,
  buscarPedidoPorNumeroGlobal,
  limpiarBusquedaNumeroPedido,
  resultadoNumeroPedido = [],
  cargandoNumeroPedido = false,
  errorNumeroPedido = "",
  cargandoPedidos = false,
  errorCargaPedidos = "",
  paginacionPedidos = {},
  cargarMasPedidos,
  pedidosFiltrados,
  pedidos,
  pedidosBorrados,
  pedidosPendientes,
  puedeFinalizarPendientes,
  finalizarTodosPendientes,
  finalizandoPendientes,
  cambiarEstadoPedido,
  guardandoEstadoPedidoId,
  puedeEliminarPedido,
  eliminarPedidoAdministrador,
  eliminandoPedidoId,
  puedeEditarPedido = false,
  editarPedidoAdministrador,
  cambiarFechaPedidoAdministrador,
  onEditarPedidoEnMesas,
  editandoPedidoId,
  pedidosActivos,
}) {
  const [pedidoEditando, setPedidoEditando] = useState(null);
  const [pedidoCambiandoFecha, setPedidoCambiandoFecha] = useState(null);
  const [pedidoCorrigiendoCliente, setPedidoCorrigiendoCliente] = useState(null);
  const [guardandoCorreccionClienteId, setGuardandoCorreccionClienteId] = useState(null);
  const [mensajeCorreccionCliente, setMensajeCorreccionCliente] = useState("");
  const [ordenPedidosHoy, setOrdenPedidosHoy] = useState("ultimos");
  const [vistaPedidosHoy, setVistaPedidosHoy] = useState("pedidos");
  const [filtrosTipoPedido, setFiltrosTipoPedido] = useState({
    restauranteParaLlevar: false,
    cafeteriaParaLlevar: false,
    restauranteMesa: false,
    cafeteriaMesa: false,
  });
  const [filtroTipoPagoRapido, setFiltroTipoPagoRapido] = useState("");
  const [mostrarModalFiltrosRapidos, setMostrarModalFiltrosRapidos] = useState(false);
  const [mostrarFiltrosPedidos, setMostrarFiltrosPedidos] = useState(true);
  const [mostrarAlertaRafiki, modalAlertaRafiki] = useAlertaRafiki();
  const [ahoraPedidosHoy, setAhoraPedidosHoy] = useState(() => new Date());
  const totalPedidosServidor = Number.isFinite(paginacionPedidos?.total) ? paginacionPedidos.total : null;
  const hayMasPedidos = Boolean(paginacionPedidos?.hayMas);
  const cargandoMasPedidos = Boolean(paginacionPedidos?.cargandoMas);
  const totalCargadosServidor = Number.isFinite(paginacionPedidos?.cargados)
    ? paginacionPedidos.cargados
    : pedidos.length;
  const cantidadPedidosActivos = Array.isArray(pedidosActivos) ? pedidosActivos.length : 0;
  const cantidadPedidosBorrados = Array.isArray(pedidosBorrados) ? pedidosBorrados.length : 0;

  useEffect(() => {
    const intervalo = window.setInterval(() => setAhoraPedidosHoy(new Date()), 60 * 1000);
    return () => window.clearInterval(intervalo);
  }, []);

  const pedidosActivosVisuales = useMemo(
    () => aplicarEstadoVisualListaPedidos(pedidosActivos, ahoraPedidosHoy),
    [ahoraPedidosHoy, pedidosActivos]
  );

  const resultadoNumeroPedidoVisual = useMemo(
    () => aplicarEstadoVisualListaPedidos(resultadoNumeroPedido, ahoraPedidosHoy),
    [ahoraPedidosHoy, resultadoNumeroPedido]
  );

  const pedidosPendientesVisuales = useMemo(
    () => aplicarEstadoVisualListaPedidos(pedidosPendientes, ahoraPedidosHoy).filter((pedido) => obtenerEstadoPedido(pedido) === "Pendiente"),
    [ahoraPedidosHoy, pedidosPendientes]
  );

  const pedidosUnificados = useMemo(() => {
    const lista = Array.isArray(pedidosActivosVisuales) ? pedidosActivosVisuales.slice() : [];
    return lista.sort((a, b) => {
      const fechaA = new Date(a?.created_at || 0).getTime();
      const fechaB = new Date(b?.created_at || 0).getTime();
      return ordenPedidosHoy === "primeros" ? fechaA - fechaB : fechaB - fechaA;
    });
  }, [pedidosActivosVisuales, ordenPedidosHoy]);

  const pedidosVisiblesTabla = useMemo(
    () => aplicarFiltrosRapidosPedidos(pedidosUnificados, filtrosTipoPedido, filtroTipoPagoRapido),
    [filtroTipoPagoRapido, filtrosTipoPedido, pedidosUnificados]
  );

  const hayFiltrosRapidosActivos = Object.values(filtrosTipoPedido).some(Boolean) || Boolean(filtroTipoPagoRapido);

  const resumenFiltrosRapidos = useMemo(() => {
    const etiquetas = [];
    if (filtrosTipoPedido.restauranteParaLlevar) etiquetas.push("Restaurante para llevar");
    if (filtrosTipoPedido.cafeteriaParaLlevar) etiquetas.push("Cafetería para llevar");
    if (filtrosTipoPedido.restauranteMesa) etiquetas.push("Restaurante en mesa");
    if (filtrosTipoPedido.cafeteriaMesa) etiquetas.push("Cafetería en mesa");
    if (filtroTipoPagoRapido) etiquetas.push(`Pago: ${filtroTipoPagoRapido}`);
    return etiquetas.length > 0 ? etiquetas.join(" · ") : "Sin filtros rápidos activos";
  }, [filtroTipoPagoRapido, filtrosTipoPedido]);

  const fechaReferenciaImpresion = useMemo(() => {
    if (filtroPedidos === "dia" && fechaSeleccionada) return new Date(`${fechaSeleccionada}T12:00:00-05:00`);
    if (filtroPedidos === "rango" && fechaInicioRangoPedidos) return new Date(`${fechaInicioRangoPedidos}T12:00:00-05:00`);
    return new Date();
  }, [fechaInicioRangoPedidos, fechaSeleccionada, filtroPedidos]);

  const rangoBusquedaPedidosTermico = useMemo(() => describirRangoBusquedaPedidosTermico({
    filtroPedidos,
    fechaSeleccionada,
    fechaInicioRangoPedidos,
    fechaFinRangoPedidos,
    busqueda,
    busquedaNumeroPedido,
  }), [busqueda, busquedaNumeroPedido, fechaFinRangoPedidos, fechaInicioRangoPedidos, fechaSeleccionada, filtroPedidos]);

  const tabsPedidosHoy = useMemo(() => ([
    { id: "pedidos", label: "Pedidos", icon: "📋", count: pedidosUnificados.length },
    { id: "mesas", label: "Mesas", icon: "🍽️", count: cantidadPedidosActivos },
    { id: "borrados", label: "Borrados", icon: "🗑️", count: cantidadPedidosBorrados },
  ]), [cantidadPedidosActivos, cantidadPedidosBorrados, pedidosUnificados.length]);

  const abrirEditorPedido = useCallback((pedido) => {
    if (onEditarPedidoEnMesas) {
      onEditarPedidoEnMesas(pedido);
      return;
    }

    setPedidoEditando(pedido);
  }, [onEditarPedidoEnMesas]);


  const abrirCambioFechaPedido = useCallback((pedido) => {
    setPedidoCambiandoFecha(pedido);
  }, []);


  const abrirCorreccionClienteCredito = useCallback((pedido) => {
    setMensajeCorreccionCliente("");
    setPedidoCorrigiendoCliente(pedido);
  }, []);

  const guardarCorreccionClienteCredito = useCallback(async (pedido, nombreDestino) => {
    const nombreLimpio = String(nombreDestino || "").trim().replace(/\s+/g, " ");
    if (!pedido?.id || !nombreLimpio) {
      setMensajeCorreccionCliente("Escribe el nombre correcto del cliente crédito.");
      return false;
    }

    setGuardandoCorreccionClienteId(pedido.id);
    setMensajeCorreccionCliente("");

    try {
      const pedidoActualizado = {
        ...pedido,
        cliente: nombreLimpio,
        cliente_nombre: nombreLimpio,
        tipo_pago: METODOS_PAGO.CREDITO,
      };

      const okPedido = await editarPedidoAdministrador?.(pedido.id, pedidoActualizado);
      if (!okPedido) return false;

      await corregirClienteCreditoDePedido(pedidoActualizado, nombreLimpio);
      setRecargaPedidos((actual) => actual + 1);
      return true;
    } catch (error) {
      setMensajeCorreccionCliente(error?.message || "No se pudo clasificar el pedido como crédito.");
      return false;
    } finally {
      setGuardandoCorreccionClienteId(null);
    }
  }, [editarPedidoAdministrador, setRecargaPedidos]);

  const retirarPedidoDeCredito = useCallback(async (pedido, nuevoTipoPago = METODOS_PAGO.EFECTIVO) => {
    if (!pedido?.id) {
      setMensajeCorreccionCliente("No se pudo identificar el pedido.");
      return false;
    }

    const pagoReal = normalizarMetodoPago(nuevoTipoPago, { permitirCredito: true, fallback: METODOS_PAGO.EFECTIVO });
    if (esMetodoPagoCredito(pagoReal)) {
      setMensajeCorreccionCliente("Selecciona una forma de pago diferente a Crédito.");
      return false;
    }

    setGuardandoCorreccionClienteId(pedido.id);
    setMensajeCorreccionCliente("");

    try {
      const pedidoActualizado = {
        ...pedido,
        tipo_pago: pagoReal,
      };

      const okPedido = await editarPedidoAdministrador?.(pedido.id, pedidoActualizado);
      if (!okPedido) return false;

      setRecargaPedidos((actual) => actual + 1);
      return true;
    } catch (error) {
      setMensajeCorreccionCliente(error?.message || "No se pudo retirar el pedido de crédito.");
      return false;
    } finally {
      setGuardandoCorreccionClienteId(null);
    }
  }, [editarPedidoAdministrador, setRecargaPedidos]);

  const refrescarPedidos = useCallback(() => {
    setRecargaPedidos((actual) => actual + 1);
  }, [setRecargaPedidos]);

  const cerrarAlertaPedidoNuevo = useCallback(() => {
    setAlertaPedidoNuevo(null);
  }, [setAlertaPedidoNuevo]);

  const alternarFiltroTipoPedido = useCallback((clave) => {
    setFiltrosTipoPedido((actual) => ({ ...actual, [clave]: !actual[clave] }));
    setVistaPedidosHoy("pedidos");
  }, []);

  const limpiarFiltrosRapidosPedidos = useCallback(() => {
    setFiltrosTipoPedido({
      restauranteParaLlevar: false,
      cafeteriaParaLlevar: false,
      restauranteMesa: false,
      cafeteriaMesa: false,
    });
    setFiltroTipoPagoRapido("");
    setVistaPedidosHoy("pedidos");
  }, []);

  const imprimirPedidosFiltradosTermico = useCallback((formato) => {
    const tituloTicket = hayFiltrosRapidosActivos ? "Pedidos filtrados" : "Pedidos de hoy";
    const ok = imprimirResumenPedidosFiltradosTermico({
      pedidos: pedidosVisiblesTabla,
      fechaReferencia: fechaReferenciaImpresion,
      titulo: tituloTicket,
      resumenFiltros: resumenFiltrosRapidos,
      rangoBusqueda: rangoBusquedaPedidosTermico,
      orden: ordenPedidosHoy,
      totalCargados: totalCargadosServidor,
      formato,
    });
    if (!ok) {
      mostrarAlertaRafiki({
        tipo: "error",
        titulo: "Impresión bloqueada",
        mensaje: "No se pudo abrir la ventana de impresión. Permite las ventanas emergentes para Rafiki Pedidos e inténtalo nuevamente."
      });
    }
  }, [fechaReferenciaImpresion, hayFiltrosRapidosActivos, mostrarAlertaRafiki, ordenPedidosHoy, pedidosVisiblesTabla, rangoBusquedaPedidosTermico, resumenFiltrosRapidos, totalCargadosServidor]);

  return (
    <section className="card card-pad">
      <div className="admin-top-row admin-top-row-compact">
        <div className="admin-title-compact">
          <h2>📋 {tituloPedidos}</h2>
          <p className="muted small">Preparación, seguimiento e historial.</p>
        </div>

        <div className="admin-actions-line">
          <AdminRealtimeStatus estadoRealtimePedidos={estadoRealtimePedidos} />

          <button
            type="button"
            className="button light admin-action-button"
            onClick={() => setMostrarFiltrosPedidos((valor) => !valor)}
          >
            {mostrarFiltrosPedidos ? "Ocultar filtros" : "Mostrar filtros"}
          </button>

          <button
            type="button"
            className="button light admin-action-button"
            onClick={refrescarPedidos}
          >
            🔄 Actualizar datos
          </button>


          <button
            type="button"
            className={realtimeAdminActivo ? "button light realtime-toggle-on admin-action-button" : "button realtime-toggle-off admin-action-button"}
            onClick={cambiarEstadoRealtimeAdmin}
            title={realtimeAdminActivo ? "Desactivar actualizaciones en vivo" : "Activar actualizaciones en vivo"}
          >
            {realtimeAdminActivo ? "Realtime ON" : "Realtime OFF"}
          </button>
        </div>
      </div>

      {alertaPedidoNuevo && (
        <div className="alerta-pedido-nuevo">
          <div>
            <strong>🔔 Nuevo pedido #{obtenerCodigoPedido(alertaPedidoNuevo)}</strong>
            <span>{obtenerCliente(alertaPedidoNuevo)} · {dinero(alertaPedidoNuevo.total)}</span>
          </div>
          <button type="button" onClick={cerrarAlertaPedidoNuevo}>
            Cerrar
          </button>
        </div>
      )}

      {mostrarFiltrosPedidos ? (
        <div className="pedidos-filtros-card">
          <AdminPedidosFiltros
            filtroPedidos={filtroPedidos}
            setFiltroPedidos={setFiltroPedidos}
            fechaSeleccionada={fechaSeleccionada}
            setFechaSeleccionada={setFechaSeleccionada}
            fechaInicioRangoPedidos={fechaInicioRangoPedidos}
            setFechaInicioRangoPedidos={setFechaInicioRangoPedidos}
            fechaFinRangoPedidos={fechaFinRangoPedidos}
            setFechaFinRangoPedidos={setFechaFinRangoPedidos}
            hayBusquedaPedidos={hayBusquedaPedidos}
            setBusqueda={setBusqueda}
            busqueda={busqueda}
            busquedaNumeroPedido={busquedaNumeroPedido}
            setBusquedaNumeroPedido={setBusquedaNumeroPedido}
            buscarPedidoPorNumeroGlobal={buscarPedidoPorNumeroGlobal}
            limpiarBusquedaNumeroPedido={limpiarBusquedaNumeroPedido}
            cargandoNumeroPedido={cargandoNumeroPedido}
          />
        </div>
      ) : (
        <div className="pedidos-filtros-resumen-colapsado">
          <span>Filtros ocultos para limpiar la pantalla.</span>
          <button type="button" className="mini-btn" onClick={() => setMostrarFiltrosPedidos(true)}>Mostrar filtros</button>
        </div>
      )}

      <div className="pedidos-filtros-rapidos-card pedidos-filtros-rapidos-card-modalizado">
        <div className="pedidos-filtros-rapidos-head">
          <div>
            <strong>Filtros rápidos</strong>
            <span className="muted small pedidos-filtros-rapidos-contador">
              {pedidosVisiblesTabla.length} pedido{pedidosVisiblesTabla.length === 1 ? "" : "s"} · {resumenFiltrosRapidos}
            </span>
          </div>
          <div className="pedidos-filtros-rapidos-acciones">
            <button type="button" className={hayFiltrosRapidosActivos ? "mini-btn active" : "mini-btn"} onClick={() => setMostrarModalFiltrosRapidos(true)}>
              ⚙️ Filtros
            </button>
            <ThermalPrintControls
              onPrint={imprimirPedidosFiltradosTermico}
              disabled={pedidosVisiblesTabla.length === 0}
              label="Imprimir"
              title="Tamaño"
              buttonClassName="mini-btn"
              compact
            />
          </div>
        </div>
      </div>

      {(resultadoNumeroPedidoVisual.length > 0 || errorNumeroPedido) && (
        <div className="pedido-numero-global-resultados">
          <div className="section-heading section-heading-pedidos-unificados">
            <h3>🔎 Resultado por número de pedido</h3>
            <span>{resultadoNumeroPedidoVisual.length}</span>
          </div>
          {errorNumeroPedido && resultadoNumeroPedidoVisual.length === 0 ? (
            <div className="alert alert-warning">{errorNumeroPedido}</div>
          ) : (
            <TablaPedidosCompacta
              pedidos={resultadoNumeroPedidoVisual}
              onCambiarEstado={cambiarEstadoPedido}
              guardandoEstadoPedidoId={guardandoEstadoPedidoId}
              onEliminarPedido={puedeEliminarPedido ? eliminarPedidoAdministrador : undefined}
              eliminandoPedidoId={eliminandoPedidoId}
              onEditarPedido={puedeEditarPedido ? abrirEditorPedido : undefined}
              editandoPedidoId={editandoPedidoId}
              onCambiarFechaPedido={puedeEditarPedido ? abrirCambioFechaPedido : undefined}
              cambiandoFechaPedidoId={editandoPedidoId}
              onCorregirClienteCredito={puedeEditarPedido ? abrirCorreccionClienteCredito : undefined}
              corrigiendoClientePedidoId={guardandoCorreccionClienteId}
            />
          )}
        </div>
      )}

      {cargandoPedidos && (
        <div className="box soft admin-loading-state" role="status">
          Cargando pedidos... La última información visible se conserva mientras se actualiza.
        </div>
      )}

      {errorCargaPedidos && !cargandoPedidos && (
        <div className="alert alert-warning admin-fallback-state" role="alert">
          {errorCargaPedidos}
        </div>
      )}

      <div className="pedidos-carga-resumen" role="status">
        <p className="muted small">
          Mostrando {pedidosFiltrados.length} filtrado{pedidosFiltrados.length === 1 ? "" : "s"} de {pedidos.length} pedido{pedidos.length === 1 ? "" : "s"} cargado{pedidos.length === 1 ? "" : "s"}
          {totalPedidosServidor !== null ? ` · total del rango: ${totalPedidosServidor}` : ""}.
          {pedidosBorrados.length > 0 ? ` ${pedidosBorrados.length} en Pedidos Borrados no suman en ventas.` : ""}
        </p>
        {paginacionPedidos?.advertencia ? (
          <p className="muted small pedidos-carga-aviso">{paginacionPedidos.advertencia}</p>
        ) : null}
      </div>

      <RafikiTabs
        tabs={tabsPedidosHoy}
        activeTab={vistaPedidosHoy}
        onChange={setVistaPedidosHoy}
        className="pedidos-hoy-tabs"
        ariaLabel="Secciones de Pedidos Hoy"
      />

      {vistaPedidosHoy === "mesas" ? (
        <ResumenMesasHoy
          pedidosActivos={pedidosActivosVisuales}
          cambiarEstadoPedido={cambiarEstadoPedido}
          guardandoEstadoPedidoId={guardandoEstadoPedidoId}
          puedeEditarPedido={puedeEditarPedido}
          onEditarPedido={abrirEditorPedido}
          editandoPedidoId={editandoPedidoId}
        />
      ) : null}

      {vistaPedidosHoy === "pedidos" ? (
      <div className="pedido-seccion">
        {hayFiltrosRapidosActivos ? (
          <div className="alert alert-info pedidos-filtro-activo">
            Filtros rápidos activos. Mostrando <strong>{pedidosVisiblesTabla.length}</strong> pedido{pedidosVisiblesTabla.length === 1 ? "" : "s"}.
          </div>
        ) : null}
        <div className="section-heading section-heading-pedidos-unificados">
          <h3>{hayFiltrosRapidosActivos ? "🔎 Pedidos filtrados" : "📋 Pedidos"}</h3>
          <div className="section-heading-actions pedidos-orden-actions">
            {pedidosPendientesVisuales.length > 0 && puedeFinalizarPendientes && (
              <button
                type="button"
                className="mini-btn green"
                onClick={finalizarTodosPendientes}
                disabled={finalizandoPendientes}
              >
                {finalizandoPendientes ? "Finalizando..." : "Finalizar todos"}
              </button>
            )}
            <button
              type="button"
              className={ordenPedidosHoy === "ultimos" ? "mini-btn active" : "mini-btn"}
              onClick={() => setOrdenPedidosHoy("ultimos")}
              title="Mostrar primero los últimos pedidos"
            >
              Últimos
            </button>
            <button
              type="button"
              className={ordenPedidosHoy === "primeros" ? "mini-btn active" : "mini-btn"}
              onClick={() => setOrdenPedidosHoy("primeros")}
              title="Mostrar desde el primer pedido del día"
            >
              Primeros
            </button>
            <span>{pedidosVisiblesTabla.length}</span>
          </div>
        </div>

        {pedidosVisiblesTabla.some((pedido) => pedido.estado_visual_auto === "entregado_por_corte_730pm") ? (
          <div className="alert alert-info pedidos-corte-730">
            Después de las 7:30 p. m., los pedidos pendientes de ese día se muestran como entregados en Pedidos Hoy. No se cambian automáticamente en Supabase.
          </div>
        ) : null}

        {pedidosVisiblesTabla.length === 0 ? (
          <RafikiEmptyState
            icon="📋"
            title={hayFiltrosRapidosActivos ? "No hay pedidos con esos filtros" : "No hay pedidos en esta vista"}
            description={hayFiltrosRapidosActivos ? "Prueba limpiar o combinar otros filtros rápidos para ampliar los resultados." : "Cuando entren pedidos activos o finalizados, aparecerán aquí con sus estados, pagos y acciones."}
          />
        ) : (
          <TablaPedidosCompacta
            pedidos={pedidosVisiblesTabla}
            onCambiarEstado={cambiarEstadoPedido}
            guardandoEstadoPedidoId={guardandoEstadoPedidoId}
            onEliminarPedido={puedeEliminarPedido ? eliminarPedidoAdministrador : undefined}
            eliminandoPedidoId={eliminandoPedidoId}
            onEditarPedido={puedeEditarPedido ? abrirEditorPedido : undefined}
            editandoPedidoId={editandoPedidoId}
            onCambiarFechaPedido={puedeEditarPedido ? abrirCambioFechaPedido : undefined}
            cambiandoFechaPedidoId={editandoPedidoId}
            onCorregirClienteCredito={puedeEditarPedido ? abrirCorreccionClienteCredito : undefined}
            corrigiendoClientePedidoId={guardandoCorreccionClienteId}
          />
        )}
      </div>
      ) : null}

      {vistaPedidosHoy === "pedidos" && hayMasPedidos && (
        <div className="pedidos-cargar-mas-box">
          <div>
            <strong>Carga optimizada activa</strong>
            <p className="muted small">
              Se cargaron {totalCargadosServidor} de {totalPedidosServidor || "más"} pedido{totalCargadosServidor === 1 ? "" : "s"}.
              Puedes traer más resultados sin bloquear el celular.
            </p>
          </div>
          <button
            type="button"
            className="button light"
            onClick={cargarMasPedidos}
            disabled={cargandoMasPedidos || cargandoPedidos}
          >
            {cargandoMasPedidos ? "Cargando más..." : "Cargar más resultados"}
          </button>
        </div>
      )}

      {vistaPedidosHoy === "borrados" ? (
        <AdminPedidoGrupo
          icono="🗑️"
          titulo="Pedidos Borrados"
          pedidos={pedidosBorrados}
          mensajeVacio="No hay pedidos borrados."
          danger
          cambiarEstadoPedido={cambiarEstadoPedido}
          guardandoEstadoPedidoId={guardandoEstadoPedidoId}
          eliminandoPedidoId={eliminandoPedidoId}
          puedeEditarPedido={puedeEditarPedido}
          onEditarPedido={abrirEditorPedido}
          editandoPedidoId={editandoPedidoId}
        />
      ) : null}

      <RafikiModal
        open={mostrarModalFiltrosRapidos}
        title="Filtros rápidos"
        description="Selecciona una o varias opciones. La impresión 58 mm y 80 mm usará exactamente los pedidos visibles en pantalla; solo cambia la optimización del ancho."
        onClose={() => setMostrarModalFiltrosRapidos(false)}
        size="sm"
        footer={(
          <>
            {hayFiltrosRapidosActivos ? (
              <button type="button" className="button light" onClick={limpiarFiltrosRapidosPedidos}>Limpiar filtros</button>
            ) : null}
            <button type="button" className="button" onClick={() => setMostrarModalFiltrosRapidos(false)}>Aplicar filtros</button>
          </>
        )}
      >
        <div className="pedidos-filtros-modal-grid">
          <button type="button" className={filtrosTipoPedido.restauranteParaLlevar ? "filtro-modal-opcion active" : "filtro-modal-opcion"} onClick={() => alternarFiltroTipoPedido("restauranteParaLlevar")}>
            <span>🥡</span>
            <strong>Restaurante para llevar</strong>
          </button>
          <button type="button" className={filtrosTipoPedido.cafeteriaParaLlevar ? "filtro-modal-opcion active" : "filtro-modal-opcion"} onClick={() => alternarFiltroTipoPedido("cafeteriaParaLlevar")}>
            <span>☕</span>
            <strong>Cafetería para llevar</strong>
          </button>
          <button type="button" className={filtrosTipoPedido.restauranteMesa ? "filtro-modal-opcion active" : "filtro-modal-opcion"} onClick={() => alternarFiltroTipoPedido("restauranteMesa")}>
            <span>🍽️</span>
            <strong>Restaurante en mesa</strong>
          </button>
          <button type="button" className={filtrosTipoPedido.cafeteriaMesa ? "filtro-modal-opcion active" : "filtro-modal-opcion"} onClick={() => alternarFiltroTipoPedido("cafeteriaMesa")}>
            <span>☕</span>
            <strong>Cafetería en mesa</strong>
          </button>
        </div>
        <label className="pedido-filtro-pago-modal">
          <span>Tipo de pago</span>
          <select value={filtroTipoPagoRapido} onChange={(e) => setFiltroTipoPagoRapido(e.target.value)}>
            <option value="">Todos</option>
            {FORMAS_PAGO_MESA.map((metodo) => (
              <option key={metodo} value={metodo}>{metodo}</option>
            ))}
            <option value={METODOS_PAGO.NEQUI}>Nequi</option>
          </select>
        </label>
        <p className="muted small pedidos-filtros-modal-resumen">
          Resultado actual: <strong>{pedidosVisiblesTabla.length}</strong> pedido{pedidosVisiblesTabla.length === 1 ? "" : "s"} visible{pedidosVisiblesTabla.length === 1 ? "" : "s"}.
        </p>
        <div className="pedidos-filtros-modal-impresion">
          <ThermalPrintControls
            onPrint={imprimirPedidosFiltradosTermico}
            disabled={pedidosVisiblesTabla.length === 0}
            label="Imprimir"
            title="Tamaño"
            buttonClassName="mini-btn"
          />
        </div>
      </RafikiModal>

      {modalAlertaRafiki}

      {pedidoEditando && (
        <EditarPedidoModal
          pedido={pedidoEditando}
          onCerrar={() => setPedidoEditando(null)}
          onGuardar={editarPedidoAdministrador}
          guardando={editandoPedidoId === pedidoEditando.id}
        />
      )}



      {pedidoCambiandoFecha && (
        <CambiarFechaPedidoModal
          pedido={pedidoCambiandoFecha}
          onCerrar={() => setPedidoCambiandoFecha(null)}
          onGuardar={cambiarFechaPedidoAdministrador}
          guardando={editandoPedidoId === pedidoCambiandoFecha.id}
        />
      )}

      {pedidoCorrigiendoCliente && (
        <CorregirClienteCreditoModal
          pedido={pedidoCorrigiendoCliente}
          onCerrar={() => {
            setPedidoCorrigiendoCliente(null);
            setMensajeCorreccionCliente("");
          }}
          onGuardar={guardarCorreccionClienteCredito}
          onRetirar={retirarPedidoDeCredito}
          guardando={guardandoCorreccionClienteId === pedidoCorrigiendoCliente.id}
          mensaje={mensajeCorreccionCliente}
        />
      )}

    </section>
  );
}

export default React.memo(AdminPedidosSectionBase);
