/************************************************************
 * Control Gastos Milena - Fase 2E
 * Backend Google Apps Script para Google Sheets.
 *
 * Hoja principal activa: "Tabla Oficial".
 * La hoja anterior "Gastos Mile" queda desactivada para la app.
 *
 * Columnas esperadas en Tabla Oficial:
 * Gastos Fecha | Proveedor | Concepto | Ingreso | Egreso | Categoría | Subcategoría
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

  const headers = HEADERS[entity];
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  return values
    .map((row, index) => entity === 'mile' ? mapMileRow_(row, index + 2) : mapRafaRow_(row))
    .filter(row => String(row.id || '').trim() !== '');
}

function mapMileRow_(row, rowNumber) {
  const fecha = formatDate_(row[0]);
  const proveedor = String(row[1] || '').trim();
  const concepto = String(row[2] || '').trim();
  const ingreso = Number(row[3] || 0);
  const egreso = Number(row[4] || 0);
  const categoria = String(row[5] || '').trim();
  const subcategoria = String(row[6] || '').trim();

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

function mapRafaRow_(row) {
  return {
    id: String(row[0] || '').trim(),
    fecha: formatDate_(row[1]),
    concepto: String(row[2] || '').trim(),
    monto: Number(row[3] || 0),
    categoria: String(row[4] || '').trim()
  };
}

function formatDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return text;
}

function parseDate_(text) {
  const value = String(text || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('La fecha debe tener formato YYYY-MM-DD.');
  }
  const parts = value.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function normalizeText_(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function officialAmounts_(data) {
  const ingresoDirecto = Number(data.ingreso || 0);
  const egresoDirecto = Number(data.egreso || 0);
  const tipo = normalizeText_(data.tipoMovimiento);
  const monto = Number(data.monto || 0);
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
      Number(data.monto),
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
      Number(data.monto),
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

  if (Number(data.monto) <= 0) {
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
