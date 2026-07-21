import { useEffect, useMemo, useState } from "react";
import RafikiModal from "./RafikiModal";
import { dinero } from "../utils/pedidos";

function listarPlatos(platosAgrupados = {}) {
  return Object.entries(platosAgrupados || {}).flatMap(([categoria, platos]) =>
    (Array.isArray(platos) ? platos : [])
      .filter((plato) => plato?.nombre)
      .map((plato) => ({
        ...plato,
        categoria: plato.categoria || categoria || ""
      }))
  );
}

export default function EditarProteinaResumenModal({
  abierto,
  grupo,
  platosAgrupados = {},
  onCerrar,
  onGuardar
}) {
  const item = grupo?.item || null;
  const nombreActual = item?.plato || item?.proteina || item?.producto || "producto";
  const cantidadGrupo = Number(grupo?.cantidad || item?.cantidad || 1) || 1;
  const [platoSeleccionado, setPlatoSeleccionado] = useState(null);

  const platos = useMemo(() => listarPlatos(platosAgrupados), [platosAgrupados]);

  useEffect(() => {
    if (!abierto) return;
    setPlatoSeleccionado(null);
  }, [abierto, grupo?.key, item?.id]);

  function guardarCambios() {
    if (!platoSeleccionado) return;
    onGuardar?.(grupo?.ids || [], platoSeleccionado);
    onCerrar?.();
  }

  return (
    <RafikiModal
      open={Boolean(abierto && grupo)}
      title="Editar proteína"
      description={`${cantidadGrupo} x ${nombreActual}`}
      onClose={onCerrar}
      size="md"
      className="resumen-proteina-modal"
      footer={(
        <>
          <button type="button" className="button light" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="button" onClick={guardarCambios} disabled={!platoSeleccionado}>Guardar cambios</button>
        </>
      )}
    >
      {cantidadGrupo > 1 ? (
        <div className="box soft resumen-acompanantes-aviso">
          Este cambio aplica a las {cantidadGrupo} unidades agrupadas de este producto.
        </div>
      ) : null}

      <div className="chips resumen-proteina-chips">
        {platos.length === 0 ? (
          <span className="muted">No hay proteínas configuradas para el menú de hoy.</span>
        ) : platos.map((plato) => {
          const activo = platoSeleccionado?.nombre === plato.nombre;
          const actual = nombreActual === plato.nombre;

          return (
            <button
              key={`${plato.categoria}-${plato.nombre}`}
              type="button"
              onClick={() => setPlatoSeleccionado(plato)}
              className={`chip resumen-proteina-chip ${activo ? "selected" : ""}`}
            >
              <span>{activo ? "✓ " : ""}{plato.nombre}{actual ? " · actual" : ""}</span>
              <small>{dinero(plato.precio)}</small>
            </button>
          );
        })}
      </div>
    </RafikiModal>
  );
}
