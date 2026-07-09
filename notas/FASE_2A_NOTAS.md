# Fase 2A — Corrección base móvil y conexión

Esta actualización se realizó antes de agregar nuevas funciones de Fase 2 porque la última optimización móvil empeoró la experiencia visual y generaba mensajes contradictorios de conexión.

## Cambios aplicados

1. Se corrigió el componente de estado de conexión.
   - Antes podía aparecer “Conectado a Google Sheets mediante Apps Script” junto con “No se pudo conectar con Google Apps Script”.
   - Ahora solo se muestra un estado a la vez: verificando conexión, conectado correctamente, modo demo/local o error de conexión.

2. Se ajustó la experiencia móvil.
   - Se eliminó la navegación superior pesada en celular.
   - Se implementó una barra inferior fija con accesos cortos: Inicio, Nuevo, Historial, Rafa y Config.
   - Se dejó el encabezado superior más limpio y menos invasivo.
   - Se mantuvieron las tarjetas móviles para historial y gastos Rafa.

3. Se conservaron intactas la lógica principal, la estructura de Google Sheets y el Apps Script.

## Validación

El proyecto compila correctamente con `npm run build`.

## Archivos principales modificados

- `src/App.jsx`
- `src/styles.css`
- `README.md`
- `package.json`
