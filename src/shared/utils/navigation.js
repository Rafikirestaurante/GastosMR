import { obtenerSesionActiva } from "./pedidos";

function estaEnModoPWAInstalada() {
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches ||
      window.matchMedia?.('(display-mode: fullscreen)').matches ||
      window.navigator.standalone
  );
}

function normalizarRutaActual() {
  return window.location.pathname.replace(/\/$/, "") || "/";
}

function rutaInicialSeguraPWA(ruta) {
  if (!estaEnModoPWAInstalada()) return ruta;

  const params = new URLSearchParams(window.location.search || "");
  const arranqueAdminVersionAnterior = ruta === "/admin" && params.get("app") === "admin";

  // La PWA interna debe arrancar en Panel Mesas.
  // La raíz pública del navegador sigue redirigiendo a /cliente desde Vercel,
  // pero el ícono instalado usa start_url=/mesas?app=mesas.
  // También corregimos instalaciones viejas que todavía abran /admin?app=admin.
  if (ruta === "/" || ruta === "/cliente" || ruta === "/pedido" || arranqueAdminVersionAnterior) {
    return "/mesas";
  }

  return ruta;
}

export function obtenerVistaInicial() {
  let ruta = normalizarRutaActual();
  const rutaOriginal = ruta;
  ruta = rutaInicialSeguraPWA(ruta);

  if (ruta !== rutaOriginal) {
    window.history.replaceState({}, "", ruta);
  }

  if (ruta === "/gastos") {
    ruta = "/gerencia";
    window.history.replaceState({}, "", ruta);
  }

  const adminActivo = obtenerSesionActiva("rafikiAdminActivo");

  if (ruta === "/admin") {
    return adminActivo ? "admin" : "adminLogin";
  }

  if (ruta === "/gerencia" || ruta === "/rafa") {
    return adminActivo ? "gerencia" : "adminLogin";
  }

  if (ruta === "/pedidos") {
    return adminActivo ? "pedidos" : "adminLogin";
  }

  if (ruta === "/inventario") {
    return adminActivo ? "inventario" : "adminLogin";
  }

  if (ruta === "/pedido" || ruta === "/cliente") {
    return "cliente";
  }

  if (ruta === "/cliente-beta") {
    return "clienteBeta";
  }

  if (ruta === "/mesas-beta") {
    return "mesasBeta";
  }

  if (ruta === "/mesas") {
    // En la PWA instalada pedimos inicio de sesión al arrancar si no hay
    // sesión administrativa local. Eso permite saber si se deben mostrar
    // accesos Admin / Pedidos Hoy / Gerencia.
    if (estaEnModoPWAInstalada() && !adminActivo) {
      return "adminLogin";
    }
    return "mesas";
  }

  if (estaEnModoPWAInstalada()) {
    window.history.replaceState({}, "", "/mesas");
    return adminActivo ? "mesas" : "adminLogin";
  }

  return "inicio";
}

export function actualizarRuta(ruta) {
  const rutaFinal = ruta || "/";
  if (normalizarRutaActual() !== rutaFinal) {
    window.history.pushState({}, "", rutaFinal);
  }
}
