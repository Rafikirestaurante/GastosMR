import React, { useCallback } from "react";
import { CampoTexto } from "../../../../shared/components/common";
import { fechaISOColombia } from "../../../../shared/utils/pedidos";

function AdminPedidosFiltrosBase({
  filtroPedidos,
  setFiltroPedidos,
  fechaSeleccionada,
  setFechaSeleccionada,
  fechaInicioRangoPedidos,
  setFechaInicioRangoPedidos,
  fechaFinRangoPedidos,
  setFechaFinRangoPedidos,
  hayBusquedaPedidos,
  setBusqueda,
  busqueda,
  busquedaNumeroPedido = "",
  setBusquedaNumeroPedido,
  buscarPedidoPorNumeroGlobal,
  limpiarBusquedaNumeroPedido,
  cargandoNumeroPedido = false,
}) {
  const seleccionarHoy = useCallback(() => {
    const hoy = fechaISOColombia();
    setFiltroPedidos("hoy");
    setFechaSeleccionada(hoy);
    setFechaInicioRangoPedidos?.(hoy);
    setFechaFinRangoPedidos?.(hoy);
  }, [setFiltroPedidos, setFechaSeleccionada, setFechaInicioRangoPedidos, setFechaFinRangoPedidos]);

  const seleccionarDia = useCallback((e) => {
    const fecha = e.target.value || fechaISOColombia();
    setFechaSeleccionada(fecha);
    setFechaInicioRangoPedidos?.(fecha);
    setFechaFinRangoPedidos?.(fecha);
    setFiltroPedidos("dia");
  }, [setFechaSeleccionada, setFiltroPedidos, setFechaInicioRangoPedidos, setFechaFinRangoPedidos]);

  const seleccionarRango = useCallback(() => {
    setFiltroPedidos("rango");
    const base = fechaSeleccionada || fechaISOColombia();
    setFechaInicioRangoPedidos?.(fechaInicioRangoPedidos || base);
    setFechaFinRangoPedidos?.(fechaFinRangoPedidos || fechaInicioRangoPedidos || base);
  }, [setFiltroPedidos, setFechaInicioRangoPedidos, setFechaFinRangoPedidos, fechaSeleccionada, fechaInicioRangoPedidos, fechaFinRangoPedidos]);

  const cambiarFechaInicioRango = useCallback((event) => {
    const fecha = event.target.value || fechaISOColombia();
    setFechaInicioRangoPedidos?.(fecha);
    setFiltroPedidos("rango");
  }, [setFechaInicioRangoPedidos, setFiltroPedidos]);

  const cambiarFechaFinRango = useCallback((event) => {
    const fecha = event.target.value || fechaISOColombia();
    setFechaFinRangoPedidos?.(fecha);
    setFiltroPedidos("rango");
  }, [setFechaFinRangoPedidos, setFiltroPedidos]);

  const limpiarBusqueda = useCallback(() => {
    setBusqueda("");
  }, [setBusqueda]);

  const cambiarBusquedaNumero = useCallback((valor) => {
    if (setBusquedaNumeroPedido) {
      setBusquedaNumeroPedido(String(valor || "").replace(/\D+/g, ""));
    }
  }, [setBusquedaNumeroPedido]);

  const enviarBusquedaNumero = useCallback((event) => {
    event.preventDefault();
    if (buscarPedidoPorNumeroGlobal) buscarPedidoPorNumeroGlobal();
  }, [buscarPedidoPorNumeroGlobal]);

  return (
    <>
      <div className="filtros-historial filtros-historial-rango">
        <button
          type="button"
          onClick={seleccionarHoy}
          className={filtroPedidos === "hoy" ? "active" : ""}
        >
          Hoy
        </button>

        <label className="calendario-filtro">
          <span>Buscar día</span>
          <input
            type="date"
            value={fechaSeleccionada}
            onChange={seleccionarDia}
          />
        </label>

        <button
          type="button"
          onClick={seleccionarRango}
          className={filtroPedidos === "rango" ? "active" : ""}
        >
          Rango de fechas
        </button>

        {hayBusquedaPedidos && (
          <button type="button" onClick={limpiarBusqueda}>
            Limpiar búsqueda
          </button>
        )}
      </div>

      {filtroPedidos === "rango" && (
        <div className="filtros-rango-fechas">
          <label className="calendario-filtro">
            <span>Desde</span>
            <input
              type="date"
              value={fechaInicioRangoPedidos || fechaISOColombia()}
              onChange={cambiarFechaInicioRango}
            />
          </label>

          <label className="calendario-filtro">
            <span>Hasta</span>
            <input
              type="date"
              value={fechaFinRangoPedidos || fechaInicioRangoPedidos || fechaISOColombia()}
              onChange={cambiarFechaFinRango}
            />
          </label>
        </div>
      )}

      <CampoTexto
        etiqueta="Buscar pedido"
        value={busqueda}
        onChange={setBusqueda}
        placeholder="Buscar por cliente, producto, pago, mesa, estado u observación..."
      />

      <form className="pedido-numero-global" onSubmit={enviarBusquedaNumero}>
        <CampoTexto
          etiqueta="Buscar número de pedido sin fecha"
          value={busquedaNumeroPedido}
          onChange={cambiarBusquedaNumero}
          placeholder="Ej: 1234"
        />
        <div className="pedido-numero-global-actions">
          <button type="submit" className="button light" disabled={cargandoNumeroPedido}>
            {cargandoNumeroPedido ? "Buscando..." : "Buscar número"}
          </button>
          {busquedaNumeroPedido && (
            <button type="button" className="button light" onClick={limpiarBusquedaNumeroPedido} disabled={cargandoNumeroPedido}>
              Limpiar número
            </button>
          )}
        </div>
      </form>
    </>
  );
}

export default React.memo(AdminPedidosFiltrosBase);
