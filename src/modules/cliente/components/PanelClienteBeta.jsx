import React, { useMemo, useState } from "react";
import { CampoTexto, useAlertaRafiki } from "../../../shared/components/common";
import RafikiModal from "../../../shared/components/RafikiModal";
import EditarAcompanantesResumenModal from "../../../shared/components/EditarAcompanantesResumenModal";
import EditarProteinaResumenModal from "../../../shared/components/EditarProteinaResumenModal";
import ResumenPedidoItem from "../../../shared/components/ResumenPedidoItem";
import { MAX_ACOMPANANTES_CLIENTE } from "../../../data/menuAlmuerzos";
import {
  calcularTotalItems,
  crearItemNuevo,
  dinero,
  esProductoSinAcompanantes,
  MENSAJE_ACOMPANANTES_DEL_DIA
} from "../../../shared/utils/pedidos";
import {
  agruparItemsResumenPedido,
  normalizarCantidadResumen
} from "../../../shared/utils/resumenPedido";
import { FORMAS_PAGO_CLIENTE } from "../../../shared/constants/paymentMethods";

const PASOS_CLIENTE_BETA = [
  { id: "proteina", numero: 1, titulo: "Selecciona tu proteína aquí" },
  { id: "acompanantes", numero: 2, titulo: "Selecciona tu acompañante" },
  { id: "datos", numero: 3, titulo: "Datos del cliente" }
];

function crearItemClienteBeta({ comerRestaurante = false } = {}) {
  return {
    ...crearItemNuevo(),
    categoria: "",
    cantidad: 1,
    paraLlevar: !comerRestaurante
  };
}

function obtenerNombreItem(item = {}) {
  return item.producto || item.plato || item.proteina || "Producto";
}

function obtenerPasoIndice(paso) {
  return Math.max(0, PASOS_CLIENTE_BETA.findIndex((item) => item.id === paso));
}

export default function PanelClienteBeta({ menu, platosAgrupados, cargandoMenu = false, onSalirBeta }) {
  const [mostrarAlertaRafiki, modalAlertaRafiki] = useAlertaRafiki();
  const [itemsCliente, setItemsCliente] = useState([crearItemClienteBeta()]);
  const [itemActivoId, setItemActivoId] = useState(null);
  const [pasoModal, setPasoModal] = useState(null);
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [comerRestaurante, setComerRestaurante] = useState(false);
  const [tipoPago, setTipoPago] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [grupoEditandoAcompanantes, setGrupoEditandoAcompanantes] = useState(null);
  const [grupoEditandoProteina, setGrupoEditandoProteina] = useState(null);

  const itemsConProducto = useMemo(
    () => itemsCliente.filter((item) => item.plato || item.proteina || item.producto),
    [itemsCliente]
  );

  const total = useMemo(() => calcularTotalItems(itemsConProducto), [itemsConProducto]);
  const gruposResumen = useMemo(() => agruparItemsResumenPedido(itemsConProducto), [itemsConProducto]);
  const acompanantesDisponibles = useMemo(
    () => (Array.isArray(menu?.acompanantes) ? menu.acompanantes : []),
    [menu?.acompanantes]
  );

  const itemActivo = useMemo(() => {
    const actual = itemsCliente.find((item) => item.id === itemActivoId);
    if (actual) return actual;
    return itemsCliente[itemsCliente.length - 1] || null;
  }, [itemsCliente, itemActivoId]);

  const pasoActual = PASOS_CLIENTE_BETA.find((paso) => paso.id === pasoModal) || null;
  const itemActivoSinAcompanantes = itemActivo ? esProductoSinAcompanantes(itemActivo) : false;
  const acompanantesItemActivo = Array.isArray(itemActivo?.acompanantes) ? itemActivo.acompanantes : [];
  const hayResumen = gruposResumen.length > 0;

  function mostrarAviso(titulo, mensaje, tipo = "advertencia") {
    mostrarAlertaRafiki({ tipo, titulo, mensaje, textoCerrar: "Entendido" });
  }

  function abrirPaso(paso, itemId = itemActivo?.id) {
    if (itemId) setItemActivoId(itemId);
    setPasoModal(paso);
  }

  function actualizarItemCliente(id, cambios) {
    setItemsCliente((actual) =>
      actual.map((item) => (item.id === id ? { ...item, ...cambios } : item))
    );
  }

  function cambiarPlatoCliente(platoSeleccionado) {
    if (!itemActivo?.id) return;

    const sinAcompanantes = esProductoSinAcompanantes(platoSeleccionado);

    actualizarItemCliente(itemActivo.id, {
      categoria: platoSeleccionado.categoria || "",
      plato: platoSeleccionado.nombre || "",
      proteina: platoSeleccionado.nombre || "",
      precioPlato: Number(platoSeleccionado.precio) || 0,
      precioProteina: Number(platoSeleccionado.precio) || 0,
      acompanantes: sinAcompanantes ? [] : itemActivo.acompanantes || [],
      observacionAcompanantes: sinAcompanantes ? "" : itemActivo.observacionAcompanantes || "",
      paraLlevar: !comerRestaurante
    });
  }

  function cambiarAcompananteCliente(acompanante) {
    if (!itemActivo?.id || itemActivoSinAcompanantes) return;

    setItemsCliente((actual) =>
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

  function actualizarCantidadGrupo(ids = [], cantidad) {
    const idsGrupo = new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean));
    if (idsGrupo.size === 0) return;
    const cantidadNormalizada = normalizarCantidadResumen(cantidad);

    setItemsCliente((actual) => {
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

      return siguientesItems.length > 0 ? siguientesItems : [crearItemClienteBeta({ comerRestaurante })];
    });
  }

  function quitarGrupoPedido(ids = []) {
    const idsGrupo = new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean));
    if (idsGrupo.size === 0) return;

    setItemsCliente((actual) => {
      const filtrados = actual.filter((item) => !idsGrupo.has(item.id));
      const siguiente = filtrados.length > 0 ? filtrados : [crearItemClienteBeta({ comerRestaurante })];
      setItemActivoId(siguiente[siguiente.length - 1]?.id || null);
      return siguiente;
    });
  }

  function actualizarProteinaGrupo(ids = [], platoSeleccionado = {}) {
    const idsGrupo = new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean));
    if (idsGrupo.size === 0 || !platoSeleccionado?.nombre) return;

    const sinAcompanantes = esProductoSinAcompanantes(platoSeleccionado);

    setItemsCliente((actual) =>
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
          paraLlevar: !comerRestaurante
        };
      })
    );
  }

  function actualizarAcompanantesGrupo(ids = [], cambios = {}) {
    const idsGrupo = new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean));
    if (idsGrupo.size === 0) return;
    const acompanantes = Array.isArray(cambios.acompanantes) ? cambios.acompanantes : [];
    const observacionAcompanantes = String(cambios.observacionAcompanantes || "").trim().slice(0, 60);

    setItemsCliente((actual) =>
      actual.map((item) => {
        if (!idsGrupo.has(item.id)) return item;
        if (esProductoSinAcompanantes(item)) return { ...item, acompanantes: [], observacionAcompanantes: "" };
        return { ...item, acompanantes, observacionAcompanantes };
      })
    );
  }

  function cambiarComerRestaurante(marcado) {
    setComerRestaurante(marcado);
    setItemsCliente((actual) =>
      actual.map((item) => ({ ...item, paraLlevar: !marcado }))
    );
  }

  function obtenerItemsConAcompanantesIncompletos() {
    return itemsConProducto
      .filter((item) => !esProductoSinAcompanantes(item))
      .filter((item) => !Array.isArray(item.acompanantes) || item.acompanantes.length < 2);
  }

  function validarAcompanantesCliente({ enfocar = false } = {}) {
    const incompletos = obtenerItemsConAcompanantesIncompletos();
    if (incompletos.length === 0) return true;

    const primerItem = incompletos[0];
    mostrarAviso(
      "Faltan acompañantes",
      `Debes seleccionar mínimo 2 acompañantes para ${obtenerNombreItem(primerItem)} antes de finalizar la prueba.`
    );

    if (enfocar && primerItem?.id) {
      setItemActivoId(primerItem.id);
      setPasoModal("acompanantes");
    }

    return false;
  }

  function continuarDesdeProteina() {
    if (!itemActivo?.plato && !itemActivo?.proteina) {
      mostrarAviso("Selecciona una proteína", "Primero escoge la proteína del almuerzo para continuar.");
      return;
    }
    abrirPaso("acompanantes", itemActivo.id);
  }

  function continuarDesdeAcompanantes() {
    if (!itemActivoSinAcompanantes && acompanantesItemActivo.length < 2) {
      mostrarAviso("Faltan acompañantes", "Para cliente público debes seleccionar mínimo 2 acompañantes.");
      return;
    }
    abrirPaso("datos", itemActivo?.id);
  }

  function continuarDesdeDatos() {
    if (!cliente.trim()) {
      mostrarAviso("Falta el nombre", "Escribe el nombre del cliente para continuar.");
      return;
    }

    if (!telefono.trim()) {
      mostrarAviso("Falta el teléfono", "Escribe el teléfono del cliente para continuar.");
      return;
    }

    if (!comerRestaurante && !ubicacion.trim()) {
      mostrarAviso("Falta la ubicación", "Escribe la ubicación de entrega o marca comer en restaurante.");
      return;
    }

    if (!tipoPago) {
      mostrarAviso("Falta la forma de pago", "Selecciona la forma de pago del pedido.");
      return;
    }

    setPasoModal(null);
  }

  function agregarOtroAlmuerzo() {
    const nuevoItem = crearItemClienteBeta({ comerRestaurante });
    setItemsCliente((actual) => [...actual, nuevoItem]);
    setItemActivoId(nuevoItem.id);
    abrirPaso("proteina", nuevoItem.id);
  }

  function reiniciarPrueba() {
    const nuevoItem = crearItemClienteBeta();
    setItemsCliente([nuevoItem]);
    setItemActivoId(nuevoItem.id);
    setCliente("");
    setTelefono("");
    setUbicacion("");
    setComerRestaurante(false);
    setTipoPago("");
    setObservaciones("");
    setPasoModal("proteina");
  }

  function finalizarPruebaVisual() {
    if (itemsConProducto.length === 0) {
      mostrarAviso("Pedido vacío", "Agrega al menos un almuerzo para revisar la prueba.");
      return;
    }

    if (!validarAcompanantesCliente({ enfocar: true })) return;

    if (!cliente.trim() || !telefono.trim() || (!comerRestaurante && !ubicacion.trim()) || !tipoPago) {
      abrirPaso("datos");
      mostrarAviso("Completa los datos", "Antes de finalizar la prueba visual, completa los datos del cliente.");
      return;
    }

    mostrarAlertaRafiki({
      tipo: "info",
      titulo: "Pedido visual listo",
      mensaje: "Esta es una beta visual de /cliente. No se guardó el pedido, no se imprimió y no se envió a cocina.",
      textoCerrar: "Entendido"
    });
  }

  return (
    <>
      <main className="order-layout mesas-cliente-layout cliente-beta-layout mesas-beta-layout">
        <section className="card card-pad mesas-beta-home cliente-beta-home">
          <div className="mesas-beta-banner cliente-beta-banner">
            <span>Modo prueba visual</span>
            <strong>/cliente-beta</strong>
            <p>No guarda pedidos, no imprime y no afecta Caja, Cartera ni Pedidos Hoy.</p>
          </div>

          <div className="mesa-panel-title mesas-beta-title">
            <div>
              <h2>🛍️ Cliente Beta</h2>
              <p className="muted">Nuevo flujo por ventanas modales para probar el pedido público antes de moverlo a /cliente oficial.</p>
            </div>
          </div>

          <div className="box soft u-mb-12">
            <strong>Pedido para llevar por defecto</strong>
            <p className="muted u-mb-0">Solo deja de cobrar el adicional si el cliente marca explícitamente “comer en restaurante”.</p>
          </div>

          <div className="mesas-beta-steps" aria-label="Pasos del pedido cliente beta">
            {PASOS_CLIENTE_BETA.map((paso) => {
              const activo = pasoModal === paso.id;
              const completado = paso.numero === 1
                ? Boolean(itemActivo?.plato || itemActivo?.proteina || hayResumen)
                : paso.numero === 2
                  ? Boolean(hayResumen && (itemActivoSinAcompanantes || acompanantesItemActivo.length >= 2))
                  : Boolean(cliente && telefono && (comerRestaurante || ubicacion) && tipoPago);

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
            <button type="button" className="button" onClick={() => abrirPaso("proteina")}>Iniciar prueba de pedido</button>
            <button type="button" className="button light" onClick={reiniciarPrueba}>Reiniciar prueba</button>
            {onSalirBeta && <button type="button" className="mini-btn" onClick={onSalirBeta}>Volver a /cliente oficial</button>}
          </div>
        </section>

        <aside className="card card-pad mesas-beta-preview cliente-beta-preview">
          <h2>Resumen del pedido</h2>
          {!hayResumen ? (
            <div className="box soft">
              <strong>Empieza seleccionando una proteína.</strong>
              <p className="muted u-mb-0">Aquí verás el pedido agrupado, cantidades, acompañantes y total visual.</p>
            </div>
          ) : (
            <>
              <div className="box soft mesas-beta-datos-resumen">
                <strong>{comerRestaurante ? "Comer en restaurante" : "Pedido para llevar"}</strong>
                <span>Cliente: {cliente || "sin nombre"}</span>
                <span>Teléfono: {telefono || "sin teléfono"}</span>
                <span>Ubicación: {comerRestaurante ? "Comer en restaurante" : ubicacion || "sin ubicación"}</span>
                <span>Pago: {tipoPago || "sin seleccionar"}</span>
              </div>

              {gruposResumen.map((grupo) => (
                <ResumenPedidoItem
                  key={grupo.key}
                  grupo={grupo}
                  className="mesas-beta-preview-item"
                  onBorrar={(ids) => quitarGrupoPedido(ids)}
                  onCambiarCantidad={(ids, cantidad) => actualizarCantidadGrupo(ids, cantidad)}
                  onEditarProteina={(grupoActual) => setGrupoEditandoProteina(grupoActual)}
                  onEditarAcompanantes={(grupoActual) => setGrupoEditandoAcompanantes(grupoActual)}
                  mostrarAdicionalLlevar
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
        title={pasoActual ? `${pasoActual.numero}. ${pasoActual.titulo}` : "Cliente Beta"}
        description="Flujo visual de prueba: nada se guarda en la base oficial."
        onClose={() => setPasoModal(null)}
        size="lg"
        className="mesas-beta-modal cliente-beta-modal"
        footer={(
          <>
            <button type="button" className="button light" onClick={() => setPasoModal(null)}>Cerrar</button>
            {pasoModal === "proteina" && <button type="button" className="button" onClick={continuarDesdeProteina}>Continuar a acompañantes</button>}
            {pasoModal === "acompanantes" && <button type="button" className="button" onClick={continuarDesdeAcompanantes}>Continuar a datos</button>}
            {pasoModal === "datos" && <button type="button" className="button" onClick={continuarDesdeDatos}>Guardar datos y ver resumen</button>}
          </>
        )}
      >
        <div className="mesas-beta-modal-progress">
          {PASOS_CLIENTE_BETA.map((paso) => (
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
                        onClick={() => cambiarPlatoCliente(plato)}
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
                  <span>Selecciona mínimo 2 y máximo {MAX_ACOMPANANTES_CLIENTE}</span>
                </div>
                <div className="chips resumen-acompanantes-chips">
                  {acompanantesDisponibles.map((acompanante) => {
                    const seleccionado = acompanantesItemActivo.includes(acompanante);
                    const bloqueado = !seleccionado && acompanantesItemActivo.length >= MAX_ACOMPANANTES_CLIENTE;
                    return (
                      <button
                        key={acompanante}
                        type="button"
                        onClick={() => cambiarAcompananteCliente(acompanante)}
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
                  onChange={(valor) => actualizarItemCliente(itemActivo.id, { observacionAcompanantes: valor.slice(0, 60) })}
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
            <div className="mesa-datos-grid mesas-beta-datos-grid cliente-beta-datos-grid">
              <CampoTexto etiqueta="👤 Nombre" value={cliente} onChange={setCliente} placeholder="Ej: Laura Pérez" />
              <CampoTexto etiqueta="📞 Teléfono" value={telefono} onChange={setTelefono} placeholder="Ej: 300 123 4567" type="tel" />

              <label className="field cliente-restaurante-toggle">
                <span>🍽️ Comer en el restaurante</span>
                <label className="inline-check cliente-restaurante-check">
                  <input
                    type="checkbox"
                    checked={comerRestaurante}
                    onChange={(event) => cambiarComerRestaurante(event.target.checked)}
                  />
                  <span>Registrar este pedido para comer en el restaurante</span>
                </label>
                {comerRestaurante ? (
                  <small className="muted">En la versión oficial se guarda internamente como “Comer en restaurante” y sin recargo de para llevar.</small>
                ) : (
                  <small className="muted">Por defecto, el pedido público es para llevar y aplica el adicional correspondiente.</small>
                )}
              </label>

              <CampoTexto
                etiqueta="📍 Ubicación"
                value={comerRestaurante ? "Comer en restaurante" : ubicacion}
                onChange={(valor) => {
                  if (comerRestaurante) cambiarComerRestaurante(false);
                  setUbicacion(valor);
                }}
                placeholder="Ej: Edificio, oficina o barrio"
              />

              <label className="field">
                <span>💳 Tipo de pago</span>
                <select value={tipoPago} onChange={(event) => setTipoPago(event.target.value)}>
                  <option value="">Selecciona una forma de pago</option>
                  {FORMAS_PAGO_CLIENTE.map((metodo) => (
                    <option key={metodo} value={metodo}>{metodo}</option>
                  ))}
                </select>
              </label>

              <CampoTexto
                etiqueta="Observaciones generales"
                value={observaciones}
                onChange={(valor) => setObservaciones(valor.slice(0, 80))}
                placeholder="Ej: llevar a recepción, sin cubiertos, pago en efectivo..."
                multiline
                maxLength={80}
              />
            </div>
          </div>
        )}
      </RafikiModal>

      <EditarProteinaResumenModal
        abierto={Boolean(grupoEditandoProteina)}
        grupo={grupoEditandoProteina}
        platosAgrupados={platosAgrupados}
        onCerrar={() => setGrupoEditandoProteina(null)}
        onGuardar={actualizarProteinaGrupo}
      />

      <EditarAcompanantesResumenModal
        abierto={Boolean(grupoEditandoAcompanantes)}
        grupo={grupoEditandoAcompanantes}
        acompanantesDisponibles={acompanantesDisponibles}
        maxAcompanantes={MAX_ACOMPANANTES_CLIENTE}
        minimoAcompanantes={2}
        exigirMinimo
        onCerrar={() => setGrupoEditandoAcompanantes(null)}
        onGuardar={actualizarAcompanantesGrupo}
      />

      {modalAlertaRafiki}
    </>
  );
}
