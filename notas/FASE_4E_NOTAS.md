# Fase 4E · Alerta diaria de recordatorios cercanos

Base: `1.7.3_control-gastos-milena-fase-4d-hojas-dinamicas.zip`.

## Cambios

- Al terminar la carga inicial, la aplicación revisa los recordatorios pendientes.
- Una vez por día y por dispositivo/navegador, muestra una alerta modal cuando existen recordatorios vencidos o programados para hoy y los siguientes 3 días.
- La alerta ordena las tareas desde las más próximas, muestra hasta 8 y avisa si hay más.
- Incluye acceso directo a la sección **Pendientes** y botón **Entendido**.
- Puede cerrarse con la X, tocando el fondo o presionando Escape.
- Si no hay recordatorios cercanos, no se muestra ninguna ventana.
- La marca diaria se guarda en `localStorage`; no requiere cambios en Google Sheets ni Apps Script.

Versiones: frontend `1.7.4`; interfaz `Fase 4E`.

## Corrección 4E.1 · Dependencias estables

- Se eliminaron las versiones `latest` de `package.json`.
- Se fijaron React `18.3.1`, React DOM `18.3.1`, Vite `7.3.6` y `@vitejs/plugin-react` `5.1.1`.
- Vite y su plugin quedaron correctamente clasificados como dependencias de desarrollo.
- Se agregó un rango explícito de Node.js compatible con Vercel: `^20.19.0 || >=22.12.0 <23`.
- Esta corrección evita el conflicto de dependencias entre `@vitejs/plugin-react` 6, Rolldown y Babel 8 durante `npm install`.

Versión corregida: frontend `1.7.5`; interfaz `Fase 4E.1`.
