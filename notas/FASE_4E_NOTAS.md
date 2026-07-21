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
