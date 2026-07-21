# Fase 2M - Mensajes discretos de conexión y sincronización

Esta fase ajusta la experiencia visual de los mensajes de estado agregados en la Fase 2L.

## Cambios realizados

- Los mensajes grandes de conexión y sincronización se reemplazaron por chips pequeños y discretos.
- `Conectado correctamente a Google Sheets.` ahora se muestra como `Conectado`.
- `Movimiento guardado en este dispositivo. Sincronizando con Google Sheets...` ahora se muestra como `Guardado local`.
- `Sincronizando 1 cambio(s) pendiente(s) con Google Sheets...` ahora se muestra como `1 sincronizando`.
- Los mensajes conservan el detalle completo en el atributo `title`, útil en PC al pasar el cursor.
- El aviso breve de guardado se oculta automáticamente después de unos segundos.
- Se compactó el área de estado en celular y PC para no quitar espacio al formulario, dashboard ni tabla.
- Se mantiene el botón `Sincronizar ahora` cuando existen cambios pendientes.

## Archivos modificados

- `src/App.jsx`
- `src/styles.css`
- `README.md`
- `notas/FASE_2M_NOTAS.md`

No se modificó la estructura de Google Sheets ni `apps-script/Code.gs`.
