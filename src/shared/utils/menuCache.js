import { menuFallback } from "../../data/menuAlmuerzos";
import { fechaISOColombia, normalizarMenu } from "./pedidos";

export const MENU_CACHE_KEY = "rafikiMenuDiarioCache";

function menuVacioDeHoy() {
  return normalizarMenu({
    ...menuFallback,
    fecha: fechaISOColombia(),
    platos_detalle: [],
    proteinas_detalle: [],
    proteinas: [],
    acompanantes: []
  });
}

function esMenuDeHoy(menuGuardado) {
  return menuGuardado?.fecha === fechaISOColombia();
}

export function leerMenuCache() {
  try {
    const raw = window.localStorage.getItem(MENU_CACHE_KEY);
    if (!raw) return menuVacioDeHoy();

    const menuGuardado = normalizarMenu(JSON.parse(raw));
    return esMenuDeHoy(menuGuardado) ? menuGuardado : menuVacioDeHoy();
  } catch (_error) {
    return menuVacioDeHoy();
  }
}

export function guardarMenuCache(menuNormalizado) {
  try {
    window.localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(menuNormalizado));
  } catch (_error) {
    // No bloquear la app si el navegador no permite localStorage.
  }
}

export function hayMenuCacheValido() {
  try {
    const raw = window.localStorage.getItem(MENU_CACHE_KEY);
    if (!raw) return false;
    const menuGuardado = normalizarMenu(JSON.parse(raw));

    return Boolean(
      esMenuDeHoy(menuGuardado) &&
      (menuGuardado?.id ||
        menuGuardado?.platos_detalle?.length ||
        menuGuardado?.acompanantes?.length)
    );
  } catch (_error) {
    return false;
  }
}
