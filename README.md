# Control Gastos Milena — Fase 1A

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
git commit -m "Fase 1A control gastos Milena"
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

## 7. Qué incluye esta Fase 1A

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

## 8. Pendiente para Fase 1B

- Mejorar seguridad con un proxy en Vercel o autenticación simple.
- Gráficas visuales.
- Exportar reporte mensual.
- Editar categorías desde la app.
- Presupuesto mensual por categoría.
