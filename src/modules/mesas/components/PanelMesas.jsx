import React, { useEffect, useMemo, useState } from "react";
import {
  calcularTotalItem,
  calcularTotalItems,
  crearItemCafeteria,
  crearItemNuevo,
  dinero,
  esProductoSinAcompanantes,
  MENSAJE_ACOMPANANTES_DEL_DIA,
  precioPorNombre
} from "../../../shared/utils/pedidos";
import {
  agruparItemsResumenPedido,
  consolidarItemsResumenPedido,
  normalizarCantidadResumen
} from "../../../shared/utils/resumenPedido";
import { MAX_ACOMPANANTES_CLIENTE } from "../../../data/menuAlmuerzos";
import { CampoTexto, useAlertaRafiki } from "../../../shared/components/common";
import {
  CAFETERIA_ACOMPANANTES_DESAYUNO,
  CAFETERIA_BEBIDAS_DESAYUNO,
  CAFETERIA_BATIDOS_BASES,
  CAFETERIA_BATIDOS_CREMOSOS_SABORES,
  CAFETERIA_BATIDOS_CREMOSOS_TAMANOS,
  CAFETERIA_BATIDOS_REFRESCANTES_SABORES,
  CAFETERIA_BATIDOS_REFRESCANTES_TAMANOS,
  CAFETERIA_BEBIDAS_CALIENTES,
  CAFETERIA_DESAYUNOS,
  CAFETERIA_OTROS_DESAYUNOS,
  CAFETERIA_FRUTAS,
  CAFETERIA_JUGOS_BASES,
  CAFETERIA_JUGOS_TRADICIONALES_SABORES,
  CAFETERIA_PARFAIT_TAMANOS,
  CAFETERIA_POSTRES,
  CAFETERIA_SANDWICHES
} from "../../../data/menuCafeteria";
import { PRODUCTOS_CATALOGO_FALLBACK } from "../../../data/catalogoProductosData";
import { cargarCatalogoProductosAdmin } from "../../../services/catalogoService";
import { asegurarClienteCredito, listarClientesCreditoActivos } from "../../../services/clientesCreditoService";
import { SelectorCantidad } from "../../../shared/components/common";
import ConfirmacionPedidoMesa from "./ConfirmacionPedidoMesa";
import EditarAcompanantesResumenModal from "../../../shared/components/EditarAcompanantesResumenModal";
import EditarProteinaResumenModal from "../../../shared/components/EditarProteinaResumenModal";
import ResumenPedidoItem from "../../../shared/components/ResumenPedidoItem";
import MesaTabs from "./MesaTabs";
import DatosMesa from "./DatosMesa";
import {
  FORMA_PAGO_CREDITO,
  FORMAS_PAGO_MESA,
  guardarClienteCredito,
  irAElementoMesas,
  leerClientesCreditoGuardados,
  vibracionCortaMesas
} from "../../../shared/utils/mesas";

const STORAGE_CATALOGO_PRODUCTOS_MESAS = "rafiki_catalogo_productos_v1";

function leerProductosCatalogoStorageMesas() {
  if (typeof window === "undefined") return PRODUCTOS_CATALOGO_FALLBACK;
  try {
    const raw = window.localStorage.getItem(STORAGE_CATALOGO_PRODUCTOS_MESAS);
    if (!raw) return PRODUCTOS_CATALOGO_FALLBACK;
    const data = JSON.parse(raw);
    return Array.isArray(data) && data.length ? data : PRODUCTOS_CATALOGO_FALLBACK;
  } catch {
    return PRODUCTOS_CATALOGO_FALLBACK;
  }
}

function guardarProductosCatalogoStorageMesas(productos) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_CATALOGO_PRODUCTOS_MESAS, JSON.stringify(productos));
  } catch {
    // Respaldo silencioso: si localStorage falla, seguimos con el fallback importado.
  }
}

function normalizarTextoCatalogo(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function productosCatalogoPorCategoria(productos, categoria, fallback = [], { soloConPrecio = true, linea = "Cafetería" } = {}) {
  const categoriaNormalizada = normalizarTextoCatalogo(categoria);
  const lineaNormalizada = normalizarTextoCatalogo(linea);
  const filtrados = (productos || [])
    .filter((producto) => producto?.activo !== false && producto?.agotado !== true)
    .filter((producto) => normalizarTextoCatalogo(producto?.linea || "Cafetería") === lineaNormalizada)
    .filter((producto) => normalizarTextoCatalogo(producto?.categoria) === categoriaNormalizada)
    .filter((producto) => !soloConPrecio || Number(producto?.precio || 0) > 0)
    .sort((a, b) => Number(a?.orden || 0) - Number(b?.orden || 0) || String(a?.nombre || "").localeCompare(String(b?.nombre || ""), "es"))
    .map((producto) => ({ nombre: producto.nombre, precio: Number(producto.precio || 0) }));

  return filtrados.length ? filtrados : fallback;
}

function saboresCatalogoPorCategoria(productos, categoria, fallback = []) {
  const categoriaNormalizada = normalizarTextoCatalogo(categoria);
  const filtrados = (productos || [])
    .filter((producto) => producto?.activo !== false && producto?.agotado !== true)
    .filter((producto) => normalizarTextoCatalogo(producto?.linea || "Cafetería") === "cafeteria")
    .filter((producto) => normalizarTextoCatalogo(producto?.categoria) === categoriaNormalizada)
    .sort((a, b) => Number(a?.orden || 0) - Number(b?.orden || 0) || String(a?.nombre || "").localeCompare(String(b?.nombre || ""), "es"))
    .map((producto) => producto.nombre)
    .filter(Boolean);

  return filtrados.length ? filtrados : fallback;
}

export default function PanelMesasPOS({ menu, platosAgrupados, cargandoMenu = false, guardandoPedido, onEnviar, pedidoEditando = null, modoEdicionAdmin = false, onGuardarEdicion, onCancelarEdicion, navegacionAdminVisible = false, puedeVerRafa = false, onIrAdmin, onIrPedidos, onIrGerencia }) {
  const [mostrarAlertaRafiki, modalAlertaRafiki] = useAlertaRafiki();
  const [itemsMesa, setItemsMesa] = useState([crearItemNuevo()]);
  const [mesaLocal, setMesaLocal] = useState("");
  const [modoLlevar, setModoLlevar] = useState(false);
  const [clientePedido, setClientePedido] = useState("");
  const [telefonoLlevar, setTelefonoLlevar] = useState("");
  const [ubicacionLlevar, setUbicacionLlevar] = useState("");
  const [meseroLocal, setMeseroLocal] = useState("");
  const [tipoPagoMesa, setTipoPagoMesa] = useState(FORMAS_PAGO_MESA[0]);
  const [observacionesLocal, setObservacionesLocal] = useState("");
  const [errorMesa, setErrorMesa] = useState("");
  const [categoriaActivaMesa, setCategoriaActivaMesa] = useState("almuerzos");
  const [subcategoriaCafeteria, setSubcategoriaCafeteria] = useState("parfait");
  const [tamanoParfait, setTamanoParfait] = useState("");
  const [frutasParfait, setFrutasParfait] = useState([]);
  const [tipoBatido, setTipoBatido] = useState("");
  const [saborBatido, setSaborBatido] = useState("");
  const [tamanoBatido, setTamanoBatido] = useState("");
  const [baseBatido, setBaseBatido] = useState("");
  const [desayunoSeleccionado, setDesayunoSeleccionado] = useState("");
  const [acompananteDesayuno, setAcompananteDesayuno] = useState("");
  const [bebidaDesayuno, setBebidaDesayuno] = useState("");
  const [adicionalesDesayuno, setAdicionalesDesayuno] = useState([]);
  const [sandwichSeleccionado, setSandwichSeleccionado] = useState("");
  const [bebidaCalienteSeleccionada, setBebidaCalienteSeleccionada] = useState("");
  const [postreSeleccionado, setPostreSeleccionado] = useState("");
  const [pedidoMesaConfirmado, setPedidoMesaConfirmado] = useState(null);
  const [cantidadCafeteria, setCantidadCafeteria] = useState(1);
  const [catalogoProductosMesa, setCatalogoProductosMesa] = useState(() => leerProductosCatalogoStorageMesas());
  const [adicionalesAlmuerzoAbiertos, setAdicionalesAlmuerzoAbiertos] = useState({});
  const [clientesCreditoMesa, setClientesCreditoMesa] = useState(() => leerClientesCreditoGuardados());
  const [grupoEditandoAcompanantesMesa, setGrupoEditandoAcompanantesMesa] = useState(null);
  const [grupoEditandoProteinaMesa, setGrupoEditandoProteinaMesa] = useState(null);

  useEffect(() => {
    let cancelado = false;

    async function cargarClientesCreditoMesa() {
      const clientesSupabase = await listarClientesCreditoActivos();
      if (cancelado || clientesSupabase.length === 0) return;

      const nombres = clientesSupabase
        .map((cliente) => cliente?.nombre)
        .filter(Boolean);
      const respaldoLocal = leerClientesCreditoGuardados();
      const unificados = Array.from(new Set([...respaldoLocal, ...nombres]))
        .sort((a, b) => a.localeCompare(b, "es"));
      setClientesCreditoMesa(unificados);
    }

    cargarClientesCreditoMesa();

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    setItemsMesa((actual) => consolidarItemsResumenPedido(actual));
  }, [itemsMesa]);

  useEffect(() => {
    if (!pedidoEditando?.id) return;

    const itemsEditables = Array.isArray(pedidoEditando.items) && pedidoEditando.items.length > 0
      ? pedidoEditando.items.map((item, index) => ({
          ...crearItemNuevo(),
          ...item,
          id: item.id || `edit-${pedidoEditando.id}-${index}`,
          cantidad: Number(item.cantidad) || 1,
          precioPlato: Number(item.precioPlato || item.precioProteina || item.precio || 0),
          precioProteina: Number(item.precioProteina || item.precioPlato || item.precio || 0),
          acompanantes: Array.isArray(item.acompanantes) ? item.acompanantes : [],
          adicionalesAlmuerzo: Array.isArray(item.adicionalesAlmuerzo) ? item.adicionalesAlmuerzo : [],
        }))
      : [crearItemNuevo()];

    const esLlevar = String(pedidoEditando.tipo_pedido || pedidoEditando.mesa || "").toLowerCase().includes("llevar");
    setItemsMesa(itemsEditables);
    setModoLlevar(esLlevar);
    setMesaLocal(esLlevar ? "" : (pedidoEditando.mesa || pedidoEditando.ubicacion || ""));
    setClientePedido(pedidoEditando.cliente || pedidoEditando.cliente_nombre || "");
    setTelefonoLlevar(pedidoEditando.telefono || "");
    setUbicacionLlevar(esLlevar ? (pedidoEditando.ubicacion || "") : "");
    setMeseroLocal(pedidoEditando.mesero || "");
    setTipoPagoMesa(pedidoEditando.tipo_pago || FORMAS_PAGO_MESA[0]);
    setObservacionesLocal(pedidoEditando.observaciones || "");
    setPedidoMesaConfirmado(null);
    setErrorMesa("");
    setCategoriaActivaMesa("almuerzos");
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 80);
  }, [pedidoEditando]);

  useEffect(() => {
    let activo = true;

    cargarCatalogoProductosAdmin()
      .then((resultado) => {
        if (!activo || !resultado?.ok || !Array.isArray(resultado.productos) || !resultado.productos.length) return;
        setCatalogoProductosMesa(resultado.productos);
        guardarProductosCatalogoStorageMesas(resultado.productos);
      })
      .catch(() => {
        // No bloquea mesas: conserva catálogo local/fallback si Supabase no responde.
      });

    return () => {
      activo = false;
    };
  }, []);

  const cafeteriaParfaitTamanos = useMemo(
    () => productosCatalogoPorCategoria(catalogoProductosMesa, "Parfait", CAFETERIA_PARFAIT_TAMANOS),
    [catalogoProductosMesa]
  );
  const cafeteriaDesayunos = useMemo(
    () => productosCatalogoPorCategoria(catalogoProductosMesa, "Desayunos", CAFETERIA_DESAYUNOS),
    [catalogoProductosMesa]
  );
  const cafeteriaSandwiches = useMemo(
    () => productosCatalogoPorCategoria(catalogoProductosMesa, "Sándwiches y fritos", CAFETERIA_SANDWICHES),
    [catalogoProductosMesa]
  );
  const cafeteriaBebidasCalientes = useMemo(
    () => productosCatalogoPorCategoria(catalogoProductosMesa, "Bebidas", CAFETERIA_BEBIDAS_CALIENTES),
    [catalogoProductosMesa]
  );
  const cafeteriaPostres = useMemo(
    () => productosCatalogoPorCategoria(catalogoProductosMesa, "Postres y ensaladas", CAFETERIA_POSTRES),
    [catalogoProductosMesa]
  );
  const cafeteriaBatidosCremososSabores = useMemo(
    () => saboresCatalogoPorCategoria(catalogoProductosMesa, "Batidos cremosos", CAFETERIA_BATIDOS_CREMOSOS_SABORES),
    [catalogoProductosMesa]
  );
  const cafeteriaBatidosRefrescantesSabores = useMemo(
    () => saboresCatalogoPorCategoria(catalogoProductosMesa, "Batidos refrescantes", CAFETERIA_BATIDOS_REFRESCANTES_SABORES),
    [catalogoProductosMesa]
  );
  const cafeteriaJugosTradicionalesSabores = useMemo(
    () => saboresCatalogoPorCategoria(catalogoProductosMesa, "Jugos tradicionales", CAFETERIA_JUGOS_TRADICIONALES_SABORES),
    [catalogoProductosMesa]
  );
  const restauranteAdicionalesAlmuerzo = useMemo(
    () => productosCatalogoPorCategoria(
      catalogoProductosMesa,
      "Adicionales almuerzo",
      [
        { nombre: "Papas Fritas", precio: 5000 },
        { nombre: "Porción de Pechuga o cerdo", precio: 7000 }
      ],
      { linea: "Restaurante" }
    ),
    [catalogoProductosMesa]
  );

  const itemsAlmuerzoMesa = useMemo(
    () => itemsMesa.filter((item) => item.categoria !== "cafeteria"),
    [itemsMesa]
  );

  const itemsConProducto = useMemo(
    () => itemsMesa.filter((item) => item.plato || item.proteina || item.producto),
    [itemsMesa]
  );
  const hayProductoSeleccionadoMesa = itemsConProducto.length > 0;
  const itemsConModoLlevar = useMemo(
    () => itemsConProducto.map((item) => ({ ...item, paraLlevar: Boolean(modoLlevar) })),
    [itemsConProducto, modoLlevar]
  );
  const total = useMemo(() => calcularTotalItems(itemsConModoLlevar), [itemsConModoLlevar]);
  const gruposResumenMesa = useMemo(() => agruparItemsResumenPedido(itemsConModoLlevar), [itemsConModoLlevar]);
  const acompanantesMesaDisponiblesResumen = useMemo(
    () => ["Con todo", ...(Array.isArray(menu.acompanantes) ? menu.acompanantes.filter((acompanante) => acompanante !== "Con todo") : [])],
    [menu.acompanantes]
  );
  const itemAlmuerzoActivo = itemsAlmuerzoMesa[itemsAlmuerzoMesa.length - 1];
  const itemNavMesa = itemAlmuerzoActivo || itemsAlmuerzoMesa[0] || itemsMesa[0];

  function irPasoMesas(paso) {
    vibracionCortaMesas();

    if (paso === "proteina") {
      setCategoriaActivaMesa("almuerzos");
      irAElementoMesas("mesa-categorias-top", 72, "start");
      return;
    }

    if (paso === "acompanantes") {
      setCategoriaActivaMesa("almuerzos");
      const destino = itemNavMesa?.id ? `mesa-paso-acompanantes-${itemNavMesa.id}` : "mesa-categorias-top";
      irAElementoMesas(destino, 72, "center");
      return;
    }

    if (paso === "resumen") {
      irAElementoMesas("mesa-confirmacion-final", 72, "start");
      return;
    }

    if (paso === "datos") {
      irAElementoMesas("mesa-datos-final", 72, "start");
    }
  }


  function actualizarItemMesa(id, cambios) {
    setItemsMesa((actual) =>
      actual.map((item) => (item.id === id ? { ...item, ...cambios } : item))
    );
  }

  function cambiarPlatoMesa(id, platoSeleccionado) {
    vibracionCortaMesas();
    setItemsMesa((actual) =>
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
          acompanantes: sinAcompanantes ? [] : item.acompanantes || [],
          observacionAcompanantes: sinAcompanantes ? "" : item.observacionAcompanantes || "",
          paraLlevar: false
        };
      })
    );

    const sinAcompanantes = esProductoSinAcompanantes(platoSeleccionado);

    irAElementoMesas(sinAcompanantes ? `mesa-confirmacion-${id}` : `mesa-paso-acompanantes-${id}`, 180, "center");
  }

  function cambiarAcompananteMesa(id, acompanante) {
    vibracionCortaMesas();
    setItemsMesa((actual) =>
      actual.map((item) => {
        if (item.id !== id) return item;

        if (esProductoSinAcompanantes(item)) {
          return { ...item, acompanantes: [] };
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
          return item;
        }

        const nuevosAcompanantes = [...acompanantesActuales, acompanante];

        return { ...item, acompanantes: nuevosAcompanantes };
      })
    );
  }

  function alternarAdicionalAlmuerzoMesa(id, adicional) {
    vibracionCortaMesas();
    setItemsMesa((actual) =>
      actual.map((item) => {
        if (item.id !== id) return item;
        const actuales = Array.isArray(item.adicionalesAlmuerzo) ? item.adicionalesAlmuerzo : [];
        const existe = actuales.some((x) => x.nombre === adicional.nombre);
        return {
          ...item,
          adicionalesAlmuerzo: existe
            ? actuales.filter((x) => x.nombre !== adicional.nombre)
            : [...actuales, { nombre: adicional.nombre, precio: Number(adicional.precio || 0) }]
        };
      })
    );
  }

  function alternarPanelAdicionalesAlmuerzo(id) {
    setAdicionalesAlmuerzoAbiertos((actual) => ({ ...actual, [id]: !actual[id] }));
  }

  function agregarAlmuerzoMesa() {
    const nuevoItem = crearItemNuevo();
    vibracionCortaMesas();
    setItemsMesa((actual) => [...actual, nuevoItem]);

    setTimeout(() => {
      const elemento = document.getElementById(`mesa-producto-${nuevoItem.id}`);
      if (elemento) {
        elemento.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 120);
  }

  function agregarAlmuerzoRapidoYSiguiente() {
    agregarAlmuerzoMesa();
  }

  function quitarAlmuerzoMesa(id) {
    quitarItemPedidoMesa(id);
  }

  function mostrarErrorMesa(mensaje, opciones = {}) {
    setErrorMesa(mensaje);
    mostrarAlertaRafiki({
      tipo: opciones.tipo || "advertencia",
      titulo: opciones.titulo || "Falta un paso",
      mensaje,
      textoCerrar: "Entendido"
    });
    if (opciones.elementoId) {
      irAElementoMesas(opciones.elementoId, opciones.offset ?? 90, opciones.block || "center");
    }
  }

  function quitarItemPedidoMesa(id) {
    quitarGrupoPedidoMesa([id]);
  }

  function actualizarCantidadGrupoMesa(ids = [], cantidad) {
    const idsGrupo = new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean));
    if (idsGrupo.size === 0) return;

    const cantidadNormalizada = normalizarCantidadResumen(cantidad);

    setItemsMesa((actual) => {
      let primerItemActualizado = false;
      const siguientesItems = [];

      actual.forEach((item) => {
        if (!idsGrupo.has(item.id)) {
          siguientesItems.push(item);
          return;
        }

        if (!primerItemActualizado) {
          siguientesItems.push({ ...item, cantidad: cantidadNormalizada });
          primerItemActualizado = true;
        }
      });

      return siguientesItems.length > 0 ? siguientesItems : [crearItemNuevo()];
    });
    setErrorMesa("");
  }

  function quitarGrupoPedidoMesa(ids = []) {
    const idsGrupo = new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean));
    if (idsGrupo.size === 0) return;

    setItemsMesa((actual) => {
      const filtrados = actual.filter((item) => !idsGrupo.has(item.id));
      return filtrados.length > 0 ? filtrados : [crearItemNuevo()];
    });
    setErrorMesa("");
  }

  function actualizarProteinaGrupoMesa(ids = [], platoSeleccionado = {}) {
    const idsGrupo = new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean));
    if (idsGrupo.size === 0 || !platoSeleccionado?.nombre) return;

    const sinAcompanantes = esProductoSinAcompanantes(platoSeleccionado);

    setItemsMesa((actual) =>
      actual.map((item) => {
        if (!idsGrupo.has(item.id)) return item;

        return {
          ...item,
          categoria: platoSeleccionado.categoria || "",
          plato: platoSeleccionado.nombre || "",
          proteina: platoSeleccionado.nombre || "",
          precioPlato: Number(platoSeleccionado.precio) || 0,
          precioProteina: Number(platoSeleccionado.precio) || 0,
          acompanantes: sinAcompanantes ? [] : item.acompanantes || [],
          observacionAcompanantes: sinAcompanantes ? "" : item.observacionAcompanantes || "",
          paraLlevar: false
        };
      })
    );
    setErrorMesa("");
  }

  function actualizarAcompanantesGrupoMesa(ids = [], cambios = {}) {
    const idsGrupo = new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean));
    if (idsGrupo.size === 0) return;

    const acompanantes = Array.isArray(cambios.acompanantes) ? cambios.acompanantes : [];
    const observacionAcompanantes = String(cambios.observacionAcompanantes || "").trim().slice(0, 60);

    setItemsMesa((actual) =>
      actual.map((item) => {
        if (!idsGrupo.has(item.id)) return item;
        if (esProductoSinAcompanantes(item)) return { ...item, acompanantes: [], observacionAcompanantes: "" };

        return {
          ...item,
          acompanantes,
          observacionAcompanantes
        };
      })
    );
    setErrorMesa("");
  }

  function seleccionarMesaLocal(mesa) {
    setErrorMesa("");
    if (!modoLlevar && mesaLocal === mesa) {
      setMesaLocal("");
      return;
    }
    setModoLlevar(false);
    setMesaLocal(mesa);
  }

  function alternarModoLlevar() {
    setErrorMesa("");
    if (modoLlevar) {
      setModoLlevar(false);
      return;
    }
    setModoLlevar(true);
    setMesaLocal("");
  }

  function reiniciarPedidoMesa() {
    if (modoEdicionAdmin && pedidoEditando?.id) {
      onCancelarEdicion?.();
      return;
    }

    setItemsMesa([crearItemNuevo()]);
    setMesaLocal("");
    setModoLlevar(false);
    setClientePedido("");
    setTelefonoLlevar("");
    setUbicacionLlevar("");
    setMeseroLocal("");
    setTipoPagoMesa(FORMAS_PAGO_MESA[0]);
    setObservacionesLocal("");
    setErrorMesa("");

    // Limpia también los selectores de cafetería para evitar que el siguiente pedido
    // herede tamaño, cereal, frutas o adicionales del pedido anterior.
    setTamanoParfait("");
    setFrutasParfait([]);
    setTipoBatido("");
    setSaborBatido("");
    setTamanoBatido("");
    setBaseBatido("");
    setDesayunoSeleccionado("");
    setAcompananteDesayuno("");
    setBebidaDesayuno("");
    setAdicionalesDesayuno([]);
    setSandwichSeleccionado("");
    setBebidaCalienteSeleccionada("");
    setPostreSeleccionado("");
    setCantidadCafeteria(1);
    setPedidoMesaConfirmado(null);
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 80);
  }

  function limpiarSeleccionCafeteria() {
    // Al agregar un producto de cafetería, limpiamos todos los selectores
    // para que el siguiente producto empiece desde cero y no parezca seleccionado.
    setTamanoParfait("");
    setFrutasParfait([]);
    setTipoBatido("");
    setSaborBatido("");
    setTamanoBatido("");
    setBaseBatido("");
    setDesayunoSeleccionado("");
    setAcompananteDesayuno("");
    setBebidaDesayuno("");
    setAdicionalesDesayuno([]);
    setSandwichSeleccionado("");
    setBebidaCalienteSeleccionada("");
    setPostreSeleccionado("");
    setCantidadCafeteria(1);
  }

  function agregarItemCafeteria(item, destino = "categorias") {
    vibracionCortaMesas();
    setItemsMesa((actual) => [...actual, item]);
    limpiarSeleccionCafeteria();
    setErrorMesa("");
    irAElementoMesas(destino === "resumen" ? "mesa-confirmacion-final" : "mesa-categorias-top", 120, "start");
  }

  function toggleFrutaParfait(fruta) {
    setFrutasParfait((actual) => {
      if (actual.includes(fruta)) return actual.filter((item) => item !== fruta);
      if (actual.length >= 3) return actual;
      return [...actual, fruta];
    });
  }

  function agregarParfaitMesa(destino = "categorias") {
    if (!tamanoParfait) {
      mostrarErrorMesa("Selecciona el tamaño del parfait.");
      return;
    }

    if (frutasParfait.length === 0) {
      mostrarErrorMesa("Selecciona al menos una fruta para el parfait.");
      return;
    }

    const precioBase = precioPorNombre(cafeteriaParfaitTamanos, tamanoParfait);
    const extraFrutas = frutasParfait.length === 3 ? 1000 : 0;
    const frutasSeleccionadas = [...frutasParfait];
    const descripcionParfait = `Parfait ${tamanoParfait} - Frutas: ${frutasSeleccionadas.join(", ")}`;

    agregarItemCafeteria(crearItemCafeteria({
      tipo: "Parfait",
      producto: descripcionParfait,
      precio: precioBase + extraFrutas,
      cantidad: cantidadCafeteria,
      tamano: tamanoParfait,
      frutas: frutasSeleccionadas,
      extraFrutas,
      detalle_impresion: descripcionParfait
    }), destino);

    setFrutasParfait([]);
  }

  function cambiarTipoBatidoMesa(tipo) {
    setTipoBatido(tipo);
    setSaborBatido("");
    setTamanoBatido("");
    setBaseBatido(tipo === "cremoso" ? "Helado" : "");
    setErrorMesa("");
  }

  function agregarBatidoMesa(destino = "categorias") {
    if (!tipoBatido) {
      mostrarErrorMesa("Selecciona el tipo de bebida.");
      return;
    }

    if (!saborBatido) {
      mostrarErrorMesa("Selecciona el sabor.");
      return;
    }

    if (!tamanoBatido) {
      mostrarErrorMesa("Selecciona el tamaño.");
      return;
    }

    if ((tipoBatido === "cremoso" || tipoBatido === "jugo") && !baseBatido) {
      mostrarErrorMesa("Selecciona la base.");
      return;
    }

    const tamanos = tipoBatido === "cremoso"
      ? CAFETERIA_BATIDOS_CREMOSOS_TAMANOS
      : CAFETERIA_BATIDOS_REFRESCANTES_TAMANOS;
    const precio = precioPorNombre(tamanos, tamanoBatido);
    const nombreTipo = tipoBatido === "cremoso"
      ? "Batido cremoso"
      : tipoBatido === "refrescante"
        ? "Batido refrescante"
        : "Jugo tradicional";

    agregarItemCafeteria(crearItemCafeteria({
      tipo: nombreTipo,
      producto: `${saborBatido} ${tamanoBatido}`,
      precio,
      cantidad: cantidadCafeteria,
      tamano: tamanoBatido,
      base: baseBatido
    }), destino);
  }

  function agregarDesayunoMesa(destino = "categorias") {
    if (!desayunoSeleccionado) {
      mostrarErrorMesa("Selecciona un desayuno.");
      return;
    }

    const desayunoPrincipal = cafeteriaDesayunos.some((item) => item.nombre === desayunoSeleccionado);
    if (desayunoPrincipal && !acompananteDesayuno) {
      mostrarErrorMesa("Selecciona el acompañante del desayuno.");
      return;
    }

    if (desayunoPrincipal && !bebidaDesayuno) {
      mostrarErrorMesa("Selecciona la bebida del desayuno.");
      return;
    }

    const precioBase = precioPorNombre([...cafeteriaDesayunos, ...CAFETERIA_OTROS_DESAYUNOS], desayunoSeleccionado);
    const precioAdicionales = adicionalesDesayuno.reduce((suma, item) => suma + Number(item.precio || 0), 0);

    agregarItemCafeteria(crearItemCafeteria({
      tipo: "Desayuno",
      producto: desayunoSeleccionado,
      precio: precioBase + precioAdicionales,
      cantidad: cantidadCafeteria,
      acompanante: acompananteDesayuno,
      bebida: bebidaDesayuno,
      adicionales: adicionalesDesayuno
    }), destino);

    setBebidaDesayuno("");
    setAdicionalesDesayuno([]);
  }

  function agregarProductoSimpleCafeteria(tipo, producto, precio, destino = "categorias") {
    if (!producto) {
      mostrarErrorMesa(`Selecciona un producto de ${tipo}.`);
      return;
    }

    agregarItemCafeteria(crearItemCafeteria({
      tipo,
      producto,
      precio,
      cantidad: cantidadCafeteria
    }), destino);
  }

  function seleccionarCategoriaMesa(categoria) {
    vibracionCortaMesas();
    setCategoriaActivaMesa(categoria);
    setErrorMesa("");
    irAElementoMesas("mesa-categorias-top", 80, "start");
  }

  function agregarProductoCafeteriaDesdePedido(subcategoria = null) {
    vibracionCortaMesas();
    setCategoriaActivaMesa("cafeteria");
    if (subcategoria) setSubcategoriaCafeteria(subcategoria);
    setErrorMesa("");
    irAElementoMesas("mesa-categorias-top", 80, "start");
  }

  function agregarAlmuerzoDesdeResumen() {
    setCategoriaActivaMesa("almuerzos");
    agregarAlmuerzoRapidoYSiguiente();
  }

  async function enviarPedidoMesa() {
    if (itemsConProducto.length === 0) {
      mostrarErrorMesa("Agrega al menos un producto.", { elementoId: "mesa-categorias-top" });
      return;
    }

    if (!modoLlevar && !mesaLocal.trim()) {
      mostrarErrorMesa("Selecciona la mesa.", { elementoId: "mesa-datos-final" });
      return;
    }

    if (!meseroLocal.trim()) {
      mostrarErrorMesa("Selecciona el mesero.", { elementoId: "mesa-datos-final" });
      return;
    }

    if (tipoPagoMesa === FORMA_PAGO_CREDITO && !clientePedido.trim()) {
      mostrarErrorMesa("Para pago a crédito debes escribir o seleccionar el nombre del cliente.", { elementoId: "mesa-cliente-credito" });
      return;
    }

    const payloadMesa = {
      items: itemsConModoLlevar,
      modoLlevar,
      mesa: modoLlevar ? "Llevar" : mesaLocal,
      cliente: clientePedido,
      telefono: telefonoLlevar,
      ubicacion: ubicacionLlevar,
      mesero: meseroLocal,
      tipoPago: tipoPagoMesa,
      observaciones: observacionesLocal
    };

    if (modoEdicionAdmin && pedidoEditando?.id) {
      const pedidoActualizado = await onGuardarEdicion?.(pedidoEditando.id, payloadMesa);
      if (pedidoActualizado) {
        onCancelarEdicion?.({ volverAdmin: true });
      }
      return;
    }

    const pedidoGuardado = await onEnviar(payloadMesa);

    if (pedidoGuardado) {
      if (tipoPagoMesa === FORMA_PAGO_CREDITO) {
        const listaLocal = guardarClienteCredito(clientePedido);
        setClientesCreditoMesa(listaLocal);

        const clienteSupabase = await asegurarClienteCredito(clientePedido);
        if (clienteSupabase?.nombre) {
          setClientesCreditoMesa((prev) => Array.from(new Set([...prev, clienteSupabase.nombre]))
            .sort((a, b) => a.localeCompare(b, "es")));
        }
      }
      setPedidoMesaConfirmado(pedidoGuardado);
    }
  }

  if (pedidoMesaConfirmado) {
    return (
      <ConfirmacionPedidoMesa
        pedido={pedidoMesaConfirmado}
        modoLlevar={modoLlevar}
        mesaLocal={mesaLocal}
        onReiniciar={reiniciarPedidoMesa}
      />
    );
  }

  return (
    <>
    <main className="order-layout mesas-cliente-layout mesas-panel-layout">
      <section className="card card-pad" id="mesa-categorias-top">
        <div className="mesa-panel-title">
          <h2>🍽️ Panel Mesas</h2>
        </div>

        {modoEdicionAdmin && pedidoEditando?.id && (
          <div className="alert alert-warning edición-pedido-mesas" role="alert">
            <strong>⚠️ Estás editando el pedido #{pedidoEditando.numero_pedido || pedidoEditando.id}</strong>
            <p className="muted small">Los cambios reemplazarán el pedido original y solo están permitidos para el rol administrador.</p>
            <button type="button" className="button light" onClick={() => onCancelarEdicion?.()}>
              Cancelar edición
            </button>
          </div>
        )}

        <div className="mesa-step-nav" aria-label="Navegación rápida del pedido">
          <button type="button" onClick={() => irPasoMesas("proteina")} title="Escoge la proteína">1</button>
          <button type="button" onClick={() => irPasoMesas("acompanantes")} title="Escoge un acompañante">2</button>
          <button type="button" onClick={() => irPasoMesas("resumen")} title="Resumen del pedido">R</button>
          <button type="button" onClick={() => irPasoMesas("datos")} title="Datos de la mesa">3</button>
        </div>

        {navegacionAdminVisible && (
          <div className="mesa-admin-nav" aria-label="Navegación administrativa">
            <button type="button" onClick={onIrPedidos}>Pedidos hoy</button>
            <button type="button" onClick={onIrAdmin}>Admin</button>
            {puedeVerRafa && <button type="button" onClick={onIrGerencia}>Gerencia</button>}
          </div>
        )}

        <MesaTabs
          categoriaActiva={categoriaActivaMesa}
          onSeleccionar={seleccionarCategoriaMesa}
        />

        {categoriaActivaMesa === "almuerzos" ? (
          cargandoMenu ? (
            <div className="box soft">Cargando menú diario...</div>
          ) : menu.platos_detalle.length === 0 ? (
            <div className="box soft">No hay menú diario configurado.</div>
          ) : (
            <>
              {itemsAlmuerzoMesa.map((item) => {
              const tienePlato = Boolean(item.plato || item.proteina);
              const itemSinAcompanantes = esProductoSinAcompanantes(item);
              const acompanantesItem = Array.isArray(item.acompanantes) ? item.acompanantes : [];
              const acompanantesMesaDisponibles = ["Con todo", ...menu.acompanantes.filter((acompanante) => acompanante !== "Con todo")];
              return (
                <div key={item.id} id={`mesa-producto-${item.id}`} className="product-card">
                  {itemsAlmuerzoMesa.length > 1 && (
                    <div className="product-card-header" style={{ justifyContent: "flex-end" }}>
                      <button type="button" className="mini-danger" onClick={() => quitarAlmuerzoMesa(item.id)}>
                        Quitar
                      </button>
                    </div>
                  )}

                  <div className="step-title">
                    <span className="step-number">1</span>
                    <div>
                      <h4>Escoge la proteína</h4>
                    </div>
                  </div>

                  {tienePlato && (
                    <div className="selected-dish pos-selected-dish">
                      <span>✓ {item.plato || item.proteina}</span>
                      <strong>{dinero(item.precioPlato || item.precioProteina)}</strong>
                    </div>
                  )}

                  {Object.entries(platosAgrupados).map(([categoria, platos]) => (
                    <div key={categoria} className="category-block">
                      <h3 className="category-title">{categoria}</h3>

                      <div className="option-grid">
                        {platos.map((plato) => (
                          <button
                            key={`${plato.categoria}-${plato.nombre}`}
                            type="button"
                            onClick={() => cambiarPlatoMesa(item.id, plato)}
                            className={`option ${item.plato === plato.nombre ? "selected" : ""}`}
                          >
                            <div>{plato.nombre}</div>
                            <small>{dinero(plato.precio)}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {tienePlato && !itemSinAcompanantes && (
                    <div id={`mesa-paso-acompanantes-${item.id}`} className="fade-step" style={{ marginTop: 18 }}>
                      <div className="step-title">
                        <span className="step-number">2</span>
                        <div>
                          <h4>Escoge un acompañante</h4>
                        </div>
                      </div>

                      <div className="chips">
                        {acompanantesMesaDisponibles.length === 0 ? (
                          <span className="muted">No hay acompañantes configurados.</span>
                        ) : (
                          acompanantesMesaDisponibles.map((acompanante) => {
                            const seleccionado = acompanantesItem.includes(acompanante);
                            const bloqueado =
                              !seleccionado && acompanantesItem.length >= MAX_ACOMPANANTES_CLIENTE;

                            return (
                              <button
                                key={acompanante}
                                type="button"
                                onClick={() => cambiarAcompananteMesa(item.id, acompanante)}
                                disabled={bloqueado}
                                className={`chip ${seleccionado ? "selected" : ""} ${bloqueado ? "blocked" : ""}`}
                              >
                                {seleccionado ? "✓ " : "+ "}{acompanante}
                              </button>
                            );
                          })
                        )}
                      </div>

                      <div className="mesa-adicionales-almuerzo">
                        <button
                          type="button"
                          className="mini-btn"
                          onClick={() => alternarPanelAdicionalesAlmuerzo(item.id)}
                        >
                          {adicionalesAlmuerzoAbiertos[item.id] ? "Ocultar adicionales" : "+ Adicionales"}
                        </button>

                        {adicionalesAlmuerzoAbiertos[item.id] && (
                          <div className="chips adicionales-almuerzo-chips">
                            {restauranteAdicionalesAlmuerzo.map((adicional) => {
                              const adicionalesItem = Array.isArray(item.adicionalesAlmuerzo) ? item.adicionalesAlmuerzo : [];
                              const seleccionado = adicionalesItem.some((x) => x.nombre === adicional.nombre);

                              return (
                                <button
                                  key={adicional.nombre}
                                  type="button"
                                  onClick={() => alternarAdicionalAlmuerzoMesa(item.id, adicional)}
                                  className={`chip ${seleccionado ? "selected" : ""}`}
                                >
                                  {seleccionado ? "✓ " : "+ "}{adicional.nombre} · {dinero(adicional.precio)}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                  {tienePlato && itemSinAcompanantes && (
                    <div className="box soft fade-step" style={{ marginTop: 18 }}>
                      <p className="muted" style={{ margin: 0 }}>{MENSAJE_ACOMPANANTES_DEL_DIA}</p>
                    </div>
                  )}

                  {tienePlato && (
                    <div id={`mesa-confirmacion-${item.id}`} className="fade-step pedido-paso-compacto" style={{ marginTop: 12 }}>
                      <div className="box compact-box quantity-box">
                        <strong>Cantidad de {item.plato || item.proteina || "producto"}</strong>
                        <SelectorCantidad
                          cantidad={item.cantidad}
                          onChange={(cantidad) => actualizarItemMesa(item.id, { cantidad })}
                        />
                      </div>

                      {!itemSinAcompanantes && (
                        <CampoTexto
                          etiqueta="Observación sobre acompañantes"
                          value={item.observacionAcompanantes || ""}
                          onChange={(valor) => actualizarItemMesa(item.id, { observacionAcompanantes: valor })}
                          placeholder="Ejemplo: sin ensalada, más arroz..."
                          multiline
                          rows={2}
                        />
                      )}

                      <div className="total-row compact-total-row">
                        <span>Subtotal</span>
                        <strong>{dinero(calcularTotalItem(item))}</strong>
                      </div>

                    </div>
                  )}
                </div>
              );
            })}

            {hayProductoSeleccionadoMesa && (
              <div className="mesa-clean-actions">
                <button
                  type="button"
                  onClick={() => agregarProductoCafeteriaDesdePedido()}
                  className="button cafeteria-action"
                >
                  Agregar cafetería
                </button>

                <button
                  type="button"
                  onClick={agregarAlmuerzoRapidoYSiguiente}
                  className="button add-meal pos-primary-action"
                >
                  Agregar otro almuerzo
                </button>

                <button
                  type="button"
                  onClick={() => irAElementoMesas("mesa-confirmacion-final", 120)}
                  className="button continue-button"
                  style={{ background: "#16a34a" }}
                >
                  Ver resumen y continuar
                </button>
              </div>
            )}
            </>
          )
        ) : (
          <div className="cafeteria-placeholder fade-step">
            <div className="cafeteria-grid cafeteria-actions compact-cafeteria-actions">
              {[
                ["parfait", "Parfait"],
                ["batidos", "Batidos"],
                ["desayunos", "Desayunos"],
                ["sandwich", "Comida"],
                ["bebidas", "Bebidas"],
                ["postres", "Postres"]
              ].map(([clave, nombre]) => (
                <button
                  key={clave}
                  type="button"
                  onClick={() => { setSubcategoriaCafeteria(clave); setErrorMesa(""); irAElementoMesas("mesa-cafeteria-panel", 100, "start"); }}
                  className={`cafeteria-card cafeteria-button ${subcategoriaCafeteria === clave ? "active" : ""}`}
                >
                  <strong>{nombre}</strong>
                </button>
              ))}
            </div>

            <div id="mesa-cafeteria-panel" />

            {errorMesa && (
              <div className="finalizar-error" role="alert" aria-live="polite" style={{ marginTop: 10 }}>{errorMesa}</div>
            )}

            {subcategoriaCafeteria === "parfait" && (
              <div className="cafeteria-panel fade-step">
                <h3>Parfait</h3>
                <div className="option-grid">
                  {cafeteriaParfaitTamanos.map((item) => (
                    <button key={item.nombre} type="button" onClick={() => setTamanoParfait(item.nombre)} className={`option ${tamanoParfait === item.nombre ? "selected" : ""}`}>
                      <div>{item.nombre}</div>
                      <small>{dinero(item.precio)}</small>
                    </button>
                  ))}
                </div>

                <h4>Frutas disponibles</h4>
                <div className="chips">
                  {CAFETERIA_FRUTAS.map((fruta) => {
                    const seleccionado = frutasParfait.includes(fruta);
                    const bloqueado = !seleccionado && frutasParfait.length >= 3;
                    return (
                      <button key={fruta} type="button" disabled={bloqueado} onClick={() => toggleFrutaParfait(fruta)} className={`chip ${seleccionado ? "selected" : ""} ${bloqueado ? "blocked" : ""}`}>
                        {seleccionado ? "✓ " : "+ "}{fruta}
                      </button>
                    );
                  })}
                </div>
                <p className="muted">Máximo 3 frutas. Al escoger 3 frutas se suma automáticamente {dinero(1000)}.</p>


                <div className="box compact-box quantity-box">
                  <strong>Cantidad</strong>
                  <SelectorCantidad
                    cantidad={cantidadCafeteria}
                    onChange={setCantidadCafeteria}
                  />
                </div>

                <div className="total-row compact-total-row">
                  <span>Subtotal parfait</span>
                  <strong>{dinero((precioPorNombre(cafeteriaParfaitTamanos, tamanoParfait) + (frutasParfait.length === 3 ? 1000 : 0)) * cantidadCafeteria)}</strong>
                </div>
                <button type="button" className="button add-meal" onClick={agregarParfaitMesa}>+agregar otro producto</button>
              </div>
            )}

            {subcategoriaCafeteria === "batidos" && (
              <div className="cafeteria-panel fade-step">
                <h3>Batidos</h3>
                <h4>Tipo</h4>
                <div className="option-grid">
                  {[
                    { clave: "cremoso", nombre: "Batido cremoso" },
                    { clave: "refrescante", nombre: "Batido refrescante" },
                    { clave: "jugo", nombre: "Jugo tradicional" }
                  ].map((item) => (
                    <button key={item.clave} type="button" onClick={() => cambiarTipoBatidoMesa(item.clave)} className={`option ${tipoBatido === item.clave ? "selected" : ""}`}>
                      <div>{item.nombre}</div>
                    </button>
                  ))}
                </div>
                {tipoBatido && (
                  <>
                    <h4>Sabor</h4>
                    <div className="chips">
                      {(tipoBatido === "cremoso"
                        ? cafeteriaBatidosCremososSabores
                        : tipoBatido === "refrescante"
                          ? cafeteriaBatidosRefrescantesSabores
                          : cafeteriaJugosTradicionalesSabores
                      ).map((sabor) => (
                        <button key={sabor} type="button" onClick={() => setSaborBatido(sabor)} className={`chip ${saborBatido === sabor ? "selected" : ""}`}>{saborBatido === sabor ? "✓ " : "+ "}{sabor}</button>
                      ))}
                    </div>
                    {tipoBatido === "cremoso" && (
                      <>
                        <h4>Base</h4>
                        <div className="chips">
                          {CAFETERIA_BATIDOS_BASES.map((base) => (
                            <button key={base} type="button" onClick={() => setBaseBatido(base)} className={`chip ${baseBatido === base ? "selected" : ""}`}>{baseBatido === base ? "✓ " : "+ "}{base}</button>
                          ))}
                        </div>
                      </>
                    )}
                    {tipoBatido === "jugo" && (
                      <>
                        <h4>Base</h4>
                        <div className="chips">
                          {CAFETERIA_JUGOS_BASES.map((base) => (
                            <button key={base} type="button" onClick={() => setBaseBatido(base)} className={`chip ${baseBatido === base ? "selected" : ""}`}>{baseBatido === base ? "✓ " : "+ "}{base}</button>
                          ))}
                        </div>
                      </>
                    )}
                    <h4>Tamaño</h4>
                    <div className="option-grid">
                      {(tipoBatido === "cremoso" ? CAFETERIA_BATIDOS_CREMOSOS_TAMANOS : CAFETERIA_BATIDOS_REFRESCANTES_TAMANOS).map((item) => (
                        <button key={item.nombre} type="button" onClick={() => setTamanoBatido(item.nombre)} className={`option ${tamanoBatido === item.nombre ? "selected" : ""}`}>
                          <div>{item.nombre}</div>
                          <small>{dinero(item.precio)}</small>
                        </button>
                      ))}
                    </div>

                    <div className="box compact-box quantity-box">
                      <strong>Cantidad</strong>
                      <SelectorCantidad
                        cantidad={cantidadCafeteria}
                        onChange={setCantidadCafeteria}
                      />
                    </div>
                    <button type="button" className="button add-meal" onClick={agregarBatidoMesa}>+agregar otro producto</button>
                  </>
                )}
              </div>
            )}

            {subcategoriaCafeteria === "desayunos" && (
              <div className="cafeteria-panel fade-step">
                <h3>Desayunos</h3>
                <div className="option-grid">
                  {cafeteriaDesayunos.map((item) => (
                    <button key={item.nombre} type="button" onClick={() => setDesayunoSeleccionado(item.nombre)} className={`option ${desayunoSeleccionado === item.nombre ? "selected" : ""}`}>
                      <div>{item.nombre}</div>
                      <small>{dinero(item.precio)}</small>
                    </button>
                  ))}
                </div>
                <h4>Acompañante</h4>
                <div className="chips">
                  {CAFETERIA_ACOMPANANTES_DESAYUNO.map((acompanante) => (
                    <button key={acompanante} type="button" onClick={() => setAcompananteDesayuno(acompanante)} className={`chip ${acompananteDesayuno === acompanante ? "selected" : ""}`}>{acompananteDesayuno === acompanante ? "✓ " : "+ "}{acompanante}</button>
                  ))}
                </div>
                <h4>Bebida</h4>
                <div className="chips">
                  {CAFETERIA_BEBIDAS_DESAYUNO.map((bebida) => (
                    <button key={bebida} type="button" onClick={() => setBebidaDesayuno(bebida)} className={`chip ${bebidaDesayuno === bebida ? "selected" : ""}`}>{bebidaDesayuno === bebida ? "✓ " : "+ "}{bebida}</button>
                  ))}
                </div>
                <h4>Otros desayunos</h4>
                <div className="option-grid compact-options">
                  {CAFETERIA_OTROS_DESAYUNOS.map((item) => (
                    <button key={item.nombre} type="button" onClick={() => { setDesayunoSeleccionado(item.nombre); setAcompananteDesayuno(""); setBebidaDesayuno(""); setAdicionalesDesayuno([]); }} className={`option ${desayunoSeleccionado === item.nombre ? "selected" : ""}`}>
                      <div>{item.nombre}</div>
                      <small>{dinero(item.precio)}</small>
                    </button>
                  ))}
                </div>
                <div className="box compact-box quantity-box">
                  <strong>Cantidad</strong>
                  <SelectorCantidad
                    cantidad={cantidadCafeteria}
                    onChange={setCantidadCafeteria}
                  />
                </div>

                <div className="total-row compact-total-row">
                  <span>Subtotal desayuno</span>
                  <strong>{dinero((precioPorNombre([...cafeteriaDesayunos, ...CAFETERIA_OTROS_DESAYUNOS], desayunoSeleccionado) + adicionalesDesayuno.reduce((suma, item) => suma + Number(item.precio || 0), 0)) * cantidadCafeteria)}</strong>
                </div>
                <button type="button" className="button add-meal" onClick={agregarDesayunoMesa}>+agregar otro producto</button>
              </div>
            )}

            {subcategoriaCafeteria === "sandwich" && (
              <div className="cafeteria-panel fade-step">
                <h3>Comida</h3>
                <div className="option-grid">
                  {cafeteriaSandwiches.map((item) => (
                    <button key={item.nombre} type="button" onClick={() => setSandwichSeleccionado(item.nombre)} className={`option ${sandwichSeleccionado === item.nombre ? "selected" : ""}`}>
                      <div>{item.nombre}</div>
                      <small>{dinero(item.precio)}</small>
                    </button>
                  ))}
                </div>

                <div className="box compact-box quantity-box">
                  <strong>Cantidad</strong>
                  <SelectorCantidad
                    cantidad={cantidadCafeteria}
                    onChange={setCantidadCafeteria}
                  />
                </div>
                <button type="button" className="button add-meal" onClick={() => agregarProductoSimpleCafeteria("Comida", sandwichSeleccionado, precioPorNombre(cafeteriaSandwiches, sandwichSeleccionado))}>+agregar otro producto</button>
              </div>
            )}

            {subcategoriaCafeteria === "bebidas" && (
              <div className="cafeteria-panel fade-step">
                <h3>Bebidas</h3>
                <div className="option-grid">
                  {cafeteriaBebidasCalientes.map((item) => (
                    <button key={item.nombre} type="button" onClick={() => setBebidaCalienteSeleccionada(item.nombre)} className={`option ${bebidaCalienteSeleccionada === item.nombre ? "selected" : ""}`}>
                      <div>{item.nombre}</div>
                      <small>{dinero(item.precio)}</small>
                    </button>
                  ))}
                </div>

                <div className="box compact-box quantity-box">
                  <strong>Cantidad</strong>
                  <SelectorCantidad
                    cantidad={cantidadCafeteria}
                    onChange={setCantidadCafeteria}
                  />
                </div>
                <button type="button" className="button add-meal" onClick={() => agregarProductoSimpleCafeteria("Bebida caliente", bebidaCalienteSeleccionada, precioPorNombre(cafeteriaBebidasCalientes, bebidaCalienteSeleccionada))}>+agregar otro producto</button>
              </div>
            )}

            {subcategoriaCafeteria === "postres" && (
              <div className="cafeteria-panel fade-step">
                <h3>Postres y frutas</h3>
                <div className="option-grid">
                  {cafeteriaPostres.map((item) => (
                    <button key={item.nombre} type="button" onClick={() => setPostreSeleccionado(item.nombre)} className={`option ${postreSeleccionado === item.nombre ? "selected" : ""}`}>
                      <div>{item.nombre}</div>
                      <small>{dinero(item.precio)}</small>
                    </button>
                  ))}
                </div>

                <div className="box compact-box quantity-box">
                  <strong>Cantidad</strong>
                  <SelectorCantidad
                    cantidad={cantidadCafeteria}
                    onChange={setCantidadCafeteria}
                  />
                </div>
                <button type="button" className="button add-meal" onClick={() => agregarProductoSimpleCafeteria("Postre", postreSeleccionado, precioPorNombre(cafeteriaPostres, postreSeleccionado))}>+agregar otro producto</button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (subcategoriaCafeteria === "parfait") agregarParfaitMesa("resumen");
                if (subcategoriaCafeteria === "batidos") agregarBatidoMesa("resumen");
                if (subcategoriaCafeteria === "desayunos") agregarDesayunoMesa("resumen");
                if (subcategoriaCafeteria === "sandwich") agregarProductoSimpleCafeteria("Comida", sandwichSeleccionado, precioPorNombre(cafeteriaSandwiches, sandwichSeleccionado), "resumen");
                if (subcategoriaCafeteria === "bebidas") agregarProductoSimpleCafeteria("Bebida caliente", bebidaCalienteSeleccionada, precioPorNombre(cafeteriaBebidasCalientes, bebidaCalienteSeleccionada), "resumen");
                if (subcategoriaCafeteria === "postres") agregarProductoSimpleCafeteria("Postre", postreSeleccionado, precioPorNombre(cafeteriaPostres, postreSeleccionado), "resumen");
              }}
              className="button continue-button"
              style={{ marginTop: 12, background: "#16a34a" }}
            >
              agregar y continuar
            </button>
          </div>
        )}
      </section>

      <aside className="card card-pad fade-step" id="mesa-confirmacion-final">
        <h2>{hayProductoSeleccionadoMesa ? "Resumen del pedido" : "Resumen"}</h2>

        {!hayProductoSeleccionadoMesa ? (
          <div className="box soft">
            <strong>👈 Empieza seleccionando un almuerzo o un producto de cafetería</strong>
          </div>
        ) : (
          <>
            <p className="muted">Puedes combinar almuerzos, batidos, parfait, bebidas y cualquier producto de cafetería en una sola orden.</p>

            <div className="mesa-resumen-actions">
              <button type="button" onClick={agregarAlmuerzoDesdeResumen} className="button add-meal">
                + Agregar almuerzo
              </button>
              <button type="button" onClick={() => agregarProductoCafeteriaDesdePedido()} className="button cafeteria-action">
                ☕ Agregar cafetería
              </button>
            </div>

            <div className="box soft" style={{ marginBottom: 12 }}>
              <h3>Resumen del pedido</h3>

              {gruposResumenMesa.map((grupo) => (
                <ResumenPedidoItem
                  key={grupo.key}
                  grupo={grupo}
                  className="mesas-resumen-item"
                  onBorrar={(ids) => quitarGrupoPedidoMesa(ids)}
                  onCambiarCantidad={(ids, cantidad) => actualizarCantidadGrupoMesa(ids, cantidad)}
                  onEditarProteina={(grupoActual) => setGrupoEditandoProteinaMesa(grupoActual)}
                  onEditarAcompanantes={(grupoActual) => setGrupoEditandoAcompanantesMesa(grupoActual)}
                  mostrarTextoParaLlevar={false}
                />
              ))}

              <div className="total-row">
                <span>Total</span>
                <strong>{dinero(total)}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => irAElementoMesas("mesa-datos-final", 120)}
              className="button continue-button"
              style={{ marginTop: 8, background: "#16a34a" }}
            >
              continuar
            </button>

            <button type="button" onClick={reiniciarPedidoMesa} className="button light small-reset">
              Borrar y volver a empezar
            </button>

            <DatosMesa
              modoLlevar={modoLlevar}
              mesaLocal={mesaLocal}
              clientePedido={clientePedido}
              telefonoLlevar={telefonoLlevar}
              ubicacionLlevar={ubicacionLlevar}
              meseroLocal={meseroLocal}
              tipoPagoMesa={tipoPagoMesa}
              observacionesLocal={observacionesLocal}
              total={total}
              errorMesa={errorMesa}
              guardandoPedido={guardandoPedido}
              itemsConProducto={itemsConModoLlevar}
              onSeleccionarMesa={seleccionarMesaLocal}
              onAlternarModoLlevar={alternarModoLlevar}
              onClienteChange={(valor) => { setClientePedido(valor); setErrorMesa(""); }}
              onTelefonoChange={(valor) => { setTelefonoLlevar(valor); setErrorMesa(""); }}
              onUbicacionChange={(valor) => { setUbicacionLlevar(valor); setErrorMesa(""); }}
              onMeseroChange={(mesero) => { setMeseroLocal(mesero); setErrorMesa(""); }}
              clientesCreditoMesa={clientesCreditoMesa}
              onTipoPagoChange={(pago) => { setTipoPagoMesa(pago); setErrorMesa(""); }}
              onObservacionesChange={setObservacionesLocal}
              onEnviarPedido={enviarPedidoMesa}
              modoEdicionAdmin={modoEdicionAdmin}
            />
          </>
        )}
      </aside>
    </main>
    <EditarProteinaResumenModal
      abierto={Boolean(grupoEditandoProteinaMesa)}
      grupo={grupoEditandoProteinaMesa}
      platosAgrupados={platosAgrupados}
      onCerrar={() => setGrupoEditandoProteinaMesa(null)}
      onGuardar={actualizarProteinaGrupoMesa}
    />

    <EditarAcompanantesResumenModal
      abierto={Boolean(grupoEditandoAcompanantesMesa)}
      grupo={grupoEditandoAcompanantesMesa}
      acompanantesDisponibles={acompanantesMesaDisponiblesResumen}
      maxAcompanantes={MAX_ACOMPANANTES_CLIENTE}
      minimoAcompanantes={1}
      exigirMinimo={false}
      onCerrar={() => setGrupoEditandoAcompanantesMesa(null)}
      onGuardar={actualizarAcompanantesGrupoMesa}
    />
    {modalAlertaRafiki}
    </>
  );
}

