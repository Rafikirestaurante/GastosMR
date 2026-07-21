import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class RuntimeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Error de ejecución en Control Gastos Milena:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: '#f5f7fb', fontFamily: 'Arial, sans-serif' }}>
        <section style={{ width: 'min(560px, 100%)', background: '#fff', border: '1px solid #e3e7ef', borderRadius: '18px', padding: '24px', boxShadow: '0 18px 45px rgba(25, 40, 70, 0.12)' }}>
          <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700, color: '#68758a', textTransform: 'uppercase' }}>Control Gastos Milena</p>
          <h1 style={{ margin: '0 0 12px', fontSize: '24px', color: '#1c2638' }}>La aplicación no pudo abrirse correctamente</h1>
          <p style={{ margin: '0 0 18px', lineHeight: 1.55, color: '#536176' }}>Se detectó un error de ejecución. Recarga la aplicación para intentar nuevamente. Si continúa, comparte el texto técnico que aparece abajo.</p>
          <pre style={{ overflow: 'auto', maxHeight: '180px', padding: '12px', borderRadius: '10px', background: '#f2f4f8', color: '#8a2532', fontSize: '12px', whiteSpace: 'pre-wrap' }}>{String(this.state.error?.message || this.state.error)}</pre>
          <button type="button" onClick={() => window.location.reload()} style={{ marginTop: '18px', border: 0, borderRadius: '10px', padding: '11px 16px', background: '#273b63', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Recargar aplicación</button>
        </section>
      </main>
    );
  }
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('No se encontró el contenedor principal de la aplicación.');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <RuntimeErrorBoundary>
      <App />
    </RuntimeErrorBoundary>
  </React.StrictMode>
);
