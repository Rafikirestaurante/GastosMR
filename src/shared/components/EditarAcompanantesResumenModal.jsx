import { useEffect, useMemo, useState } from "react";
import RafikiModal from "./RafikiModal";

function limpiarListaAcompanantes(lista = []) {
  return Array.from(new Set(
    (Array.isArray(lista) ? lista : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  ));
}

export default function EditarAcompanantesResumenModal({
  abierto,
  grupo,
  acompanantesDisponibles = [],
  maxAcompanantes = 3,
  minimoAcompanantes = 2,
  exigirMinimo = false,
  onCerrar,
  onGuardar
}) {
  const item = grupo?.item || null;
  const nombreItem = item?.plato || item?.proteina || item?.producto || "producto";
  const cantidadGrupo = Number(grupo?.cantidad || item?.cantidad || 1) || 1;
  const [seleccionados, setSeleccionados] = useState([]);
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState("");

  const opciones = useMemo(
    () => limpiarListaAcompanantes(acompanantesDisponibles),
    [acompanantesDisponibles]
  );

  useEffect(() => {
    if (!abierto) return;

    setSeleccionados(limpiarListaAcompanantes(item?.acompanantes));
    setObservacion(String(item?.observacionAcompanantes || ""));
    setError("");
  }, [abierto, grupo?.key, item?.id]);

  function alternarAcompanante(acompanante) {
    setError("");
    setSeleccionados((actuales) => {
      if (actuales.includes(acompanante)) {
        return actuales.filter((itemActual) => itemActual !== acompanante);
      }

      if (actuales.length >= maxAcompanantes) {
        setError(`Solo puedes escoger hasta ${maxAcompanantes} acompañantes.`);
        return actuales;
      }

      return [...actuales, acompanante];
    });
  }

  function guardarCambios() {
    if (exigirMinimo && seleccionados.length < minimoAcompanantes) {
      setError(`Debes seleccionar mínimo ${minimoAcompanantes} acompañantes para este producto.`);
      return;
    }

    onGuardar?.(grupo?.ids || [], {
      acompanantes: seleccionados,
      observacionAcompanantes: observacion.trim()
    });
    onCerrar?.();
  }

  return (
    <RafikiModal
      open={Boolean(abierto && grupo)}
      title="Editar acompañantes"
      description={`${cantidadGrupo} x ${nombreItem}`}
      onClose={onCerrar}
      size="md"
      className="resumen-acompanantes-modal"
      footer={(
        <>
          <button type="button" className="button light" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="button" onClick={guardarCambios}>Guardar cambios</button>
        </>
      )}
    >
      {cantidadGrupo > 1 ? (
        <div className="box soft resumen-acompanantes-aviso">
          Este cambio aplica a las {cantidadGrupo} unidades agrupadas de este producto.
        </div>
      ) : null}

      <div className="resumen-acompanantes-contador">
        <strong>{seleccionados.length}/{maxAcompanantes} acompañantes</strong>
        {exigirMinimo ? <span>Mínimo {minimoAcompanantes}</span> : <span>Opcional</span>}
      </div>

      <div className="chips resumen-acompanantes-chips">
        {opciones.length === 0 ? (
          <span className="muted">No hay acompañantes configurados para el menú de hoy.</span>
        ) : opciones.map((acompanante) => {
          const seleccionado = seleccionados.includes(acompanante);
          const bloqueado = !seleccionado && seleccionados.length >= maxAcompanantes;

          return (
            <button
              key={acompanante}
              type="button"
              onClick={() => alternarAcompanante(acompanante)}
              disabled={bloqueado}
              className={`chip ${seleccionado ? "selected" : ""} ${bloqueado ? "blocked" : ""}`}
            >
              {seleccionado ? "✓ " : "+ "}{acompanante}
            </button>
          );
        })}
      </div>

      <label className="field resumen-acompanantes-observacion">
        <span>Observación sobre acompañantes</span>
        <textarea
          value={observacion}
          onChange={(event) => setObservacion(event.target.value.slice(0, 60))}
          placeholder="Ejemplo: sin ensalada, más arroz..."
          rows={2}
          maxLength={60}
        />
        <small className="muted">{observacion.length}/60 caracteres</small>
      </label>

      {error ? <div className="alert alert-warning resumen-acompanantes-error">{error}</div> : null}
    </RafikiModal>
  );
}
