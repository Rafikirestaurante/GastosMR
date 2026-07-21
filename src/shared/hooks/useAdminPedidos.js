import { useMemo } from "react";
import {
  consolidarPedidos,
  obtenerCliente,
  obtenerCodigoPedido,
  obtenerEstadoPedido,
  obtenerItemsPedido,
} from "../utils/pedidos";
import {
  coincideBusquedaAvanzada,
  crearContenidoBusquedaAvanzada,
} from "../utils/busquedaAvanzada";

export function useAdminPedidos({
  pedidos,
  busquedaDebounced,
  filtroPedidos,
  fechaSeleccionada,
  fechaInicioRangoPedidos,
  fechaFinRangoPedidos,
}) {
  const pedidosOrdenados = useMemo(() => {
    return [...pedidos].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  }, [pedidos]);

  const pedidosFiltrados = useMemo(() => {
    const q = String(busquedaDebounced || "").trim();

    if (!q) return pedidosOrdenados;

    return pedidosOrdenados.filter((pedido) => {
      const codigo = String(obtenerCodigoPedido(pedido) || "");
      const id = String(pedido?.id || "");
      const items = obtenerItemsPedido(pedido);
      const textoItems = items
        .map((item) => [
          item?.nombre,
          item?.plato,
          item?.proteina,
          item?.categoria,
          item?.termino,
          item?.acompanantes,
          item?.bebida,
          item?.sopa,
          item?.observacionesItem,
          item?.observacionAcompanantes,
          item?.empaque,
        ].filter(Boolean).join(" "))
        .join(" ");

      const contenido = crearContenidoBusquedaAvanzada([
        codigo,
        id,
        `#${codigo}`,
        obtenerCliente(pedido),
        pedido?.cliente,
        pedido?.nombre_cliente,
        pedido?.nombre,
        pedido?.telefono,
        pedido?.ubicacion,
        pedido?.mesa,
        pedido?.numero_mesa,
        pedido?.mesero,
        pedido?.nombre_mesero,
        pedido?.atendido_por,
        pedido?.tipo_pago,
        pedido?.forma_pago,
        pedido?.metodo_pago,
        pedido?.pedido_texto,
        pedido?.observaciones,
        pedido?.nota,
        pedido?.notas,
        pedido?.estado,
        obtenerEstadoPedido(pedido),
        textoItems,
      ]);

      return coincideBusquedaAvanzada(contenido, q);
    });
  }, [pedidosOrdenados, busquedaDebounced]);

  const pedidosPendientes = useMemo(() => {
    return pedidosFiltrados.filter((pedido) => obtenerEstadoPedido(pedido) === "Pendiente");
  }, [pedidosFiltrados]);

  const pedidosFinalizados = useMemo(() => {
    return pedidosFiltrados.filter((pedido) => obtenerEstadoPedido(pedido) === "Finalizado");
  }, [pedidosFiltrados]);

  const pedidosBorrados = useMemo(() => {
    return pedidosFiltrados.filter((pedido) => obtenerEstadoPedido(pedido) === "Borrado");
  }, [pedidosFiltrados]);

  const pedidosActivos = useMemo(() => {
    return pedidosFiltrados.filter((pedido) => obtenerEstadoPedido(pedido) !== "Borrado");
  }, [pedidosFiltrados]);

  const consolidado = useMemo(() => consolidarPedidos(pedidosActivos), [pedidosActivos]);

  const tituloPedidos = useMemo(() => {
    if (filtroPedidos === "rango") {
      const inicio = fechaInicioRangoPedidos || fechaSeleccionada;
      const fin = fechaFinRangoPedidos || inicio;
      const inicioOrdenado = inicio <= fin ? inicio : fin;
      const finOrdenado = inicio <= fin ? fin : inicio;
      return inicioOrdenado === finOrdenado
        ? `Pedidos del ${inicioOrdenado}`
        : `Pedidos del ${inicioOrdenado} al ${finOrdenado}`;
    }
    if (filtroPedidos === "dia") return `Pedidos del ${fechaSeleccionada}`;
    return "Pedidos de hoy";
  }, [filtroPedidos, fechaSeleccionada, fechaInicioRangoPedidos, fechaFinRangoPedidos]);

  return {
    pedidosFiltrados,
    pedidosPendientes,
    pedidosFinalizados,
    pedidosBorrados,
    pedidosActivos,
    consolidado,
    tituloPedidos,
  };
}
