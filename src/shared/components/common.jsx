import React, { useCallback, useEffect, useRef, useState } from "react";
import { obtenerEstadoPedido } from "../utils/pedidos";

export function CampoTexto({
  etiqueta,
  value,
  onChange,
  placeholder,
  multiline = false,
  type = "text",
  rows = 3,
  maxLength
}) {
  return (
    <label className="field">
      <span>{etiqueta}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
        />
      )}
      {maxLength ? <small className="muted">{String(value || "").length}/{maxLength} caracteres</small> : null}
    </label>
  );
}

export function EstadoBadge({ estado }) {
  const estadoNormalizado = obtenerEstadoPedido({ estado });
  const clase = `badge badge-${estadoNormalizado.toLowerCase()}`;

  return <span className={clase}>{estadoNormalizado}</span>;
}

export function SelectorCantidad({ cantidad, onChange }) {
  return (
    <div className="quantity">
      <button type="button" onClick={() => onChange(Math.max(1, cantidad - 1))}>
        −
      </button>
      <strong>{cantidad}</strong>
      <button type="button" onClick={() => onChange(cantidad + 1)}>
        +
      </button>
    </div>
  );
}


export function Boton({
  children,
  tipo = "button",
  variante = "primary",
  className = "",
  full = false,
  ...props
}) {
  const clases = ["button", variante !== "primary" ? variante : "", full ? "full-width" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={tipo} className={clases} {...props}>
      {children}
    </button>
  );
}

export function Tarjeta({ children, className = "", padding = true, ...props }) {
  const clases = ["card", padding ? "card-pad" : "", className].filter(Boolean).join(" ");
  return (
    <section className={clases} {...props}>
      {children}
    </section>
  );
}

export function Aviso({ mensaje, tipo = "info" }) {
  if (!mensaje) return null;
  return <div className={`alert alert-${tipo}`}>{mensaje}</div>;
}


const ICONOS_CONFIRMACION = {
  confirmar: "✅",
  advertencia: "⚠️",
  eliminar: "🗑️",
  exito: "✅",
  error: "❌",
  irreversible: "🚨",
  info: "ℹ️"
};

export function ConfirmModal({
  abierto,
  tipo = "confirmar",
  titulo = "Confirmar acción",
  mensaje = "¿Deseas continuar?",
  textoConfirmar = "Confirmar",
  textoCancelar = "Cancelar",
  onConfirmar,
  onCancelar
}) {
  if (!abierto) return null;

  const claseTipo = `rafiki-modal-${tipo}`;
  const icono = ICONOS_CONFIRMACION[tipo] || ICONOS_CONFIRMACION.confirmar;
  const lineas = String(mensaje || "").split("\n");

  return (
    <div className="rafiki-modal-backdrop" role="presentation" onMouseDown={onCancelar}>
      <div
        className={`rafiki-modal-card ${claseTipo}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rafiki-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="rafiki-modal-icon" aria-hidden="true">{icono}</div>
        <h3 id="rafiki-modal-title">{titulo}</h3>
        <div className="rafiki-modal-message">
          {lineas.map((linea, index) => (
            <p key={`${linea}-${index}`}>{linea || "\u00A0"}</p>
          ))}
        </div>
        <div className="rafiki-modal-actions">
          <button type="button" className="button secondary" onClick={onCancelar}>
            {textoCancelar}
          </button>
          <button type="button" className={`button rafiki-modal-confirm ${claseTipo}`} onClick={onConfirmar} autoFocus>
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AlertModal({
  abierto,
  tipo = "info",
  titulo = "Aviso Rafiki",
  mensaje = "",
  textoCerrar = "Entendido",
  onCerrar
}) {
  if (!abierto) return null;

  const claseTipo = `rafiki-modal-${tipo}`;
  const icono = ICONOS_CONFIRMACION[tipo] || ICONOS_CONFIRMACION.info;
  const lineas = String(mensaje || "").split("\n");

  return (
    <div className="rafiki-modal-backdrop" role="presentation" onMouseDown={onCerrar}>
      <div
        className={`rafiki-modal-card ${claseTipo}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="rafiki-alert-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="rafiki-modal-icon" aria-hidden="true">{icono}</div>
        <h3 id="rafiki-alert-title">{titulo}</h3>
        <div className="rafiki-modal-message">
          {lineas.map((linea, index) => (
            <p key={`${linea}-${index}`}>{linea || "\u00A0"}</p>
          ))}
        </div>
        <div className="rafiki-modal-actions rafiki-modal-actions-single">
          <button type="button" className={`button rafiki-modal-confirm ${claseTipo}`} onClick={onCerrar} autoFocus>
            {textoCerrar}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useAlertaRafiki() {
  const [opciones, setOpciones] = useState(null);

  const cerrar = useCallback(() => {
    setOpciones(null);
  }, []);

  const mostrar = useCallback((configuracion = {}) => {
    setOpciones({
      tipo: "info",
      titulo: "Aviso Rafiki",
      mensaje: "",
      textoCerrar: "Entendido",
      ...configuracion
    });
  }, []);

  const modal = (
    <AlertModal
      abierto={Boolean(opciones)}
      {...(opciones || {})}
      onCerrar={cerrar}
    />
  );

  return [mostrar, modal];
}

export function useConfirmacion() {
  const [opciones, setOpciones] = useState(null);

  const cerrar = useCallback((resultado) => {
    setOpciones((actual) => {
      if (actual?.resolver) actual.resolver(resultado);
      return null;
    });
  }, []);

  const confirmar = useCallback((configuracion = {}) => {
    return new Promise((resolver) => {
      setOpciones({
        tipo: "confirmar",
        titulo: "Confirmar acción",
        mensaje: "¿Deseas continuar?",
        textoConfirmar: "Confirmar",
        textoCancelar: "Cancelar",
        ...configuracion,
        resolver
      });
    });
  }, []);

  const modal = (
    <ConfirmModal
      abierto={Boolean(opciones)}
      {...(opciones || {})}
      onConfirmar={() => cerrar(true)}
      onCancelar={() => cerrar(false)}
    />
  );

  return [confirmar, modal];
}


const TIPOS_AVISO_RAFIKI = {
  success: { icono: "✓", titulo: "Operación completada" },
  exito: { icono: "✓", titulo: "Operación completada" },
  error: { icono: "×", titulo: "No fue posible completar la acción" },
  warning: { icono: "!", titulo: "Revisa esta información" },
  advertencia: { icono: "!", titulo: "Revisa esta información" },
  info: { icono: "i", titulo: "Información" }
};

function normalizarTipoAviso(tipo) {
  const limpio = String(tipo || "info").toLowerCase();
  if (limpio === "exito") return "success";
  if (limpio === "advertencia") return "warning";
  return TIPOS_AVISO_RAFIKI[limpio] ? limpio : "info";
}

export function RafikiAvisos({ avisos = [], onCerrar }) {
  if (!avisos.length) return null;

  return (
    <div className="rafiki-avisos-region" role="region" aria-label="Mensajes de Rafiki">
      {avisos.map((aviso) => {
        const tipo = normalizarTipoAviso(aviso.tipo);
        const configuracion = TIPOS_AVISO_RAFIKI[tipo];
        return (
          <div key={aviso.id} className={`rafiki-aviso rafiki-aviso-${tipo}`} role={tipo === "error" ? "alert" : "status"}>
            <span className="rafiki-aviso-icono" aria-hidden="true">{configuracion.icono}</span>
            <div className="rafiki-aviso-contenido">
              <strong>{aviso.titulo || configuracion.titulo}</strong>
              {aviso.mensaje ? <p>{aviso.mensaje}</p> : null}
            </div>
            <button type="button" className="rafiki-aviso-cerrar" onClick={() => onCerrar?.(aviso.id)} aria-label="Cerrar mensaje">×</button>
          </div>
        );
      })}
    </div>
  );
}

export function useAvisosRafiki() {
  const [avisos, setAvisos] = useState([]);
  const temporizadoresRef = useRef(new Map());

  const cerrarAviso = useCallback((id) => {
    const temporizador = temporizadoresRef.current.get(id);
    if (temporizador) window.clearTimeout(temporizador);
    temporizadoresRef.current.delete(id);
    setAvisos((actuales) => actuales.filter((aviso) => aviso.id !== id));
  }, []);

  const mostrarAviso = useCallback((configuracion = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tipo = normalizarTipoAviso(configuracion.tipo);
    const duracion = Number(configuracion.duracion ?? (tipo === "error" ? 6500 : 3800));
    const aviso = {
      id,
      tipo,
      titulo: configuracion.titulo || "",
      mensaje: String(configuracion.mensaje || configuracion.texto || "").trim()
    };

    setAvisos((actuales) => [...actuales.slice(-2), aviso]);
    if (duracion > 0) {
      const temporizador = window.setTimeout(() => cerrarAviso(id), duracion);
      temporizadoresRef.current.set(id, temporizador);
    }
    return id;
  }, [cerrarAviso]);

  useEffect(() => () => {
    temporizadoresRef.current.forEach((temporizador) => window.clearTimeout(temporizador));
    temporizadoresRef.current.clear();
  }, []);

  const componenteAvisos = <RafikiAvisos avisos={avisos} onCerrar={cerrarAviso} />;
  return [mostrarAviso, componenteAvisos, cerrarAviso];
}
