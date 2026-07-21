# Fase 3F - Configuración persistente y anti-error de implementación

Esta fase corrige el problema detectado después de Fase 3E: cada vez que se pegaba un nuevo `Code.gs`, el archivo volvía a traer valores genéricos para `SPREADSHEET_ID` y `APP_TOKEN`. Si no se editaban manualmente antes de implementar, Apps Script respondía pero no podía abrir el Google Sheet configurado.

## Cambio principal

Apps Script ahora lee primero la configuración desde **Propiedades del Script**:

- `SPREADSHEET_ID`
- `APP_TOKEN`

Esto permite que la configuración quede guardada dentro del proyecto de Apps Script y no se pierda cada vez que se pega una nueva versión del código.

## Funciones nuevas en Apps Script

- `instalarConfiguracionFija()`
  - Guarda el ID real del Google Sheet y el token actual en Propiedades del Script.
  - Se debe ejecutar una sola vez después de pegar el código.

- `verConfiguracionGuardada()`
  - Muestra el ID/token guardados y la fuente de configuración usada.

- `actualizarConfiguracionManual(spreadsheetId, appToken)`
  - Permite actualizar la configuración sin editar constantes internas.

## Valores del proyecto actual

- Google Sheet: `Base de Datos Gastos Mile-Rafa`
- `SPREADSHEET_ID`: `1f4UO_KTxaYuhUHAKk94CUrGX31lIbii-iwsunVf9C0o`
- Token actual: `rafa1234`
- Backend esperado: `1.6.5-fase-3f-configuracion-persistente`

## Flujo recomendado desde esta fase

1. Pegar el nuevo `apps-script/Code.gs`.
2. Ejecutar `instalarConfiguracionFija()` una sola vez.
3. Ejecutar `probarHoja()`.
4. Si abre correctamente la hoja, implementar nueva versión web.
5. Copiar la URL `/exec` a Vercel en `VITE_APPS_SCRIPT_URL`.
6. Hacer Redeploy en Vercel.
7. Abrir Diagnóstico en la app.

## Objetivo

Evitar que futuras implementaciones rompan la conexión por usar un `SPREADSHEET_ID` genérico, una URL vieja de Apps Script o un token incorrecto.
