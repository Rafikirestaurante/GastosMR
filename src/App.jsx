import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, supabaseConfigOk } from "./supabaseClient";
import { obtenerVistaInicial, actualizarRuta } from "./shared/utils/navigation";
import { useConfirmacion } from "./shared/components/common";
import { MAX_ACOMPANANTES_CLIENTE } from "./data/menuAlmuerzos";
import {
  agruparPlatosPorCategoria,
  calcularTotalItems,
  crearItemCafeteria,
  crearItemNuevo,
  crearLinkWhatsApp,
  crearMensajeWhatsAppPedido,
  limpiarTelefonoWhatsApp,
  esProductoSinAcompanantes,
  normalizarItemsParaDestinoCliente
} from "./shared/utils/pedidos";
import { consolidarItemsResumenPedido, normalizarCantidadResumen } from "./shared/utils/resumenPedido";
import { WHATSAPP_RAFIKI } from "./config/adminConfig";
import CargandoModulo from "./shared/components/CargandoModulo";
import ErrorBoundary from "./shared/components/ErrorBoundary.jsx";
import { lazyConReintento } from "./shared/utils/lazyConReintento.js";
import {
  sincronizarPedidosPendientesOffline,
  actualizarBadgePedidosPendientes
} from "./shared/utils/offlinePedidos";
import { useRealtimePedidos } from "./shared/hooks/useRealtimePedidos";
import { ADMIN_TABS_VALIDAS, guardarAdminTabActiva, useAuthAdmin } from "./shared/hooks/useAuthAdmin";
import { usePedidosHoy } from "./shared/hooks/usePedidosHoy";
import { useMenuDiario } from "./shared/hooks/useMenuDiario";
import { usePedidos } from "./shared/hooks/usePedidos";

const InicioRafiki = lazyConReintento(
  () =>
    import("./modules/admin/components/auth/InicioAdmin").then((modulo) => ({
      default: modulo.InicioRafiki
    })),
  "InicioRafiki"
);
const AdminLogin = lazyConReintento(
  () =>
    import("./modules/admin/components/auth/InicioAdmin").then((modulo) => ({ default: modulo.AdminLogin })),
  "AdminLogin"
);
const AdminHeaderTabs = lazyConReintento(
  () => import("./modules/admin/components/layout/AdminHeaderTabs"),
  "AdminHeaderTabs"
);
const AdminPedidosSection = lazyConReintento(
  () => import("./modules/admin/components/pedidos/AdminPedidosSection"),
  "AdminPedidosSection"
);
const MenuDiarioTab = lazyConReintento(() => import("./modules/admin/tabs/MenuDiarioTab"), "MenuDiarioTab");
const PedidoCliente = lazyConReintento(
  () => import("./modules/cliente/components/PedidoCliente"),
  "PedidoCliente"
);
const ConfirmacionPedidoCliente = lazyConReintento(
  () => import("./modules/cliente/components/ConfirmacionPedidoCliente"),
  "ConfirmacionPedidoCliente"
);

const SolicitudProductos = lazyConReintento(
  () => import("./modules/catalogo/components/SolicitudProductos"),
  "SolicitudProductos"
);
const GeneradorMenu = lazyConReintento(
  () => import("./modules/catalogo/components/GeneradorMenu"),
  "GeneradorMenu"
);
const PanelMesasPOS = lazyConReintento(() => import("./modules/mesas/components/PanelMesas"), "PanelMesas");
const PanelMesasBeta = lazyConReintento(
  () => import("./modules/mesas/components/PanelMesasBeta"),
  "PanelMesasBeta"
);
const PanelClienteBeta = lazyConReintento(
  () => import("./modules/cliente/components/PanelClienteBeta"),
  "PanelClienteBeta"
);
const PanelRafaPrivado = lazyConReintento(
  () => import("./modules/dashboard/components/PanelRafaPrivado"),
  "PanelRafaPrivado"
);
const CatalogoRafa = lazyConReintento(
  () => import("./modules/catalogo/components/CatalogoRafa"),
  "CatalogoRafa"
);
const InventarioAdmin = lazyConReintento(
  () => import("./modules/inventario/components/InventarioAdmin"),
  "InventarioAdmin"
);
const CajaAdmin = lazyConReintento(() => import("./modules/caja/components/CajaAdmin"), "CajaAdmin");
const GerenciaPanel = lazyConReintento(
  () => import("./modules/gerencia/components/GerenciaPanel"),
  "GerenciaPanel"
);

const REALTIME_ADMIN_STORAGE_KEY = "rafikiRealtimeAdminActivo";

function crearItemClienteInicial({ comerRestaurante = false } = {}) {
  return {
    ...crearItemNuevo(),
    paraLlevar: !comerRestaurante
  };
}

export default function App() {
  const [confirmarRafiki, modalConfirmacionRafiki] = useConfirmacion();
  const [vista, setVista] = useState(() => obtenerVistaInicial());
  const [itemsPedido, setItemsPedido] = useState([crearItemClienteInicial()]);
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [comerRestauranteCliente, setComerRestauranteCliente] = useState(false);
  const [clienteEspecialAplicado, setClienteEspecialAplicado] = useState(null);
  const [tipoPago, setTipoPago] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [mensaje, setMensaje] = useState({ texto: "", tipo: "info" });
  const [mensajeMenu, setMensajeMenu] = useState({ texto: "", tipo: "info" });
  const [errorDatosPedido, setErrorDatosPedido] = useState("");
  const [pedidoFinalizado, setPedidoFinalizado] = useState(null);
  const [realtimeAdminActivo, setRealtimeAdminActivo] = useState(() => {
    try {
      return window.localStorage.getItem(REALTIME_ADMIN_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [cambiosPedidosPendientes, setCambiosPedidosPendientes] = useState(false);
  const [mensajeCambiosPedidos, setMensajeCambiosPedidos] = useState("");
  const [alertaPedidoNuevo, setAlertaPedidoNuevo] = useState(null);
  const [pedidoEditandoEnMesas, setPedidoEditandoEnMesas] = useState(null);
  const mensajeTimer = useRef(null);
  const mensajeMenuTimer = useRef(null);
  const alertaPedidoTimer = useRef(null);
  const sincronizandoOfflineRef = useRef(false);

  const navegar = useCallback((ruta, nuevaVista) => {
    actualizarRuta(ruta);
    setVista(nuevaVista);
  }, []);

  useEffect(() => {
    if (vista !== "cliente") return;

    setItemsPedido((actual) =>
      consolidarItemsResumenPedido(normalizarItemsParaDestinoCliente(actual, { comerRestauranteCliente }))
    );
  }, [vista, comerRestauranteCliente, itemsPedido]);

  const {
    adminTab,
    setAdminTab,
    adminAutenticado,
    adminEmail,
    adminPassword,
    adminUsuario,
    adminRol,
    adminAuthCargando,
    errorClaveAdmin,
    setAdminEmail,
    setAdminPassword,
    setErrorClaveAdmin,
    adminNombreRol,
    adminActor,
    puedeVerMenu,
    puedeVerProductos,
    puedeVerGenerador,
    puedeVerRafa,
    puedeVerCatalogo,
    puedeVerGastos,
    puedeVerInventario,
    puedeVerCaja,
    puedeVerInformeGastos,
    puedeEliminarPedido,
    puedeEditarPedido,
    puedeCambiarEstado,
    puedeFinalizarPendientes,
    validarClaveAdmin,
    cerrarPanelAdmin
  } = useAuthAdmin({ vista, setVista, navegar });

  useEffect(() => {
    actualizarBadgePedidosPendientes();

    const reenviarPedidosPendientes = async (opciones = {}) => {
      if (!supabaseConfigOk || sincronizandoOfflineRef.current || !window.navigator.onLine) return;

      sincronizandoOfflineRef.current = true;
      try {
        const resultado = await sincronizarPedidosPendientesOffline({
          supabase,
          ids: opciones.ids,
          onPedidoSincronizado: (pedidoSincronizado) => {
            if (pedidoCoincideConFiltroActual(pedidoSincronizado)) {
              setPedidos((actual) => {
                if (actual.some((pedido) => pedido.id === pedidoSincronizado.id)) return actual;
                return [...actual, pedidoSincronizado];
              });
            }
          }
        });

        if (resultado.enviados > 0) {
          mostrarMensaje(
            `${resultado.enviados} pedido${resultado.enviados === 1 ? "" : "s"} pendiente${resultado.enviados === 1 ? "" : "s"} enviado${resultado.enviados === 1 ? "" : "s"} correctamente.`,
            "success"
          );
        }
      } finally {
        sincronizandoOfflineRef.current = false;
      }
    };

    const manejarReenvioManual = (evento) => {
      reenviarPedidosPendientes(evento?.detail || {});
    };

    window.addEventListener("online", reenviarPedidosPendientes);
    window.addEventListener("rafiki:reenviar-pedidos-offline", manejarReenvioManual);
    reenviarPedidosPendientes();

    return () => {
      window.removeEventListener("online", reenviarPedidosPendientes);
      window.removeEventListener("rafiki:reenviar-pedidos-offline", manejarReenvioManual);
    };
  }, []);

  const mostrarMensaje = useCallback((texto, tipo = "info") => {
    if (mensajeTimer.current) {
      clearTimeout(mensajeTimer.current);
    }

    setMensaje({ texto, tipo });

    mensajeTimer.current = setTimeout(() => {
      setMensaje({ texto: "", tipo: "info" });
    }, 5000);
  }, []);

  const {
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
  } = usePedidosHoy({ adminAutenticado, vista, adminTab, mostrarMensaje });

  const mostrarMensajeMenu = useCallback((texto, tipo = "info", opciones = {}) => {
    if (mensajeMenuTimer.current) {
      clearTimeout(mensajeMenuTimer.current);
    }

    setMensajeMenu({ texto, tipo });

    if (!opciones.persistente) {
      mensajeMenuTimer.current = setTimeout(() => {
        setMensajeMenu({ texto: "", tipo: "info" });
      }, 8000);
    }
  }, []);

  const irAElemento = useCallback((id) => {
    setTimeout(() => {
      const elemento = document.getElementById(id);
      if (elemento) {
        elemento.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 160);
  }, []);

  useEffect(() => {
    return () => {
      if (mensajeTimer.current) {
        clearTimeout(mensajeTimer.current);
      }

      if (mensajeMenuTimer.current) {
        clearTimeout(mensajeMenuTimer.current);
      }

      if (alertaPedidoTimer.current) {
        clearTimeout(alertaPedidoTimer.current);
      }
    };
  }, []);

  const mostrarAlertaPedidoNuevo = useCallback((pedido) => {
    setAlertaPedidoNuevo(pedido);
    if (alertaPedidoTimer.current) {
      clearTimeout(alertaPedidoTimer.current);
    }
    alertaPedidoTimer.current = setTimeout(() => setAlertaPedidoNuevo(null), 12000);
  }, []);

  const realtimePuedeActualizarPedidos =
    realtimeAdminActivo &&
    adminAutenticado &&
    ((vista === "admin" && adminTab === "pedidos") || vista === "pedidos");

  const cambiarEstadoRealtimeAdmin = useCallback(() => {
    setRealtimeAdminActivo((activoActual) => {
      const siguienteEstado = !activoActual;
      try {
        window.localStorage.setItem(REALTIME_ADMIN_STORAGE_KEY, siguienteEstado ? "true" : "false");
      } catch {
        // Si localStorage no está disponible, el cambio sigue funcionando durante la sesión.
      }

      if (!siguienteEstado) {
        setCambiosPedidosPendientes(false);
        setMensajeCambiosPedidos("");
        setAlertaPedidoNuevo(null);
      } else if (vista === "admin" && adminAutenticado) {
        setRecargaPedidos((actual) => actual + 1);
      }

      return siguienteEstado;
    });
  }, [adminAutenticado, vista]);

  const marcarCambiosPedidosPendientes = useCallback(
    (detalle = "Hay nuevos cambios en pedidos.") => {
      if (!realtimeAdminActivo) return;
      setCambiosPedidosPendientes(true);
      setMensajeCambiosPedidos(detalle);
    },
    [realtimeAdminActivo]
  );

  const cambiarAdminTabSeguro = useCallback((tab) => {
    if (!ADMIN_TABS_VALIDAS.has(tab)) return;
    guardarAdminTabActiva(tab);
    setAdminTab(tab);

    if (tab === "pedidos") {
      setCambiosPedidosPendientes(false);
      setMensajeCambiosPedidos("");
      setRecargaPedidos((actual) => actual + 1);
    }
  }, []);

  const irAPedidosYActualizar = useCallback(() => {
    cambiarAdminTabSeguro("pedidos");
  }, [cambiarAdminTabSeguro]);

  const descartarAvisoCambiosPedidos = useCallback(() => {
    setCambiosPedidosPendientes(false);
    setMensajeCambiosPedidos("");
  }, []);

  const { estadoRealtimePedidos, pedidoCoincideConFiltroActual, instanciaRealtimeRef } = useRealtimePedidos({
    activo: realtimeAdminActivo && vista === "admin" && adminAutenticado,
    filtroPedidos,
    fechaSeleccionada,
    fechaInicioRangoPedidos,
    fechaFinRangoPedidos,
    setPedidos,
    setRecargaPedidos,
    mostrarAlertaPedidoNuevo,
    puedeActualizarAutomatico: realtimePuedeActualizarPedidos,
    onCambiosPendientes: marcarCambiosPedidosPendientes
  });

  const {
    menu,
    setMenu,
    cargandoMenu,
    guardandoMenu,
    setRecargaMenu,
    platosTexto,
    setPlatosTexto,
    acompanantesTexto,
    setAcompanantesTexto,
    sincronizarFechaMenuActual,
    traerTextoDesdeGeneradorMenu,
    imprimirMenuDiarioTicket,
    guardarMenu
  } = useMenuDiario({
    adminTab,
    instanciaRealtimeRef,
    irAElemento,
    mostrarMensaje,
    mostrarMensajeMenu,
    setItemsPedido,
    setMensajeMenu
  });

  useEffect(() => {
    if (vista !== "admin" || !adminAutenticado || adminTab !== "menu") return;
    sincronizarFechaMenuActual();
  }, [vista, adminAutenticado, adminTab, sincronizarFechaMenuActual]);

  useEffect(() => {
    function manejarCambioRuta() {
      const vistaRuta = obtenerVistaInicial();
      setVista((vistaActual) => {
        if (vistaRuta === "adminLogin" && adminAutenticado && vistaActual === "admin") {
          return "admin";
        }

        return vistaRuta;
      });
    }

    window.addEventListener("popstate", manejarCambioRuta);
    return () => window.removeEventListener("popstate", manejarCambioRuta);
  }, [adminAutenticado]);

  const vistaProtegidaAdmin =
    vista === "admin" ||
    vista === "adminLogin" ||
    vista === "pedidos" ||
    vista === "inventario" ||
    vista === "gerencia";
  const cargando = vistaProtegidaAdmin && adminAuthCargando;
  const itemsPedidoClienteNormalizados = useMemo(() => {
    if (vista !== "cliente") return itemsPedido;

    return normalizarItemsParaDestinoCliente(itemsPedido, { comerRestauranteCliente });
  }, [vista, itemsPedido, comerRestauranteCliente]);

  const itemsPedidoOperativos = vista === "cliente" ? itemsPedidoClienteNormalizados : itemsPedido;

  const itemsConProducto = useMemo(
    () => itemsPedidoOperativos.filter((item) => item.plato || item.proteina || item.producto),
    [itemsPedidoOperativos]
  );

  const totalPedido = useMemo(() => calcularTotalItems(itemsConProducto), [itemsConProducto]);

  const hayProductoSeleccionado = useMemo(() => {
    return itemsPedidoOperativos.some((item) => item.plato || item.proteina || item.producto);
  }, [itemsPedidoOperativos]);

  const platosAgrupados = useMemo(
    () => agruparPlatosPorCategoria(menu.platos_detalle),
    [menu.platos_detalle]
  );

  const mensajeWhatsAppFinal = pedidoFinalizado ? crearMensajeWhatsAppPedido(pedidoFinalizado) : "";
  const whatsappRafikiDisponible = Boolean(limpiarTelefonoWhatsApp(WHATSAPP_RAFIKI));

  const linkWhatsAppFinal =
    pedidoFinalizado && whatsappRafikiDisponible
      ? crearLinkWhatsApp(WHATSAPP_RAFIKI, mensajeWhatsAppFinal)
      : "#";

  function actualizarItem(id, cambios) {
    setItemsPedido((actual) =>
      actual.map((item) => {
        if (item.id !== id) return item;

        const cambiosSeguros = { ...cambios };

        if (Object.prototype.hasOwnProperty.call(cambiosSeguros, "paraLlevar")) {
          cambiosSeguros.paraLlevar = !comerRestauranteCliente;
        }

        return { ...item, ...cambiosSeguros, paraLlevar: comerRestauranteCliente ? false : true };
      })
    );
  }

  function manejarComerRestauranteCliente(marcado, opciones = {}) {
    const comerEnRestaurante = Boolean(marcado);

    setComerRestauranteCliente(comerEnRestaurante);

    if (comerEnRestaurante) {
      setUbicacion("Comer en restaurante");
    } else if (!opciones?.preservarUbicacion) {
      setUbicacion("");
    }

    setItemsPedido((actual) =>
      normalizarItemsParaDestinoCliente(actual, { comerRestauranteCliente: comerEnRestaurante })
    );

    if (errorDatosPedido) setErrorDatosPedido("");
  }

  function cambiarPlatoItem(id, platoSeleccionado) {
    setItemsPedido((actual) =>
      actual.map((item) => {
        if (item.id !== id) return item;

        const sinAcompanantes = esProductoSinAcompanantes(platoSeleccionado);

        return {
          ...item,
          categoria: platoSeleccionado.categoria || "",
          plato: platoSeleccionado.nombre || "",
          proteina: platoSeleccionado.nombre || "",
          precioPlato: Number(platoSeleccionado.precio) || 0,
          precioProteina: Number(platoSeleccionado.precio) || 0,
          paraLlevar: !comerRestauranteCliente,
          acompanantes: sinAcompanantes ? [] : item.acompanantes || [],
          observacionAcompanantes: sinAcompanantes ? "" : item.observacionAcompanantes || ""
        };
      })
    );

    const sinAcompanantes = esProductoSinAcompanantes(platoSeleccionado);

    if (sinAcompanantes) {
      irAElemento(`paso-cantidad-${id}`);
    } else {
      irAElemento(`paso-acompanantes-${id}`);
    }
  }

  function agregarProductoCafeteriaCliente(producto) {
    if (!producto?.nombre) return;

    const nuevoItem = crearItemCafeteria({
      tipo: producto.categoria || "Cafetería",
      producto: producto.nombre,
      precio: Number(producto.precio) || 0,
      cantidad: 1,
      paraLlevar: !comerRestauranteCliente,
      catalogoId: producto.catalogoId || producto.id || null,
      detalle_impresion: producto.nombre
    });

    setItemsPedido((actual) => [...actual, nuevoItem]);
    mostrarMensaje(`${producto.nombre} agregado al pedido.`, "success");

    setTimeout(() => {
      const elemento = document.getElementById(`producto-${nuevoItem.id}`);
      if (elemento) {
        elemento.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 160);
  }

  function cambiarAcompananteItem(id, acompanante) {
    setItemsPedido((actual) =>
      actual.map((item) => {
        if (item.id !== id) return item;

        if (esProductoSinAcompanantes(item)) {
          return {
            ...item,
            acompanantes: []
          };
        }

        const acompanantesActuales = Array.isArray(item.acompanantes) ? item.acompanantes : [];
        const seleccionado = acompanantesActuales.includes(acompanante);

        if (seleccionado) {
          return {
            ...item,
            acompanantes: acompanantesActuales.filter((x) => x !== acompanante)
          };
        }

        if (acompanantesActuales.length >= MAX_ACOMPANANTES_CLIENTE) {
          mostrarMensaje(
            `Solo puedes escoger ${MAX_ACOMPANANTES_CLIENTE} acompañantes por producto. La sopa y la bebida ya están incluidas.`,
            "warning"
          );
          return item;
        }

        const nuevosAcompanantes = [...acompanantesActuales, acompanante];

        if (nuevosAcompanantes.length === MAX_ACOMPANANTES_CLIENTE) {
          irAElemento(`paso-cantidad-${id}`);
        }

        return {
          ...item,
          acompanantes: nuevosAcompanantes
        };
      })
    );
  }

  function agregarAlmuerzo() {
    const nuevoItem = crearItemClienteInicial({ comerRestaurante: comerRestauranteCliente });

    setItemsPedido((actual) => [...actual, nuevoItem]);

    setTimeout(() => {
      const elemento = document.getElementById(`producto-${nuevoItem.id}`);
      if (elemento) {
        elemento.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 160);
  }

  function eliminarAlmuerzo(id) {
    eliminarGrupoResumen([id]);
  }

  function actualizarCantidadGrupoResumen(ids = [], cantidad) {
    const idsGrupo = new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean));
    if (idsGrupo.size === 0) return;

    const cantidadNormalizada = normalizarCantidadResumen(cantidad);

    setItemsPedido((actual) => {
      let primerItemActualizado = false;
      const siguientesItems = [];

      actual.forEach((item) => {
        if (!idsGrupo.has(item.id)) {
          siguientesItems.push(item);
          return;
        }

        if (!primerItemActualizado) {
          siguientesItems.push({
            ...item,
            cantidad: cantidadNormalizada,
            paraLlevar: !comerRestauranteCliente
          });
          primerItemActualizado = true;
        }
      });

      return siguientesItems.length === 0
        ? [crearItemClienteInicial({ comerRestaurante: comerRestauranteCliente })]
        : siguientesItems;
    });
  }

  function eliminarGrupoResumen(ids = []) {
    const idsGrupo = new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean));
    if (idsGrupo.size === 0) return;

    setItemsPedido((actual) => {
      const restantes = actual.filter((item) => !idsGrupo.has(item.id));
      return restantes.length === 0
        ? [crearItemClienteInicial({ comerRestaurante: comerRestauranteCliente })]
        : restantes;
    });
  }

  function actualizarProteinaGrupoResumen(ids = [], platoSeleccionado = {}) {
    const idsGrupo = new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean));
    if (idsGrupo.size === 0 || !platoSeleccionado?.nombre) return;

    const sinAcompanantes = esProductoSinAcompanantes(platoSeleccionado);

    setItemsPedido((actual) =>
      actual.map((item) => {
        if (!idsGrupo.has(item.id)) return item;

        return {
          ...item,
          categoria: platoSeleccionado.categoria || "",
          plato: platoSeleccionado.nombre || "",
          proteina: platoSeleccionado.nombre || "",
          precioPlato: Number(platoSeleccionado.precio) || 0,
          precioProteina: Number(platoSeleccionado.precio) || 0,
          paraLlevar: !comerRestauranteCliente,
          acompanantes: sinAcompanantes ? [] : item.acompanantes || [],
          observacionAcompanantes: sinAcompanantes ? "" : item.observacionAcompanantes || ""
        };
      })
    );
  }

  function actualizarAcompanantesGrupoResumen(ids = [], cambios = {}) {
    const idsGrupo = new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean));
    if (idsGrupo.size === 0) return;

    const acompanantes = Array.isArray(cambios.acompanantes) ? cambios.acompanantes : [];
    const observacionAcompanantes = String(cambios.observacionAcompanantes || "")
      .trim()
      .slice(0, 60);

    setItemsPedido((actual) =>
      actual.map((item) => {
        if (!idsGrupo.has(item.id)) return item;
        if (esProductoSinAcompanantes(item))
          return { ...item, acompanantes: [], observacionAcompanantes: "" };

        return {
          ...item,
          acompanantes,
          observacionAcompanantes,
          paraLlevar: !comerRestauranteCliente
        };
      })
    );
  }

  function reiniciarPedido() {
    setItemsPedido([crearItemClienteInicial()]);
    setCliente("");
    setTelefono("");
    setUbicacion("");
    setComerRestauranteCliente(false);
    setClienteEspecialAplicado(null);
    setTipoPago("");
    setObservaciones("");
    setPedidoFinalizado(null);
    setErrorDatosPedido("");
    setMensaje({ texto: "", tipo: "info" });
    irAElemento("inicio-pedido-cliente");
  }

  const {
    guardandoPedido,
    guardandoEstadoPedidoId,
    eliminandoPedidoId,
    finalizandoPendientes,
    registrarPedido,
    registrarPedidoMesa,
    cambiarEstadoPedido,
    finalizarTodosPendientes,
    eliminarPedidoAdministrador,
    editarPedidoAdministrador,
    editarPedidoMesaAdministrador,
    cambiarFechaPedidoAdministrador,
    editandoPedidoId
  } = usePedidos({
    itemsPedido: itemsPedidoOperativos,
    cliente,
    telefono,
    ubicacion,
    comerRestauranteCliente,
    clienteEspecialAplicado,
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
    pedidoCoincideConFiltroActual
  });

  const abrirEditorPedidoEnMesas = useCallback(
    (pedido) => {
      if (!puedeEditarPedido) {
        mostrarMensaje("Tu rol no tiene permiso para editar pedidos.", "error");
        return;
      }

      setPedidoEditandoEnMesas(pedido || null);
      navegar("/mesas", "mesas");
      mostrarMensaje(
        `Modo edición activado para el pedido #${pedido?.numero_pedido || pedido?.id || ""}.`,
        "warning"
      );
    },
    [mostrarMensaje, navegar, puedeEditarPedido]
  );

  const cancelarEdicionPedidoEnMesas = useCallback(
    (opciones = {}) => {
      setPedidoEditandoEnMesas(null);
      if (opciones?.volverAdmin) {
        guardarAdminTabActiva("pedidos");
        setAdminTab("pedidos");
        navegar("/admin", "admin");
      }
    },
    [navegar]
  );

  function nuevoPedidoCliente() {
    reiniciarPedido();
    navegar("/cliente", "cliente");
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 80);
  }

  return (
    <>
      {modalConfirmacionRafiki}

      <Suspense fallback={<CargandoModulo texto="Cargando módulo..." />}>
        <div className={`app ${vista === "mesas" || vista === "mesasBeta" ? "mesas-pos-activo" : ""}`}>
          <div className="container">
            {vista !== "inicio" &&
              vista !== "admin" &&
              vista !== "adminLogin" &&
              vista !== "mesas" &&
              vista !== "mesasBeta" && (
                <header
                  className={`topbar ${vista === "cliente" || vista === "clienteBeta" || vista === "confirmacion" ? "cliente-topbar" : ""}`}
                >
                  <div>
                    <div className="brand">
                      {vista === "cliente" || vista === "clienteBeta" || vista === "confirmacion"
                        ? "Rafiki Pedidos"
                        : "🍽️ Rafiki Pedidos"}
                    </div>
                  </div>

                  {vista === "mesas" && (
                    <div className="nav nav-wrap">
                      <button
                        type="button"
                        onClick={() => navegar("/admin", adminAutenticado ? "admin" : "adminLogin")}
                      >
                        Admin
                      </button>
                      <button
                        type="button"
                        onClick={() => navegar("/pedidos", adminAutenticado ? "pedidos" : "adminLogin")}
                      >
                        Pedidos hoy
                      </button>
                      {puedeVerRafa && (
                        <button
                          type="button"
                          onClick={() => navegar("/gerencia", adminAutenticado ? "gerencia" : "adminLogin")}
                        >
                          Gerencia
                        </button>
                      )}
                    </div>
                  )}

                  {vista === "inventario" && (
                    <div className="nav nav-wrap">
                      <button
                        type="button"
                        onClick={() => navegar("/admin", adminAutenticado ? "admin" : "adminLogin")}
                      >
                        Admin
                      </button>
                      <button type="button" onClick={() => navegar("/mesas", "mesas")}>
                        Mesas
                      </button>
                      <button
                        type="button"
                        onClick={() => navegar("/pedidos", adminAutenticado ? "pedidos" : "adminLogin")}
                      >
                        Pedidos hoy
                      </button>
                      {puedeVerRafa && (
                        <button
                          type="button"
                          onClick={() => navegar("/gerencia", adminAutenticado ? "gerencia" : "adminLogin")}
                        >
                          Gerencia
                        </button>
                      )}
                    </div>
                  )}

                  {vista === "pedidos" && (
                    <div className="nav nav-wrap">
                      <button type="button" onClick={() => navegar("/mesas", "mesas")}>
                        Mesas
                      </button>
                      <button
                        type="button"
                        onClick={() => navegar("/admin", adminAutenticado ? "admin" : "adminLogin")}
                      >
                        Admin
                      </button>
                      {puedeVerRafa && (
                        <button
                          type="button"
                          onClick={() => navegar("/gerencia", adminAutenticado ? "gerencia" : "adminLogin")}
                        >
                          Gerencia
                        </button>
                      )}
                    </div>
                  )}
                </header>
              )}

            {mensaje.texto && <div className={`alert alert-${mensaje.tipo}`}>{mensaje.texto}</div>}
            {cargando && <div className="card card-pad">Verificando sesión administrativa...</div>}

            {!cargando && vista === "inicio" && <InicioRafiki navegar={navegar} />}

            {!cargando && vista === "inventario" && adminAutenticado && puedeVerInventario && (
              <ErrorBoundary
                nombreModulo="Inventario"
                onReset={() => setRecargaPedidos((actual) => actual + 1)}
              >
                <Suspense fallback={<CargandoModulo texto="Cargando inventario..." />}>
                  <InventarioAdmin />
                </Suspense>
              </ErrorBoundary>
            )}

            {!cargando && vista === "inventario" && adminAutenticado && !puedeVerInventario && (
              <section className="card card-pad">
                <h2>Acceso restringido</h2>
                <p className="muted">
                  El módulo de inventario solo está disponible para el rol administrador.
                </p>
                <button type="button" className="button" onClick={() => navegar("/admin", "admin")}>
                  Volver a Admin
                </button>
              </section>
            )}

            {!cargando && vista === "pedidos" && adminAutenticado && (
              <main className="admin-layout admin-layout-liviano">
                <ErrorBoundary
                  nombreModulo="Pedidos Hoy"
                  onReset={() => setRecargaPedidos((actual) => actual + 1)}
                >
                  <AdminPedidosSection
                    tituloPedidos={tituloPedidos}
                    setRecargaPedidos={setRecargaPedidos}
                    alertaPedidoNuevo={alertaPedidoNuevo}
                    setAlertaPedidoNuevo={setAlertaPedidoNuevo}
                    estadoRealtimePedidos={estadoRealtimePedidos}
                    realtimeAdminActivo={realtimeAdminActivo}
                    cambiarEstadoRealtimeAdmin={cambiarEstadoRealtimeAdmin}
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
                    resultadoNumeroPedido={resultadoNumeroPedido}
                    cargandoNumeroPedido={cargandoNumeroPedido}
                    errorNumeroPedido={errorNumeroPedido}
                    cargandoPedidos={cargandoPedidos}
                    errorCargaPedidos={errorCargaPedidos}
                    paginacionPedidos={paginacionPedidos}
                    cargarMasPedidos={cargarMasPedidos}
                    pedidosFiltrados={pedidosFiltrados}
                    pedidos={pedidos}
                    pedidosBorrados={pedidosBorrados}
                    pedidosPendientes={pedidosPendientes}
                    puedeFinalizarPendientes={puedeFinalizarPendientes}
                    finalizarTodosPendientes={finalizarTodosPendientes}
                    finalizandoPendientes={finalizandoPendientes}
                    cambiarEstadoPedido={cambiarEstadoPedido}
                    guardandoEstadoPedidoId={guardandoEstadoPedidoId}
                    puedeEliminarPedido={puedeEliminarPedido}
                    eliminarPedidoAdministrador={eliminarPedidoAdministrador}
                    eliminandoPedidoId={eliminandoPedidoId}
                    puedeEditarPedido={puedeEditarPedido}
                    editarPedidoAdministrador={editarPedidoAdministrador}
                    cambiarFechaPedidoAdministrador={cambiarFechaPedidoAdministrador}
                    onEditarPedidoEnMesas={abrirEditorPedidoEnMesas}
                    editandoPedidoId={editandoPedidoId}
                    pedidosFinalizados={pedidosFinalizados}
                    consolidado={consolidado}
                    pedidosActivos={pedidosActivos}
                  />
                </ErrorBoundary>
              </main>
            )}

            {!cargando && vista === "adminLogin" && (
              <AdminLogin
                adminEmail={adminEmail}
                adminPassword={adminPassword}
                errorClaveAdmin={errorClaveAdmin}
                setAdminEmail={setAdminEmail}
                setAdminPassword={setAdminPassword}
                setErrorClaveAdmin={setErrorClaveAdmin}
                validarClaveAdmin={validarClaveAdmin}
                navegar={navegar}
              />
            )}

            {!cargando && vista === "cliente" && (
              <>
                <PedidoCliente
                  menu={menu}
                  cargandoMenu={cargandoMenu}
                  itemsPedido={itemsPedidoOperativos}
                  itemsConProducto={itemsConProducto}
                  platosAgrupados={platosAgrupados}
                  hayProductoSeleccionado={hayProductoSeleccionado}
                  totalPedido={totalPedido}
                  cliente={cliente}
                  telefono={telefono}
                  ubicacion={ubicacion}
                  comerRestauranteCliente={comerRestauranteCliente}
                  tipoPago={tipoPago}
                  observaciones={observaciones}
                  errorDatosPedido={errorDatosPedido}
                  guardandoPedido={guardandoPedido}
                  clienteEspecialAplicado={clienteEspecialAplicado}
                  setClienteEspecialAplicado={setClienteEspecialAplicado}
                  agregarProductoCafeteriaCliente={agregarProductoCafeteriaCliente}
                  setCliente={setCliente}
                  setTelefono={setTelefono}
                  setUbicacion={setUbicacion}
                  setComerRestauranteCliente={manejarComerRestauranteCliente}
                  setTipoPago={setTipoPago}
                  setObservaciones={setObservaciones}
                  setErrorDatosPedido={setErrorDatosPedido}
                  cambiarPlatoItem={cambiarPlatoItem}
                  cambiarAcompananteItem={cambiarAcompananteItem}
                  actualizarItem={actualizarItem}
                  agregarAlmuerzo={agregarAlmuerzo}
                  eliminarAlmuerzo={eliminarAlmuerzo}
                  actualizarCantidadGrupoResumen={actualizarCantidadGrupoResumen}
                  eliminarGrupoResumen={eliminarGrupoResumen}
                  actualizarAcompanantesGrupoResumen={actualizarAcompanantesGrupoResumen}
                  actualizarProteinaGrupoResumen={actualizarProteinaGrupoResumen}
                  reiniciarPedido={reiniciarPedido}
                  irAElemento={irAElemento}
                  registrarPedido={registrarPedido}
                />
              </>
            )}

            {!cargando && vista === "clienteBeta" && (
              <ErrorBoundary
                nombreModulo="Cliente Beta"
                onReset={() => setRecargaMenu((actual) => actual + 1)}
              >
                <Suspense fallback={<CargandoModulo texto="Cargando cliente beta..." />}>
                  <PanelClienteBeta
                    menu={menu}
                    platosAgrupados={platosAgrupados}
                    cargandoMenu={cargandoMenu}
                    onSalirBeta={() => navegar("/cliente", "cliente")}
                  />
                </Suspense>
              </ErrorBoundary>
            )}

            {!cargando && vista === "confirmacion" && pedidoFinalizado && (
              <ConfirmacionPedidoCliente
                pedidoFinalizado={pedidoFinalizado}
                whatsappRafikiDisponible={whatsappRafikiDisponible}
                linkWhatsAppFinal={linkWhatsAppFinal}
                nuevoPedidoCliente={nuevoPedidoCliente}
              />
            )}

            {!cargando && vista === "mesas" && (
              <ErrorBoundary
                nombreModulo="Panel Mesas"
                usarRecuperacionPWA
                onReset={() => setRecargaMenu((actual) => actual + 1)}
              >
                <Suspense fallback={<CargandoModulo texto="Cargando panel mesas..." />}>
                  <PanelMesasPOS
                    menu={menu}
                    platosAgrupados={platosAgrupados}
                    cargandoMenu={cargandoMenu}
                    guardandoPedido={guardandoPedido}
                    onEnviar={registrarPedidoMesa}
                    pedidoEditando={pedidoEditandoEnMesas}
                    modoEdicionAdmin={Boolean(pedidoEditandoEnMesas)}
                    onGuardarEdicion={editarPedidoMesaAdministrador}
                    onCancelarEdicion={cancelarEdicionPedidoEnMesas}
                    navegacionAdminVisible={adminAutenticado}
                    puedeVerRafa={puedeVerRafa}
                    onIrAdmin={() => navegar("/admin", "admin")}
                    onIrPedidos={() => navegar("/pedidos", "pedidos")}
                    onIrGerencia={() => navegar("/gerencia", "gerencia")}
                  />
                </Suspense>
              </ErrorBoundary>
            )}

            {!cargando && vista === "mesasBeta" && (
              <ErrorBoundary
                nombreModulo="Panel Mesas Beta"
                onReset={() => setRecargaMenu((actual) => actual + 1)}
              >
                <Suspense fallback={<CargandoModulo texto="Cargando mesas beta..." />}>
                  <PanelMesasBeta
                    menu={menu}
                    platosAgrupados={platosAgrupados}
                    cargandoMenu={cargandoMenu}
                    onSalirBeta={() => navegar("/mesas", "mesas")}
                  />
                </Suspense>
              </ErrorBoundary>
            )}

            {!cargando && vista === "gerencia" && adminAutenticado && puedeVerRafa && (
              <ErrorBoundary
                nombreModulo="Gerencia"
                usarRecuperacionPWA
                onReset={() => setRecargaPedidos((actual) => actual + 1)}
              >
                <Suspense fallback={<CargandoModulo texto="Cargando gerencia..." />}>
                  <GerenciaPanel
                    adminUsuario={adminUsuario}
                    adminNombreRol={adminNombreRol}
                    puedeVerInformes={puedeVerRafa}
                    puedeVerCaja={puedeVerCaja}
                    puedeVerGastos={puedeVerGastos}
                    puedeVerInformeGastos={puedeVerInformeGastos}
                    puedeVerInventario={puedeVerInventario}
                    puedeVerCatalogo={puedeVerCatalogo}
                    cerrarPanelAdmin={cerrarPanelAdmin}
                    navegar={navegar}
                  />
                </Suspense>
              </ErrorBoundary>
            )}

            {!cargando && vista === "gerencia" && adminAutenticado && !puedeVerRafa && (
              <section className="card card-pad">
                <h2>Acceso restringido</h2>
                <p className="muted">Gerencia solo está disponible para el rol administrador.</p>
                <button type="button" className="button" onClick={() => navegar("/admin", "admin")}>
                  Volver a Admin
                </button>
              </section>
            )}

            {!cargando && vista === "admin" && adminAutenticado && (
              <main className="admin-layout">
                <AdminHeaderTabs
                  adminUsuario={adminUsuario}
                  adminNombreRol={adminNombreRol}
                  adminTab={adminTab}
                  setAdminTab={cambiarAdminTabSeguro}
                  puedeVerMenu={puedeVerMenu}
                  puedeVerProductos={puedeVerProductos}
                  puedeVerGenerador={puedeVerGenerador}
                  puedeVerRafa={puedeVerRafa}
                  puedeVerCatalogo={puedeVerCatalogo}
                  puedeVerInventario={puedeVerInventario}
                  puedeVerCaja={puedeVerCaja}
                  cerrarPanelAdmin={cerrarPanelAdmin}
                  navegar={navegar}
                />

                {cambiosPedidosPendientes && adminTab !== "pedidos" && (
                  <section className="card card-pad admin-realtime-pending" role="status">
                    <div>
                      <strong>🔔 Hay cambios en pedidos</strong>
                      <p className="muted small">
                        {mensajeCambiosPedidos ||
                          "Realtime detectó cambios, pero no interrumpió tu pestaña actual."}
                      </p>
                    </div>
                    <div className="admin-actions-stack horizontal">
                      <button type="button" className="button" onClick={irAPedidosYActualizar}>
                        Ir a Pedidos hoy
                      </button>
                      <button type="button" className="button light" onClick={descartarAvisoCambiosPedidos}>
                        Seguir aquí
                      </button>
                    </div>
                  </section>
                )}

                {adminTab === "pedidos" && (
                  <ErrorBoundary
                    nombreModulo="Pedidos Hoy"
                    onReset={() => setRecargaPedidos((actual) => actual + 1)}
                  >
                    <AdminPedidosSection
                      tituloPedidos={tituloPedidos}
                      setRecargaPedidos={setRecargaPedidos}
                      alertaPedidoNuevo={alertaPedidoNuevo}
                      setAlertaPedidoNuevo={setAlertaPedidoNuevo}
                      estadoRealtimePedidos={estadoRealtimePedidos}
                      realtimeAdminActivo={realtimeAdminActivo}
                      cambiarEstadoRealtimeAdmin={cambiarEstadoRealtimeAdmin}
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
                      resultadoNumeroPedido={resultadoNumeroPedido}
                      cargandoNumeroPedido={cargandoNumeroPedido}
                      errorNumeroPedido={errorNumeroPedido}
                      cargandoPedidos={cargandoPedidos}
                      errorCargaPedidos={errorCargaPedidos}
                      paginacionPedidos={paginacionPedidos}
                      cargarMasPedidos={cargarMasPedidos}
                      pedidosFiltrados={pedidosFiltrados}
                      pedidos={pedidos}
                      pedidosBorrados={pedidosBorrados}
                      pedidosPendientes={pedidosPendientes}
                      puedeFinalizarPendientes={puedeFinalizarPendientes}
                      finalizarTodosPendientes={finalizarTodosPendientes}
                      finalizandoPendientes={finalizandoPendientes}
                      cambiarEstadoPedido={cambiarEstadoPedido}
                      guardandoEstadoPedidoId={guardandoEstadoPedidoId}
                      puedeEliminarPedido={puedeEliminarPedido}
                      eliminarPedidoAdministrador={eliminarPedidoAdministrador}
                      eliminandoPedidoId={eliminandoPedidoId}
                      puedeEditarPedido={puedeEditarPedido}
                      editarPedidoAdministrador={editarPedidoAdministrador}
                      cambiarFechaPedidoAdministrador={cambiarFechaPedidoAdministrador}
                      onEditarPedidoEnMesas={abrirEditorPedidoEnMesas}
                      editandoPedidoId={editandoPedidoId}
                      pedidosFinalizados={pedidosFinalizados}
                      consolidado={consolidado}
                      pedidosActivos={pedidosActivos}
                    />
                  </ErrorBoundary>
                )}

                {adminTab === "productos" && puedeVerProductos && (
                  <ErrorBoundary nombreModulo="Solicitud de insumos" usarRecuperacionPWA>
                    <Suspense fallback={<CargandoModulo texto="Cargando solicitud de insumos..." />}>
                      <SolicitudProductos />
                    </Suspense>
                  </ErrorBoundary>
                )}

                {adminTab === "generador" && puedeVerGenerador && (
                  <ErrorBoundary nombreModulo="Generador de menú" usarRecuperacionPWA>
                    <Suspense fallback={<CargandoModulo texto="Cargando generador de menú..." />}>
                      <GeneradorMenu pestanaInicial="generador" />
                    </Suspense>
                  </ErrorBoundary>
                )}

                {adminTab === "historialMenu" && puedeVerGenerador && (
                  <ErrorBoundary nombreModulo="Historial de menú" usarRecuperacionPWA>
                    <Suspense fallback={<CargandoModulo texto="Cargando historial de menú..." />}>
                      <GeneradorMenu pestanaInicial="historial" />
                    </Suspense>
                  </ErrorBoundary>
                )}

                {adminTab === "catalogo" && puedeVerCatalogo && (
                  <ErrorBoundary nombreModulo="Catálogo" usarRecuperacionPWA>
                    <Suspense fallback={<CargandoModulo texto="Cargando catálogo..." />}>
                      <CatalogoRafa />
                    </Suspense>
                  </ErrorBoundary>
                )}
                {adminTab === "inventario" && puedeVerInventario && (
                  <ErrorBoundary
                    nombreModulo="Inventario"
                    onReset={() => setRecargaPedidos((actual) => actual + 1)}
                  >
                    <Suspense fallback={<CargandoModulo texto="Cargando inventario..." />}>
                      <InventarioAdmin />
                    </Suspense>
                  </ErrorBoundary>
                )}

                {adminTab === "caja" && puedeVerCaja && (
                  <ErrorBoundary
                    nombreModulo="Caja"
                    usarRecuperacionPWA
                    onReset={() => setRecargaPedidos((actual) => actual + 1)}
                  >
                    <Suspense fallback={<CargandoModulo texto="Cargando caja..." />}>
                      <CajaAdmin />
                    </Suspense>
                  </ErrorBoundary>
                )}

                {adminTab === "rafa" && puedeVerRafa && (
                  <ErrorBoundary
                    nombreModulo="Informes Rafa"
                    onReset={() => setRecargaPedidos((actual) => actual + 1)}
                  >
                    <Suspense fallback={<CargandoModulo texto="Cargando sección Rafa..." />}>
                      <PanelRafaPrivado />
                    </Suspense>
                  </ErrorBoundary>
                )}

                {adminTab === "menu" && puedeVerMenu && (
                  <ErrorBoundary
                    nombreModulo="Editor de menú diario"
                    onReset={() => setRecargaMenu((actual) => actual + 1)}
                  >
                    <MenuDiarioTab
                      menu={menu}
                      setMenu={setMenu}
                      platosTexto={platosTexto}
                      setPlatosTexto={setPlatosTexto}
                      acompanantesTexto={acompanantesTexto}
                      setAcompanantesTexto={setAcompanantesTexto}
                      traerTextoDesdeGeneradorMenu={traerTextoDesdeGeneradorMenu}
                      imprimirMenuDiarioTicket={imprimirMenuDiarioTicket}
                      guardarMenu={guardarMenu}
                      guardandoMenu={guardandoMenu}
                      mensajeMenu={mensajeMenu}
                    />
                  </ErrorBoundary>
                )}
              </main>
            )}
          </div>
        </div>
      </Suspense>
    </>
  );
}
