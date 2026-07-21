import { BOTONES } from "../../../config/textos";
import { dinero, obtenerClienteEspecialPedido, obtenerCodigoPedido } from "../../../shared/utils/pedidos";

export default function ConfirmacionPedidoCliente({
  pedidoFinalizado,
  whatsappRafikiDisponible,
  linkWhatsAppFinal,
  nuevoPedidoCliente,
}) {
  const clienteEspecial = obtenerClienteEspecialPedido(pedidoFinalizado);

  return (
<main style={{ maxWidth: 680, margin: "0 auto" }}>
              <section className="card confirmacion-restaurante">
                <div className="hero green">
                  <div className="confirmacion-check">✓</div>
                  <h2>¡Pedido confirmado!</h2>
                  <p>Pedido #{obtenerCodigoPedido(pedidoFinalizado)} enviado a cocina</p>
                </div>

                <div className="card-pad">
                  {clienteEspecial ? (
                    <div className="confirmacion-cliente-especial">
                      <span>⭐ Cliente especial aplicado</span>
                      <strong>{clienteEspecial.nombre || clienteEspecial.codigo || "Cliente especial"}</strong>
                    </div>
                  ) : null}

                  <div className="confirmacion-info">
                    <div className="confirmacion-info-item">
                      <span>Cliente</span>
                      <strong>{pedidoFinalizado.cliente || pedidoFinalizado.cliente_nombre || "Cliente"}</strong>
                    </div>
                    <div className="confirmacion-info-item">
                      <span>Teléfono</span>
                      <strong>{pedidoFinalizado.telefono || "Sin teléfono"}</strong>
                    </div>
                    <div className="confirmacion-info-item">
                      <span>Pago</span>
                      <strong>{pedidoFinalizado.tipo_pago || "No especificado"}</strong>
                    </div>
                    <div className="confirmacion-info-item">
                      <span>Ubicación</span>
                      <strong>{pedidoFinalizado.ubicacion || ""}</strong>
                    </div>
                  </div>

                  <div className="confirmacion-resumen">
                    <h3>Resumen del pedido</h3>
                    <div className="confirmacion-lineas">
                      {(pedidoFinalizado.pedido_texto || "Pedido registrado")
                        .split("\n")
                        .filter(Boolean)
                        .map((linea, index) => (
                          <div key={`${linea}-${index}`} className="confirmacion-linea">{linea}</div>
                        ))}
                    </div>
                    <div className="confirmacion-total">
                      <span>Total</span>
                      <strong>{dinero(pedidoFinalizado.total)}</strong>
                    </div>
                  </div>

                  <div className="confirmacion-ok">Pedido enviado a cocina correctamente.</div>

                  <div className="confirmacion-actions">
                    {whatsappRafikiDisponible ? (
                      <a
                        href={linkWhatsAppFinal}
                        target="_blank"
                        rel="noreferrer"
                        className="button green whatsapp-confirm-button"
                      >
                        {BOTONES.CONFIRMAR_WHATSAPP}
                      </a>
                    ) : (
                      <div className="confirmacion-warning" role="alert">
                        WhatsApp no está configurado. El pedido ya fue enviado a cocina correctamente.
                      </div>
                    )}
                    <button type="button" onClick={nuevoPedidoCliente} className="button light" style={{ width: "100%" }}>
                      Hacer otro pedido
                    </button>
                  </div>
                </div>
              </section>
            </main>
  );
}
