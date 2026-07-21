import { normalizarTexto } from "./pedidos";

export function normalizarBusqueda(valor) {
  return normalizarTexto(valor)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function compactarBusqueda(valor) {
  return normalizarBusqueda(valor).replace(/\s+/g, "");
}

function calcularDistanciaEdicion(a, b) {
  const textoA = String(a || "");
  const textoB = String(b || "");
  if (textoA === textoB) return 0;
  if (!textoA) return textoB.length;
  if (!textoB) return textoA.length;

  const anterior = Array.from({ length: textoB.length + 1 }, (_, i) => i);
  const actual = Array(textoB.length + 1).fill(0);

  for (let i = 1; i <= textoA.length; i += 1) {
    actual[0] = i;
    for (let j = 1; j <= textoB.length; j += 1) {
      const costo = textoA[i - 1] === textoB[j - 1] ? 0 : 1;
      actual[j] = Math.min(
        anterior[j] + 1,
        actual[j - 1] + 1,
        anterior[j - 1] + costo
      );
    }
    for (let j = 0; j <= textoB.length; j += 1) anterior[j] = actual[j];
  }

  return anterior[textoB.length];
}

function tokenCoincideBusqueda(termino, contenido) {
  if (!termino) return true;
  if (contenido.texto.includes(termino) || contenido.compacto.includes(termino)) return true;

  if (termino.length < 4) return false;

  const tolerancia = termino.length >= 7 ? 2 : 1;
  return contenido.tokens.some((token) => {
    if (!token || Math.abs(token.length - termino.length) > tolerancia) return false;
    return calcularDistanciaEdicion(termino, token) <= tolerancia;
  });
}

export function crearContenidoBusquedaAvanzada(valores) {
  const lista = Array.isArray(valores) ? valores : [];
  const texto = lista.map(normalizarBusqueda).filter(Boolean).join(" ");
  const compacto = lista.map(compactarBusqueda).filter(Boolean).join(" ");
  const digitos = lista.map((valor) => String(valor || "").replace(/\D+/g, "")).filter(Boolean).join(" ");
  const tokens = Array.from(new Set(texto.split(" ").filter(Boolean)));

  return { texto, compacto, digitos, tokens };
}

export function coincideBusquedaAvanzada(contenido, busqueda) {
  const texto = normalizarBusqueda(busqueda);
  const digitos = String(busqueda || "").replace(/\D+/g, "");
  const terminos = texto.split(" ").filter(Boolean);

  if (!terminos.length && !digitos) return true;
  if (digitos && contenido.digitos.includes(digitos)) return true;

  return terminos.every((termino) => tokenCoincideBusqueda(termino, contenido));
}
