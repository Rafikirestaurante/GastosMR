import React, { useEffect, useMemo, useState } from "react";
import { useAlertaRafiki } from "../../../shared/components/common";
import RafikiBadge from "../../../shared/components/RafikiBadge";
import RafikiEmptyState from "../../../shared/components/RafikiEmptyState";
import RafikiModal from "../../../shared/components/RafikiModal";
import RafikiTabs from "../../../shared/components/RafikiTabs";
import { dinero } from "../../../shared/utils/pedidos";
import { describirErrorSupabase, registrarErrorSupabase } from "../../../shared/utils/supabaseErrors";
import { calcularCuadreCaja } from "../../../shared/utils/financialFlows";
import { cargarCajaArqueoPorFecha, cargarCuadreRealCaja, cargarHistorialArqueosCaja, cargarUltimoArqueoDiaAnterior, guardarAjustesCaja, guardarArqueoHistorialCaja, guardarFinCaja, guardarInicioCaja, limpiarUltimoArqueoCaja, obtenerFechaCajaHoy } from "../../../services/cajaService";
import { formatearFechaTermica, imprimirReporteTermico } from "../../impresion/thermalReportService";
import ThermalPrintControls from "../../impresion/ThermalPrintControls";

const DENOMINACIONES = [1000, 2000, 5000, 10000, 20000, 50000, 100000];
const CUENTAS_INICIALES = [
  { id: "bancolombia", nombre: "Bancolombia" },
  { id: "nequi", nombre: "Nequi" },
  { id: "rafa", nombre: "Rafa" },
  { id: "datafono", nombre: "Datafono" },
];

function limpiarNumero(valor) {
  const soloNumeros = String(valor ?? "").replace(/[^0-9]/g, "");
  return soloNumeros ? Number(soloNumeros) : 0;
}

function formatearFechaHoraColombia(valor) {
  if (!valor) return "Sin hora";
  try {
    return new Intl.DateTimeFormat("es-CO", {
      timeZone: "America/Bogota",
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(valor));
  } catch {
    return String(valor);
  }
}

function descargarArchivo(nombreArchivo, contenido, tipo = "text/plain;charset=utf-8") {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

function textoCsv(valor) {
  const texto = String(valor ?? "").replace(/"/g, '""');
  return `"${texto}"`;
}

function crearCajaVacia() {
  return {
    billetes: DENOMINACIONES.reduce((acc, denominacion) => ({ ...acc, [denominacion]: "" }), {}),
    moneditas: "",
    paquetes: "",
  };
}

function calcularTotalCaja(caja) {
  const totalBilletes = DENOMINACIONES.reduce((total, denominacion) => total + denominacion * limpiarNumero(caja.billetes?.[denominacion]), 0);
  return totalBilletes + limpiarNumero(caja.moneditas) + limpiarNumero(caja.paquetes);
}

function crearAjustesCajaVacios() {
  return {
    gastosRafa: "",
    cuentasPorCobrar: "",
    ingresosDiasAnteriores: "",
  };
}

function normalizarAjustesCaja(ajustes) {
  const base = crearAjustesCajaVacios();
  if (!ajustes || typeof ajustes !== "object") return base;
  return {
    ...base,
    gastosRafa: ajustes.gastosRafa ?? ajustes.gastos_rafa ?? "",
    cuentasPorCobrar: ajustes.cuentasPorCobrar ?? ajustes.cuentas_por_cobrar ?? "",
    ingresosDiasAnteriores: ajustes.ingresosDiasAnteriores ?? ajustes.ingresos_dias_anteriores ?? "",
  };
}

function crearEstadoArqueo() {
  return {
    cajaRegistradora: crearCajaVacia(),
    cajaAzul: crearCajaVacia(),
    cuentas: CUENTAS_INICIALES.reduce((acc, cuenta) => ({ ...acc, [cuenta.id]: "" }), {}),
  };
}

function normalizarEstadoArqueo(estado) {
  const base = crearEstadoArqueo();
  if (!estado || typeof estado !== "object") return base;

  return {
    cajaRegistradora: {
      ...base.cajaRegistradora,
      ...(estado.cajaRegistradora || {}),
      billetes: { ...base.cajaRegistradora.billetes, ...(estado.cajaRegistradora?.billetes || {}) },
    },
    cajaAzul: {
      ...base.cajaAzul,
      ...(estado.cajaAzul || {}),
      billetes: { ...base.cajaAzul.billetes, ...(estado.cajaAzul?.billetes || {}) },
    },
    cuentas: { ...base.cuentas, ...(estado.cuentas || {}) },
  };
}

function totalCuentas(cuentas) {
  return CUENTAS_INICIALES.reduce((total, cuenta) => total + limpiarNumero(cuentas[cuenta.id]), 0);
}

function totalArqueo(estado) {
  return calcularTotalCaja(estado.cajaRegistradora) + calcularTotalCaja(estado.cajaAzul) + totalCuentas(estado.cuentas);
}

function obtenerSaldosArqueo(estado) {
  const arqueo = normalizarEstadoArqueo(estado);
  return {
    cajaRegistradora: calcularTotalCaja(arqueo.cajaRegistradora),
    cajaAzul: calcularTotalCaja(arqueo.cajaAzul),
    bancolombia: limpiarNumero(arqueo.cuentas.bancolombia),
    nequi: limpiarNumero(arqueo.cuentas.nequi),
    rafa: limpiarNumero(arqueo.cuentas.rafa),
    datafono: limpiarNumero(arqueo.cuentas.datafono),
  };
}

function actualizarConteoCaja(setEstado, cajaId, campo, valor) {
  setEstado((actual) => ({ ...actual, [cajaId]: { ...actual[cajaId], [campo]: valor } }));
}

function actualizarBilleteCaja(setEstado, cajaId, denominacion, valor) {
  setEstado((actual) => ({
    ...actual,
    [cajaId]: { ...actual[cajaId], billetes: { ...actual[cajaId].billetes, [denominacion]: valor } },
  }));
}

function actualizarCuenta(setEstado, cuentaId, valor) {
  setEstado((actual) => ({ ...actual, cuentas: { ...actual.cuentas, [cuentaId]: valor } }));
}

function BloqueCaja({ titulo, cajaId, estado, setEstado }) {
  const caja = estado[cajaId];
  return (
    <section className="card card-pad caja-bloque">
      <div className="section-title-row caja-section-title">
        <div><h3>{titulo}</h3><p className="muted small">Escribe la cantidad de billetes; el valor se calcula automáticamente.</p></div>
        <strong className="caja-total-bloque">{dinero(calcularTotalCaja(caja))}</strong>
      </div>
      <div className="caja-denominaciones">
        {DENOMINACIONES.map((denominacion) => {
          const cantidad = caja.billetes[denominacion] ?? "";
          const subtotal = denominacion * limpiarNumero(cantidad);
          return (
            <label className="caja-denominacion-row" key={denominacion}>
              <span>{dinero(denominacion)} x</span>
              <input type="number" min="0" inputMode="numeric" value={cantidad} onChange={(event) => actualizarBilleteCaja(setEstado, cajaId, denominacion, event.target.value)} placeholder="0" />
              <span>=</span>
              <strong>{dinero(subtotal)}</strong>
            </label>
          );
        })}
        <label className="caja-denominacion-row caja-moneditas-row">
          <span>Moneditas</span>
          <input type="number" min="0" inputMode="numeric" value={caja.moneditas} onChange={(event) => actualizarConteoCaja(setEstado, cajaId, "moneditas", event.target.value)} placeholder="0" />
          <span>=</span>
          <strong>{dinero(limpiarNumero(caja.moneditas))}</strong>
        </label>
        <label className="caja-denominacion-row caja-moneditas-row">
          <span>Paquetes</span>
          <input type="number" min="0" inputMode="numeric" value={caja.paquetes} onChange={(event) => actualizarConteoCaja(setEstado, cajaId, "paquetes", event.target.value)} placeholder="0" />
          <span>=</span>
          <strong>{dinero(limpiarNumero(caja.paquetes))}</strong>
        </label>
      </div>
    </section>
  );
}

function BloqueCuentas({ estado, setEstado }) {
  return (
    <section className="card card-pad caja-bloque">
      <div className="section-title-row caja-section-title">
        <div><h3>Bancos / cuentas</h3><p className="muted small">Registra el saldo visible al momento del conteo.</p></div>
        <strong className="caja-total-bloque">{dinero(totalCuentas(estado.cuentas))}</strong>
      </div>
      <div className="caja-cuentas-grid">
        {CUENTAS_INICIALES.map((cuenta) => (
          <label className="field" key={cuenta.id}>
            <span>{cuenta.nombre}</span>
            <input type="number" min="0" inputMode="numeric" value={estado.cuentas[cuenta.id] ?? ""} onChange={(event) => actualizarCuenta(setEstado, cuenta.id, event.target.value)} placeholder="0" />
          </label>
        ))}
      </div>
    </section>
  );
}

function FormularioArqueo({ titulo, descripcion, estado, setEstado, guardando, onGuardar, onNuevo, onTraerAnterior, historial }) {
  return (
    <div className="caja-formulario">
      <section className="card card-pad caja-intro"><h2>{titulo}</h2><p className="muted">{descripcion}</p></section>
      <div className="caja-grid-principal">
        <BloqueCaja titulo="Caja Registradora" cajaId="cajaRegistradora" estado={estado} setEstado={setEstado} />
        <BloqueCaja titulo="Caja Azul" cajaId="cajaAzul" estado={estado} setEstado={setEstado} />
      </div>
      <BloqueCuentas estado={estado} setEstado={setEstado} />
      <div className="caja-actions caja-arqueo-actions">
        {onTraerAnterior && <button type="button" className="btn secondary" onClick={onTraerAnterior} disabled={guardando}>Traer último arqueo anterior</button>}
        {onNuevo && <button type="button" className="btn secondary" onClick={onNuevo} disabled={guardando}>Arqueo Nuevo</button>}
        <button type="button" className="btn primary" onClick={onGuardar} disabled={guardando}>{guardando ? "Guardando..." : "Guardar"}</button>
      </div>
      {Array.isArray(historial) && <HistorialArqueos historial={historial} titulo="Historial de arqueos" />}
    </div>
  );
}

function estadoDiferenciaCaja(diferencia) {
  if (Math.abs(Number(diferencia || 0)) < 1) return { texto: "Cuadrado", clase: "ok", etiqueta: "Diferencia" };
  if (Number(diferencia || 0) > 0) return { texto: "Sobra dinero", clase: "warning", etiqueta: "Sobra dinero" };
  return { texto: "Falta dinero", clase: "danger", etiqueta: "Falta dinero" };
}

function tipoBadgeDiferencia(clase) {
  if (clase === "ok") return "success";
  if (clase === "warning") return "warning";
  if (clase === "danger") return "danger";
  return "neutral";
}

function FilaInforme({ etiqueta, valor, fuerte = false, estado = "", detalle = false, tipo = "" }) {
  return (
    <div className={`caja-informe-row ${fuerte ? "fuerte" : ""} ${detalle ? "detalle" : ""} ${estado ? `caja-informe-${estado}` : ""} ${tipo ? `caja-movimiento-${tipo}` : ""}`}>
      <span>{etiqueta}</span>
      <strong>{dinero(valor)}</strong>
    </div>
  );
}

function CajaResumenVisual({ totalInicio, totalFin, ventasTotal, gastosTotal, dineroEsperado, diferenciaReal, estadoDiferencia, pedidosCantidad }) {
  return (
    <section className="caja-resumen-visual">
      <article className="card card-pad caja-resumen-card">
        <span>Inicio</span>
        <strong>{dinero(totalInicio)}</strong>
        <small>Base inicial del día</small>
      </article>
      <article className="card card-pad caja-resumen-card caja-resumen-ingreso">
        <span>Ventas</span>
        <strong>{dinero(ventasTotal)}</strong>
        <small>{pedidosCantidad || 0} pedidos registrados</small>
      </article>
      <article className="card card-pad caja-resumen-card caja-resumen-egreso">
        <span>Gastos</span>
        <strong>{dinero(gastosTotal)}</strong>
        <small>Gastos operativos</small>
      </article>
      <article className="card card-pad caja-resumen-card">
        <span>Esperado</span>
        <strong>{dinero(dineroEsperado)}</strong>
        <small>Según ventas y ajustes</small>
      </article>
      <article className={`card card-pad caja-resumen-card caja-resumen-diferencia caja-estado-${estadoDiferencia.clase}`}>
        <span>Resultado</span>
        <strong>{dinero(Math.abs(diferenciaReal))}</strong>
        <RafikiBadge tipo={tipoBadgeDiferencia(estadoDiferencia.clase)}>{estadoDiferencia.texto}</RafikiBadge>
      </article>
      <article className="card card-pad caja-resumen-card">
        <span>Último arqueo</span>
        <strong>{dinero(totalFin)}</strong>
        <small>Conteo actual guardado</small>
      </article>
    </section>
  );
}

function DetalleSaldosArqueo({ estado, className = "" }) {
  const saldos = obtenerSaldosArqueo(estado);
  return (
    <div className={`caja-saldos-detalle ${className}`.trim()}>
      <FilaInforme etiqueta="Caja Registradora" valor={saldos.cajaRegistradora} detalle />
      <FilaInforme etiqueta="Caja Azul" valor={saldos.cajaAzul} detalle />
      <FilaInforme etiqueta="Bancolombia" valor={saldos.bancolombia} detalle />
      <FilaInforme etiqueta="Nequi" valor={saldos.nequi} detalle />
      <FilaInforme etiqueta="Rafa" valor={saldos.rafa} detalle />
      <FilaInforme etiqueta="Datafono" valor={saldos.datafono} detalle />
    </div>
  );
}

function InicioDiaInforme({ estado, total }) {
  return (
    <section className="caja-informe-bloque caja-inicio-dia-saldos">
      <FilaInforme etiqueta="Inicio del día" valor={total} fuerte />
      <DetalleSaldosArqueo estado={estado} />
    </section>
  );
}

function DetalleGastos({ gastos = [], total }) {
  return (
    <section className="caja-informe-bloque">
      <FilaInforme etiqueta="Gastos del día" valor={total} fuerte tipo="egreso" />
      {gastos.length ? gastos.map((gasto) => (
        <div className="caja-gasto-detalle-row caja-gasto-detalle-sub" key={gasto.id || `${gasto.proveedor}-${gasto.valor}-${gasto.creadoEn}`}>
          <div>
            <strong>{gasto.proveedor || "Sin proveedor"}</strong>
            {(gasto.categoria || gasto.articulos) && <span>{[gasto.categoria, gasto.articulos].filter(Boolean).join(" · ")}</span>}
          </div>
          <strong>{dinero(gasto.valor)}</strong>
        </div>
      )) : (
        <RafikiEmptyState
          icon="🧾"
          title="Sin gastos registrados"
          description="No hay egresos guardados para la fecha seleccionada."
        />
      )}
    </section>
  );
}

function HistorialArqueos({ historial = [], titulo = "Arqueos realizados" }) {
  return (
    <section className="caja-informe-bloque caja-historial-arqueos">
      <div className="caja-informe-row fuerte"><span>{titulo}</span><strong>{historial.length}</strong></div>
      {historial.length ? historial.map((arqueo, index) => {
        const saldos = obtenerSaldosArqueo(arqueo.arqueoData);
        return (
          <div className="caja-arqueo-historial-row" key={arqueo.id || `${arqueo.creadoEn}-${index}`}>
            <div>
              <strong>{index === 0 ? "Último arqueo" : `Arqueo ${historial.length - index}`}</strong>
              <span>{formatearFechaHoraColombia(arqueo.creadoEn)}</span>
              <span>Registradora {dinero(saldos.cajaRegistradora)} · Azul {dinero(saldos.cajaAzul)}</span>
              <span>Bancolombia {dinero(saldos.bancolombia)} · Nequi {dinero(saldos.nequi)} · Rafa {dinero(saldos.rafa)} · Datafono {dinero(saldos.datafono)}</span>
            </div>
            <strong>{dinero(arqueo.arqueoTotal)}</strong>
          </div>
        );
      }) : (
        <RafikiEmptyState
          icon="💵"
          title="Sin arqueos guardados"
          description="Cuando guardes un arqueo nuevo, aparecerá aquí con fecha, hora y saldos."
        />
      )}
    </section>
  );
}

function SaldosUltimoArqueo({ arqueo, respaldo }) {
  const tieneHistorial = Boolean(arqueo?.arqueoData);
  const estado = tieneHistorial ? arqueo.arqueoData : respaldo;
  const total = tieneHistorial ? limpiarNumero(arqueo.arqueoTotal) : totalArqueo(estado);

  return (
    <section className="caja-informe-bloque caja-ultimo-arqueo-saldos">
      <div className="caja-informe-row fuerte">
        <span>Saldos último arqueo</span>
        <strong>{dinero(total)}</strong>
      </div>
      {tieneHistorial && <p className="muted small caja-sin-movimientos">Último arqueo: {formatearFechaHoraColombia(arqueo.creadoEn)}</p>}
      <DetalleSaldosArqueo estado={estado} className="caja-ultimo-arqueo-detalle" />
    </section>
  );
}

export default function CajaAdmin() {
  const [tabCaja, setTabCaja] = useState("inicio");
  const [fechaCaja, setFechaCaja] = useState(() => obtenerFechaCajaHoy());
  const [inicioDia, setInicioDia] = useState(() => crearEstadoArqueo());
  const [finDia, setFinDia] = useState(() => crearEstadoArqueo());
  const [cargando, setCargando] = useState(true);
  const [guardandoInicio, setGuardandoInicio] = useState(false);
  const [guardandoFin, setGuardandoFin] = useState(false);
  const [guardandoAjustes, setGuardandoAjustes] = useState(false);
  const [cuadreReal, setCuadreReal] = useState(null);
  const [historialArqueos, setHistorialArqueos] = useState([]);
  const [ultimoArqueoGuardado, setUltimoArqueoGuardado] = useState(null);
  const [ajustesCaja, setAjustesCaja] = useState(() => crearAjustesCajaVacios());
  const [cargandoCuadre, setCargandoCuadre] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [modalAjustesAbierto, setModalAjustesAbierto] = useState(false);
  const [modalGastosAbierto, setModalGastosAbierto] = useState(false);
  const [mostrarAlertaRafiki, modalAlertaRafiki] = useAlertaRafiki();

  const totalInicio = useMemo(() => totalArqueo(inicioDia), [inicioDia]);
  const totalFin = useMemo(() => totalArqueo(finDia), [finDia]);
  const ventasTotal = useMemo(() => Number(cuadreReal?.ventasTotal || 0), [cuadreReal]);
  const gastosTotal = useMemo(() => Number(cuadreReal?.gastosTotal || 0), [cuadreReal]);
  const gastosRafaTotal = useMemo(() => limpiarNumero(ajustesCaja.gastosRafa), [ajustesCaja.gastosRafa]);
  const cuentasPorCobrarTotal = useMemo(() => limpiarNumero(ajustesCaja.cuentasPorCobrar), [ajustesCaja.cuentasPorCobrar]);
  const ingresosDiasAnterioresTotal = useMemo(() => limpiarNumero(ajustesCaja.ingresosDiasAnteriores), [ajustesCaja.ingresosDiasAnteriores]);
  const ajustesEgresosTotal = useMemo(() => gastosRafaTotal + cuentasPorCobrarTotal, [gastosRafaTotal, cuentasPorCobrarTotal]);
  const ajustesNetosTotal = useMemo(() => ingresosDiasAnterioresTotal + ajustesEgresosTotal, [ingresosDiasAnterioresTotal, ajustesEgresosTotal]);
  const dineroEsperado = useMemo(() => calcularCuadreCaja({
    inicio: totalInicio,
    ventas: ventasTotal,
    gastosOperativos: gastosTotal,
    gastosRafa: gastosRafaTotal,
    cuentasPorCobrar: cuentasPorCobrarTotal,
  }).cajaEsperada, [totalInicio, ventasTotal, gastosTotal, gastosRafaTotal, cuentasPorCobrarTotal]);
  const arqueoVigenteInforme = useMemo(() => {
    if (ultimoArqueoGuardado?.arqueoData) return ultimoArqueoGuardado;
    return historialArqueos[0] || null;
  }, [historialArqueos, ultimoArqueoGuardado]);

  const arqueosInforme = useMemo(() => {
    const lista = [];
    if (ultimoArqueoGuardado?.arqueoData) lista.push(ultimoArqueoGuardado);
    return [...lista, ...historialArqueos].filter(Boolean);
  }, [historialArqueos, ultimoArqueoGuardado]);

  const totalUltimoArqueoInforme = useMemo(() => {
    if (arqueoVigenteInforme?.arqueoData) return limpiarNumero(arqueoVigenteInforme.arqueoTotal);
    return totalFin;
  }, [arqueoVigenteInforme, totalFin]);
  const diferenciaReal = useMemo(() => calcularCuadreCaja({
    inicio: totalInicio,
    ventas: ventasTotal,
    gastosOperativos: gastosTotal,
    gastosRafa: gastosRafaTotal,
    cuentasPorCobrar: cuentasPorCobrarTotal,
    ingresosDiasAnteriores: ingresosDiasAnterioresTotal,
    arqueoContado: totalUltimoArqueoInforme,
  }).diferencia, [
    totalInicio,
    ventasTotal,
    gastosTotal,
    gastosRafaTotal,
    cuentasPorCobrarTotal,
    ingresosDiasAnterioresTotal,
    totalUltimoArqueoInforme,
  ]);
  const estadoDiferencia = useMemo(() => estadoDiferenciaCaja(diferenciaReal), [diferenciaReal]);
  const tabsCaja = useMemo(() => ([
    { id: "inicio", label: "Inicio", icon: "🌅" },
    { id: "fin", label: "Arqueo", icon: "💵" },
    { id: "informe", label: "Informe", icon: "📊" },
    { id: "historial", label: "Historial", icon: "🕒", count: historialArqueos.length },
  ]), [historialArqueos.length]);

  function mostrarMensajeCaja(texto, tipo = "success", titulo = "Caja") {
    setMensaje(tipo === "success" ? texto : "");
    setError(tipo === "error" ? texto : "");
    mostrarAlertaRafiki({
      tipo: tipo === "error" ? "error" : tipo === "warning" ? "advertencia" : "exito",
      titulo,
      mensaje: texto,
      textoCerrar: "Entendido"
    });
  }

  function mostrarErrorCaja(texto, titulo = "Error en caja") {
    mostrarMensajeCaja(texto, "error", titulo);
  }

  useEffect(() => {
    let activo = true;
    async function cargarArqueo() {
      setCargando(true); setError(""); setMensaje("");
      setInicioDia(crearEstadoArqueo()); setFinDia(crearEstadoArqueo()); setAjustesCaja(crearAjustesCajaVacios()); setUltimoArqueoGuardado(null);
      try {
        const registro = await cargarCajaArqueoPorFecha(fechaCaja);
        if (!activo) return;
        if (registro?.inicioData) setInicioDia(normalizarEstadoArqueo(registro.inicioData));
        if (registro?.finData) {
          const finNormalizado = normalizarEstadoArqueo(registro.finData);
          setFinDia(finNormalizado);
          setUltimoArqueoGuardado({
            id: "arqueo-vigente",
            fecha: fechaCaja,
            arqueoData: finNormalizado,
            arqueoTotal: limpiarNumero(registro.finTotal),
            creadoEn: registro.actualizadoEn || registro.creadoEn || "",
            esVigente: true,
          });
        }
        if (registro?.ajustesData) setAjustesCaja(normalizarAjustesCaja(registro.ajustesData));
      } catch (err) {
        if (activo) {
          registrarErrorSupabase("cargar caja por fecha", err);
          setError(describirErrorSupabase(err, "cargar la caja de la fecha seleccionada"));
        }
      } finally {
        if (activo) setCargando(false);
      }
    }
    cargarArqueo();
    return () => { activo = false; };
  }, [fechaCaja]);

  useEffect(() => {
    let activo = true;
    async function cargarDatosCuadre() {
      setCargandoCuadre(true);
      try {
        const [resumen, historial] = await Promise.all([
          cargarCuadreRealCaja(fechaCaja),
          cargarHistorialArqueosCaja(fechaCaja),
        ]);
        if (activo) {
          setCuadreReal(resumen);
          setHistorialArqueos(historial);
        }
      } catch (err) {
        if (activo) {
          registrarErrorSupabase("cargar cuadre real de caja", err);
          setError((prev) => prev || describirErrorSupabase(err, "cargar ventas, gastos o arqueos del día"));
        }
      } finally {
        if (activo) setCargandoCuadre(false);
      }
    }
    cargarDatosCuadre();
    return () => { activo = false; };
  }, [fechaCaja]);

  async function guardarInicio() {
    setGuardandoInicio(true); setMensaje(""); setError("");
    try { await guardarInicioCaja({ fecha: fechaCaja, estado: inicioDia, total: totalInicio }); mostrarMensajeCaja("Inicio del día guardado correctamente.", "success", "Inicio guardado"); }
    catch (err) { registrarErrorSupabase("guardar inicio de caja", err); mostrarErrorCaja(describirErrorSupabase(err, "guardar el inicio del día")); }
    finally { setGuardandoInicio(false); }
  }

  async function traerUltimoArqueoAnteriorAInicio() {
    setGuardandoInicio(true); setMensaje(""); setError("");
    try {
      const anterior = await cargarUltimoArqueoDiaAnterior(fechaCaja);
      if (!anterior?.estado) {
        mostrarMensajeCaja("No se encontró arqueo del día anterior para traer.", "warning", "Sin arqueo anterior");
        return;
      }
      setInicioDia(normalizarEstadoArqueo(anterior.estado));
      mostrarMensajeCaja(`Información del último arqueo anterior cargada desde ${anterior.fecha}. Verifica los valores y luego guarda manualmente el inicio del día.`, "success", "Arqueo anterior cargado");
    } catch (err) {
      registrarErrorSupabase("traer último arqueo anterior", err);
      mostrarErrorCaja(describirErrorSupabase(err, "traer el último arqueo del día anterior"));
    } finally {
      setGuardandoInicio(false);
    }
  }

  async function guardarFin() {
    setGuardandoFin(true); setMensaje(""); setError("");
    try {
      const registro = await guardarFinCaja({ fecha: fechaCaja, estado: finDia, total: totalFin });
      const finNormalizado = normalizarEstadoArqueo(registro?.finData || finDia);
      setFinDia(finNormalizado);
      setUltimoArqueoGuardado({
        id: "arqueo-vigente",
        fecha: fechaCaja,
        arqueoData: finNormalizado,
        arqueoTotal: limpiarNumero(registro?.finTotal ?? totalFin),
        creadoEn: registro?.actualizadoEn || new Date().toISOString(),
        esVigente: true,
      });
      mostrarMensajeCaja("Arqueo guardado correctamente. El Informe Caja ya quedó actualizado con este último conteo.", "success", "Arqueo guardado");
    }
    catch (err) { registrarErrorSupabase("guardar arqueo de caja", err); mostrarErrorCaja(describirErrorSupabase(err, "guardar el arqueo")); }
    finally { setGuardandoFin(false); }
  }

  async function iniciarArqueoNuevo() {
    setGuardandoFin(true); setMensaje(""); setError("");
    try {
      if (totalFin > 0) {
        await guardarArqueoHistorialCaja({ fecha: fechaCaja, estado: finDia, total: totalFin });
      }
      await limpiarUltimoArqueoCaja({ fecha: fechaCaja });
      setFinDia(crearEstadoArqueo());
      setUltimoArqueoGuardado(null);
      const historial = await cargarHistorialArqueosCaja(fechaCaja);
      setHistorialArqueos(historial);
      mostrarMensajeCaja(totalFin > 0 ? "Último arqueo archivado. Ya puedes iniciar un arqueo nuevo." : "Arqueo limpiado. Ya puedes iniciar un arqueo nuevo.", "success", "Arqueo nuevo");
    } catch (err) {
      registrarErrorSupabase("iniciar arqueo nuevo", err);
      mostrarErrorCaja(describirErrorSupabase(err, "iniciar un arqueo nuevo"));
    } finally {
      setGuardandoFin(false);
    }
  }

  function actualizarAjusteCaja(campo, valor) {
    setAjustesCaja((actual) => ({ ...actual, [campo]: valor }));
  }

  async function guardarAjustesInformeCaja() {
    setGuardandoAjustes(true); setMensaje(""); setError("");
    try {
      const registro = await guardarAjustesCaja({ fecha: fechaCaja, ajustes: ajustesCaja });
      setAjustesCaja(normalizarAjustesCaja(registro?.ajustesData));
      mostrarMensajeCaja("Ajustes de caja guardados correctamente.", "success", "Ajustes guardados");
    } catch (err) {
      registrarErrorSupabase("guardar ajustes de caja", err);
      mostrarErrorCaja(describirErrorSupabase(err, "guardar los ajustes de caja"));
    } finally {
      setGuardandoAjustes(false);
    }
  }

  function construirTextoInformeCaja() {
    const lineas = [
      `*Informe Caja Rafiki*`,
      `Fecha: ${fechaCaja}`,
      "",
      `Inicio del día: ${dinero(totalInicio)}`,
      `Ventas del día (${cuadreReal?.pedidosCantidad || 0} pedidos): ${dinero(ventasTotal)}`,
      `Gastos operativos: ${dinero(gastosTotal)}`,
      `Ingresos días anteriores: ${dinero(ingresosDiasAnterioresTotal)}`,
      `Gastos Rafa: ${dinero(gastosRafaTotal)}`,
      `Cuentas por cobrar: ${dinero(cuentasPorCobrarTotal)}`,
    ];

    const gastos = cuadreReal?.gastosDetalle || [];
    if (gastos.length) {
      lineas.push("", "*Detalle gastos*");
      gastos.forEach((gasto) => {
        lineas.push(`- ${gasto.proveedor || "Sin proveedor"}: ${dinero(gasto.valor)}`);
      });
    }

    lineas.push(
      "",
      `Dinero esperado: ${dinero(dineroEsperado)}`,
      `Arqueo contado: ${dinero(totalUltimoArqueoInforme)}`,
      `${estadoDiferencia.etiqueta}: ${dinero(Math.abs(diferenciaReal))}`,
    );

    const saldosUltimo = obtenerSaldosArqueo(arqueoVigenteInforme?.arqueoData || finDia);
    lineas.push(
      "",
      "*Saldos último arqueo*",
      `Caja Registradora: ${dinero(saldosUltimo.cajaRegistradora)}`,
      `Caja Azul: ${dinero(saldosUltimo.cajaAzul)}`,
      `Bancolombia: ${dinero(saldosUltimo.bancolombia)}`,
      `Nequi: ${dinero(saldosUltimo.nequi)}`,
      `Rafa: ${dinero(saldosUltimo.rafa)}`,
      `Datafono: ${dinero(saldosUltimo.datafono)}`,
    );

    if (arqueosInforme.length) {
      lineas.push("", "*Arqueos realizados*");
      arqueosInforme.forEach((arqueo, index) => {
        const etiqueta = arqueo.esVigente ? "Último arqueo actual" : index === 0 ? "Último arqueo" : `Arqueo ${arqueosInforme.length - index}`;
        lineas.push(`- ${etiqueta}: ${formatearFechaHoraColombia(arqueo.creadoEn)} · ${dinero(arqueo.arqueoTotal)}`);
      });
    }

    return lineas.join("\n");
  }

  function compartirInformeWhatsApp() {
    const texto = construirTextoInformeCaja();
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function exportarInformeExcel() {
    const filas = [
      ["Informe Caja Rafiki", ""],
      ["Fecha", fechaCaja],
      ["", ""],
      ["Concepto", "Valor"],
      ["Inicio del día", totalInicio],
      [`Ventas del día (${cuadreReal?.pedidosCantidad || 0} pedidos)`, ventasTotal],
      ["Gastos operativos", gastosTotal],
      ["Ingresos días anteriores", ingresosDiasAnterioresTotal],
      ["Gastos Rafa", gastosRafaTotal],
      ["Cuentas por cobrar", cuentasPorCobrarTotal],
      ["Caja esperada", dineroEsperado],
      ["Arqueo contado", totalUltimoArqueoInforme],
      [estadoDiferencia.etiqueta, Math.abs(diferenciaReal)],
      ["", ""],
      ["Saldos último arqueo", ""],
      ["Caja Registradora", obtenerSaldosArqueo(arqueoVigenteInforme?.arqueoData || finDia).cajaRegistradora],
      ["Caja Azul", obtenerSaldosArqueo(arqueoVigenteInforme?.arqueoData || finDia).cajaAzul],
      ["Bancolombia", obtenerSaldosArqueo(arqueoVigenteInforme?.arqueoData || finDia).bancolombia],
      ["Nequi", obtenerSaldosArqueo(arqueoVigenteInforme?.arqueoData || finDia).nequi],
      ["Rafa", obtenerSaldosArqueo(arqueoVigenteInforme?.arqueoData || finDia).rafa],
      ["Datafono", obtenerSaldosArqueo(arqueoVigenteInforme?.arqueoData || finDia).datafono],
      ["", ""],
      ["Detalle gastos", ""],
      ["Proveedor", "Valor", "Categoría / artículos"],
      ...((cuadreReal?.gastosDetalle || []).map((gasto) => [gasto.proveedor || "Sin proveedor", gasto.valor, [gasto.categoria, gasto.articulos].filter(Boolean).join(" · ")])),
      ["", ""],
      ["Arqueos realizados", ""],
      ["Fecha y hora", "Valor"],
      ...arqueosInforme.map((arqueo) => [arqueo.esVigente ? "Último arqueo actual" : formatearFechaHoraColombia(arqueo.creadoEn), arqueo.arqueoTotal]),
    ];

    const csv = filas.map((fila) => fila.map(textoCsv).join(";")).join("\n");
    descargarArchivo(`informe-caja-${fechaCaja}.csv`, `\ufeff${csv}`, "text/csv;charset=utf-8");
  }

  function crearFilasPorMetodoTermico(resumen = {}, textoVacio = "Sin movimientos") {
    const entradas = Object.entries(resumen || {}).filter(([, valor]) => Number(valor || 0) !== 0);
    if (!entradas.length) return [{ etiqueta: textoVacio, valor: dinero(0) }];
    return entradas
      .sort(([metodoA], [metodoB]) => metodoA.localeCompare(metodoB, "es"))
      .map(([metodo, valor]) => ({ etiqueta: metodo || "No especificado", valor: dinero(valor) }));
  }

  function crearFilasSaldosTermicos(estado, incluirTotal = false, total = 0) {
    const saldos = obtenerSaldosArqueo(estado);
    return [
      ...(incluirTotal ? [{ etiqueta: "Total", valor: dinero(total), fuerte: true }] : []),
      { etiqueta: "Caja Registradora", valor: dinero(saldos.cajaRegistradora) },
      { etiqueta: "Caja Azul", valor: dinero(saldos.cajaAzul) },
      { etiqueta: "Bancolombia", valor: dinero(saldos.bancolombia) },
      { etiqueta: "Nequi", valor: dinero(saldos.nequi) },
      { etiqueta: "Rafa", valor: dinero(saldos.rafa) },
      { etiqueta: "Datafono", valor: dinero(saldos.datafono) },
    ];
  }

  function crearFilasArqueosTermicos() {
    if (!arqueosInforme.length) return [{ etiqueta: "Sin arqueos registrados", valor: "0" }];

    return arqueosInforme.flatMap((arqueo, index) => {
      const etiqueta = arqueo.esVigente ? "Último arqueo actual" : index === 0 ? "Último arqueo" : `Arqueo ${arqueosInforme.length - index}`;
      const saldos = obtenerSaldosArqueo(arqueo.arqueoData);
      return [
        {
          etiqueta: `${etiqueta} · ${formatearFechaHoraColombia(arqueo.creadoEn)}`,
          valor: dinero(arqueo.arqueoTotal),
          fuerte: true,
        },
        { etiqueta: "  Registradora / Azul", valor: `${dinero(saldos.cajaRegistradora)} / ${dinero(saldos.cajaAzul)}` },
        { etiqueta: "  Bancolombia / Nequi", valor: `${dinero(saldos.bancolombia)} / ${dinero(saldos.nequi)}` },
        { etiqueta: "  Rafa / Datafono", valor: `${dinero(saldos.rafa)} / ${dinero(saldos.datafono)}` },
      ];
    });
  }

  function imprimirInformeCajaTermico(formato) {
    const gastosDetalle = cuadreReal?.gastosDetalle || [];
    const fechaGeneracion = formatearFechaTermica(new Date());
    const ok = imprimirReporteTermico({
      formato,
      titulo: "Informe Caja Rafiki",
      subtitulo: `Fecha ${fechaCaja}`,
      meta: [
        { etiqueta: "Generado", valor: fechaGeneracion },
        { etiqueta: "Formato", valor: `${formato} mm · misma información` },
        { etiqueta: "Pedidos", valor: cuadreReal?.pedidosCantidad || 0 },
        { etiqueta: "Estado", valor: estadoDiferencia.texto },
      ],
      secciones: [
        {
          titulo: "Resumen del día · Resumen operativo",
          filas: [
            { etiqueta: "Inicio del día", valor: dinero(totalInicio), fuerte: true },
            { etiqueta: `Ventas del día (${cuadreReal?.pedidosCantidad || 0} pedidos)`, valor: dinero(ventasTotal), tipo: "ingreso" },
            { etiqueta: "Gastos operativos", valor: dinero(gastosTotal), tipo: "egreso" },
            { etiqueta: "Gastos Rafa", valor: dinero(gastosRafaTotal), tipo: "egreso" },
            { etiqueta: "Cuentas por cobrar", valor: dinero(cuentasPorCobrarTotal), tipo: "egreso" },
            { etiqueta: "Caja esperada", valor: dinero(dineroEsperado), fuerte: true },
            { etiqueta: "Fin / arqueo contado", valor: dinero(totalUltimoArqueoInforme), fuerte: true },
            { etiqueta: "Ingresos días anteriores", valor: dinero(ingresosDiasAnterioresTotal) },
            { etiqueta: estadoDiferencia.etiqueta, valor: dinero(Math.abs(diferenciaReal)), fuerte: true, tipo: estadoDiferencia.clase },
          ],
        },
        {
          titulo: "Ajustes de Caja",
          filas: [
            { etiqueta: "Ingresos días anteriores", valor: dinero(ingresosDiasAnterioresTotal), fuerte: true },
            { etiqueta: "Gastos Rafa", valor: dinero(gastosRafaTotal), tipo: "egreso" },
            { etiqueta: "Cuentas por cobrar", valor: dinero(cuentasPorCobrarTotal), tipo: "egreso" },
            { etiqueta: "Ajustes egresos", valor: dinero(ajustesEgresosTotal), fuerte: true },
          ],
        },
        {
          titulo: "Ventas por método",
          filas: crearFilasPorMetodoTermico(cuadreReal?.ventasPorMetodo, "Sin ventas registradas"),
        },
        {
          titulo: "Gastos por método",
          filas: crearFilasPorMetodoTermico(cuadreReal?.gastosPorMetodo, "Sin gastos registrados"),
        },
        {
          titulo: "Inicio del día - saldos",
          filas: crearFilasSaldosTermicos(inicioDia, true, totalInicio),
        },
        {
          titulo: "Saldos último arqueo",
          filas: [
            ...(arqueoVigenteInforme?.creadoEn ? [{ etiqueta: "Hora último arqueo", valor: formatearFechaHoraColombia(arqueoVigenteInforme.creadoEn) }] : []),
            ...crearFilasSaldosTermicos(arqueoVigenteInforme?.arqueoData || finDia, true, totalUltimoArqueoInforme),
          ],
        },
        {
          titulo: "Detalle gastos",
          filas: gastosDetalle.length
            ? gastosDetalle.map((gasto) => ({
                etiqueta: [gasto.proveedor || "Sin proveedor", gasto.categoria, gasto.articulos, gasto.metodoPago].filter(Boolean).join(" · "),
                valor: dinero(gasto.valor),
              }))
            : [{ etiqueta: "Sin gastos registrados", valor: dinero(0) }],
        },
        {
          titulo: "Arqueos realizados",
          filas: crearFilasArqueosTermicos(),
        },
        {
          titulo: "Fórmula validada",
          filas: [
            { etiqueta: "Caja esperada", valor: "Inicio + ventas - gastos - Rafa - CxC" },
            { etiqueta: "Diferencia", valor: "Arqueo + ingresos ant. - caja esperada" },
            { etiqueta: "Nota", valor: "Ingresos días anteriores no suben ventas ni caja esperada" },
          ],
        },
      ],
      pie: "Misma información · 58/80 optimizado por ancho",
    });

    if (!ok) {
      mostrarAlertaRafiki({
        tipo: "error",
        titulo: "Impresión bloqueada",
        mensaje: "No se pudo abrir la ventana de impresión. Permite las ventanas emergentes para Rafiki Pedidos e inténtalo nuevamente."
      });
    }
  }

  return (
    <section className="caja-admin">
      <div className="card card-pad caja-header">
        <div>
          <h2>💵 Caja</h2>
          <p className="muted">Arqueo para controlar Caja Registradora, Caja Azul y saldos de Bancolombia, Nequi, Rafa y Datafono.</p>
        </div>
        <label className="field caja-fecha-field">
          <span>Fecha</span>
          <input type="date" value={fechaCaja} onChange={(event) => setFechaCaja(event.target.value || obtenerFechaCajaHoy())} />
        </label>
      </div>

      {mensaje && <div className="alert alert-success caja-alert">{mensaje}</div>}
      {error && <div className="alert alert-error caja-alert">{error}</div>}
      {modalAlertaRafiki}
      {cargando && <div className="card card-pad muted small">Cargando caja guardada...</div>}

      <RafikiTabs tabs={tabsCaja} activeTab={tabCaja} onChange={setTabCaja} className="caja-tabs" ariaLabel="Secciones de caja" />

      <CajaResumenVisual
        totalInicio={totalInicio}
        totalFin={totalUltimoArqueoInforme}
        ventasTotal={ventasTotal}
        gastosTotal={gastosTotal + ajustesEgresosTotal}
        dineroEsperado={dineroEsperado}
        diferenciaReal={diferenciaReal}
        estadoDiferencia={estadoDiferencia}
        pedidosCantidad={cuadreReal?.pedidosCantidad || 0}
      />

      {tabCaja === "inicio" && <FormularioArqueo titulo="Inicio del día" descripcion="Registra la base inicial antes de empezar la operación. Puedes traer el último arqueo del día anterior, revisarlo y guardar manualmente." estado={inicioDia} setEstado={setInicioDia} guardando={guardandoInicio} onGuardar={guardarInicio} onTraerAnterior={traerUltimoArqueoAnteriorAInicio} />}
      {tabCaja === "fin" && <FormularioArqueo titulo="Arqueo" descripcion="Cuenta cajas y bancos en cualquier momento del día. Guarda el conteo y usa Arqueo Nuevo para archivarlo y empezar otro desde cero." estado={finDia} setEstado={setFinDia} guardando={guardandoFin} onGuardar={guardarFin} onNuevo={iniciarArqueoNuevo} />}

      {tabCaja === "historial" && (
        <div className="caja-formulario">
          <section className="card card-pad caja-informe-card">
            <div className="section-title-row caja-section-title caja-informe-title-row">
              <div>
                <h2>Historial de arqueos</h2>
                <p className="muted">Consulta los conteos realizados durante la fecha seleccionada sin mezclarlo con el formulario del arqueo actual.</p>
              </div>
              {cargandoCuadre && <span className="muted small">Actualizando...</span>}
            </div>
            <HistorialArqueos historial={historialArqueos} titulo="Arqueos realizados" />
          </section>
        </div>
      )}

      {tabCaja === "informe" && (
        <div className="caja-formulario">
          <section className="card card-pad caja-informe-card">
            <div className="section-title-row caja-section-title caja-informe-title-row">
              <div><h2>Informe Caja</h2><p className="muted">Resumen limpio de ventas, gastos, dinero esperado y arqueos realizados.</p></div>
              <div className="caja-informe-actions">
                {cargandoCuadre && <span className="muted small">Actualizando...</span>}
                <ThermalPrintControls
                  onPrint={imprimirInformeCajaTermico}
                  label="Imprimir"
                  title="Tamaño"
                  buttonClassName="btn secondary"
                />
                <button type="button" className="btn secondary" onClick={compartirInformeWhatsApp}>Compartir WhatsApp</button>
                <button type="button" className="btn secondary" onClick={exportarInformeExcel}>Exportar Excel</button>
              </div>
            </div>
            <div className="caja-informe-lista">
              <InicioDiaInforme estado={inicioDia} total={totalInicio} />
              <FilaInforme etiqueta={`Ventas del día (${cuadreReal?.pedidosCantidad || 0} pedidos)`} valor={ventasTotal} tipo="ingreso" />
              <section className="caja-informe-bloque caja-detalle-compacto">
                <FilaInforme etiqueta="Gastos operativos" valor={gastosTotal} fuerte tipo="egreso" />
                <button type="button" className="btn secondary" onClick={() => setModalGastosAbierto(true)}>Ver detalle de gastos</button>
              </section>
              <section className="caja-informe-bloque caja-ajustes-bloque caja-ajustes-compacto">
                <div className={`caja-informe-row fuerte ${ajustesNetosTotal > 0 ? "caja-movimiento-egreso" : ""}`}><span>Ajustes de Caja</span><strong>{dinero(Math.abs(ajustesNetosTotal))}</strong></div>
                <div className="caja-ajustes-resumen">
                  <span>Ingresos días anteriores: <strong>{dinero(ingresosDiasAnterioresTotal)}</strong></span>
                  <span>Gastos Rafa: <strong>{dinero(gastosRafaTotal)}</strong></span>
                  <span>Cuentas x cobrar: <strong>{dinero(cuentasPorCobrarTotal)}</strong></span>
                </div>
                <div className="caja-actions caja-ajustes-actions"><button type="button" className="btn secondary" onClick={() => setModalAjustesAbierto(true)}>Editar ajustes</button></div>
              </section>
              <FilaInforme etiqueta="Caja esperada" valor={dineroEsperado} fuerte />
              <SaldosUltimoArqueo arqueo={arqueoVigenteInforme} respaldo={finDia} />
              <FilaInforme etiqueta="Fin / arqueo contado" valor={totalUltimoArqueoInforme} />
              <section className="caja-informe-bloque caja-historial-resumen">
                <div className="caja-informe-row fuerte"><span>Arqueos realizados</span><strong>{arqueosInforme.length}</strong></div>
                <button type="button" className="btn secondary" onClick={() => setTabCaja("historial")}>Ver historial completo</button>
              </section>
              <div className="caja-resultado-final">
                <FilaInforme etiqueta={estadoDiferencia.etiqueta} valor={Math.abs(diferenciaReal)} fuerte estado={estadoDiferencia.clase} />
                <RafikiBadge tipo={tipoBadgeDiferencia(estadoDiferencia.clase)}>{estadoDiferencia.texto}</RafikiBadge>
              </div>
            </div>
            <p className="muted small caja-formula">Fórmula: inicio del día + ventas reales - gastos operativos - gastos Rafa - cuentas por cobrar = caja esperada. Diferencia: fin / arqueo contado + ingresos días anteriores - caja esperada. Los ingresos días anteriores no aumentan ventas del día.</p>
          </section>
        </div>
      )}

      <RafikiModal
        open={modalGastosAbierto}
        title="Detalle de gastos"
        description="Egresos operativos usados para calcular el informe de caja."
        onClose={() => setModalGastosAbierto(false)}
        size="lg"
      >
        <DetalleGastos gastos={cuadreReal?.gastosDetalle || []} total={gastosTotal} />
      </RafikiModal>

      <RafikiModal
        open={modalAjustesAbierto}
        title="Ajustes de Caja"
        description="Registra ajustes que afectan el cuadre de dinero sin modificar las ventas reales del día."
        onClose={() => setModalAjustesAbierto(false)}
        footer={(
          <button type="button" className="btn primary" onClick={guardarAjustesInformeCaja} disabled={guardandoAjustes}>
            {guardandoAjustes ? "Guardando..." : "Guardar ajustes"}
          </button>
        )}
      >
        <div className="caja-ajustes-grid">
          <label className="field">
            <span>Ingresos días anteriores</span>
            <input type="number" min="0" inputMode="numeric" value={ajustesCaja.ingresosDiasAnteriores} onChange={(event) => actualizarAjusteCaja("ingresosDiasAnteriores", event.target.value)} placeholder="0" />
            <small className="muted">Pagos recibidos hoy por ventas de días anteriores. No aumenta ventas ni caja esperada; se descuenta internamente del arqueo contado para calcular la diferencia.</small>
          </label>
          <label className="field">
            <span>Gastos Rafa</span>
            <input type="number" min="0" inputMode="numeric" value={ajustesCaja.gastosRafa} onChange={(event) => actualizarAjusteCaja("gastosRafa", event.target.value)} placeholder="0" />
            <small className="muted">Gastos personales o retiros del día. Resta a la caja esperada.</small>
          </label>
          <label className="field">
            <span>Cuentas x Cobrar</span>
            <input type="number" min="0" inputMode="numeric" value={ajustesCaja.cuentasPorCobrar} onChange={(event) => actualizarAjusteCaja("cuentasPorCobrar", event.target.value)} placeholder="0" />
            <small className="muted">Ventas reales que aún no han entrado en efectivo/banco. Resta a la caja esperada.</small>
          </label>
        </div>
      </RafikiModal>
    </section>
  );
}
