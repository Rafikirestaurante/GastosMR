# Control Gastos Milena — Fase 2B

Aplicación web sencilla para controlar los gastos de Milena usando:

- JavaScript
- React + Vite
- GitHub
- Vercel
- Google Sheets como base de datos
- Google Apps Script como puente entre la app y la hoja

## 1. Estructura usada de Google Sheets

La app espera estas pestañas exactamente con estos nombres:

### Gastos Mile

| ID_Transaccion | Fecha | Proveedor | Concepto | Tipo de Movimiento | Monto | Categoria | Subcategoria |
|---|---|---|---|---|---:|---|---|

Esta es la tabla principal. Todos los campos son obligatorios, excepto el ID porque lo genera automáticamente Apps Script.

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
git commit -m "Fase 2B control gastos Milena"
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


## Fase 2C - control real de caché móvil

Esta versión agrega una corrección estructural para evitar que el navegador móvil o una PWA anterior sigan cargando una versión vieja de la app. Incluye:

- `vercel.json` con headers no-cache para `/` e `index.html`.
- Limpieza automática de cachés al cambiar la versión interna de la app.
- Desregistro automático de service workers antiguos.
- Botón **Reparar app en este dispositivo** dentro de la aplicación.
- Archivos `public/sw.js` y `public/service-worker.js` para reemplazar y desactivar service workers anteriores.

Si en modo incógnito funciona pero en ventana normal no, esta versión busca corregirlo desde la aplicación y el despliegue, no mediante instrucciones manuales al usuario.
