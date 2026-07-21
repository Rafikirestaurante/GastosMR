import { useEffect } from 'react';
import { esRutaInternaPWA } from '../utils/pwa.js';
import { consultarVersionRemota, esVersionRemotaMasNueva, guardarVersionActual, puedeMostrarAvisoNuevaVersion, RAFIKI_APP_VERSION } from '../utils/pwaVersion.js';

/**
 * Fase 18 Pre-A:
 * Este guard ya no bloquea la aplicación. Solo revisa la versión remota y,
 * si existe una versión más nueva, emite un aviso recuperable para que el
 * usuario decida cuándo actualizar. Nunca reemplaza la app por una pantalla
 * completa ni crea ciclos infinitos de actualización.
 */
export default function PWAOldVersionGuard() {
  useEffect(() => {
    if (!esRutaInternaPWA()) return undefined;

    let activo = true;

    const revisarVersionSinBloquear = async () => {
      if (!activo || !navigator.onLine) return;

      try {
        const remota = await consultarVersionRemota();
        if (!activo) return;

        if (esVersionRemotaMasNueva(remota?.version, RAFIKI_APP_VERSION)) {
          if (!puedeMostrarAvisoNuevaVersion()) return;

          window.dispatchEvent(
            new CustomEvent('rafiki:nueva-version-disponible', {
              detail: {
                versionActual: RAFIKI_APP_VERSION,
                versionRemota: remota?.version || ''
              }
            })
          );
          return;
        }

        guardarVersionActual();
      } catch {
        // La operación del restaurante no puede depender de consultar la versión.
      }
    };

    const temporizador = window.setTimeout(revisarVersionSinBloquear, 1200);

    return () => {
      activo = false;
      window.clearTimeout(temporizador);
    };
  }, []);

  return null;
}
