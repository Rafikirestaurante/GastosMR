# Fase 2K - Sincronización segura

En esta fase se reforzó la aplicación para reducir riesgos de desincronización cuando más de una persona usa la app al mismo tiempo.

## Cambios principales

1. La hoja principal sigue siendo **Tabla Oficial**.
2. Las columnas visibles de trabajo siguen siendo:

   ```txt
   Gastos Fecha | Proveedor | Concepto | Ingreso | Egreso | Categoría | Subcategoría
   ```

3. Apps Script agrega automáticamente al final de **Tabla Oficial** estas columnas técnicas:

   ```txt
   ID_Transaccion | Creado_en | Actualizado_en | Estado
   ```

4. Las columnas técnicas se intentan ocultar automáticamente en Google Sheets.
5. Los registros existentes reciben un `ID_Transaccion` real la primera vez que se cargan con el nuevo Apps Script.
6. Crear, editar y borrar ahora usan `LockService` para evitar choques simultáneos.
7. La edición y eliminación de movimientos de Tabla Oficial ya no dependen del número de fila.
8. La eliminación de movimientos de Tabla Oficial es lógica: el registro queda con `Estado = Eliminado` y la app deja de mostrarlo.
9. Se agregó control básico de concurrencia con `Actualizado_en`: si otro dispositivo modificó el movimiento antes, la app pide actualizar datos antes de continuar.
10. Se mantiene la optimización de velocidad de Fase 2J: copia local inmediata y sincronización silenciosa.

## Importante para implementar

Después de subir el ZIP a GitHub y redeplegar Vercel, también se debe reemplazar el código de Google Apps Script con el nuevo archivo:

```txt
apps-script/Code.gs
```

Luego se debe actualizar la implementación actual de Apps Script seleccionando **Nueva versión**.

No es necesario crear manualmente las columnas técnicas si se copia y despliega correctamente el nuevo `Code.gs`, porque el script las agrega automáticamente al cargar datos.
