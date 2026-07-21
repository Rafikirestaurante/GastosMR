import React, { useState } from 'react';
import { limpiarCachesYRecargar } from '../utils/pwaVersion.js';
import { useAvisosRafiki, useConfirmacion } from './common.jsx';

export default function PWAClearCacheButton({ className = '', compact = false }) {
  const [limpiando, setLimpiando] = useState(false);
  const [mostrarAvisoRafiki, avisosRafiki] = useAvisosRafiki();
  const [confirmarRafiki, modalConfirmacionRafiki] = useConfirmacion();

  const manejarClick = async () => {
    if (limpiando) return;

    const confirmar = await confirmarRafiki({
      tipo: 'advertencia',
      titulo: 'Actualizar Rafiki en este dispositivo',
      mensaje: 'Se limpiará la caché y se cargará la versión más reciente.\nHazlo cuando no estés registrando un pedido.',
      textoConfirmar: 'Limpiar y actualizar'
    });

    if (!confirmar) return;

    setLimpiando(true);
    try {
      await limpiarCachesYRecargar();
    } catch (error) {
      console.warn('No se pudo limpiar caché completamente:', error);
      mostrarAvisoRafiki({
        tipo: 'warning',
        titulo: 'Actualización parcial',
        mensaje: 'No se pudo limpiar toda la caché. Rafiki recargará la página para intentar completar la actualización.'
      });
      window.setTimeout(() => window.location.reload(), 900);
    }
  };

  return (
    <>
    <button
      type="button"
      onClick={manejarClick}
      disabled={limpiando}
      className={`rafiki-clear-cache-button ${className}`.trim()}
      title="Limpiar caché y cargar la última versión"
      style={compact ? { width: 38, height: 38, padding: 0, fontSize: 17, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } : undefined}
    >
      {compact ? (limpiando ? '⏳' : '🔄') : (limpiando ? 'Actualizando...' : 'Limpiar caché')}
    </button>
    {avisosRafiki}
    {modalConfirmacionRafiki}
    </>
  );
}
