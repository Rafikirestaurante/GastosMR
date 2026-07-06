export function money(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(number);
}

export function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function currentMonthKey() {
  return todayISO().slice(0, 7);
}

export function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function movementSign(tipoMovimiento) {
  return normalizeText(tipoMovimiento) === 'ingreso' ? 1 : -1;
}

export function getMonthKey(fecha) {
  return String(fecha || '').slice(0, 7);
}

export function sumBy(items, getter) {
  return items.reduce((total, item) => total + Number(getter(item) || 0), 0);
}
