# Control Gastos Milena — Fase 2E

Aplicación web sencilla para controlar los gastos de Milena usando:

- JavaScript
- React + Vite
- GitHub
- Vercel
- Google Sheets como base de datos
- Google Apps Script como puente entre la app y la hoja

## 1. Estructura usada de Google Sheets

La app espera estas pestañas exactamente con estos nombres:

### Tabla Oficial

| Gastos Fecha | Proveedor | Concepto | Ingreso | Egreso | Categoría | Subcategoría |
|---|---|---|---:|---:|---|---|

Esta es la tabla principal activa. **Gastos Mile queda desactivada** para la app. Los saldos se calculan como `Ingreso - Egreso`.

Campos obligatorios para registrar desde la app: Fecha, Proveedor, Concepto, Tipo de movimiento y Monto. Categoría y Subcategoría son opcionales.

### Gastos Rafa

| ID_Transaccion | Fecha | Concepto | Monto | Categoría |
|---|---|---|---:|---|

Esta tabla es secundaria para gastos ocasionales de Rafa.

### Configuracion

| Categoria | Tipo de Movimiento | Subcategoria |
|---|---|---|

Esta pestaña alimenta los desplegables de la app.

## 2. Configurar Apps Script

1. Abre tu Google Sheet.
2. Ve a **Extensiones > Apps Script**.
3. Borra el contenido inicial y pega el contenido de `apps-script/Code.gs`.
4. En el archivo pegado, cambia:

```js
const SPREADSHEET_ID = 'PEGA_AQUI_EL_ID_DE_TU_GOOGLE_SHEET';
const APP_TOKEN = 'cambia-este-token-largo';
```

El `SPREADSHEET_ID` está en el enlace de la hoja:

```txt
https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
```

El `APP_TOKEN` puede ser una frase larga que solo tú conozcas, por ejemplo:

```txt
gastos-mile-2026-token-seguro
```

5. Guarda el proyecto.
6. Haz clic en **Implementar > Nueva implementación**.
7. Tipo: **Aplicación web**.
8. Ejecutar como: **Yo**.
9. Quién tiene acceso: **Cualquier persona con el enlace**.
10. Copia la URL terminada en `/exec`.

## 3. Configurar la app localmente

Crea un archivo `.env` en la raíz del proyecto tomando como base `.env.example`:

```env
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/PEGA_AQUI_TU_DEPLOYMENT_ID/exec
VITE_APP_TOKEN=gastos-mile-2026-token-seguro
```

El token debe ser exactamente el mismo que dejaste en Apps Script.

## 4. Ejecutar en el computador

```bash
npm install
npm run dev
```

Luego abre la URL que te muestra Vite, normalmente:

```txt
http://localhost:5173
```

## 5. Subir a GitHub

```bash
git init
git add .
git commit -m "Fase 2E tabla oficial control gastos Milena"
git branch -M main
git remote add origin URL_DE_TU_REPOSITORIO
git push -u origin main
```

## 6. Publicar en Vercel

1. Entra a Vercel.
2. Importa el repositorio de GitHub.
3. Framework: Vite.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. En variables de entorno agrega:

```env
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/PEGA_AQUI_TU_DEPLOYMENT_ID/exec
VITE_APP_TOKEN=gastos-mile-2026-token-seguro
```

7. Deploy.

## 7. Qué incluye esta base funcional

- Dashboard de Milena.
- Total de ingresos del mes.
- Total de egresos del mes.
- Saldo del mes.
- Saldo acumulado.
- Total de gastos de Rafa.
- Registro de nuevo movimiento de Milena.
- Edición de movimiento de Milena.
- Borrado con confirmación.
- Historial con filtros.
- Registro secundario de gastos de Rafa.
- Borrado de gastos de Rafa.
- Listas desplegables desde la pestaña Configuracion.
- Todos los campos obligatorios.
- ID automático.
- Modo demo/local si aún no se configura Apps Script.

## 8. Pendiente para próximas mejoras

- Mejorar seguridad con un proxy en Vercel o autenticación simple.
- Gráficas visuales.
- Exportar reporte mensual.
- Editar categorías desde la app.
- Presupuesto mensual por categoría.

## Corrección Fase 2A

Esta versión corrige la actualización móvil anterior y deja una base más estable para continuar la Fase 2:

- Se eliminó el mensaje contradictorio entre “Conectado” y “No se pudo conectar”.
- El estado de conexión ahora muestra solo una condición a la vez: verificando, conectado, modo demo o error.
- La navegación móvil pasó a una barra inferior fija, más cómoda para celular.
- Se redujo la carga visual del encabezado en móvil.
- Se conservaron formularios a una columna, tarjetas móviles para historial y tablas para PC.
- No se modificó la estructura de Google Sheets ni el Apps Script para estos ajustes visuales.


## Corrección Fase 2B — conexión en celular

Esta versión mejora el diagnóstico cuando la app funciona en computador pero falla en celular.

### Causa más probable

Si en computador aparece **“Conectado correctamente a Google Sheets”** pero en celular aparece **“No se pudo cargar Google Apps Script”**, normalmente no es problema de la hoja ni del token. La causa más común es que el Web App de Apps Script esté disponible para la cuenta de Google abierta en el computador, pero no para el navegador del celular.

Revisar en Apps Script:

1. **Implementar > Administrar implementaciones**.
2. Editar la implementación activa o crear una nueva.
3. Tipo: **Aplicación web**.
4. Ejecutar como: **Yo**.
5. Acceso: **Cualquier persona**. No usar “Solo yo” ni “cualquier persona con cuenta de Google”.
6. Guardar, copiar la URL `/exec` actualizada y ponerla en Vercel si cambió.
7. Hacer redeploy en Vercel.

### Prueba rápida desde el celular

Abre directamente en el navegador del celular la URL de Apps Script agregando el token y la acción `health`:

```txt
TU_URL_DE_APPS_SCRIPT?action=health&token=TU_TOKEN
```

Debe responder algo parecido a:

```json
{"ok":true,"message":"Apps Script conectado correctamente."}
```

Si pide iniciar sesión, muestra permiso denegado o no abre, el problema está en el despliegue/permisos de Apps Script, no en React.

### Cambios técnicos incluidos

- Mensaje de error más claro para celular.
- Parámetro anticaché en cada solicitud a Apps Script.
- Caché local de la última carga correcta en el dispositivo.
- Si la conexión falla después de una carga exitosa, la app muestra la última información guardada en ese dispositivo.
- Panel de revisión rápida visible cuando no hay datos y falla la conexión.


## Fase 2D - Conexión móvil corregida sin PWA

Esta versión elimina el enfoque anterior de PWA/service workers porque la aplicación no depende de PWA.

Cambios principales:

- Se quitó el botón grande **Reparar app en este dispositivo**.
- Se agregó un botón pequeño con ícono **↻** para recargar la aplicación.
- Se agregó la función interna `api/sheets.js` para que Vercel actúe como puente entre el celular y Google Apps Script.
- La app primero intenta conectar por `/api/sheets` y solo si eso falla intenta el método directo JSONP.
- No cambia la estructura de Google Sheets ni el Apps Script.

Variables requeridas en Vercel:

```txt
VITE_APPS_SCRIPT_URL=URL_DEL_WEB_APP_TERMINADA_EN_/exec
VITE_APP_TOKEN=TOKEN_CONFIGURADO_EN_APPS_SCRIPT
```

El despliegue de Apps Script debe mantenerse como:

```txt
Ejecutar como: Yo
Quién tiene acceso: Cualquier persona
```


## Fase 2E - Tabla Oficial como base principal

Esta versión migra la base principal desde **Gastos Mile** hacia **Tabla Oficial**.

Columnas esperadas en Google Sheets:

```txt
Gastos Fecha | Proveedor | Concepto | Ingreso | Egreso | Categoría | Subcategoría
```

Cambios principales:

- La app ya no escribe en **Gastos Mile**.
- La entidad interna principal ahora apunta a **Tabla Oficial**.
- El formulario conserva el selector Ingreso/Egreso para que sea fácil registrar, pero el guardado escribe el valor en la columna correspondiente.
- Los cálculos del dashboard salen de `Ingreso - Egreso`.
- Categoría y Subcategoría dejaron de ser obligatorios en el movimiento principal.
- El historial muestra columnas separadas de Ingreso y Egreso.
- Apps Script genera referencias internas tipo `TO2`, `TO3`, etc., basadas en la fila, para poder editar y borrar sin agregar una columna ID visible a la Tabla Oficial.

Después de actualizar esta versión, copia nuevamente `apps-script/Code.gs` en Google Apps Script, guarda y vuelve a desplegar la Web App si Google lo solicita.
