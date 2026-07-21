import { SELECT_PEDIDOS_ADMIN } from "../../services/pedidosService";
import { conTiempoMaximo } from "./async";
const STORAGE_KEY = 'rafikiPedidosPendientesOffline';
const EVENTO_CAMBIO = 'rafiki:pedidos-offline-cambio';
const ESTADOS = {
  PENDIENTE: 'pendiente',
  ENVIANDO: 'enviando',
  ENVIADO: 'enviado',
  ERROR: 'error'
};
const BLOQUEO_ENVIO_MS = 90 * 1000;
const MAX_PEDIDOS_OFFLINE = 80;
const MAX_PEDIDOS_ENVIADOS_HISTORIAL = 10;

function crearIdTemporal() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `offline-${crypto.randomUUID()}`;
  }

  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizarTexto(valor) {
  return String(valor || '').trim().toLowerCase();
}

function crearHuellaPedido(pedido = {}) {
  const items = Array.isArray(pedido.items) ? pedido.items : [];
  const itemsClave = items
    .map((item) => ({
      categoria: item.categoria || '',
      plato: item.plato || '',
      proteina: item.proteina || '',
      producto: item.producto || '',
      cantidad: Number(item.cantidad || 1),
      precio: Number(item.precio || item.valor || 0),
      acompanantes: Array.isArray(item.acompanantes) ? [...item.acompanantes].sort() : [],
      observacionAcompanantes: item.observacionAcompanantes || '',
      paraLlevar: Boolean(item.paraLlevar)
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

  return JSON.stringify({
    cliente: normalizarTexto(pedido.cliente || pedido.cliente_nombre),
    mesa: normalizarTexto(pedido.mesa),
    ubicacion: normalizarTexto(pedido.ubicacion),
    mesero: normalizarTexto(pedido.mesero),
    tipoPedido: normalizarTexto(pedido.tipo_pedido),
    total: Number(pedido.total || 0),
    observaciones: normalizarTexto(pedido.observaciones),
    items: itemsClave
  });
}

export function esRutaMesasInterna() {
  return window.location.pathname.replace(/\/$/, '') === '/mesas';
}

export function leerPedidosPendientesOffline() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const lista = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(lista)) return [];

    return lista.map((registro) => ({
      estado: registro.estado || ESTADOS.PENDIENTE,
      historial_reintentos: Array.isArray(registro.historial_reintentos) ? registro.historial_reintentos : [],
      huella: registro.huella || crearHuellaPedido(registro.pedido),
      ...registro
    }));
  } catch {
    return [];
  }
}

function contarActivos(lista) {
  return lista.filter((registro) => registro.estado !== ESTADOS.ENVIADO).length;
}

function normalizarColaOffline(lista) {
  const registros = Array.isArray(lista) ? lista : [];
  const activos = registros.filter((registro) => registro.estado !== ESTADOS.ENVIADO);
  const enviados = registros
    .filter((registro) => registro.estado === ESTADOS.ENVIADO)
    .slice(-MAX_PEDIDOS_ENVIADOS_HISTORIAL);

  if (activos.length <= MAX_PEDIDOS_OFFLINE) return [...enviados, ...activos];

  const recortados = activos.slice(-MAX_PEDIDOS_OFFLINE);
  return [...enviados, ...recortados];
}

function guardarLista(lista) {
  const listaNormalizada = normalizarColaOffline(lista);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(listaNormalizada));
  actualizarBadgePedidosPendientes(contarActivos(listaNormalizada));
  window.dispatchEvent(new CustomEvent(EVENTO_CAMBIO, { detail: { total: contarActivos(listaNormalizada) } }));
}

export function contarPedidosPendientesOffline() {
  return contarActivos(leerPedidosPendientesOffline());
}

export function guardarPedidoPendienteOffline(pedido, metadata = {}) {
  const pendientes = leerPedidosPendientesOffline();
  const huella = crearHuellaPedido(pedido);
  const duplicadoActivo = pendientes.find(
    (registro) => registro.huella === huella && registro.estado !== ESTADOS.ENVIADO
  );

  if (duplicadoActivo) {
    return { ...duplicadoActivo, duplicado_detectado: true };
  }

  const registro = {
    id_temporal: crearIdTemporal(),
    creado_en: new Date().toISOString(),
    actualizado_en: new Date().toISOString(),
    intentos: 0,
    estado: ESTADOS.PENDIENTE,
    ultimo_error: '',
    ultimo_intento_en: '',
    historial_reintentos: [],
    huella,
    origen: metadata.origen || 'mesas',
    pedido
  };

  guardarLista([...pendientes, registro]);
  return registro;
}

export function eliminarPedidoPendienteOffline(idTemporal) {
  const restantes = leerPedidosPendientesOffline().filter((registro) => registro.id_temporal !== idTemporal);
  guardarLista(restantes);
}

export function actualizarPedidoPendienteOffline(idTemporal, cambios) {
  const actualizados = leerPedidosPendientesOffline().map((registro) =>
    registro.id_temporal === idTemporal
      ? {
          ...registro,
          ...cambios,
          actualizado_en: new Date().toISOString()
        }
      : registro
  );
  guardarLista(actualizados);
}

export function prepararPedidoPendienteParaReintento(idTemporal) {
  const lista = leerPedidosPendientesOffline();
  const actualizados = lista.map((registro) => {
    if (registro.id_temporal !== idTemporal || registro.estado === ESTADOS.ENVIADO) return registro;

    return {
      ...registro,
      estado: ESTADOS.PENDIENTE,
      actualizado_en: new Date().toISOString(),
      ultimo_error: '',
      ultimo_intento_en: '',
      historial_reintentos: agregarEventoHistorial(registro, {
        estado: ESTADOS.PENDIENTE,
        mensaje: 'Reintento manual solicitado.'
      })
    };
  });

  guardarLista(actualizados);
}

function agregarEventoHistorial(registro, evento) {
  return [
    ...(Array.isArray(registro.historial_reintentos) ? registro.historial_reintentos : []),
    {
      fecha: new Date().toISOString(),
      ...evento
    }
  ].slice(-12);
}

function pedidoPuedeReenviarse(registro) {
  if (registro.estado === ESTADOS.ENVIADO) return false;

  if (registro.estado !== ESTADOS.ENVIANDO) return true;

  const ultimoIntento = registro.ultimo_intento_en ? new Date(registro.ultimo_intento_en).getTime() : 0;
  return !ultimoIntento || Date.now() - ultimoIntento > BLOQUEO_ENVIO_MS;
}

export function esErrorDeConexion(error) {
  const mensaje = String(error?.message || error || '').toLowerCase();
  return (
    !window.navigator.onLine ||
    mensaje.includes('failed to fetch') ||
    mensaje.includes('network') ||
    mensaje.includes('fetch') ||
    mensaje.includes('load failed') ||
    mensaje.includes('timeout') ||
    mensaje.includes('tardó demasiado') ||
    mensaje.includes('tardo demasiado')
  );
}

export async function sincronizarPedidosPendientesOffline({ supabase, onPedidoSincronizado, onError, ids } = {}) {
  if (!window.navigator.onLine) {
    return { enviados: 0, pendientes: contarPedidosPendientesOffline(), error: 'Sin conexión.' };
  }

  const filtroIds = Array.isArray(ids) && ids.length > 0 ? new Set(ids) : null;
  const pendientes = leerPedidosPendientesOffline().filter((registro) => !filtroIds || filtroIds.has(registro.id_temporal));
  let enviados = 0;

  for (const registro of pendientes) {
    if (!pedidoPuedeReenviarse(registro)) continue;

    const intentos = Number(registro.intentos || 0) + 1;
    actualizarPedidoPendienteOffline(registro.id_temporal, {
      estado: ESTADOS.ENVIANDO,
      intentos,
      ultimo_error: '',
      ultimo_intento_en: new Date().toISOString(),
      historial_reintentos: agregarEventoHistorial(registro, {
        estado: ESTADOS.ENVIANDO,
        mensaje: `Intento ${intentos}: enviando pedido.`
      })
    });

    try {
      const { data, error } = await conTiempoMaximo(
        supabase.from('pedidos').insert(registro.pedido).select(SELECT_PEDIDOS_ADMIN).single(),
        9000,
        'El reenvío del pedido pendiente'
      );

      if (error) throw error;

      actualizarPedidoPendienteOffline(registro.id_temporal, {
        estado: ESTADOS.ENVIADO,
        enviado_en: new Date().toISOString(),
        ultimo_error: '',
        historial_reintentos: agregarEventoHistorial({ ...registro, intentos }, {
          estado: ESTADOS.ENVIADO,
          mensaje: 'Pedido enviado correctamente.'
        })
      });
      eliminarPedidoPendienteOffline(registro.id_temporal);
      enviados += 1;
      if (typeof onPedidoSincronizado === 'function') {
        onPedidoSincronizado(data, registro);
      }
    } catch (error) {
      actualizarPedidoPendienteOffline(registro.id_temporal, {
        estado: ESTADOS.ERROR,
        intentos,
        ultimo_error: error?.message || 'No se pudo reenviar el pedido.',
        ultimo_intento_en: new Date().toISOString(),
        historial_reintentos: agregarEventoHistorial({ ...registro, intentos }, {
          estado: ESTADOS.ERROR,
          mensaje: error?.message || 'No se pudo reenviar el pedido.'
        })
      });

      if (typeof onError === 'function') onError(error, registro);

      // Si un reenvío falla, detenemos el lote para evitar bucles o duplicados.
      break;
    }
  }

  return { enviados, pendientes: contarPedidosPendientesOffline() };
}

export async function actualizarBadgePedidosPendientes(total = contarPedidosPendientesOffline()) {
  try {
    if ('setAppBadge' in navigator && total > 0) {
      await navigator.setAppBadge(total);
      return;
    }

    if ('clearAppBadge' in navigator && total <= 0) {
      await navigator.clearAppBadge();
    }
  } catch {
    // El badge no está soportado en todos los navegadores. No debe romper la app.
  }
}

export function suscribirCambiosPedidosOffline(callback) {
  const handler = () => callback(contarPedidosPendientesOffline());
  window.addEventListener(EVENTO_CAMBIO, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENTO_CAMBIO, handler);
    window.removeEventListener('storage', handler);
  };
}
