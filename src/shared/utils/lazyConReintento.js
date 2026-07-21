import { lazy } from "react";
import { limpiarCachesPWA } from "./pwaVersion.js";

const RAFIKI_LAZY_RECOVERY_PREFIX = "rafikiLazyRecovery";

export function esErrorCargaModulo(error) {
  const mensaje = error?.message || error?.reason?.message || String(error || "");
  return /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|dynamically imported module|module script|chunk|MIME type|Failed to fetch/i.test(
    mensaje
  );
}

async function recuperarPWA(nombreModulo) {
  if (typeof window === "undefined") return false;

  const llave = `${RAFIKI_LAZY_RECOVERY_PREFIX}:${nombreModulo || "modulo"}`;
  const ahora = Date.now();
  const ultimoIntento = Number(window.sessionStorage?.getItem(llave) || 0);

  // Evita ciclos infinitos si el problema viene de un deploy incompleto y no de caché.
  if (ultimoIntento && ahora - ultimoIntento < 2 * 60 * 1000) return false;

  try {
    window.sessionStorage?.setItem(llave, String(ahora));
  } catch {
    // No bloquear recuperación si sessionStorage falla.
  }

  try {
    await limpiarCachesPWA({ borrarTodo: false });
  } catch (error) {
    console.warn(`[Rafiki] No se pudo limpiar caché antes de recargar ${nombreModulo}:`, error);
  }

  const url = new URL(window.location.href);
  url.searchParams.set("rafiki_lazy_refresh", ahora.toString());
  url.searchParams.set("modulo", nombreModulo || "modulo");
  window.location.replace(url.toString());
  return true;
}

export function lazyConReintento(importador, nombreModulo) {
  return lazy(async () => {
    try {
      return await importador();
    } catch (error) {
      if (esErrorCargaModulo(error)) {
        await recuperarPWA(nombreModulo);
      }
      throw error;
    }
  });
}
