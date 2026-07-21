import { METODOS_PAGO, esMetodoPagoCredito, normalizarMetodoPago } from "../constants/paymentMethods";
import { aPesosEnteros } from "./money";
import { obtenerEstadoPedido } from "./pedidos";

function textoLimpio(valor) {
  return String(valor || "").trim().replace(/\s+/g, " ");
}

export function pedidoEstaDescartado(pedido = {}) {
  return obtenerEstadoPedido(pedido) === "Borrado";
}

export function pedidoDebeSalirDeCartera(pedido = {}) {
  return pedidoEstaDescartado(pedido) || !esMetodoPagoCredito(pedido.tipo_pago);
}

export function calcularEstadoMovimientoCredito({ total = 0, abonosAplicados = 0 } = {}) {
  const valor = Math.max(0, aPesosEnteros(total));
  const abonos = Math.max(0, aPesosEnteros(abonosAplicados));
  const saldo = Math.max(0, valor - abonos);

  return {
    valor,
    abonosAplicados: abonos,
    saldo,
    estado: saldo <= 0 ? "pagado" : abonos > 0 ? "parcial" : "pendiente",
  };
}

export function evaluarRetiroPedidoCredito({ pedido = {}, movimientosActivos = [], totalAbonos = 0, forzar = false } = {}) {
  const debeAnular = pedidoDebeSalirDeCartera(pedido);
  const cantidadMovimientos = Array.isArray(movimientosActivos) ? movimientosActivos.length : 0;
  const tieneAbonos = aPesosEnteros(totalAbonos) > 0;

  if (!debeAnular) {
    return { accion: "mantener_credito", debeAnular: false, permitido: true, tieneAbonos };
  }

  if (cantidadMovimientos === 0) {
    return { accion: "sin_movimientos", debeAnular: true, permitido: true, tieneAbonos };
  }

  if (tieneAbonos && !forzar) {
    return {
      accion: "bloquear",
      debeAnular: true,
      permitido: false,
      tieneAbonos: true,
      mensaje: "Este pedido ya tiene abonos registrados. Revisa el historial antes de retirarlo de crédito.",
    };
  }

  return { accion: "anular", debeAnular: true, permitido: true, tieneAbonos };
}

export function calcularResumenClienteCredito(movimientos = []) {
  const activos = (Array.isArray(movimientos) ? movimientos : []).filter(
    (movimiento) => String(movimiento?.estado || "").trim().toLowerCase() !== "anulado"
  );

  const saldoPendiente = activos.reduce((total, movimiento) => {
    const estado = String(movimiento?.estado || "").trim().toLowerCase();
    if (estado === "pagado") return total;
    return total + Math.max(0, aPesosEnteros(movimiento?.saldo_movimiento ?? movimiento?.valor));
  }, 0);

  const fechaUltimoPedido = activos
    .map((movimiento) => movimiento?.fecha_movimiento)
    .filter(Boolean)
    .sort()
    .pop() || null;

  return {
    totalPedidos: activos.length,
    saldoPendiente,
    fechaUltimoPedido,
  };
}

export function normalizarDatosAbono({ valorAbono = 0, metodoPago = METODOS_PAGO.EFECTIVO, observacion = "" } = {}) {
  const valor = aPesosEnteros(valorAbono);
  if (valor <= 0) throw new Error("El valor del abono debe ser mayor a cero.");

  return {
    valor,
    metodoPago: normalizarMetodoPago(metodoPago, {
      permitirCredito: false,
      fallback: METODOS_PAGO.EFECTIVO,
    }),
    observacion: textoLimpio(observacion),
  };
}

export function distribuirAbonoFIFO(movimientos = [], valorAbono = 0) {
  const valor = aPesosEnteros(valorAbono);
  const elegibles = (Array.isArray(movimientos) ? movimientos : [])
    .filter((movimiento) => {
      const estado = String(movimiento?.estado || "pendiente").trim().toLowerCase();
      const saldo = aPesosEnteros(movimiento?.saldo_movimiento ?? movimiento?.valor);
      return !["pagado", "anulado"].includes(estado) && saldo > 0;
    })
    .sort((a, b) => {
      const fechaA = new Date(a?.fecha_movimiento || a?.created_at || 0).getTime();
      const fechaB = new Date(b?.fecha_movimiento || b?.created_at || 0).getTime();
      if (fechaA !== fechaB) return fechaA - fechaB;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });

  const saldoTotal = elegibles.reduce(
    (total, movimiento) => total + aPesosEnteros(movimiento?.saldo_movimiento ?? movimiento?.valor),
    0
  );

  if (valor <= 0) throw new Error("El valor del abono debe ser mayor a cero.");
  if (saldoTotal <= 0) throw new Error("Este cliente no tiene cartera pendiente para abonar.");
  if (valor > saldoTotal) throw new Error("El abono no puede ser mayor al saldo pendiente del cliente.");

  let restante = valor;
  const aplicaciones = [];

  for (const movimiento of elegibles) {
    if (restante <= 0) break;
    const saldoAnterior = aPesosEnteros(movimiento.saldo_movimiento ?? movimiento.valor);
    const valorAplicado = Math.min(restante, saldoAnterior);
    const saldoNuevo = Math.max(0, saldoAnterior - valorAplicado);
    aplicaciones.push({
      movimientoId: movimiento.id,
      valorAplicado,
      saldoAnterior,
      saldoNuevo,
      estadoNuevo: saldoNuevo <= 0 ? "pagado" : "parcial",
    });
    restante -= valorAplicado;
  }

  return {
    valorAbono: valor,
    saldoAnteriorTotal: saldoTotal,
    saldoNuevoTotal: saldoTotal - valor,
    aplicaciones,
  };
}

export function resumirMovimientosCaja({ pedidos = [], gastos = [] } = {}) {
  const pedidosValidos = (Array.isArray(pedidos) ? pedidos : []).filter(
    (pedido) => obtenerEstadoPedido(pedido) !== "Borrado"
  );
  const gastosValidos = Array.isArray(gastos) ? gastos : [];

  return {
    pedidosValidos,
    gastosValidos,
    pedidosCantidad: pedidosValidos.length,
    gastosCantidad: gastosValidos.length,
    ventasTotal: pedidosValidos.reduce((total, pedido) => total + aPesosEnteros(pedido?.total), 0),
    gastosTotal: gastosValidos.reduce((total, gasto) => total + aPesosEnteros(gasto?.valor), 0),
  };
}

export function calcularCuadreCaja({
  inicio = 0,
  ventas = 0,
  gastosOperativos = 0,
  gastosRafa = 0,
  cuentasPorCobrar = 0,
  ingresosDiasAnteriores = 0,
  arqueoContado = 0,
} = {}) {
  const valores = {
    inicio: aPesosEnteros(inicio),
    ventas: aPesosEnteros(ventas),
    gastosOperativos: aPesosEnteros(gastosOperativos),
    gastosRafa: aPesosEnteros(gastosRafa),
    cuentasPorCobrar: aPesosEnteros(cuentasPorCobrar),
    ingresosDiasAnteriores: aPesosEnteros(ingresosDiasAnteriores),
    arqueoContado: aPesosEnteros(arqueoContado),
  };

  const cajaEsperada =
    valores.inicio
    + valores.ventas
    - valores.gastosOperativos
    - valores.gastosRafa
    - valores.cuentasPorCobrar;
  const diferencia = valores.arqueoContado + valores.ingresosDiasAnteriores - cajaEsperada;

  return {
    ...valores,
    cajaEsperada,
    diferencia,
    estado: Math.abs(diferencia) < 1 ? "cuadrado" : diferencia > 0 ? "sobra" : "falta",
  };
}
