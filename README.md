# Control Gastos Milena

Aplicación web sencilla para controlar los gastos de Milena usando **React + Vite + JavaScript**, desplegable en **Vercel** y conectada a **Google Sheets** mediante **Google Apps Script**.

## Versión

Fase 2A.

## Hojas esperadas en Google Sheets

- `Gastos Mile`: tabla principal.
- `Gastos Rafa`: módulo secundario.
- `Configuracion`: listas para categorías, tipos de movimiento y subcategorías.

## Funcionalidades principales

- Dashboard de Milena.
- Registro de nuevo movimiento obligatorio.
- Historial Milena con filtros.
- Edición y borrado de movimientos.
- Módulo secundario de Gastos Rafa.
- Configuración leída desde Google Sheets.
- Optimización para celular.
- Dashboard con selector de rango de fechas.
- Tabla principal por rango con columna **Saldo acumulado**.
- Posibilidad de mostrar y ocultar columnas de la tabla principal.

## Conexión con Google Sheets

1. Abrir la hoja en Google Sheets.
2. Ir a **Extensiones > Apps Script**.
3. Pegar el contenido de `apps-script/Code.gs`.
4. Cambiar el valor de `SPREADSHEET_ID` por el ID real de la hoja.
5. Cambiar `APP_TOKEN` por una clave propia.
6. Implementar como **Aplicación web**.
7. Usar la URL `/exec` generada por Apps Script.

## Variables de entorno

Crear un archivo `.env` tomando como base `.env.example`:

```env
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/TU_SCRIPT/exec
VITE_APP_TOKEN=tu-token
```

En Vercel se deben crear esas mismas variables en **Settings > Environment Variables**.

## Comandos

```bash
npm install
npm run dev
npm run build
```

## Importante

El ZIP final no incluye:

- `node_modules/`
- `dist/`
- `package-lock.json`
