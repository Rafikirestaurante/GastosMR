export function esRutaInternaPWA(pathname = window.location.pathname) {
  return (
    pathname.startsWith('/mesas') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/pedidos') ||
    pathname.startsWith('/gerencia') ||
    pathname.startsWith('/rafa') ||
    pathname.startsWith('/gastos')
  );
}

export function estaEnModoInstalado() {
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches ||
      window.matchMedia?.('(display-mode: fullscreen)').matches ||
      window.navigator.standalone
  );
}

export function esIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function esAndroid() {
  return /android/i.test(window.navigator.userAgent);
}
