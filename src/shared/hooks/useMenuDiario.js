import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigMensaje, supabaseConfigOk } from "../../supabaseClient";
import { conTiempoMaximo } from "../utils/async";
import { guardarMenuCache, hayMenuCacheValido, leerMenuCache } from "../utils/menuCache";
import { leerUltimoTextoEditorGenerador } from "../utils/generadorMenu";
import { describirErrorSupabase, esErrorEsquemaSupabase, registrarErrorSupabase } from "../utils/supabaseErrors";
import {
  acompanantesATexto,
  crearItemNuevo,
  dinero,
  fechaISOColombia,
  limpiarAcompanantesMenu,
  listaPorLineas,
  normalizarMenu,
  platosATexto,
  textoAPlatosDetalle
} from "../utils/pedidos";

const MENU_EDITOR_DRAFT_KEY = "rafikiMenuDiarioEditorBorrador";

function menuConFechaActual(menuBase) {
  return {
    ...menuBase,
    fecha: fechaISOColombia()
  };
}

function borrarBorradorEditorMenuDiario() {
  try {
    window.localStorage.removeItem(MENU_EDITOR_DRAFT_KEY);
  } catch {
    // No bloquear si el navegador no permite limpiar localStorage.
  }
}

function crearPayloadsMenuDiario(menuActualizado) {
  const payloadCompleto = {
    ...menuActualizado,
    proteinas_detalle: menuActualizado.proteinas_detalle,
    platos_detalle: menuActualizado.platos_detalle
  };

  const payloadCompatible = {
    fecha: menuActualizado.fecha,
    titulo: menuActualizado.titulo,
    descripcion: menuActualizado.descripcion,
    precio: menuActualizado.precio,
    proteinas: menuActualizado.proteinas,
    acompanantes: menuActualizado.acompanantes,
    activo: menuActualizado.activo
  };

  const payloadMinimo = {
    fecha: menuActualizado.fecha,
    precio: menuActualizado.precio,
    proteinas: menuActualizado.proteinas,
    acompanantes: menuActualizado.acompanantes,
    activo: menuActualizado.activo
  };

  return [payloadCompleto, payloadCompatible, payloadMinimo];
}

function esErrorColumnasSupabase(error) {
  return esErrorEsquemaSupabase(error, [
    "platos_detalle",
    "proteinas_detalle",
    "titulo",
    "descripcion"
  ]);
}

async function ejecutarGuardadoMenuConFallback({ eraEdicion, id, payloads }) {
  const errores = [];

  for (const payload of payloads) {
    try {
      const consulta = eraEdicion
        ? supabase.from("menu_diario").update(payload).eq("id", id)
        : supabase.from("menu_diario").insert(payload);

      const respuesta = await conTiempoMaximo(
        consulta,
        12000,
        eraEdicion ? "La actualización del menú diario" : "La creación del menú diario"
      );

      if (!respuesta.error) {
        return { payloadUsado: payload };
      }

      errores.push(respuesta.error);

      if (!esErrorColumnasSupabase(respuesta.error)) {
        break;
      }
    } catch (error) {
      errores.push(error);

      if (!esErrorColumnasSupabase(error)) {
        break;
      }
    }
  }

  const ultimoError = errores[errores.length - 1];
  throw ultimoError || new Error("Supabase no aceptó el guardado del menú diario.");
}

export function useMenuDiario({
  adminTab,
  instanciaRealtimeRef,
  irAElemento,
  mostrarMensaje,
  mostrarMensajeMenu,
  setItemsPedido,
  setMensajeMenu
}) {
  const menuCacheDisponibleRef = useRef(hayMenuCacheValido());
  const borradorEditorMenuRestauradoRef = useRef(false);
  const menuHashRef = useRef("");
  const adminTabRef = useRef(adminTab);

  const [menu, setMenu] = useState(() => leerMenuCache());
  const [cargandoMenu, setCargandoMenu] = useState(() => !menuCacheDisponibleRef.current);
  const [guardandoMenu, setGuardandoMenu] = useState(false);
  const [recargaMenu, setRecargaMenu] = useState(0);
  const [platosTexto, setPlatosTexto] = useState("");
  const [acompanantesTexto, setAcompanantesTexto] = useState("");

  useEffect(() => {
    adminTabRef.current = adminTab;
  }, [adminTab]);

  useEffect(() => {
    if (adminTab !== "menu" || borradorEditorMenuRestauradoRef.current) return;

    // El Editor de menú diario debe usar Supabase como fuente principal.
    // Evitamos restaurar borradores viejos del navegador porque en computadores
    // compartidos pueden mostrar menús antiguos mientras el celular ya ve el menú actual.
    borrarBorradorEditorMenuDiario();
    borradorEditorMenuRestauradoRef.current = true;
    setRecargaMenu((actual) => actual + 1);
  }, [adminTab]);

  useEffect(() => {
    if (adminTab !== "menu") return undefined;

    // No persistimos borrador local del editor para evitar que otro navegador
    // muestre menús viejos. Lo guardado en Supabase siempre manda.
    borrarBorradorEditorMenuDiario();
    return undefined;
  }, [adminTab, menu.fecha, menu.titulo, menu.descripcion, platosTexto, acompanantesTexto]);

  useEffect(() => {
    let cancelado = false;

    async function cargarMenuSeguro() {
      const hayCache = menuCacheDisponibleRef.current;
      setCargandoMenu(!hayCache);

      if (!supabaseConfigOk) {
        setCargandoMenu(false);
        mostrarMensaje(supabaseConfigMensaje, "error");
        return;
      }

      try {
        const fechaActualMenu = fechaISOColombia();
        let { data: menuData, error: menuError } = await conTiempoMaximo(
          supabase
            .from("menu_diario")
            .select("id, fecha, titulo, descripcion, platos_detalle, acompanantes, activo")
            .eq("activo", true)
            .eq("fecha", fechaActualMenu)
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle(),
          7000,
          "La carga del menú actual"
        );

        if (cancelado) return;

        if (menuError) {
          registrarErrorSupabase("cargar menú diario", menuError);
          mostrarMensaje(describirErrorSupabase(menuError, "cargar el menú diario"), "error");
          return;
        }

        if (menuData) {
          const menuNormalizado = normalizarMenu(menuData);
          const nuevoHash = JSON.stringify({
            id: menuNormalizado.id,
            fecha: menuNormalizado.fecha,
            titulo: menuNormalizado.titulo,
            descripcion: menuNormalizado.descripcion,
            platos_detalle: menuNormalizado.platos_detalle,
            acompanantes: menuNormalizado.acompanantes
          });

          if (menuHashRef.current !== nuevoHash) {
            menuHashRef.current = nuevoHash;
            setMenu(adminTabRef.current === "menu" ? menuConFechaActual(menuNormalizado) : menuNormalizado);
            guardarMenuCache(menuNormalizado);
            menuCacheDisponibleRef.current = true;
            setPlatosTexto(platosATexto(menuNormalizado.platos_detalle));
            setAcompanantesTexto(acompanantesATexto(menuNormalizado.acompanantes));

            setItemsPedido((actual) => {
              const nombresMenuActual = new Set(
                menuNormalizado.platos_detalle
                  .map((plato) => String(plato.nombre || "").trim())
                  .filter(Boolean)
              );

              const itemsValidosMenuActual = actual
                .map((item) => {
                  const nombreItem = String(item.plato || item.proteina || "").trim();
                  if (!nombreItem) return item;
                  return nombresMenuActual.has(nombreItem) ? item : crearItemNuevo();
                })
                .filter((item, index, lista) => {
                  const tieneProducto = Boolean(item.plato || item.proteina);
                  if (tieneProducto) return true;
                  return lista.every((otro) => !(otro.plato || otro.proteina)) && index === 0;
                });

              return itemsValidosMenuActual.length ? itemsValidosMenuActual : [crearItemNuevo()];
            });
          }
        } else {
          const menuVacioHoy = normalizarMenu({
            fecha: fechaActualMenu,
            platos_detalle: [],
            acompanantes: []
          });
          menuHashRef.current = JSON.stringify({
            fecha: fechaActualMenu,
            platos_detalle: [],
            acompanantes: []
          });
          setMenu(menuVacioHoy);
          guardarMenuCache(menuVacioHoy);
          menuCacheDisponibleRef.current = false;
          setPlatosTexto("");
          setAcompanantesTexto("");
        }
      } catch (error) {
        if (!cancelado && !menuCacheDisponibleRef.current) {
          mostrarMensaje(
            describirErrorSupabase(error, "cargar el menú diario"),
            "error"
          );
        }
      } finally {
        if (!cancelado) {
          setCargandoMenu(false);
        }
      }
    }

    cargarMenuSeguro();

    return () => {
      cancelado = true;
    };
  }, [mostrarMensaje, recargaMenu, setItemsPedido]);

  useEffect(() => {
    if (!supabaseConfigOk) return undefined;

    let ultimaRecargaMenu = 0;
    let recargaMenuPendiente = null;

    const pedirRecargaMenu = () => {
      if (adminTabRef.current === "menu") return;

      const ahora = Date.now();
      const tiempoDesdeUltima = ahora - ultimaRecargaMenu;

      if (tiempoDesdeUltima >= 2000) {
        ultimaRecargaMenu = ahora;
        setRecargaMenu((actual) => actual + 1);
        return;
      }

      if (recargaMenuPendiente) return;

      recargaMenuPendiente = window.setTimeout(() => {
        recargaMenuPendiente = null;
        if (adminTabRef.current === "menu") return;
        ultimaRecargaMenu = Date.now();
        setRecargaMenu((actual) => actual + 1);
      }, 2000 - tiempoDesdeUltima);
    };

    const canalMenu = supabase
      .channel(`${instanciaRealtimeRef.current}-menu`)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_diario" }, pedirRecargaMenu)
      .subscribe();

    return () => {
      if (recargaMenuPendiente) window.clearTimeout(recargaMenuPendiente);
      supabase.removeChannel(canalMenu);
    };
  }, [instanciaRealtimeRef]);

  useEffect(() => {
    const recargarMenuAlVolver = () => {
      if (document.visibilityState === "visible") {
        setRecargaMenu((actual) => actual + 1);
      }
    };

    window.addEventListener("focus", recargarMenuAlVolver);
    document.addEventListener("visibilitychange", recargarMenuAlVolver);

    return () => {
      window.removeEventListener("focus", recargarMenuAlVolver);
      document.removeEventListener("visibilitychange", recargarMenuAlVolver);
    };
  }, []);

  const sincronizarFechaMenuActual = useCallback(() => {
    setMenu((actual) => {
      const fechaActual = fechaISOColombia();
      return actual.fecha === fechaActual ? actual : { ...actual, fecha: fechaActual };
    });
  }, []);

  function traerTextoDesdeGeneradorMenu() {
    const ultimoTexto = leerUltimoTextoEditorGenerador();

    if (!ultimoTexto) {
      mostrarMensajeMenu(
        "No encontré texto reciente del Generador de menú. Abre el generador, ajusta los platos y acompañantes, y vuelve a intentar.",
        "warning",
        { persistente: true }
      );
      return;
    }

    if (ultimoTexto.platosTexto) {
      setPlatosTexto(ultimoTexto.platosTexto);
    }

    if (ultimoTexto.acompanantesTexto) {
      setAcompanantesTexto(ultimoTexto.acompanantesTexto);
    }

    mostrarMensajeMenu(
      "✅ Texto del Generador de menú cargado. Revisa y presiona Guardar menú del día para publicarlo.",
      "success",
      { persistente: true }
    );
  }

  function imprimirMenuDiarioTicket() {
    const resultadoPlatos = textoAPlatosDetalle(platosTexto, { estricto: false });
    const acompanantes = limpiarAcompanantesMenu(listaPorLineas(acompanantesTexto));

    if (resultadoPlatos.platos.length === 0 && acompanantes.length === 0) {
      mostrarMensajeMenu(
        "No hay platos ni acompañantes para imprimir. Primero carga o escribe el menú del día.",
        "warning",
        { persistente: true }
      );
      return;
    }

    const escaparHtml = (valor) =>
      String(valor || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const platosHtml = resultadoPlatos.platos
      .map(
        (plato) => `
          <div class="item">
            <div class="nombre">${escaparHtml(plato.nombre)}</div>
            <div class="precio">$ ${dinero(plato.precio).replace("$", "").trim()}</div>
          </div>
        `
      )
      .join("");

    const acompanantesHtml = acompanantes.map((item) => `<li>${escaparHtml(item)}</li>`).join("");

    const fechaTexto = menu.fecha || fechaISOColombia();
    const tituloTexto = menu.titulo || "Menú del día";
    const descripcionTexto = menu.descripcion || "";

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Menú Rafiki</title>
  <style>
    @page { size: 58mm auto; margin: 4mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      background: #fff;
      font-size: 11px;
      line-height: 1.18;
    }
    .ticket { width: 50mm; max-width: 50mm; margin: 0 auto; }
    .center { text-align: center; }
    .brand { font-size: 17px; font-weight: 900; letter-spacing: 1px; }
    .titulo { font-size: 13px; font-weight: 800; margin-top: 3px; }
    .fecha { font-size: 10px; margin-top: 3px; }
    .linea { border-top: 1px dashed #111; margin: 6px 0; }
    .descripcion { font-size: 10px; text-align: center; margin: 6px 0; }
    .seccion { font-size: 11px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; }
    .item { display: flex; justify-content: space-between; gap: 5px; margin: 3px 0; }
    .nombre { font-size: 11px; font-weight: 800; flex: 1; }
    .precio { font-size: 11px; font-weight: 900; white-space: nowrap; }
    .categoria { font-size: 9px; color: #333; margin-bottom: 4px; text-transform: uppercase; }
    ul { margin: 0; padding-left: 14px; }
    li { font-size: 11px; margin: 2px 0; font-weight: 700; }
    .nota { font-size: 9px; margin-top: 8px; text-align: center; }
    @media screen {
      body { background: #f5f5f5; padding: 12px; }
      .ticket { background: #fff; padding: 8px; box-shadow: 0 2px 10px rgba(0,0,0,.12); }
    }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="center">
      <div class="brand">RAFIKI</div>
      <div class="titulo">${escaparHtml(tituloTexto)}</div>
      <div class="fecha">${escaparHtml(fechaTexto)}</div>
    </div>
    ${descripcionTexto ? `<div class="descripcion">${escaparHtml(descripcionTexto)}</div>` : ""}
    <div class="linea"></div>
    ${resultadoPlatos.platos.length ? `${platosHtml}<div class="linea"></div>` : ""}
    ${acompanantes.length ? `<div class="seccion">Acompañantes</div><ul>${acompanantesHtml}</ul><div class="linea"></div>` : ""}
    <div class="nota">Menú sujeto a disponibilidad.</div>
  </div>
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => window.print(), 250);
    });
  </script>
</body>
</html>`;

    const ventana = window.open("", "_blank", "width=360,height=640");
    if (!ventana) {
      mostrarMensajeMenu(
        "El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para Rafiki e intenta de nuevo.",
        "warning",
        { persistente: true }
      );
      return;
    }

    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
  }

  async function guardarMenu() {
    if (guardandoMenu) return;

    if (!supabaseConfigOk) {
      mostrarMensajeMenu(supabaseConfigMensaje, "error", { persistente: true });
      return;
    }

    setMensajeMenu({ texto: "Guardando menú diario...", tipo: "info" });

    const resultadoPlatos = textoAPlatosDetalle(platosTexto, { estricto: true });
    const acompanantes = limpiarAcompanantesMenu(listaPorLineas(acompanantesTexto));

    if (resultadoPlatos.errores.length > 0) {
      mostrarMensajeMenu(
        `No se puede guardar el menú. Corrige:\n${resultadoPlatos.errores.slice(0, 5).join("\n")}`,
        "error",
        { persistente: true }
      );
      irAElemento("confirmacion-menu-diario");
      return;
    }

    if (resultadoPlatos.platos.length === 0) {
      mostrarMensajeMenu(
        "Debes agregar al menos un plato del día con el formato Categoría | Plato:Precio.",
        "warning",
        { persistente: true }
      );
      irAElemento("confirmacion-menu-diario");
      return;
    }

    const menuActualizado = {
      fecha: menu.fecha || fechaISOColombia(),
      titulo: menu.titulo || "Almuerzo ejecutivo Rafiki",
      descripcion:
        menu.descripcion || "Escoge tu plato del día y máximo 3 acompañantes. Incluye sopa y bebida.",
      precio: Number(resultadoPlatos.platos[0]?.precio) || 0,
      proteinas: resultadoPlatos.platos.map((item) => item.nombre),
      proteinas_detalle: resultadoPlatos.platos.map((item) => ({
        nombre: item.nombre,
        precio: item.precio
      })),
      platos_detalle: resultadoPlatos.platos,
      acompanantes,
      activo: true
    };

    setGuardandoMenu(true);

    try {
      const eraEdicion = Boolean(menu.id);
      const payloads = crearPayloadsMenuDiario(menuActualizado);

      const { payloadUsado } = await ejecutarGuardadoMenuConFallback({
        eraEdicion,
        id: menu.id,
        payloads
      });

      let idMenuGuardado = menu.id || null;

      if (!eraEdicion) {
        const { data: menuActivoReciente } = await conTiempoMaximo(
          supabase
            .from("menu_diario")
            .select("id")
            .eq("activo", true)
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle(),
          7000,
          "La verificación del menú guardado"
        ).catch(() => ({ data: null }));

        idMenuGuardado = menuActivoReciente?.id || `local-${Date.now()}`;
      }

      if (idMenuGuardado && !String(idMenuGuardado).startsWith("local-")) {
        await conTiempoMaximo(
          supabase.from("menu_diario").update({ activo: false }).eq("activo", true).neq("id", idMenuGuardado),
          7000,
          "La desactivación de menús anteriores"
        ).catch(() => ({ error: null }));
      }

      const nuevoMenu = normalizarMenu({
        ...menu,
        ...menuActualizado,
        ...payloadUsado,
        id: idMenuGuardado
      });

      const nuevoHash = JSON.stringify({
        id: nuevoMenu.id,
        fecha: nuevoMenu.fecha,
        titulo: nuevoMenu.titulo,
        descripcion: nuevoMenu.descripcion,
        platos_detalle: nuevoMenu.platos_detalle,
        acompanantes: nuevoMenu.acompanantes
      });

      menuHashRef.current = nuevoHash;
      guardarMenuCache(nuevoMenu);
      menuCacheDisponibleRef.current = true;
      setMenu(nuevoMenu);
      setItemsPedido([crearItemNuevo()]);
      setPlatosTexto(platosATexto(nuevoMenu.platos_detalle));
      setAcompanantesTexto(acompanantesATexto(nuevoMenu.acompanantes));
      borrarBorradorEditorMenuDiario();

      mostrarMensajeMenu(
        eraEdicion ? "✅ Menú diario actualizado correctamente." : "✅ Menú diario creado correctamente.",
        "success",
        { persistente: true }
      );
      irAElemento("confirmacion-menu-diario");
      setRecargaMenu((actual) => actual + 1);
    } catch (error) {
      mostrarMensajeMenu(
        describirErrorSupabase(error, "guardar el menú diario"),
        "error",
        { persistente: true }
      );
      irAElemento("confirmacion-menu-diario");
    } finally {
      setGuardandoMenu(false);
    }
  }

  return {
    menu,
    setMenu,
    cargandoMenu,
    guardandoMenu,
    recargaMenu,
    setRecargaMenu,
    platosTexto,
    setPlatosTexto,
    acompanantesTexto,
    setAcompanantesTexto,
    sincronizarFechaMenuActual,
    traerTextoDesdeGeneradorMenu,
    imprimirMenuDiarioTicket,
    guardarMenu
  };
}
