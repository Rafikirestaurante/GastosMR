# Fase 4C · Edición de movimientos mediante ventanas modales

Base: `1.7.1_control-gastos-milena-fase-4b-vistas-moviles.zip`.

Cambios:

1. En Inicio, la edición de movimientos dejó de reutilizar el formulario de nuevo registro dentro de la página y ahora se abre en una ventana modal.
2. El formulario de nuevo movimiento de Inicio permanece integrado en la página y se usa exclusivamente para crear registros.
3. Rafa ahora permite editar registros desde la vista Tabla y desde la vista Tarjetas.
4. La edición de Rafa se realiza en una ventana modal con Fecha, Concepto, Monto y Categoría.
5. Los cambios de Inicio y Rafa se aplican localmente de inmediato y se agregan a la cola de sincronización con Google Sheets.
6. Los modales se adaptan a computador y celular, bloquean el desplazamiento del fondo y pueden cerrarse mediante el botón ×, Cancelar, clic en el fondo o tecla Escape.
7. Apps Script ya soportaba la operación update para Rafa, por lo que no fue necesario modificar el backend ni la estructura de Google Sheets.
