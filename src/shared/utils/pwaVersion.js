import { RAFIKI_APP_VERSION } from '../../config/rafikiBuild.js';

export { RAFIKI_APP_VERSION };
export const RAFIKI_VERSION_URL = '/rafiki-version.json';
export const RAFIKI_VERSION_STORAGE_KEY = 'rafikiAppVersion';
export const RAFIKI_PWA_REFRESH_KEY = 'rafikiPwaUltimaLimpieza';
export const RAFIKI_PWA_SUPPRESS_UNTIL_KEY = 'rafikiPwaSuprimirAvisoHasta';
export const RAFIKI_PWA_LAST_PROMPT_KEY = 'rafikiPwaUltimoAviso';

const MINUTOS_SUPRESION_TRAS_ACTUALIZAR = 2;
const MINUTOS_ENTRE_AVISOS = 10;

export function obtenerVersionGuardada(storage = window.localStorage) {
  try {
    return storage.getItem(RAFIKI_VERSION_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function guardarVersionActual(storage = window.localStorage) {
  try {
    storage.setItem(RAFIKI_VERSION_STORAGE_KEY, RAFIKI_APP_VERSION);
  } catch {
    // Si el navegador bloquea localStorage, la app debe seguir funcionando.
  }
}

function convertirVersionANumero(version = '') {
  const texto = String(version).toUpperCase();
  const coincidenciaFase = texto.match(/(\d+)(?:\s*)?([A-Z])?(?:[-_ ]?(\d+))?/);

  if (!coincidenciaFase) return 0;

  const fase = Number(coincidenciaFase[1] || 0);
  const letra = coincidenciaFase[2] ? coincidenciaFase[2].charCodeAt(0) - 64 : 0;
  const subfase = Number(coincidenciaFase[3] || 0);
  const preA = /PRE[-_ ]?A/.test(texto) ? 50 : 0;
  const fix = texto.includes('FIX') ? 1 : 0;

  return fase * 1000000 + letra * 10000 + subfase * 100 + preA + fix;
}

export function esVersionRemotaMasNueva(versionRemota, versionActual = RAFIKI_APP_VERSION) {
  if (!versionRemota || versionRemota === versionActual) return false;

  const numeroRemoto = convertirVersionANumero(versionRemota);
  const numeroActual = convertirVersionANumero(versionActual);

  if (!numeroRemoto || !numeroActual) return false;

  return numeroRemoto > numeroActual;
}

export async function consultarVersionRemota() {
  const respuesta = await fetch(`${RAFIKI_VERSION_URL}?t=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache'
    }
  });

  if (!respuesta.ok) {
    throw new Error(`No se pudo consultar versión (${respuesta.status})`);
  }

  return respuesta.json();
}

function leerTimestamp(storage, llave) {
  try {
    return Number(storage.getItem(llave) || 0);
  } catch {
    return 0;
  }
}

function guardarTimestamp(storage, llave, valor = Date.now()) {
  try {
    storage.setItem(llave, String(valor));
  } catch {
    // No bloquear la operación.
  }
}

export function suprimirAvisosTemporalmente(storage = window.sessionStorage, minutos = MINUTOS_SUPRESION_TRAS_ACTUALIZAR) {
  guardarTimestamp(storage, RAFIKI_PWA_SUPPRESS_UNTIL_KEY, Date.now() + minutos * 60 * 1000);
}

export function puedeMostrarAvisoNuevaVersion(storage = window.sessionStorage, ahora = Date.now()) {
  const suprimirHasta = leerTimestamp(storage, RAFIKI_PWA_SUPPRESS_UNTIL_KEY);
  if (suprimirHasta && ahora < suprimirHasta) return false;

  const ultimoAviso = leerTimestamp(storage, RAFIKI_PWA_LAST_PROMPT_KEY);
  if (ultimoAviso && ahora - ultimoAviso < MINUTOS_ENTRE_AVISOS * 60 * 1000) return false;

  guardarTimestamp(storage, RAFIKI_PWA_LAST_PROMPT_KEY, ahora);
  return true;
}

async function enviarMensajeServiceWorkerActivo(mensaje) {
  if (!('serviceWorker' in navigator)) return;

  const registros = await navigator.serviceWorker.getRegistrations();
  registros.forEach((registro) => {
    registro.waiting?.postMessage(mensaje);
    registro.active?.postMessage(mensaje);
    registro.installing?.postMessage(mensaje);
  });

  navigator.serviceWorker.controller?.postMessage(mensaje);
}

export async function limpiarCachesPWA({ borrarTodo = false } = {}) {
  await enviarMensajeServiceWorkerActivo({ type: 'RAFIKI_CLEAR_CACHE' });

  if ('caches' in window) {
    const nombres = await window.caches.keys();
    await Promise.all(
      nombres
        .filter((nombre) => borrarTodo || /rafiki|workbox|vite|pwa|precache|runtime/i.test(nombre))
        .map((nombre) => window.caches.delete(nombre))
    );
  }

  if ('serviceWorker' in navigator) {
    const registros = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registros.map(async (registro) => {
        registro.waiting?.postMessage({ type: 'SKIP_WAITING' });
        await registro.update().catch(() => undefined);
      })
    );
  }
}

export async function limpiarCachesYRecargar() {
  try {
    sessionStorage.setItem(RAFIKI_PWA_REFRESH_KEY, String(Date.now()));
    suprimirAvisosTemporalmente(sessionStorage);
  } catch {
    // No bloquear si el navegador no permite sessionStorage.
  }

  await limpiarCachesPWA({ borrarTodo: false });
  guardarVersionActual();

  const url = new URL(window.location.href);
  url.searchParams.set('rafiki_refresh', Date.now().toString());
  window.location.replace(url.toString());
}
