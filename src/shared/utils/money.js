export function aPesosEnteros(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;

  if (typeof valor === "string") {
    const limpio = valor
      .trim()
      .replace(/\s+/g, "")
      .replace(/\$/g, "")
      .replace(/COP/gi, "");

    // En formularios internos casi siempre llega como "16000". Para valores
    // escritos como "16.000" o "16,000", tratamos puntos/comas como miles.
    const soloMiles = /^-?\d{1,3}([.,]\d{3})+$/.test(limpio);
    const textoNumero = soloMiles ? limpio.replace(/[.,]/g, "") : limpio.replace(/,/g, ".");
    const numeroTexto = Number(textoNumero);
    return Number.isFinite(numeroTexto) ? Math.round(numeroTexto) : 0;
  }

  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? Math.round(numero) : 0;
}

export function valoresPesosDiferentes(a, b) {
  return aPesosEnteros(a) !== aPesosEnteros(b);
}
