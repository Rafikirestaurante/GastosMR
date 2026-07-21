import { CampoTexto } from "../../../shared/components/common";
import { dinero } from "../../../shared/utils/pedidos";
import { FORMA_PAGO_CREDITO, FORMAS_PAGO_MESA, MESAS_DISPONIBLES, MESEROS_DISPONIBLES } from "../../../shared/utils/mesas";

export default function DatosMesa({
  modoLlevar,
  mesaLocal,
  clientePedido,
  telefonoLlevar,
  ubicacionLlevar,
  meseroLocal,
  tipoPagoMesa,
  observacionesLocal,
  total,
  errorMesa,
  guardandoPedido,
  itemsConProducto,
  clientesCreditoMesa = [],
  onSeleccionarMesa,
  onAlternarModoLlevar,
  onClienteChange,
  onTelefonoChange,
  onUbicacionChange,
  onMeseroChange,
  onTipoPagoChange,
  onObservacionesChange,
  onEnviarPedido,
  modoEdicionAdmin = false
}) {
  return (
    <>
      <div id="mesa-datos-final" className="step-title" style={{ marginTop: 18 }}>
        <span className="step-number">3</span>
        <div>
          <h4>Datos de mesa</h4>
        </div>
      </div>

      <div className="mesa-datos-grid">
        <div className="mesa-dato-bloque">
          <h4>🍽️ Mesa o llevar <span className="requerido">*</span></h4>
          <div className={`mesa-selector-grid ${modoLlevar ? "llevar-activo" : ""}`} aria-label="Seleccionar mesa o llevar">
            {MESAS_DISPONIBLES.map((mesa) => (
              <button
                key={mesa}
                type="button"
                onClick={() => onSeleccionarMesa(mesa)}
                className={`option mesa-boton ${mesa === "5B" ? "mesa-5b" : ""} ${!modoLlevar && mesaLocal === mesa ? "selected" : ""}`}
              >
                {mesa}
              </button>
            ))}
            <button
              type="button"
              onClick={onAlternarModoLlevar}
              className={`option mesa-boton mesa-llevar ${modoLlevar ? "selected" : ""}`}
            >
              Llevar
            </button>
          </div>

          <div className="datos-llevar-grid" style={{ marginTop: 12 }}>
            <label className="field" id="mesa-cliente-credito">
              <span>
                Cliente {tipoPagoMesa === FORMA_PAGO_CREDITO ? <span className="requerido">*</span> : "(opcional)"}
              </span>
              <input
                type="text"
                value={clientePedido}
                onChange={(e) => onClienteChange(e.target.value)}
                placeholder={tipoPagoMesa === FORMA_PAGO_CREDITO ? "Busca o escribe el cliente de crédito" : "Ej: Sra. Inés, Juan Pérez..."}
                list={tipoPagoMesa === FORMA_PAGO_CREDITO ? "clientes-credito-mesas" : undefined}
              />
              {tipoPagoMesa === FORMA_PAGO_CREDITO && (
                <>
                  <datalist id="clientes-credito-mesas">
                    {clientesCreditoMesa.map((cliente) => (
                      <option key={cliente} value={cliente} />
                    ))}
                  </datalist>
                  <small className="muted">Selecciona un cliente existente cuando sea posible para mantener la cartera unificada.</small>
                </>
              )}
            </label>
            {modoLlevar && (
              <>
                <CampoTexto
                  etiqueta="Teléfono"
                  value={telefonoLlevar}
                  onChange={onTelefonoChange}
                  placeholder="Número de contacto"
                  type="tel"
                />
                <CampoTexto
                  etiqueta="Ubicación"
                  value={ubicacionLlevar}
                  onChange={onUbicacionChange}
                  placeholder="Dirección o referencia"
                />
              </>
            )}
          </div>
        </div>

        <div className="mesa-dato-bloque">
          <h4>👤 Mesero <span className="requerido">*</span></h4>
          <div className="chips">
            {MESEROS_DISPONIBLES.map((mesero) => (
              <button
                key={mesero}
                type="button"
                onClick={() => onMeseroChange(mesero)}
                className={`chip ${meseroLocal === mesero ? "selected" : ""}`}
              >
                {meseroLocal === mesero ? "✓ " : ""}{mesero}
              </button>
            ))}
          </div>
        </div>

        <div className="mesa-dato-bloque">
          <h4>💳 Forma de pago</h4>
          <div className="chips">
            {FORMAS_PAGO_MESA.map((pago) => (
              <button
                key={pago}
                type="button"
                onClick={() => onTipoPagoChange(pago)}
                className={`chip ${tipoPagoMesa === pago ? "selected" : ""}`}
              >
                {tipoPagoMesa === pago ? "✓ " : ""}{pago}
              </button>
            ))}
          </div>
        </div>

        <CampoTexto
          etiqueta="Observaciones generales"
          value={observacionesLocal}
          onChange={onObservacionesChange}
          placeholder="Ej: sin cubiertos, mesa espera bebida..."
          multiline
        />
      </div>

      <div className="sticky-total">
        <div>
          <div className="sticky-total-label">Total</div>
          <div className="sticky-total-amount">{dinero(total)}</div>
        </div>
        <div className="finalizar-area">
          {errorMesa && (
            <div className="finalizar-error" role="alert" aria-live="polite">{errorMesa}</div>
          )}

          <button
            type="button"
            onClick={onEnviarPedido}
            disabled={guardandoPedido || itemsConProducto.length === 0}
            className="button"
            style={{ margin: 0, padding: "12px 20px", fontSize: 15 }}
          >
            {guardandoPedido ? "Guardando..." : (modoEdicionAdmin ? "Guardar cambios →" : "Enviar a cocina →")}
          </button>
        </div>
      </div>
    </>
  );
}
