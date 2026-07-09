# Fase 2J - Verificación y optimización de velocidad

En esta fase se realizó una verificación técnica de la lentitud percibida al abrir y usar la app.

## Hallazgos principales

1. La app esperaba la respuesta completa de Google Sheets antes de mostrar la información, por eso en celular podía sentirse lenta cuando Apps Script tardaba en responder.
2. Después de guardar, editar o borrar, la app volvía a cargar toda la base de datos antes de dejar continuar, generando una segunda espera innecesaria.
3. Apps Script estaba leyendo valores y valores visibles de la hoja completa, duplicando lecturas sobre Google Sheets.
4. La lectura de la hoja principal podía tomar columnas adicionales no usadas si existían columnas sobrantes en la hoja.
5. Los tiempos de espera de conexión eran largos, lo que hacía que los errores o conexiones lentas se sintieran como bloqueo.

## Cambios realizados

- La app ahora puede mostrar primero la última copia local guardada en el dispositivo mientras actualiza Google Sheets.
- Se mantiene el mensaje de conexión indicando que se está mostrando una copia local mientras se actualiza.
- Se normalizan los movimientos al cargar para evitar recalcular montos y fechas tantas veces en pantalla.
- Después de crear, editar o borrar, la app actualiza visualmente la información sin esperar una recarga completa de toda la base.
- La recarga completa se hace de forma silenciosa para sincronizar con Google Sheets sin bloquear el uso.
- En Apps Script se redujeron lecturas duplicadas: ya no se lee `getDisplayValues()` para todas las filas principales si no es necesario.
- Apps Script ahora lee solo hasta las columnas reales que usa la Tabla Oficial.
- Se redujo el tiempo máximo de espera de conexión de 25 segundos a 15 segundos tanto en el puente Vercel como en el acceso directo.

## Archivos modificados

- `src/App.jsx`
- `src/api/sheetsApi.js`
- `api/sheets.js`
- `apps-script/Code.gs`
- `package.json`

## Importante

En esta fase sí se modificó `apps-script/Code.gs`, por lo que se debe copiar nuevamente el código en Google Apps Script y crear una nueva versión de la implementación.
