import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabaseClient";
import { crearLinkWhatsApp, fechaISOColombia, generarId, normalizarTexto } from "../../../shared/utils/pedidos";
import { BOTONES, CONFIRMACIONES_INSUMOS, MENSAJES_INSUMOS } from "../../../config/textos";
import CampoTexto from "./CampoTexto";
import { useAlertaRafiki, useConfirmacion } from "../../../shared/components/common";
import { CATEGORIA_SOLICITUD_DEFECTO, categoriasSolicitudProductos } from "../../../data/solicitudProductosData";
import {
  cargarCatalogoInsumosSolicitud,
  crearProductosSolicitudFallback,
  reconciliarCatalogoConSolicitudActual
} from "../../../services/catalogoService";
import {
  agruparProductosSolicitud,
  cargarEstadoPendientesCompra,
  crearMensajeCompraProveedores,
  crearMensajeSolicitudProductos,
  guardarEstadoPendientesCompra,
  obtenerHoraInsumosColombia,
  obtenerInsumosDeSolicitud,
  obtenerJornadaInsumos,
  obtenerProductosPendientesDesdeSolicitudes,
  obtenerProductosSolicitudSeleccionados,
  ordenarProductosPorNombre
} from "../../../shared/utils/solicitudProductos";
import { describirErrorSupabase, registrarErrorSupabase } from "../../../shared/utils/supabaseErrors";

const WHATSAPP_SOLICITUD_INSUMOS = import.meta.env.VITE_WHATSAPP_SOLICITUD_INSUMOS || "";
const SOLICITUD_INSUMOS_DRAFT_KEY = "rafikiSolicitudInsumosBorrador";

function tituloAlertaInsumos(tipo, contexto = "solicitud") {
  if (tipo === "error") return contexto === "pendientes" ? "Revisar insumos pendientes" : "Revisar solicitud";
  if (tipo === "warning" || tipo === "advertencia") return "Falta un paso";
  if (tipo === "success" || tipo === "exito") return "Acción realizada";
  return contexto === "pendientes" ? "Aviso de insumos pendientes" : "Aviso de solicitud";
}

function normalizarTipoAlerta(tipo) {
  if (tipo === "warning") return "advertencia";
  if (tipo === "success") return "exito";
  return tipo || "info";
}

function fechaAyerColombia() {
  const base = new Date(`${fechaISOColombia()}T00:00:00-05:00`);
  base.setDate(base.getDate() - 1);
  return fechaISOColombia(base);
}

function leerBorradorSolicitudInsumos() {
  if (typeof window === "undefined" || !window.localStorage) return null;

  try {
    const raw = window.localStorage.getItem(SOLICITUD_INSUMOS_DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    return data;
  } catch {
    return null;
  }
}

function borrarBorradorSolicitudInsumos() {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(SOLICITUD_INSUMOS_DRAFT_KEY);
  } catch {
    // No bloquea la operación si el navegador no permite limpiar el borrador.
  }
}

export default function SolicitudProductos() {
  const borradorInicial = leerBorradorSolicitudInsumos();
  const [confirmarRafiki, modalConfirmacionRafiki] = useConfirmacion();
  const [mostrarAlertaRafiki, modalAlertaRafiki] = useAlertaRafiki();
  const [productosSolicitud, setProductosSolicitud] = useState(() => Array.isArray(borradorInicial?.productosSolicitud) && borradorInicial.productosSolicitud.length ? borradorInicial.productosSolicitud : crearProductosSolicitudFallback());
  const [fechaParaSolicitud, setFechaParaSolicitud] = useState(() => borradorInicial?.fechaParaSolicitud || fechaISOColombia());
  const [observacionesSolicitud, setObservacionesSolicitud] = useState(() => borradorInicial?.observacionesSolicitud || "");
  const [mensajeSolicitud, setMensajeSolicitud] = useState({ texto: "", tipo: "info" });
  const [guardandoSolicitud, setGuardandoSolicitud] = useState(false);
  const [, setSolicitudFinalizada] = useState(null);
  const [nuevoProductoSolicitudNombre, setNuevoProductoSolicitudNombre] = useState(() => borradorInicial?.nuevoProductoSolicitudNombre || "");
  const [nuevoProductoSolicitudCategoria, setNuevoProductoSolicitudCategoria] = useState(() => borradorInicial?.nuevoProductoSolicitudCategoria || CATEGORIA_SOLICITUD_DEFECTO);
  const [productoSolicitudEliminarId, setProductoSolicitudEliminarId] = useState("");
  const [vistaSolicitud, setVistaSolicitud] = useState("solicitar");
  const [solicitudesGuardadas, setSolicitudesGuardadas] = useState([]);
  const [cargandoPendientes, setCargandoPendientes] = useState(false);
  const [estadoPendientesCompra, setEstadoPendientesCompra] = useState(cargarEstadoPendientesCompra);
  const [mensajePendientes, setMensajePendientes] = useState({ texto: "", tipo: "info" });
  const [fechaConsultaSolicitudes, setFechaConsultaSolicitudes] = useState(fechaISOColombia());
  const [, setYaExisteSolicitudHoy] = useState(false);
  const [catalogoInsumos, setCatalogoInsumos] = useState({
    cargando: true,
    fuente: "local",
    mensaje: "Cargando catálogo de insumos..."
  });


  useEffect(() => {
    let activo = true;

    async function cargarCatalogo() {
      const resultado = await cargarCatalogoInsumosSolicitud();
      if (!activo) return;

      setProductosSolicitud((actual) =>
        reconciliarCatalogoConSolicitudActual(resultado.productos, actual)
      );

      setCatalogoInsumos({
        cargando: false,
        fuente: resultado.fuente,
        mensaje: resultado.ok
          ? resultado.mensaje
          : `Usando lista local de respaldo. Motivo: ${resultado.mensaje}`
      });
    }

    cargarCatalogo();

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (!mensajeSolicitud.texto) return;
    const tipo = normalizarTipoAlerta(mensajeSolicitud.tipo);
    mostrarAlertaRafiki({
      tipo,
      titulo: tituloAlertaInsumos(tipo, "solicitud"),
      mensaje: mensajeSolicitud.texto
    });
  }, [mensajeSolicitud, mostrarAlertaRafiki]);

  useEffect(() => {
    if (!mensajePendientes.texto) return;
    const tipo = normalizarTipoAlerta(mensajePendientes.tipo);
    mostrarAlertaRafiki({
      tipo,
      titulo: tituloAlertaInsumos(tipo, "pendientes"),
      mensaje: mensajePendientes.texto
    });
  }, [mensajePendientes, mostrarAlertaRafiki]);

  const productosSolicitudSeleccionados = useMemo(
    () => obtenerProductosSolicitudSeleccionados(productosSolicitud),
    [productosSolicitud]
  );

  const productosSolicitudAgrupados = useMemo(
    () => agruparProductosSolicitud(productosSolicitud),
    [productosSolicitud]
  );

  const categoriasSolicitudDisponibles = useMemo(() => {
    const categorias = new Set(categoriasSolicitudProductos);
    productosSolicitud.forEach((producto) => {
      const categoria = String(producto?.categoria || "").trim();
      if (categoria) categorias.add(categoria);
    });
    return Array.from(categorias);
  }, [productosSolicitud]);

  const productosPendientesCompra = useMemo(() => {
    const pendientesBase = obtenerProductosPendientesDesdeSolicitudes(solicitudesGuardadas, fechaConsultaSolicitudes);

    return pendientesBase.map((producto) => ({
      ...producto,
      comprado: Boolean(estadoPendientesCompra[producto.id]?.comprado),
      cantidadComprar: estadoPendientesCompra[producto.id]?.cantidadComprar || ""
    }));
  }, [solicitudesGuardadas, estadoPendientesCompra, fechaConsultaSolicitudes]);

  const productosParaEnviarProveedor = useMemo(
    () => productosPendientesCompra.filter((producto) => !producto.comprado && estadoPendientesCompra[producto.id]?.enviarProveedor !== false),
    [productosPendientesCompra, estadoPendientesCompra]
  );

  const productosPendientesAgrupados = useMemo(
    () => agruparProductosSolicitud(productosPendientesCompra),
    [productosPendientesCompra]
  );

  const mensajeWhatsAppSolicitud = useMemo(
    () =>
      crearMensajeSolicitudProductos({
        fechaSolicitud: fechaISOColombia(),
        fechaPara: fechaParaSolicitud,
        productos: productosSolicitudSeleccionados,
        observaciones: observacionesSolicitud.trim()
      }),
    [fechaParaSolicitud, productosSolicitudSeleccionados, observacionesSolicitud]
  );

  useEffect(() => {
    guardarEstadoPendientesCompra(estadoPendientesCompra);
  }, [estadoPendientesCompra]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.localStorage) return;

    try {
      window.localStorage.setItem(
        SOLICITUD_INSUMOS_DRAFT_KEY,
        JSON.stringify({
          productosSolicitud,
          fechaParaSolicitud: fechaParaSolicitud || fechaISOColombia(),
          observacionesSolicitud,
          nuevoProductoSolicitudNombre,
          nuevoProductoSolicitudCategoria,
          actualizadoEn: new Date().toISOString()
        })
      );
    } catch {
      // El autoguardado no debe bloquear la solicitud de insumos.
    }
  }, [productosSolicitud, fechaParaSolicitud, observacionesSolicitud, nuevoProductoSolicitudNombre, nuevoProductoSolicitudCategoria]);

  useEffect(() => {
    verificarSolicitudDelDia();
  }, []);

  useEffect(() => {
    if (vistaSolicitud === "pendientes") {
      cargarSolicitudesPendientesCompra(fechaConsultaSolicitudes);
    }
  }, [vistaSolicitud, fechaConsultaSolicitudes]);

  async function verificarSolicitudDelDia() {
    // Ya no se bloquea toda la solicitud del día.
    // La validación se hace producto por producto al guardar.
    setYaExisteSolicitudHoy(false);
  }

  function obtenerProductosRepetidosDelDia(solicitudesDelDia, productosSeleccionados) {
    const productosYaSolicitados = new Set();

    (solicitudesDelDia || []).forEach((solicitud) => {
      const productos = obtenerInsumosDeSolicitud(solicitud);
      productos.forEach((producto) => {
        const nombre = normalizarTexto(producto?.nombre || "");
        if (nombre) productosYaSolicitados.add(nombre);
      });
    });

    return productosSeleccionados.filter((producto) =>
      productosYaSolicitados.has(normalizarTexto(producto.nombre))
    );
  }

  async function cargarSolicitudesPendientesCompra(fecha = fechaConsultaSolicitudes) {
    setCargandoPendientes(true);
    setMensajePendientes({ texto: "", tipo: "info" });

    try {
      const { data, error } = await supabase
        .from("solicitudes_insumos")
        .select("id, fecha_solicitud, fecha_para, insumos, observaciones, mensaje")
        .eq("fecha_solicitud", fecha)
        .order("id", { ascending: false })
        .limit(80);

      if (error) {
        registrarErrorSupabase("cargar solicitudes de insumos", error);
        setMensajePendientes({ texto: describirErrorSupabase(error, "cargar las solicitudes"), tipo: "error" });
        return;
      }

      setSolicitudesGuardadas(data || []);

      if (!data || data.length === 0) {
        setMensajePendientes({ texto: `No hay solicitudes guardadas para el día ${fecha}.`, tipo: "info" });
      }
    } catch (error) {
      registrarErrorSupabase("cargar pendientes de compra", error);
      setMensajePendientes({
        texto: describirErrorSupabase(error, "cargar pendientes de compra"),
        tipo: "error"
      });
    } finally {
      setCargandoPendientes(false);
    }
  }

  function actualizarPendienteCompra(id, cambios) {
    setEstadoPendientesCompra((actual) => ({
      ...actual,
      [id]: {
        ...(actual[id] || {}),
        ...cambios
      }
    }));
    setMensajePendientes({ texto: "", tipo: "info" });
  }

  function enviarListadoProveedores() {
    if (productosParaEnviarProveedor.length === 0) {
      setMensajePendientes({ texto: MENSAJES_INSUMOS.SIN_INSUMOS_PARA_ENVIAR, tipo: "warning" });
      return;
    }

    const mensaje = crearMensajeCompraProveedores(productosParaEnviarProveedor, fechaConsultaSolicitudes);
    const link = crearLinkWhatsApp(WHATSAPP_SOLICITUD_INSUMOS, mensaje, { abrirApp: true });
    setMensajePendientes({ texto: MENSAJES_INSUMOS.ABRIR_WHATSAPP_PROVEEDORES, tipo: "success" });
    window.location.href = link;
  }

  async function limpiarCompradosPendientes() {
    const confirmar = await confirmarRafiki({
      tipo: "advertencia",
      titulo: "Reiniciar lista de compras",
      mensaje: CONFIRMACIONES_INSUMOS.limpiarComprados,
      textoConfirmar: "Sí, reiniciar",
    });
    if (!confirmar) return;
    setEstadoPendientesCompra({});
    setMensajePendientes({ texto: MENSAJES_INSUMOS.LISTA_COMPRAS_REINICIADA, tipo: "success" });
  }

  async function borrarSolicitudesDelDia() {
    const fecha = fechaConsultaSolicitudes || fechaISOColombia();
    const confirmar = await confirmarRafiki({
      tipo: "eliminar",
      titulo: `Borrar solicitudes del ${fecha}`,
      mensaje: CONFIRMACIONES_INSUMOS.borrarSolicitudesDia(fecha),
      textoConfirmar: "Sí, borrar",
    });

    if (!confirmar) return;

    setCargandoPendientes(true);
    setMensajePendientes({ texto: MENSAJES_INSUMOS.BORRANDO_SOLICITUDES_DIA, tipo: "info" });

    try {
      const { error } = await supabase
        .from("solicitudes_insumos")
        .delete()
        .eq("fecha_solicitud", fecha);

      if (error) {
        registrarErrorSupabase("borrar solicitudes de insumos", error);
        setMensajePendientes({ texto: describirErrorSupabase(error, "borrar las solicitudes"), tipo: "error" });
        return;
      }

      setSolicitudesGuardadas([]);

      setEstadoPendientesCompra((actual) => {
        const nuevoEstado = { ...actual };
        Object.keys(nuevoEstado).forEach((clave) => {
          if (clave.startsWith(`${fecha}-`)) {
            delete nuevoEstado[clave];
          }
        });
        return nuevoEstado;
      });

      if (fecha === fechaISOColombia()) {
        setYaExisteSolicitudHoy(false);
      }

      setMensajePendientes({ texto: `Solicitudes del día ${fecha} borradas correctamente.`, tipo: "success" });
    } catch (error) {
      registrarErrorSupabase("borrar solicitudes de insumos", error);
      setMensajePendientes({
        texto: describirErrorSupabase(error, "borrar las solicitudes"),
        tipo: "error"
      });
    } finally {
      setCargandoPendientes(false);
    }
  }

  function alternarProductoSolicitud(id) {
    setProductosSolicitud((actual) =>
      actual.map((producto) => {
        if (producto.id !== id) return producto;

        const seleccionado = Boolean(producto.seleccionada);

        return {
          ...producto,
          seleccionada: !seleccionado,
          cantidad: seleccionado ? "" : producto.cantidad || "",
          nota: seleccionado ? "" : producto.nota
        };
      })
    );
    setMensajeSolicitud({ texto: "", tipo: "info" });
    setSolicitudFinalizada(null);
  }

  function agregarProductoSolicitudALista() {
    const nombre = nuevoProductoSolicitudNombre.trim();
    const categoria = nuevoProductoSolicitudCategoria.trim() || CATEGORIA_SOLICITUD_DEFECTO;

    if (!nombre) {
      setMensajeSolicitud({ texto: "Escribe el nombre del insumo que quieres agregar.", tipo: "warning" });
      return;
    }

    const yaExiste = productosSolicitud.some(
      (producto) => normalizarTexto(producto.nombre) === normalizarTexto(nombre)
    );

    if (yaExiste) {
      setMensajeSolicitud({ texto: "Ese insumo ya está en la lista.", tipo: "warning" });
      return;
    }

    const nuevoProducto = {
      id: generarId("insumo"),
      categoria,
      nombre,
      cantidad: "",
      unidad: "und",
      nota: "",
      seleccionada: true
    };

    setProductosSolicitud((actual) => [...actual, nuevoProducto]);
    setProductoSolicitudEliminarId(nuevoProducto.id);
    setNuevoProductoSolicitudNombre("");
    setNuevoProductoSolicitudCategoria(categoria);
    setSolicitudFinalizada(null);
    setMensajeSolicitud({ texto: "Insumo agregado a la lista.", tipo: "success" });
  }

  async function quitarProductoSolicitudDeLista(id) {
    if (!id) {
      setMensajeSolicitud({ texto: "Selecciona el insumo que quieres eliminar de la lista.", tipo: "warning" });
      return;
    }

    const producto = productosSolicitud.find((item) => item.id === id);
    const nombre = producto?.nombre || "este insumo";
    const confirmar = await confirmarRafiki({
      tipo: "eliminar",
      titulo: "Eliminar insumo",
      mensaje: CONFIRMACIONES_INSUMOS.eliminarProductoLista(nombre),
      textoConfirmar: "Sí, eliminar",
    });

    if (!confirmar) return;

    setProductosSolicitud((actual) => actual.filter((item) => item.id !== id));
    setProductoSolicitudEliminarId("");
    setSolicitudFinalizada(null);
    setMensajeSolicitud({ texto: "Insumo eliminado de la lista principal.", tipo: "info" });
  }

  function construirSolicitudProductos() {
    const fechaCreacion = new Date();
    const jornadaSolicitud = obtenerJornadaInsumos(fechaCreacion);
    const horaSolicitud = obtenerHoraInsumosColombia(fechaCreacion);
    const productos = obtenerProductosSolicitudSeleccionados(productosSolicitud).map((producto) => ({
      ...producto,
      jornadaSolicitud,
      horaSolicitud
    }));

    if (productos.length === 0) {
      return {
        error: "Selecciona al menos un insumo para guardar la solicitud."
      };
    }

    const fechaSolicitud = fechaISOColombia();
    const mensajeFinal = crearMensajeSolicitudProductos({
      fechaSolicitud,
      fechaPara: fechaParaSolicitud,
      productos,
      observaciones: observacionesSolicitud.trim()
    });

    const nuevaSolicitud = {
      fecha_solicitud: fechaSolicitud,
      fecha_para: fechaParaSolicitud,
      insumos: productos,
      observaciones: observacionesSolicitud.trim(),
      mensaje: mensajeFinal
    };

    return { nuevaSolicitud, mensajeFinal };
  }

  async function guardarSolicitudProductos({ abrirWhatsApp = false } = {}) {
    if (guardandoSolicitud) return;

    const { nuevaSolicitud, mensajeFinal, error: errorValidacion } = construirSolicitudProductos();

    if (errorValidacion) {
      setMensajeSolicitud({ texto: errorValidacion, tipo: "warning" });
      return;
    }

    setGuardandoSolicitud(true);

    try {
      const hoy = fechaISOColombia();
      const { data: solicitudesHoy, error: errorConsultaHoy } = await supabase
        .from("solicitudes_insumos")
        .select("id, insumos")
        .eq("fecha_solicitud", hoy)
        .order("id", { ascending: false })
        .limit(200);

      if (errorConsultaHoy) {
        registrarErrorSupabase("validar insumos repetidos", errorConsultaHoy);
        setMensajeSolicitud({ texto: describirErrorSupabase(errorConsultaHoy, "validar los insumos repetidos de hoy"), tipo: "error" });
        return;
      }

      const productosRepetidos = obtenerProductosRepetidosDelDia(solicitudesHoy || [], nuevaSolicitud.insumos);

      if (productosRepetidos.length > 0) {
        const nombresRepetidos = productosRepetidos.map((producto) => producto.nombre).join(", ");
        setMensajeSolicitud({
          texto: `Estos insumos ya fueron solicitados hoy y no se pueden repetir: ${nombresRepetidos}. Puedes quitar esos insumos y guardar los demás.`,
          tipo: "warning"
        });
        return;
      }

      const { data, error } = await supabase
        .from("solicitudes_insumos")
        .insert(nuevaSolicitud)
        .select("id, fecha_solicitud, fecha_para, insumos, observaciones, mensaje")
        .single();

      if (error) {
        registrarErrorSupabase("guardar solicitud de insumos", error);
        setMensajeSolicitud({ texto: describirErrorSupabase(error, "guardar la solicitud"), tipo: "error" });
        return;
      }

      const solicitudGuardada = data || nuevaSolicitud;
      setSolicitudFinalizada(solicitudGuardada);
      setSolicitudesGuardadas((actual) => [solicitudGuardada, ...actual]);
      setYaExisteSolicitudHoy(false);

      borrarBorradorSolicitudInsumos();

      if (abrirWhatsApp) {
        const link = crearLinkWhatsApp(
          WHATSAPP_SOLICITUD_INSUMOS,
          solicitudGuardada.mensaje || mensajeFinal,
          { abrirApp: true }
        );

        setMensajeSolicitud({
          texto: MENSAJES_INSUMOS.SOLICITUD_GUARDADA_WHATSAPP,
          tipo: "success"
        });

        window.location.href = link;
      } else {
        setMensajeSolicitud({
          texto: MENSAJES_INSUMOS.SOLICITUD_GUARDADA,
          tipo: "success"
        });
      }
    } catch (error) {
      registrarErrorSupabase("guardar solicitud de insumos", error);
      setMensajeSolicitud({
        texto: describirErrorSupabase(error, "guardar la solicitud"),
        tipo: "error"
      });
    } finally {
      setGuardandoSolicitud(false);
    }
  }

  function limpiarSolicitudProductos() {
    setProductosSolicitud((actual) =>
      actual.map((producto) => ({
        ...producto,
        cantidad: "",
        nota: "",
        seleccionada: false
      }))
    );
    setFechaParaSolicitud(fechaISOColombia());
    setObservacionesSolicitud("");
    setNuevoProductoSolicitudNombre("");
    setNuevoProductoSolicitudCategoria(CATEGORIA_SOLICITUD_DEFECTO);
    setProductoSolicitudEliminarId("");
    setMensajeSolicitud({ texto: "", tipo: "info" });
    setSolicitudFinalizada(null);
    borrarBorradorSolicitudInsumos();
  }

  return (
    <>
      {modalConfirmacionRafiki}
      {modalAlertaRafiki}
      <section className="card card-pad">
      <div className="admin-top-row">
        <div>
          <h2>🧺 Solicitud de insumos</h2>
          <p className="muted small">Selecciona insumos o revisa el consolidado pendiente para comprar.</p>
        </div>
      </div>

      <div className="admin-tabs" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={vistaSolicitud === "solicitar" ? "active" : ""}
          onClick={() => setVistaSolicitud("solicitar")}
        >
          Solicitar insumos
        </button>
        <button
          type="button"
          className={vistaSolicitud === "pendientes" ? "active" : ""}
          onClick={() => setVistaSolicitud("pendientes")}
        >
          Insumos pendientes
        </button>
      </div>

      {vistaSolicitud === "solicitar" && (
        <>
                      <div className="admin-top-row">
                        <div>
                          <h2>🧺 Solicitud de insumos</h2>
                        </div>

                        <button type="button" onClick={limpiarSolicitudProductos} className="button light">
                          Limpiar
                        </button>
                      </div>

                      <div className="grid-2">
                        <CampoTexto
                          etiqueta="Fecha para la que se necesitan"
                          type="date"
                          value={fechaParaSolicitud}
                          onChange={(valor) => {
                            setFechaParaSolicitud(valor);
                            setSolicitudFinalizada(null);
                            setMensajeSolicitud({ texto: "", tipo: "info" });
                          }}
                        />

                        <div className="box soft">
                          <strong>{productosSolicitudSeleccionados.length} insumos seleccionados</strong>
                        </div>
                      </div>

                      <div className="alert alert-info">
                        Puedes hacer varias solicitudes en el día, siempre que no repitas el mismo insumo.
                        <br />
                        <span className="small">
                          {catalogoInsumos.cargando
                            ? "Cargando catálogo..."
                            : catalogoInsumos.fuente === "bd"
                              ? "Catálogo conectado a Supabase."
                              : "Catálogo local de respaldo activo."}
                        </span>
                      </div>

                      {mensajeSolicitud.texto && (
                        <div className={`alert alert-${mensajeSolicitud.tipo}`}>
                          {mensajeSolicitud.texto}
                        </div>
                      )}

                      {Object.entries(productosSolicitudAgrupados).map(([categoria, productos]) => (
                        <div key={categoria} className="category-block">
                          <h3 className="category-title">{categoria}</h3>

                          <div className="productos-chips">
                            {productos.map((producto) => {
                              const seleccionado = Boolean(producto.seleccionada);

                              return (
                                <span key={producto.id} className="producto-chip-wrap">
                                  <button
                                    type="button"
                                    onClick={() => alternarProductoSolicitud(producto.id)}
                                    className={`producto-chip ${seleccionado ? "selected" : ""}`}
                                  >
                                    {seleccionado ? "✓ " : "+ "}
                                    {producto.nombre}
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {productosSolicitudSeleccionados.length > 0 && (
                        <div className="box soft">
                          <strong>Insumos seleccionados:</strong>
                          <p className="muted small" style={{ marginTop: 6, marginBottom: 0 }}>
                            {productosSolicitudSeleccionados.map((producto) => producto.nombre).join(", ")}
                          </p>
                        </div>
                      )}

                      <CampoTexto
                        etiqueta="Observaciones generales"
                        value={observacionesSolicitud}
                        onChange={(valor) => {
                          setObservacionesSolicitud(valor);
                          setSolicitudFinalizada(null);
                          setMensajeSolicitud({ texto: "", tipo: "info" });
                        }}
                        placeholder="Ej: comprar temprano, revisar calidad, priorizar verduras frescas..."
                        multiline
                        rows={2}
                      />

                      {productosSolicitudSeleccionados.length > 0 && (
                        <div className="box soft">
                          <strong>Vista previa del mensaje</strong>
                          <div className="solicitud-preview">{mensajeWhatsAppSolicitud}</div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => guardarSolicitudProductos({ abrirWhatsApp: true })}
                        disabled={guardandoSolicitud}
                        className="button green"
                        style={{ width: "100%", marginTop: 14 }}
                      >
                        {guardandoSolicitud ? BOTONES.GUARDANDO_SOLICITUD : BOTONES.GUARDAR_ENVIAR_WHATSAPP}
                      </button>

                      <div className="box soft" style={{ marginTop: 18 }}>
                        <strong>Agregar insumo a la lista</strong>
                        <div className="producto-add-row">
                          <input
                            type="text"
                            value={nuevoProductoSolicitudNombre}
                            onChange={(e) => setNuevoProductoSolicitudNombre(e.target.value)}
                            placeholder="Ej: Maíz tierno"
                          />

                          <select
                            value={nuevoProductoSolicitudCategoria}
                            onChange={(e) => setNuevoProductoSolicitudCategoria(e.target.value)}
                          >
                            {categoriasSolicitudDisponibles.map((categoria) => (
                              <option key={categoria} value={categoria}>
                                {categoria}
                              </option>
                            ))}
                          </select>

                          <button type="button" className="button green" onClick={agregarProductoSolicitudALista}>
                            Agregar
                          </button>
                        </div>
                      </div>

                      <div className="box soft" style={{ marginTop: 12 }}>
                        <strong>Eliminar insumo de la lista</strong>
                        <p className="muted small" style={{ marginBottom: 8 }}>
                          Esta opción es solo para administrar el listado principal.
                        </p>
                        <div className="producto-delete-row">
                          <select
                            value={productoSolicitudEliminarId}
                            onChange={(e) => setProductoSolicitudEliminarId(e.target.value)}
                          >
                            <option value="">Selecciona un insumo</option>
                            {ordenarProductosPorNombre(productosSolicitud).map((producto) => (
                              <option key={producto.id} value={producto.id}>
                                {producto.categoria} - {producto.nombre}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            className="button danger"
                            onClick={() => quitarProductoSolicitudDeLista(productoSolicitudEliminarId)}
                          >
                            Eliminar de la lista
                          </button>
                        </div>
                      </div>
        </>
      )}

      {vistaSolicitud === "pendientes" && (
        <div>
          <div className="admin-top-row">
            <div>
              <h2>🛒 Insumos pendientes</h2>
              <p className="muted small">
                Aquí solo verás los insumos solicitados. La cantidad a comprar la defines tú.
              </p>
            </div>

            <div className="actions-inline">
              <button
                type="button"
                onClick={() => {
                  const ayer = fechaAyerColombia();
                  setFechaConsultaSolicitudes(ayer);
                  setMensajePendientes({ texto: "", tipo: "info" });
                }}
                className="button light"
                disabled={cargandoPendientes}
              >
                Ayer
              </button>
              <button type="button" onClick={() => cargarSolicitudesPendientesCompra(fechaConsultaSolicitudes)} className="button light" disabled={cargandoPendientes}>
                {cargandoPendientes ? "Cargando..." : "Actualizar"}
              </button>
              <button type="button" onClick={limpiarCompradosPendientes} className="button light">
                Reiniciar marcas
              </button>
              <button
                type="button"
                onClick={borrarSolicitudesDelDia}
                className="button danger"
                disabled={cargandoPendientes}
              >
                Borrar solicitudes del día
              </button>
            </div>
          </div>

          <div className="box soft" style={{ marginBottom: 12 }}>
            <CampoTexto
              etiqueta="Ver solicitudes del día"
              type="date"
              value={fechaConsultaSolicitudes}
              onChange={(valor) => {
                setFechaConsultaSolicitudes(valor || fechaISOColombia());
                setMensajePendientes({ texto: "", tipo: "info" });
              }}
            />
            <p className="muted small" style={{ marginTop: 6 }}>
              Cambia la fecha para consultar solicitudes anteriores y consolidar solo ese día.
            </p>
          </div>

          {mensajePendientes.texto && (
            <div className={`alert alert-${mensajePendientes.tipo}`}>
              {mensajePendientes.texto}
            </div>
          )}

          <div className="box soft" style={{ marginBottom: 12 }}>
            <strong>{productosParaEnviarProveedor.length} insumos seleccionados para enviar del día {fechaConsultaSolicitudes}</strong>
            <p className="muted small" style={{ marginTop: 6 }}>
              Marca la columna Enviar para escoger qué insumos van por WhatsApp. Los insumos comprados no se envían.
            </p>
            {productosPendientesCompra.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <button
                  type="button"
                  className="button secondary"
                  style={{ padding: "8px 10px", fontSize: 12 }}
                  onClick={() => {
                    productosPendientesCompra.forEach((producto) => {
                      if (!producto.comprado) actualizarPendienteCompra(producto.id, { enviarProveedor: true });
                    });
                  }}
                >
                  Seleccionar todos
                </button>
                <button
                  type="button"
                  className="button secondary"
                  style={{ padding: "8px 10px", fontSize: 12 }}
                  onClick={() => {
                    productosPendientesCompra.forEach((producto) => {
                      if (!producto.comprado) actualizarPendienteCompra(producto.id, { enviarProveedor: false });
                    });
                  }}
                >
                  Quitar selección
                </button>
              </div>
            )}
          </div>

          {productosPendientesCompra.length === 0 ? (
            <div className="box soft">
              {cargandoPendientes ? "Cargando solicitudes..." : "No hay insumos pendientes por ahora."}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {Object.entries(productosPendientesAgrupados).map(([categoria, productos]) => (
                <div key={categoria} className="box soft insumos-pendientes-card">
                  <div className="insumos-pendientes-card-header">
                    <h3 className="category-title">{categoria}</h3>
                    <span className="muted small">{productos.length} insumo{productos.length === 1 ? "" : "s"}</span>
                  </div>

                  <div className="insumos-pendientes-lista">
                    {productos.map((producto) => (
                      <div
                        key={producto.id}
                        className={`insumo-pendiente-row${producto.comprado ? " insumo-pendiente-row-comprado" : ""}`}
                      >
                        <label
                          className={`insumo-pendiente-check${
                            producto.comprado || estadoPendientesCompra[producto.id]?.enviarProveedor === false
                              ? " insumo-pendiente-check-off"
                              : " insumo-pendiente-check-on"
                          }`}
                          title={producto.comprado ? "Comprado: no se envía" : "Enviar por WhatsApp"}
                        >
                          <input
                            type="checkbox"
                            checked={!producto.comprado && estadoPendientesCompra[producto.id]?.enviarProveedor !== false}
                            disabled={producto.comprado}
                            onChange={(e) => actualizarPendienteCompra(producto.id, { enviarProveedor: e.target.checked })}
                            aria-label={`Enviar ${producto.nombre} por WhatsApp`}
                          />
                        </label>

                        <strong
                          className="insumo-pendiente-nombre"
                          title={producto.nombre}
                        >
                          {producto.nombre}
                        </strong>

                        <span
                          className={`insumo-jornada-badge${producto.jornadaSolicitud ? "" : " insumo-jornada-badge-empty"}`}
                          title={producto.jornadaSolicitud ? `Solicitud realizada en jornada ${producto.jornadaSolicitud}` : "Jornada no disponible para esta solicitud"}
                        >
                          {producto.jornadaSolicitud || "—"}
                        </span>

                        <input
                          className="insumo-pendiente-cantidad"
                          type="text"
                          value={producto.cantidadComprar}
                          onChange={(e) => actualizarPendienteCompra(producto.id, { cantidadComprar: e.target.value })}
                          placeholder="Cant."
                          disabled={producto.comprado}
                        />

                        <label
                          className={`insumo-pendiente-check${producto.comprado ? " insumo-pendiente-check-on" : " insumo-pendiente-check-off"}`}
                          title={producto.comprado ? "Comprado" : "Marcar comprado"}
                        >
                          <input
                            type="checkbox"
                            checked={producto.comprado}
                            onChange={(e) => actualizarPendienteCompra(producto.id, { comprado: e.target.checked })}
                            aria-label={`Marcar ${producto.nombre} como comprado`}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={enviarListadoProveedores}
            className="button green"
            style={{ width: "100%", marginTop: 14 }}
            disabled={productosParaEnviarProveedor.length === 0}
          >
            {BOTONES.ENVIAR_SELECCIONADOS_WHATSAPP}
          </button>
        </div>
      )}
      </section>
    </>
  );
}
