# Fase 2A - Dashboard por rango y saldo acumulado

En esta fase se tomó como base la versión optimizada para móvil de la Fase 1A y se agregaron mejoras al Dashboard principal de Milena.

## Cambios realizados

- Se actualizó la versión visual de la app a **Fase 2A**.
- Se agregó en el Dashboard un botón llamado **Seleccionar rango de fechas**.
- Al presionar el botón se abre una sección nueva llamada **Tabla principal por rango**.
- La tabla permite filtrar la información principal de **Gastos Mile** por fecha inicial y fecha final.
- Se agregaron botones rápidos para:
  - Usar el mes seleccionado en el Dashboard.
  - Volver al mes actual.
  - Ver todos los movimientos sin rango.
- Se agregó la nueva columna **Saldo acumulado**.
- El saldo acumulado se calcula de forma real, respetando todos los movimientos anteriores de la hoja, no solamente los registros visibles del rango.
- Se agregaron tarjetas resumen del rango:
  - Ingresos del rango.
  - Egresos del rango.
  - Saldo del rango.
  - Último saldo visible.
- Se agregó control para **mostrar u ocultar columnas** de la tabla principal.
- Las columnas disponibles para activar/desactivar son:
  - ID.
  - Fecha.
  - Proveedor.
  - Concepto.
  - Tipo.
  - Monto.
  - Categoría.
  - Subcategoría.
  - Saldo acumulado.
- En computador se conserva una tabla amplia y clara.
- En celular la tabla por rango se muestra como tarjetas, manteniendo la optimización móvil.
- No se modificó Google Apps Script.
- No se cambió la estructura de Google Sheets.
- La conexión existente con Google Sheets se mantiene igual.

## Validación técnica

La app fue compilada correctamente con:

```bash
npm run build
```

El ZIP final se dejó limpio, sin:

- `node_modules/`
- `dist/`
- `package-lock.json`
