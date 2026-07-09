# Fase 3A — Asistente interno de recordatorios

Se inicia la Fase 3 tomando como base la versión 1.5.8 de Fase 2M.

## Objetivo

Crear un primer chatbot interno de recordatorios generales dentro de la app Control de Gastos Milena, sin limitarlo exclusivamente a movimientos de ingresos o egresos.

## Cambios implementados

- Se actualizó la versión visual de la app a Fase 3A.
- Se agregó un botón flotante de asistente en la esquina inferior derecha.
- Se creó un panel tipo chat con mensaje inicial de ayuda.
- El asistente permite escribir recordatorios en lenguaje sencillo.
- Se agregó interpretación básica de fechas:
  - hoy
  - mañana
  - fechas exactas con formato AAAA-MM-DD
- Se creó listado de recordatorios pendientes.
- Se agregó contador de pendientes en el botón flotante.
- Se muestra indicador de recordatorios para hoy.
- Cada recordatorio puede marcarse como completado o eliminarse.
- Se agregó listado breve de completados recientes.
- Los recordatorios se guardan localmente en el dispositivo usando localStorage.

## Alcance actual

Esta subfase no modifica la sincronización estable de gastos con Google Sheets. El asistente queda funcionando de manera local para validar diseño, flujo y utilidad antes de conectar los recordatorios a una hoja nueva en Apps Script.

## Próxima mejora sugerida

Fase 3B: crear una hoja `Recordatorios`, conectar el asistente con Google Sheets y reutilizar el modelo de cola local para que los recordatorios también se sincronicen en segundo plano.
