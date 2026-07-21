# Fase 2I - Dashboard: fecha compacta y saldo mensual acumulado

## Cambios realizados

1. En la sección **Tabla Oficial por rango** del Dashboard se cambió la columna fija **Gastos Fecha** por **Fecha**.
2. La fecha ahora se muestra en formato corto `DD/MM/AA` para ganar espacio en celular y computador.
3. La columna **Fecha** quedó más angosta, manteniendo su comportamiento fijo en móvil para facilitar el desplazamiento horizontal.
4. La tarjeta **Saldo del mes** ya no calcula únicamente ingresos del mes menos egresos del mes.
5. Ahora **Saldo del mes** muestra el **saldo acumulado del último movimiento registrado dentro del mes seleccionado**.

## Lógica actual del saldo del mes

La app ordena todos los movimientos de la **Tabla Oficial** por fecha, calcula el saldo acumulado histórico con:

```txt
Ingreso - Egreso
```

y luego toma el saldo acumulado de la última fila perteneciente al mes seleccionado.

Ejemplo: si el último movimiento de julio deja el acumulado en $850.000, entonces el Dashboard muestra **Saldo del mes: $850.000**, aunque los ingresos menos egresos únicamente de julio den otro valor.

## Archivos modificados

- `src/App.jsx`
- `src/styles.css`
- `package.json`
