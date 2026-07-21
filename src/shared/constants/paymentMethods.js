export const METODOS_PAGO = Object.freeze({
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  DATAFONO: "Datafono",
  CREDITO: "Crédito",
  NEQUI: "Nequi",
  BANCOLOMBIA: "Bancolombia",
  OTRO: "Otro",
});

export const FORMAS_PAGO_MESA = Object.freeze([
  METODOS_PAGO.EFECTIVO,
  METODOS_PAGO.TRANSFERENCIA,
  METODOS_PAGO.DATAFONO,
  METODOS_PAGO.CREDITO,
]);

export const FORMAS_PAGO_CLIENTE = Object.freeze([
  METODOS_PAGO.EFECTIVO,
  METODOS_PAGO.TRANSFERENCIA,
  METODOS_PAGO.DATAFONO,
]);

export const FORMAS_PAGO_ABONO_CARTERA = Object.freeze([
  METODOS_PAGO.EFECTIVO,
  METODOS_PAGO.TRANSFERENCIA,
  METODOS_PAGO.DATAFONO,
  METODOS_PAGO.NEQUI,
  METODOS_PAGO.BANCOLOMBIA,
  METODOS_PAGO.OTRO,
]);

export function normalizarTextoMetodoPago(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizarMetodoPago(valor, { permitirCredito = true, fallback = METODOS_PAGO.EFECTIVO } = {}) {
  const texto = normalizarTextoMetodoPago(valor);

  if (!texto) return fallback;
  if (texto.includes("efect")) return METODOS_PAGO.EFECTIVO;
  if (texto.includes("bancolombia")) return METODOS_PAGO.BANCOLOMBIA;
  if (texto.includes("trans") || texto === "banco") return METODOS_PAGO.TRANSFERENCIA;
  if (texto.includes("data") || texto.includes("tarjeta") || texto.includes("datafono")) return METODOS_PAGO.DATAFONO;
  if (texto.includes("nequi")) return METODOS_PAGO.NEQUI;
  if (permitirCredito && (texto.includes("credito") || texto.includes("fiado") || texto.includes("pendiente"))) return METODOS_PAGO.CREDITO;
  if (texto.includes("otro")) return METODOS_PAGO.OTRO;

  return fallback;
}

export function esMetodoPagoCredito(valor) {
  return normalizarMetodoPago(valor, { permitirCredito: true }) === METODOS_PAGO.CREDITO;
}
