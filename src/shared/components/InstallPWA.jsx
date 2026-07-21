import React, { useEffect, useState } from 'react';
import { esAndroid, esIOS, esRutaInternaPWA, estaEnModoInstalado } from '../utils/pwa.js';

export default function InstallPWA() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [showAndroidHelp, setShowAndroidHelp] = useState(false);
  const [isInstallablePage, setIsInstallablePage] = useState(false);

  useEffect(() => {
    const actualizarRuta = () => {
      setIsStandalone(estaEnModoInstalado());
      setIsInstallablePage(esRutaInternaPWA());
    };

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
      setShowIOSHelp(false);
      setShowAndroidHelp(false);
    };

    actualizarRuta();
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('popstate', actualizarRuta);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('popstate', actualizarRuta);
    };
  }, []);

  const installApp = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      return;
    }

    if (esIOS()) {
      setShowIOSHelp(true);
      return;
    }

    if (esAndroid()) {
      setShowAndroidHelp(true);
    }
  };

  // La instalación se ofrece solo en rutas internas. La PWA instalada siempre inicia en /mesas y valida sesión para mostrar accesos administrativos.
  // /cliente sigue funcionando como web pública, sin promoción de instalación.
  if (!isInstallablePage || isStandalone) return null;
  if (!installPrompt && !esIOS() && !esAndroid()) return null;

  return (
    <>
      <button
        className="rafiki-pwa-floating-action"
        onClick={installApp}
        type="button"
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: 9999,
          border: 'none',
          borderRadius: 999,
          padding: '13px 17px',
          background: '#f97316',
          color: 'white',
          fontWeight: 900,
          boxShadow: '0 10px 25px rgba(0,0,0,.22)',
          cursor: 'pointer',
          fontFamily: 'Arial, sans-serif'
        }}
        aria-label="Instalar Rafiki Pedidos"
      >
        📲 Instalar app
      </button>

      {(showIOSHelp || showAndroidHelp) && (
        <div
          className="rafiki-pwa-card"
          role="dialog"
          aria-modal="false"
          style={{
            position: 'fixed',
            left: 16,
            right: 16,
            bottom: 78,
            zIndex: 9999,
            maxWidth: 520,
            margin: '0 auto',
            background: 'white',
            borderRadius: 18,
            padding: 16,
            boxShadow: '0 12px 30px rgba(0,0,0,.25)',
            border: '1px solid #fed7aa',
            fontFamily: 'Arial, sans-serif'
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>
            {showIOSHelp ? 'Instalar app en iPhone' : 'Instalar app en Android'}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.45, color: '#44403c' }}>
            {showIOSHelp
              ? 'Abre esta ruta en Safari, toca Compartir y selecciona “Agregar a pantalla de inicio”.'
              : 'Abre el menú del navegador y selecciona “Instalar app” o “Agregar a pantalla principal”.'}
          </div>
          <button
            onClick={() => {
              setShowIOSHelp(false);
              setShowAndroidHelp(false);
            }}
            type="button"
            style={{ marginTop: 12, border: 'none', background: '#111827', color: 'white', borderRadius: 10, padding: '8px 12px', fontWeight: 800 }}
          >
            Entendido
          </button>
        </div>
      )}
    </>
  );
}
