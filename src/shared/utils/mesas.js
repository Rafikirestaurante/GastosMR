import { FORMAS_PAGO_MESA as FORMAS_PAGO_MESA_CONTROLADAS, METODOS_PAGO } from "../constants/paymentMethods";

export function irAElementoMesas(id, delay = 180, block = "start") {
  window.setTimeout(() => {
    window.requestAnimationFrame(() => {
      const elemento = document.getElementById(id);
      if (!elemento) return;
      elemento.scrollIntoView({ behavior: "smooth", block, inline: "nearest" });
    });
  }, delay);
}

export function vibracionCortaMesas() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(18);
  }
}

export const MESAS_DISPONIBLES = ["1A", "1B", "2A", "2B", "3A", "3B", "4A", "4B", "5B"];
export const MESEROS_DISPONIBLES = ["Rafa", "Ara", "Pao", "Jesús"];
export const FORMA_PAGO_CREDITO = METODOS_PAGO.CREDITO;
export const FORMAS_PAGO_MESA = FORMAS_PAGO_MESA_CONTROLADAS;

const STORAGE_CLIENTES_CREDITO = "rafiki_clientes_credito_v1";

const CLIENTES_CREDITO_INICIALES = [
  "Sra. Inés",
  "Dra. Laura"
];

function normalizarClienteCredito(nombre) {
  return String(nombre || "")
    .trim()
    .replace(/\s+/g, " ");
}

export function leerClientesCreditoGuardados() {
  if (typeof window === "undefined") return CLIENTES_CREDITO_INICIALES;
  try {
    const raw = window.localStorage.getItem(STORAGE_CLIENTES_CREDITO);
    const guardados = raw ? JSON.parse(raw) : [];
    const lista = Array.isArray(guardados) ? guardados : [];
    const unificados = new Map();

    [...CLIENTES_CREDITO_INICIALES, ...lista]
      .map(normalizarClienteCredito)
      .filter(Boolean)
      .forEach((cliente) => {
        unificados.set(cliente.toLowerCase(), cliente);
      });

    return Array.from(unificados.values()).sort((a, b) => a.localeCompare(b, "es"));
  } catch {
    return CLIENTES_CREDITO_INICIALES;
  }
}

export function guardarClienteCredito(nombre) {
  const cliente = normalizarClienteCredito(nombre);
  if (!cliente || typeof window === "undefined") return leerClientesCreditoGuardados();

  const lista = leerClientesCreditoGuardados();
  const existe = lista.some((item) => item.toLowerCase() === cliente.toLowerCase());
  const actualizada = existe ? lista : [...lista, cliente].sort((a, b) => a.localeCompare(b, "es"));

  try {
    window.localStorage.setItem(STORAGE_CLIENTES_CREDITO, JSON.stringify(actualizada));
  } catch {
    // No bloquea el pedido si el almacenamiento local falla.
  }

  return actualizada;
}
