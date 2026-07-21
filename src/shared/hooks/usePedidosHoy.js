import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseConfigMensaje, supabaseConfigOk } from "../../supabaseClient";
import { buscarPedidosPorNumeroGlobal, cargarPedidosRango } from "../../services/pedidosService";
import { conTiempoMaximo } from "../utils/async";
import { fechaISOColombia, obtenerRangoPedidos } from "../utils/pedidos";
import { useAdminPedidos } from "./useAdminPedidos";
import { describirErrorSupabase, registrarErrorSupabase } from "../utils/supabaseErrors";

export const PEDIDOS_HOY_LIMITE_INICIAL = 500;
export const PEDIDOS_HOY_LIMITE_CARGAR_MAS = 500;

export function crearEstadoPaginacionPedidos() {
  return {
    total: null,
    cargados: 0,
    hayMas: false,
    cargandoMas: false,
    limite: PEDIDOS_HOY_LIMITE_INICIAL,
    cargaLimitada: true,
    advertencia: ""
  };
}

export function usePedidosHoy({ adminAutenticado, vista, adminTab, mostrarMensaje }) {
  const [pedidos, setPedidos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDebounced, setBusquedaDebounced] = useState("");
  const [busquedaNumeroPedido, setBusquedaNumeroPedido] = useState("");
  const [resultadoNumeroPedido, setResultadoNumeroPedido] = useState([]);
  const [cargandoNumeroPedido, setCargandoNumeroPedido] = useState(false);
  const [errorNumeroPedido, setErrorNumeroPedido] = useState("");
  const [filtroPedidos, setFiltroPedidos] = useState("hoy");
  const [fechaSeleccionada, setFechaSeleccionada] = useState(fechaISOColombia());
  const [fechaInicioRangoPedidos, setFechaInicioRangoPedidos] = useState(fechaISOColombia());
  const [fechaFinRangoPedidos, setFechaFinRangoPedidos] = useState(fechaISOColombia());
  const [cargandoPedidos, setCargandoPedidos] = useState(true);
  const [errorCargaPedidos, setErrorCargaPedidos] = useState("");
  const [paginacionPedidos, setPaginacionPedidos] = useState(() => crearEstadoPaginacionPedidos());
  const [recargaPedidos, setRecargaPedidos] = useState(0);

  const pedidosCargaHashRef = useRef("");
  const paginacionPedidosRef = useRef(crearEstadoPaginacionPedidos());

  useEffect(() => {
    const timer = setTimeout(() => {
      setBusquedaDebounced(busqueda);
    }, 300);

    return () => clearTimeout(timer);
  }, [busqueda]);

  const {
    pedidosFiltrados,
    pedidosPendientes,
    pedidosFinalizados,
    pedidosBorrados,
    pedidosActivos,
    consolidado,
    tituloPedidos
  } = useAdminPedidos({
    pedidos,
    busquedaDebounced,
    filtroPedidos,
    fechaSeleccionada,
    fechaInicioRangoPedidos,
    fechaFinRangoPedidos
  });

  const buscarPedidoPorNumeroGlobal = useCallback(async () => {
    const numeroLimpio = String(busquedaNumeroPedido || "").replace(/\D+/g, "");

    if (!numeroLimpio) {
      setResultadoNumeroPedido([]);
      setErrorNumeroPedido("Escribe el número del pedido que quieres buscar.");
      return;
    }

    if (!supabaseConfigOk) {
      setResultadoNumeroPedido([]);
      setErrorNumeroPedido(supabaseConfigMensaje);
      return;
    }

    setCargandoNumeroPedido(true);
    setErrorNumeroPedido("");

    try {
      const { data, error } = await conTiempoMaximo(
        buscarPedidosPorNumeroGlobal(numeroLimpio),
        10000,
        "La búsqueda por número de pedido"
      );

      if (error) {
        setResultadoNumeroPedido([]);
        registrarErrorSupabase("buscar pedido por número", error);
        setErrorNumeroPedido(describirErrorSupabase(error, `buscar el pedido #${numeroLimpio}`));
        return;
      }

      const encontrados = Array.isArray(data) ? data : [];
      setResultadoNumeroPedido(encontrados);
      if (!encontrados.length) {
        setErrorNumeroPedido(`No encontré pedidos con número ${numeroLimpio}.`);
      }
    } catch (error) {
      setResultadoNumeroPedido([]);
      registrarErrorSupabase("buscar pedido por número", error);
      setErrorNumeroPedido(describirErrorSupabase(error, "buscar el pedido"));
    } finally {
      setCargandoNumeroPedido(false);
    }
  }, [busquedaNumeroPedido]);

  const limpiarBusquedaNumeroPedido = useCallback(() => {
    setBusquedaNumeroPedido("");
    setResultadoNumeroPedido([]);
    setErrorNumeroPedido("");
  }, []);

  const hayBusquedaPedidos = busqueda.trim().length > 0;

  useEffect(() => {
    paginacionPedidosRef.current = paginacionPedidos;
  }, [paginacionPedidos]);

  useEffect(() => {
    let cancelado = false;
    const debeCargarPedidos =
      adminAutenticado && ((vista === "admin" && adminTab === "pedidos") || vista === "pedidos");

    if (!debeCargarPedidos) {
      setCargandoPedidos(false);
      return () => {
        cancelado = true;
      };
    }

    async function cargarPedidosSeguro() {
      setCargandoPedidos(true);
      setPaginacionPedidos((actual) => ({
        ...actual,
        cargandoMas: false,
        limite: PEDIDOS_HOY_LIMITE_INICIAL
      }));

      if (!supabaseConfigOk) {
        setCargandoPedidos(false);
        setPaginacionPedidos(crearEstadoPaginacionPedidos());
        mostrarMensaje(supabaseConfigMensaje, "error");
        return;
      }

      try {
        const rango =
          filtroPedidos === "rango"
            ? obtenerRangoPedidos("rango", fechaInicioRangoPedidos, fechaFinRangoPedidos)
            : obtenerRangoPedidos(filtroPedidos, fechaSeleccionada);

        const resultadoPedidos = await conTiempoMaximo(
          cargarPedidosRango(rango.inicio, rango.fin, {
            ascendente: false,
            limite: PEDIDOS_HOY_LIMITE_INICIAL,
            offset: 0,
            contar: true
          }),
          12000,
          "La carga inicial de pedidos"
        );

        if (cancelado) return;

        const {
          data: pedidosData,
          error: pedidosError,
          count,
          hayMas,
          limite,
          advertencia
        } = resultadoPedidos || {};

        if (pedidosError) {
          registrarErrorSupabase("cargar pedidos hoy", pedidosError);
          const detalle = describirErrorSupabase(pedidosError, "cargar los pedidos");
          setErrorCargaPedidos(detalle);
          setPaginacionPedidos(crearEstadoPaginacionPedidos());
          mostrarMensaje(detalle, "error");
          return;
        }

        const pedidosNuevos = pedidosData || [];
        const totalPedidos = Number.isFinite(count) ? count : null;
        const nuevoHashPedidos = JSON.stringify(
          pedidosNuevos.map((pedido) => [pedido.id, pedido.estado, pedido.total, pedido.created_at])
        );

        setErrorCargaPedidos("");
        setPaginacionPedidos({
          total: totalPedidos,
          cargados: pedidosNuevos.length,
          hayMas: Boolean(hayMas),
          cargandoMas: false,
          limite: limite || PEDIDOS_HOY_LIMITE_INICIAL,
          cargaLimitada: true,
          advertencia:
            advertencia ||
            (hayMas
              ? `Se muestran ${pedidosNuevos.length} de ${totalPedidos || "más"} pedidos del rango seleccionado. Usa Cargar más resultados si necesitas completar el historial.`
              : "")
        });
        setPedidos((actual) => {
          if (pedidosCargaHashRef.current === nuevoHashPedidos) return actual;
          pedidosCargaHashRef.current = nuevoHashPedidos;
          return pedidosNuevos;
        });
      } catch (error) {
        if (!cancelado) {
          registrarErrorSupabase("cargar pedidos hoy", error);
          const detalle =
            describirErrorSupabase(error, "cargar los pedidos") + " Se conserva la última información visible.";
          setErrorCargaPedidos(detalle);
          setPaginacionPedidos((actual) => ({ ...actual, cargandoMas: false }));
          mostrarMensaje(detalle, "error");
        }
      } finally {
        if (!cancelado) {
          setCargandoPedidos(false);
        }
      }
    }

    cargarPedidosSeguro();

    return () => {
      cancelado = true;
    };
  }, [
    vista,
    adminAutenticado,
    adminTab,
    filtroPedidos,
    fechaSeleccionada,
    fechaInicioRangoPedidos,
    fechaFinRangoPedidos,
    recargaPedidos,
    mostrarMensaje
  ]);

  const cargarMasPedidos = useCallback(async () => {
    const estadoPaginacion = paginacionPedidosRef.current;
    const debeCargarPedidos =
      adminAutenticado && ((vista === "admin" && adminTab === "pedidos") || vista === "pedidos");

    if (!debeCargarPedidos || cargandoPedidos || estadoPaginacion.cargandoMas || !estadoPaginacion.hayMas) {
      return;
    }

    if (!supabaseConfigOk) {
      mostrarMensaje(supabaseConfigMensaje, "error");
      return;
    }

    setPaginacionPedidos((actual) => ({ ...actual, cargandoMas: true }));

    try {
      const rango =
        filtroPedidos === "rango"
          ? obtenerRangoPedidos("rango", fechaInicioRangoPedidos, fechaFinRangoPedidos)
          : obtenerRangoPedidos(filtroPedidos, fechaSeleccionada);

      const offset = Math.max(0, Number(estadoPaginacion.cargados || 0));
      const resultadoPedidos = await conTiempoMaximo(
        cargarPedidosRango(rango.inicio, rango.fin, {
          ascendente: false,
          limite: PEDIDOS_HOY_LIMITE_CARGAR_MAS,
          offset,
          contar: true
        }),
        12000,
        "La carga de más pedidos"
      );

      const { data: pedidosData, error: pedidosError, count, hayMas, limite } = resultadoPedidos || {};

      if (pedidosError) {
        registrarErrorSupabase("cargar más pedidos", pedidosError);
        const detalle = describirErrorSupabase(pedidosError, "cargar más pedidos");
        setErrorCargaPedidos(detalle);
        mostrarMensaje(detalle, "error");
        setPaginacionPedidos((actual) => ({ ...actual, cargandoMas: false }));
        return;
      }

      const lote = Array.isArray(pedidosData) ? pedidosData : [];

      setPedidos((actual) => {
        const ids = new Set(actual.map((pedido) => pedido.id));
        const combinados = [...actual];

        lote.forEach((pedido) => {
          if (!pedido?.id || ids.has(pedido.id)) return;
          ids.add(pedido.id);
          combinados.push(pedido);
        });

        return combinados;
      });

      const totalPedidos = Number.isFinite(count) ? count : estadoPaginacion.total;
      const cargadosServidor = offset + lote.length;

      setPaginacionPedidos({
        total: totalPedidos,
        cargados: cargadosServidor,
        hayMas: Boolean(hayMas),
        cargandoMas: false,
        limite: limite || PEDIDOS_HOY_LIMITE_CARGAR_MAS,
        cargaLimitada: true,
        advertencia: hayMas
          ? `Se han cargado ${cargadosServidor} pedido${cargadosServidor === 1 ? "" : "s"} del rango seleccionado. Puedes cargar más si lo necesitas.`
          : `Carga completa del rango visible: ${cargadosServidor} pedido${cargadosServidor === 1 ? "" : "s"}.`
      });
      setErrorCargaPedidos("");
    } catch (error) {
      registrarErrorSupabase("cargar más pedidos", error);
      const detalle = describirErrorSupabase(error, "cargar más pedidos");
      setErrorCargaPedidos(detalle);
      setPaginacionPedidos((actual) => ({ ...actual, cargandoMas: false }));
      mostrarMensaje(detalle, "error");
    }
  }, [
    adminAutenticado,
    adminTab,
    cargandoPedidos,
    fechaFinRangoPedidos,
    fechaInicioRangoPedidos,
    fechaSeleccionada,
    filtroPedidos,
    mostrarMensaje,
    vista
  ]);

  return {
    pedidos,
    setPedidos,
    busqueda,
    setBusqueda,
    busquedaNumeroPedido,
    setBusquedaNumeroPedido,
    resultadoNumeroPedido,
    cargandoNumeroPedido,
    errorNumeroPedido,
    filtroPedidos,
    setFiltroPedidos,
    fechaSeleccionada,
    setFechaSeleccionada,
    fechaInicioRangoPedidos,
    setFechaInicioRangoPedidos,
    fechaFinRangoPedidos,
    setFechaFinRangoPedidos,
    cargandoPedidos,
    errorCargaPedidos,
    paginacionPedidos,
    recargaPedidos,
    setRecargaPedidos,
    pedidosFiltrados,
    pedidosPendientes,
    pedidosFinalizados,
    pedidosBorrados,
    pedidosActivos,
    consolidado,
    tituloPedidos,
    hayBusquedaPedidos,
    buscarPedidoPorNumeroGlobal,
    limpiarBusquedaNumeroPedido,
    cargarMasPedidos
  };
}
