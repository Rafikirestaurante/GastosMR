# Fase 2E — Migración a Tabla Oficial

## Objetivo

Se migró la base principal de la aplicación desde la hoja anterior **Gastos Mile** hacia la nueva hoja **Tabla Oficial** de Google Sheets.

## Nueva tabla principal

La app ahora lee y escribe la información principal en la hoja:

```txt
Tabla Oficial
```

Columnas esperadas:

```txt
Gastos Fecha | Proveedor | Concepto | Ingreso | Egreso | Categoría | Subcategoría
```

## Cambios principales

- **Gastos Mile queda desactivada** para el flujo principal de la app.
- La entidad interna `mile` se mantiene en el código para no reescribir toda la app, pero ahora apunta a **Tabla Oficial**.
- Se eliminó la dependencia de una columna única de `Monto` en la tabla principal.
- Se eliminó la dependencia de una columna de `Tipo de Movimiento` dentro de la tabla principal.
- La app sigue mostrando un selector de **Ingreso / Egreso** para facilitar el registro, pero al guardar escribe el valor en la columna correspondiente:
  - Si el movimiento es Ingreso, llena `Ingreso` y deja `Egreso` en 0.
  - Si el movimiento es Egreso, llena `Egreso` y deja `Ingreso` en 0.
- Los saldos se calculan como:

```txt
Ingreso - Egreso
```

## Campos obligatorios

Para la **Tabla Oficial**, ahora son obligatorios:

- Fecha
- Proveedor
- Concepto
- Tipo de movimiento
- Monto

Los campos **Categoría** y **Subcategoría** quedan opcionales.

## Dashboard e historial

- El dashboard calcula ingresos desde la columna `Ingreso`.
- El dashboard calcula egresos desde la columna `Egreso`.
- El saldo mensual y acumulado se calcula con `Ingreso - Egreso`.
- El historial de la tabla principal ahora muestra columnas separadas de **Ingreso** y **Egreso**.
- En móvil, las tarjetas también muestran Ingreso y Egreso por separado.

## Apps Script

Se actualizó `apps-script/Code.gs` para trabajar con la hoja **Tabla Oficial**.

Como la Tabla Oficial no tiene columna de ID visible, Apps Script genera un ID interno temporal basado en la fila de Google Sheets, por ejemplo:

```txt
TO2, TO3, TO4
```

Ese ID se usa para editar y borrar desde la app, sin agregar una columna nueva a la hoja.

## Importante para actualizar

Después de subir esta versión, se debe copiar nuevamente el contenido de:

```txt
apps-script/Code.gs
```

en Google Apps Script, guardar y volver a desplegar la Web App si Google lo solicita.
