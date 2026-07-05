import { todayISO } from '../utils/format.js';
const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';
const APP_TOKEN = import.meta.env.VITE_APP_TOKEN || '';
const DEMO_KEY = 'control-gastos-milena-demo-v1';
const REMOTE_CACHE_KEY = 'control-gastos-milena-last-good-v1';
const PROXY_URL = '/api/sheets';

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
    {
      id: 'T001',
      fecha: todayISO().slice(0, 8) + '01',
      proveedor: 'Sistema',
      concepto: 'Saldo Inicial',
      tipoMovimiento: 'Ingreso',
      monto: 3474387,
      categoria: 'Ahorro',
      subcategoria: 'Inicio'
    },
    {
      id: 'T002',
      fecha: todayISO(),
      proveedor: 'Supermercado',
      concepto: 'Compra de mercado',
      tipoMovimiento: 'Egreso',
      monto: 85000,
      categoria: 'Alimentacion',
      subcategoria: 'Personal'
    }
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
    return JSON.parse(raw);
  } catch {
    return structuredClone(sampleState);
  }
}

function saveDemoState(state) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(state));
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
    return { ok: true, demo: true, data: state };
  }

  if (action === 'create') {
    const key = payload.entity === 'rafa' ? 'rafa' : 'mile';
    const prefix = key === 'rafa' ? 'R' : 'T';
    const row = { ...payload.data, id: nextId(state[key], prefix) };
    state[key] = [row, ...state[key]];
    saveDemoState(state);
    return { ok: true, demo: true, data: row };
  }

  if (action === 'update') {
    const key = payload.entity === 'rafa' ? 'rafa' : 'mile';
    state[key] = state[key].map((item) =>
      item.id === payload.id ? { ...item, ...payload.data, id: payload.id } : item
    );
    saveDemoState(state);
    return { ok: true, demo: true };
  }

  if (action === 'delete') {
    const key = payload.entity === 'rafa' ? 'rafa' : 'mile';
    state[key] = state[key].filter((item) => item.id !== payload.id);
    saveDemoState(state);
    return { ok: true, demo: true };
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
    }, 25000);

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

