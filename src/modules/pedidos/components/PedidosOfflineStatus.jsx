import React, { useEffect, useMemo, useState } from 'react';
import {
  contarPedidosPendientesOffline,
  eliminarPedidoPendienteOffline,
  leerPedidosPendientesOffline,
  prepararPedidoPendienteParaReintento,
  suscribirCambiosPedidosOffline
} from '../../../shared/utils/offlinePedidos.js';
import { esRutaInternaPWA } from '../../../shared/utils/pwa.js';
import { useConfirmacion } from '../../../shared/components/common.jsx';

function formatearFecha(valor) {
  if (!valor) return 'Sin fecha';
  try {
    return new Date(valor).toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Sin fecha';
  }
}

function colorEstado(estado) {
  if (estado === 'error') return '#b91c1c';
  if (estado === 'enviando') return '#1d4ed8';
  return '#92400e';
}

export default function PedidosOfflineStatus() {
  const [confirmarRafiki, modalConfirmacionRafiki] = useConfirmacion();
  const [total, setTotal] = useState(() => contarPedidosPendientesOffline());
  const [online, setOnline] = useState(() => navigator.onLine);
  const [abierto, setAbierto] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [revision, setRevision] = useState(0);
  const [filtro, setFiltro] = useState('activos');

  useEffect(() => {
    const actualizar = () => {
      const nuevoTotal = contarPedidosPendientesOffline();
      setTotal((anterior) => {
        if (nuevoTotal > anterior) {
          setToastVisible(true);
          window.setTimeout(() => setToastVisible(false), 4200);
        }
        return nuevoTotal;
      });
      setOnline(navigator.onLine);
      setRevision((valor) => valor + 1);
    };

    const cancelar = suscribirCambiosPedidosOffline(actualizar);
    window.addEventListener('online', actualizar);
    window.addEventListener('offline', actualizar);
    actualizar();

    return () => {
      cancelar();
      window.removeEventListener('online', actualizar);
      window.removeEventListener('offline', actualizar);
    };
  }, []);

  const registros = useMemo(() => {
    const lista = leerPedidosPendientesOffline().filter((registro) => registro.estado !== 'enviado');
    if (filtro === 'errores') return lista.filter((registro) => registro.estado === 'error');
    if (filtro === 'enviando') return lista.filter((registro) => registro.estado === 'enviando');
    return lista;
  }, [filtro, revision, total]);

  if (!esRutaInternaPWA() || total <= 0) return null;

  const todosActivos = leerPedidosPendientesOffline().filter((registro) => registro.estado !== 'enviado');
  const errores = todosActivos.filter((registro) => registro.estado === 'error').length;
  const enviando = todosActivos.filter((registro) => registro.estado === 'enviando').length;

  const reenviar = (idTemporal) => {
    if (idTemporal) prepararPedidoPendienteParaReintento(idTemporal);
    window.dispatchEvent(new CustomEvent('rafiki:reenviar-pedidos-offline', { detail: idTemporal ? { ids: [idTemporal] } : {} }));
  };

  const eliminar = async (registro) => {
    const descripcion = registro.pedido?.mesa || registro.pedido?.cliente || registro.id_temporal;
    const confirmar = await confirmarRafiki({
      tipo: 'irreversible',
      titulo: 'Eliminar pedido offline pendiente',
      mensaje: `¿Eliminar este pedido offline pendiente?

Referencia: ${descripcion}

Esta acción solo borra el registro local pendiente. No lo enviará a cocina ni a Supabase.`,
      textoConfirmar: 'Sí, eliminar',
    });
    if (!confirmar) return;

    eliminarPedidoPendienteOffline(registro.id_temporal);
  };

  return (
    <>
      {modalConfirmacionRafiki}
      {toastVisible && !abierto && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            right: 14,
            bottom: 138,
            zIndex: 10002,
            maxWidth: 260,
            background: '#78350f',
            color: 'white',
            borderRadius: 16,
            padding: '10px 12px',
            boxShadow: '0 12px 28px rgba(0,0,0,.24)',
            fontFamily: 'Arial, sans-serif',
            fontSize: 13,
            fontWeight: 800
          }}
        >
          📦 Pedido guardado offline. Puedes seguir trabajando.
        </div>
      )}

      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        title="Pedidos offline pendientes"
        style={{
          position: 'fixed',
          right: 14,
          bottom: 82,
          zIndex: 10002,
          border: 'none',
          borderRadius: 999,
          padding: '10px 13px',
          background: errores > 0 ? '#991b1b' : online ? '#78350f' : '#7f1d1d',
          color: 'white',
          boxShadow: '0 12px 28px rgba(0,0,0,.26)',
          fontFamily: 'Arial, sans-serif',
          fontWeight: 900,
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 7
        }}
      >
        <span aria-hidden="true">🟠</span>
        <span>{total} pendiente{total === 1 ? '' : 's'}</span>
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Panel de pedidos offline"
          style={{
            position: 'fixed',
            right: 14,
            bottom: 132,
            zIndex: 10003,
            width: 'min(410px, calc(100vw - 28px))',
            maxHeight: '68vh',
            overflow: 'auto',
            background: 'white',
            color: '#1f2937',
            borderRadius: 18,
            padding: 14,
            boxShadow: '0 20px 46px rgba(0,0,0,.30)',
            fontFamily: 'Arial, sans-serif',
            border: '1px solid #fed7aa'
          }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Panel offline</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                {online ? 'Con conexión disponible.' : 'Sin conexión. Se reenviarán después.'}
                {enviando > 0 ? ` Enviando: ${enviando}.` : ''}
                {errores > 0 ? ` Errores: ${errores}.` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              style={{ border: 'none', background: '#f3f4f6', borderRadius: 999, padding: '7px 10px', fontWeight: 900 }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
            {[
              ['activos', `Todos (${todosActivos.length})`],
              ['errores', `Errores (${errores})`],
              ['enviando', `Enviando (${enviando})`]
            ].map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setFiltro(valor)}
                style={{
                  border: filtro === valor ? '2px solid #f97316' : '1px solid #e5e7eb',
                  background: filtro === valor ? '#fff7ed' : '#fff',
                  color: '#1f2937',
                  borderRadius: 12,
                  padding: '8px 6px',
                  fontWeight: 900,
                  fontSize: 12
                }}
              >
                {texto}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => reenviar()}
            disabled={!online || enviando > 0}
            style={{
              width: '100%',
              border: 'none',
              background: online && enviando === 0 ? '#f97316' : '#9ca3af',
              color: 'white',
              borderRadius: 12,
              padding: '10px 12px',
              fontWeight: 900,
              marginBottom: 10
            }}
          >
            {enviando > 0 ? 'Enviando...' : 'Reenviar todos los pendientes'}
          </button>

          {registros.length === 0 && (
            <div style={{ padding: 12, background: '#f9fafb', borderRadius: 12, fontSize: 13, color: '#6b7280' }}>
              No hay pedidos en este filtro.
            </div>
          )}

          {registros.map((registro) => (
            <div key={registro.id_temporal} style={{ borderTop: '1px solid #f3f4f6', padding: '10px 0', fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <strong>{registro.pedido?.mesa || registro.pedido?.cliente || 'Pedido offline'}</strong>
                <span style={{ color: colorEstado(registro.estado), fontWeight: 900 }}>
                  {registro.estado || 'pendiente'}
                </span>
              </div>
              <div style={{ color: '#4b5563', marginTop: 3 }}>
                Total: {Number(registro.pedido?.total || 0).toLocaleString('es-CO')} · Intentos: {registro.intentos || 0}
              </div>
              <div style={{ color: '#6b7280', marginTop: 2 }}>
                Creado: {formatearFecha(registro.creado_en)} · Último intento: {formatearFecha(registro.ultimo_intento_en)}
              </div>
              {registro.id_temporal && (
                <div style={{ color: '#9ca3af', marginTop: 2, fontSize: 11, wordBreak: 'break-all' }}>
                  ID local: {registro.id_temporal}
                </div>
              )}
              {registro.ultimo_error && <div style={{ color: '#b91c1c', marginTop: 5 }}>Último error: {registro.ultimo_error}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 9 }}>
                <button
                  type="button"
                  onClick={() => reenviar(registro.id_temporal)}
                  disabled={!online || registro.estado === 'enviando'}
                  style={{
                    border: 'none',
                    background: online && registro.estado !== 'enviando' ? '#16a34a' : '#9ca3af',
                    color: 'white',
                    borderRadius: 10,
                    padding: '8px 10px',
                    fontWeight: 900
                  }}
                >
                  Reintentar
                </button>
                <button
                  type="button"
                  onClick={() => eliminar(registro)}
                  disabled={registro.estado === 'enviando'}
                  style={{
                    border: '1px solid #fecaca',
                    background: registro.estado === 'enviando' ? '#f3f4f6' : '#fff1f2',
                    color: registro.estado === 'enviando' ? '#9ca3af' : '#b91c1c',
                    borderRadius: 10,
                    padding: '8px 10px',
                    fontWeight: 900
                  }}
                >
                  Eliminar
                </button>
              </div>

              {Array.isArray(registro.historial_reintentos) && registro.historial_reintentos.length > 0 && (
                <details style={{ marginTop: 8, color: '#6b7280' }}>
                  <summary style={{ fontWeight: 800 }}>Historial de reintentos</summary>
                  {registro.historial_reintentos.slice(-8).map((evento, index) => (
                    <div key={`${registro.id_temporal}-${evento.fecha}-${index}`} style={{ marginTop: 4 }}>
                      {formatearFecha(evento.fecha)} · {evento.mensaje}
                    </div>
                  ))}
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
