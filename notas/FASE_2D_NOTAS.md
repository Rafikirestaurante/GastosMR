# Fase 2D - Corrección de conexión móvil sin PWA

Esta versión corrige el diagnóstico anterior: la aplicación no depende de PWA ni tiene instalación offline.

## Cambios principales

1. Se eliminó el enfoque de service workers/PWA anterior.
2. Se retiraron los archivos `public/sw.js` y `public/service-worker.js`.
3. Se quitó el botón grande **Reparar app en este dispositivo**.
4. Se agregó un botón pequeño con ícono **↻** para recargar la app de forma discreta.
5. Se agregó un puente interno de Vercel en `api/sheets.js`.

## Corrección importante de conexión

Antes el celular intentaba leer Google Apps Script directamente desde el navegador. Aunque en PC funcionaba, algunos celulares o navegadores móviles pueden bloquear o fallar cargando `script.google.com` directamente.

Ahora la app intenta conectarse en este orden:

1. Primero usa `/api/sheets`, una función interna de Vercel del mismo dominio de la app.
2. Vercel consulta Google Apps Script desde el servidor.
3. Si el puente no está disponible, la app conserva el método directo JSONP como respaldo.

Con esto, el celular ya no depende de cargar directamente el script de Google desde el navegador.

## Variables de entorno

No se agregaron variables nuevas. La función interna puede usar las mismas variables existentes:

- `VITE_APPS_SCRIPT_URL`
- `VITE_APP_TOKEN`

Opcionalmente también acepta:

- `APPS_SCRIPT_URL`
- `APP_TOKEN`

## Validación

La app conserva la estructura React + Vite, Google Sheets y Google Apps Script. El cambio principal está en la forma de conexión para mejorar compatibilidad móvil.
