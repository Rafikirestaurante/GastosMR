const TIMEZONE_RAFIKI = "America/Bogota";

function esFechaISO(valor) {
  return typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

function formatearFechaISO(valor) {
  const [year, month, day] = String(valor).split("-");
  return `${day}/${month}/${year}`;
}

function fechaValida(valor) {
  const fecha = valor instanceof Date ? valor : new Date(valor || Date.now());
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function fechaColombiaYYYYMMDD(valor = new Date()) {
  if (esFechaISO(valor)) {
    return valor;
  }

  const fecha = fechaValida(valor);
  if (!fecha) return "";

  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_RAFIKI,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fecha);

  const mapa = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${mapa.year}-${mapa.month}-${mapa.day}`;
}

export function fechaColombiaHaceDias(dias = 0) {
  const hoyColombia = fechaColombiaYYYYMMDD();
  const [year, month, day] = hoyColombia.split("-").map(Number);
  const fechaBase = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  fechaBase.setUTCDate(fechaBase.getUTCDate() - Number(dias || 0));
  return fechaColombiaYYYYMMDD(fechaBase);
}

export function esHoyColombia(valor) {
  if (!valor) return false;
  return fechaColombiaYYYYMMDD(valor) === fechaColombiaYYYYMMDD();
}

export function fechaDentroRangoColombia(valor, fechaInicio, fechaFin) {
  if (!fechaInicio && !fechaFin) return true;
  if (!valor) return false;

  const fechaMovimiento = fechaColombiaYYYYMMDD(valor);
  if (!fechaMovimiento) return false;

  if (fechaInicio && fechaMovimiento < fechaInicio) return false;
  if (fechaFin && fechaMovimiento > fechaFin) return false;

  return true;
}

export function formatearFechaColombia(valor) {
  if (esFechaISO(valor)) return formatearFechaISO(valor);

  const fecha = fechaValida(valor);
  if (!fecha) return "—";

  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TIMEZONE_RAFIKI,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(fecha);
}

export function formatearFechaHoraColombia(valor) {
  if (esFechaISO(valor)) return formatearFechaISO(valor);

  const fecha = fechaValida(valor);
  if (!fecha) return "—";

  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TIMEZONE_RAFIKI,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
}
