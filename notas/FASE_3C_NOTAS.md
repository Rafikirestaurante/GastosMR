# Fase 3C - Recordatorios sincronizados con Google Sheets

Base: `1.6.1_control-gastos-milena-fase-3b-fechas-inteligentes.zip`.

## Objetivo

Conectar el asistente interno de recordatorios generales con Google Sheets, manteniendo el mismo principio de la Fase 2M: respuesta inmediata en la app, guardado local y sincronización posterior en segundo plano.

## Cambios principales

- Se agregó soporte remoto para recordatorios en `apps-script/Code.gs`.
- Se creó la entidad `reminder` / `reminders` y la hoja `Recordatorios`.
- Si la hoja `Recordatorios` no existe, Apps Script la crea automáticamente.
- La acción `bootstrap` ahora devuelve también `reminders`.
- Las acciones `create`, `update` y `delete` ahora aceptan `entity: 'reminder'`.
- La eliminación de recordatorios es lógica: el estado pasa a `Eliminado`.
- Los recordatorios usan la misma cola de sincronización local que los gastos.
- El asistente ya no depende únicamente de `localStorage`; ahora recibe los recordatorios desde el estado principal de la app.
- Los recordatorios siguen guardándose localmente como respaldo para uso sin conexión.

## Hoja Recordatorios

Columnas:

```txt
ID_Recordatorio | Titulo | Detalle | Fecha | Hora | Recurrencia | Etiqueta_Recurrencia | Estado | Creado_en | Actualizado_en | Completado_en | Ultimo_Completado_en
```

Estados:

```txt
Pendiente | Completado | Eliminado
```

## Flujo de sincronización

```txt
Crear / completar / borrar recordatorio
→ aparece inmediatamente en el asistente
→ queda con estado Pendiente de sincronizar
→ se envía a Google Sheets en segundo plano
→ queda OK cuando responde Apps Script
```

Si el recordatorio es recurrente, al marcarlo como completado se reprograma automáticamente para la siguiente fecha y se sincroniza ese cambio.

## Validación

Se ejecutó `npm run build` correctamente.
