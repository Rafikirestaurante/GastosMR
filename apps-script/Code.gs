/************************************************************
 * Control Gastos Milena - Fase 3F
 * Backend Google Apps Script para Google Sheets.
 *
 * Hoja principal activa: "Tabla Oficial".
 * La hoja anterior "Gastos Mile" queda desactivada para la app.
 *
 * Columnas visibles esperadas en Tabla Oficial:
 * Gastos Fecha | Proveedor | Concepto | Ingreso | Egreso | Categoría | Subcategoría
 *
 * Columnas técnicas agregadas automáticamente al final:
 * ID_Transaccion | Creado_en | Actualizado_en | Estado
 *
 * Fase 2K/2L: sincronización segura para uso simultáneo y compatible con cola local.
 * Fase 3C: hoja Recordatorios sincronizada con la misma cola local de la app.
 * Fase 3E: blindaje de conexión, versión obligatoria y diagnóstico automático.
 * Fase 3F: configuración persistente en Propiedades del Script para evitar perder ID/token al implementar.
 * - ID real por movimiento, sin depender del número de fila.
 * - LockService para crear/editar/borrar sin choques.
 * - Eliminación lógica con Estado = Eliminado.
 * - Control básico de concurrencia con Actualizado_en.
 *
 * Instrucciones Fase 3F:
 * 1. Pega este archivo en Apps Script.
 * 2. Ejecuta una sola vez la función instalarConfiguracionFija().
 * 3. Luego ejecuta probarHoja() para validar acceso al Google Sheet.
 * 4. Despliega como Web App: Ejecutar como Yo / Acceso Cualquier persona.
 *
 * Importante: desde esta fase, SPREADSHEET_ID y APP_TOKEN se leen primero
 * desde Propiedades del Script. Así, al pegar versiones nuevas del código,
 * la conexión no se rompe por olvidar cambiar estas constantes.
 ************************************************************/

const PROJECT_NAME = 'Control Gastos Milena';
const BACKEND_VERSION = '1.6.5-fase-3f-configuracion-persistente';

// Valores seguros del proyecto actual. Se usan como respaldo, pero la fuente principal
// será Propiedades del Script, configurada con instalarConfiguracionFija().
const DEFAULT_SPREADSHEET_ID = '1f4UO_KTxaYuhUHAKk94CUrGX31lIbii-iwsunVf9C0o';
const DEFAULT_APP_TOKEN = 'rafa1234';

const CONFIG = readPersistentConfig_();
const SPREADSHEET_ID = CONFIG.spreadsheetId;
const APP_TOKEN = CONFIG.appToken;
const CONFIG_SOURCE = CONFIG.source;

const SHEETS = {
  mile: 'Tabla Oficial',
  rafa: 'Gastos Rafa',
  config: 'Configuracion',
  reminder: 'Recordatorios',
  reminders: 'Recordatorios'
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
  mileTechnical: [
    'ID_Transaccion',
    'Creado_en',
    'Actualizado_en',
    'Estado'
  ],
  rafa: [
    'ID_Transaccion',
    'Fecha',
    'Concepto',
    'Monto',
    'Categoría'
  ],
  reminders: [
    'ID_Recordatorio',
    'Titulo',
    'Detalle',
    'Fecha',
    'Hora',
    'Recurrencia',
    'Etiqueta_Recurrencia',
    'Estado',
    'Creado_en',
    'Actualizado_en',
    'Completado_en',
    'Ultimo_Completado_en'
  ]
};

function readPersistentConfig_() {
  const fallback = {
    spreadsheetId: DEFAULT_SPREADSHEET_ID,
    appToken: DEFAULT_APP_TOKEN,
    source: 'Código fallback'
  };

  try {
    const props = PropertiesService.getScriptProperties();
    const storedSpreadsheetId = String(props.getProperty('SPREADSHEET_ID') || '').trim();
    const storedAppToken = String(props.getProperty('APP_TOKEN') || '').trim();

    return {
      spreadsheetId: storedSpreadsheetId || fallback.spreadsheetId,
      appToken: storedAppToken || fallback.appToken,
      source: storedSpreadsheetId && storedAppToken ? 'Propiedades del Script' : 'Código fallback'
    };
  } catch (error) {
    return fallback;
  }
}

function instalarConfiguracionFija() {
  PropertiesService.getScriptProperties().setProperties({
    SPREADSHEET_ID: DEFAULT_SPREADSHEET_ID,
    APP_TOKEN: DEFAULT_APP_TOKEN
  }, true);

  Logger.log('Configuración fija guardada en Propiedades del Script.');
  Logger.log('SPREADSHEET_ID: ' + DEFAULT_SPREADSHEET_ID);
  Logger.log('APP_TOKEN: ' + maskToken_(DEFAULT_APP_TOKEN));
  Logger.log('Ahora ejecuta probarHoja() y luego implementa una nueva versión de la app web.');
}

function verConfiguracionGuardada() {
  const props = PropertiesService.getScriptProperties();
  Logger.log('SPREADSHEET_ID guardado: ' + (props.getProperty('SPREADSHEET_ID') || 'No configurado'));
  Logger.log('APP_TOKEN guardado: ' + maskToken_(props.getProperty('APP_TOKEN') || ''));
  Logger.log('SPREADSHEET_ID usado por esta ejecución: ' + SPREADSHEET_ID);
  Logger.log('APP_TOKEN usado por esta ejecución: ' + maskToken_(APP_TOKEN));
  Logger.log('Fuente de configuración: ' + CONFIG_SOURCE);
}

function actualizarConfiguracionManual(spreadsheetId, appToken) {
  const cleanSpreadsheetId = String(spreadsheetId || '').trim();
  const cleanAppToken = String(appToken || '').trim();
  if (!cleanSpreadsheetId || !cleanAppToken) {
    throw new Error('Debes enviar spreadsheetId y appToken.');
  }
  PropertiesService.getScriptProperties().setProperties({
    SPREADSHEET_ID: cleanSpreadsheetId,
    APP_TOKEN: cleanAppToken
  }, true);
  Logger.log('Configuración actualizada manualmente.');
}

function maskToken_(token) {
  const text = String(token || '').trim();
  if (!text) return '';
  if (text.length <= 4) return '****';
  return text.slice(0, 2) + '***' + text.slice(-2);
}

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
      return respond_({
        ok: true,
        message: 'Apps Script conectado correctamente.',
        projectName: PROJECT_NAME,
        backendVersion: BACKEND_VERSION,
        configuredSpreadsheetId: maskId_(SPREADSHEET_ID),
        configuredSpreadsheetIdFull: SPREADSHEET_ID,
        configSource: CONFIG_SOURCE,
        scriptTimeZone: Session.getScriptTimeZone(),
        generatedAt: nowIso_()
      }, callback);
    }

    if (action === 'diagnostic') {
      return respond_(buildDiagnostic_(), callback);
    }

    if (action === 'bootstrap') {
      return respond_({
        ok: true,
        data: {
          config: readConfig_(),
          mile: readRows_('mile'),
          rafa: readRows_('rafa'),
          reminders: readRows_('reminders')
        }
      }, callback);
    }

    if (action === 'create') {
      const result = createRow_(payload.entity, payload.data || {});
      return respond_({ ok: true, data: result }, callback);
    }

    if (action === 'update') {
      const result = updateRow_(payload.entity, payload.id, payload.data || {}, payload.lastKnownUpdatedAt || '');
      return respond_({ ok: true, data: result }, callback);
    }

    if (action === 'delete') {
      const result = deleteRow_(payload.entity, payload.id, payload.lastKnownUpdatedAt || '');
      return respond_({ ok: true, data: result }, callback);
    }

    return respond_({ ok: false, message: 'Acción no soportada: ' + action }, callback);
  } catch (error) {
    return respond_({ ok: false, message: error.message || String(error) }, callback);
  }
}

function probarHoja() {
  Logger.log('Probando acceso al Google Sheet...');
  Logger.log('SPREADSHEET_ID configurado: ' + SPREADSHEET_ID);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Logger.log('OK. Nombre del archivo: ' + ss.getName());
  Logger.log('URL: ' + ss.getUrl());
  Logger.log('Hojas encontradas: ' + ss.getSheets().map(sheet => sheet.getName()).join(' | '));
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

function probarDiagnostico() {
  const response = doGet({
    parameter: {
      action: 'diagnostic',
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
  const responseObj = Object.assign({
    projectName: PROJECT_NAME,
    backendVersion: BACKEND_VERSION,
    scriptTimeZone: Session.getScriptTimeZone(),
    generatedAt: nowIso_()
  }, obj || {});
  const text = JSON.stringify(responseObj);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + text + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(text)
    .setMimeType(ContentService.MimeType.JSON);
}


function maskId_(id) {
  const text = String(id || '').trim();
  if (!text) return '';
  if (text.length <= 14) return text;
  return text.slice(0, 8) + '...' + text.slice(-6);
}

function buildDiagnostic_() {
  const result = {
    ok: true,
    projectName: PROJECT_NAME,
    backendVersion: BACKEND_VERSION,
    configuredSpreadsheetId: maskId_(SPREADSHEET_ID),
    configuredSpreadsheetIdFull: SPREADSHEET_ID,
    configSource: CONFIG_SOURCE,
    tokenPreview: maskToken_(APP_TOKEN),
    tokenConfigured: Boolean(APP_TOKEN),
    scriptTimeZone: Session.getScriptTimeZone(),
    generatedAt: nowIso_(),
    spreadsheet: {
      ok: false,
      name: '',
      url: '',
      sheets: [],
      recordatoriosSheet: false,
      tablaOficialSheet: false,
      configuracionSheet: false,
      gastosRafaSheet: false
    }
  };

  try {
    const spreadsheet = getSpreadsheet_();
    const sheetNames = spreadsheet.getSheets().map(sheet => sheet.getName());
    result.spreadsheet = {
      ok: true,
      name: spreadsheet.getName(),
      url: spreadsheet.getUrl(),
      sheets: sheetNames,
      recordatoriosSheet: sheetNames.indexOf(SHEETS.reminders) !== -1,
      tablaOficialSheet: sheetNames.indexOf(SHEETS.mile) !== -1,
      configuracionSheet: sheetNames.indexOf(SHEETS.config) !== -1,
      gastosRafaSheet: sheetNames.indexOf(SHEETS.rafa) !== -1
    };
  } catch (error) {
    result.ok = false;
    result.message = 'Apps Script respondió, pero no pudo abrir el Google Sheet configurado.';
    result.spreadsheet.error = error.message || String(error);
  }

  return result;
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet_(entity) {
  const sheetName = SHEETS[entity];
  if (!sheetName) throw new Error('Entidad no válida.');
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet && entity === 'reminders') {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, HEADERS.reminders.length).setValues([HEADERS.reminders]);
    sheet.setFrozenRows(1);
  }
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
  if (entity === 'mile') {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const indexes = ensureOfficialSchema_(sheet);
      const currentLastRow = sheet.getLastRow();
      if (currentLastRow < 2) return [];
      const width = Math.max.apply(null, Object.values(indexes)) + 1;
      const values = sheet.getRange(2, 1, currentLastRow - 1, width).getValues();

      return values
        .map((row, index) => mapMileRow_(row, index + 2, null, indexes))
        .filter(row => String(row.id || '').trim() !== '' && normalizeText_(row.estado) !== 'eliminado');
    } finally {
      lock.releaseLock();
    }
  }

  if (entity === 'reminders') {
    ensureReminderSchema_(sheet);
    const currentLastRow = sheet.getLastRow();
    if (currentLastRow < 2) return [];
    const values = sheet.getRange(2, 1, currentLastRow - 1, HEADERS.reminders.length).getValues();
    return values
      .map((row) => mapReminderRow_(row))
      .filter(row => String(row.id || '').trim() !== '' && row.status !== 'deleted');
  }

  if (lastRow < 2) return [];
  const headers = HEADERS[entity];
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  return values
    .map((row) => mapRafaRow_(row, null))
    .filter(row => String(row.id || '').trim() !== '');
}

function ensureOfficialSchema_(sheet) {
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, HEADERS.mile.length).setValues([HEADERS.mile]);
  }

  let lastColumn = Math.max(sheet.getLastColumn(), HEADERS.mile.length);
  let headerRow = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];

  if (headerRow.every(value => String(value || '').trim() === '')) {
    sheet.getRange(1, 1, 1, HEADERS.mile.length).setValues([HEADERS.mile]);
    lastColumn = HEADERS.mile.length;
    headerRow = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  }

  const technicalMissing = HEADERS.mileTechnical.filter(header => findHeaderIndex_(headerRow, [header], -1) === -1);
  if (technicalMissing.length) {
    sheet.getRange(1, lastColumn + 1, 1, technicalMissing.length).setValues([technicalMissing]);
    try {
      sheet.hideColumns(lastColumn + 1, technicalMissing.length);
    } catch (error) {
      // Si Google Sheets no permite ocultar por algún motivo, la app continúa funcionando.
    }
    lastColumn += technicalMissing.length;
    headerRow = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  }

  const indexes = buildOfficialIndex_(headerRow);
  assignMissingOfficialMetadata_(sheet, indexes);
  return indexes;
}

function assignMissingOfficialMetadata_(sheet, indexes) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const width = Math.max.apply(null, Object.values(indexes)) + 1;
  const range = sheet.getRange(2, 1, lastRow - 1, width);
  const values = range.getValues();
  const existingIds = collectExistingIds_(values, indexes.id);
  let changed = false;
  const now = nowIso_();

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const fecha = formatDate_(cell_(row, indexes.fecha), '');
    const proveedor = String(cell_(row, indexes.proveedor) || '').trim();
    const concepto = String(cell_(row, indexes.concepto) || '').trim();
    const ingreso = parseAmount_(cell_(row, indexes.ingreso));
    const egreso = parseAmount_(cell_(row, indexes.egreso));
    const isEmpty = !fecha && !proveedor && !concepto && ingreso <= 0 && egreso <= 0;
    if (isEmpty) continue;

    if (!String(cell_(row, indexes.id) || '').trim()) {
      const id = generateUniqueOfficialId_(existingIds);
      row[indexes.id] = id;
      existingIds[id] = true;
      changed = true;
    }

    if (!String(cell_(row, indexes.creadoEn) || '').trim()) {
      row[indexes.creadoEn] = now;
      changed = true;
    }

    if (!String(cell_(row, indexes.actualizadoEn) || '').trim()) {
      row[indexes.actualizadoEn] = now;
      changed = true;
    }

    if (!String(cell_(row, indexes.estado) || '').trim()) {
      row[indexes.estado] = 'Activo';
      changed = true;
    }
  }

  if (changed) {
    range.setValues(values);
  }
}

function collectExistingIds_(values, idIndex) {
  const ids = {};
  values.forEach(row => {
    const id = String(cell_(row, idIndex) || '').trim();
    if (id) ids[id] = true;
  });
  return ids;
}

function buildOfficialIndex_(headers) {
  return {
    fecha: findHeaderIndex_(headers, ['gastosfecha', 'fecha'], 0),
    proveedor: findHeaderIndex_(headers, ['proveedor'], 1),
    concepto: findHeaderIndex_(headers, ['concepto'], 2),
    ingreso: findHeaderIndex_(headers, ['ingreso', 'ingresos'], 3),
    egreso: findHeaderIndex_(headers, ['egreso', 'egresos', 'gasto', 'gastos'], 4),
    categoria: findHeaderIndex_(headers, ['categoria'], 5),
    subcategoria: findHeaderIndex_(headers, ['subcategoria'], 6),
    id: findHeaderIndex_(headers, ['idtransaccion', 'id_transaccion', 'id', 'idmovimiento'], 7),
    creadoEn: findHeaderIndex_(headers, ['creadoen', 'creado_en'], 8),
    actualizadoEn: findHeaderIndex_(headers, ['actualizadoen', 'actualizado_en'], 9),
    estado: findHeaderIndex_(headers, ['estado'], 10)
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

function setCell_(row, index, value) {
  if (index < 0) return;
  while (row.length <= index) row.push('');
  row[index] = value;
}

function mapMileRow_(row, rowNumber, displayRow, indexes) {
  const display = displayRow || [];
  const idx = indexes || buildOfficialIndex_(HEADERS.mile.concat(HEADERS.mileTechnical));
  const fecha = formatDate_(cell_(row, idx.fecha), cell_(display, idx.fecha));
  const proveedor = String(cell_(row, idx.proveedor) || cell_(display, idx.proveedor) || '').trim();
  const concepto = String(cell_(row, idx.concepto) || cell_(display, idx.concepto) || '').trim();
  const ingreso = parseAmount_(cell_(row, idx.ingreso), cell_(display, idx.ingreso));
  const egreso = parseAmount_(cell_(row, idx.egreso), cell_(display, idx.egreso));
  const categoria = String(cell_(row, idx.categoria) || cell_(display, idx.categoria) || '').trim();
  const subcategoria = String(cell_(row, idx.subcategoria) || cell_(display, idx.subcategoria) || '').trim();
  const id = String(cell_(row, idx.id) || cell_(display, idx.id) || '').trim();
  const creadoEn = String(cell_(row, idx.creadoEn) || cell_(display, idx.creadoEn) || '').trim();
  const actualizadoEn = String(cell_(row, idx.actualizadoEn) || cell_(display, idx.actualizadoEn) || '').trim();
  const estado = String(cell_(row, idx.estado) || cell_(display, idx.estado) || 'Activo').trim() || 'Activo';

  if (!fecha && !proveedor && !concepto && ingreso <= 0 && egreso <= 0) {
    return { id: '' };
  }

  return {
    id: id || ('TO' + rowNumber),
    fecha: fecha,
    proveedor: proveedor,
    concepto: concepto,
    ingreso: ingreso,
    egreso: egreso,
    tipoMovimiento: ingreso > 0 ? 'Ingreso' : 'Egreso',
    monto: ingreso > 0 ? ingreso : egreso,
    categoria: categoria,
    subcategoria: subcategoria,
    creadoEn: creadoEn,
    actualizadoEn: actualizadoEn,
    estado: estado
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

function ensureReminderSchema_(sheet) {
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, HEADERS.reminders.length).setValues([HEADERS.reminders]);
    return;
  }

  const lastColumn = Math.max(sheet.getLastColumn(), HEADERS.reminders.length);
  const headerRow = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const isBlank = headerRow.every(value => String(value || '').trim() === '');
  if (isBlank) {
    sheet.getRange(1, 1, 1, HEADERS.reminders.length).setValues([HEADERS.reminders]);
    return;
  }

  const missing = HEADERS.reminders.filter(header => findHeaderIndex_(headerRow, [header], -1) === -1);
  if (missing.length) {
    sheet.getRange(1, lastColumn + 1, 1, missing.length).setValues([missing]);
  }
}

function mapReminderRow_(row) {
  const statusRaw = normalizeText_(row[7] || 'pending');
  const status = statusRaw === 'completado' || statusRaw === 'done' ? 'done' : statusRaw === 'eliminado' || statusRaw === 'deleted' ? 'deleted' : 'pending';
  return {
    id: String(row[0] || '').trim(),
    text: String(row[1] || '').trim(),
    detail: String(row[2] || '').trim(),
    dueDate: formatDate_(row[3], row[3]),
    dueTime: formatTime_(row[4]),
    recurrence: String(row[5] || 'none').trim() || 'none',
    recurrenceLabel: String(row[6] || '').trim(),
    status: status,
    createdAt: String(row[8] || '').trim(),
    updatedAt: String(row[9] || '').trim(),
    completedAt: String(row[10] || '').trim(),
    lastCompletedAt: String(row[11] || '').trim()
  };
}

function formatTime_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm');
  }
  const text = String(value || '').trim();
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return text;
  return String(match[1]).padStart(2, '0') + ':' + match[2];
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

function nowIso_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

function createRow_(entity, data) {
  if (entity !== 'mile' && entity !== 'rafa' && entity !== 'reminder') throw new Error('Entidad no válida.');
  validateRequired_(entity, data);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSheet_(entity);
    if (entity === 'reminder') {
      ensureReminderSchema_(sheet);
      const id = generateId_(entity, sheet);
      const now = nowIso_();
      const row = [
        id,
        data.text || data.titulo || '',
        data.detail || data.detalle || '',
        data.dueDate ? parseDate_(data.dueDate) : '',
        data.dueTime || '',
        data.recurrence || 'none',
        data.recurrenceLabel || '',
        data.status === 'done' ? 'Completado' : 'Pendiente',
        data.createdAt || now,
        now,
        data.completedAt || '',
        data.lastCompletedAt || ''
      ];
      sheet.appendRow(row);
      return mapReminderRow_(row);
    }

    if (entity === 'mile') {
      const indexes = ensureOfficialSchema_(sheet);
      const amounts = officialAmounts_(data);
      const width = Math.max.apply(null, Object.values(indexes)) + 1;
      const existingIds = readOfficialIds_(sheet, indexes);
      const now = nowIso_();
      const id = generateUniqueOfficialId_(existingIds);
      const row = new Array(width).fill('');

      setCell_(row, indexes.fecha, parseDate_(data.fecha));
      setCell_(row, indexes.proveedor, data.proveedor);
      setCell_(row, indexes.concepto, data.concepto);
      setCell_(row, indexes.ingreso, amounts.ingreso);
      setCell_(row, indexes.egreso, amounts.egreso);
      setCell_(row, indexes.categoria, data.categoria || '');
      setCell_(row, indexes.subcategoria, data.subcategoria || '');
      setCell_(row, indexes.id, id);
      setCell_(row, indexes.creadoEn, now);
      setCell_(row, indexes.actualizadoEn, now);
      setCell_(row, indexes.estado, 'Activo');

      sheet.appendRow(row);
      return mapMileRow_(row, sheet.getLastRow(), null, indexes);
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

function updateRow_(entity, id, data, lastKnownUpdatedAt) {
  if (entity !== 'mile' && entity !== 'rafa' && entity !== 'reminder') throw new Error('Entidad no válida.');
  if (!id) throw new Error('Falta ID para actualizar.');
  validateRequired_(entity, data);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSheet_(entity);

    if (entity === 'reminder') {
      ensureReminderSchema_(sheet);
      const rowNumber = findRowById_(entity, sheet, id);
      if (!rowNumber) throw new Error('No se encontró el recordatorio: ' + id);
      const now = nowIso_();
      const row = [
        id,
        data.text || data.titulo || '',
        data.detail || data.detalle || '',
        data.dueDate ? parseDate_(data.dueDate) : '',
        data.dueTime || '',
        data.recurrence || 'none',
        data.recurrenceLabel || '',
        data.status === 'done' ? 'Completado' : 'Pendiente',
        data.createdAt || '',
        now,
        data.completedAt || '',
        data.lastCompletedAt || ''
      ];
      sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
      return mapReminderRow_(row);
    }

    if (entity === 'mile') {
      const indexes = ensureOfficialSchema_(sheet);
      const rowNumber = findRowById_(entity, sheet, id, indexes);
      if (!rowNumber) throw new Error('No se encontró el registro: ' + id);

      assertNotChanged_(sheet, rowNumber, indexes, lastKnownUpdatedAt);

      const amounts = officialAmounts_(data);
      const width = Math.max.apply(null, Object.values(indexes)) + 1;
      const rowRange = sheet.getRange(rowNumber, 1, 1, width);
      const row = rowRange.getValues()[0];
      const now = nowIso_();

      setCell_(row, indexes.fecha, parseDate_(data.fecha));
      setCell_(row, indexes.proveedor, data.proveedor);
      setCell_(row, indexes.concepto, data.concepto);
      setCell_(row, indexes.ingreso, amounts.ingreso);
      setCell_(row, indexes.egreso, amounts.egreso);
      setCell_(row, indexes.categoria, data.categoria || '');
      setCell_(row, indexes.subcategoria, data.subcategoria || '');
      setCell_(row, indexes.id, id);
      setCell_(row, indexes.actualizadoEn, now);
      setCell_(row, indexes.estado, 'Activo');

      rowRange.setValues([row]);
      return mapMileRow_(row, rowNumber, null, indexes);
    }

    const rowNumber = findRowById_(entity, sheet, id);
    if (!rowNumber) throw new Error('No se encontró el registro: ' + id);

    const row = [
      id,
      parseDate_(data.fecha),
      data.concepto,
      parseAmount_(data.monto),
      data.categoria
    ];

    sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
    return mapRafaRow_(row);
  } finally {
    lock.releaseLock();
  }
}

function deleteRow_(entity, id, lastKnownUpdatedAt) {
  if (entity !== 'mile' && entity !== 'rafa' && entity !== 'reminder') throw new Error('Entidad no válida.');
  if (!id) throw new Error('Falta ID para borrar.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSheet_(entity);

    if (entity === 'reminder') {
      ensureReminderSchema_(sheet);
      const rowNumber = findRowById_(entity, sheet, id);
      if (!rowNumber) throw new Error('No se encontró el recordatorio: ' + id);
      const now = nowIso_();
      sheet.getRange(rowNumber, 8).setValue('Eliminado');
      sheet.getRange(rowNumber, 10).setValue(now);
      return { id: id, status: 'deleted', updatedAt: now };
    }

    if (entity === 'mile') {
      const indexes = ensureOfficialSchema_(sheet);
      const rowNumber = findRowById_(entity, sheet, id, indexes);
      if (!rowNumber) throw new Error('No se encontró el registro: ' + id);

      assertNotChanged_(sheet, rowNumber, indexes, lastKnownUpdatedAt);

      const now = nowIso_();
      sheet.getRange(rowNumber, indexes.estado + 1).setValue('Eliminado');
      sheet.getRange(rowNumber, indexes.actualizadoEn + 1).setValue(now);
      return { id: id, estado: 'Eliminado', actualizadoEn: now };
    }

    const rowNumber = findRowById_(entity, sheet, id);
    if (!rowNumber) throw new Error('No se encontró el registro: ' + id);
    sheet.deleteRow(rowNumber);
    return { id: id };
  } finally {
    lock.releaseLock();
  }
}

function assertNotChanged_(sheet, rowNumber, indexes, lastKnownUpdatedAt) {
  const expected = String(lastKnownUpdatedAt || '').trim();
  if (!expected) return;

  const current = String(sheet.getRange(rowNumber, indexes.actualizadoEn + 1).getValue() || '').trim();
  if (current && current !== expected) {
    throw new Error('Este movimiento fue actualizado desde otro dispositivo. Presiona "Actualizar datos" y vuelve a intentar.');
  }
}

function validateRequired_(entity, data) {
  const fields = entity === 'mile'
    ? ['fecha', 'proveedor', 'concepto']
    : entity === 'reminder'
      ? ['text']
      : ['fecha', 'concepto', 'monto', 'categoria'];

  const missing = fields.filter(field => data[field] === undefined || data[field] === null || String(data[field]).trim() === '');
  if (missing.length) {
    throw new Error('Faltan campos obligatorios: ' + missing.join(', '));
  }

  if (entity === 'mile') {
    officialAmounts_(data);
    return;
  }

  if (entity === 'reminder') {
    return;
  }

  if (parseAmount_(data.monto) <= 0) {
    throw new Error('El monto debe ser mayor que cero.');
  }
}

function findRowById_(entity, sheet, id, indexes) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  if (entity === 'mile') {
    const idx = indexes || ensureOfficialSchema_(sheet);
    const ids = sheet.getRange(2, idx.id + 1, lastRow - 1, 1).getValues().flat();
    const target = String(id).trim();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i]).trim() === target) return i + 2;
    }
    return 0;
  }

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const target = String(id).trim();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i]).trim() === target) return i + 2;
  }
  return 0;
}

function readOfficialIds_(sheet, indexes) {
  const lastRow = sheet.getLastRow();
  const ids = {};
  if (lastRow < 2) return ids;

  const values = sheet.getRange(2, indexes.id + 1, lastRow - 1, 1).getValues().flat();
  values.forEach(value => {
    const id = String(value || '').trim();
    if (id) ids[id] = true;
  });
  return ids;
}

function generateUniqueOfficialId_(existingIds) {
  let id = '';
  do {
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
    const random = Math.floor(Math.random() * 9000 + 1000);
    id = 'TO-' + stamp + '-' + random;
  } while (existingIds[id]);
  existingIds[id] = true;
  return id;
}

function generateId_(entity, sheet) {
  const prefix = entity === 'mile' ? 'TO' : entity === 'reminder' ? 'REM' : 'R';
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
