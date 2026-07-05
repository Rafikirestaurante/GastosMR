# Fase 2C - Corrección real de caché móvil y PWA anterior

Esta actualización corrige el problema en el que el celular, en ventana normal, podía seguir cargando una versión vieja de la aplicación aunque en incógnito funcionara correctamente.

## Cambios principales

1. Se agregó control de versión interno: `Fase 2C · control-cache-20260705`.
2. Al detectar una nueva versión, la app limpia cachés antiguos del navegador y desregistra service workers viejos.
3. Se agregó botón visible: **Reparar app en este dispositivo**, para forzar limpieza de caché/PWA y recargar la versión publicada.
4. Se agregó `vercel.json` con encabezados `Cache-Control` para evitar que `index.html`, `/` y service workers queden pegados en caché.
5. Se agregaron `/sw.js` y `/service-worker.js` como service workers limpiadores. Su objetivo es reemplazar/desactivar cualquier service worker viejo que hubiera quedado instalado.
6. Las solicitudes a Apps Script ahora incluyen la versión de la app como parámetro informativo y mantienen anticaché por timestamp.

## Importante para despliegue

Después de subir esta versión a GitHub/Vercel, se debe confirmar que Vercel tome el archivo `vercel.json`. Esto hace que las próximas actualizaciones no dependan de borrar caché manualmente en el celular.

## ZIP base

Esta versión debe usarse como nueva base de la Fase 2 antes de agregar reportes o mejoras visuales adicionales.
