# Control Gastos Milena — Fase 4E.1

Versión del frontend: `1.7.5-fase-4e1-dependencias-estables`  
Versión esperada del backend: `1.7.3-fase-4d-hojas-dinamicas`

## Objetivo de esta fase

La aplicación deja de depender de módulos programados uno por uno. **Mile**, **Rafa** y las futuras hojas se administran desde una configuración central y aparecen automáticamente en la navegación.

La antigua sección visible **Inicio / Tabla principal** ahora se llama **Mile**. Su pestaña real en Google Sheets continúa siendo `Tabla Oficial`, por lo que no se pierde ni se mueve información existente.

## Navegación

La estructura queda así:

`Dashboard · Mile · Rafa · [hojas creadas] · Pendientes · Config`

En celular se conserva el menú desplegable de tres líneas. Las hojas nuevas se agregan automáticamente al mismo menú.

## Config > Hojas de movimientos

Desde la aplicación se puede:

- Crear una hoja nueva en Google Sheets.
- Elegir su nombre visible.
- Definir el nombre físico de la pestaña de Google Sheets.
- Mostrarla u ocultarla de la navegación.
- Cambiar su orden.
- Seleccionar los campos visibles: Proveedor, Ingreso/Egreso, Categoría y Subcategoría.
- Archivar una hoja dinámica sin borrar la pestaña ni sus datos.

Fecha, concepto y monto permanecen disponibles como campos base.

## Hoja técnica `Hojas App`

Apps Script crea automáticamente una pestaña llamada `Hojas App`. Allí se guarda la configuración de Mile, Rafa y las hojas dinámicas:

- ID interno
- Nombre visible
- Nombre de la pestaña en Google Sheets
- Tipo de hoja
- Hoja principal
- Visibilidad en el menú
- Orden
- Campos visibles
- Estado activo
- Fechas técnicas

No se recomienda editar esta pestaña manualmente.

## Estructura de las hojas nuevas

Cada hoja dinámica usa la estructura común:

`ID_Transaccion | Fecha | Proveedor | Concepto | Ingreso | Egreso | Categoría | Subcategoría | Creado_en | Actualizado_en | Estado`

Los campos que se oculten desde Config siguen existiendo técnicamente, pero no aparecen en el formulario ni en el historial.

## Dashboard

El Dashboard incluye un selector para consultar:

- Todas las hojas.
- Mile.
- Rafa.
- Cualquier hoja dinámica creada.

El resumen, el rango de fechas, el saldo acumulado, la tabla, las categorías y los últimos movimientos se recalculan según la selección.

## Compatibilidad con datos anteriores

- `Mile` utiliza los datos actuales de `Tabla Oficial`.
- `Rafa` utiliza los datos actuales de `Gastos Rafa`.
- No es necesario migrar ni copiar los movimientos existentes.
- Las nuevas hojas utilizan la estructura común desde su creación.

## Implementación obligatoria de Apps Script

Esta fase **sí modifica el backend**. Debes:

1. Abrir el proyecto actual de Google Apps Script.
2. Reemplazar el contenido de `Code.gs` por el archivo incluido en `apps-script/Code.gs`.
3. Ejecutar `instalarConfiguracionFija()` solamente si las Propiedades del Script todavía no están configuradas.
4. Ejecutar `probarHoja()`.
5. Crear una nueva implementación de la aplicación web.
6. Copiar la nueva URL `/exec` en `VITE_APPS_SCRIPT_URL` de Vercel.
7. Volver a desplegar Vercel.
8. Abrir Diagnóstico y verificar backend `1.7.3-fase-4d-hojas-dinamicas` y la existencia de `Hojas App`.

La implementación debe continuar configurada como:

- Ejecutar como: **Yo**
- Quién tiene acceso: **Cualquier persona**

## Desarrollo local

```bash
npm install
npm run dev
```

Compilación:

```bash
npm run build
```


## Fase 4E · Alerta diaria

Al primer ingreso del día en cada dispositivo, la app muestra un modal si existen recordatorios vencidos o programados para hoy y los próximos 3 días. No requiere cambios en Apps Script.


## Fase 4E.1 · Corrección de despliegue en Vercel

Las dependencias están fijadas en versiones exactas y compatibles. No usar `latest` ni reemplazar estas versiones automáticamente. Para instalar y compilar:

```bash
npm install --package-lock=false
npm run build
```
