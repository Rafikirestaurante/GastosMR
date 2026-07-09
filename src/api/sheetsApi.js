import { normalizeText, parseAmount, todayISO } from '../utils/format.js';

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';
const APP_TOKEN = import.meta.env.VITE_APP_TOKEN || '';
const DEMO_KEY = 'control-gastos-milena-demo-v2k-tabla-oficial';
const REMOTE_CACHE_KEY = 'control-gastos-milena-last-good-v2k-tabla-oficial';
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
      rafa: parsed.rafa || []
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
        mile: (state.mile || []).filter((row) => String(row.estado || 'Activo').toLowerCase() !== 'eliminado')
      }
    };
  }

  if (action === 'create') {
    const key = payload.entity === 'rafa' ? 'rafa' : 'mile';
    const now = nowIso();
    const rawRow = key === 'mile'
      ? { ...payload.data, id: newOfficialId(), creadoEn: now, actualizadoEn: now, estado: 'Activo' }
      : { ...payload.data, id: nextId(state[key], 'R') };
    const row = key === 'mile' ? normalizeOfficialRow(rawRow) : rawRow;
    state[key] = [row, ...state[key]];
    saveDemoState(state);
    return { ok: true, demo: true, data: row };
  }

  if (action === 'update') {
    const key = payload.entity === 'rafa' ? 'rafa' : 'mile';
    let updatedRow = null;
    state[key] = state[key].map((item) => {
      if (item.id !== payload.id) return item;
      const updated = key === 'mile'
        ? { ...item, ...payload.data, id: payload.id, actualizadoEn: nowIso(), estado: 'Activo' }
        : { ...item, ...payload.data, id: payload.id };
      updatedRow = key === 'mile' ? normalizeOfficialRow(updated) : updated;
      return updatedRow;
    });
    saveDemoState(state);
    return { ok: true, demo: true, data: updatedRow };
  }

  if (action === 'delete') {
    const key = payload.entity === 'rafa' ? 'rafa' : 'mile';
    if (key === 'mile') {
      const now = nowIso();
      state[key] = state[key].map((item) => item.id === payload.id
        ? { ...item, estado: 'Eliminado', actualizadoEn: now }
        : item
      );
      saveDemoState(state);
      return { ok: true, demo: true, data: { id: payload.id, estado: 'Eliminado', actualizadoEn: now } };
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
      resolve(response);
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
