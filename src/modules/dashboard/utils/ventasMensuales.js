import { fechaColombiaYYYYMMDD } from "../../../shared/utils/fechasColombia";
import { aPesosEnteros } from "../../../shared/utils/money";
import { obtenerEstadoPedido } from "../../../shared/utils/pedidos";

const NOMBRES_DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function mesValido(mes) {
  return typeof mes === "string" && /^\d{4}-\d{2}$/.test(mes);
}

function fechaUtcMediodia(year, monthIndex, day = 1) {
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
}

export function obtenerMesColombia(valor = new Date()) {
  return fechaColombiaYYYYMMDD(valor).slice(0, 7);
}

export function desplazarMes(mes, cantidad = 0) {
  const mesBase = mesValido(mes) ? mes : obtenerMesColombia();
  const [year, month] = mesBase.split("-").map(Number);
  const fecha = fechaUtcMediodia(year, month - 1 + Number(cantidad || 0));
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function obtenerRangoMesColombia(mes) {
  const mesBase = mesValido(mes) ? mes : obtenerMesColombia();
  const [year, month] = mesBase.split("-").map(Number);
  const siguiente = fechaUtcMediodia(year, month);
  const siguienteMes = `${siguiente.getUTCFullYear()}-${String(siguiente.getUTCMonth() + 1).padStart(2, "0")}-01`;

  return {
    inicioTexto: `${mesBase}-01`,
    finTexto: `${mesBase}-${String(obtenerDiasDelMes(mesBase)).padStart(2, "0")}`,
    finExclusivoTexto: siguienteMes,
    inicio: new Date(`${mesBase}-01T00:00:00-05:00`).toISOString(),
    fin: new Date(`${siguienteMes}T00:00:00-05:00`).toISOString()
  };
}

export function formatearNombreMes(mes) {
  const mesBase = mesValido(mes) ? mes : obtenerMesColombia();
  const [year, month] = mesBase.split("-").map(Number);
  const texto = new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(fechaUtcMediodia(year, month - 1));

  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function obtenerDiasDelMes(mes) {
  const mesBase = mesValido(mes) ? mes : obtenerMesColombia();
  const [year, month] = mesBase.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function obtenerOffsetCalendarioLunes(mes) {
  const mesBase = mesValido(mes) ? mes : obtenerMesColombia();
  const [year, month] = mesBase.split("-").map(Number);
  const diaSemanaDomingoCero = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return (diaSemanaDomingoCero + 6) % 7;
}

function crearDia(mes, dia) {
  const fecha = `${mes}-${String(dia).padStart(2, "0")}`;
  return {
    fecha,
    dia,
    total: 0,
    pedidos: 0,
    ticketPromedio: 0,
    gastos: 0,
    resultado: 0
  };
}

export function crearResumenVentasMensuales(pedidos = [], gastos = [], mes = obtenerMesColombia()) {
  const mesBase = mesValido(mes) ? mes : obtenerMesColombia();
  const cantidadDias = obtenerDiasDelMes(mesBase);
  const dias = Array.from({ length: cantidadDias }, (_, index) => crearDia(mesBase, index + 1));
  const porFecha = new Map(dias.map((dia) => [dia.fecha, dia]));

  (pedidos || []).forEach((pedido) => {
    if (obtenerEstadoPedido(pedido) === "Borrado") return;

    const fecha = fechaColombiaYYYYMMDD(pedido?.created_at);
    if (!fecha || !fecha.startsWith(`${mesBase}-`)) return;

    const dia = porFecha.get(fecha);
    if (!dia) return;

    const total = Math.max(aPesosEnteros(pedido?.total), 0);
    dia.total += total;
    dia.pedidos += 1;
  });

  (gastos || []).forEach((gasto) => {
    const fecha = String(gasto?.fecha || "").slice(0, 10);
    if (!fecha || !fecha.startsWith(`${mesBase}-`)) return;

    const dia = porFecha.get(fecha);
    if (!dia) return;

    dia.gastos += Math.max(aPesosEnteros(gasto?.valor), 0);
  });

  dias.forEach((dia) => {
    dia.ticketPromedio = dia.pedidos > 0 ? Math.round(dia.total / dia.pedidos) : 0;
    dia.resultado = dia.total - dia.gastos;
  });

  const diasConVenta = dias.filter((dia) => dia.pedidos > 0);
  const totalMes = dias.reduce((suma, dia) => suma + dia.total, 0);
  const totalGastos = dias.reduce((suma, dia) => suma + dia.gastos, 0);
  const totalPedidos = dias.reduce((suma, dia) => suma + dia.pedidos, 0);
  const mejorDia = diasConVenta.reduce((mejor, dia) => {
    if (!mejor) return dia;
    if (dia.total > mejor.total) return dia;
    if (dia.total === mejor.total && dia.pedidos > mejor.pedidos) return dia;
    return mejor;
  }, null);
  const maximoDiario = mejorDia?.total || 0;

  return {
    mes: mesBase,
    nombreMes: formatearNombreMes(mesBase),
    encabezados: NOMBRES_DIAS,
    offsetInicio: obtenerOffsetCalendarioLunes(mesBase),
    dias,
    totalMes,
    totalGastos,
    resultadoMes: totalMes - totalGastos,
    totalPedidos,
    diasConVenta: diasConVenta.length,
    promedioDiario: diasConVenta.length > 0 ? Math.round(totalMes / diasConVenta.length) : 0,
    ticketPromedio: totalPedidos > 0 ? Math.round(totalMes / totalPedidos) : 0,
    mejorDia,
    maximoDiario
  };
}

export function obtenerNivelVentaDia(total, maximo) {
  const valor = Math.max(Number(total) || 0, 0);
  const base = Math.max(Number(maximo) || 0, 0);
  if (valor <= 0 || base <= 0) return 0;
  const proporcion = valor / base;
  if (proporcion >= 0.8) return 4;
  if (proporcion >= 0.55) return 3;
  if (proporcion >= 0.3) return 2;
  return 1;
}
