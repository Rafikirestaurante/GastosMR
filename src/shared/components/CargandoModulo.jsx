import { Tarjeta } from "./common";
import { TEXTOS_APP } from "../../config/textos";

export default function CargandoModulo({ texto = TEXTOS_APP.CARGANDO_SECCION }) {
  return (
    <Tarjeta className="module-loader" role="status" aria-live="polite">
      <strong>{texto}</strong>
      <p className="muted" style={{ marginBottom: 0 }}>{TEXTOS_APP.CARGANDO_SECCION_DETALLE}</p>
    </Tarjeta>
  );
}
