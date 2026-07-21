import React from "react";
import { mostrarPantallaRecuperacionPWA } from "../utils/pwaRecovery.js";

function obtenerMensajeError(error) {
  if (!error) return "Error desconocido.";
  return error?.message || String(error);
}

function esErrorCargaModulo(error) {
  const texto = obtenerMensajeError(error);
  return /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|dynamically imported module|module script|chunk|MIME type/i.test(
    texto
  );
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      errorInfo: null,
      intentos: 0
    };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    if (typeof this.props.onError === "function") {
      this.props.onError(error, errorInfo);
    }

    if (this.props.usarRecuperacionPWA && esErrorCargaModulo(error)) {
      mostrarPantallaRecuperacionPWA(error);
      return;
    }

    console.error(
      `[Rafiki] ErrorBoundary${this.props.nombreModulo ? ` (${this.props.nombreModulo})` : ""}:`,
      error,
      errorInfo
    );
  }

  reintentar = () => {
    if (typeof this.props.onReset === "function") {
      this.props.onReset();
    }

    this.setState((actual) => ({
      error: null,
      errorInfo: null,
      intentos: actual.intentos + 1
    }));
  };

  recargarApp = async () => {
    window.location.reload();
  };

  render() {
    const {
      children,
      nombreModulo = "este módulo",
      mostrarDetalleTecnico = true,
      compacto = false
    } = this.props;

    if (this.state.error) {
      const mensaje = obtenerMensajeError(this.state.error);
      const titulo =
        nombreModulo === "Rafiki Pedidos"
          ? "Rafiki Pedidos no pudo iniciar correctamente"
          : `No se pudo cargar ${nombreModulo}`;

      return (
        <section
          className={`card card-pad module-error-card${compacto ? " module-error-card-compact" : ""}`}
          role="alert"
        >
          <div className="module-error-header">
            <div className="module-error-icon" aria-hidden="true">
              ⚠️
            </div>
            <div>
              <h2>{titulo}</h2>
              <p className="muted">
                La app sigue funcionando. Puedes intentar cargar nuevamente este módulo sin tumbar toda la
                pantalla.
              </p>
            </div>
          </div>

          {mostrarDetalleTecnico && (
            <details className="module-error-details">
              <summary>Ver detalle técnico</summary>
              <pre>{mensaje}</pre>
              {this.state.errorInfo?.componentStack && <pre>{this.state.errorInfo.componentStack}</pre>}
            </details>
          )}

          <div className="admin-actions-stack horizontal module-error-actions">
            <button type="button" className="button" onClick={this.reintentar}>
              Reintentar cargar módulo
            </button>
            <button type="button" className="button light" onClick={this.recargarApp}>
              Recargar app
            </button>
          </div>
        </section>
      );
    }

    return <React.Fragment key={this.state.intentos}>{children}</React.Fragment>;
  }
}
