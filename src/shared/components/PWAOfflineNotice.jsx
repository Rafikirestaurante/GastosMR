import React, { useEffect, useState } from 'react';
import { esRutaInternaPWA } from '../utils/pwa.js';

export default function PWAOfflineNotice() {
  const [online, setOnline] = useState(() => window.navigator.onLine);
  const [visible, setVisible] = useState(() => esRutaInternaPWA() && !window.navigator.onLine);

  useEffect(() => {
    const actualizarEstado = () => {
      const conectado = window.navigator.onLine;
      setOnline(conectado);
      setVisible(esRutaInternaPWA() && !conectado);
    };

    window.addEventListener('online', actualizarEstado);
    window.addEventListener('offline', actualizarEstado);
    window.addEventListener('popstate', actualizarEstado);
    actualizarEstado();

    return () => {
      window.removeEventListener('online', actualizarEstado);
      window.removeEventListener('offline', actualizarEstado);
      window.removeEventListener('popstate', actualizarEstado);
    };
  }, []);

  if (!visible || online) return null;

  return (
    <div
      className="rafiki-pwa-card"
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: 14,
        right: 14,
        top: 14,
        zIndex: 10001,
        maxWidth: 560,
        margin: '0 auto',
        background: '#7f1d1d',
        color: 'white',
        borderRadius: 18,
        padding: 16,
        boxShadow: '0 18px 40px rgba(0,0,0,.30)',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 24, lineHeight: 1 }}>⚠️</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 4 }}>Sin conexión a internet</div>
          <div style={{ fontSize: 14, lineHeight: 1.35, opacity: 0.94 }}>
            Verifica WiFi o datos móviles antes de enviar pedidos, cambiar estados o consultar información en vivo.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          style={{
            border: '1px solid rgba(255,255,255,.45)',
            background: 'transparent',
            color: 'white',
            borderRadius: 999,
            width: 30,
            height: 30,
            fontWeight: 900,
            cursor: 'pointer'
          }}
          aria-label="Cerrar aviso sin conexión"
        >
          ×
        </button>
      </div>
    </div>
  );
}
