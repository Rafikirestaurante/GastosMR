# Fase 2H - Dashboard móvil en tabla cómoda

## Ajuste realizado

Se corrigió la visualización móvil de la sección **Tabla Oficial por rango** del Dashboard.

En la Fase 2G esta sección cambiaba a tarjetas en celulares, pero esa vista no resultó cómoda para revisar información financiera con varias columnas. En esta fase se eliminó esa presentación en tarjetas para el Dashboard y se dejó la misma información en formato de tabla también en móvil.

## Comportamiento nuevo

- En computador se mantiene la tabla normal.
- En celular también se muestra como tabla.
- La tabla tiene desplazamiento horizontal para revisar todas las columnas sin deformar la pantalla.
- Se agregó una ayuda visual: “Desliza la tabla hacia los lados para ver más columnas”.
- La primera columna queda fija en móvil para mejorar la lectura al deslizar horizontalmente.
- Se compactaron tamaños y espacios en móvil para que la tabla sea más cómoda.
- Se mantiene la función de ocultar y mostrar columnas.
- Se mantiene la columna **Saldo acumulado**.
- Se mantiene el filtro por rango de fechas.

## Archivos modificados

- `src/App.jsx`
- `src/styles.css`
- `package.json`

## Nota

No se realizaron cambios en Google Apps Script ni en la estructura de Google Sheets. Para aplicar esta fase basta con subir el nuevo código a GitHub y redeplegar en Vercel.
