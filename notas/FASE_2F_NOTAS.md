# Fase 2F - Corrección Dashboard Tabla Oficial

Se corrigió el dashboard después de la migración a **Tabla Oficial**.

## Problema detectado

La Fase 2E ya apuntaba a la hoja **Tabla Oficial**, pero el dashboard podía mostrar ingresos, egresos, saldo mensual y saldo acumulado en cero cuando Google Sheets devolvía valores formateados como moneda o texto, por ejemplo:

- `$ 1.200.000`
- `1.200.000`
- `1,200,000`
- valores pegados manualmente como texto

Esto ocurría porque la app y Apps Script intentaban convertir valores usando `Number(...)`, lo cual falla con formatos de moneda colombiana.

## Ajustes realizados

- Se agregó lectura robusta de montos en frontend y Apps Script.
- El dashboard ahora suma usando `Ingreso - Egreso`.
- Se reforzó `getIngreso`, `getEgreso`, `sumBy` y `money`.
- Apps Script ahora usa `getValues()` y `getDisplayValues()` para poder interpretar tanto números reales como valores visibles en formato moneda.
- La lectura de fechas ahora soporta `YYYY-MM-DD` y `DD/MM/YYYY`.
- La hoja principal sigue siendo **Tabla Oficial**.
- **Gastos Mile** continúa desactivada.
- Categoría y Subcategoría continúan opcionales.

## Archivos modificados

- `src/utils/format.js`
- `src/api/sheetsApi.js`
- `src/App.jsx`
- `apps-script/Code.gs`
- `README.md`
- `package.json`

## Recomendación importante

Después de subir este ZIP a GitHub/Vercel, también se debe copiar el nuevo contenido de `apps-script/Code.gs` en Google Apps Script y volver a desplegar la Web App para que Google Sheets entregue los datos corregidos.
