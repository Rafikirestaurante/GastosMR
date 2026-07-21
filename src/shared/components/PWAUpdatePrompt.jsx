import React, { useEffect, useState } from 'react';
import { activarNuevaVersion } from '../../registerSW.js';
import { esRutaInternaPWA } from '../utils/pwa.js';
import { limpiarCachesYRecargar, suprimirAvisosTemporalmente } from '../utils/pwaVersion.js';

export default function PWAUpdatePrompt() {
  const [actualizar, setActualizar] = useState(null);
  const [versionRemota, setVersionRemota] = useState('');
  const [visible, setVisible] = useState(false);
  const [limpiando, setLimpiando] = useState(false);

  useEffect(() => {
    const manejarNuevaVersion = (event) => {
      if (!esRutaInternaPWA()) return;
      setActualizar(() => event.detail?.actualizar || null);
      setVersionRemota(event.detail?.versionRemota || '');
      setVisible(true);
    };

    window.addEventListener('rafiki:nueva-version-disponible', manejarNuevaVersion);
    return () => {
      window.removeEventListener('rafiki:nueva-version-disponible', manejarNuevaVersion);
    };
  }, []);

  const actualizarConLimpieza = async () => {
    if (limpiando) return;
    setLimpiando(true);

    try {
      if (actualizar) activarNuevaVersion(actualizar);
      await limpiarCachesYRecargar();
    } catch (error) {
      console.warn('No se pudo limpiar completamente la PWA:', error);
      window.location.reload();
    }
  };

  if (!esRutaInternaPWA()) return null;
  if (!visible) return null;

  return (
    <div
      className="rafiki-pwa-card"
      role="dialog"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 10000,
        maxWidth: 560,
        margin: '0 auto',
        background: '#111827',
        color: 'white',
        borderRadius: 18,
        padding: 16,
        boxShadow: '0 18px 40px rgba(0,0,0,.28)',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px' }}>
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Nueva versión disponible</div>
          <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.35 }}>
            Puedes seguir operando. Actualiza cuando termines el pedido actual.
            {versionRemota ? ` Versión: ${versionRemota}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => {
              suprimirAvisosTemporalmente(window.sessionStorage, 60);
              setVisible(false);
            }}
            disabled={limpiando}
            style={{
              border: '1px solid rgba(255,255,255,.32)',
              borderRadius: 999,
              padding: '10px 12px',
              background: 'transparent',
              color: 'white',
              fontWeight: 800,
              cursor: limpiando ? 'wait' : 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Luego
          </button>
          <button
            type="button"
            onClick={actualizarConLimpieza}
            disabled={limpiando}
            style={{
              border: 'none',
              borderRadius: 999,
              padding: '10px 14px',
              background: '#f97316',
              color: 'white',
              fontWeight: 900,
              cursor: limpiando ? 'wait' : 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {limpiando ? 'Actualizando...' : 'Limpiar caché y actualizar'}
          </button>
        </div>
      </div>
    </div>
  );
}
