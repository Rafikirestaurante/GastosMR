export async function limpiarCachesYServiceWorkers() {
  try {
    if ('caches' in window) {
      const nombres = await window.caches.keys();
      await Promise.all(nombres.map((nombre) => window.caches.delete(nombre)));

    if ('serviceWorker' in navigator) {
      const registrosActivos = await navigator.serviceWorker.getRegistrations();
      registrosActivos.forEach((registro) => {
        registro.waiting?.postMessage({ type: 'RAFIKI_CLEAR_CACHE' });
        registro.active?.postMessage({ type: 'RAFIKI_CLEAR_CACHE' });
      });
    }
    }

    if ('serviceWorker' in navigator) {
      const registros = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registros.map((registro) => registro.unregister()));
    }
  } catch (error) {
    console.warn('No se pudo limpiar completamente la PWA:', error);
  }
}

export function mostrarPantallaRecuperacionPWA(error) {
  const root = document.getElementById('root') || document.body;
  const mensaje = error?.message || error?.reason?.message || String(error || 'Error desconocido');

  root.innerHTML = `
    <div style="min-height:100vh;background:#fff7ed;padding:22px;font-family:Arial,sans-serif;color:#431407;box-sizing:border-box;">
      <div style="max-width:680px;margin:38px auto;background:white;border:2px solid #fed7aa;border-radius:22px;padding:22px;box-shadow:0 18px 45px rgba(0,0,0,.15);">
        <div style="font-size:38px;margin-bottom:8px;">⚠️</div>
        <h1 style="margin:0 0 10px;color:#9a3412;font-size:24px;">Rafiki Pedidos no pudo abrir correctamente</h1>
        <p style="line-height:1.45;margin:0 0 14px;">Esto suele pasar cuando el navegador conserva una versión antigua de la PWA, del Service Worker o de los archivos de JavaScript.</p>
        <div style="background:#fef2f2;color:#7f1d1d;border-radius:14px;padding:12px;font-size:13px;white-space:pre-wrap;margin-bottom:14px;">${mensaje.replace(/[<>&]/g, (c) => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</div>
        <button id="rafiki-reset-pwa" style="width:100%;border:none;border-radius:999px;background:#f97316;color:white;font-size:17px;font-weight:900;padding:14px 18px;cursor:pointer;">Limpiar caché y abrir de nuevo</button>
        <p style="font-size:13px;color:#78716c;line-height:1.4;margin:14px 0 0;">Si vuelve a fallar, abre el navegador en modo incógnito o elimina el acceso instalado y vuelve a entrar a la misma ruta.</p>
      </div>
    </div>
  `;

  document.getElementById('rafiki-reset-pwa')?.addEventListener('click', async () => {
    await limpiarCachesYServiceWorkers();
    const rutaActual = window.location.pathname?.replace(/\/$/, '') || '/mesas';
    const paramsActuales = new URLSearchParams(window.location.search || '');
    const arranqueAdminAnterior = rutaActual === '/admin' && paramsActuales.get('app') === 'admin';
    const rutaDestino = rutaActual === '/' || rutaActual === '/cliente' || rutaActual === '/pedido' || arranqueAdminAnterior ? '/mesas' : rutaActual;
    const base = `${window.location.origin}${rutaDestino}?rafiki_reset=${Date.now()}&pwa=clean`;
    window.location.replace(base);
  });
}

export function activarRecuperacionPWA() {
  window.addEventListener('error', (event) => {
    const texto = event?.message || '';
    const esChunk = /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|MIME type|dynamically imported module|chunk/i.test(texto);
    if (esChunk) mostrarPantallaRecuperacionPWA(event.error || event);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const texto = event?.reason?.message || String(event?.reason || '');
    const esChunk = /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|MIME type|dynamically imported module|chunk/i.test(texto);
    if (esChunk) mostrarPantallaRecuperacionPWA(event.reason || event);
  });
}
