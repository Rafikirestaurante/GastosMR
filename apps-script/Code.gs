/************************************************************
 * Control Gastos Milena - Fase 2G
 * Backend Google Apps Script para Google Sheets.
 *
 * Hoja principal activa: "Tabla Oficial".
 * La hoja anterior "Gastos Mile" queda desactivada para la app.
 *
 * Columnas esperadas en Tabla Oficial:
 * Gastos Fecha | Proveedor | Concepto | Ingreso | Egreso | Categoría | Subcategoría
 *
 * Fase 2F/2G: lectura blindada para dashboard. Soporta valores como
 * $ 1.200.000, 1,200,000 o números con formato de moneda en Sheets.
 *
 * Instrucciones:
 * 1. Pega este archivo en Apps Script.
 * 2. Ajusta SPREADSHEET_ID y APP_TOKEN.
 * 3. Usa el mismo APP_TOKEN en Vercel/.env.
 * 4. Despliega como Web App: Ejecutar como Yo / Acceso Cualquier persona.
 ************************************************************/

const SPREADSHEET_ID = 'PEGA_AQUI_EL_ID_DE_TU_GOOGLE_SHEET';
const APP_TOKEN = 'cambia-este-token-largo';

const SHEETS = {
  mile: 'Tabla Oficial',
  rafa: 'Gastos Rafa',
  config: 'Configuracion'
};

const HEADERS = {
  mile: [
    'Gastos Fecha',
    'Proveedor',
    'Concepto',
    'Ingreso',
    'Egreso',
    'Categoría',
    'Subcategoría'
  ],
  rafa: [
    'ID_Transaccion',
    'Fecha',
    'Concepto',
    'Monto',
    'Categoría'
  ]
};

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const callback = sanitizeCallback_(params.callback || '');

  try {
    const token = params.token || '';
    if (token !== APP_TOKEN) {
      return respond_({ ok: false, message: 'Token inválido.' }, callback);
    }

    const action = params.action || 'bootstrap';
    const payload = parsePayload_(params.payload);

    if (action === 'health') {
      return respond_({ ok: true, message: 'Apps Script conectado correctamente.' }, callback);
    }

    if (action === 'bootstrap') {
      return respond_({
        ok: true,
        data: {
          config: readConfig_(),
          mile: readRows_('mile'),
          rafa: readRows_('rafa')
        }
      }, callback);
    }

    if (action === 'create') {
      const result = createRow_(payload.entity, payload.data || {});
      return respond_({ ok: true, data: result }, callback);
    }

    if (action === 'update') {
      updateRow_(payload.entity, payload.id, payload.data || {});
      return respond_({ ok: true }, callback);
    }

    if (action === 'delete') {
      deleteRow_(payload.entity, payload.id);
      return respond_({ ok: true }, callback);
    }

    return respond_({ ok: false, message: 'Acción no soportada: ' + action }, callback);
  } catch (error) {
    return respond_({ ok: false, message: error.message || String(error) }, callback);
  }
}

function probarConexion() {
  const response = doGet({
    parameter: {
      action: 'bootstrap',
      token: APP_TOKEN
    }
  });
  Logger.log(response.getContent());
}

function parsePayload_(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error('Payload inválido.');
  }
}

function sanitizeCallback_(callback) {
  if (!callback) return '';
  return /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(callback) ? callback : '';
}

function respond_(obj, callback) {
  const text = JSON.stringify(obj);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + text + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(text)
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet_(entity) {
  const sheetName = SHEETS[entity];
  if (!sheetName) throw new Error('Entidad no válida.');
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('No existe la hoja: ' + sheetName);
  return sheet;
}

function readConfig_() {
  const sheet = getSheet_('config');
  const lastRow = Math.max(sheet.getLastRow(), 2);
  const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  const tipos = uniqueClean_(values.map(row => row[1]));

  return {
    categorias: uniqueClean_(values.map(row => row[0])),
    tiposMovimiento: tipos.length ? tipos : ['Ingreso', 'Egreso'],
    subcategorias: uniqueClean_(values.map(row => row[2]))
  };
}

function uniqueClean_(values) {
  const seen = {};
  return values
    .map(value => String(value || '').trim())
    .filter(value => {
      if (!value || seen[value]) return false;
      seen[value] = true;
      return true;
    });
}

function readRows_(entity) {
  const sheet = getSheet_(entity);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  if (entity === 'mile') {
    const width = Math.max(sheet.getLastColumn(), HEADERS.mile.length);
    const headerRow = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
    const indexes = buildOfficialIndex_(headerRow);
    const values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
    const displayValues = sheet.getRange(2, 1, lastRow - 1, width).getDisplayValues();

    return values
      .map((row, index) => mapMileRow_(row, index + 2, displayValues[index], indexes))
      .filter(row => String(row.id || '').trim() !== '');
  }

  const headers = HEADERS[entity];
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const displayValues = sheet.getRange(2, 1, lastRow - 1, headers.length).getDisplayValues();

  return values
    .map((row, index) => mapRafaRow_(row, displayValues[index]))
    .filter(row => String(row.id || '').trim() !== '');
}

function buildOfficialIndex_(headers) {
  return {
    fecha: findHeaderIndex_(headers, ['gastosfecha', 'fecha'], 0),
    proveedor: findHeaderIndex_(headers, ['proveedor'], 1),
    concepto: findHeaderIndex_(headers, ['concepto'], 2),
    ingreso: findHeaderIndex_(headers, ['ingreso', 'ingresos'], 3),
    egreso: findHeaderIndex_(headers, ['egreso', 'egresos', 'gasto', 'gastos'], 4),
    categoria: findHeaderIndex_(headers, ['categoria'], 5),
    subcategoria: findHeaderIndex_(headers, ['subcategoria'], 6)
  };
}

function headerKey_(value) {
  return normalizeText_(value)
    .replace(/\s+/g, '')
    .replace(/_/g, '');
}

function findHeaderIndex_(headers, aliases, fallback) {
  const normalizedAliases = aliases.map(alias => headerKey_(alias));
  for (let i = 0; i < headers.length; i++) {
    if (normalizedAliases.indexOf(headerKey_(headers[i])) !== -1) return i;
  }
  return fallback;
}

function cell_(row, index) {
  return index >= 0 && index < row.length ? row[index] : '';
}

function mapMileRow_(row, rowNumber, displayRow, indexes) {
  const display = displayRow || [];
  const idx = indexes || buildOfficialIndex_(HEADERS.mile);
  const fecha = formatDate_(cell_(row, idx.fecha), cell_(display, idx.fecha));
  const proveedor = String(cell_(row, idx.proveedor) || cell_(display, idx.proveedor) || '').trim();
  const concepto = String(cell_(row, idx.concepto) || cell_(display, idx.concepto) || '').trim();
  const ingreso = parseAmount_(cell_(row, idx.ingreso), cell_(display, idx.ingreso));
  const egreso = parseAmount_(cell_(row, idx.egreso), cell_(display, idx.egreso));
  const categoria = String(cell_(row, idx.categoria) || cell_(display, idx.categoria) || '').trim();
  const subcategoria = String(cell_(row, idx.subcategoria) || cell_(display, idx.subcategoria) || '').trim();

  if (!fecha && !proveedor && !concepto && ingreso <= 0 && egreso <= 0) {
    return { id: '' };
  }

  return {
    id: 'TO' + rowNumber,
    fecha: fecha,
    proveedor: proveedor,
    concepto: concepto,
    ingreso: ingreso,
    egreso: egreso,
    tipoMovimiento: ingreso > 0 ? 'Ingreso' : 'Egreso',
    monto: ingreso > 0 ? ingreso : egreso,
    categoria: categoria,
    subcategoria: subcategoria
  };
}

function mapRafaRow_(row, displayRow) {
  const display = displayRow || [];
  return {
    id: String(row[0] || display[0] || '').trim(),
    fecha: formatDate_(row[1], display[1]),
    concepto: String(row[2] || display[2] || '').trim(),
    monto: parseAmount_(row[3], display[3]),
    categoria: String(row[4] || display[4] || '').trim()
  };
}

function formatDate_(value, displayValue) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  let text = String(value || displayValue || '').trim();
  if (!text) return '';

  const iso = text.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (iso) {
    return iso[1] + '-' + String(iso[2]).padStart(2, '0') + '-' + String(iso[3]).padStart(2, '0');
  }

  const local = text.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (local) {
    return local[3] + '-' + String(local[2]).padStart(2, '0') + '-' + String(local[1]).padStart(2, '0');
  }

  return text;
}

function parseDate_(text) {
  const value = String(text || '').trim();

  let match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  match = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));

  throw new Error('La fecha debe tener formato YYYY-MM-DD.');
}

function normalizeText_(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function parseAmount_(value, displayValue) {
  if (typeof value === 'number' && isFinite(value)) return value;

  let raw = String(value || displayValue || '').trim();
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
  return isFinite(number) ? number : 0;
}

function officialAmounts_(data) {
  const ingresoDirecto = parseAmount_(data.ingreso);
  const egresoDirecto = parseAmount_(data.egreso);
  const tipo = normalizeText_(data.tipoMovimiento);
  const monto = parseAmount_(data.monto);
  const ingreso = ingresoDirecto > 0 ? ingresoDirecto : tipo === 'ingreso' ? monto : 0;
  const egreso = egresoDirecto > 0 ? egresoDirecto : tipo === 'egreso' ? monto : 0;

  if (ingreso > 0 && egreso > 0) {
    throw new Error('Un movimiento no puede tener ingreso y egreso al mismo tiempo.');
  }

  if (ingreso <= 0 && egreso <= 0) {
    throw new Error('Debes registrar un valor mayor que cero en Ingreso o Egreso.');
  }

  return { ingreso: ingreso, egreso: egreso };
}

function createRow_(entity, data) {
  if (entity !== 'mile' && entity !== 'rafa') throw new Error('Entidad no válida.');
  validateRequired_(entity, data);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSheet_(entity);
    if (entity === 'mile') {
      const amounts = officialAmounts_(data);
      const row = [
        parseDate_(data.fecha),
        data.proveedor,
        data.concepto,
        amounts.ingreso,
        amounts.egreso,
        data.categoria || '',
        data.subcategoria || ''
      ];
      sheet.appendRow(row);
      return mapMileRow_(row, sheet.getLastRow());
    }

    const id = generateId_(entity, sheet);
    const row = [
      id,
      parseDate_(data.fecha),
      data.concepto,
      parseAmount_(data.monto),
      data.categoria
    ];

    sheet.appendRow(row);
    return mapRafaRow_(row);
  } finally {
    lock.releaseLock();
  }
}

function updateRow_(entity, id, data) {
  if (entity !== 'mile' && entity !== 'rafa') throw new Error('Entidad no válida.');
  if (!id) throw new Error('Falta ID para actualizar.');
  validateRequired_(entity, data);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSheet_(entity);
    const rowNumber = findRowById_(entity, sheet, id);
    if (!rowNumber) throw new Error('No se encontró el registro: ' + id);

    if (entity === 'mile') {
      const amounts = officialAmounts_(data);
      const row = [
        parseDate_(data.fecha),
        data.proveedor,
        data.concepto,
        amounts.ingreso,
        amounts.egreso,
        data.categoria || '',
        data.subcategoria || ''
      ];
      sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
      return;
    }

    const row = [
      id,
      parseDate_(data.fecha),
      data.concepto,
      parseAmount_(data.monto),
      data.categoria
    ];

    sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  } finally {
    lock.releaseLock();
  }
}

function deleteRow_(entity, id) {
  if (entity !== 'mile' && entity !== 'rafa') throw new Error('Entidad no válida.');
  if (!id) throw new Error('Falta ID para borrar.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSheet_(entity);
    const rowNumber = findRowById_(entity, sheet, id);
    if (!rowNumber) throw new Error('No se encontró el registro: ' + id);
    sheet.deleteRow(rowNumber);
  } finally {
    lock.releaseLock();
  }
}

function validateRequired_(entity, data) {
  const fields = entity === 'mile'
    ? ['fecha', 'proveedor', 'concepto']
    : ['fecha', 'concepto', 'monto', 'categoria'];

  const missing = fields.filter(field => data[field] === undefined || data[field] === null || String(data[field]).trim() === '');
  if (missing.length) {
    throw new Error('Faltan campos obligatorios: ' + missing.join(', '));
  }

  if (entity === 'mile') {
    officialAmounts_(data);
    return;
  }

  if (parseAmount_(data.monto) <= 0) {
    throw new Error('El monto debe ser mayor que cero.');
  }
}

function findRowById_(entity, sheet, id) {
  if (entity === 'mile') {
    const match = String(id || '').match(/^TO(\d+)$/);
    if (!match) return 0;
    const rowNumber = Number(match[1]);
    if (rowNumber < 2 || rowNumber > sheet.getLastRow()) return 0;
    return rowNumber;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const target = String(id).trim();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i]).trim() === target) return i + 2;
  }
  return 0;
}

function generateId_(entity, sheet) {
  const prefix = entity === 'mile' ? 'TO' : 'R';
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return prefix + '001';

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const max = ids.reduce((acc, id) => {
    const text = String(id || '');
    if (!text.startsWith(prefix)) return acc;
    const number = Number(text.replace(/\D/g, ''));
    return isNaN(number) ? acc : Math.max(acc, number);
  }, 0);

  return prefix + String(max + 1).padStart(3, '0');
}
