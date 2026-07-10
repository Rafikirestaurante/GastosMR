# Fase 3E - Blindaje de conexión y control de versiones

Esta fase toma como base la versión estable `1.6.3_control-gastos-milena-fase-3d-diagnostico-conexion.zip` y agrega una capa preventiva para evitar que la app vuelva a trabajar contra una implementación vieja de Google Apps Script o una URL incorrecta configurada en Vercel.

## Objetivo

Evitar que se repita el problema donde el código de Apps Script estaba correcto, pero Vercel seguía apuntando a una URL o versión antigua. La app ahora valida la conexión antes de sincronizar y bloquea la subida de cambios si detecta una inconsistencia.

## Cambios principales

- Nueva versión frontend/backend esperada: `1.6.4-fase-3e-blindaje-conexion`.
- Apps Script agrega metadatos obligatorios en todas las respuestas: `projectName`, `backendVersion`, `scriptTimeZone` y `generatedAt`.
- El frontend exige que el backend responda exactamente con la versión esperada antes de permitir sincronización.
- El puente interno `/api/sheets` de Vercel también bloquea respuestas de Apps Script sin versión o con versión diferente.
- La app ejecuta un diagnóstico silencioso al iniciar.
- Si el diagnóstico falla, muestra un chip **Revisar conexión** y un aviso **Blindaje de conexión activo**.
- La sincronización de gastos y recordatorios queda bloqueada si el backend es viejo, no reporta versión, no puede abrir el Google Sheet o no encuentra las hojas clave.
- El botón **Diagnóstico** sigue disponible para revisar detalles completos.
- Se guarda localmente el último diagnóstico correcto para comparar cuándo fue la última conexión confiable.

## Validaciones del blindaje

La app considera segura la conexión solo si se cumple todo esto:

- `projectName = Control Gastos Milena`.
- `backendVersion = 1.6.4-fase-3e-blindaje-conexion`.
- Google Sheet conectado correctamente.
- Hoja `Tabla Oficial` encontrada.
- Hoja `Recordatorios` encontrada.

## Qué hacer al instalar esta fase

1. Copiar el nuevo `apps-script/Code.gs` completo en Apps Script.
2. Configurar:

```js
const SPREADSHEET_ID = 'ID_REAL_DE_TU_GOOGLE_SHEET';
const APP_TOKEN = 'rafa1234';
```

3. Guardar.
4. Crear una **Nueva implementación** o una **Nueva versión** de la app web.
5. Copiar la URL `/exec` nueva o actualizada.
6. Pegarla en Vercel como `VITE_APPS_SCRIPT_URL`.
7. Confirmar `VITE_APP_TOKEN = rafa1234`.
8. Hacer **Redeploy** en Vercel.
9. Abrir la app y confirmar que aparezca el chip **Blindaje OK**.

## Resultado esperado

Si todo está bien, el diagnóstico mostrará:

- Frontend esperado: `1.6.4-fase-3e-blindaje-conexion`.
- Backend respondido: `1.6.4-fase-3e-blindaje-conexion`.
- Google Sheet conectado: Sí.
- Tabla Oficial: Existe.
- Recordatorios: Existe.

Si algo está mal, la app no intentará sincronizar hasta corregir la conexión.
