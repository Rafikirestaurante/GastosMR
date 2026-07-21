import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabaseClient";
import { PRODUCTOS_CATALOGO_FALLBACK } from "../../../data/catalogoProductosData";
import { cargarCatalogoProductosAdmin } from "../../../services/catalogoService";
import {
  limpiarLista,
  limpiarPrecio,
  fechaHoyISO,
  normalizarPlatos,
  formatearFechaInformeMenu,
  obtenerPlatosSinPrecio,
  crearSvgMenuSoloTexto,
  generarTextoEditorMenu,
  generarTextoAcompanantesEditor,
  guardarUltimoTextoEditorGenerador
} from "../../../shared/utils/generadorMenu";
import { useAlertaRafiki } from "../../../shared/components/common";
import { describirErrorSupabase, registrarErrorSupabase } from "../../../shared/utils/supabaseErrors";

const GENERADOR_MENU_DRAFT_KEY = "rafikiGeneradorMenuBorrador21J5";

const PLATOS_GENERADOR_DEFECTO = [];

const ACOMPANANTES_GENERADOR_DEFECTO = "";

const PRODUCTOS_OCULTOS_GENERADOR = [
  "Pechuga asada sin Salsa",
  "Cerdo asado sin salsa",
  "Sopas medianas sin arroz",
  "Sopas medianas con arroz",
  "Sancocho de pollo",
  "Sancocho de pollo con arroz"
];

function normalizarTextoCatalogo(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}


function esProductoOcultoGenerador(producto) {
  const clave = normalizarTextoCatalogo(producto?.nombre || producto);
  return PRODUCTOS_OCULTOS_GENERADOR.some((nombre) => normalizarTextoCatalogo(nombre) === clave);
}

function clasificarPlatoVisual(producto) {
  const nombre = producto?.nombre || "";
  const normalizado = normalizarTextoCatalogo(nombre);
  if (normalizado.startsWith("pechuga o cerdo")) return "pechugaCerdo";
  if (normalizado.startsWith("pastas")) return "pastas";
  return "guisos";
}

function nombreVisualPlato(producto) {
  const nombre = String(producto?.nombre || "").trim();
  const tipo = clasificarPlatoVisual(producto);

  if (tipo === "pechugaCerdo") {
    return nombre
      .replace(/^Pechuga o cerdo\s+en\s+/i, "")
      .replace(/^Pechuga o cerdo\s+/i, "")
      .replace(/^salsa\s+/i, "Salsa ")
      .trim();
  }

  if (tipo === "pastas") {
    return nombre.replace(/^Pastas\s*/i, "").trim();
  }

  return nombre;
}

function agruparPlatosVisuales(productos) {
  return [
    { key: "pechugaCerdo", titulo: "Pechuga y cerdo", productos: productos.filter((producto) => clasificarPlatoVisual(producto) === "pechugaCerdo") },
    { key: "pastas", titulo: "Pastas", productos: productos.filter((producto) => clasificarPlatoVisual(producto) === "pastas") },
    { key: "guisos", titulo: "Guisos y demás", productos: productos.filter((producto) => clasificarPlatoVisual(producto) === "guisos") }
  ].filter((grupo) => grupo.productos.length > 0);
}


function esSopaResumen(nombre) {
  const normalizado = normalizarTextoCatalogo(nombre?.nombre || nombre);
  return /\b(ajiaco|mote|mondongo|costilla|gallina|paticas|sancocho|sopa|sopas)\b/.test(normalizado);
}

function ordenPlatoResumen(plato) {
  const normalizado = normalizarTextoCatalogo(plato?.nombre || plato);
  if (esSopaResumen(plato)) return 3;
  if (normalizado.startsWith("pechuga o cerdo") || normalizado.startsWith("pechuga ") || normalizado.startsWith("cerdo ")) return 2;
  if (normalizado.startsWith("pastas")) return 1;
  return 0;
}

function ordenarPlatosResumen(platos = []) {
  return [...platos].sort((a, b) => {
    const orden = ordenPlatoResumen(a) - ordenPlatoResumen(b);
    if (orden !== 0) return orden;
    return String(a?.nombre || a).localeCompare(String(b?.nombre || b), "es", { sensitivity: "base" });
  });
}

function ordenAcompananteResumen(nombre) {
  const normalizado = normalizarTextoCatalogo(nombre?.nombre || nombre);
  if (normalizado.startsWith("arroz")) return 0;
  if (normalizado.startsWith("ensalada")) return 2;
  return 1;
}

function ordenarAcompanantesResumen(items = []) {
  return [...items].sort((a, b) => {
    const orden = ordenAcompananteResumen(a) - ordenAcompananteResumen(b);
    if (orden !== 0) return orden;
    return String(a?.nombre || a).localeCompare(String(b?.nombre || b), "es", { sensitivity: "base" });
  });
}

function categoriaRotacionMenu(producto) {
  const categoria = normalizarTextoCatalogo(producto?.categoria || "");
  const nombre = normalizarTextoCatalogo(producto?.nombre || producto);

  if (categoria.includes("sopa") || esSopaResumen(nombre)) return "sopas";
  if (categoria.includes("pasta") || nombre.startsWith("pastas")) return "pastas";
  if (categoria.includes("guiso")) return "guisos";

  if (categoria.includes("plato")) {
    if (nombre.startsWith("pechuga") || nombre.startsWith("cerdo") || nombre.startsWith("pechuga o cerdo")) return "platos";
    return "guisos";
  }

  return null;
}

function obtenerNombresHistorialRotacion(registro) {
  if (!registro) return [];
  if (Array.isArray(registro.platos)) {
    return registro.platos
      .map((plato) => String(plato?.nombre || plato || "").trim())
      .filter(Boolean);
  }
  return obtenerPlatosSinPrecio(registro);
}

function fechaDentroDeRangoMenu(fecha, dias) {
  if (!fecha) return false;
  const fechaRegistro = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(fechaRegistro.getTime())) return false;

  const hoy = new Date();
  const limite = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  limite.setDate(limite.getDate() - (Number(dias) - 1));
  return fechaRegistro >= limite;
}

function productosRestauranteFallback() {
  return PRODUCTOS_CATALOGO_FALLBACK
    .filter((item) => item.linea === "Restaurante" && item.activo !== false && item.agotado !== true)
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0) || String(a.nombre).localeCompare(String(b.nombre)));
}

function filtrarCatalogoMenu(productos, categoria) {
  return productos
    .filter((item) => item.linea === "Restaurante" && item.categoria === categoria && item.activo !== false && item.agotado !== true)
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0) || String(a.nombre).localeCompare(String(b.nombre)));
}

function tipoAlertaGenerador(texto) {
  const normalizado = String(texto || "").toLowerCase();
  if (normalizado.includes("no se pudo") || normalizado.includes("error")) return "error";
  if (normalizado.includes("selecciona") || normalizado.includes("agrega")) return "advertencia";
  if (normalizado.includes("correctamente") || normalizado.includes("guardad") || normalizado.includes("descargad") || normalizado.includes("copiad")) return "exito";
  return "info";
}

function tituloAlertaGenerador(tipo) {
  if (tipo === "error") return "Revisar generador";
  if (tipo === "advertencia") return "Falta un paso";
  if (tipo === "exito") return "Acción realizada";
  return "Aviso del generador";
}

function leerBorradorGeneradorMenu() {
  if (typeof window === "undefined" || !window.localStorage) return null;

  try {
    const raw = window.localStorage.getItem(GENERADOR_MENU_DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    return data;
  } catch {
    return null;
  }
}

export default function GeneradorMenu({ pestanaInicial = "generador" } = {}) {
  const borradorInicial = leerBorradorGeneradorMenu();
  const [mostrarAlertaRafiki, modalAlertaRafiki] = useAlertaRafiki();
  const [platos, setPlatos] = useState(() => Array.isArray(borradorInicial?.platos) && borradorInicial.platos.length ? borradorInicial.platos : PLATOS_GENERADOR_DEFECTO);
  const [acompanantes, setAcompanantes] = useState(() => typeof borradorInicial?.acompanantes === "string" ? borradorInicial.acompanantes : ACOMPANANTES_GENERADOR_DEFECTO);
  const [mensaje, setMensaje] = useState("");
  const [fechaMenu, setFechaMenu] = useState(() => fechaHoyISO());
  const [guardandoHistorial, setGuardandoHistorial] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [catalogoRestaurante, setCatalogoRestaurante] = useState(() => productosRestauranteFallback());
  const [fuenteCatalogo, setFuenteCatalogo] = useState("local");
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);
  const [busquedaPlatos, setBusquedaPlatos] = useState("");
  const [busquedaSopas, setBusquedaSopas] = useState("");
  const [busquedaAcompanantes, setBusquedaAcompanantes] = useState("");
  const [seleccionCatalogoPlatos, setSeleccionCatalogoPlatos] = useState([]);
  const [seleccionCatalogoAcompanantes, setSeleccionCatalogoAcompanantes] = useState([]);
  const [pestanaGenerador, setPestanaGenerador] = useState(pestanaInicial === "historial" ? "historial" : "generador");
  const [modoInformeMenus, setModoInformeMenus] = useState("ultimos12");
  const [fechaInformeMenu, setFechaInformeMenu] = useState(() => fechaHoyISO());
  const [fechaInicioInformeMenu, setFechaInicioInformeMenu] = useState(() => fechaHoyISO());
  const [fechaFinInformeMenu, setFechaFinInformeMenu] = useState(() => fechaHoyISO());

  useEffect(() => {
    let activo = true;

    async function cargarCatalogoRestaurante() {
      setCargandoCatalogo(true);
      const resultado = await cargarCatalogoProductosAdmin();
      if (!activo) return;

      if (resultado.ok && resultado.productos?.length) {
        const restaurante = resultado.productos
          .filter((item) => item.linea === "Restaurante" && item.activo !== false && item.agotado !== true)
          .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0) || String(a.nombre).localeCompare(String(b.nombre)));
        if (restaurante.length) {
          setCatalogoRestaurante(restaurante);
          setFuenteCatalogo("bd");
        } else {
          setCatalogoRestaurante(productosRestauranteFallback());
          setFuenteCatalogo("local");
        }
      } else {
        setCatalogoRestaurante(productosRestauranteFallback());
        setFuenteCatalogo("local");
      }

      setCargandoCatalogo(false);
    }

    cargarCatalogoRestaurante();
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (!mensaje) return;
    const tipo = tipoAlertaGenerador(mensaje);
    mostrarAlertaRafiki({
      tipo,
      titulo: tituloAlertaGenerador(tipo),
      mensaje
    });
  }, [mensaje, mostrarAlertaRafiki]);

  const platosLimpios = useMemo(() => platos.filter((p) => p.nombre.trim()), [platos]);
  const listaAcompanantes = useMemo(() => ordenarAcompanantesResumen(limpiarLista(acompanantes)), [acompanantes]);
  const platosResumenConIndice = useMemo(() => platos.map((plato, index) => ({ plato, index })), [platos]);
  const catalogoPlatos = useMemo(() => filtrarCatalogoMenu(catalogoRestaurante, "Platos").filter((item) => !esProductoOcultoGenerador(item)), [catalogoRestaurante]);
  const catalogoSopas = useMemo(() => filtrarCatalogoMenu(catalogoRestaurante, "Sopas").filter((item) => !esProductoOcultoGenerador(item)), [catalogoRestaurante]);
  const catalogoAcompanantes = useMemo(() => filtrarCatalogoMenu(catalogoRestaurante, "Acompañantes"), [catalogoRestaurante]);

  const platosFiltradosCatalogo = useMemo(() => {
    const q = normalizarTextoCatalogo(busquedaPlatos);
    return q ? catalogoPlatos.filter((item) => normalizarTextoCatalogo(item.nombre).includes(q)) : catalogoPlatos;
  }, [catalogoPlatos, busquedaPlatos]);

  const gruposPlatosVisuales = useMemo(() => agruparPlatosVisuales(platosFiltradosCatalogo), [platosFiltradosCatalogo]);

  const sopasFiltradasCatalogo = useMemo(() => {
    const q = normalizarTextoCatalogo(busquedaSopas);
    return q ? catalogoSopas.filter((item) => normalizarTextoCatalogo(item.nombre).includes(q)) : catalogoSopas;
  }, [catalogoSopas, busquedaSopas]);

  const acompanantesFiltradosCatalogo = useMemo(() => {
    const q = normalizarTextoCatalogo(busquedaAcompanantes);
    return q ? catalogoAcompanantes.filter((item) => normalizarTextoCatalogo(item.nombre).includes(q)) : catalogoAcompanantes;
  }, [catalogoAcompanantes, busquedaAcompanantes]);

  const svgTexto = useMemo(
    () => crearSvgMenuSoloTexto({ platos: platosLimpios, acompanantes: listaAcompanantes }),
    [platos, acompanantes]
  );

  const svgTextoUrl = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgTexto)}`, [svgTexto]);


  const nombresPlatosSeleccionados = useMemo(
    () => new Set(seleccionCatalogoPlatos.map((plato) => normalizarTextoCatalogo(plato.nombre)).filter(Boolean)),
    [seleccionCatalogoPlatos]
  );

  const nombresAcompanantesSeleccionados = useMemo(
    () => new Set(seleccionCatalogoAcompanantes.map((item) => normalizarTextoCatalogo(item.nombre || item)).filter(Boolean)),
    [seleccionCatalogoAcompanantes]
  );

  const textoEditorMenu = useMemo(() => generarTextoEditorMenu(platosLimpios), [platosLimpios]);
  const textoEditorAcompanantes = useMemo(() => generarTextoAcompanantesEditor(listaAcompanantes), [listaAcompanantes]);

  useEffect(() => {
    guardarUltimoTextoEditorGenerador({
      platosTexto: textoEditorMenu,
      acompanantesTexto: textoEditorAcompanantes
    });
  }, [textoEditorMenu, textoEditorAcompanantes]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.localStorage) return;

    try {
      window.localStorage.setItem(
        GENERADOR_MENU_DRAFT_KEY,
        JSON.stringify({
          fechaMenu: fechaMenu || fechaHoyISO(),
          platos,
          acompanantes,
          actualizadoEn: new Date().toISOString()
        })
      );
    } catch {
      // Si el navegador no permite guardar, la app continúa normalmente.
    }
  }, [fechaMenu, platos, acompanantes]);

  const historialUnicoOrdenado = useMemo(() => {
    const unicosPorFecha = new Map();
    historial.forEach((registro) => {
      if (registro?.fecha && !unicosPorFecha.has(registro.fecha)) {
        unicosPorFecha.set(registro.fecha, registro);
      }
    });

    return Array.from(unicosPorFecha.values())
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  }, [historial]);

  const informeUltimosMenus = useMemo(() => {
    if (modoInformeMenus === "fecha") {
      return historialUnicoOrdenado.filter((registro) => registro.fecha === fechaInformeMenu);
    }

    if (modoInformeMenus === "rango") {
      const inicio = fechaInicioInformeMenu || fechaFinInformeMenu;
      const fin = fechaFinInformeMenu || fechaInicioInformeMenu;
      if (!inicio && !fin) return historialUnicoOrdenado.slice(-12);
      const desde = inicio && fin && inicio > fin ? fin : inicio;
      const hasta = inicio && fin && inicio > fin ? inicio : fin;
      return historialUnicoOrdenado.filter((registro) => {
        if (desde && registro.fecha < desde) return false;
        if (hasta && registro.fecha > hasta) return false;
        return true;
      });
    }

    return historialUnicoOrdenado.slice(-12);
  }, [historialUnicoOrdenado, modoInformeMenus, fechaInformeMenu, fechaInicioInformeMenu, fechaFinInformeMenu]);

  const tituloInformeMenus = useMemo(() => {
    if (modoInformeMenus === "fecha") return `Menú del ${fechaInformeMenu || "día seleccionado"}`;
    if (modoInformeMenus === "rango") {
      const inicio = fechaInicioInformeMenu || fechaFinInformeMenu || "inicio";
      const fin = fechaFinInformeMenu || fechaInicioInformeMenu || "fin";
      return `Menús del ${inicio} al ${fin}`;
    }
    return "Últimos 12 menús";
  }, [modoInformeMenus, fechaInformeMenu, fechaInicioInformeMenu, fechaFinInformeMenu]);

  const rotacionInteligenteMenu = useMemo(() => {
    const configuracion = [
      { key: "platos", titulo: "Platos", dias: 10, icono: "🍽️" },
      { key: "guisos", titulo: "Guisos", dias: 5, icono: "🥘" },
      { key: "sopas", titulo: "Sopas", dias: 5, icono: "🍲" },
      { key: "pastas", titulo: "Pastas", dias: 5, icono: "🍝" }
    ];

    const catalogoPorCategoria = configuracion.reduce((acc, item) => {
      acc[item.key] = catalogoRestaurante
        .filter((producto) => producto.linea === "Restaurante" && producto.activo !== false && producto.agotado !== true)
        .filter((producto) => !esProductoOcultoGenerador(producto))
        .filter((producto) => categoriaRotacionMenu(producto) === item.key)
        .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0) || String(a.nombre).localeCompare(String(b.nombre), "es", { sensitivity: "base" }));
      return acc;
    }, {});

    return configuracion.map((config) => {
      const usados = new Map();
      historial
        .filter((registro) => fechaDentroDeRangoMenu(registro.fecha, config.dias))
        .forEach((registro) => {
          obtenerNombresHistorialRotacion(registro).forEach((nombre) => {
            const clave = normalizarTextoCatalogo(nombre);
            const productoCatalogo = (catalogoPorCategoria[config.key] || []).find((producto) => normalizarTextoCatalogo(producto.nombre) === clave);
            if (productoCatalogo && !usados.has(clave)) {
              usados.set(clave, { nombre: productoCatalogo.nombre, fecha: registro.fecha });
            }
          });
        });

      const noUsados = (catalogoPorCategoria[config.key] || [])
        .filter((producto) => !usados.has(normalizarTextoCatalogo(producto.nombre)))
        .map((producto) => producto.nombre);

      return {
        ...config,
        usados: Array.from(usados.values()).map((item) => item.nombre),
        noUsados,
        totalCatalogo: (catalogoPorCategoria[config.key] || []).length
      };
    });
  }, [catalogoRestaurante, historial]);

  const sugerenciasRotacionMenu = useMemo(() => (
    rotacionInteligenteMenu.map((grupo) => ({
      key: grupo.key,
      titulo: grupo.titulo,
      icono: grupo.icono,
      dias: grupo.dias,
      sugeridos: grupo.noUsados.slice(0, 4)
    }))
  ), [rotacionInteligenteMenu]);

  const totalSugerenciasRotacionMenu = useMemo(() => (
    sugerenciasRotacionMenu.reduce((total, grupo) => total + grupo.sugeridos.length, 0)
  ), [sugerenciasRotacionMenu]);

  useEffect(() => {
    setPestanaGenerador(pestanaInicial === "historial" ? "historial" : "generador");
  }, [pestanaInicial]);

  const totalPaginasHistorial = Math.max(1, Math.ceil(historial.length / 5));

  const historialPaginado = useMemo(() => {
    const paginaSegura = Math.min(Math.max(Number(paginaHistorial) || 1, 1), totalPaginasHistorial);
    const inicio = (paginaSegura - 1) * 5;
    return historial.slice(inicio, inicio + 5);
  }, [historial, paginaHistorial, totalPaginasHistorial]);

  useEffect(() => {
    setPaginaHistorial((actual) => Math.min(Math.max(Number(actual) || 1, 1), totalPaginasHistorial));
  }, [totalPaginasHistorial]);

  function actualizarPlato(index, campo, valor) {
    setPlatos((actual) =>
      actual.map((plato, i) =>
        i === index ? { ...plato, [campo]: campo === "precio" ? limpiarPrecio(valor) : valor } : plato
      )
    );
  }

  function agregarPlato() {
    setPlatos((actual) => [...actual, { nombre: "", precio: "" }].slice(0, 12));
  }

  function agregarPlatoDespues(index) {
    setPlatos((actual) => {
      if (actual.length >= 12) return actual;
      const copia = [...actual];
      copia.splice(index + 1, 0, { nombre: "", precio: "" });
      return copia;
    });
  }

  function moverPlato(index, direccion) {
    setPlatos((actual) => {
      const destino = index + direccion;
      if (destino < 0 || destino >= actual.length) return actual;
      const copia = [...actual];
      const [item] = copia.splice(index, 1);
      copia.splice(destino, 0, item);
      return copia;
    });
  }

  function ordenarPlatosConReglaRafiki() {
    setPlatos((actual) => ordenarPlatosResumen(actual));
    setMensaje("Resumen ordenado con la regla Rafiki.");
  }

  function quitarPlato(index) {
    setPlatos((actual) => actual.filter((_, i) => i !== index));
  }

  function alternarProductoCatalogoAlMenu(producto) {
    if (!producto?.nombre) return;
    setSeleccionCatalogoPlatos((actual) => {
      const claveProducto = normalizarTextoCatalogo(producto.nombre);
      const existe = actual.some((plato) => normalizarTextoCatalogo(plato.nombre) === claveProducto);
      if (existe) return actual.filter((plato) => normalizarTextoCatalogo(plato.nombre) !== claveProducto);
      return [...actual, producto].slice(0, 12);
    });
  }

  function alternarAcompananteCatalogo(producto) {
    if (!producto?.nombre) return;
    setSeleccionCatalogoAcompanantes((actual) => {
      const claveProducto = normalizarTextoCatalogo(producto.nombre);
      const existe = actual.some((item) => normalizarTextoCatalogo(item.nombre || item) === claveProducto);
      if (existe) return actual.filter((item) => normalizarTextoCatalogo(item.nombre || item) !== claveProducto);
      return [...actual, producto];
    });
  }

  function actualizarResumenDesdeSeleccion() {
    const preciosActuales = new Map(platos.map((plato) => [normalizarTextoCatalogo(plato.nombre), plato.precio]));
    const platosOrdenados = ordenarPlatosResumen(seleccionCatalogoPlatos).map((producto) => ({
      nombre: producto.nombre,
      precio: preciosActuales.get(normalizarTextoCatalogo(producto.nombre)) || ""
    }));
    const acompanantesOrdenados = ordenarAcompanantesResumen(seleccionCatalogoAcompanantes).map((producto) => producto.nombre || producto);
    setPlatos(platosOrdenados);
    setAcompanantes(acompanantesOrdenados.join("\n"));
    setMensaje("Resumen actualizado con la selección del catálogo.");
  }

  function borrarSeleccionCompleta() {
    setSeleccionCatalogoPlatos([]);
    setSeleccionCatalogoAcompanantes([]);
    setPlatos([]);
    setAcompanantes("");
    setMensaje("Selección del generador borrada.");
  }

  function quitarAcompananteResumen(nombre) {
    const clave = normalizarTextoCatalogo(nombre);
    setAcompanantes((actual) => limpiarLista(actual).filter((item) => normalizarTextoCatalogo(item) !== clave).join("\n"));
    setSeleccionCatalogoAcompanantes((actual) => actual.filter((item) => normalizarTextoCatalogo(item.nombre || item) !== clave));
  }

  function descargarDesdeSvg(url, nombreArchivo, mensajeOk, transparente = false, ancho = 1080, alto = 1080) {
    setMensaje("");
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const anchoReal = image.naturalWidth || ancho;
      const altoReal = image.naturalHeight || alto;

      // Importante: el SVG del generador puede crecer cuando hay varios platos
      // o acompañantes. Antes se forzaba a 1080x930/1080 y eso cortaba la
      // sección de acompañantes en el PNG descargado. Ahora el canvas toma el
      // tamaño real del SVG para exportar la imagen completa.
      canvas.width = anchoReal;
      canvas.height = altoReal;

      const ctx = canvas.getContext("2d");
      if (!transparente) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const link = document.createElement("a");
      link.download = nombreArchivo;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setMensaje(mensajeOk);
    };
    image.onerror = () => setMensaje("No se pudo descargar la imagen. Intenta de nuevo.");
    image.src = url;
  }

  async function copiarTextoGenerado(texto, mensajeOk) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = texto;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setMensaje(mensajeOk);
    } catch (error) {
      setMensaje("No se pudo copiar automáticamente. Selecciona el texto y cópialo manualmente.");
    }
  }

  function construirTextoInformeUltimosMenus() {
    if (!informeUltimosMenus.length) return "";

    const lineas = [`📋 ${tituloInformeMenus} Rafiki`, ""];
    informeUltimosMenus.forEach((registro) => {
      const fechaInforme = formatearFechaInformeMenu(registro.fecha);
      const platosRegistro = obtenerPlatosSinPrecio(registro);
      lineas.push(`*${fechaInforme.diaSemana} ${fechaInforme.fechaCorta}*`);
      if (platosRegistro.length) {
        platosRegistro.forEach((plato) => lineas.push(`• ${plato}`));
      } else {
        lineas.push("• Sin platos registrados");
      }
      lineas.push("");
    });

    return lineas.join("\n").trim();
  }

  async function generarInformeUltimosMenus() {
    const textoInforme = construirTextoInformeUltimosMenus();
    if (!textoInforme) {
      setMensaje("Guarda menús en el historial para generar el informe.");
      return;
    }
    await copiarTextoGenerado(textoInforme, "Informe de menús generado y copiado correctamente.");
  }

  function compartirInformeUltimosMenusWhatsApp() {
    const textoInforme = construirTextoInformeUltimosMenus();
    if (!textoInforme) {
      setMensaje("Guarda menús en el historial para compartir el informe.");
      return;
    }
    const url = `https://wa.me/?text=${encodeURIComponent(textoInforme)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setMensaje("Informe de menús listo para compartir por WhatsApp.");
  }

  async function descargarSoloTexto() {
    const guardado = await guardarHistorialGenerador({ silencioso: true });
    if (!guardado) return;

    descargarDesdeSvg(
      svgTextoUrl,
      "menu-rafiki-solo-texto.png",
      "Imagen solo texto descargada y guardada en el historial.",
      true,
      1080,
      930
    );
  }

  function imprimirMenuSimple(tipo) {
    const esc = (valor) => String(valor || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    const ordenarPorCatalogo = (items = []) => [...items]
      .filter((item) => item?.nombre)
      .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0) || String(a.nombre).localeCompare(String(b.nombre), "es", { sensitivity: "base" }));

    const gruposPlatos = [
      { titulo: "Pechuga y cerdo", items: ordenarPorCatalogo(catalogoPlatos.filter((plato) => {
        const n = normalizarTextoCatalogo(plato.nombre);
        return n.startsWith("pechuga") || n.startsWith("cerdo") || n.startsWith("pechuga o cerdo");
      })) },
      { titulo: "Pastas", items: ordenarPorCatalogo(catalogoPlatos.filter((plato) => normalizarTextoCatalogo(plato.nombre).startsWith("pastas"))) },
      { titulo: "Guisos y demás", items: ordenarPorCatalogo(catalogoPlatos.filter((plato) => {
        const n = normalizarTextoCatalogo(plato.nombre);
        return !n.startsWith("pechuga") && !n.startsWith("cerdo") && !n.startsWith("pechuga o cerdo") && !n.startsWith("pastas");
      })) },
      { titulo: "Sopas", items: ordenarPorCatalogo(catalogoSopas) }
    ].filter((grupo) => grupo.items.length > 0);

    const htmlPlatos = gruposPlatos.map((grupo) => `
      <section class="grupo">
        <h2>${esc(grupo.titulo)}</h2>
        ${grupo.items.map((plato) => `<div class="fila">${esc(plato.nombre)}</div>`).join("")}
      </section>
    `).join("");

    const htmlAcompanantes = ordenarPorCatalogo(catalogoAcompanantes)
      .map((item) => `<div class="acompanante">${esc(item.nombre)}</div>`)
      .join("");
    const contenido = tipo === "acompanantes" ? htmlAcompanantes : htmlPlatos;
    const titulo = tipo === "acompanantes" ? "Acompañantes" : "Platos";

    if (!contenido) {
      setMensaje(tipo === "acompanantes" ? "No hay acompañantes en el catálogo." : "No hay platos en el catálogo.");
      return;
    }

    const ventana = window.open("", "_blank", "width=420,height=720");
    if (!ventana) {
      setMensaje("El navegador bloqueó la ventana de impresión.");
      return;
    }

    ventana.document.write(`<!doctype html>
      <html><head><meta charset="utf-8" /><title>${esc(titulo)} Rafiki</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 16px; font-family: Arial, sans-serif; color: #111827; background: #fff; }
        h1 { margin: 0 0 12px; text-align: center; font-size: 21px; text-transform: uppercase; }
        h2 { margin: 14px 0 6px; padding: 6px 8px; border: 2px solid #111827; font-size: 15px; text-align: center; text-transform: uppercase; }
        .fila { padding: 6px 0; border-bottom: 1px dashed #d1d5db; font-size: 15px; font-weight: 800; text-align: center; }
        .acompanante { padding: 7px 0; border-bottom: 1px dashed #d1d5db; font-size: 17px; font-weight: 800; text-align: center; }
        @media print { body { padding: 8px; } }
      </style></head><body>
        <h1>${esc(titulo)}</h1>
        ${contenido}
        <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 400); };</script>
      </body></html>`);
    ventana.document.close();
    setMensaje(`${titulo} del catálogo enviados a impresión.`);
  }

  async function cargarHistorialGenerador(opciones = {}) {
    setCargandoHistorial(true);
    const { data, error } = await supabase
      .from("historial_generador_menu")
      .select("id, fecha, platos, acompanantes, observaciones, creado_en")
      .order("fecha", { ascending: false })
      .order("creado_en", { ascending: false })
      .limit(60);

    if (error) {
      registrarErrorSupabase("cargar historial del generador", error);
      setMensaje(describirErrorSupabase(error, "cargar el historial del generador"));
    } else {
      const registros = [];
      const fechasVistas = new Set();
      (data || []).forEach((registro) => {
        if (!fechasVistas.has(registro.fecha)) {
          fechasVistas.add(registro.fecha);
          registros.push(registro);
        }
      });
      setHistorial(registros);
      setPaginaHistorial(1);
      if (opciones.cargarUltimo && registros.length > 0) {
        cargarRegistro(registros[0], { silencioso: true });
      }
    }
    setCargandoHistorial(false);
  }

  async function guardarHistorialGenerador(opciones = {}) {
    const platosParaGuardar = normalizarPlatos(platos);
    const acompanantesParaGuardar = limpiarLista(acompanantes);

    if (!fechaMenu) {
      setMensaje("Selecciona la fecha del menú antes de guardar.");
      return false;
    }

    if (platosParaGuardar.length === 0 && acompanantesParaGuardar.length === 0) {
      setMensaje("Agrega al menos un plato o acompañante antes de guardar.");
      return false;
    }

    setGuardandoHistorial(true);
    setMensaje("");

    const registroParaGuardar = {
      fecha: fechaMenu,
      titulo: "Menú del día",
      platos: platosParaGuardar,
      acompanantes: acompanantesParaGuardar,
      texto_generado: svgTexto,
      observaciones: null
    };

    const { data: registroExistente, error: errorBuscar } = await supabase
      .from("historial_generador_menu")
      .select("id")
      .eq("fecha", fechaMenu)
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (errorBuscar) {
      registrarErrorSupabase("validar historial del generador", errorBuscar);
      setMensaje(describirErrorSupabase(errorBuscar, "validar el historial del día"));
      setGuardandoHistorial(false);
      return false;
    }

    let error = null;
    let idGuardado = registroExistente?.id || null;

    if (registroExistente?.id) {
      const resultado = await supabase
        .from("historial_generador_menu")
        .update(registroParaGuardar)
        .eq("id", registroExistente.id);
      error = resultado.error;
    } else {
      const resultado = await supabase
        .from("historial_generador_menu")
        .insert(registroParaGuardar)
        .select("id")
        .single();
      error = resultado.error;
      idGuardado = resultado.data?.id || null;
    }

    if (error) {
      registrarErrorSupabase("guardar historial del generador", error);
      setMensaje(describirErrorSupabase(error, "guardar el historial del generador"));
      setGuardandoHistorial(false);
      return false;
    }

    if (idGuardado) {
      await supabase
        .from("historial_generador_menu")
        .delete()
        .eq("fecha", fechaMenu)
        .neq("id", idGuardado);
    }

    if (!opciones.silencioso) {
      setMensaje(registroExistente?.id ? "Menú del día actualizado correctamente." : "Historial del generador guardado correctamente.");
    }
    await cargarHistorialGenerador({ cargarUltimo: false });

    setGuardandoHistorial(false);
    return true;
  }

  function cargarRegistro(registro, opciones = {}) {
    const platosRegistro = Array.isArray(registro.platos) ? registro.platos : [];
    const acompanantesRegistro = Array.isArray(registro.acompanantes) ? registro.acompanantes : [];

    setFechaMenu(registro.fecha || fechaHoyISO());
    setPlatos(
      platosRegistro.length
        ? platosRegistro.map((plato) => ({
            nombre: plato.nombre || "",
            precio: plato.precio ? String(plato.precio) : ""
          }))
        : [{ nombre: "", precio: "" }]
    );
    setAcompanantes(acompanantesRegistro.join("\n"));
    if (!opciones.silencioso) {
      setMensaje("Registro cargado en el generador. Puedes editarlo o descargarlo.");
    }
  }

  useEffect(() => {
    cargarHistorialGenerador({ cargarUltimo: !borradorInicial });
  }, []);

  return (
    <>
      {modalAlertaRafiki}
      <section className="card card-pad generador-menu">
      <div>
        <h2>🎨 Generador de menú Rafiki</h2>
        <p className="muted">Crea una imagen solo texto del menú para usarla en WhatsApp, Instagram o sobre una plantilla.</p>
      </div>

      <div className="generador-subtabs" role="tablist" aria-label="Secciones del generador de menú">
        <button type="button" className={pestanaGenerador === "generador" ? "active" : ""} onClick={() => setPestanaGenerador("generador")}>
          Generador
        </button>
        <button type="button" className={pestanaGenerador === "historial" ? "active" : ""} onClick={() => setPestanaGenerador("historial")}>
          📊 Historial de menú
        </button>
      </div>

      {pestanaGenerador === "historial" && (
        <div className="historial-inteligente-menu">
          <div className="box soft historial-inteligente-header">
            <div>
              <strong>Historial y rotación inteligente de menú</strong>
              <p className="muted small" style={{ marginBottom: 0 }}>
                Revisa los últimos menús y detecta qué productos se han usado o no según la regla Rafiki: Platos 10 días; Guisos, Sopas y Pastas 5 días.
              </p>
            </div>
            <button type="button" className="button light" onClick={() => cargarHistorialGenerador({ cargarUltimo: false })} disabled={cargandoHistorial}>
              {cargandoHistorial ? "Cargando..." : "Actualizar historial"}
            </button>
          </div>

          <div className="box soft" style={{ marginTop: 14 }}>
            <div className="generador-box-header">
              <div>
                <strong>Informe últimos 12 menús</strong>
                <p className="muted small" style={{ marginBottom: 0 }}>Solo platos, sin precios. Ideal para revisar rotación y compartir por WhatsApp.</p>
              </div>
              <div className="informe-menu-acciones">
                <button type="button" className="button light" onClick={generarInformeUltimosMenus} disabled={informeUltimosMenus.length === 0} style={{ padding: "8px 10px" }}>
                  📋 Generar informe
                </button>
                <button type="button" className="button" onClick={compartirInformeUltimosMenusWhatsApp} disabled={informeUltimosMenus.length === 0} style={{ padding: "8px 10px" }}>
                  💬 WhatsApp
                </button>
              </div>
            </div>

            <div className="selector-informe-menu" aria-label="Filtro del informe de menú">
              <div className="selector-informe-menu-modos">
                <button type="button" className={modoInformeMenus === "ultimos12" ? "active" : ""} onClick={() => setModoInformeMenus("ultimos12")}>
                  Últimos 12
                </button>
                <button type="button" className={modoInformeMenus === "fecha" ? "active" : ""} onClick={() => setModoInformeMenus("fecha")}>
                  Una fecha
                </button>
                <button type="button" className={modoInformeMenus === "rango" ? "active" : ""} onClick={() => setModoInformeMenus("rango")}>
                  Rango
                </button>
              </div>

              {modoInformeMenus === "fecha" && (
                <label className="selector-informe-menu-fecha">
                  <span>Fecha del menú</span>
                  <input type="date" value={fechaInformeMenu} onChange={(e) => setFechaInformeMenu(e.target.value)} />
                </label>
              )}

              {modoInformeMenus === "rango" && (
                <div className="selector-informe-menu-rango">
                  <label>
                    <span>Desde</span>
                    <input type="date" value={fechaInicioInformeMenu} onChange={(e) => setFechaInicioInformeMenu(e.target.value)} />
                  </label>
                  <label>
                    <span>Hasta</span>
                    <input type="date" value={fechaFinInformeMenu} onChange={(e) => setFechaFinInformeMenu(e.target.value)} />
                  </label>
                </div>
              )}

              <p className="muted small" style={{ margin: 0 }}>
                Mostrando: <strong>{tituloInformeMenus}</strong> · {informeUltimosMenus.length} menú(s) encontrados.
              </p>
            </div>

            {informeUltimosMenus.length === 0 ? (
              <p className="muted small" style={{ marginBottom: 0 }}>Guarda menús en el historial para ver el informe.</p>
            ) : (
              <div className="informe-menu-scroll">
                <table className="informe-menu-tabla">
                  <thead>
                    <tr>
                      {informeUltimosMenus.map((registro) => {
                        const fechaInforme = formatearFechaInformeMenu(registro.fecha);
                        return (
                          <th key={registro.fecha}>
                            <span className="informe-menu-dia">{fechaInforme.diaSemana}</span>
                            <span className="informe-menu-fecha">{fechaInforme.fechaCorta}</span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {informeUltimosMenus.map((registro) => {
                        const platosRegistro = obtenerPlatosSinPrecio(registro);
                        return (
                          <td key={registro.fecha}>
                            {platosRegistro.length ? (
                              <ul>
                                {platosRegistro.map((plato, index) => (
                                  <li key={`${registro.fecha}-${index}`}>{plato}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="muted small">Sin platos</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rotacion-menu-grid">
            {rotacionInteligenteMenu.map((grupo) => (
              <div key={grupo.key} className="box soft rotacion-menu-card">
                <div className="rotacion-menu-title">
                  <strong>{grupo.icono} {grupo.titulo}</strong>
                  <span className="badge">Últimos {grupo.dias} días</span>
                </div>
                <p className="muted small">Catálogo activo: {grupo.totalCatalogo} · Usados: {grupo.usados.length} · Sin usar: {grupo.noUsados.length}</p>

                <div className="rotacion-menu-columns">
                  <div>
                    <h4>Usados recientemente</h4>
                    {grupo.usados.length ? (
                      <ul>
                        {grupo.usados.map((nombre) => <li key={`${grupo.key}-usado-${nombre}`}>{nombre}</li>)}
                      </ul>
                    ) : <p className="muted small">Sin uso reciente.</p>}
                  </div>
                  <div>
                    <h4>No usados recientemente</h4>
                    {grupo.noUsados.length ? (
                      <ul>
                        {grupo.noUsados.map((nombre) => <li key={`${grupo.key}-no-${nombre}`}>{nombre}</li>)}
                      </ul>
                    ) : <p className="muted small">Todos han rotado en el rango.</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="box soft rotacion-menu-card sugerencias-rotacion-menu" style={{ marginTop: 14 }}>
            <div className="rotacion-menu-title">
              <strong>💡 Sugerencias para próximo menú</strong>
              <span className="badge">Rotación inteligente</span>
            </div>
            <p className="muted small">
              Basado en productos no usados recientemente · Sugerencias: {totalSugerenciasRotacionMenu}
            </p>

            {totalSugerenciasRotacionMenu > 0 ? (
              <div className="sugerencias-rotacion-grid">
                {sugerenciasRotacionMenu.map((grupo) => (
                  <div key={`sugerencia-${grupo.key}`} className="sugerencia-rotacion-categoria">
                    <h4>{grupo.icono} {grupo.titulo}</h4>
                    <p className="muted small" style={{ marginTop: 0 }}>Últimos {grupo.dias} días</p>
                    {grupo.sugeridos.length ? (
                      <ul>
                        {grupo.sugeridos.map((nombre) => (
                          <li key={`${grupo.key}-sugerido-${nombre}`}>{nombre}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted small">Sin sugerencias pendientes.</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted small" style={{ marginBottom: 0 }}>No hay sugerencias pendientes con los rangos actuales.</p>
            )}
          </div>

          <div className="box soft" style={{ marginTop: 14 }}>
            <div className="generador-box-header">
              <div>
                <strong>Historial reciente</strong>
                <p className="muted small" style={{ marginBottom: 0 }}>Paginado de 5 en 5 para que sea más cómodo desde celular.</p>
              </div>
            </div>
            {historial.length === 0 ? (
              <p className="muted small" style={{ marginBottom: 0 }}>Todavía no hay registros guardados.</p>
            ) : (
              <>
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  {historialPaginado.map((registro) => (
                    <button
                      key={registro.id}
                      type="button"
                      className="history-menu-item"
                      onClick={() => { cargarRegistro(registro); setPestanaGenerador("generador"); }}
                      title="Cargar este menú en el generador"
                    >
                      <strong>{registro.fecha}</strong>
                      <span>{Array.isArray(registro.platos) ? registro.platos.length : 0} platos · {Array.isArray(registro.acompanantes) ? registro.acompanantes.length : 0} acompañantes</span>
                    </button>
                  ))}
                </div>
                <div className="historial-menu-paginacion">
                  <button type="button" className="button light" onClick={() => setPaginaHistorial((actual) => Math.max(1, actual - 1))} disabled={paginaHistorial <= 1}>
                    ← Anterior
                  </button>
                  <span>Página {paginaHistorial} de {totalPaginasHistorial}</span>
                  <button type="button" className="button light" onClick={() => setPaginaHistorial((actual) => Math.min(totalPaginasHistorial, actual + 1))} disabled={paginaHistorial >= totalPaginasHistorial}>
                    Siguiente →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="generador-menu-grid" style={{ display: pestanaGenerador === "historial" ? "none" : undefined }}>
        <div>
          <div className="box soft" style={{ marginTop: 0 }}>
            <strong>Fecha del menú</strong>
            <p className="muted small">Por defecto queda la fecha actual.</p>
            <label className="field" style={{ marginTop: 10 }}>
              <span>Fecha</span>
              <input type="date" value={fechaMenu} onChange={(e) => setFechaMenu(e.target.value || fechaHoyISO())} />
            </label>
          </div>

          <div className="box soft selector-catalogo-menu" style={{ marginTop: 14 }}>
            <div className="generador-box-header">
              <div>
                <strong>Seleccionar desde Catálogo Restaurante</strong>
                <p className="muted small" style={{ marginBottom: 0 }}>
                  {cargandoCatalogo ? "Cargando catálogo..." : fuenteCatalogo === "bd" ? "Usando productos activos de Supabase." : "Usando respaldo local del catálogo."}
                </p>
              </div>
              <span className={fuenteCatalogo === "bd" ? "badge badge-finalizado" : "badge"}>{fuenteCatalogo === "bd" ? "BD" : "Local"}</span>
            </div>

            <div className="selector-catalogo-lista-limpia">
              <section className="selector-catalogo-section">
                <div className="selector-catalogo-section-head">
                  <h3 className="category-title">🍽️ Platos</h3>
                  <label className="field selector-catalogo-search">
                    <input type="search" value={busquedaPlatos} onChange={(e) => setBusquedaPlatos(e.target.value)} placeholder="Buscar plato" />
                  </label>
                </div>

                {gruposPlatosVisuales.map((grupo) => (
                  <div key={grupo.key} className="selector-subcategoria-visual">
                    <h4>{grupo.titulo}</h4>
                    <div className="productos-chips selector-catalogo-chips">
                      {grupo.productos.map((producto) => {
                        const seleccionado = nombresPlatosSeleccionados.has(normalizarTextoCatalogo(producto.nombre));
                        return (
                          <span key={producto.id} className="producto-chip-wrap">
                            <button
                              type="button"
                              className={`producto-chip selector-catalogo-chip ${seleccionado ? "selected" : ""}`}
                              onClick={() => alternarProductoCatalogoAlMenu(producto)}
                              title={seleccionado ? "Quitar del menú del día" : "Agregar al menú del día"}
                            >
                              {seleccionado ? "✓ " : "+ "}{nombreVisualPlato(producto)}
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>

              <section className="selector-catalogo-section">
                <div className="selector-catalogo-section-head">
                  <h3 className="category-title">🍲 Sopas</h3>
                  <label className="field selector-catalogo-search">
                    <input type="search" value={busquedaSopas} onChange={(e) => setBusquedaSopas(e.target.value)} placeholder="Buscar sopa" />
                  </label>
                </div>
                <div className="productos-chips selector-catalogo-chips">
                  {sopasFiltradasCatalogo.map((producto) => {
                    const seleccionado = nombresPlatosSeleccionados.has(normalizarTextoCatalogo(producto.nombre));
                    return (
                      <span key={producto.id} className="producto-chip-wrap">
                        <button
                          type="button"
                          className={`producto-chip selector-catalogo-chip ${seleccionado ? "selected" : ""}`}
                          onClick={() => alternarProductoCatalogoAlMenu(producto)}
                          title={seleccionado ? "Quitar del menú del día" : "Agregar al menú del día"}
                        >
                          {seleccionado ? "✓ " : "+ "}{producto.nombre}
                        </button>
                      </span>
                    );
                  })}
                </div>
              </section>

              <section className="selector-catalogo-section">
                <div className="selector-catalogo-section-head">
                  <h3 className="category-title">🥗 Acompañantes</h3>
                  <label className="field selector-catalogo-search">
                    <input type="search" value={busquedaAcompanantes} onChange={(e) => setBusquedaAcompanantes(e.target.value)} placeholder="Buscar acompañante" />
                  </label>
                </div>
                <div className="productos-chips selector-catalogo-chips">
                  {acompanantesFiltradosCatalogo.map((producto) => {
                    const seleccionado = nombresAcompanantesSeleccionados.has(normalizarTextoCatalogo(producto.nombre));
                    return (
                      <span key={producto.id} className="producto-chip-wrap">
                        <button
                          type="button"
                          className={`producto-chip selector-catalogo-chip ${seleccionado ? "selected" : ""}`}
                          onClick={() => alternarAcompananteCatalogo(producto)}
                          title={seleccionado ? "Quitar acompañante" : "Agregar acompañante"}
                        >
                          {seleccionado ? "✓ " : "+ "}{producto.nombre}
                        </button>
                      </span>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>

          <div className="box soft resumen-menu-dia" style={{ marginTop: 14 }}>
            <div className="generador-box-header">
              <div>
                <strong>Resumen del menú seleccionado</strong>
                <p className="muted small" style={{ marginBottom: 0 }}>
                  Aquí puedes ajustar precios, agregar algo después de cualquier plato y ordenar el menú como debe salir impreso.
                </p>
              </div>
              <span className="badge">{platosLimpios.length} platos · {listaAcompanantes.length} acompañantes</span>
            </div>

            <div className="resumen-menu-actions">
              <button type="button" className="button" onClick={actualizarResumenDesdeSeleccion}>
                Actualizar resumen con selección
              </button>
              <button type="button" className="button light resumen-clear-button" onClick={ordenarPlatosConReglaRafiki} disabled={platos.length < 2}>
                Orden Rafiki
              </button>
              <button type="button" className="button light resumen-clear-button" onClick={borrarSeleccionCompleta}>
                Borrar selección
              </button>
            </div>

            {platos.length === 0 ? (
              <div className="alert alert-info" style={{ marginTop: 12 }}>Selecciona platos o sopas desde el catálogo.</div>
            ) : (
              <div className="resumen-precios-lista">
                {platosResumenConIndice.map(({ plato, index }) => (
                  <div key={`${plato.nombre || "plato"}-${index}`} className="plato-menu-row resumen-plato-row">
                    <input
                      value={plato.nombre}
                      onChange={(e) => actualizarPlato(index, "nombre", e.target.value)}
                      placeholder="Nombre del plato"
                    />
                    <input
                      value={plato.precio}
                      onChange={(e) => actualizarPlato(index, "precio", e.target.value)}
                      placeholder="Precio"
                      inputMode="numeric"
                    />
                    <div className="resumen-row-actions">
                      <button type="button" className="button light resumen-order-button" onClick={() => moverPlato(index, -1)} disabled={index === 0} title="Subir plato">
                        ↑
                      </button>
                      <button type="button" className="button light resumen-order-button" onClick={() => moverPlato(index, 1)} disabled={index === platos.length - 1} title="Bajar plato">
                        ↓
                      </button>
                      <button type="button" className="button light resumen-order-button" onClick={() => agregarPlatoDespues(index)} disabled={platos.length >= 12} title="Agregar debajo">
                        +
                      </button>
                      <button type="button" className="button light resumen-delete-button" onClick={() => quitarPlato(index)} title="Quitar plato">
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button type="button" className="button light" onClick={agregarPlato} style={{ marginTop: 12 }} disabled={platos.length >= 12}>
              + Agregar manual
            </button>

            <div className="resumen-acompanantes-box">
              <strong>Acompañantes seleccionados</strong>
              {listaAcompanantes.length ? (
                <div className="resumen-acompanantes-chips">
                  {listaAcompanantes.map((nombre) => (
                    <button key={nombre} type="button" className="producto-chip selected" onClick={() => quitarAcompananteResumen(nombre)} title="Quitar acompañante">
                      ✓ {nombre}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted small" style={{ marginBottom: 0 }}>Selecciona acompañantes desde el catálogo.</p>
              )}
            </div>

            <label className="field acompanantes-manual-field" style={{ marginTop: 14 }}>
              <span>Ajuste manual de acompañantes</span>
              <textarea value={acompanantes} onChange={(e) => setAcompanantes(e.target.value)} rows={4} placeholder={"Arroz de maíz\nPuré\nEnsalada"} />
            </label>
          </div>

          <div className="box soft acciones-generador" style={{ marginTop: 14 }}>
            <strong>Acciones</strong>
            <p className="muted small">Guarda automáticamente en el historial y descarga la imagen solo texto.</p>
            <button type="button" className="button download-text-button" onClick={descargarSoloTexto} disabled={guardandoHistorial}>
              {guardandoHistorial ? "Guardando..." : "Guardar y descargar"}
            </button>
            <div className="acciones-impresion-menu">
              <button type="button" className="button light" onClick={() => imprimirMenuSimple("platos")} disabled={!catalogoPlatos.length && !catalogoSopas.length}>
                Imprimir catálogo platos
              </button>
              <button type="button" className="button light" onClick={() => imprimirMenuSimple("acompanantes")} disabled={!catalogoAcompanantes.length}>
                Imprimir catálogo acompañantes
              </button>
            </div>
          </div>

          <div className="box soft texto-editor-menu-box" style={{ marginTop: 14 }}>
            <div className="generador-box-header">
              <div>
                <strong>Texto para Editor de Menú Diario</strong>
                <p className="muted small" style={{ marginBottom: 0 }}>Copia este bloque y pégalo en el editor de menú diario.</p>
              </div>
              <button type="button" className="button light" onClick={() => copiarTextoGenerado(textoEditorMenu, "Texto de platos copiado correctamente.")}>
                📋 Copiar platos
              </button>
            </div>
            <textarea className="texto-editor-menu-output" value={textoEditorMenu} readOnly rows={12} />
          </div>

          <div className="box soft texto-editor-menu-box" style={{ marginTop: 14 }}>
            <div className="generador-box-header">
              <div>
                <strong>Acompañantes para Editor</strong>
                <p className="muted small" style={{ marginBottom: 0 }}>Los acompañantes con “o” se separan y siempre se agrega “Solo esos dos”.</p>
              </div>
              <button type="button" className="button light" onClick={() => copiarTextoGenerado(textoEditorAcompanantes, "Texto de acompañantes copiado correctamente.")}>
                📋 Copiar acompañantes
              </button>
            </div>
            <textarea className="texto-editor-menu-output" value={textoEditorAcompanantes} readOnly rows={7} />
          </div>

          {mensaje && <div className="alert alert-ok menu-action-message">{mensaje}</div>}
        </div>

        <div>
          <div className="box soft" style={{ marginBottom: 10 }}>
            <strong>Vista previa solo texto</strong>
            <p className="muted small">El PNG se descarga con fondo transparente para pegar sobre otra plantilla.</p>
          </div>
          <div className="preview-menu-frame">
            <img src={svgTextoUrl} alt="Vista previa menú Rafiki solo texto" style={{ display: "block", width: "100%", height: "auto" }} />
          </div>

          <div className="box soft" style={{ marginTop: 14 }}>
            <div className="generador-box-header">
              <div>
                <strong>Historial reciente</strong>
                <p className="muted small" style={{ marginBottom: 0 }}>Paginado de 5 en 5 para que sea más cómodo desde celular.</p>
              </div>
              <button type="button" className="button light" onClick={() => cargarHistorialGenerador({ cargarUltimo: false })} disabled={cargandoHistorial} style={{ padding: "8px 10px" }}>
                {cargandoHistorial ? "Cargando..." : "Actualizar"}
              </button>
            </div>
            {historial.length === 0 ? (
              <p className="muted small" style={{ marginBottom: 0 }}>Todavía no hay registros guardados.</p>
            ) : (
              <>
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  {historialPaginado.map((registro) => (
                    <button
                      key={registro.id}
                      type="button"
                      className="history-menu-item"
                      onClick={() => cargarRegistro(registro)}
                      title="Cargar este menú en el generador"
                    >
                      <strong>{registro.fecha}</strong>
                      <span>{Array.isArray(registro.platos) ? registro.platos.length : 0} platos · {Array.isArray(registro.acompanantes) ? registro.acompanantes.length : 0} acompañantes</span>
                    </button>
                  ))}
                </div>
                <div className="historial-menu-paginacion">
                  <button type="button" className="button light" onClick={() => setPaginaHistorial((actual) => Math.max(1, actual - 1))} disabled={paginaHistorial <= 1}>
                    ← Anterior
                  </button>
                  <span>Página {paginaHistorial} de {totalPaginasHistorial}</span>
                  <button type="button" className="button light" onClick={() => setPaginaHistorial((actual) => Math.min(totalPaginasHistorial, actual + 1))} disabled={paginaHistorial >= totalPaginasHistorial}>
                    Siguiente →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .generador-menu { width: 100%; max-width: 100%; overflow: visible; }
        .generador-menu, .generador-menu * { min-width: 0; }
        .generador-menu h2 { line-height: 1.05; }
        .generador-menu-grid { width: 100%; max-width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 420px); gap: 22px; align-items: start; margin-top: 18px; }
        .generador-subtabs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; padding: 6px; border-radius: 18px; background: #fff7ed; border: 1px solid #fed7aa; }
        .generador-subtabs button { border: 1px solid transparent; background: transparent; color: #7c2d12; border-radius: 14px; padding: 10px 14px; font-weight: 950; cursor: pointer; }
        .generador-subtabs button.active { background: #fff; border-color: #fdba74; box-shadow: 0 4px 12px rgba(124, 45, 18, 0.08); }
        .historial-inteligente-menu { margin-top: 16px; }
        .historial-inteligente-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .rotacion-menu-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 14px; }
        .rotacion-menu-card { border-color: #fdba74; background: linear-gradient(180deg, #fff7ed, #fff); }
        .rotacion-menu-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
        .rotacion-menu-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 10px; }
        .rotacion-menu-columns h4 { margin: 0 0 8px; color: #9a3412; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; }
        .rotacion-menu-columns ul { margin: 0; padding-left: 18px; display: grid; gap: 5px; }
        .rotacion-menu-columns li { color: #3f2a1d; font-size: 13px; font-weight: 800; line-height: 1.25; }
        .sugerencias-rotacion-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 10px; }
        .sugerencia-rotacion-categoria { border: 1px dashed #fdba74; border-radius: 16px; background: #fff; padding: 12px; }
        .sugerencia-rotacion-categoria h4 { margin: 0 0 6px; color: #9a3412; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; }
        .sugerencia-rotacion-categoria ul { margin: 0; padding-left: 18px; display: grid; gap: 5px; }
        .sugerencia-rotacion-categoria li { color: #3f2a1d; font-size: 13px; font-weight: 800; line-height: 1.25; }
        .plato-menu-row { display: grid; grid-template-columns: minmax(0, 1fr) 120px 38px; gap: 8px; margin-top: 10px; align-items: center; }
        .field { display: grid; gap: 7px; margin-bottom: 12px; }
        .field span { font-weight: 900; color: #3f2a1d; }
        .field input, .field textarea, .box input { width: 100%; max-width: 100%; border: 1px solid #fed7aa; border-radius: 14px; padding: 12px 13px; font: inherit; outline: none; background: #fff; box-sizing: border-box; }
        .field input:focus, .field textarea:focus, .box input:focus { border-color: #f97316; box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.12); }
        .texto-editor-menu-box { border-color: #fdba74; background: linear-gradient(180deg, #fff7ed, #fff); }
        .texto-editor-menu-output { width: 100%; margin-top: 12px; border: 1px solid #fed7aa; border-radius: 16px; background: #fff; color: #2f1b10; padding: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 13px; line-height: 1.45; resize: vertical; box-sizing: border-box; white-space: pre; }
        .texto-editor-menu-output:focus { border-color: #f97316; box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.12); outline: none; }
        .preview-menu-frame { width: 100%; max-width: 100%; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 28px rgba(124,45,18,0.16); background: #fff; }
        .preview-menu-frame img { max-width: 100%; height: auto; }
        .generador-box-header { display: flex; justify-content: space-between; gap: 10px; align-items: center; flex-wrap: wrap; }
        .informe-menu-acciones { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .selector-informe-menu { margin-top: 14px; display: grid; gap: 10px; padding: 12px; border: 1px dashed #fdba74; border-radius: 16px; background: #fffaf5; }
        .selector-informe-menu-modos { display: flex; flex-wrap: wrap; gap: 8px; }
        .selector-informe-menu-modos button { border: 1px solid #fed7aa; background: #fff; color: #7c2d12; border-radius: 999px; padding: 8px 12px; font-weight: 950; cursor: pointer; }
        .selector-informe-menu-modos button.active { background: #f97316; border-color: #f97316; color: #fff; box-shadow: 0 6px 16px rgba(249, 115, 22, 0.18); }
        .selector-informe-menu-fecha, .selector-informe-menu-rango label { display: grid; gap: 6px; color: #7c2d12; font-size: 12.5px; font-weight: 950; }
        .selector-informe-menu-rango { display: grid; grid-template-columns: repeat(2, minmax(0, 180px)); gap: 10px; }
        .historial-menu-paginacion { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
        .historial-menu-paginacion span { color: #7c2d12; font-size: 13px; font-weight: 900; }
        .history-menu-item { width: 100%; border: 1px solid #fed7aa; border-radius: 14px; background: #fff; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px; text-align: left; cursor: pointer; color: #3f2a1d; }
        .history-menu-item span { color: #8a5a32; font-size: 13px; font-weight: 800; }
        .history-menu-item:hover { border-color: #f97316; box-shadow: 0 4px 12px rgba(124,45,18,0.08); }
        .informe-menu-scroll { width: 100%; max-width: 100%; margin-top: 12px; overflow-x: auto; overflow-y: hidden; padding-bottom: 8px; -webkit-overflow-scrolling: touch; }
        .informe-menu-tabla { width: max-content; min-width: 1080px; max-width: none; border-collapse: collapse; background: #fff; border: 1px solid #fed7aa; border-radius: 16px; overflow: hidden; }
        .informe-menu-tabla th { background: #fff7ed; color: #7c2d12; padding: 10px 12px; border: 1px solid #fed7aa; white-space: nowrap; text-align: center; }
        .informe-menu-dia { display: block; font-size: 13px; font-weight: 950; line-height: 1.15; }
        .informe-menu-fecha { display: block; margin-top: 3px; font-size: 12.5px; font-weight: 800; color: #9a3412; line-height: 1.15; }
        .informe-menu-tabla td { vertical-align: top; width: 210px; min-width: 210px; max-width: 210px; padding: 12px 14px; border: 1px solid #fed7aa; color: #3f2a1d; }
        .informe-menu-tabla ul { margin: 0; padding-left: 16px; display: grid; gap: 6px; }
        .informe-menu-tabla li { font-size: 12.5px; font-weight: 800; line-height: 1.3; overflow-wrap: normal; word-break: normal; hyphens: none; white-space: normal; }
        .download-text-button { background: linear-gradient(135deg, #dc2626, #f97316); color: #fff; border: none; box-shadow: 0 10px 22px rgba(220, 38, 38, 0.24); }
        .download-text-button:hover { transform: translateY(-1px); filter: brightness(1.02); }
        .acciones-impresion-menu { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }

        .selector-catalogo-menu { border-color: #fed7aa; background: linear-gradient(135deg, #fff7ed, #ffffff); }
        .selector-catalogo-lista-limpia { display: flex; flex-direction: column; gap: 18px; margin-top: 14px; }
        .selector-catalogo-section { padding-top: 2px; border-top: 1px solid #fed7aa; }
        .selector-catalogo-section:first-child { border-top: 0; padding-top: 0; }
        .selector-catalogo-section-head { display: grid; grid-template-columns: minmax(160px, 0.45fr) minmax(220px, 1fr); gap: 12px; align-items: end; margin-bottom: 10px; }
        .selector-catalogo-search { margin: 0; }
        .selector-catalogo-search input { padding: 10px 12px; }
        .selector-catalogo-chips { padding: 2px 0; align-content: start; margin-bottom: 8px; }
        .selector-catalogo-chip { font-size: 12.5px; line-height: 1.2; }
        .selector-subcategoria-visual { margin-top: 10px; }
        .selector-subcategoria-visual h4 { margin: 0 0 8px; color: #9a3412; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; }
        .resumen-menu-dia { border-color: #fdba74; background: linear-gradient(180deg, #fff7ed, #fff); }
        .resumen-menu-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; align-items: center; }
        .resumen-clear-button { width: auto !important; padding: 8px 10px !important; font-size: 12px; opacity: 0.86; }
        .resumen-precios-lista { display: grid; gap: 8px; margin-top: 12px; }
        .resumen-plato-row { margin-top: 0; grid-template-columns: minmax(180px, 1fr) 120px auto; align-items: center; }
        .resumen-row-actions { display: flex; flex-wrap: nowrap; gap: 4px; justify-content: flex-end; align-items: center; }
        .resumen-order-button, .resumen-delete-button { width: 30px !important; height: 30px !important; min-height: 30px !important; padding: 0 !important; border-radius: 999px !important; font-size: 14px !important; line-height: 1 !important; }
        .resumen-order-button:disabled { opacity: 0.35; cursor: not-allowed; }
        .resumen-delete-button { font-size: 16px !important; }
        .resumen-acompanantes-box { margin-top: 14px; padding: 12px; border: 1px dashed #fdba74; border-radius: 18px; background: #fff; }
        .resumen-acompanantes-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
        .acompanantes-manual-field textarea { min-height: 92px; }
        @media (max-width: 860px) {
          .generador-menu-grid { grid-template-columns: 1fr !important; gap: 16px; }
          .rotacion-menu-grid, .rotacion-menu-columns, .sugerencias-rotacion-grid { grid-template-columns: 1fr; }
          .selector-catalogo-section-head { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .generador-menu.card-pad { padding: 14px !important; border-radius: 22px; }
          .generador-menu h2 { font-size: 24px; }
          .generador-subtabs button { flex: 1 1 140px; padding: 10px 8px; }
          .plato-menu-row { grid-template-columns: minmax(0, 1fr) 92px 34px; gap: 6px; }
          .box.soft input, .field input, .field textarea { padding: 10px 8px; font-size: 14px; }
          .acciones-generador .button, .generador-menu .button { width: 100%; justify-content: center; }
          .acciones-impresion-menu { grid-template-columns: 1fr; }
          .generador-menu .resumen-clear-button, .generador-menu .resumen-delete-button { width: auto !important; }
          .history-menu-item { align-items: flex-start; flex-direction: column; }
          .preview-menu-frame { border-radius: 18px; }
          .informe-menu-tabla { min-width: 1080px; }
          .informe-menu-tabla td { width: 165px; min-width: 165px; max-width: 165px; padding: 10px; }
        }
        @media (max-width: 420px) {
          .plato-menu-row { grid-template-columns: minmax(0, 1fr) 88px 30px; }
          .plato-menu-row .button.resumen-order-button, .plato-menu-row .button.resumen-delete-button { width: 28px !important; height: 28px !important; min-height: 28px !important; }
          .resumen-plato-row { grid-template-columns: 1fr 92px; }
          .resumen-row-actions { grid-column: 1 / -1; justify-content: flex-start; }
        }
      `}</style>
      </section>
    </>
  );
}