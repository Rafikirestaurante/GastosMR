import { useCallback, useState } from "react";
import { conTiempoMaximo } from "../utils/async";
import { CONFIRMACIONES_PEDIDOS, MENSAJES_PEDIDOS } from "../constants/textos";
import { METODOS_PAGO, esMetodoPagoCredito, normalizarMetodoPago } from "../constants/paymentMethods";
import {
  calcularTotalItems,
  crearTextoPedido,
  limpiarAcompanantesCliente,
  limpiarAcompanantesMenu,
  limpiarTelefono,
  limpiarTexto,
  obtenerCodigoPedido,
  obtenerEstadoPedido,
  esItemCafeteria,
  esProductoSinAcompanantes,
  normalizarClienteEspecialParaPedido,
  normalizarItemsParaDestinoCliente,
} from "../utils/pedidos";
import {
  esErrorDeConexion,
  guardarPedidoPendienteOffline,
} from "../utils/offlinePedidos";
import { registrarDescuentoInventarioPedido } from "../../services/inventarioService";
import { describirErrorSupabase, registrarErrorSupabase } from "../utils/supabaseErrors";
import { anularCarteraPedidoCredito, registrarCarteraPedidoCredito, sincronizarCarteraPedido } from "../../services/carteraService";
import {
  actualizarEstadoPedido,
  actualizarFechaPedido,
  actualizarPedido,
  crearPedido,
  finalizarPedidosPorIds,
  marcarPedidoBorrado,
  registrarAuditoriaPedido,
} from "../../services/pedidosService";

export function usePedidos({
  itemsPedido,
  cliente,
  telefono,
  ubicacion,
  comerRestauranteCliente = false,
  clienteEspecialAplicado = null,
  tipoPago,
  observaciones,
  pedidos,
  pedidosPendientes,
  adminUsuario,
  adminRol,
  adminActor,
  puedeCambiarEstado,
  puedeEliminarPedido,
  puedeEditarPedido,
  puedeFinalizarPendientes,
  confirmarRafiki,
  mostrarMensaje,
  setErrorDatosPedido,
  setMensaje,
  setVista,
  setPedidoFinalizado,
  setPedidos,
  pedidoCoincideConFiltroActual,
}) {
  const [guardandoPedido, setGuardandoPedido] = useState(false);
  const [guardandoEstadoPedidoId, setGuardandoEstadoPedidoId] = useState(null);
  const [eliminandoPedidoId, setEliminandoPedidoId] = useState(null);
  const [editandoPedidoId, setEditandoPedidoId] = useState(null);
  const [finalizandoPendientes, setFinalizandoPendientes] = useState(false);

  const agregarPedidoAlListadoSiAplica = useCallback((pedido) => {
    if (!pedido || !pedidoCoincideConFiltroActual(pedido)) return;

    setPedidos((actual) => {
      if (actual.some((item) => item.id === pedido.id)) return actual;
      return [...actual, pedido];
    });
  }, [pedidoCoincideConFiltroActual, setPedidos]);

  const registrarAuditoria = useCallback(async ({ accion, pedido, detalle = {} }) => {
    try {
      const { error } = await registrarAuditoriaPedido({
        pedido_id: pedido?.id ? String(pedido.id) : null,
        codigo_pedido: pedido ? obtenerCodigoPedido(pedido) : null,
        accion,
        detalle,
        usuario_email: adminUsuario?.email || null,
        usuario_rol: adminRol,
        actor: adminActor,
        created_at: new Date().toISOString(),
      });

      if (error) {
        registrarErrorSupabase("registrar auditoría de pedido", error);
      }
    } catch (error) {
      registrarErrorSupabase("registrar auditoría de pedido", error);
    }
  }, [adminActor, adminRol, adminUsuario]);

  const registrarPedido = useCallback(async () => {
    if (guardandoPedido) return;

    const clienteEspecialPedido = normalizarClienteEspecialParaPedido(clienteEspecialAplicado);

    const itemsClienteNormalizados = normalizarItemsParaDestinoCliente(itemsPedido, { comerRestauranteCliente });

    const itemsValidos = itemsClienteNormalizados
      .filter((item) => item.plato || item.proteina || item.producto)
      .map((item) => {
        const sinAcompanantes = esItemCafeteria(item) || esProductoSinAcompanantes(item);

        return {
          ...item,
          cliente_especial: clienteEspecialPedido || undefined,
          acompanantes: sinAcompanantes ? [] : limpiarAcompanantesCliente(item.acompanantes || []),
          observacionAcompanantes: sinAcompanantes ? "" : (item.observacionAcompanantes || "").trim(),
          paraLlevar: !comerRestauranteCliente
        };
      });

    if (itemsValidos.length === 0) {
      mostrarMensaje("Debes escoger al menos un producto.", "warning");
      return;
    }

    const camposFaltantes = [];

    if (!cliente.trim()) camposFaltantes.push("nombre");
    if (!telefono.trim()) camposFaltantes.push("teléfono");
    if (!comerRestauranteCliente && !ubicacion.trim()) camposFaltantes.push("ubicación");
    if (!tipoPago) camposFaltantes.push("forma de pago");

    if (camposFaltantes.length > 0) {
      const textoError = `Falta ingresar: ${camposFaltantes.join(", ")}.`;
      const posicionActual = window.scrollY;

      setErrorDatosPedido(textoError);

      requestAnimationFrame(() => {
        window.scrollTo({ top: posicionActual, behavior: "auto" });
      });

      return;
    }

    setErrorDatosPedido("");

    const clienteNombre = limpiarTexto(cliente, 120);
    const telefonoLimpio = limpiarTelefono(telefono);
    const ubicacionLimpia = comerRestauranteCliente ? "Comer en restaurante" : limpiarTexto(ubicacion, 200);
    const observacionesLimpias = limpiarTexto(observaciones, 500);

    if (!clienteNombre || !telefonoLimpio || !ubicacionLimpia) {
      setErrorDatosPedido("Revisa nombre, teléfono y ubicación. Hay datos inválidos o incompletos.");
      return;
    }

    const pedidoTexto = crearTextoPedido(itemsValidos, observacionesLimpias);
    const total = calcularTotalItems(itemsValidos);

    const nuevoPedido = {
      cliente: clienteNombre,
      cliente_nombre: clienteNombre,
      telefono: telefonoLimpio,
      ubicacion: ubicacionLimpia,
      tipo_pago: tipoPago,
      tipo_pedido: comerRestauranteCliente ? "mesa" : "llevar",
      mesa: comerRestauranteCliente ? "5A" : null,
      mesero: "Aplicacion",
      observaciones: observacionesLimpias,
      items: itemsValidos,
      pedido_texto: pedidoTexto,
      total,
      estado: "Pendiente",
      enviado_whatsapp: false
    };

    const guardarOfflineCliente = (mensajeOffline) => {
      const pendiente = guardarPedidoPendienteOffline(nuevoPedido, { origen: "cliente" });
      const pedidoOffline = {
        ...nuevoPedido,
        id_temporal: pendiente.id_temporal,
        pendiente_offline: true
      };

      setPedidoFinalizado(pedidoOffline);
      setMensaje({ texto: "", tipo: "info" });
      setVista("confirmacion");
      mostrarMensaje(mensajeOffline, "warning");
    };

    setGuardandoPedido(true);

    try {
      if (!window.navigator.onLine) {
        guardarOfflineCliente("Sin internet: tu pedido quedó guardado en este celular y se enviará automáticamente cuando vuelva la conexión.");
        return;
      }

      const { data, error } = await conTiempoMaximo(
        crearPedido(nuevoPedido),
        9000,
        "El guardado del pedido"
      );

      if (error) {
        if (esErrorDeConexion(error)) {
          guardarOfflineCliente("Problema de conexión: tu pedido quedó guardado en este celular y se enviará automáticamente cuando vuelva el internet.");
          return;
        }

        registrarErrorSupabase("guardar pedido cliente", error);
        mostrarMensaje(describirErrorSupabase(error, "guardar el pedido"), "error");
        return;
      }

      agregarPedidoAlListadoSiAplica(data);
      setPedidoFinalizado(data);
      setMensaje({ texto: "", tipo: "info" });
      setVista("confirmacion");
    } catch (error) {
      if (esErrorDeConexion(error)) {
        guardarOfflineCliente("Problema de conexión: tu pedido quedó guardado en este celular y se enviará automáticamente cuando vuelva el internet.");
        return;
      }

      registrarErrorSupabase("guardar pedido cliente", error);
      mostrarMensaje(describirErrorSupabase(error, "guardar el pedido"), "error");
    } finally {
      setGuardandoPedido(false);
    }
  }, [
    agregarPedidoAlListadoSiAplica,
    cliente,
    guardandoPedido,
    itemsPedido,
    observaciones,
    mostrarMensaje,
    setErrorDatosPedido,
    setMensaje,
    setPedidoFinalizado,
    setVista,
    telefono,
    tipoPago,
    ubicacion,
    comerRestauranteCliente,
    clienteEspecialAplicado,
  ]);

  const registrarPedidoMesa = useCallback(async ({ items, acompanantes, modoLlevar = false, mesa, cliente, telefono, ubicacion, mesero, tipoPago, observaciones: obsMesa }) => {
    if (guardandoPedido) return false;

    const itemsValidos = (Array.isArray(items) ? items : [])
      .filter((item) => item.plato || item.proteina || item.producto)
      .map((item) => {
        if (item.categoria === "cafeteria") {
          return {
            ...item,
            paraLlevar: Boolean(modoLlevar)
          };
        }

        const sinAcompanantes = esProductoSinAcompanantes(item);

        return {
          ...item,
          acompanantes: sinAcompanantes ? [] : limpiarAcompanantesMenu(
            Array.isArray(item.acompanantes) && item.acompanantes.length > 0
              ? item.acompanantes
              : acompanantes || []
          ),
          observacionAcompanantes: sinAcompanantes ? "" : item.observacionAcompanantes || "",
          paraLlevar: Boolean(modoLlevar)
        };
      });

    if (itemsValidos.length === 0) {
      mostrarMensaje("Agrega al menos un producto al pedido de mesa.", "warning");
      return false;
    }

    const esLlevar = Boolean(modoLlevar);
    const mesaLimpia = esLlevar ? "Llevar" : (limpiarTexto(mesa, 40) || "Mesa 1");
    const clienteMesaOpcional = limpiarTexto(cliente, 120);
    const clienteLimpio = clienteMesaOpcional || (esLlevar ? "Cliente" : mesaLimpia);
    const telefonoLimpio = esLlevar ? limpiarTelefono(telefono) : "";
    const ubicacionLimpia = esLlevar ? limpiarTexto(ubicacion, 200) : mesaLimpia;
    const meseroLimpio = limpiarTexto(mesero, 80) || "Mesero";
    const tipoPagoLimpio = normalizarMetodoPago(limpiarTexto(tipoPago, 80), { permitirCredito: true, fallback: METODOS_PAGO.EFECTIVO });
    const observacionesLimpias = limpiarTexto(obsMesa, 500);
    const pedidoTexto = crearTextoPedido(itemsValidos, observacionesLimpias);
    const total = calcularTotalItems(itemsValidos);

    const nuevoPedido = {
      cliente: clienteLimpio,
      cliente_nombre: clienteLimpio,
      telefono: telefonoLimpio,
      ubicacion: ubicacionLimpia,
      tipo_pago: tipoPagoLimpio,
      tipo_pedido: esLlevar ? "llevar" : "mesa",
      mesa: mesaLimpia,
      mesero: meseroLimpio,
      observaciones: observacionesLimpias,
      items: itemsValidos,
      pedido_texto: pedidoTexto,
      total,
      estado: "Pendiente",
      enviado_whatsapp: false
    };

    const guardarOfflineMesa = (mensajeOffline) => {
      const pendiente = guardarPedidoPendienteOffline(nuevoPedido, { origen: "mesas" });
      mostrarMensaje(mensajeOffline, "warning");
      return { ...nuevoPedido, id_temporal: pendiente.id_temporal, pendiente_offline: true };
    };

    setGuardandoPedido(true);

    try {
      if (!window.navigator.onLine) {
        return guardarOfflineMesa(`Sin internet: el pedido de ${mesaLimpia} quedó guardado pendiente por enviar. Se reenviará cuando vuelva la conexión.`);
      }

      const { data, error } = await conTiempoMaximo(
        crearPedido(nuevoPedido),
        9000,
        "El guardado del pedido de mesa"
      );

      if (error) {
        if (esErrorDeConexion(error)) {
          return guardarOfflineMesa(`Problema de conexión: el pedido de ${mesaLimpia} quedó guardado pendiente por enviar.`);
        }

        registrarErrorSupabase("guardar pedido de mesa", error);
        mostrarMensaje(describirErrorSupabase(error, "guardar el pedido de mesa"), "error");
        return false;
      }

      if (esMetodoPagoCredito(tipoPagoLimpio)) {
        try {
          await registrarCarteraPedidoCredito(data);
        } catch (errorCartera) {
          console.warn("Pedido guardado, pero la cartera automática no se registró:", errorCartera?.message || errorCartera);
          mostrarMensaje(`Pedido #${obtenerCodigoPedido(data)} guardado, pero revisa cartera: no se pudo registrar la cuenta por cobrar.`, "warning");
          agregarPedidoAlListadoSiAplica(data);
          return data;
        }
      }

      agregarPedidoAlListadoSiAplica(data);
      mostrarMensaje(`Pedido #${obtenerCodigoPedido(data)} enviado a cocina para ${mesaLimpia}.`, "success");
      return data;
    } catch (error) {
      if (esErrorDeConexion(error)) {
        return guardarOfflineMesa(`Problema de conexión: el pedido de ${mesaLimpia} quedó guardado pendiente por enviar.`);
      }

      registrarErrorSupabase("guardar pedido de mesa", error);
      mostrarMensaje(describirErrorSupabase(error, "guardar el pedido de mesa"), "error");
      return false;
    } finally {
      setGuardandoPedido(false);
    }
  }, [agregarPedidoAlListadoSiAplica, guardandoPedido, mostrarMensaje]);

  const cambiarEstadoPedido = useCallback(async (id, estado) => {
    if (guardandoEstadoPedidoId) return;

    if (!puedeCambiarEstado) {
      mostrarMensaje("Tu rol no tiene permiso para cambiar el estado de pedidos.", "error");
      return;
    }

    const estadoNuevo = estado === "Finalizado" ? "Finalizado" : "Pendiente";
    const pedidoActual = pedidos.find((pedido) => pedido.id === id);
    const estadoActual = obtenerEstadoPedido(pedidoActual || {});

    if (estadoNuevo === estadoActual) return;

    if (estadoNuevo === "Finalizado") {
      const codigoPedido = pedidoActual ? obtenerCodigoPedido(pedidoActual) : "";
      const confirmar = await confirmarRafiki({
        tipo: "confirmar",
        titulo: `Marcar pedido #${codigoPedido} como entregado`,
        mensaje: CONFIRMACIONES_PEDIDOS.pedidoEntregado(codigoPedido),
        textoConfirmar: "Sí, entregar",
      });

      if (!confirmar) return;
    }

    setGuardandoEstadoPedidoId(id);

    try {
      const { data, error } = await actualizarEstadoPedido(id, estadoNuevo);

      if (error) {
        registrarErrorSupabase("cambiar estado de pedido", error);
        mostrarMensaje(describirErrorSupabase(error, "cambiar el estado del pedido"), "error");
        return;
      }

      setPedidos((actual) => actual.map((pedido) => (pedido.id === id ? data : pedido)));
      registrarAuditoria({
        accion: estadoNuevo === "Finalizado" ? "pedido_entregado" : "pedido_pendiente",
        pedido: data,
        detalle: { estadoAnterior: estadoActual, estadoNuevo },
      });

      if (estadoNuevo === "Finalizado") {
        try {
          const resultadoInventario = await registrarDescuentoInventarioPedido(data, { usuario: adminActor || adminUsuario?.email || "Admin Rafiki" });
          const omitidas = resultadoInventario.omitidas?.length || 0;
          const mensajeInventario = resultadoInventario.total
            ? ` Inventario actualizado (${resultadoInventario.total} movimientos${omitidas ? `, ${omitidas} omitidos` : ""}).`
            : " Sin recetas de inventario para descontar.";
          mostrarMensaje(`Pedido #${obtenerCodigoPedido(data)} marcado como Entregado.${mensajeInventario}`, "success");
        } catch (errorInventario) {
          console.warn("Inventario no actualizado:", errorInventario?.message || errorInventario);
          mostrarMensaje(`Pedido #${obtenerCodigoPedido(data)} marcado como Entregado, pero el inventario no se pudo actualizar: ${errorInventario?.message || errorInventario}`, "warning");
        }
      } else {
        mostrarMensaje(`Pedido #${obtenerCodigoPedido(data)} marcado como ${estadoNuevo}.`, "success");
      }
    } finally {
      setGuardandoEstadoPedidoId(null);
    }
  }, [adminActor, adminUsuario, confirmarRafiki, guardandoEstadoPedidoId, mostrarMensaje, pedidos, puedeCambiarEstado, registrarAuditoria, setPedidos]);

  const finalizarTodosPendientes = useCallback(async () => {
    if (finalizandoPendientes || guardandoEstadoPedidoId) return;

    if (!puedeFinalizarPendientes) {
      mostrarMensaje("Tu rol no tiene permiso para finalizar todos los pedidos.", "error");
      return;
    }

    const pendientesParaFinalizar = pedidosPendientes.filter((pedido) => obtenerEstadoPedido(pedido) === "Pendiente");

    if (pendientesParaFinalizar.length === 0) {
      mostrarMensaje(MENSAJES_PEDIDOS.SIN_PEDIDOS_PENDIENTES, "warning");
      return;
    }

    const confirmar = await confirmarRafiki({
      tipo: "advertencia",
      titulo: "Finalizar pedidos pendientes",
      mensaje: CONFIRMACIONES_PEDIDOS.finalizarPendientes(pendientesParaFinalizar.length),
      textoConfirmar: "Finalizar todos",
    });

    if (!confirmar) return;

    setFinalizandoPendientes(true);

    try {
      const ids = pendientesParaFinalizar.map((pedido) => pedido.id);
      const { data, error } = await finalizarPedidosPorIds(ids);

      if (error) {
        registrarErrorSupabase("finalizar pedidos", error);
        mostrarMensaje(describirErrorSupabase(error, "finalizar los pedidos"), "error");
        return;
      }

      const actualizados = data || [];
      const mapaActualizados = new Map(actualizados.map((pedido) => [pedido.id, pedido]));

      setPedidos((actual) => actual.map((pedido) => mapaActualizados.get(pedido.id) || pedido));
      await Promise.all((actualizados.length ? actualizados : pendientesParaFinalizar).map((pedido) => registrarAuditoria({
        accion: "finalizacion_masiva",
        pedido,
        detalle: { totalSeleccionados: ids.length },
      })));

      let movimientosInventario = 0;
      let erroresInventario = 0;
      for (const pedido of (actualizados.length ? actualizados : pendientesParaFinalizar)) {
        try {
          const resultadoInventario = await registrarDescuentoInventarioPedido(pedido, { usuario: adminActor || adminUsuario?.email || "Admin Rafiki" });
          movimientosInventario += resultadoInventario.total || 0;
        } catch (errorInventario) {
          erroresInventario += 1;
          console.warn("Inventario no actualizado en finalización masiva:", errorInventario?.message || errorInventario);
        }
      }

      const mensajeInventario = movimientosInventario
        ? ` Inventario actualizado (${movimientosInventario} movimientos).`
        : "";
      const mensajeErroresInventario = erroresInventario
        ? ` ${erroresInventario} pedidos no pudieron actualizar inventario.`
        : "";
      mostrarMensaje(`${actualizados.length || ids.length} pedidos pendientes marcados como entregados.${mensajeInventario}${mensajeErroresInventario}`, erroresInventario ? "warning" : "success");
    } finally {
      setFinalizandoPendientes(false);
    }
  }, [adminActor, adminUsuario, confirmarRafiki, finalizandoPendientes, guardandoEstadoPedidoId, mostrarMensaje, pedidosPendientes, puedeFinalizarPendientes, registrarAuditoria, setPedidos]);

  const eliminarPedidoAdministrador = useCallback(async (id) => {
    if (eliminandoPedidoId) return;

    if (!puedeEliminarPedido) {
      mostrarMensaje("Tu rol no tiene permiso para eliminar pedidos.", "error");
      return;
    }

    const pedidoActual = pedidos.find((pedido) => pedido.id === id);
    const codigoPedido = pedidoActual ? obtenerCodigoPedido(pedidoActual) : id;

    const confirmar = await confirmarRafiki({
      tipo: "eliminar",
      titulo: `Borrar pedido #${codigoPedido}`,
      mensaje: CONFIRMACIONES_PEDIDOS.eliminarPedido(codigoPedido),
      textoConfirmar: "Sí, borrar",
    });

    if (!confirmar) return;

    setEliminandoPedidoId(id);

    try {
      const { data, error } = await marcarPedidoBorrado(id);

      if (error) {
        registrarErrorSupabase("borrar pedido", error);
        mostrarMensaje(describirErrorSupabase(error, "borrar el pedido"), "error");
        return;
      }

      try {
        await anularCarteraPedidoCredito(
          data || pedidoActual || { id },
          `Pedido #${codigoPedido} borrado. Cartera anulada automáticamente.`,
          { forzar: true }
        );
      } catch (errorCartera) {
        console.warn("Pedido borrado, pero la cartera no se pudo sincronizar:", errorCartera?.message || errorCartera);
        mostrarMensaje(`Pedido #${codigoPedido} borrado, pero revisa cartera: no se pudo anular automáticamente.`, "warning");
      }

      setPedidos((actual) => actual.map((pedido) => (pedido.id === id ? data : pedido)));
      registrarAuditoria({
        accion: "pedido_borrado",
        pedido: data,
        detalle: { estadoAnterior: obtenerEstadoPedido(pedidoActual || {}), requiereClaveLocal: false, carteraSincronizada: true },
      });
      mostrarMensaje(`Pedido #${codigoPedido} movido a Pedidos Borrados y cartera sincronizada.`, "success");
    } finally {
      setEliminandoPedidoId(null);
    }
  }, [confirmarRafiki, eliminandoPedidoId, mostrarMensaje, pedidos, puedeEliminarPedido, registrarAuditoria, setPedidos]);


  const cambiarFechaPedidoAdministrador = useCallback(async (pedido, nuevaFechaISO) => {
    if (editandoPedidoId) return false;

    if (!puedeEditarPedido) {
      mostrarMensaje("Tu rol no tiene permiso para cambiar fechas de pedidos.", "error");
      return false;
    }

    if (!pedido?.id) {
      mostrarMensaje("No se pudo identificar el pedido.", "error");
      return false;
    }

    const fechaNueva = new Date(nuevaFechaISO);
    if (Number.isNaN(fechaNueva.getTime())) {
      mostrarMensaje("Selecciona una fecha y hora válidas.", "warning");
      return false;
    }

    const codigoPedido = obtenerCodigoPedido(pedido);
    const fechaAnteriorTexto = pedido?.created_at ? new Date(pedido.created_at).toLocaleString("es-CO") : "fecha anterior no disponible";
    const fechaNuevaTexto = fechaNueva.toLocaleString("es-CO");

    const confirmar = await confirmarRafiki({
      tipo: "advertencia",
      titulo: `Cambiar fecha del pedido #${codigoPedido}`,
      mensaje: `El pedido pasará de ${fechaAnteriorTexto} a ${fechaNuevaTexto}. Esto mueve el pedido en Pedidos Hoy, Informes y Caja porque esos módulos consultan por fecha del pedido. Si el día ya tenía cierre, revisa el informe nuevamente.`,
      textoConfirmar: "Cambiar fecha",
    });

    if (!confirmar) return false;

    setEditandoPedidoId(pedido.id);

    try {
      const { data, error } = await actualizarFechaPedido(pedido.id, fechaNueva.toISOString());

      if (error) {
        registrarErrorSupabase("cambiar fecha de pedido", error);
        mostrarMensaje(describirErrorSupabase(error, "cambiar la fecha del pedido"), "error");
        return false;
      }

      registrarAuditoria({
        accion: "pedido_fecha_cambiada",
        pedido: data || pedido,
        detalle: {
          created_at_anterior: pedido?.created_at || null,
          created_at_nuevo: data?.created_at || fechaNueva.toISOString(),
          motivo: "Corrección operativa desde Pedidos Hoy",
        },
      });

      setPedidos((actual) => {
        const actualizado = data || { ...pedido, created_at: fechaNueva.toISOString() };
        const coincide = typeof pedidoCoincideConFiltroActual === "function"
          ? pedidoCoincideConFiltroActual(actualizado)
          : true;

        if (!coincide) {
          return actual.filter((item) => item.id !== pedido.id);
        }

        return actual.map((item) => (item.id === pedido.id ? actualizado : item));
      });

      mostrarMensaje(`Fecha del pedido #${codigoPedido} actualizada correctamente.`, "success");
      return true;
    } finally {
      setEditandoPedidoId(null);
    }
  }, [confirmarRafiki, editandoPedidoId, mostrarMensaje, pedidoCoincideConFiltroActual, puedeEditarPedido, registrarAuditoria, setPedidos]);


  const editarPedidoAdministrador = useCallback(async (id, cambios = {}) => {
    if (editandoPedidoId) return false;

    if (!puedeEditarPedido) {
      mostrarMensaje("Tu rol no tiene permiso para editar pedidos.", "error");
      return false;
    }

    const pedidoActual = pedidos.find((pedido) => pedido.id === id);
    const codigoPedido = pedidoActual ? obtenerCodigoPedido(pedidoActual) : id;

    const clienteLimpio = limpiarTexto(cambios.cliente || cambios.cliente_nombre || "", 120);
    const telefonoLimpio = limpiarTelefono(cambios.telefono || "");
    const ubicacionLimpia = limpiarTexto(cambios.ubicacion || "", 200);
    const mesaLimpia = limpiarTexto(cambios.mesa || "", 40);
    const meseroLimpio = limpiarTexto(cambios.mesero || "", 80);
    const tipoPagoLimpio = normalizarMetodoPago(limpiarTexto(cambios.tipo_pago || "", 80), { permitirCredito: true, fallback: METODOS_PAGO.EFECTIVO });
    const observacionesLimpias = limpiarTexto(cambios.observaciones || "", 500);
    const pedidoTextoLimpio = limpiarTexto(cambios.pedido_texto || "", 3000);
    const totalNuevo = Number(cambios.total);

    if (!clienteLimpio) {
      mostrarMensaje("El pedido debe tener cliente o nombre de mesa.", "warning");
      return false;
    }

    if (!Number.isFinite(totalNuevo) || totalNuevo < 0) {
      mostrarMensaje("El total del pedido no es válido.", "warning");
      return false;
    }

    const confirmar = await confirmarRafiki({
      tipo: "confirmar",
      titulo: `Editar pedido #${codigoPedido}`,
      mensaje: "Se actualizarán los datos generales del pedido. Esta acción quedará registrada en auditoría.",
      textoConfirmar: "Guardar cambios",
    });

    if (!confirmar) return false;

    setEditandoPedidoId(id);

    try {
      const payload = {
        cliente: clienteLimpio,
        cliente_nombre: clienteLimpio,
        telefono: telefonoLimpio,
        ubicacion: ubicacionLimpia || mesaLimpia || "",
        mesa: mesaLimpia,
        mesero: meseroLimpio,
        tipo_pago: tipoPagoLimpio || METODOS_PAGO.EFECTIVO,
        observaciones: observacionesLimpias,
        pedido_texto: pedidoTextoLimpio,
        total: totalNuevo,
      };

      const pagoAnteriorEsCredito = esMetodoPagoCredito(pedidoActual?.tipo_pago);
      const pagoNuevoEsCredito = esMetodoPagoCredito(payload?.tipo_pago);

      if (pagoAnteriorEsCredito && !pagoNuevoEsCredito) {
        try {
          await anularCarteraPedidoCredito(pedidoActual, `Pedido #${codigoPedido} retirado de crédito. Pago corregido a ${payload?.tipo_pago || "otro método"}.`);
        } catch (errorCartera) {
          console.warn("No se pudo retirar de crédito antes de editar el pedido:", errorCartera?.message || errorCartera);
          registrarErrorSupabase("retirar pedido de cartera", errorCartera);
          mostrarMensaje(describirErrorSupabase(errorCartera, `retirar el pedido #${codigoPedido} de cartera`), "warning");
          return false;
        }
      }

      const { data, error } = await actualizarPedido(id, payload);

      if (error) {
        registrarErrorSupabase("editar pedido", error);
        mostrarMensaje(describirErrorSupabase(error, "editar el pedido"), "error");
        return false;
      }

      try {
        await sincronizarCarteraPedido(data, {
          accion: "pedido_editado",
          motivo: `Pedido #${codigoPedido} editado. Cartera sincronizada automáticamente.`,
        });
      } catch (errorCartera) {
        console.warn("Pedido editado, pero la cartera automática no se actualizó:", errorCartera?.message || errorCartera);
        mostrarMensaje(`Pedido #${codigoPedido} actualizado, pero revisa cartera: no se pudo ajustar la cuenta por cobrar.`, "warning");
      }

      setPedidos((actual) => actual.map((pedido) => (pedido.id === id ? data : pedido)));
      registrarAuditoria({
        accion: "pedido_editado",
        pedido: data,
        detalle: {
          antes: {
            cliente: pedidoActual?.cliente || pedidoActual?.cliente_nombre || "",
            ubicacion: pedidoActual?.ubicacion || "",
            mesa: pedidoActual?.mesa || "",
            total: pedidoActual?.total || 0,
          },
          despues: {
            cliente: data?.cliente || data?.cliente_nombre || "",
            ubicacion: data?.ubicacion || "",
            mesa: data?.mesa || "",
            total: data?.total || 0,
          },
        },
      });
      mostrarMensaje(`Pedido #${codigoPedido} actualizado correctamente.`, "success");
      return true;
    } finally {
      setEditandoPedidoId(null);
    }
  }, [confirmarRafiki, editandoPedidoId, mostrarMensaje, pedidos, puedeEditarPedido, registrarAuditoria, setPedidos]);



  const editarPedidoMesaAdministrador = useCallback(async (id, { items, acompanantes, modoLlevar = false, mesa, cliente, telefono, ubicacion, mesero, tipoPago, observaciones: obsMesa } = {}) => {
    if (editandoPedidoId || guardandoPedido) return false;

    if (!puedeEditarPedido) {
      mostrarMensaje("Tu rol no tiene permiso para editar pedidos.", "error");
      return false;
    }

    const pedidoActual = pedidos.find((pedido) => pedido.id === id);
    const codigoPedido = pedidoActual ? obtenerCodigoPedido(pedidoActual) : id;

    const itemsValidos = (Array.isArray(items) ? items : [])
      .filter((item) => item.plato || item.proteina || item.producto)
      .map((item) => {
        if (item.categoria === "cafeteria") {
          return {
            ...item,
            paraLlevar: Boolean(modoLlevar)
          };
        }

        const sinAcompanantes = esProductoSinAcompanantes(item);

        return {
          ...item,
          acompanantes: sinAcompanantes ? [] : limpiarAcompanantesMenu(
            Array.isArray(item.acompanantes) && item.acompanantes.length > 0
              ? item.acompanantes
              : acompanantes || []
          ),
          observacionAcompanantes: sinAcompanantes ? "" : item.observacionAcompanantes || "",
          paraLlevar: Boolean(modoLlevar)
        };
      });

    if (itemsValidos.length === 0) {
      mostrarMensaje("Agrega al menos un producto antes de guardar la edición.", "warning");
      return false;
    }

    const esLlevar = Boolean(modoLlevar);
    const mesaLimpia = esLlevar ? "Llevar" : limpiarTexto(mesa, 40);
    const clienteMesaOpcional = limpiarTexto(cliente, 120);
    const clienteLimpio = clienteMesaOpcional || (esLlevar ? "Cliente" : mesaLimpia);
    const telefonoLimpio = esLlevar ? limpiarTelefono(telefono) : "";
    const ubicacionLimpia = esLlevar ? limpiarTexto(ubicacion, 200) : mesaLimpia;
    const meseroLimpio = limpiarTexto(mesero, 80);
    const tipoPagoLimpio = normalizarMetodoPago(limpiarTexto(tipoPago, 80), { permitirCredito: true, fallback: METODOS_PAGO.EFECTIVO });
    const observacionesLimpias = limpiarTexto(obsMesa, 500);
    const pedidoTexto = crearTextoPedido(itemsValidos, observacionesLimpias);
    const total = calcularTotalItems(itemsValidos);

    if (!mesaLimpia) {
      mostrarMensaje("Selecciona la mesa o marca Llevar antes de guardar la edición.", "warning");
      return false;
    }

    if (!meseroLimpio) {
      mostrarMensaje("Selecciona el mesero antes de guardar la edición.", "warning");
      return false;
    }

    const confirmar = await confirmarRafiki({
      tipo: "confirmar",
      titulo: `Guardar edición del pedido #${codigoPedido}`,
      mensaje: "Se reemplazará el contenido del pedido original usando el panel de mesas. Esta acción quedará registrada en auditoría.",
      textoConfirmar: "Guardar edición",
    });

    if (!confirmar) return false;

    setEditandoPedidoId(id);

    try {
      const payload = {
        cliente: clienteLimpio,
        cliente_nombre: clienteLimpio,
        telefono: telefonoLimpio,
        ubicacion: ubicacionLimpia,
        mesa: mesaLimpia,
        mesero: meseroLimpio,
        tipo_pago: tipoPagoLimpio,
        tipo_pedido: esLlevar ? "llevar" : "mesa",
        observaciones: observacionesLimpias,
        items: itemsValidos,
        pedido_texto: pedidoTexto,
        total,
      };

      const pagoAnteriorEsCredito = esMetodoPagoCredito(pedidoActual?.tipo_pago);
      const pagoNuevoNoEsCredito = !esMetodoPagoCredito(payload?.tipo_pago);

      if (pagoAnteriorEsCredito && pagoNuevoNoEsCredito) {
        try {
          await anularCarteraPedidoCredito(pedidoActual, `Pedido #${codigoPedido} retirado de crédito desde edición en mesas. Pago corregido a ${payload?.tipo_pago || "otro método"}.`);
        } catch (errorCartera) {
          console.warn("No se pudo retirar de crédito antes de editar el pedido desde mesas:", errorCartera?.message || errorCartera);
          registrarErrorSupabase("retirar pedido de cartera", errorCartera);
          mostrarMensaje(describirErrorSupabase(errorCartera, `retirar el pedido #${codigoPedido} de cartera`), "warning");
          return false;
        }
      }

      const { data, error } = await actualizarPedido(id, payload);

      if (error) {
        registrarErrorSupabase("editar pedido", error);
        mostrarMensaje(describirErrorSupabase(error, "editar el pedido"), "error");
        return false;
      }

      try {
        await sincronizarCarteraPedido(data, {
          accion: "pedido_editado_desde_mesas",
          motivo: `Pedido #${codigoPedido} editado desde mesas. Cartera sincronizada automáticamente.`,
        });
      } catch (errorCartera) {
        console.warn("Pedido editado desde mesas, pero la cartera automática no se actualizó:", errorCartera?.message || errorCartera);
        mostrarMensaje(`Pedido #${codigoPedido} editado, pero revisa cartera: no se pudo ajustar la cuenta por cobrar.`, "warning");
      }

      setPedidos((actual) => actual.map((pedido) => (pedido.id === id ? data : pedido)));
      registrarAuditoria({
        accion: "pedido_editado_desde_mesas",
        pedido: data,
        detalle: {
          antes: {
            mesa: pedidoActual?.mesa || "",
            total: pedidoActual?.total || 0,
            items: Array.isArray(pedidoActual?.items) ? pedidoActual.items.length : 0,
          },
          despues: {
            mesa: data?.mesa || "",
            total: data?.total || 0,
            items: Array.isArray(data?.items) ? data.items.length : 0,
          },
        },
      });
      mostrarMensaje(`Pedido #${codigoPedido} editado correctamente desde mesas.`, "success");
      return data;
    } finally {
      setEditandoPedidoId(null);
    }
  }, [confirmarRafiki, editandoPedidoId, guardandoPedido, mostrarMensaje, pedidos, puedeEditarPedido, registrarAuditoria, setPedidos]);

  return {
    guardandoPedido,
    guardandoEstadoPedidoId,
    eliminandoPedidoId,
    editandoPedidoId,
    finalizandoPendientes,
    registrarPedido,
    registrarPedidoMesa,
    cambiarEstadoPedido,
    finalizarTodosPendientes,
    eliminarPedidoAdministrador,
    editarPedidoAdministrador,
    editarPedidoMesaAdministrador,
    cambiarFechaPedidoAdministrador,
  };
}
