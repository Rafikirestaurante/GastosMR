import { describe, expect, it } from "vitest";
import {
  calcularCuadreCaja,
  calcularEstadoMovimientoCredito,
  calcularResumenClienteCredito,
  distribuirAbonoFIFO,
  evaluarRetiroPedidoCredito,
  normalizarDatosAbono,
  pedidoDebeSalirDeCartera,
  resumirMovimientosCaja,
} from "../financialFlows";

describe("flujos financieros críticos · cartera", () => {
  it("crea una deuda pendiente por el total de un pedido crédito nuevo", () => {
    expect(calcularEstadoMovimientoCredito({ total: "45.000", abonosAplicados: 0 })).toEqual({
      valor: 45000,
      abonosAplicados: 0,
      saldo: 45000,
      estado: "pendiente",
    });
  });

  it("mantiene saldo parcial cuando el pedido ya tiene abonos", () => {
    expect(calcularEstadoMovimientoCredito({ total: 50000, abonosAplicados: 12000 })).toMatchObject({
      saldo: 38000,
      estado: "parcial",
    });
  });

  it("marca pagado cuando los abonos cubren o superan el total", () => {
    expect(calcularEstadoMovimientoCredito({ total: 50000, abonosAplicados: 50000 })).toMatchObject({ saldo: 0, estado: "pagado" });
    expect(calcularEstadoMovimientoCredito({ total: 50000, abonosAplicados: 60000 })).toMatchObject({ saldo: 0, estado: "pagado" });
  });

  it("detecta cambio de crédito a efectivo como retiro de cartera", () => {
    expect(pedidoDebeSalirDeCartera({ estado: "Finalizado", tipo_pago: "Efectivo" })).toBe(true);
  });

  it("detecta pedidos borrados, anulados o cancelados como retiro de cartera", () => {
    expect(pedidoDebeSalirDeCartera({ estado: "Borrado", tipo_pago: "Crédito" })).toBe(true);
    expect(pedidoDebeSalirDeCartera({ estado: "Anulado", tipo_pago: "Crédito" })).toBe(true);
    expect(pedidoDebeSalirDeCartera({ estado: "Cancelado", tipo_pago: "Crédito" })).toBe(true);
  });

  it("mantiene en cartera un pedido crédito válido", () => {
    expect(pedidoDebeSalirDeCartera({ estado: "Finalizado", tipo_pago: "Crédito" })).toBe(false);
  });

  it("bloquea retirar de crédito un pedido que ya tiene abonos", () => {
    const resultado = evaluarRetiroPedidoCredito({
      pedido: { estado: "Finalizado", tipo_pago: "Efectivo" },
      movimientosActivos: [{ id: "mov-1" }],
      totalAbonos: 10000,
    });
    expect(resultado.accion).toBe("bloquear");
    expect(resultado.permitido).toBe(false);
    expect(resultado.mensaje).toContain("abonos registrados");
  });

  it("permite el retiro forzado cuando existe revisión previa", () => {
    expect(evaluarRetiroPedidoCredito({
      pedido: { estado: "Borrado", tipo_pago: "Crédito" },
      movimientosActivos: [{ id: "mov-1" }],
      totalAbonos: 10000,
      forzar: true,
    })).toMatchObject({ accion: "anular", permitido: true });
  });

  it("omite de forma segura el retiro si no existen movimientos activos", () => {
    expect(evaluarRetiroPedidoCredito({
      pedido: { estado: "Borrado", tipo_pago: "Crédito" },
      movimientosActivos: [],
      totalAbonos: 0,
    })).toMatchObject({ accion: "sin_movimientos", permitido: true });
  });

  it("recalcula el resumen del cliente excluyendo movimientos anulados y saldos pagados", () => {
    const resumen = calcularResumenClienteCredito([
      { id: "1", estado: "pendiente", saldo_movimiento: 30000, fecha_movimiento: "2026-07-01T10:00:00-05:00" },
      { id: "2", estado: "parcial", saldo_movimiento: 12000, fecha_movimiento: "2026-07-03T10:00:00-05:00" },
      { id: "3", estado: "pagado", saldo_movimiento: 0, fecha_movimiento: "2026-07-04T10:00:00-05:00" },
      { id: "4", estado: "anulado", saldo_movimiento: 90000, fecha_movimiento: "2026-07-05T10:00:00-05:00" },
    ]);
    expect(resumen).toEqual({
      totalPedidos: 3,
      saldoPendiente: 42000,
      fechaUltimoPedido: "2026-07-04T10:00:00-05:00",
    });
  });
});

describe("flujos financieros críticos · abonos", () => {
  const movimientos = [
    { id: "nuevo", estado: "pendiente", saldo_movimiento: 30000, fecha_movimiento: "2026-07-10T10:00:00-05:00" },
    { id: "antiguo", estado: "pendiente", saldo_movimiento: 20000, fecha_movimiento: "2026-07-01T10:00:00-05:00" },
    { id: "anulado", estado: "anulado", saldo_movimiento: 50000, fecha_movimiento: "2026-06-01T10:00:00-05:00" },
  ];

  it("normaliza valores enteros, método de pago y observación", () => {
    expect(normalizarDatosAbono({ valorAbono: "$ 12.500", metodoPago: "tarjeta", observacion: "  Pago   parcial " })).toEqual({
      valor: 12500,
      metodoPago: "Datafono",
      observacion: "Pago parcial",
    });
  });

  it("impide usar crédito como método de un abono", () => {
    expect(normalizarDatosAbono({ valorAbono: 10000, metodoPago: "Crédito" }).metodoPago).toBe("Efectivo");
  });

  it("rechaza abonos en cero o negativos", () => {
    expect(() => normalizarDatosAbono({ valorAbono: 0 })).toThrow("mayor a cero");
    expect(() => normalizarDatosAbono({ valorAbono: -5000 })).toThrow("mayor a cero");
  });

  it("aplica el abono al pedido más antiguo primero", () => {
    const resultado = distribuirAbonoFIFO(movimientos, 15000);
    expect(resultado.aplicaciones).toEqual([
      {
        movimientoId: "antiguo",
        valorAplicado: 15000,
        saldoAnterior: 20000,
        saldoNuevo: 5000,
        estadoNuevo: "parcial",
      },
    ]);
    expect(resultado.saldoNuevoTotal).toBe(35000);
  });

  it("distribuye un abono entre varios pedidos y marca pagado el primero", () => {
    const resultado = distribuirAbonoFIFO(movimientos, 25000);
    expect(resultado.aplicaciones).toHaveLength(2);
    expect(resultado.aplicaciones[0]).toMatchObject({ movimientoId: "antiguo", valorAplicado: 20000, saldoNuevo: 0, estadoNuevo: "pagado" });
    expect(resultado.aplicaciones[1]).toMatchObject({ movimientoId: "nuevo", valorAplicado: 5000, saldoNuevo: 25000, estadoNuevo: "parcial" });
  });

  it("permite un abono exacto por toda la deuda", () => {
    const resultado = distribuirAbonoFIFO(movimientos, 50000);
    expect(resultado.saldoNuevoTotal).toBe(0);
    expect(resultado.aplicaciones.every((item) => item.estadoNuevo === "pagado")).toBe(true);
  });

  it("rechaza abonos superiores a la deuda", () => {
    expect(() => distribuirAbonoFIFO(movimientos, 50001)).toThrow("mayor al saldo pendiente");
  });

  it("rechaza abonos cuando no existe cartera pendiente", () => {
    expect(() => distribuirAbonoFIFO([{ id: "1", estado: "pagado", saldo_movimiento: 0 }], 1000)).toThrow("no tiene cartera pendiente");
  });
});

describe("flujos financieros críticos · ventas y gastos de caja", () => {
  it("excluye pedidos borrados, anulados y cancelados de las ventas", () => {
    const resumen = resumirMovimientosCaja({
      pedidos: [
        { id: "1", estado: "Finalizado", tipo_pago: "Efectivo", total: 20000 },
        { id: "2", estado: "Finalizado", tipo_pago: "Crédito", total: 30000 },
        { id: "3", estado: "Borrado", total: 40000 },
        { id: "4", estado: "Anulado", total: 50000 },
        { id: "5", estado: "Cancelado", total: 60000 },
      ],
      gastos: [{ valor: 10000 }, { valor: "5.000" }],
    });

    expect(resumen.pedidosCantidad).toBe(2);
    expect(resumen.ventasTotal).toBe(50000);
    expect(resumen.gastosCantidad).toBe(2);
    expect(resumen.gastosTotal).toBe(15000);
  });

  it("incluye ventas a crédito dentro del total vendido del día", () => {
    expect(resumirMovimientosCaja({
      pedidos: [{ estado: "Finalizado", tipo_pago: "Crédito", total: 45000 }],
    }).ventasTotal).toBe(45000);
  });
});

describe("flujos financieros críticos · caja", () => {
  it("calcula caja esperada con ventas, gastos y cuentas por cobrar", () => {
    const resultado = calcularCuadreCaja({
      inicio: 100000,
      ventas: 900000,
      gastosOperativos: 120000,
      gastosRafa: 30000,
      cuentasPorCobrar: 50000,
      arqueoContado: 800000,
    });
    expect(resultado.cajaEsperada).toBe(800000);
    expect(resultado.diferencia).toBe(0);
    expect(resultado.estado).toBe("cuadrado");
  });

  it("los ingresos de días anteriores no aumentan ventas ni caja esperada", () => {
    const sinIngreso = calcularCuadreCaja({ inicio: 100000, ventas: 500000, arqueoContado: 600000 });
    const conIngreso = calcularCuadreCaja({ inicio: 100000, ventas: 500000, ingresosDiasAnteriores: 80000, arqueoContado: 520000 });
    expect(conIngreso.cajaEsperada).toBe(sinIngreso.cajaEsperada);
    expect(conIngreso.ventas).toBe(500000);
    expect(conIngreso.diferencia).toBe(0);
  });

  it("resta los ingresos de días anteriores del arqueo para la diferencia final", () => {
    const resultado = calcularCuadreCaja({
      inicio: 100000,
      ventas: 500000,
      ingresosDiasAnteriores: 80000,
      arqueoContado: 530000,
    });
    expect(resultado.cajaEsperada).toBe(600000);
    expect(resultado.diferencia).toBe(10000);
    expect(resultado.estado).toBe("sobra");
  });

  it("detecta faltante de caja", () => {
    expect(calcularCuadreCaja({ inicio: 100000, ventas: 500000, arqueoContado: 570000 })).toMatchObject({
      cajaEsperada: 600000,
      diferencia: -30000,
      estado: "falta",
    });
  });

  it("normaliza valores monetarios escritos con separadores", () => {
    expect(calcularCuadreCaja({ inicio: "$100.000", ventas: "900.000", gastosOperativos: "120.000", arqueoContado: "880.000" })).toMatchObject({
      cajaEsperada: 880000,
      diferencia: 0,
    });
  });
});
