# Fase 4D — Hojas dinámicas

Base: `1.7.2_control-gastos-milena-fase-4c-edicion-modal.zip`.

## Cambios principales

- La antigua sección Inicio / Tabla principal pasa a llamarse **Mile**.
- `Mile` conserva la conexión con la pestaña física `Tabla Oficial`.
- Se crea automáticamente la hoja técnica `Hojas App`.
- Config incorpora administración de hojas de movimientos.
- Se pueden crear hojas nuevas sin modificar React ni Apps Script nuevamente.
- Las hojas dinámicas utilizan una estructura común de movimientos.
- El menú de computador y celular se construye según la configuración.
- Todas las hojas tienen nuevo registro, filtros, saldo acumulado, edición modal, borrado y sincronización local-first.
- Tabla/Tarjetas se mantiene únicamente en celular; computador fuerza tabla.
- Dashboard incorpora selector de hoja o consolidado de todas las hojas.
- Se permite ocultar, ordenar y archivar hojas dinámicas sin borrar sus datos.
- Mile y Rafa se registran automáticamente como hojas existentes dentro de `Hojas App`.

## Versiones

- Frontend: `1.7.3-fase-4d-hojas-dinamicas`
- Backend: `1.7.3-fase-4d-hojas-dinamicas`

## Implementación

Esta fase requiere reemplazar `Code.gs`, crear una nueva implementación de Apps Script y actualizar la URL `/exec` en Vercel.
