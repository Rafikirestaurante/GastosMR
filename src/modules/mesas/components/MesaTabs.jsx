
export default function MesaTabs({ categoriaActiva, onSeleccionar }) {
  return (
    <div className="mesas-tabs" aria-label="Categorías del panel mesas">
      <button
        type="button"
        onClick={() => onSeleccionar("almuerzos")}
        className={`mesas-tab ${categoriaActiva === "almuerzos" ? "active" : ""}`}
      >
        <span>🍛</span>
        <strong>Almuerzos</strong>
      </button>

      <button
        type="button"
        onClick={() => onSeleccionar("cafeteria")}
        className={`mesas-tab cafeteria ${categoriaActiva === "cafeteria" ? "active" : ""}`}
      >
        <span>☕</span>
        <strong>Cafetería</strong>
      </button>
    </div>
  );
}
