# Control Gastos Milena — Fase 4C

Aplicación web personal para controlar movimientos de Milena con React + Vite, Vercel, Google Apps Script y Google Sheets.

## Versión

- Frontend: `1.7.2-fase-4c-edicion-modal`
- Backend Apps Script esperado: `1.6.5-fase-3f-configuracion-persistente`

La Fase 4C modifica el frontend y utiliza la operación de actualización de Rafa ya disponible en el backend estable de Fase 3F. No requiere cambios en Google Sheets ni una nueva implementación de Apps Script.

## Cambios de la Fase 4C

- En **Inicio**, el botón **Editar** abre una ventana modal cómoda y centrada.
- En **Rafa**, se agregaron botones **Editar** en la tabla y en las tarjetas.
- La edición de Rafa también se realiza mediante ventana modal.
- Las ventanas pueden cerrarse con el botón **×**, con **Cancelar edición**, tocando el fondo o presionando `Esc`.
- Al actualizar, el cambio se guarda primero en el dispositivo y luego se sincroniza con Google Sheets.
- En celular, la ventana se adapta a la pantalla y permite desplazamiento interno.

## Cambios acumulados desde la Fase 4A

### Navegación unificada

La navegación es la misma en computador y celular:

```txt
Dashboard | Inicio | Rafa | Pendientes | Config
```

En celular se utiliza un botón de tres líneas para abrir y cerrar el menú.

### Inicio

La antigua sección **Nuevo registro** y el historial **Tabla Oficial/Historial** quedaron integrados dentro de **Inicio**.

Incluye:

- Botón **+ Nuevo registro**.
- Formulario para crear y editar movimientos.
- Filtros por texto, tipo, categoría y rango de fechas.
- Selector entre vista **Tabla** y vista **Tarjetas**.
- Columna y dato de **Saldo acumulado** en ambas vistas.
- Acciones de editar y borrar.

### Pendientes

La nueva pestaña **Pendientes** concentra las tareas creadas por el asistente.

- Las tareas con fecha más próxima aparecen primero.
- Las tareas sin fecha aparecen al final.
- Se pueden editar texto, fecha, hora y recurrencia.
- Se pueden completar o borrar.
- Las tareas completadas quedan en un bloque separado.
- Los cambios mantienen el guardado local-first y la sincronización con Google Sheets.

### Chatbot simplificado

El asistente flotante quedó como una ventana de conversación limpia dedicada únicamente a crear recordatorios. Ya no muestra listados, contadores ni acciones de edición. Para administrar una tarea se utiliza la pestaña **Pendientes**.

## Hojas de Google Sheets

### Tabla Oficial

```txt
Gastos Fecha | Proveedor | Concepto | Ingreso | Egreso | Categoría | Subcategoría
```

Columnas técnicas administradas por Apps Script:

```txt
ID_Transaccion | Creado_en | Actualizado_en | Estado
```

### Gastos Rafa

```txt
ID_Transaccion | Fecha | Concepto | Monto | Categoría
```

### Configuracion

```txt
Categoria | Tipo de Movimiento | Subcategoria
```

### Recordatorios

```txt
ID_Recordatorio | Titulo | Detalle | Fecha | Hora | Recurrencia | Etiqueta_Recurrencia | Estado | Creado_en | Actualizado_en | Completado_en | Ultimo_Completado_en
```

## Configuración persistente de Apps Script

`apps-script/Code.gs` conserva la configuración estable de Fase 3F. El ID de Google Sheets y el token se leen primero desde **Propiedades del Script**.

Después de pegar el código en Apps Script, ejecutar una sola vez:

```txt
instalarConfiguracionFija
```

Para revisar la configuración guardada:

```txt
verConfiguracionGuardada
```

Para actualizarla manualmente:

```js
actualizarConfiguracionManual('ID_REAL_DEL_GOOGLE_SHEET', 'TOKEN_REAL')
```

Luego ejecutar:

```txt
probarHoja
```

No se recomienda volver a escribir `SPREADSHEET_ID` ni `APP_TOKEN` directamente en el código.

## Variables de entorno en Vercel

```env
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/TU_DEPLOYMENT_ID/exec
VITE_APP_TOKEN=TU_TOKEN
```

Opcionalmente, para el puente interno de Vercel:

```env
APPS_SCRIPT_URL=https://script.google.com/macros/s/TU_DEPLOYMENT_ID/exec
APP_TOKEN=TU_TOKEN
```

## Desarrollo local

```bash
npm install
npm run dev
```

## Publicación en Vercel

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

## Diagnóstico y blindaje

La aplicación mantiene el diagnóstico de conexión y el blindaje automático antes de sincronizar. Debe validar:

```txt
projectName = Control Gastos Milena
backendVersion = 1.6.5-fase-3f-configuracion-persistente
Google Sheet conectado = Sí
Tabla Oficial = Existe
Recordatorios = Existe
```

Si se muestra **Revisar conexión**, los cambios pueden permanecer guardados localmente, pero la sincronización se bloquea hasta corregir la implementación o las variables de entorno.


## Fase 4B · Ajustes de tablas responsive

- La tabla de Inicio ya no muestra la columna ID.
- Inicio y Rafa permiten alternar entre Tabla y Tarjetas únicamente en pantallas móviles.
- En computador ambas secciones siempre muestran tabla, aunque la vista móvil guardada sea Tarjetas.
- El selector de columnas del Dashboard se convirtió en un control compacto y desplegable.
