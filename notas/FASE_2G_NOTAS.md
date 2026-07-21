# Fase 2G - Dashboard con rango, saldo acumulado y columnas configurables

## Objetivo

Se agregó al Dashboard una vista operativa de la **Tabla Oficial** para consultar movimientos por rango de fechas, revisar saldos acumulados y personalizar las columnas visibles.

## Cambios principales

- Se incorporó el botón **Seleccionar rango de fechas** dentro del Dashboard.
- El rango inicia por defecto con el mes actual, pero puede cambiarse manualmente con campos **Desde** y **Hasta**.
- Se agregó el botón **Usar mes seleccionado** para sincronizar rápidamente la tabla con el mes elegido en el resumen mensual.
- Se agregó el botón **Ver todo** para quitar el filtro de fechas.
- Se creó una tabla principal dentro del Dashboard basada en **Tabla Oficial**.
- La tabla incluye la nueva columna **Saldo acumulado**.
- El saldo acumulado se calcula de forma histórica, sumando todos los ingresos menos egresos desde el primer registro hasta cada movimiento. Esto permite que el saldo mostrado en cada fila sea el saldo real después de ese movimiento, aunque el rango seleccionado empiece más adelante.
- Se agregaron tarjetas de resumen para el rango seleccionado:
  - Ingresos del rango.
  - Egresos del rango.
  - Saldo del rango.
- Se agregó panel **Mostrar columnas** para ocultar o mostrar:
  - Gastos Fecha.
  - Proveedor.
  - Concepto.
  - Ingreso.
  - Egreso.
  - Categoría.
  - Subcategoría.
  - Saldo acumulado.
- En celular, la tabla se muestra como tarjetas respetando las columnas seleccionadas.
- En PC, la tabla se muestra como tabla tradicional.
- Se reforzó la comparación de fechas usando una fecha normalizada para evitar errores con formatos como `YYYY-MM-DD` o `DD/MM/YYYY`.

## Archivos modificados

- `src/App.jsx`
- `src/styles.css`
- `src/utils/format.js`
- `README.md`

## Nota importante

Esta fase no cambia la estructura de Google Sheets ni requiere modificar columnas en Apps Script. Si ya está funcionando la conexión de la Fase 2F, solo es necesario subir este nuevo código a GitHub para que Vercel redespliegue la app.
