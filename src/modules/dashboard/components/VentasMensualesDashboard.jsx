import React, { useEffect, useMemo, useState } from "react";
import RafikiModal from "../../../shared/components/RafikiModal";
import { dinero } from "../../../shared/utils/pedidos";
import { formatearFechaColombia } from "../../../shared/utils/fechasColombia";
import { describirErrorSupabase, registrarErrorSupabase } from "../../../shared/utils/supabaseErrors";
import { cargarGastosDashboardRango, cargarPedidosDashboardRango } from "../../../services/dashboardService";
import {
  crearResumenVentasMensuales,
  desplazarMes,
  obtenerMesColombia,
  obtenerNivelVentaDia,
  obtenerRangoMesColombia
} from "../utils/ventasMensuales";

function TarjetaMetrica({ etiqueta, valor, ayuda }) {
  return (
    <article className="ventas-mes-metrica">
      <span>{etiqueta}</span>
      <strong>{valor}</strong>
      {ayuda ? <small>{ayuda}</small> : null}
    </article>
  );
}

function CalendarioVentas({ resumen, onSeleccionarDia }) {
  const celdasVacias = Array.from({ length: resumen.offsetInicio }, (_, index) => `vacio-${index}`);

  return (
    <section className="ventas-mes-panel" aria-label={`Calendario de ventas de ${resumen.nombreMes}`}>
      <div className="ventas-mes-panel-heading">
        <div>
          <h4>Calendario de ventas</h4>
          <p>Cada casilla muestra el total vendido y la cantidad de pedidos del día.</p>
        </div>
        <div className="ventas-mes-leyenda" aria-label="Intensidad de ventas">
          <span>Baja</span>
          {[1, 2, 3, 4].map((nivel) => (
            <i key={nivel} className={`nivel-${nivel}`} />
          ))}
          <span>Alta</span>
        </div>
      </div>

      <div className="ventas-calendario-scroll">
        <div className="ventas-calendario">
          {resumen.encabezados.map((dia) => (
            <div key={dia} className="ventas-calendario-dia-semana">
              {dia}
            </div>
          ))}

          {celdasVacias.map((clave) => (
            <div key={clave} className="ventas-calendario-vacio" aria-hidden="true" />
          ))}

          {resumen.dias.map((dia) => {
            const nivel = obtenerNivelVentaDia(dia.total, resumen.maximoDiario);
            const esMejorDia = resumen.mejorDia?.fecha === dia.fecha && dia.total > 0;
            return (
              <button
                key={dia.fecha}
                type="button"
                className={`ventas-calendario-celda nivel-${nivel}${esMejorDia ? " es-mejor-dia" : ""}`}
                onClick={() => onSeleccionarDia(dia)}
                aria-label={`${formatearFechaColombia(dia.fecha)}: ${dinero(dia.total)}, ${dia.pedidos} pedidos`}
              >
                <span className="ventas-calendario-numero">{dia.dia}</span>
                {esMejorDia ? <span className="ventas-calendario-mejor">★ Mejor</span> : null}
                <strong>{dinero(dia.total)}</strong>
                <small>
                  {dia.pedidos} {dia.pedidos === 1 ? "pedido" : "pedidos"}
                </small>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const FORMATO_ENTERO = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const FORMATO_COMPACTO = new Intl.NumberFormat("es-CO", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1
});

function dineroCompacto(valor) {
  const numero = Math.max(Number(valor) || 0, 0);
  return `$${FORMATO_COMPACTO.format(numero)}`;
}

function promedioTicketDiario(resumen) {
  const diasActivos = resumen.dias.filter((dia) => dia.pedidos > 0);
  if (diasActivos.length === 0) return 0;
  return Math.round(diasActivos.reduce((suma, dia) => suma + dia.ticketPromedio, 0) / diasActivos.length);
}

const METRICAS_BARRAS = {
  ventas: {
    etiqueta: "Ventas",
    descripcion: "Compara el total vendido cada día.",
    campo: "total",
    etiquetaPrincipal: "Ventas acumuladas",
    valorPrincipal: (resumen) => resumen.totalMes,
    etiquetaPromedio: "Promedio diario",
    valorPromedio: (resumen) => resumen.promedioDiario,
    formatear: dinero,
    formatearBarra: dineroCompacto
  },
  pedidos: {
    etiqueta: "Pedidos",
    descripcion: "Compara la cantidad de pedidos registrados cada día.",
    campo: "pedidos",
    etiquetaPrincipal: "Pedidos acumulados",
    valorPrincipal: (resumen) => resumen.totalPedidos,
    etiquetaPromedio: "Promedio por día activo",
    valorPromedio: (resumen) =>
      resumen.diasConVenta > 0 ? Math.round(resumen.totalPedidos / resumen.diasConVenta) : 0,
    formatear: (valor) => `${FORMATO_ENTERO.format(valor)} ${Number(valor) === 1 ? "pedido" : "pedidos"}`,
    formatearBarra: (valor) => FORMATO_ENTERO.format(valor)
  },
  ticket: {
    etiqueta: "Ticket promedio",
    descripcion: "Compara cuánto gastó en promedio cada pedido del día.",
    campo: "ticketPromedio",
    etiquetaPrincipal: "Ticket promedio mensual",
    valorPrincipal: (resumen) => resumen.ticketPromedio,
    etiquetaPromedio: "Promedio de tickets diarios",
    valorPromedio: promedioTicketDiario,
    formatear: dinero,
    formatearBarra: dineroCompacto
  }
};

function obtenerMejorDiaMetrica(dias, campo) {
  return dias.reduce((mejor, dia) => {
    const valor = Math.max(Number(dia?.[campo]) || 0, 0);
    if (valor <= 0) return mejor;
    if (!mejor) return dia;
    const valorMejor = Math.max(Number(mejor?.[campo]) || 0, 0);
    if (valor > valorMejor) return dia;
    if (valor === valorMejor && dia.total > mejor.total) return dia;
    return mejor;
  }, null);
}

function GraficaBarrasVentas({ resumen, onSeleccionarDia }) {
  const [metrica, setMetrica] = useState("ventas");
  const configuracion = METRICAS_BARRAS[metrica];
  const mejorDia = useMemo(
    () => obtenerMejorDiaMetrica(resumen.dias, configuracion.campo),
    [resumen.dias, configuracion.campo]
  );
  const maximo = Math.max(
    ...resumen.dias.map((dia) => Math.max(Number(dia?.[configuracion.campo]) || 0, 0)),
    1
  );
  const principal = configuracion.valorPrincipal(resumen);
  const promedio = configuracion.valorPromedio(resumen);
  const mayor = mejorDia ? mejorDia[configuracion.campo] : 0;

  return (
    <section
      className="ventas-mes-panel ventas-barras-panel"
      aria-label={`Gráfica de barras de ${resumen.nombreMes}`}
    >
      <div className="ventas-mes-panel-heading ventas-barras-heading">
        <div>
          <h4>Comparativo diario en barras</h4>
          <p>{configuracion.descripcion} Toca una barra para consultar el detalle completo del día.</p>
        </div>

        <div className="ventas-barras-filtros" role="group" aria-label="Indicador de la gráfica de barras">
          {Object.entries(METRICAS_BARRAS).map(([clave, opcion]) => (
            <button
              type="button"
              key={clave}
              className={metrica === clave ? "active" : ""}
              aria-pressed={metrica === clave}
              onClick={() => setMetrica(clave)}
            >
              {opcion.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className="ventas-barras-resumen" aria-label={`Resumen de ${configuracion.etiqueta}`}>
        <div>
          <span>{configuracion.etiquetaPrincipal}</span>
          <strong>{configuracion.formatear(principal)}</strong>
        </div>
        <div>
          <span>{configuracion.etiquetaPromedio}</span>
          <strong>{configuracion.formatear(promedio)}</strong>
        </div>
        <div>
          <span>Mayor valor diario</span>
          <strong>{configuracion.formatear(mayor)}</strong>
          <small>{mejorDia ? formatearFechaColombia(mejorDia.fecha) : "Sin datos"}</small>
        </div>
      </div>

      <div className="ventas-barras-scroll">
        <div
          className={`ventas-barras metrica-${metrica}`}
          style={{ "--ventas-dias": resumen.dias.length }}
          data-metrica={metrica}
        >
          {resumen.dias.map((dia) => {
            const valor = Math.max(Number(dia?.[configuracion.campo]) || 0, 0);
            const altura = valor > 0 ? Math.max((valor / maximo) * 100, 4) : 0;
            const esMejorDia = mejorDia?.fecha === dia.fecha && valor > 0;
            return (
              <button
                type="button"
                key={dia.fecha}
                className={`ventas-barra-columna${esMejorDia ? " es-mejor-dia" : ""}`}
                onClick={() => onSeleccionarDia(dia)}
                title={`${formatearFechaColombia(dia.fecha)} · ${configuracion.etiqueta}: ${configuracion.formatear(valor)}`}
                aria-label={`${formatearFechaColombia(dia.fecha)}. ${configuracion.etiqueta}: ${configuracion.formatear(valor)}. Abrir detalle del día.`}
              >
                <span className="ventas-barra-valor">
                  {valor > 0 ? configuracion.formatearBarra(valor) : ""}
                </span>
                <span className="ventas-barra-pista" aria-hidden="true">
                  <i style={{ height: `${altura}%` }} />
                </span>
                <strong>{dia.dia}</strong>
              </button>
            );
          })}
        </div>
      </div>

      <p className="ventas-barras-ayuda">
        La altura de cada barra se recalcula según el indicador seleccionado para facilitar la comparación
        visual.
      </p>
    </section>
  );
}

function DetalleDiaVentas({ dia, onClose, onAbrirInforme }) {
  return (
    <RafikiModal
      open={Boolean(dia)}
      title={dia ? `Ventas del ${formatearFechaColombia(dia.fecha)}` : "Detalle de ventas"}
      description="Resumen comercial del día seleccionado."
      onClose={onClose}
      size="sm"
      className="ventas-dia-modal"
      footer={
        <>
          <button type="button" className="button-secondary" onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className="button" onClick={() => onAbrirInforme(dia?.fecha)}>
            Abrir informe del día
          </button>
        </>
      }
    >
      {dia ? (
        <div className="ventas-dia-detalle">
          <div className="ventas-dia-destacado">
            <span>Total vendido</span>
            <strong>{dinero(dia.total)}</strong>
          </div>
          <div className="ventas-dia-resumen-grid">
            <div>
              <span>Total de gastos</span>
              <strong>{dinero(dia.gastos)}</strong>
            </div>
            <div>
              <span>Resultado ventas - gastos</span>
              <strong>{dinero(dia.resultado)}</strong>
            </div>
            <div>
              <span>Pedidos</span>
              <strong>{dia.pedidos}</strong>
            </div>
            <div>
              <span>Ticket promedio</span>
              <strong>{dinero(dia.ticketPromedio)}</strong>
            </div>
          </div>
          {dia.pedidos === 0 && dia.gastos === 0 ? (
            <p className="muted">Este día no tiene ventas ni gastos registrados.</p>
          ) : null}
        </div>
      ) : null}
    </RafikiModal>
  );
}

export default function VentasMensualesDashboard({ onSeleccionarDia }) {
  const mesActual = obtenerMesColombia();
  const [mes, setMes] = useState(mesActual);
  const [pedidos, setPedidos] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [vista, setVista] = useState("ambos");
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);

  useEffect(() => {
    let cancelado = false;

    async function cargarVentasMes() {
      setCargando(true);
      setError("");
      const rango = obtenerRangoMesColombia(mes);

      try {
        const [resultadoPedidos, resultadoGastos] = await Promise.allSettled([
          cargarPedidosDashboardRango(rango.inicio, rango.fin),
          cargarGastosDashboardRango(rango.inicioTexto, rango.finTexto)
        ]);
        if (cancelado) return;

        const mensajes = [];

        if (resultadoPedidos.status === "fulfilled") {
          const { data, error: errorConsulta, completo = true, advertencia = "" } = resultadoPedidos.value;
          if (errorConsulta) {
            registrarErrorSupabase("cargar calendario mensual de ventas", errorConsulta);
            setPedidos([]);
            mensajes.push(describirErrorSupabase(errorConsulta, "cargar las ventas mensuales"));
          } else {
            setPedidos(data || []);
            if (!completo && advertencia) mensajes.push(advertencia);
          }
        } else {
          registrarErrorSupabase("cargar calendario mensual de ventas", resultadoPedidos.reason);
          setPedidos([]);
          mensajes.push(describirErrorSupabase(resultadoPedidos.reason, "cargar las ventas mensuales"));
        }

        if (resultadoGastos.status === "fulfilled") {
          setGastos(resultadoGastos.value || []);
        } else {
          registrarErrorSupabase("cargar gastos mensuales del dashboard", resultadoGastos.reason);
          setGastos([]);
          mensajes.push(describirErrorSupabase(resultadoGastos.reason, "cargar los gastos mensuales"));
        }

        setError(mensajes.join(" "));
      } catch (errorCarga) {
        if (!cancelado) {
          registrarErrorSupabase("cargar calendario mensual de ventas y gastos", errorCarga);
          setPedidos([]);
          setGastos([]);
          setError(describirErrorSupabase(errorCarga, "cargar las ventas y gastos mensuales"));
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    cargarVentasMes();
    return () => {
      cancelado = true;
    };
  }, [mes]);

  const resumen = useMemo(() => crearResumenVentasMensuales(pedidos, gastos, mes), [pedidos, gastos, mes]);

  function abrirInformeDia(fecha) {
    setDiaSeleccionado(null);
    onSeleccionarDia?.(fecha);
  }

  return (
    <section className="ventas-mes-dashboard">
      <div className="ventas-mes-header">
        <div>
          <span className="ventas-mes-kicker">Fase 36B.1B</span>
          <h3>📅 Ventas del mes</h3>
          <p>
            Calendario mensual y gráfica comparativa por ventas, pedidos o ticket promedio, con los gastos
            registrados del mes.
          </p>
        </div>
        <div className="ventas-mes-navegacion">
          <button
            type="button"
            className="mini-btn"
            onClick={() => setMes((actual) => desplazarMes(actual, -1))}
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <strong>{resumen.nombreMes}</strong>
          <button
            type="button"
            className="mini-btn"
            onClick={() => setMes((actual) => desplazarMes(actual, 1))}
            aria-label="Mes siguiente"
          >
            ›
          </button>
          {mes !== mesActual ? (
            <button
              type="button"
              className="button-secondary ventas-mes-actual"
              onClick={() => setMes(mesActual)}
            >
              Mes actual
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {cargando ? <div className="alert alert-info">Cargando ventas de {resumen.nombreMes}...</div> : null}

      <div className="ventas-mes-metricas">
        <TarjetaMetrica
          etiqueta="Ventas del mes"
          valor={dinero(resumen.totalMes)}
          ayuda={`${resumen.diasConVenta} días con ventas`}
        />
        <TarjetaMetrica
          etiqueta="Gastos del mes"
          valor={dinero(resumen.totalGastos)}
          ayuda={`Resultado ${dinero(resumen.resultadoMes)}`}
        />
        <TarjetaMetrica
          etiqueta="Promedio diario"
          valor={dinero(resumen.promedioDiario)}
          ayuda="Sobre días con ventas"
        />
        <TarjetaMetrica
          etiqueta="Mejor día"
          valor={resumen.mejorDia ? dinero(resumen.mejorDia.total) : dinero(0)}
          ayuda={resumen.mejorDia ? formatearFechaColombia(resumen.mejorDia.fecha) : "Sin ventas"}
        />
        <TarjetaMetrica
          etiqueta="Pedidos del mes"
          valor={resumen.totalPedidos}
          ayuda={`Ticket promedio ${dinero(resumen.ticketPromedio)}`}
        />
      </div>

      <div className="ventas-mes-selector" role="group" aria-label="Vista del informe mensual">
        <button
          type="button"
          className={vista === "calendario" ? "active" : ""}
          onClick={() => setVista("calendario")}
        >
          Calendario
        </button>
        <button
          type="button"
          className={vista === "barras" ? "active" : ""}
          onClick={() => setVista("barras")}
        >
          Barras
        </button>
        <button type="button" className={vista === "ambos" ? "active" : ""} onClick={() => setVista("ambos")}>
          Ambos
        </button>
      </div>

      {!cargando && resumen.totalPedidos === 0 ? (
        <div className="ventas-mes-vacio">
          <strong>No hay ventas registradas en {resumen.nombreMes}.</strong>
          <span>Puedes navegar a otro mes usando las flechas.</span>
        </div>
      ) : null}

      {vista === "calendario" || vista === "ambos" ? (
        <CalendarioVentas resumen={resumen} onSeleccionarDia={setDiaSeleccionado} />
      ) : null}

      {vista === "barras" || vista === "ambos" ? (
        <GraficaBarrasVentas resumen={resumen} onSeleccionarDia={setDiaSeleccionado} />
      ) : null}

      <p className="ventas-mes-nota">
        Se excluyen pedidos borrados. El total de gastos se toma de los gastos diarios registrados para cada
        fecha.
      </p>

      <DetalleDiaVentas
        dia={diaSeleccionado}
        onClose={() => setDiaSeleccionado(null)}
        onAbrirInforme={abrirInformeDia}
      />
    </section>
  );
}
