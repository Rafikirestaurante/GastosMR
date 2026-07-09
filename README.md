# Control Gastos Milena — Fase 3B

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

## Fase 3B - Asistente interno con fechas inteligentes

Esta fase mejora el chatbot interno de recordatorios generales para interpretar fechas de forma más natural, especialmente como se escriben en Colombia.

Incluye:

- Botón flotante tipo asistente/chatbot.
- Panel de conversación para crear recordatorios rápidos.
- Fechas colombianas: `DD-MM-AA`, `DD-MM`, `DD/MM/AA` y `DD/MM`.
- Cuando no se escribe el año, se asume automáticamente el año actual.
- Fechas naturales: `hoy`, `mañana`, `pasado mañana`, `el próximo lunes`, `en 8 días`, `el 15 de julio`, `fin de mes`, `fin de semana`, `quincena`.
- Momentos del día: `en la mañana`, `en la tarde`, `en la noche`, `al mediodía` y horas como `a las 3 pm`.
- Repeticiones básicas: `cada día`, `cada semana`, `cada mes` y `cada año`.
- Lista de recordatorios pendientes.
- Opción para marcar como completado o eliminar.
- Guardado local en el dispositivo mediante `localStorage`.

Ejemplos de uso:

```txt
Recordar pagar arriendo mañana en la tarde
Recordar llamar al proveedor 15/07/26
Recordar revisar pagos el próximo lunes
Recordar pagar internet cada mes
Recordar enviar soporte el 15 de julio
Recordar comprar mercado en 8 días
```

En esta versión los recordatorios siguen siendo locales al dispositivo. La sincronización con Google Sheets queda como siguiente subfase cuando el flujo inteligente quede aprobado.

## Fase 2M - Guardado rápido local

En esta fase la app guarda visualmente de inmediato en el dispositivo y sincroniza después con Google Sheets.

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
