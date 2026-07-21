export function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const raw = String(value ?? '').trim();
  if (!raw) return 0;

  let cleaned = raw
    .replace(/[^0-9,.-]/g, '')
    .replace(/(?!^)-/g, '');

  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === ',') return 0;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    const decimals = cleaned.length - lastComma - 1;
    cleaned = decimals > 0 && decimals <= 2
      ? cleaned.replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (lastDot > -1) {
    const parts = cleaned.split('.');
    const decimals = cleaned.length - lastDot - 1;
    cleaned = parts.length > 2 || decimals === 3
      ? cleaned.replace(/\./g, '')
      : cleaned;
  }

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

export function money(value) {
  const number = parseAmount(value);
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

export function toDateKey(fecha) {
  const text = String(fecha || '').trim();
  if (!text) return '';

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  const slashMatch = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0');
    const month = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return text.slice(0, 10);
}

export function isDateInRange(fecha, from, to) {
  const key = toDateKey(fecha);
  if (!key) return false;
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}

export function getMonthBounds(monthKey) {
  const key = /^\d{4}-\d{2}$/.test(String(monthKey || '')) ? monthKey : currentMonthKey();
  const [yearText, monthText] = key.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${key}-01`,
    to: `${key}-${String(lastDay).padStart(2, '0')}`
  };
}

export function getMonthKey(fecha) {
  const key = toDateKey(fecha);
  return key ? key.slice(0, 7) : '';
}
export function sumBy(items, getter) {
  return items.reduce((total, item) => total + parseAmount(getter(item)), 0);
}
