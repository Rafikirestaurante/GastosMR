import React from "react";
import { TablaPedidosCompacta } from "../../../pedidos/components/PedidosAdmin";

function AdminPedidoGrupoBase({
  titulo,
  icono,
  pedidos,
  mensajeVacio,
  danger = false,
  mostrarFinalizarTodos = false,
  puedeFinalizarPendientes = false,
  finalizarTodosPendientes,
  finalizandoPendientes,
  cambiarEstadoPedido,
  guardandoEstadoPedidoId,
  puedeEliminarPedido = false,
  eliminarPedidoAdministrador,
  eliminandoPedidoId,
  puedeEditarPedido = false,
  onEditarPedido: abrirEditorPedido,
  editandoPedidoId,
}) {
  const onEliminarPedido = puedeEliminarPedido ? eliminarPedidoAdministrador : undefined;
  const onEditarPedido = puedeEditarPedido ? abrirEditorPedido : undefined;

  return (
    <div className="pedido-seccion">
      <div className={`section-heading ${danger ? "section-heading-danger" : ""}`}>
        <h3>{icono} {titulo}</h3>
        <div className="section-heading-actions">
          {mostrarFinalizarTodos && pedidos.length > 0 && puedeFinalizarPendientes && (
            <button
              type="button"
              className="mini-btn green"
              onClick={finalizarTodosPendientes}
              disabled={finalizandoPendientes}
            >
              {finalizandoPendientes ? "Finalizando..." : "Finalizar todos"}
            </button>
          )}
          <span>{pedidos.length}</span>
        </div>
      </div>

      {pedidos.length === 0 ? (
        <div className="box soft">{mensajeVacio}</div>
      ) : (
        <TablaPedidosCompacta
          pedidos={pedidos}
          onCambiarEstado={cambiarEstadoPedido}
          guardandoEstadoPedidoId={guardandoEstadoPedidoId}
          onEliminarPedido={onEliminarPedido}
          eliminandoPedidoId={eliminandoPedidoId}
          onEditarPedido={onEditarPedido}
          editandoPedidoId={editandoPedidoId}
        />
      )}
    </div>
  );
}

export default React.memo(AdminPedidoGrupoBase);
