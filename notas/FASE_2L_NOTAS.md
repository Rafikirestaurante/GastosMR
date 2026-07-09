# Fase 2L - Guardado local rápido y sincronización en segundo plano

Esta fase responde a la lentitud percibida especialmente al guardar movimientos desde celular.

## Cambios principales

- Se implementó una lógica **local-first**: crear, editar y borrar se reflejan inmediatamente en la app.
- Las acciones quedan guardadas en una **cola local de sincronización** en el navegador.
- Después de un corto tiempo, la app sincroniza los cambios con Google Sheets en segundo plano.
- Se agregó botón **Sincronizar ahora** cuando existen cambios pendientes.
- Se muestran estados visibles por registro:
  - OK
  - Pendiente
  - Sincronizando
  - Error
- Si Google Sheets, Apps Script, Vercel o la conexión móvil fallan, el cambio no se pierde; queda pendiente para reintentar.
- La sincronización se reintenta al abrir la app y cuando el dispositivo vuelve a tener internet.
- Se mantiene la seguridad de Fase 2K: ID real, LockService, Actualizado_en y eliminación lógica en Tabla Oficial.

## Archivos nuevos o modificados

- `src/App.jsx`
- `src/api/syncQueue.js`
- `src/api/sheetsApi.js`
- `src/styles.css`
- `api/sheets.js`
- `apps-script/Code.gs`
- `package.json`
- `README.md`

## Organización de notas

Los archivos `.md` de notas de fases se movieron a la carpeta `notas/` para mantener limpia la raíz del proyecto. La carpeta queda por debajo del límite solicitado de 20 archivos.

## Observación importante

Google Sheets sigue siendo la base oficial. La app muestra el cambio de inmediato, pero mientras aparezca como **Pendiente**, todavía no se ha confirmado en Google Sheets.
