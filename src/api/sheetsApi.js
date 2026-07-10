import { normalizeText, parseAmount, todayISO } from '../utils/format.js';

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';
const APP_TOKEN = import.meta.env.VITE_APP_TOKEN || '';
export const FRONTEND_VERSION = '1.6.5-fase-3f-configuracion-persistente';
export const EXPECTED_BACKEND_VERSION = '1.6.5-fase-3f-configuracion-persistente';

const DEMO_KEY = 'control-gastos-milena-demo-v3e-blindaje';
const REMOTE_CACHE_KEY = 'control-gastos-milena-last-good-v3e-blindaje';
const LAST_GOOD_DIAGNOSTIC_KEY = 'control-gastos-milena-last-good-diagnostic-v3e';
const PROXY_URL = '/api/sheets';
const DIRECT_TIMEOUT_MS = 15000;

function normalizeOfficialRow(data = {}) {
  const ingreso = parseAmount(data.ingreso);
  const egreso = parseAmount(data.egreso);
  const type = normalizeText(data.tipoMovimiento);
  const amount = parseAmount(data.monto);
  const finalIngreso = ingreso > 0 ? ingreso : type === 'ingreso' ? amount : 0;
  const finalEgreso = egreso > 0 ? egreso : type === 'egreso' ? amount : 0;

  return {
    ...data,
    ingreso: finalIngreso,
    egreso: finalEgreso,
    tipoMovimiento: finalIngreso > 0 ? 'Ingreso' : 'Egreso',
    monto: finalIngreso > 0 ? finalIngreso : finalEgreso,
    categoria: data.categoria || '',
    subcategoria: data.subcategoria || '',
    creadoEn: data.creadoEn || data.creado_en || '',
    actualizadoEn: data.actualizadoEn || data.actualizado_en || '',
    estado: data.estado || 'Activo'
  };
}

function normalizeReminderRow(data = {}) {
  const estado = data.estado || data.status || 'pending';
  const rawText = data.text || data.titulo || data.title || '';
  return {
    ...data,
    id: String(data.id || data.idRecordatorio || data.ID_Recordatorio || '').trim(),
    text: String(rawText || '').trim(),
    detail: String(data.detail || data.detalle || '').trim(),
    dueDate: data.dueDate || data.fecha || '',
    dueTime: data.dueTime || data.hora || '',
    recurrence: data.recurrence || data.recurrencia || 'none',
    recurrenceLabel: data.recurrenceLabel || data.etiquetaRecurrencia || '',
    status: String(estado).toLowerCase() === 'done' || String(estado).toLowerCase() === 'completado' ? 'done' : String(estado).toLowerCase() === 'deleted' || String(estado).toLowerCase() === 'eliminado' ? 'deleted' : 'pending',
    createdAt: data.createdAt || data.creadoEn || data.creado_en || '',
    updatedAt: data.updatedAt || data.actualizadoEn || data.actualizado_en || '',
    completedAt: data.completedAt || data.completadoEn || data.completado_en || '',
    lastCompletedAt: data.lastCompletedAt || data.ultimoCompletadoEn || ''
  };
}

const sampleState = {
  config: {
    categorias: [
      'Alimentacion',
      'Servicios Pub',
      'Transporte',
      'Salud',
      'Salidas',
      'Apto',
      'Deudas',
      'Gastos Fijos',
      'Prestamos',
      'Ahorro',
      'GV'
    ],
    tiposMovimiento: ['Ingreso', 'Egreso'],
    subcategorias: ['Inicio', 'Apto', 'Personal']
  },
  mile: [
    normalizeOfficialRow({
      id: 'TO002',
      fecha: todayISO().slice(0, 8) + '01',
      proveedor: 'Sistema',
      concepto: 'Saldo Inicial',
      ingreso: 3474387,
      egreso: 0,
      categoria: 'Ahorro',
      subcategoria: 'Inicio'
    }),
    normalizeOfficialRow({
      id: 'TO003',
      fecha: todayISO(),
      proveedor: 'Supermercado',
      concepto: 'Compra de mercado',
      ingreso: 0,
      egreso: 85000,
      categoria: 'Alimentacion',
      subcategoria: 'Personal'
    })
  ],
  rafa: [
    {
      id: 'R001',
      fecha: todayISO(),
      concepto: 'Almuerzo ocasional',
      monto: 60000,
      categoria: 'Alimentacion'
    }
  ],
  reminders: [
    normalizeReminderRow({
      id: 'REM-DEMO-001',
      text: 'Revisar recordatorios sincronizados',
      dueDate: todayISO(),
      dueTime: '09:00',
      recurrence: 'none',
      recurrenceLabel: '',
      status: 'pending',
      createdAt: nowIso(),
      updatedAt: nowIso()
    })
  ]
};

function getDemoState() {
  const raw = localStorage.getItem(DEMO_KEY);
  if (!raw) return structuredClone(sampleState);
  try {
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      mile: (parsed.mile || []).map(normalizeOfficialRow),
      rafa: parsed.rafa || [],
      reminders: (parsed.reminders || []).map(normalizeReminderRow)
    };
  } catch {
    return structuredClone(sampleState);
  }
}

function saveDemoState(state) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(state));
}

function nowIso() {
  return new Date().toISOString().slice(0, 19);
}

function newReminderId() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `REM-${stamp}-${random}`;
}

function newOfficialId() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `TO-${stamp}-${random}`;
}

function saveRemoteSnapshot(data) {
  try {
    localStorage.setItem(REMOTE_CACHE_KEY, JSON.stringify({
      savedAt: new Date().toISOString(),
      data
    }));
  } catch {
    // Si el navegador bloquea localStorage, simplemente continuamos sin caché.
  }
}


function saveLastGoodDiagnostic(result) {
  try {
    localStorage.setItem(LAST_GOOD_DIAGNOSTIC_KEY, JSON.stringify({
      savedAt: new Date().toISOString(),
      result
    }));
  } catch {
    // El diagnóstico es una ayuda; si localStorage falla, la app continúa.
  }
}

export function getLastGoodDiagnostic() {
  try {
    const raw = localStorage.getItem(LAST_GOOD_DIAGNOSTIC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.result) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getBackendVersionFromResponse(data = {}) {
  return data?.backendVersion || data?.data?.backendVersion || data?.diagnostic?.backendVersion || '';
}

function isGoodDiagnostic(result = {}) {
  const backendVersion = getBackendVersionFromResponse(result);
  return Boolean(
    result?.ok &&
    backendVersion === EXPECTED_BACKEND_VERSION &&
    result?.projectName === 'Control Gastos Milena' &&
    result?.spreadsheet?.ok &&
    result?.spreadsheet?.tablaOficialSheet &&
    result?.spreadsheet?.recordatoriosSheet
  );
}

export function buildConnectionGuardFromDiagnostic(result = {}) {
  const lastGood = getLastGoodDiagnostic();
  const backendVersion = getBackendVersionFromResponse(result);
  const spreadsheet = result?.spreadsheet || {};
  const ok = isGoodDiagnostic(result);

  let message = 'Conexión validada correctamente.';
  let reason = '';

  if (!result?.ok) {
    reason = 'diagnostic_failed';
    message = result?.message || 'No se pudo validar la conexión con Apps Script.';
  } else if (!backendVersion) {
    reason = 'backend_without_version';
    message = 'Apps Script no reporta versión. Es una implementación vieja o incorrecta.';
  } else if (backendVersion !== EXPECTED_BACKEND_VERSION) {
    reason = 'backend_version_mismatch';
    message = `Backend antiguo o diferente: ${backendVersion}. Se esperaba ${EXPECTED_BACKEND_VERSION}.`;
  } else if (result?.projectName && result.projectName !== 'Control Gastos Milena') {
    reason = 'wrong_project';
    message = `Apps Script respondió como ${result.projectName}, no como Control Gastos Milena.`;
  } else if (!spreadsheet?.ok) {
    reason = 'spreadsheet_unavailable';
    message = 'Apps Script respondió, pero no pudo abrir el Google Sheet configurado.';
  } else if (!spreadsheet?.tablaOficialSheet) {
    reason = 'missing_tabla_oficial';
    message = 'No se encontró la hoja Tabla Oficial en el Google Sheet conectado.';
  } else if (!spreadsheet?.recordatoriosSheet) {
    reason = 'missing_recordatorios';
    message = 'No se encontró la hoja Recordatorios en el Google Sheet conectado.';
  }

  return {
    checked: true,
    ok,
    blocked: !ok,
    reason,
    message,
    backendVersion: backendVersion || 'No reportada',
    expectedBackendVersion: EXPECTED_BACKEND_VERSION,
    spreadsheetName: spreadsheet?.name || '',
    spreadsheetId: result?.configuredSpreadsheetIdFull || result?.configuredSpreadsheetId || '',
    generatedAt: result?.generatedAt || '',
    lastGood
  };
}

function ensureBackendIsSafe(data = {}, action = '') {
  if (!data?.ok) return;
  if (data?.demo) return;
  if (action === 'diagnostic' || action === 'health') return;

  const backendVersion = getBackendVersionFromResponse(data);
  if (!backendVersion) {
    throw new Error('Blindaje activo: Apps Script no reporta versión. Detén la sincronización y abre Diagnóstico; probablemente Vercel apunta a una implementación vieja.');
  }
  if (backendVersion !== EXPECTED_BACKEND_VERSION) {
    throw new Error(`Blindaje activo: backend ${backendVersion} no coincide con ${EXPECTED_BACKEND_VERSION}. Actualiza la URL de Apps Script en Vercel o crea una nueva implementación.`);
  }
  if (data?.projectName && data.projectName !== 'Control Gastos Milena') {
    throw new Error(`Blindaje activo: la URL configurada pertenece a otro proyecto (${data.projectName}). Revisa VITE_APPS_SCRIPT_URL en Vercel.`);
  }
}

export function getCachedRemoteSnapshot() {
  try {
    const raw = localStorage.getItem(REMOTE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasRemoteConfig() {
  return Boolean(APPS_SCRIPT_URL && !APPS_SCRIPT_URL.includes('PEGA_AQUI') && APP_TOKEN);
}

function maskText(value = '', start = 8, end = 6) {
  const text = String(value || '');
  if (!text) return '';
  if (text.length <= start + end + 3) return text;
  return `${text.slice(0, start)}...${text.slice(-end)}`;
}

function safeUrlPreview(rawUrl = '') {
  try {
    const url = new URL(rawUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    const deploymentId = parts[2] || parts[1] || '';
    return `${url.origin}/macros/s/${maskText(deploymentId)}/exec`;
  } catch {
    return rawUrl ? 'URL inválida configurada' : '';
  }
}

export function getClientDiagnosticBase() {
  return {
    frontendVersion: FRONTEND_VERSION,
    expectedBackendVersion: EXPECTED_BACKEND_VERSION,
    remoteConfig: hasRemoteConfig(),
    appsScriptUrlConfigured: Boolean(APPS_SCRIPT_URL),
    appsScriptUrlPreview: safeUrlPreview(APPS_SCRIPT_URL),
    appTokenConfigured: Boolean(APP_TOKEN),
    appTokenPreview: APP_TOKEN ? `${APP_TOKEN.slice(0, 2)}***${APP_TOKEN.slice(-2)}` : ''
  };
}

function nextId(records, prefix) {
  const max = records.reduce((acc, item) => {
    const number = Number(String(item.id || '').replace(/\D/g, ''));
    return Number.isFinite(number) ? Math.max(acc, number) : acc;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

async function localRequest(action, payload = {}) {
  const state = getDemoState();

  if (action === 'bootstrap') {
    return {
      ok: true,
      demo: true,
      data: {
        ...state,
        mile: (state.mile || []).filter((row) => String(row.estado || 'Activo').toLowerCase() !== 'eliminado'),
        reminders: (state.reminders || []).filter((row) => String(row.status || 'pending').toLowerCase() !== 'deleted')
      }
    };
  }

  if (action === 'create') {
    const key = payload.entity === 'rafa' ? 'rafa' : payload.entity === 'reminder' ? 'reminders' : 'mile';
    const now = nowIso();
    const rawRow = key === 'mile'
      ? { ...payload.data, id: newOfficialId(), creadoEn: now, actualizadoEn: now, estado: 'Activo' }
      : key === 'reminders'
        ? { ...payload.data, id: newReminderId(), createdAt: now, updatedAt: now, status: payload.data?.status || 'pending' }
        : { ...payload.data, id: nextId(state[key], 'R') };
    const row = key === 'mile' ? normalizeOfficialRow(rawRow) : key === 'reminders' ? normalizeReminderRow(rawRow) : rawRow;
    state[key] = [row, ...(state[key] || [])];
    saveDemoState(state);
    return { ok: true, demo: true, data: row };
  }

  if (action === 'update') {
    const key = payload.entity === 'rafa' ? 'rafa' : payload.entity === 'reminder' ? 'reminders' : 'mile';
    let updatedRow = null;
    state[key] = (state[key] || []).map((item) => {
      if (item.id !== payload.id) return item;
      const updated = key === 'mile'
        ? { ...item, ...payload.data, id: payload.id, actualizadoEn: nowIso(), estado: 'Activo' }
        : key === 'reminders'
          ? { ...item, ...payload.data, id: payload.id, updatedAt: nowIso() }
          : { ...item, ...payload.data, id: payload.id };
      updatedRow = key === 'mile' ? normalizeOfficialRow(updated) : key === 'reminders' ? normalizeReminderRow(updated) : updated;
      return updatedRow;
    });
    saveDemoState(state);
    return { ok: true, demo: true, data: updatedRow };
  }

  if (action === 'delete') {
    const key = payload.entity === 'rafa' ? 'rafa' : payload.entity === 'reminder' ? 'reminders' : 'mile';
    if (key === 'mile') {
      const now = nowIso();
      state[key] = state[key].map((item) => item.id === payload.id
        ? { ...item, estado: 'Eliminado', actualizadoEn: now }
        : item
      );
      saveDemoState(state);
      return { ok: true, demo: true, data: { id: payload.id, estado: 'Eliminado', actualizadoEn: now } };
    }
    if (key === 'reminders') {
      const now = nowIso();
      state[key] = (state[key] || []).map((item) => item.id === payload.id
        ? { ...item, status: 'deleted', updatedAt: now }
        : item
      );
      saveDemoState(state);
      return { ok: true, demo: true, data: { id: payload.id, status: 'deleted', updatedAt: now } };
    }

    state[key] = state[key].filter((item) => item.id !== payload.id);
    saveDemoState(state);
    return { ok: true, demo: true, data: { id: payload.id } };
  }

  return { ok: false, message: 'Acción no soportada en modo demo.' };
}

async function proxyRequest(action, payload = {}) {
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
    cache: 'no-store'
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('El puente interno de Vercel no está disponible todavía.');
  }

  const data = await response.json();
  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || 'No se pudo procesar la solicitud desde Vercel.');
  }
  ensureBackendIsSafe(data, action);

  return data;
}

function jsonpRequest(action, payload = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = `cg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const url = new URL(APPS_SCRIPT_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('token', APP_TOKEN);
    url.searchParams.set('payload', JSON.stringify(payload));
    url.searchParams.set('callback', callbackName);
    url.searchParams.set('_', String(Date.now()));
    const script = document.createElement('script');
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('La solicitud a Google Sheets tardó demasiado en este dispositivo. Revisa la conexión del celular o abre nuevamente la app.'));
    }, DIRECT_TIMEOUT_MS);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (response) => {
      cleanup();
      if (!response?.ok) {
        reject(new Error(response?.message || 'No se pudo procesar la solicitud.'));
        return;
      }
      try {
        ensureBackendIsSafe(response, action);
        resolve(response);
      } catch (error) {
        reject(error);
      }
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('No se pudo cargar Google Apps Script directamente desde este dispositivo. La app intentó usar el puente de Vercel y el acceso directo, pero ambos fallaron.'));
    };

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

export async function sheetsRequest(action, payload = {}) {
  const useDemo = !APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('PEGA_AQUI') || !APP_TOKEN;
  if (useDemo) return localRequest(action, payload);

  let proxyError = null;
  try {
    const response = await proxyRequest(action, payload);
    if (action === 'bootstrap' && response?.data) {
      saveRemoteSnapshot(response.data);
    }
    return response;
  } catch (error) {
    proxyError = error;
  }

  try {
    const response = await jsonpRequest(action, payload);
    if (action === 'bootstrap' && response?.data) {
      saveRemoteSnapshot(response.data);
    }
    return response;
  } catch (directError) {
    throw new Error(directError.message || proxyError?.message || 'No se pudo conectar con Google Apps Script.');
  }
}


export async function runConnectionDiagnostic() {
  const base = getClientDiagnosticBase();
  const lastGood = getLastGoodDiagnostic();
  if (!hasRemoteConfig()) {
    return {
      ok: false,
      message: 'La app no tiene configuradas VITE_APPS_SCRIPT_URL y VITE_APP_TOKEN.',
      diagnostic: { frontend: base, lastGood }
    };
  }

  try {
    const response = await proxyRequest('diagnostic', {});
    const enriched = {
      ...response,
      diagnostic: {
        ...(response.diagnostic || {}),
        frontend: base,
        lastGood
      }
    };
    if (isGoodDiagnostic(enriched)) saveLastGoodDiagnostic(enriched);
    return enriched;
  } catch (proxyError) {
    try {
      const response = await jsonpRequest('diagnostic', {});
      const enriched = {
        ...response,
        diagnostic: {
          ...(response.diagnostic || {}),
          frontend: base,
          proxyError: proxyError.message || '',
          lastGood
        }
      };
      if (isGoodDiagnostic(enriched)) saveLastGoodDiagnostic(enriched);
      return enriched;
    } catch (directError) {
      return {
        ok: false,
        message: directError.message || proxyError.message || 'No se pudo ejecutar el diagnóstico.',
        diagnostic: {
          frontend: base,
          proxyError: proxyError.message || '',
          directError: directError.message || '',
          lastGood
        }
      };
    }
  }
}
