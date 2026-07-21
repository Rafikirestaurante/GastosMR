import { registerSW } from 'virtual:pwa-register';
import { puedeMostrarAvisoNuevaVersion } from './shared/utils/pwaVersion.js';

let actualizarPWA = null;
let ultimaRevisionSW = 0;
let avisoVersionPendiente = false;

const MIN_MS_ENTRE_REVISIONES_SW = 5 * 60 * 1000;

function puedeRevisarSW(ahora = Date.now()) {
  if (ahora - ultimaRevisionSW < MIN_MS_ENTRE_REVISIONES_SW) return false;
  ultimaRevisionSW = ahora;
  return true;
}

function avisarNuevaVersion(versionRemota = '') {
  if (avisoVersionPendiente) return;
  if (!puedeMostrarAvisoNuevaVersion()) return;
  avisoVersionPendiente = true;

  window.dispatchEvent(
    new CustomEvent('rafiki:nueva-version-disponible', {
      detail: {
        versionRemota,
        actualizar: () => actualizarPWA?.(true)
      }
    })
  );
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  actualizarPWA = registerSW({
    immediate: true,
    onNeedRefresh() {
      avisarNuevaVersion();
    },
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent('rafiki:pwa-lista-offline'));
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      const revisarSW = () => {
        if (!navigator.onLine || !puedeRevisarSW()) return;
        registration.update().catch(() => undefined);
      };

      const revisarSWInmediato = () => {
        ultimaRevisionSW = 0;
        revisarSW();
      };

      revisarSWInmediato();
      window.addEventListener('online', revisarSWInmediato);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') revisarSW();
      });
    },
    onRegisterError(error) {
      console.warn('No se pudo registrar el service worker:', error);
    }
  });
}

export function activarNuevaVersion(registrationOrUpdater) {
  if (typeof registrationOrUpdater === 'function') {
    registrationOrUpdater(true);
    return;
  }

  if (actualizarPWA) {
    actualizarPWA(true);
  }
}
