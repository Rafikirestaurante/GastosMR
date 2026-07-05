# Resumen Fase 1A — Control Gastos Milena

En la Fase 1A se creó la primera versión funcional de la aplicación Control Gastos Milena, tomando como base la estructura del archivo Gastos Mile-Rafa y manteniendo Google Sheets como base de datos principal.

La aplicación fue construida en JavaScript con React + Vite, preparada para subir el código a GitHub y publicarlo en Vercel. No se incluyeron carpetas pesadas como node_modules ni dist, ni archivo package-lock.json.

Se definió que la pestaña principal de operación será Gastos Mile, donde se registran los movimientos de Milena con los campos: ID_Transaccion, Fecha, Proveedor, Concepto, Tipo de Movimiento, Monto, Categoria y Subcategoria. Todos estos campos son obligatorios en la app, excepto el ID, que se genera automáticamente desde Google Apps Script.

También se incluyó el módulo secundario Gastos Rafa, pensado para registrar gastos ocasionales de Rafa sin mezclarlo con la operación principal de Milena. Este módulo permite registrar fecha, concepto, monto y categoría, además de consultar y borrar registros.

La pestaña Configuracion se usa para alimentar los desplegables de la aplicación: categorías, tipos de movimiento y subcategorías. En esta fase, dichas listas se administran directamente desde Google Sheets.

La app incluye las siguientes secciones: Dashboard, Nuevo Milena, Historial Milena, Gastos Rafa y Configuración. El Dashboard muestra ingresos del mes, egresos del mes, saldo del mes, saldo acumulado y total de gastos de Rafa. El historial permite filtrar por texto, tipo de movimiento, categoría y rango de fechas.

La conexión con Google Sheets se preparó mediante Google Apps Script, que funciona como puente para leer, crear, editar y borrar registros. Se agregó un archivo Code.gs listo para pegar en Apps Script, junto con instrucciones para configurar el ID de la hoja, el token de acceso y la URL de despliegue.

La aplicación también tiene modo demo/local, útil para probar el diseño antes de conectar la hoja real.
