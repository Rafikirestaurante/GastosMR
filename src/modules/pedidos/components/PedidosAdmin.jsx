import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RafikiActionMenu from "../../../shared/components/RafikiActionMenu";
import RafikiBadge from "../../../shared/components/RafikiBadge";
import { useAlertaRafiki } from "../../../shared/components/common";
import {
  calcularTotalItem,
  crearLinkWhatsApp,
  crearMensajePedidoListo,
  crearTextoItem,
  dinero,
  esProductoSinAcompanantes,
  textoParaLlevarItem,
  formatearFechaHora,
  limpiarTelefonoWhatsApp,
  obtenerCliente,
  obtenerCodigoPedido,
  obtenerEstadoPedido,
  obtenerItemsPedido,
  imprimirTicketPedido
} from "../../../shared/utils/pedidos";

function esItemCafeteria(item) {
  return item?.categoria === "cafeteria" || item?.area === "cafeteria";
}

function obtenerNombreItemCafeteria(item) {
  const tipo = item.tipo || "Producto cafetería";
  const producto = item.producto || item.nombre || item.plato || item.proteina || "";
  return producto ? `${tipo} — ${producto}` : tipo;
}

function obtenerPrecioUnitarioItem(item) {
  return Number(item.precioPlato || item.precioProteina || item.precio || 0);
}

function renderDetalleCafeteria(item) {
  const filas = [];

  if (item.base) filas.push(["Base", item.base]);
  if (item.tamano) filas.push(["Tamaño", item.tamano]);
  if (Array.isArray(item.frutas) && item.frutas.length > 0) filas.push(["Frutas", item.frutas.join(", ")]);
  if (Number(item.extraFrutas) > 0) filas.push(["Extra frutas", dinero(item.extraFrutas)]);
  if (item.acompanante) filas.push(["Acompañante", item.acompanante]);
  if (item.bebida) filas.push(["Bebida", item.bebida]);
  if (Array.isArray(item.adicionales) && item.adicionales.length > 0) {
    filas.push(["Adicionales", item.adicionales.map((x) => x.nombre || x).join(", ")]);
  }
  if (item.observacionesItem?.trim()) filas.push(["Obs.", item.observacionesItem.trim()]);

  return filas;
}

function PedidoCocinaBase({ pedido, onCambiarEstado, guardandoEstado = false, revisado = true, puedeEditarPedido = false, onEditarPedido, editandoPedido = false }) {
  const items = obtenerItemsPedido(pedido);
  const estadoNormalizado = obtenerEstadoPedido(pedido);
  const telefonoCliente = limpiarTelefonoWhatsApp(pedido.telefono);
  const mensajeCliente = crearMensajePedidoListo(pedido);
  const linkCliente = telefonoCliente ? crearLinkWhatsApp(telefonoCliente, mensajeCliente) : "#";

  return (
    <article className={`pedido-cocina ${estadoNormalizado === "Finalizado" ? "pedido-finalizado" : ""} ${!revisado ? "pedido-sin-revisar" : ""}`}>
      <div className={`pedido-header ${estadoNormalizado === "Finalizado" ? "pedido-header-finalizado" : "pedido-header-pending"}`}>
        <div className="pedido-header-title">
          Pedido #{obtenerCodigoPedido(pedido)}
        </div>
        <div className="pedido-header-right">
          <strong style={{ color: "white", fontSize: 20, fontFamily: "'Fraunces', serif" }}>{dinero(pedido.total)}</strong>
        </div>
      </div>

      <div className="pedido-body">
        <div className="pedido-top">
          <div>
            <p className="pedido-cliente-nombre">{obtenerCliente(pedido)}</p>
            <div className="pedido-meta">
              <span>🧾 Pedido N° {obtenerCodigoPedido(pedido)}</span>
              <span>🕒 {formatearFechaHora(pedido.created_at)}</span>
              {pedido.ubicacion ? <span>📍 {pedido.ubicacion}</span> : null}
              <span>📞 {pedido.telefono || "Sin teléfono"}</span>
              <span>💳 {pedido.tipo_pago || "Pago no especificado"}</span>
            </div>
          </div>
        </div>

      <div className="items-cocina">
        {items.length === 0 ? (
          <div className="pedido-text">{pedido.pedido_texto}</div>
        ) : (
          items.map((item, index) => {
            const itemEsCafeteria = esItemCafeteria(item);
            const nombre = itemEsCafeteria
              ? obtenerNombreItemCafeteria(item)
              : item.plato || item.proteina || "Plato";
            const precioUnitario = obtenerPrecioUnitarioItem(item);
            const totalItem = calcularTotalItem(item);
            const itemSinAcompanantes = esProductoSinAcompanantes(item);
            const detallesCafeteria = itemEsCafeteria ? renderDetalleCafeteria(item) : [];

            return (
              <div key={item.id || index} className={`item-cocina ${itemEsCafeteria ? "item-cafeteria-admin" : ""}`}>
                <div className="item-numero">#{index + 1}</div>

                <div className="item-detalle">
                  <h4>
                    {item.cantidad || 1} x {nombre}
                  </h4>

                  {item.categoria && (
                    <p>
                      <strong>Categoría:</strong> {item.categoria}
                    </p>
                  )}

                  <p>
                    <strong>Precio:</strong> {dinero(precioUnitario)}
                    {Number(item.cantidad || 1) > 1 ? ` · Total item: ${dinero(totalItem)}` : ""}
                  </p>

                  {itemEsCafeteria ? (
                    <>
                      {detallesCafeteria.length > 0 ? (
                        detallesCafeteria.map(([etiqueta, valor]) => (
                          <p key={etiqueta}>
                            <strong>{etiqueta}:</strong> {valor}
                          </p>
                        ))
                      ) : (
                        <p>
                          <strong>Detalle:</strong> {crearTextoItem(item)}
                        </p>
                      )}

                      <p>
                        <strong>Empaque:</strong> {textoParaLlevarItem(item)}
                      </p>
                    </>
                  ) : (
                    <>
                      {!itemSinAcompanantes && (
                        <p>
                          <strong>Acompañantes:</strong>{" "}
                          {Array.isArray(item.acompanantes) && item.acompanantes.length > 0
                            ? item.acompanantes.join(", ")
                            : "Sin acompañantes"}
                        </p>
                      )}

                      {!itemSinAcompanantes && item.observacionAcompanantes?.trim() && (
                        <p className="obs-acompanantes-admin">
                          <strong>Obs. acompañantes:</strong> {item.observacionAcompanantes.trim()}
                        </p>
                      )}

                      {itemSinAcompanantes && (
                        <p>
                          <strong>Acompañantes:</strong> No aplica
                        </p>
                      )}

                      {!itemSinAcompanantes && (
                        <p>
                          <strong>Incluye:</strong> Sopa + bebida
                        </p>
                      )}

                      <p>
                        <strong>Empaque:</strong> {textoParaLlevarItem(item)}
                      </p>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {pedido.observaciones && (
        <div className="nota-cocina">
          <strong>Observaciones:</strong> {pedido.observaciones}
        </div>
      )}

      <div className="pedido-actions">
        {puedeEditarPedido && (
          <button
            type="button"
            className="button light"
            onClick={() => onEditarPedido?.(pedido)}
            disabled={editandoPedido}
          >
            {editandoPedido ? "Editando..." : "Editar"}
          </button>
        )}

        {estadoNormalizado !== "Finalizado" ? (
          <button
            type="button"
            className="button green"
            onClick={() => onCambiarEstado?.(pedido.id, "Finalizado")}
            disabled={guardandoEstado}
          >
            {guardandoEstado ? "Guardando..." : "Entregado"}
          </button>
        ) : (
          <span className="mini-estado-finalizado">Entregado</span>
        )}

        {telefonoCliente ? (
          <a
            href={linkCliente}
            target="_blank"
            rel="noreferrer"
            className="button green link-button"
          >
            Avisar pedido listo
          </a>
        ) : (
          <button type="button" className="button light" disabled>
            Sin teléfono
          </button>
        )}
      </div>
      </div>
    </article>
  );
}



function resumirItemCafeteriaCompacto(item) {
  const cantidad = Number(item.cantidad) || 1;
  const nombre = item.detalle_impresion || item.producto || item.nombre || item.plato || item.proteina || "Producto cafetería";
  const precio = obtenerPrecioUnitarioItem(item);
  const precioTexto = precio > 0 ? ` (${dinero(precio)})` : "";

  return `${cantidad} ${nombre}${precioTexto}`;
}

export function resumirItemsPedidoCompacto(pedido) {
  const items = obtenerItemsPedido(pedido);

  if (items.length === 0) {
    return pedido.pedido_texto || "Sin detalle";
  }

  return items.map((item) => {
    if (esItemCafeteria(item)) {
      return resumirItemCafeteriaCompacto(item);
    }

    const nombre = item.plato || item.proteina || "Plato";
    const cantidad = item.cantidad || 1;
    const acomp = !esProductoSinAcompanantes(item) && Array.isArray(item.acompanantes) && item.acompanantes.length > 0
      ? ` · ${item.acompanantes.join(", ")}`
      : "";
    const adicionalesAlmuerzo = Array.isArray(item.adicionalesAlmuerzo) && item.adicionalesAlmuerzo.length > 0
      ? ` · Adicionales: ${item.adicionalesAlmuerzo.map((x) => `${x.nombre || x}${Number(x.precio || 0) ? ` ${dinero(x.precio)}` : ""}`).join(", ")}`
      : "";
    const obsAcomp = !esProductoSinAcompanantes(item) && item.observacionAcompanantes?.trim()
      ? ` · Obs: ${item.observacionAcompanantes.trim()}`
      : "";
    const empaque = textoParaLlevarItem(item) ? ` · ${textoParaLlevarItem(item)}` : "";
    return `${cantidad} x ${nombre}${acomp}${adicionalesAlmuerzo}${obsAcomp}${empaque}`;
  }).join(" + ");
}

function esPagoCreditoPedido(pedido) {
  const pago = String(pedido?.tipo_pago || "").trim().toLowerCase();
  return pago === "credito" || pago === "crédito";
}

function obtenerTipoBadgeEstadoPedido(estado) {
  const valor = String(estado || "").toLowerCase();
  if (valor === "finalizado") return "success";
  if (valor === "borrado" || valor === "anulado" || valor === "cancelado") return "danger";
  return "warning";
}

function obtenerTipoBadgePagoPedido(pedido) {
  const pago = String(pedido?.tipo_pago || "").trim().toLowerCase().replace("é", "e");
  if (!pago) return "neutral";
  if (pago === "credito" || pago === "pendiente") return "warning";
  if (["efectivo", "transferencia", "datafono", "nequi", "bancolombia"].includes(pago)) return "success";
  return "info";
}

function TablaPedidosCompactaBase({ pedidos, onCambiarEstado, guardandoEstadoPedidoId, onEliminarPedido, eliminandoPedidoId, onEditarPedido, editandoPedidoId, onCambiarFechaPedido, cambiandoFechaPedidoId, onCorregirClienteCredito, corrigiendoClientePedidoId, pedidosPorPagina = 15 }) {
  const [mostrarAlertaRafiki, modalAlertaRafiki] = useAlertaRafiki();
  const [paginaActual, setPaginaActual] = useState(1);
  const tablaRef = useRef(null);
  const totalPaginas = Math.max(1, Math.ceil((pedidos?.length || 0) / pedidosPorPagina));


  useEffect(() => {
    if (paginaActual > totalPaginas) {
      setPaginaActual(totalPaginas);
    }
  }, [paginaActual, totalPaginas]);

  const pedidosPagina = useMemo(() => {
    const inicio = (paginaActual - 1) * pedidosPorPagina;
    return pedidos.slice(inicio, inicio + pedidosPorPagina);
  }, [pedidos, paginaActual, pedidosPorPagina]);

  const inicioVisible = pedidos.length === 0 ? 0 : (paginaActual - 1) * pedidosPorPagina + 1;
  const finVisible = Math.min(paginaActual * pedidosPorPagina, pedidos.length);

  const cambiarPaginaSinScroll = useCallback((calcularPagina) => {
    const posicionActual = typeof window !== "undefined" ? window.scrollY : 0;
    setPaginaActual((pagina) => {
      const siguientePagina = typeof calcularPagina === "function" ? calcularPagina(pagina) : calcularPagina;
      return Math.min(totalPaginas, Math.max(1, siguientePagina));
    });
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => window.scrollTo({ top: posicionActual, behavior: "auto" }));
    }
  }, [totalPaginas]);

  const irPaginaAnterior = useCallback(() => {
    cambiarPaginaSinScroll((pagina) => pagina - 1);
  }, [cambiarPaginaSinScroll]);

  const irPaginaSiguiente = useCallback(() => {
    cambiarPaginaSinScroll((pagina) => pagina + 1);
  }, [cambiarPaginaSinScroll]);

  const irPaginaFinal = useCallback(() => {
    cambiarPaginaSinScroll(totalPaginas);
  }, [cambiarPaginaSinScroll, totalPaginas]);

  const imprimirPedido = useCallback((pedido) => {
    const ok = imprimirTicketPedido(pedido);
    if (!ok) {
      mostrarAlertaRafiki({
        tipo: "error",
        titulo: "Impresión bloqueada",
        mensaje: "No se pudo abrir la ventana de impresión. Permite las ventanas emergentes para Rafiki Pedidos e inténtalo nuevamente."
      });
    }
  }, [mostrarAlertaRafiki]);

  return (
    <>
    {modalAlertaRafiki}
    <div className="pedidos-tabla-wrap" ref={tablaRef}>
      <table className="pedidos-tabla-compacta">
        <thead>
          <tr>
            <th>N°</th>
            <th>Hora</th>
            <th>Cliente</th>
            <th>Pedido</th>
            <th>Obs.</th>
            <th>Pago</th>
            <th>Total</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {pedidosPagina.map((pedido) => {
            const estadoNormalizado = obtenerEstadoPedido(pedido);
            const telefonoCliente = limpiarTelefonoWhatsApp(pedido.telefono);
            const linkCliente = telefonoCliente
              ? crearLinkWhatsApp(telefonoCliente, crearMensajePedidoListo(pedido))
              : "#";

            return (
              <tr key={pedido.id} className={estadoNormalizado === "Finalizado" ? "fila-finalizada" : estadoNormalizado === "Borrado" ? "fila-borrada" : ""}>
                <td className="td-codigo">
                  <strong>#{obtenerCodigoPedido(pedido)}</strong>
                  <RafikiBadge estado={estadoNormalizado} tipo={obtenerTipoBadgeEstadoPedido(estadoNormalizado)} />
                </td>
                <td>{formatearFechaHora(pedido.created_at)}</td>
                <td>
                  <strong>{obtenerCliente(pedido)}</strong>
                  <small>{pedido.telefono || "Sin teléfono"}</small>
                  {pedido.ubicacion ? <small>{pedido.ubicacion}</small> : null}
                </td>
                <td className="td-pedido">{resumirItemsPedidoCompacto(pedido)}</td>
                <td className="td-obs">{pedido.observaciones || "—"}</td>
                <td>
                  <RafikiBadge estado={pedido.tipo_pago || "Sin pago"} tipo={obtenerTipoBadgePagoPedido(pedido)} />
                </td>
                <td className="td-total">{dinero(pedido.total)}</td>
                <td className="td-acciones td-acciones-compactas">
                  {estadoNormalizado === "Borrado" ? (
                    <span className="mini-estado-borrado">Borrado</span>
                  ) : estadoNormalizado !== "Finalizado" ? (
                    <button
                      type="button"
                      className="mini-btn green accion-principal-pedido"
                      onClick={() => onCambiarEstado?.(pedido.id, "Finalizado")}
                      disabled={guardandoEstadoPedidoId === pedido.id}
                    >
                      {guardandoEstadoPedidoId === pedido.id ? "Guardando..." : "Entregado"}
                    </button>
                  ) : (
                    <span className="mini-estado-finalizado">Entregado</span>
                  )}
                  <RafikiActionMenu
                    label="Opciones"
                    items={[
                      onEditarPedido && estadoNormalizado !== "Borrado"
                        ? {
                            id: "editar",
                            label: editandoPedidoId === pedido.id ? "Editando..." : "Editar pedido",
                            icon: "✏️",
                            disabled: editandoPedidoId === pedido.id,
                            onClick: () => onEditarPedido?.(pedido),
                          }
                        : null,
                      {
                        id: "imprimir",
                        label: "Imprimir ticket",
                        icon: "🖨️",
                        onClick: () => imprimirPedido(pedido),
                      },
                      onCambiarFechaPedido && estadoNormalizado !== "Borrado"
                        ? {
                            id: "cambiar-fecha",
                            label: cambiandoFechaPedidoId === pedido.id ? "Cambiando fecha..." : "Cambiar fecha",
                            icon: "📅",
                            variant: "info",
                            disabled: cambiandoFechaPedidoId === pedido.id,
                            onClick: () => onCambiarFechaPedido?.(pedido),
                          }
                        : null,

                      onCorregirClienteCredito && estadoNormalizado !== "Borrado"
                        ? {
                            id: "credito",
                            label: corrigiendoClientePedidoId === pedido.id
                              ? "Guardando crédito..."
                              : esPagoCreditoPedido(pedido)
                                ? "Gestionar crédito"
                                : "Pasar a crédito",
                            icon: "💳",
                            variant: esPagoCreditoPedido(pedido) ? "info" : "success",
                            disabled: corrigiendoClientePedidoId === pedido.id,
                            onClick: () => onCorregirClienteCredito?.(pedido),
                          }
                        : null,
                      telefonoCliente
                        ? {
                            id: "whatsapp",
                            label: "Avisar por WhatsApp",
                            icon: "📲",
                            variant: "success",
                            onClick: () => window.open(linkCliente, "_blank", "noopener,noreferrer"),
                          }
                        : null,
                      estadoNormalizado !== "Borrado" && onEliminarPedido
                        ? {
                            id: "borrar",
                            label: eliminandoPedidoId === pedido.id ? "Borrando..." : "Borrar pedido",
                            icon: "🗑️",
                            variant: "danger",
                            disabled: eliminandoPedidoId === pedido.id,
                            onClick: () => onEliminarPedido?.(pedido.id),
                          }
                        : null,
                    ]}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {pedidos.length > pedidosPorPagina && (
      <div className="paginacion-pedidos">
        <span>
          Mostrando {inicioVisible}-{finVisible} de {pedidos.length}
        </span>
        <div className="paginacion-botones">
          <button
            type="button"
            className="mini-btn"
            onClick={irPaginaAnterior}
            disabled={paginaActual === 1}
          >
            ← Anterior
          </button>
          <strong>Página {paginaActual} de {totalPaginas}</strong>
          <button
            type="button"
            className="mini-btn"
            onClick={irPaginaSiguiente}
            disabled={paginaActual === totalPaginas}
          >
            Siguiente →
          </button>
          <button
            type="button"
            className="mini-btn"
            onClick={irPaginaFinal}
            disabled={paginaActual === totalPaginas}
            title="Ir a la última página"
          >
            Fin
          </button>
        </div>
      </div>
    )}
    </>
  );
}

export const PedidoCocina = React.memo(PedidoCocinaBase);
export const TablaPedidosCompacta = React.memo(TablaPedidosCompactaBase);
