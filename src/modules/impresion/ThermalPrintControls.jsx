import React, { useCallback, useEffect, useMemo, useState } from "react";
import { guardarFormatoTermicoPreferido, normalizarFormatoTermico, obtenerFormatoTermicoPreferido } from "./thermalReportService";

export default function ThermalPrintControls({
  onPrint,
  disabled = false,
  label = "Imprimir",
  title = "Formato térmico",
  className = "",
  buttonClassName = "mini-btn print",
  selectClassName = "",
  compact = false,
  ariaLabel = "Seleccionar formato térmico",
}) {
  const [formato, setFormato] = useState(() => obtenerFormatoTermicoPreferido("80"));

  useEffect(() => {
    setFormato(obtenerFormatoTermicoPreferido("80"));
  }, []);

  const etiquetaBoton = useMemo(() => `${label} ${formato} mm`, [label, formato]);

  const cambiarFormato = useCallback((event) => {
    const siguiente = normalizarFormatoTermico(event.target.value);
    setFormato(siguiente);
    guardarFormatoTermicoPreferido(siguiente);
  }, []);

  const imprimir = useCallback(() => {
    if (disabled) return;
    onPrint?.(formato);
  }, [disabled, formato, onPrint]);

  return (
    <div className={`thermal-print-controls${compact ? " thermal-print-controls-compact" : ""}${className ? ` ${className}` : ""}`}>
      <label className="thermal-print-format">
        <span>{title}</span>
        <select className={selectClassName} value={formato} onChange={cambiarFormato} aria-label={ariaLabel} disabled={disabled}>
          <option value="80">80 mm</option>
          <option value="58">58 mm</option>
        </select>
      </label>
      <button type="button" className={buttonClassName} onClick={imprimir} disabled={disabled} title={`${etiquetaBoton}. Misma información, optimizada al ancho.`}>
        🧾 {etiquetaBoton}
      </button>
    </div>
  );
}
