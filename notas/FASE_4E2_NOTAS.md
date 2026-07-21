# Fase 4E.2 — Corrección de pantalla blanca

Versión: 1.7.6

## Problema corregido

La versión 1.7.5 compilaba correctamente, pero al ejecutarse en el navegador podía mostrar una pantalla en blanco con el error `React is not defined`. El cambio a versiones fijas de Vite y `@vitejs/plugin-react` hizo que parte del JSX de `App.jsx` utilizara el runtime clásico, mientras el archivo solo importaba hooks de React.

## Cambios

- `App.jsx` ahora importa explícitamente `React`.
- Se agregó un límite de errores en `main.jsx` para mostrar una pantalla de recuperación y el mensaje técnico en lugar de dejar la app completamente blanca.
- Se conservan las dependencias exactas y estables de la versión anterior.
- No se modifica Apps Script ni la estructura de Google Sheets.

## Validaciones

- Instalación limpia con `npm install --no-package-lock`.
- Cero vulnerabilidades reportadas por npm.
- Compilación de producción correcta.
- Ejecución del paquete compilado validada en un DOM de navegador simulado, confirmando que el menú, Dashboard, Mile, Rafa, Pendientes y Config se renderizan.
