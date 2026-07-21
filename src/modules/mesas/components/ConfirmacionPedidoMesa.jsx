import { obtenerCodigoPedido } from "../../../shared/utils/pedidos";

export default function ConfirmacionPedidoMesa({ pedido, modoLlevar, mesaLocal, onReiniciar }) {
  const pendienteOffline = Boolean(pedido?.pendiente_offline);

  return (
    <main className="confirmacion-simple-mesa">
      <section className="card confirmacion-restaurante">
        <div className="hero green">
          <div className="confirmacion-check">✓</div>
          <h2>{pendienteOffline ? "Pedido guardado pendiente por enviar" : `Pedido #${obtenerCodigoPedido(pedido)} enviado a cocina`}</h2>
          <p>{pendienteOffline ? "No había conexión. Se enviará automáticamente cuando vuelva internet." : "El pedido fue registrado correctamente."}</p>
        </div>
        <div className="card-pad" style={{ textAlign: "center" }}>
          <div className="confirmacion-ok">{modoLlevar ? "Llevar" : "Mesa"}: {pedido.mesa || pedido.cliente || mesaLocal}</div>
          <button type="button" onClick={onReiniciar} className="button green" style={{ width: "100%", maxWidth: 340 }}>
            Hacer otro pedido
          </button>
        </div>
      </section>
    </main>
  );
}
