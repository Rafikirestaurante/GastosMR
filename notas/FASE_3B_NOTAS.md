# Fase 3B - Asistente con fechas inteligentes

Esta subfase mejora el chatbot interno de recordatorios generales creado en Fase 3A.

## Objetivo

Hacer que el asistente entienda mejor la forma natural en que se escriben fechas y recordatorios en Colombia, sin depender de servicios externos ni APIs de inteligencia artificial.

## Cambios principales

- La app pasa visualmente a **Fase 3B**.
- Se amplió el parser local de recordatorios.
- Se agregó soporte para fechas colombianas:
  - `DD-MM-AA`
  - `DD-MM`
  - `DD/MM/AA`
  - `DD/MM`
- Cuando el usuario no escribe el año, la app asume automáticamente el año actual.
- Se mantiene compatibilidad con fecha técnica `AAAA-MM-DD`.
- Se agregaron expresiones naturales:
  - `hoy`
  - `mañana`
  - `pasado mañana`
  - `el próximo lunes`
  - `lunes`, `martes`, etc.
  - `en 8 días`
  - `en una semana`
  - `el 15 de julio`
  - `fin de mes`
  - `fin de semana`
  - `quincena`
- Se agregaron momentos del día:
  - `en la mañana` → 09:00
  - `en la tarde` → 15:00
  - `en la noche` → 19:00
  - `al mediodía` → 12:00
  - horas explícitas como `a las 3 pm` o `a las 8:30 a. m.`
- Se agregaron recurrencias básicas:
  - `cada día`
  - `cada semana`
  - `cada mes`
  - `cada año`
- Los recordatorios guardan ahora `dueTime`, `recurrence` y `recurrenceLabel` además de `dueDate`.
- Al marcar como completado un recordatorio recurrente, la app lo reprograma automáticamente para la siguiente fecha.
- Se mejoró el texto de bienvenida y el placeholder del asistente con ejemplos más naturales.

## Estado

Los recordatorios siguen guardándose localmente en el dispositivo mediante `localStorage`. La conexión de recordatorios con Google Sheets queda como siguiente subfase recomendada.
