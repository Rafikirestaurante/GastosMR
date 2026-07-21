
const MAPA_TIPOS = {
  pendiente: "warning",
  parcial: "info",
  pagado: "success",
  finalizado: "success",
  activo: "success",
  credito: "warning",
  crédito: "warning",
  anulado: "danger",
  cancelado: "danger",
  inactivo: "danger",
  vencido: "danger",
  llevar: "info",
  "para llevar": "info",
  neutro: "neutral",
  neutral: "neutral",
};

function normalizar(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function RafikiBadge({ children, estado, tipo, className = "" }) {
  const texto = children ?? estado ?? "—";
  const tipoCalculado = tipo || MAPA_TIPOS[normalizar(estado ?? children)] || "neutral";

  return (
    <span className={["rafiki-badge", `rafiki-badge-${tipoCalculado}`, className].filter(Boolean).join(" ")}>
      {texto}
    </span>
  );
}
