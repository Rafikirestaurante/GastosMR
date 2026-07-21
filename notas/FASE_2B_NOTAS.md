# Fase 2B — Diagnóstico de conexión móvil

Esta actualización responde al caso en el que la app conecta correctamente desde computador, pero desde celular muestra error de conexión con Google Apps Script y no carga historial.

## Diagnóstico principal

Cuando PC funciona y celular no, la causa más probable no es la estructura de Google Sheets ni el token, sino el despliegue/permisos del Web App de Google Apps Script o caché del navegador móvil. En especial, revisar que Apps Script esté publicado como aplicación web con:

- Ejecutar como: Yo.
- Acceso: Cualquier persona.

No debe quedar como “Solo yo” ni exigir cuenta de Google, porque el computador puede funcionar por tener la sesión del propietario abierta, mientras el celular falla.

## Cambios aplicados

1. Se mejoraron los mensajes de error para indicar que el fallo ocurre desde el dispositivo y puede depender de permisos, caché o conexión móvil.
2. Se agregó un parámetro anticaché a cada solicitud JSONP hacia Apps Script.
3. Se agregó caché local de la última carga remota correcta.
4. Si el dispositivo ya había cargado información antes y luego falla la conexión, la app conserva y muestra esa última información en vez de dejar historial vacío.
5. Se agregó una guía rápida en pantalla cuando no hay datos y falla la conexión.
6. Se agregó una acción `health` en Apps Script para probar la URL desde el celular.

## Prueba recomendada

Desde el celular abrir directamente:

```txt
TU_URL_DE_APPS_SCRIPT?action=health&token=TU_TOKEN
```

Debe devolver:

```json
{"ok":true,"message":"Apps Script conectado correctamente."}
```

Si pide iniciar sesión o muestra acceso denegado, corregir la implementación de Apps Script.
