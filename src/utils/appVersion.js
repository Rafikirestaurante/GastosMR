export const APP_VERSION = 'Fase 2C · control-cache-20260705';
export const APP_VERSION_KEY = 'control-gastos-milena-app-version';

async function deleteBrowserCaches() {
  if (!('caches' in window)) return 0;
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
  return cacheNames.length;
}

async function unregisterServiceWorkers() {
  if (!('serviceWorker' in navigator)) return 0;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
  return registrations.length;
}

export async function cleanOldAppCache() {
  const previousVersion = localStorage.getItem(APP_VERSION_KEY);
  const versionChanged = previousVersion !== APP_VERSION;

  if (!versionChanged) {
    return { versionChanged: false, cachesDeleted: 0, workersDeleted: 0 };
  }

  const [cachesDeleted, workersDeleted] = await Promise.all([
    deleteBrowserCaches().catch(() => 0),
    unregisterServiceWorkers().catch(() => 0)
  ]);

  localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
  return { versionChanged: true, cachesDeleted, workersDeleted, previousVersion };
}

export async function forceCleanAndReload() {
  await Promise.all([
    deleteBrowserCaches().catch(() => 0),
    unregisterServiceWorkers().catch(() => 0)
  ]);
  localStorage.setItem(APP_VERSION_KEY, APP_VERSION);

  const url = new URL(window.location.href);
  url.searchParams.set('app_refresh', String(Date.now()));
  window.location.replace(url.toString());
}
