import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseConfigOk } from "../../supabaseClient";
import { crearCanalPedidosRealtime, removerCanalSupabase } from "../../services/pedidosService";
import { fechaISOColombia, pedidoEsDeHoy } from "../utils/pedidos";

const ESTADO_REALTIME_INACTIVO = {
  estado: "inactivo",
  texto: "Realtime inactivo",
  detalle: "Puedes activarlo desde el botón Realtime ON/OFF en Pedidos de hoy."
};

const RECARGA_MINIMA_MS = 3500;

export function useRealtimePedidos({
  activo,
  filtroPedidos,
  fechaSeleccionada,
  fechaInicioRangoPedidos,
  fechaFinRangoPedidos,
  setPedidos,
  setRecargaPedidos,
  mostrarAlertaPedidoNuevo,
  puedeActualizarAutomatico = true,
  onCambiosPendientes,
  pollingMs = 45000
}) {
  const [estadoRealtimePedidos, setEstadoRealtimePedidos] = useState(ESTADO_REALTIME_INACTIVO);

  const filtroPedidosRef = useRef(filtroPedidos);
  const fechaSeleccionadaRef = useRef(fechaSeleccionada);
  const fechaInicioRangoPedidosRef = useRef(fechaInicioRangoPedidos);
  const fechaFinRangoPedidosRef = useRef(fechaFinRangoPedidos);
  const activoRef = useRef(activo);
  const puedeActualizarAutomaticoRef = useRef(puedeActualizarAutomatico);
  const onCambiosPendientesRef = useRef(onCambiosPendientes);
  const ultimaRecargaRef = useRef(0);
  const recargaPendienteRef = useRef(null);
  const instanciaRealtimeRef = useRef(
    `rafiki-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );

  useEffect(() => {
    filtroPedidosRef.current = filtroPedidos;
  }, [filtroPedidos]);

  useEffect(() => {
    fechaSeleccionadaRef.current = fechaSeleccionada;
  }, [fechaSeleccionada]);

  useEffect(() => {
    fechaInicioRangoPedidosRef.current = fechaInicioRangoPedidos;
  }, [fechaInicioRangoPedidos]);

  useEffect(() => {
    fechaFinRangoPedidosRef.current = fechaFinRangoPedidos;
  }, [fechaFinRangoPedidos]);

  useEffect(() => {
    activoRef.current = activo;
  }, [activo]);

  useEffect(() => {
    puedeActualizarAutomaticoRef.current = puedeActualizarAutomatico;
  }, [puedeActualizarAutomatico]);

  useEffect(() => {
    onCambiosPendientesRef.current = onCambiosPendientes;
  }, [onCambiosPendientes]);

  const marcarCambioPendiente = useCallback((detalle = "Hay cambios pendientes en pedidos.") => {
    onCambiosPendientesRef.current?.(detalle);
  }, []);

  const recargarPedidosConControl = useCallback(() => {
    if (!activoRef.current) return;

    if (!puedeActualizarAutomaticoRef.current) {
      marcarCambioPendiente("Hay nuevos cambios en pedidos. Puedes revisarlos cuando vuelvas a Pedidos de hoy.");
      return;
    }

    const ahora = Date.now();
    const tiempoDesdeUltima = ahora - ultimaRecargaRef.current;

    if (tiempoDesdeUltima >= RECARGA_MINIMA_MS) {
      ultimaRecargaRef.current = ahora;
      setRecargaPedidos((actual) => actual + 1);
      return;
    }

    if (recargaPendienteRef.current) return;

    recargaPendienteRef.current = window.setTimeout(() => {
      recargaPendienteRef.current = null;
      if (!activoRef.current) return;
      ultimaRecargaRef.current = Date.now();
      setRecargaPedidos((actual) => actual + 1);
    }, RECARGA_MINIMA_MS - tiempoDesdeUltima);
  }, [marcarCambioPendiente, setRecargaPedidos]);

  function pedidoCoincideConFiltroActual(pedido) {
    const filtroActual = filtroPedidosRef.current;
    const fechaActual = fechaSeleccionadaRef.current;

    if (filtroActual === "hoy") return pedidoEsDeHoy(pedido);
    if (filtroActual === "dia") {
      return fechaISOColombia(new Date(pedido?.created_at || Date.now())) === fechaActual;
    }

    if (filtroActual === "rango") {
      const fechaPedido = fechaISOColombia(new Date(pedido?.created_at || Date.now()));
      const inicio = fechaInicioRangoPedidosRef.current || fechaActual || fechaISOColombia();
      const fin = fechaFinRangoPedidosRef.current || inicio;
      const inicioOrdenado = inicio <= fin ? inicio : fin;
      const finOrdenado = inicio <= fin ? fin : inicio;
      return fechaPedido >= inicioOrdenado && fechaPedido <= finOrdenado;
    }

    return true;
  }

  useEffect(() => {
    if (!supabaseConfigOk || !activo) {
      setEstadoRealtimePedidos(ESTADO_REALTIME_INACTIVO);
      return undefined;
    }

    let canalActivo = true;
    const nombreCanal = `${instanciaRealtimeRef.current}-pedidos`;

    setEstadoRealtimePedidos({
      estado: "conectando",
      texto: "Conectando Realtime...",
      detalle: "Preparando actualización automática de pedidos."
    });

    const canal = crearCanalPedidosRealtime(
      nombreCanal,
      (payload) => {
          if (!canalActivo || !activoRef.current) return;

          const tipoEvento = payload.eventType;
          const pedidoNuevo = payload.new;
          const pedidoAnterior = payload.old;
          const pedidoId = pedidoNuevo?.id || pedidoAnterior?.id;

          if (!pedidoId) return;

          if (!puedeActualizarAutomaticoRef.current) {
            setEstadoRealtimePedidos((actual) => ({
              ...actual,
              estado: "conectado",
              texto: "Realtime conectado",
              detalle: "Cambios detectados sin interrumpir tu pestaña actual."
            }));
            marcarCambioPendiente(
              tipoEvento === "INSERT"
                ? "Entró un pedido nuevo. Vuelve a Pedidos de hoy para actualizarlo."
                : "Hay cambios en pedidos. Vuelve a Pedidos de hoy para actualizarlos."
            );
            return;
          }

          if (tipoEvento === "DELETE") {
            setPedidos((actual) => actual.filter((pedido) => pedido.id !== pedidoId));
            setEstadoRealtimePedidos((actual) => ({
              ...actual,
              estado: "conectado",
              texto: "Realtime conectado",
              detalle: "Pedido eliminado recibido en vivo."
            }));
            return;
          }

          if (!pedidoNuevo?.id) return;

          const coincideConFiltro = pedidoCoincideConFiltroActual(pedidoNuevo);

          setPedidos((actual) => {
            const existe = actual.some((pedido) => pedido.id === pedidoNuevo.id);

            if (!coincideConFiltro) {
              return existe ? actual.filter((pedido) => pedido.id !== pedidoNuevo.id) : actual;
            }

            if (existe) {
              return actual.map((pedido) => (pedido.id === pedidoNuevo.id ? pedidoNuevo : pedido));
            }

            return [...actual, pedidoNuevo];
          });

          setEstadoRealtimePedidos((actual) => ({
            ...actual,
            estado: "conectado",
            texto: "Realtime conectado",
            detalle: tipoEvento === "INSERT" ? "Pedido nuevo recibido en vivo." : "Pedido actualizado en vivo."
          }));

          if (tipoEvento === "INSERT" && pedidoEsDeHoy(pedidoNuevo)) {
            mostrarAlertaPedidoNuevo(pedidoNuevo);
          }
      },
      (estado) => {
        if (!canalActivo || !activoRef.current) return;

        if (estado === "SUBSCRIBED") {
          setEstadoRealtimePedidos({
            estado: "conectado",
            texto: "Realtime conectado",
            detalle: "Los pedidos deberían aparecer automáticamente."
          });
          recargarPedidosConControl("subscribed");
          return;
        }

        if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT" || estado === "CLOSED") {
          setEstadoRealtimePedidos({
            estado: "reconectando",
            texto: "Realtime reconectando",
            detalle: "Si entra un pedido durante la reconexión, el sistema hará una recarga automática."
          });
          recargarPedidosConControl("realtime-error");
          return;
        }

        setEstadoRealtimePedidos({
          estado: "conectando",
          texto: "Conectando Realtime...",
          detalle: `Estado técnico: ${estado}`
        });
      });

    const recargaAlVolver = () => {
      if (document.visibilityState === "visible" && activoRef.current) {
        recargarPedidosConControl("visibility");
      }
    };

    const recargaAlRecuperarInternet = () => {
      if (!activoRef.current) return;
      setEstadoRealtimePedidos({
        estado: "reconectando",
        texto: "Internet recuperado",
        detalle: "Recargando pedidos y revalidando conexión en vivo."
      });
      recargarPedidosConControl("online");
    };

    const respaldoAutomatico = window.setInterval(() => {
      if (activoRef.current && document.visibilityState === "visible") {
        recargarPedidosConControl("polling");
      }
    }, pollingMs);

    window.addEventListener("online", recargaAlRecuperarInternet);
    document.addEventListener("visibilitychange", recargaAlVolver);

    return () => {
      canalActivo = false;
      window.clearInterval(respaldoAutomatico);
      if (recargaPendienteRef.current) {
        window.clearTimeout(recargaPendienteRef.current);
        recargaPendienteRef.current = null;
      }
      window.removeEventListener("online", recargaAlRecuperarInternet);
      document.removeEventListener("visibilitychange", recargaAlVolver);
      removerCanalSupabase(canal);
    };
  }, [activo, mostrarAlertaPedidoNuevo, pollingMs, recargarPedidosConControl, setPedidos]);

  return {
    estadoRealtimePedidos,
    pedidoCoincideConFiltroActual,
    instanciaRealtimeRef
  };
}
