import React, { useEffect, useMemo, useState } from "react";
import {
  calcularTotalItems,
  crearItemNuevo,
  dinero,
  esProductoSinAcompanantes,
  MENSAJE_ACOMPANANTES_DEL_DIA
} from "../../../shared/utils/pedidos";
import {
  agruparItemsResumenPedido,
  consolidarItemsResumenPedido,
  normalizarCantidadResumen
} from "../../../shared/utils/resumenPedido";
import { CampoTexto, useAlertaRafiki } from "../../../shared/components/common";
import RafikiModal from "../../../shared/components/RafikiModal";
import EditarAcompanantesResumenModal from "../../../shared/components/EditarAcompanantesResumenModal";
import EditarProteinaResumenModal from "../../../shared/components/EditarProteinaResumenModal";
import ResumenPedidoItem from "../../../shared/components/ResumenPedidoItem";
import { MAX_ACOMPANANTES_CLIENTE } from "../../../data/menuAlmuerzos";
import {
  FORMA_PAGO_CREDITO,
  FORMAS_PAGO_MESA,
  MESAS_DISPONIBLES,
  MESEROS_DISPONIBLES,
  vibracionCortaMesas
} from "../../../shared/utils/mesas";

const PASOS_BETA = [
  { id: "proteina", numero: 1, titulo: "Selecciona tu proteína aquí" },
  { id: "acompanantes", numero: 2, titulo: "Selecciona tu acompañante" },
  { id: "datos", numero: 3, titulo: "Datos de mesa" }
];

function crearItemAlmuerzoBeta() {
  return {
    ...crearItemNuevo(),
    categoria: "",
    cantidad: 1,
    paraLlevar: false
  };
}

function obtenerNombreItem(item = {}) {
  return item.producto || item.plato || item.proteina || "Producto";
}

function obtenerPasoIndice(paso) {
  return Math.max(0, PASOS_BETA.findIndex((item) => item.id === paso));
}

export default function PanelMesasBeta({ menu, platosAgrupados, cargandoMenu = false, onSalirBeta }) {
  const [mostrarAlertaRafiki, modalAlertaRafiki] = useAlertaRafiki();
  const [itemsMesa, setItemsMesa] = useState([crearItemAlmuerzoBeta()]);
  const [itemActivoId, setItemActivoId] = useState(null);
  const [pasoModal, setPasoModal] = useState(null);
  const [mesaLocal, setMesaLocal] = useState("");
  const [modoLlevar, setModoLlevar] = useState(false);
  const [clientePedido, setClientePedido] = useState("");
  const [telefonoLlevar, setTelefonoLlevar] = useState("");
  const [ubicacionLlevar, setUbicacionLlevar] = useState("");
  const [meseroLocal, setMeseroLocal] = useState("");
  const [tipoPagoMesa, setTipoPagoMesa] = useState(FORMAS_PAGO_MESA[0]);
  const [observacionesLocal, setObservacionesLocal] = useState("");
  const [grupoEditandoAcompanantesMesa, setGrupoEditandoAcompanantesMesa] = useState(null);
  const [grupoEditandoProteinaMesa, setGrupoEditandoProteinaMesa] = useState(null);

  const itemsConProducto = useMemo(
    () => itemsMesa.filter((item) => item.plato || item.proteina || item.producto),
    [itemsMesa]
  );

  const total = useMemo(() => calcularTotalItems(itemsConProducto), [itemsConProducto]);
  const gruposResumenMesa = useMemo(() => agruparItemsResumenPedido(itemsConProducto), [itemsConProducto]);
  const acompanantesDisponibles = useMemo(
    () => ["Con todo", ...(Array.isArray(menu?.acompanantes) ? menu.acompanantes.filter((acompanante) => acompanante !== "Con todo") : [])],
    [menu?.acompanantes]
  );

  const itemActivo = useMemo(() => {
    const actual = itemsMesa.find((item) => item.id === itemActivoId);
    if (actual) return actual;
    return itemsMesa[itemsMesa.length - 1] || null;
  }, [itemsMesa, itemActivoId]);

  const pasoActual = PASOS_BETA.find((paso) => paso.id === pasoModal) || null;
  const itemActivoSinAcompanantes = itemActivo ? esProductoSinAcompanantes(itemActivo) : false;
  const acompanantesItemActivo = Array.isArray(itemActivo?.acompanantes) ? itemActivo.acompanantes : [];
  const hayResumen = gruposResumenMesa.length > 0;

  useEffect(() => {
    setItemsMesa((actual) => consolidarItemsResumenPedido(actual));
  }, [itemsMesa]);

  useEffect(() => {
    setItemActivoId((actual) => actual || itemsMesa[0]?.id || null);
  }, [itemsMesa]);

  function abrirPaso(paso, itemId = itemActivo?.id) {
    vibracionCortaMesas();
    if (itemId) setItemActivoId(itemId);
    setPasoModal(paso);
  }

  function mostrarAviso(titulo, mensaje, tipo = "advertencia") {
    mostrarAlertaRafiki({ tipo, titulo, mensaje, textoCerrar: "Entendido" });
  }

  function actualizarItemMesa(id, cambios) {
    setItemsMesa((actual) =>
      actual.map((item) => (item.id === id ? { ...item, ...cambios } : item))
    );
  }

  function cambiarPlatoMesa(platoSeleccionado) {
    if (!itemActivo?.id) return;
    vibracionCortaMesas();

    const sinAcompanantes = esProductoSinAcompanantes(platoSeleccionado);

    actualizarItemMesa(itemActivo.id, {
      categoria: platoSeleccionado.categoria || "",
      plato: platoSeleccionado.nombre || "",
      proteina: platoSeleccionado.nombre || "",
      precioPlato: Number(platoSeleccionado.precio) || 0,
      precioProteina: Number(platoSeleccionado.precio) || 0,
      acompanantes: sinAcompanantes ? [] : itemActivo.acompanantes || [],
      observacionAcompanantes: sinAcompanantes ? "" : itemActivo.observacionAcompanantes || "",
      paraLlevar: false
    });
  }

  function cambiarAcompananteMesa(acompanante) {
    if (!itemActivo?.id || itemActivoSinAcompanantes) return;
    vibracionCortaMesas();

    setItemsMesa((actual) =>
      actual.map((item) => {
        if (item.id !== itemActivo.id) return item;
        const actuales = Array.isArray(item.acompanantes) ? item.acompanantes : [];
        const seleccionado = actuales.includes(acompanante);

        if (seleccionado) {
          return { ...item, acompanantes: actuales.filter((actual) => actual !== acompanante) };
        }

        if (actuales.length >= MAX_ACOMPANANTES_CLIENTE) return item;
        return { ...item, acompanantes: [...actuales, acompanante] };
      })
    );
  }

  function actualizarCantidadGrupoMesa(ids = [], cantidad) {
    const idsGrupo = new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean));
    if (idsGrupo.size === 0) return;
    const cantidadNormalizada = normalizarCantidadResumen(cantidad);

    setItemsMesa((actual) => {
      let primerItemActualizado = false;
      const siguientesItems = [];

      actual.forEach((item) => {
        if (!idsGrupo.has(item.id)) {
          siguientesItems.push(item);
          return;
        }

        if (!primerItemActualizado) {
          siguientesItems.push({ ...item, cantidad: cantidadNormalizada });
          primerItemActualizado = true;
        }
      });

      return siguientesItems.length > 0 ? siguientesItems : [crearItemAlmuerzoBeta()];
    });
  }

  function quitarGrupoPedidoMesa(ids = []) {
    const idsGrupo = new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean));
    if (idsGrupo.size === 0) return;

    setItemsMesa((actual) => {
      const filtrados = actual.filter((item) => !idsGrupo.has(item.id));
      const siguiente = filtrados.length > 0 ? filtrados : [crearItemAlmuerzoBeta()];
      setItemActivoId(siguiente[siguiente.length - 1]?.id || null);
      return siguiente;
    });
  }

  function actualizarProteinaGrupoMesa(ids = [], platoSeleccionado = {}) {
    const idsGrupo = new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean));
    if (idsGrupo.size === 0 || !platoSeleccionado?.nombre) return;

    const sinAcompanantes = esProductoSinAcompanantes(platoSeleccionado);

    setItemsMesa((actual) =>
      actual.map((item) => {
        if (!idsGrupo.has(item.id)) return item;
        return {
          ...item,
          categoria: platoSeleccionado.categoria || "",
          plato: platoSeleccionado.nombre || "",
          proteina: platoSeleccionado.nombre || "",
          precioPlato: Number(platoSeleccionado.precio) || 0,
          precioProteina: Number(platoSeleccionado.precio) || 0,
          acompanantes: sinAcompanantes ? [] : item.acompanantes || [],
          observacionAcompanantes: sinAcompanantes ? "" : item.observacionAcompanantes || "",
          paraLlevar: false
        };
      })
    );
  }

  function actualizarAcompanantesGrupoMesa(ids = [], cambios = {}) {
    const idsGrupo = new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean));
    if (idsGrupo.size === 0) return;
    const acompanantes = Array.isArray(cambios.acompanantes) ? cambios.acompanantes : [];
    const observacionAcompanantes = String(cambios.observacionAcompanantes || "").trim().slice(0, 60);

    setItemsMesa((actual) =>
      actual.map((item) => {
        if (!idsGrupo.has(item.id)) return item;
        if (esProductoSinAcompanantes(item)) return { ...item, acompanantes: [], observacionAcompanantes: "" };
        return { ...item, acompanantes, observacionAcompanantes };
      })
    );
  }

  function continuarDesdeProteina() {
    if (!itemActivo?.plato && !itemActivo?.proteina) {
      mostrarAviso("Selecciona una proteína", "Primero escoge la proteína del almuerzo para continuar.");
      return;
    }
    abrirPaso("acompanantes", itemActivo.id);
  }

  function continuarDesdeAcompanantes() {
    if (!itemActivoSinAcompanantes && acompanantesItemActivo.length === 0) {
      mostrarAviso("Selecciona acompañantes", "Escoge al menos un acompañante o usa la opción Con todo.");
      return;
    }
    abrirPaso("datos", itemActivo?.id);
  }

  function continuarDesdeDatos() {
    if (!modoLlevar && !mesaLocal.trim()) {
      mostrarAviso("Falta la mesa", "Selecciona la mesa o marca el pedido como Llevar.");
      return;
    }

    if (!meseroLocal.trim()) {
      mostrarAviso("Falta el mesero", "Selecciona el mesero responsable del pedido.");
      return;
    }

    if (tipoPagoMesa === FORMA_PAGO_CREDITO && !clientePedido.trim()) {
      mostrarAviso("Cliente obligatorio", "Para pago a crédito debes escribir el nombre del cliente.");
      return;
    }

    setPasoModal(null);
  }

  function agregarOtroAlmuerzo() {
    const nuevoItem = crearItemAlmuerzoBeta();
    setItemsMesa((actual) => [...actual, nuevoItem]);
    setItemActivoId(nuevoItem.id);
    abrirPaso("proteina", nuevoItem.id);
  }

  function reiniciarPrueba() {
    const nuevoItem = crearItemAlmuerzoBeta();
    setItemsMesa([nuevoItem]);
    setItemActivoId(nuevoItem.id);
    setMesaLocal("");
    setModoLlevar(false);
    setClientePedido("");
    setTelefonoLlevar("");
    setUbicacionLlevar("");
    setMeseroLocal("");
    setTipoPagoMesa(FORMAS_PAGO_MESA[0]);
    setObservacionesLocal("");
    setPasoModal("proteina");
  }

  function finalizarPruebaVisual() {
    mostrarAlertaRafiki({
      tipo: "info",
      titulo: "Pedido visual listo",
      mensaje: "Esta es una beta visual. No se guardó el pedido, no se imprimió y no se envió a cocina.",
      textoCerrar: "Entendido"
    });
  }

  function seleccionarMesaLocal(mesa) {
    if (!modoLlevar && mesaLocal === mesa) {
      setMesaLocal("");
      return;
    }
    setModoLlevar(false);
    setMesaLocal(mesa);
  }

  function alternarModoLlevar() {
    if (modoLlevar) {
      setModoLlevar(false);
      return;
    }
    setModoLlevar(true);
    setMesaLocal("");
  }

  return (
    <>
      <main className="order-layout mesas-cliente-layout mesas-panel-layout mesas-beta-layout">
        <section className="card card-pad mesas-beta-home">
          <div className="mesas-beta-banner">
            <span>Modo prueba visual</span>
            <strong>/mesas-beta</strong>
            <p>No guarda pedidos, no imprime y no afecta Caja, Cartera ni Pedidos Hoy.</p>
          </div>

          <div className="mesa-panel-title mesas-beta-title">
            <div>
              <h2>🍽️ Mesas Beta</h2>
              <p className="muted">Nuevo flujo por ventanas modales para probar almuerzos antes de moverlo a la versión oficial.</p>
            </div>
          </div>

          <div className="mesas-beta-steps" aria-label="Pasos del pedido beta">
            {PASOS_BETA.map((paso) => {
              const activo = pasoModal === paso.id;
              const completado = paso.numero === 1
                ? Boolean(itemActivo?.plato || itemActivo?.proteina || hayResumen)
                : paso.numero === 2
                  ? Boolean(hayResumen && (itemActivoSinAcompanantes || acompanantesItemActivo.length > 0))
                  : paso.numero === 3
                    ? Boolean((modoLlevar || mesaLocal) && meseroLocal)
                    : hayResumen;

              return (
                <button
                  key={paso.id}
                  type="button"
                  className={["mesas-beta-step", activo ? "active" : "", completado ? "done" : ""].filter(Boolean).join(" ")}
                  onClick={() => abrirPaso(paso.id)}
                >
                  <span>{paso.numero}</span>
                  <strong>{paso.titulo}</strong>
                </button>
              );
            })}
          </div>

          <div className="mesas-beta-actions">
            <button type="button" className="button" onClick={() => abrirPaso("proteina")}>Iniciar prueba de almuerzo</button>
            <button type="button" className="button light" onClick={reiniciarPrueba}>Reiniciar prueba</button>
            {onSalirBeta && <button type="button" className="mini-btn" onClick={onSalirBeta}>Volver a /mesas oficial</button>}
          </div>
        </section>

        <aside className="card card-pad mesas-beta-preview">
          <h2>Resumen del pedido</h2>
          {!hayResumen ? (
            <div className="box soft"><strong>Empieza seleccionando una proteína.</strong></div>
          ) : (
            <>
              <div className="box soft mesas-beta-datos-resumen">
                <strong>{modoLlevar ? "Pedido para llevar" : `Mesa ${mesaLocal || "sin seleccionar"}`}</strong>
                <span>Mesero: {meseroLocal || "sin seleccionar"}</span>
                <span>Pago: {tipoPagoMesa}</span>
                {clientePedido ? <span>Cliente: {clientePedido}</span> : null}
              </div>

              {gruposResumenMesa.map((grupo) => (
                <ResumenPedidoItem
                  key={grupo.key}
                  grupo={grupo}
                  className="mesas-beta-preview-item"
                  onBorrar={(ids) => quitarGrupoPedidoMesa(ids)}
                  onCambiarCantidad={(ids, cantidad) => actualizarCantidadGrupoMesa(ids, cantidad)}
                  onEditarProteina={(grupoActual) => setGrupoEditandoProteinaMesa(grupoActual)}
                  onEditarAcompanantes={(grupoActual) => setGrupoEditandoAcompanantesMesa(grupoActual)}
                  mostrarTextoParaLlevar={false}
                />
              ))}

              <div className="total-row mesas-beta-total"><span>Total visual</span><strong>{dinero(total)}</strong></div>
              <div className="mesas-beta-actions resumen-actions-inline">
                <button type="button" className="button light" onClick={agregarOtroAlmuerzo}>+ Agregar otro almuerzo</button>
                <button type="button" className="button light" onClick={() => abrirPaso("datos")}>Editar datos</button>
                <button type="button" className="button" onClick={finalizarPruebaVisual}>Finalizar prueba visual</button>
              </div>
            </>
          )}
        </aside>
      </main>

      <RafikiModal
        open={Boolean(pasoActual)}
        title={pasoActual ? `${pasoActual.numero}. ${pasoActual.titulo}` : "Mesas Beta"}
        description="Flujo visual de prueba: nada se guarda en la base oficial."
        onClose={() => setPasoModal(null)}
        size="lg"
        className="mesas-beta-modal"
        footer={(
          <>
            <button type="button" className="button light" onClick={() => setPasoModal(null)}>Cerrar</button>
            {pasoModal === "proteina" && <button type="button" className="button" onClick={continuarDesdeProteina}>Continuar a acompañantes</button>}
            {pasoModal === "acompanantes" && <button type="button" className="button" onClick={continuarDesdeAcompanantes}>Continuar a datos de mesa</button>}
            {pasoModal === "datos" && <button type="button" className="button" onClick={continuarDesdeDatos}>Guardar datos y ver resumen</button>}
          </>
        )}
      >
        <div className="mesas-beta-modal-progress">
          {PASOS_BETA.map((paso) => (
            <span key={paso.id} className={obtenerPasoIndice(pasoModal) >= obtenerPasoIndice(paso.id) ? "active" : ""}>{paso.numero}</span>
          ))}
        </div>

        {pasoModal === "proteina" && (
          <div className="mesas-beta-modal-section">
            {cargandoMenu ? (
              <div className="box soft">Cargando menú diario...</div>
            ) : Object.keys(platosAgrupados || {}).length === 0 ? (
              <div className="box soft">No hay menú diario configurado.</div>
            ) : (
              Object.entries(platosAgrupados).map(([categoria, platos]) => (
                <div key={categoria} className="category-block">
                  <h3 className="category-title">{categoria}</h3>
                  <div className="option-grid">
                    {platos.map((plato) => (
                      <button
                        key={`${plato.categoria}-${plato.nombre}`}
                        type="button"
                        onClick={() => cambiarPlatoMesa(plato)}
                        className={`option ${itemActivo?.plato === plato.nombre ? "selected" : ""}`}
                      >
                        <div>{plato.nombre}</div>
                        <small>{dinero(plato.precio)}</small>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {pasoModal === "acompanantes" && (
          <div className="mesas-beta-modal-section">
            {itemActivo?.plato || itemActivo?.proteina ? (
              <div className="selected-dish pos-selected-dish">
                <span>✓ {obtenerNombreItem(itemActivo)}</span>
                <strong>{dinero(itemActivo.precioPlato || itemActivo.precioProteina || itemActivo.precio)}</strong>
              </div>
            ) : (
              <div className="box soft">Primero selecciona una proteína.</div>
            )}

            {itemActivoSinAcompanantes ? (
              <div className="box soft"><strong>{MENSAJE_ACOMPANANTES_DEL_DIA}</strong></div>
            ) : (
              <>
                <div className="resumen-acompanantes-contador">
                  <strong>{acompanantesItemActivo.length}/{MAX_ACOMPANANTES_CLIENTE} acompañantes</strong>
                  <span>Selecciona hasta {MAX_ACOMPANANTES_CLIENTE}</span>
                </div>
                <div className="chips resumen-acompanantes-chips">
                  {acompanantesDisponibles.map((acompanante) => {
                    const seleccionado = acompanantesItemActivo.includes(acompanante);
                    const bloqueado = !seleccionado && acompanantesItemActivo.length >= MAX_ACOMPANANTES_CLIENTE;
                    return (
                      <button
                        key={acompanante}
                        type="button"
                        onClick={() => cambiarAcompananteMesa(acompanante)}
                        disabled={bloqueado}
                        className={`chip ${seleccionado ? "selected" : ""} ${bloqueado ? "blocked" : ""}`}
                      >
                        {seleccionado ? "✓ " : "+ "}{acompanante}
                      </button>
                    );
                  })}
                </div>
                <CampoTexto
                  etiqueta="Observación sobre acompañantes"
                  value={itemActivo?.observacionAcompanantes || ""}
                  onChange={(valor) => actualizarItemMesa(itemActivo.id, { observacionAcompanantes: valor.slice(0, 60) })}
                  placeholder="Ejemplo: sin ensalada, más arroz..."
                  multiline
                  rows={2}
                  maxLength={60}
                />
              </>
            )}
          </div>
        )}

        {pasoModal === "datos" && (
          <div className="mesas-beta-modal-section">
            <div className="mesa-datos-grid mesas-beta-datos-grid">
              <div className="mesa-dato-bloque">
                <h4>🍽️ Mesa o llevar <span className="requerido">*</span></h4>
                <div className={`mesa-selector-grid ${modoLlevar ? "llevar-activo" : ""}`} aria-label="Seleccionar mesa o llevar">
                  {MESAS_DISPONIBLES.map((mesa) => (
                    <button
                      key={mesa}
                      type="button"
                      onClick={() => seleccionarMesaLocal(mesa)}
                      className={`option mesa-boton ${mesa === "5B" ? "mesa-5b" : ""} ${!modoLlevar && mesaLocal === mesa ? "selected" : ""}`}
                    >
                      {mesa}
                    </button>
                  ))}
                  <button type="button" onClick={alternarModoLlevar} className={`option mesa-boton mesa-llevar ${modoLlevar ? "selected" : ""}`}>Llevar</button>
                </div>
              </div>

              <div className="mesa-dato-bloque">
                <h4>👤 Mesero <span className="requerido">*</span></h4>
                <div className="chips">
                  {MESEROS_DISPONIBLES.map((mesero) => (
                    <button key={mesero} type="button" onClick={() => setMeseroLocal(mesero)} className={`chip ${meseroLocal === mesero ? "selected" : ""}`}>
                      {meseroLocal === mesero ? "✓ " : ""}{mesero}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mesa-dato-bloque">
                <h4>💳 Forma de pago</h4>
                <div className="chips">
                  {FORMAS_PAGO_MESA.map((pago) => (
                    <button key={pago} type="button" onClick={() => setTipoPagoMesa(pago)} className={`chip ${tipoPagoMesa === pago ? "selected" : ""}`}>
                      {tipoPagoMesa === pago ? "✓ " : ""}{pago}
                    </button>
                  ))}
                </div>
              </div>

              <label className="field" id="mesa-beta-cliente-credito">
                <span>Cliente {tipoPagoMesa === FORMA_PAGO_CREDITO ? <span className="requerido">*</span> : "(opcional)"}</span>
                <input
                  type="text"
                  value={clientePedido}
                  onChange={(event) => setClientePedido(event.target.value)}
                  placeholder={tipoPagoMesa === FORMA_PAGO_CREDITO ? "Nombre del cliente de crédito" : "Ej: Sra. Inés, Juan Pérez..."}
                />
              </label>

              {modoLlevar && (
                <>
                  <CampoTexto etiqueta="Teléfono" value={telefonoLlevar} onChange={setTelefonoLlevar} placeholder="Número de contacto" type="tel" />
                  <CampoTexto etiqueta="Ubicación" value={ubicacionLlevar} onChange={setUbicacionLlevar} placeholder="Dirección o referencia" />
                </>
              )}

              <CampoTexto
                etiqueta="Observaciones generales"
                value={observacionesLocal}
                onChange={setObservacionesLocal}
                placeholder="Ej: sin cubiertos, mesa espera bebida..."
                multiline
              />
            </div>
          </div>
        )}

      </RafikiModal>

      <EditarProteinaResumenModal
        abierto={Boolean(grupoEditandoProteinaMesa)}
        grupo={grupoEditandoProteinaMesa}
        platosAgrupados={platosAgrupados}
        onCerrar={() => setGrupoEditandoProteinaMesa(null)}
        onGuardar={actualizarProteinaGrupoMesa}
      />

      <EditarAcompanantesResumenModal
        abierto={Boolean(grupoEditandoAcompanantesMesa)}
        grupo={grupoEditandoAcompanantesMesa}
        acompanantesDisponibles={acompanantesDisponibles}
        maxAcompanantes={MAX_ACOMPANANTES_CLIENTE}
        minimoAcompanantes={1}
        exigirMinimo={false}
        onCerrar={() => setGrupoEditandoAcompanantesMesa(null)}
        onGuardar={actualizarAcompanantesGrupoMesa}
      />

      {modalAlertaRafiki}
    </>
  );
}
