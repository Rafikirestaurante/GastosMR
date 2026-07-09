const DEFAULT_TIMEOUT_MS = 15000;

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
  if (!appsScriptUrl || appsScriptUrl.includes('PEGA_AQUI') || !appToken) {
    return sendJson(res, 500, {
      ok: false,
      message: 'Faltan variables de entorno en Vercel: VITE_APPS_SCRIPT_URL y VITE_APP_TOKEN.'
    });
  }

  const body = readBody(req);
  const action = body.action || 'bootstrap';
  const payload = body.payload || {};
  const targetUrl = buildAppsScriptUrl(appsScriptUrl, appToken, action, payload);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json,text/plain,*/*',
        'User-Agent': 'Control-Gastos-Milena/3C'
      }
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return sendJson(res, 502, {
        ok: false,
        message: 'Apps Script respondió, pero no devolvió JSON válido. Revisa que la URL termine en /exec y que el despliegue sea Web App.'
      });
    }

    if (!response.ok) {
      return sendJson(res, 502, {
        ok: false,
        message: data?.message || 'Google Apps Script respondió con error.'
      });
    }

    return sendJson(res, 200, data);
  } catch (error) {
    const message = error?.name === 'AbortError'
      ? 'La conexión con Google Apps Script tardó demasiado desde Vercel.'
      : 'No se pudo conectar Vercel con Google Apps Script.';

    return sendJson(res, 502, {
      ok: false,
      message
    });
  } finally {
    clearTimeout(timeout);
  }
}
