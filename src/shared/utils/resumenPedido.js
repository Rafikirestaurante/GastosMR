import { esItemCafeteria, normalizarTexto, valorParaLlevarItem } from "./pedidos";

function normalizarCadena(valor) {
  return normalizarTexto(valor || "");
}

function numeroSeguro(valor) {
  return Number(valor || 0) || 0;
}

function ordenarTexto(lista = []) {
  return (Array.isArray(lista) ? lista : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "es"));
}

function normalizarListaObjetos(lista = []) {
  return (Array.isArray(lista) ? lista : [])
    .map((item) => {
      if (item && typeof item === "object") {
        return {
          nombre: normalizarCadena(item.nombre || item.producto || item.label || item.descripcion || ""),
          precio: numeroSeguro(item.precio || item.valor || item.extra || 0)
        };
      }

      return {
        nombre: normalizarCadena(item),
        precio: 0
      };
    })
    .filter((item) => item.nombre)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es") || a.precio - b.precio);
}

function crearClaveResumenItem(item = {}) {
  const nombre = normalizarCadena(item.producto || item.plato || item.proteina || item.nombre);
  if (!nombre) return null;

  const cafeteria = esItemCafeteria(item);

  return JSON.stringify({
    linea: cafeteria ? "cafeteria" : "restaurante",
    nombre,
    categoria: normalizarCadena(item.categoria),
    area: normalizarCadena(item.area),
    tipo: normalizarCadena(item.tipo),
    precio: numeroSeguro(item.precio || item.precioPlato || item.precioProteina),
    precioPlato: numeroSeguro(item.precioPlato || item.precioProteina || item.precio),
    paraLlevar: Boolean(item.paraLlevar),
    valorParaLlevar: valorParaLlevarItem(item),
    acompanantes: ordenarTexto(item.acompanantes),
    observacionAcompanantes: normalizarCadena(item.observacionAcompanantes),
    adicionalesAlmuerzo: normalizarListaObjetos(item.adicionalesAlmuerzo),
    tamano: normalizarCadena(item.tamano),
    frutas: ordenarTexto(item.frutas),
    extraFrutas: numeroSeguro(item.extraFrutas),
    base: normalizarCadena(item.base),
    acompanante: normalizarCadena(item.acompanante),
    bebida: normalizarCadena(item.bebida),
    adicionales: normalizarListaObjetos(item.adicionales),
    detalleImpresion: normalizarCadena(item.detalle_impresion)
  });
}

export function normalizarCantidadResumen(cantidad) {
  const valor = Math.round(Number(cantidad) || 1);
  return Math.max(1, Math.min(99, valor));
}

export function agruparItemsResumenPedido(items = []) {
  const grupos = [];
  const indices = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    const clave = crearClaveResumenItem(item);
    if (!clave) return;

    const cantidad = normalizarCantidadResumen(item?.cantidad || 1);

    if (!indices.has(clave)) {
      indices.set(clave, grupos.length);
      grupos.push({
        key: clave,
        item: { ...item, cantidad },
        ids: [item.id],
        cantidad,
        items: [item],
        agrupado: false
      });
      return;
    }

    const grupo = grupos[indices.get(clave)];
    grupo.ids.push(item.id);
    grupo.items.push(item);
    grupo.cantidad += cantidad;
    grupo.item = { ...grupo.item, cantidad: grupo.cantidad };
    grupo.agrupado = true;
  });

  return grupos;
}

export function consolidarItemsResumenPedido(items = []) {
  if (!Array.isArray(items) || items.length === 0) return items;

  const cantidadesPorClave = new Map();
  const primerIdPorClave = new Map();
  const idsDuplicados = new Set();

  items.forEach((item) => {
    const clave = crearClaveResumenItem(item);
    if (!clave) return;

    const cantidad = normalizarCantidadResumen(item?.cantidad || 1);
    cantidadesPorClave.set(clave, (cantidadesPorClave.get(clave) || 0) + cantidad);

    if (!primerIdPorClave.has(clave)) {
      primerIdPorClave.set(clave, item.id);
    } else {
      idsDuplicados.add(item.id);
    }
  });

  if (idsDuplicados.size === 0) return items;

  return items
    .filter((item) => !idsDuplicados.has(item.id))
    .map((item) => {
      const clave = crearClaveResumenItem(item);
      if (!clave || primerIdPorClave.get(clave) !== item.id) return item;

      return {
        ...item,
        cantidad: normalizarCantidadResumen(cantidadesPorClave.get(clave) || item.cantidad || 1)
      };
    });
}
