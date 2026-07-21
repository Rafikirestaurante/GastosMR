const DEFAULT_TIMEOUT_MS = 15000;
const FRONTEND_VERSION = '1.7.6-fase-4e2-correccion-pantalla-blanca';
const EXPECTED_BACKEND_VERSION = '1.7.3-fase-4d-hojas-dinamicas';

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function getRuntimeConfig() {
  return {
    appsScriptUrl: process.env.APPS_SCRIPT_URL || process.env.VITE_APPS_SCRIPT_URL || '',
    appToken: process.env.APP_TOKEN || process.env.VITE_APP_TOKEN || ''
  };
}

function maskToken(token = '') {
  const text = String(token || '');
  if (!text) return '';
  if (text.length <= 4) return '***';
  return `${text.slice(0, 2)}***${text.slice(-2)}`;
}

function maskUrl(rawUrl = '') {
  try {
    const url = new URL(rawUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    const deploymentId = parts[2] || parts[1] || '';
    const maskedDeployment = deploymentId.length > 14 ? `${deploymentId.slice(0, 8)}...${deploymentId.slice(-6)}` : deploymentId;
    return `${url.origin}/macros/s/${maskedDeployment}/exec`;
  } catch {
    return rawUrl ? 'URL inválida configurada' : '';
  }
}

function buildAppsScriptUrl(appsScriptUrl, appToken, action, payload) {
  const url = new URL(appsScriptUrl);
  url.searchParams.set('action', action || 'bootstrap');
  url.searchParams.set('token', appToken);
  url.searchParams.set('payload', JSON.stringify(payload || {}));
  url.searchParams.set('_', String(Date.now()));
  return url;
}

function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.status(status).send(JSON.stringify(body));
}

function baseDiagnostic(appsScriptUrl, appToken) {
  return {
    frontendVersion: FRONTEND_VERSION,
    expectedBackendVersion: EXPECTED_BACKEND_VERSION,
    vercel: {
      ok: Boolean(appsScriptUrl && appToken),
      appsScriptUrlConfigured: Boolean(appsScriptUrl),
      appsScriptUrlPreview: maskUrl(appsScriptUrl),
      appTokenConfigured: Boolean(appToken),
      appTokenPreview: maskToken(appToken)
    }
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return sendJson(res, 200, { ok: true });
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, message: 'Método no permitido.' });
  }

  const { appsScriptUrl, appToken } = getRuntimeConfig();
  const body = readBody(req);
  const action = body.action || 'bootstrap';
  const payload = body.payload || {};
  const diagnosticBase = baseDiagnostic(appsScriptUrl, appToken);

  if (!appsScriptUrl || appsScriptUrl.includes('PEGA_AQUI') || !appToken) {
    return sendJson(res, 500, {
      ok: false,
      message: 'Faltan variables de entorno en Vercel: VITE_APPS_SCRIPT_URL y VITE_APP_TOKEN.',
      diagnostic: diagnosticBase
    });
  }

  let targetUrl;
  try {
    targetUrl = buildAppsScriptUrl(appsScriptUrl, appToken, action, payload);
  } catch {
    return sendJson(res, 500, {
      ok: false,
      message: 'La variable VITE_APPS_SCRIPT_URL no parece ser una URL válida de Apps Script.',
      diagnostic: diagnosticBase
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json,text/plain,*/*',
        'User-Agent': 'Control-Gastos-Milena/4D'
      }
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return sendJson(res, 502, {
        ok: false,
        message: 'Apps Script respondió, pero no devolvió JSON válido. Revisa que la URL termine en /exec y que el despliegue sea Web App.',
        diagnostic: diagnosticBase
      });
    }

    const backendVersion = data?.backendVersion || data?.data?.backendVersion || '';
    const isDiagnosticAction = action === 'diagnostic' || action === 'health';
    const versionMismatch = !backendVersion || backendVersion !== EXPECTED_BACKEND_VERSION;
    const enriched = {
      ...data,
      diagnostic: {
        ...diagnosticBase,
        backendVersion: backendVersion || 'No reportada por Apps Script',
        versionMismatch,
        appsScriptResponseOk: response.ok,
        appsScriptMessage: data?.message || '',
        syncAllowed: !versionMismatch && response.ok && Boolean(data?.ok)
      }
    };

    if (!response.ok) {
      return sendJson(res, 502, {
        ...enriched,
        ok: false,
        message: data?.message || 'Google Apps Script respondió con error.'
      });
    }

    if (!isDiagnosticAction && data?.ok && versionMismatch) {
      return sendJson(res, 409, {
        ...enriched,
        ok: false,
        message: backendVersion
          ? `Blindaje activo: Apps Script respondió con backend ${backendVersion}, pero la app espera ${EXPECTED_BACKEND_VERSION}. Actualiza la URL en Vercel o crea una nueva implementación en Apps Script.`
          : 'Blindaje activo: Apps Script no reporta versión. La app podría estar conectada a una implementación vieja; abre Diagnóstico antes de sincronizar.'
      });
    }

    return sendJson(res, 200, enriched);
  } catch (error) {
    const message = error?.name === 'AbortError'
      ? 'La conexión con Google Apps Script tardó demasiado desde Vercel.'
      : 'No se pudo conectar Vercel con Google Apps Script.';

    return sendJson(res, 502, {
      ok: false,
      message,
      diagnostic: diagnosticBase
    });
  } finally {
    clearTimeout(timeout);
  }
}
