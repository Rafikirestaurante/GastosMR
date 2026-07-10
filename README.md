# Control Gastos Milena — Fase 3F

Aplicación web sencilla para controlar los gastos de Milena usando React + Vite, Vercel y Google Sheets mediante Google Apps Script.

## Base principal

La hoja principal activa es:

```txt
Tabla Oficial
```

Columnas visibles esperadas:

```txt
Gastos Fecha | Proveedor | Concepto | Ingreso | Egreso | Categoría | Subcategoría
```

Columnas técnicas agregadas por Apps Script al final:

```txt
ID_Transaccion | Creado_en | Actualizado_en | Estado
```

Estas columnas técnicas permiten editar, borrar y sincronizar de forma más segura sin depender del número de fila.

## Fase 3C - Recordatorios sincronizados con Google Sheets

Esta fase conecta el asistente interno de recordatorios generales con Google Sheets, manteniendo el guardado local rápido como respaldo.

Incluye:

- Botón flotante tipo asistente/chatbot.
- Panel de conversación para crear recordatorios rápidos.
- Fechas colombianas: `DD-MM-AA`, `DD-MM`, `DD/MM/AA` y `DD/MM`.
- Cuando no se escribe el año, se asume automáticamente el año actual.
- Fechas naturales: `hoy`, `mañana`, `pasado mañana`, `el próximo lunes`, `en 8 días`, `el 15 de julio`, `fin de mes`, `fin de semana`, `quincena`.
- Momentos del día: `en la mañana`, `en la tarde`, `en la noche`, `al mediodía` y horas como `a las 3 pm`.
- Repeticiones básicas: `cada día`, `cada semana`, `cada mes` y `cada año`.
- Lista de recordatorios pendientes y completados recientes.
- Opción para marcar como completado o eliminar.
- Guardado local inmediato en el dispositivo.
- Sincronización en segundo plano con Google Sheets usando la misma cola local de gastos.
- Si un recordatorio recurrente se completa, se reprograma automáticamente para la siguiente fecha.

Ejemplos de uso:

```txt
Recordar pagar arriendo mañana en la tarde
Recordar llamar al proveedor 15/07/26
Recordar revisar pagos el próximo lunes
Recordar pagar internet cada mes
Recordar enviar soporte el 15 de julio
Recordar comprar mercado en 8 días
```

## Hoja nueva: Recordatorios

Apps Script crea automáticamente la hoja si no existe:

```txt
Recordatorios
```

Columnas esperadas:

```txt
ID_Recordatorio | Titulo | Detalle | Fecha | Hora | Recurrencia | Etiqueta_Recurrencia | Estado | Creado_en | Actualizado_en | Completado_en | Ultimo_Completado_en
```

Estados usados:

```txt
Pendiente | Completado | Eliminado
```

## Fase 2M - Guardado rápido local

La app guarda visualmente de inmediato en el dispositivo y sincroniza después con Google Sheets.

Flujo:

```txt
Guardar / editar / borrar → se refleja en pantalla → queda Pendiente → se sincroniza en segundo plano → queda OK
```

Si falla la conexión, el cambio queda pendiente y se puede reintentar con el botón **Sincronizar ahora**.

## Estructura de hojas

### Tabla Oficial

| Gastos Fecha | Proveedor | Concepto | Ingreso | Egreso | Categoría | Subcategoría |
|---|---|---|---:|---:|---|---|

Campos obligatorios desde la app: Fecha, Proveedor, Concepto, Tipo de movimiento y Monto. Categoría y Subcategoría son opcionales.

### Gastos Rafa

| ID_Transaccion | Fecha | Concepto | Monto | Categoría |
|---|---|---|---:|---|

### Configuracion

| Categoria | Tipo de Movimiento | Subcategoria |
|---|---|---|

### Recordatorios

| ID_Recordatorio | Titulo | Detalle | Fecha | Hora | Recurrencia | Etiqueta_Recurrencia | Estado | Creado_en | Actualizado_en | Completado_en | Ultimo_Completado_en |
|---|---|---|---|---|---|---|---|---|---|---|---|

## Configurar Apps Script

1. Abre tu Google Sheet.
2. Ve a **Extensiones > Apps Script**.
3. Pega el contenido de `apps-script/Code.gs`.
4. Ajusta:

```js
const SPREADSHEET_ID = 'PEGA_AQUI_EL_ID_DE_TU_GOOGLE_SHEET';
const APP_TOKEN = 'cambia-este-token-largo';
```

5. Guarda.
6. Implementa como **Aplicación web**.
7. Ejecutar como: **Yo**.
8. Acceso: **Cualquier persona**.
9. Copia la URL terminada en `/exec`.

## Variables de entorno

En local o Vercel:

```env
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/PEGA_AQUI_TU_DEPLOYMENT_ID/exec
VITE_APP_TOKEN=cambia-este-token-largo
```

El token debe coincidir exactamente con `APP_TOKEN` en Apps Script.

## Ejecutar localmente

```bash
npm install
npm run dev
```

## Publicar en Vercel

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

Variables requeridas:

```env
VITE_APPS_SCRIPT_URL=URL_DEL_WEB_APP_TERMINADA_EN_/exec
VITE_APP_TOKEN=TOKEN_CONFIGURADO_EN_APPS_SCRIPT
```

## Notas de fases

Las notas históricas están organizadas en la carpeta:

```txt
notas/
```

La carpeta se mantiene por debajo de 20 archivos.


## Fase 3F - Diagnóstico de conexión

Esta versión agrega un botón **Diagnóstico** en la barra de estado para evitar volver a trabajar a ciegas cuando Vercel o Apps Script quedan apuntando a una versión vieja.

El diagnóstico permite confirmar desde la app publicada:

- Versión del frontend.
- Versión del backend Apps Script.
- URL de Apps Script configurada en Vercel, enmascarada.
- ID real de Google Sheets configurado en Apps Script.
- Nombre real del archivo de Google Sheets.
- Existencia de `Tabla Oficial`, `Recordatorios`, `Configuracion` y `Gastos Rafa`.

### Variables de Vercel

Siguen siendo suficientes estas dos variables:

```env
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/TU_DEPLOYMENT_ID/exec
VITE_APP_TOKEN=rafa1234
```

Opcionalmente también se pueden agregar estas dos equivalentes para el puente interno:

```env
APPS_SCRIPT_URL=https://script.google.com/macros/s/TU_DEPLOYMENT_ID/exec
APP_TOKEN=rafa1234
```

### Apps Script

Después de pegar el nuevo `apps-script/Code.gs`, configurar:

```js
const SPREADSHEET_ID = 'ID_REAL_DE_TU_GOOGLE_SHEET';
const APP_TOKEN = 'rafa1234';
```

Luego hacer obligatoriamente:

`Guardar → Implementar → Administrar implementaciones → lápiz → Nueva versión → Implementar`.

Si el diagnóstico muestra un backend distinto a `1.6.5-fase-3f-configuracion-persistente`, Vercel sigue apuntando a una implementación vieja o Apps Script no fue desplegado como nueva versión.

## Fase 3F - Blindaje de conexión y control de versiones

Además del diagnóstico manual, esta versión agrega un blindaje automático al iniciar la app. Antes de sincronizar, la app valida que Apps Script responda con:

```txt
projectName = Control Gastos Milena
backendVersion = 1.6.5-fase-3f-configuracion-persistente
Google Sheet conectado = Sí
Tabla Oficial = Existe
Recordatorios = Existe
```

Si alguna validación falla, la app muestra **Revisar conexión** y bloquea la sincronización para evitar guardar contra un backend viejo o equivocado. Los cambios pueden quedar locales, pero no se suben hasta corregir la URL o la implementación.

El diagnóstico también guarda el último resultado correcto en el dispositivo, útil para identificar desde cuándo empezó el problema.


## Fase 3F - Configuración persistente en Apps Script

Para evitar que cada implementación vuelva a romper la conexión, el nuevo `Code.gs` lee primero `SPREADSHEET_ID` y `APP_TOKEN` desde Propiedades del Script.

Después de pegar el código de Fase 3F en Apps Script, ejecuta una sola vez:

```text
instalarConfiguracionFija
```

Luego ejecuta:

```text
probarHoja
```

Si `probarHoja` muestra `Base de Datos Gastos Mile-Rafa` y las hojas `Tabla Oficial` y `Recordatorios`, ya puedes implementar la app web.

El diagnóstico debe mostrar:

```text
Backend respondido: 1.6.5-fase-3f-configuracion-persistente
Google Sheet conectado: Sí
Fuente de configuración: Propiedades del Script
```
