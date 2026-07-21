import React from "react";

function AdminRealtimeStatusBase({ estadoRealtimePedidos }) {
  if (!estadoRealtimePedidos) return null;

  const estado = estadoRealtimePedidos.estado || "inactivo";
  const texto = estadoRealtimePedidos.texto || "Realtime";
  const detalle = estadoRealtimePedidos.detalle || "Estado de conexión en vivo.";

  return (
    <span
      className={`realtime-dot realtime-${estado}`}
      title={`${texto}. ${detalle}`}
      aria-label={`${texto}. ${detalle}`}
    />
  );
}

export default React.memo(AdminRealtimeStatusBase);
