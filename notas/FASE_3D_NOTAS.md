# Fase 3D — Diagnóstico de conexión y anti-versión vieja

Base tomada: `1.6.2_control-gastos-milena-fase-3c-recordatorios-sheets.zip`.

## Objetivo

Corregir el problema recurrente donde Vercel o Apps Script parecen seguir usando una versión antigua del backend, especialmente cuando aparece un `SPREADSHEET_ID` viejo aunque el código actual ya tenga el ID correcto.

## Cambios realizados

- La app pasa visualmente a **Fase 3D**.
- Se agregó botón pequeño **Diagnóstico** junto a los chips de conexión.
- El diagnóstico muestra:
  - Versión esperada del frontend.
  - Versión respondida por Apps Script.
  - URL de Apps Script configurada en Vercel, enmascarada.
  - ID de Google Sheet configurado en Apps Script.
  - Si Google Sheets abrió correctamente.
  - Nombre real del archivo de Google Sheets.
  - Si existen las hojas `Tabla Oficial`, `Recordatorios`, `Configuracion` y `Gastos Rafa`.
- Apps Script ahora define:
  - `PROJECT_NAME = 'Control Gastos Milena'`
  - `BACKEND_VERSION = '1.6.3-fase-3d-diagnostico-conexion'`
- Nueva acción de Apps Script: `diagnostic`.
- La acción `health` también reporta versión, proyecto e ID configurado.
- El puente interno de Vercel `/api/sheets` añade diagnóstico propio de variables configuradas, URL enmascarada y versión esperada.
- Si la versión del backend no coincide con la esperada, la app muestra advertencia de posible versión vieja.

## Instrucción clave

Después de copiar el nuevo `apps-script/Code.gs`, hay que hacer en Apps Script:

1. Guardar.
2. Implementar.
3. Administrar implementaciones.
4. Editar con el lápiz la app web actual.
5. Seleccionar **Nueva versión**.
6. Implementar.
7. Copiar la URL `/exec` y pegarla en Vercel en `VITE_APPS_SCRIPT_URL`.
8. Hacer Redeploy en Vercel.

## Validación esperada

Desde la app publicada, tocar **Diagnóstico**. Debe mostrar:

- Frontend esperado: `1.6.3-fase-3d-diagnostico-conexion`
- Backend respondido: `1.6.3-fase-3d-diagnostico-conexion`
- Google Sheet conectado: Sí
- ID configurado: el ID real de la hoja de Milena.
