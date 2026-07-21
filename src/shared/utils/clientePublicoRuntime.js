import { RAFIKI_APP_VERSION } from '../../config/rafikiBuild.js';

const CLIENTE_PUBLICO_RESET_KEY = `rafikiClientePublicoSinServiceWorker:${RAFIKI_APP_VERSION}`;

function normalizarRuta(pathname = window.location.pathname) {
  return String(pathname || '/').replace(/\/$/, '') || '/';
}

export function esRutaPublicaCliente(pathname = window.location.pathname) {
  const ruta = normalizarRuta(pathname);
  return ruta === '/' || ruta === '/cliente' || ruta === '/pedido';
}

function tieneParametroRefreshCliente() {
  try {
    return new URLSearchParams(window.location.search || '').has('cliente_refresh');
  } catch {
    return false;
  }
}

async function borrarCachesRafiki() {
  if (!('caches' in window)) return;
  const nombres = await window.caches.keys();
  await Promise.all(
    nombres
      .filter((nombre) => /rafiki|workbox|vite|pwa|precache|runtime/i.test(nombre))
      .map((nombre) => window.caches.delete(nombre))
  );
}

async function desactivarServiceWorkersRafiki() {
  if (!('serviceWorker' in navigator)) return false;

  const registros = await navigator.serviceWorker.getRegistrations();
  const habiaControlador = Boolean(navigator.serviceWorker.controller || registros.length);

  await Promise.all(
    registros.map(async (registro) => {
      try {
        registro.waiting?.postMessage({ type: 'RAFIKI_CLEAR_CACHE' });
        registro.active?.postMessage({ type: 'RAFIKI_CLEAR_CACHE' });
        registro.installing?.postMessage({ type: 'RAFIKI_CLEAR_CACHE' });
        await registro.unregister();
      } catch {
        // No bloquear el link público si el navegador no permite limpiar el registro.
      }
    })
  );

  return habiaControlador;
}

function marcarClientePublicoPreparado() {
  try {
    window.sessionStorage.setItem(CLIENTE_PUBLICO_RESET_KEY, 'true');
  } catch {
    // No bloquear si sessionStorage no está disponible.
  }
}

function clientePublicoYaPreparado() {
  try {
    return window.sessionStorage.getItem(CLIENTE_PUBLICO_RESET_KEY) === 'true';
  } catch {
    return false;
  }
}

export async function prepararClientePublicoSinServiceWorker() {
  if (!esRutaPublicaCliente()) return;
  if (clientePublicoYaPreparado() || tieneParametroRefreshCliente()) return;

  marcarClientePublicoPreparado();

  const habiaServiceWorker = await desactivarServiceWorkersRafiki();
  await borrarCachesRafiki();

  if (habiaServiceWorker) {
    const url = new URL(window.location.href);
    url.searchParams.set('cliente_refresh', Date.now().toString());
    window.location.replace(url.toString());
  }
}
