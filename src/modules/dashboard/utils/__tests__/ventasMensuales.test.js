import { describe, expect, it } from "vitest";
import {
  crearResumenVentasMensuales,
  desplazarMes,
  obtenerNivelVentaDia,
  obtenerOffsetCalendarioLunes,
  obtenerRangoMesColombia
} from "../ventasMensuales";

describe("dashboard/ventasMensuales", () => {
  it("calcula el rango mensual usando la zona horaria de Colombia", () => {
    expect(obtenerRangoMesColombia("2026-07")).toEqual({
      inicioTexto: "2026-07-01",
      finTexto: "2026-07-31",
      finExclusivoTexto: "2026-08-01",
      inicio: "2026-07-01T05:00:00.000Z",
      fin: "2026-08-01T05:00:00.000Z"
    });
  });

  it("agrupa ventas y gastos por fecha Colombia y excluye pedidos borrados", () => {
    const resumen = crearResumenVentasMensuales([
      { created_at: "2026-07-03T15:00:00.000Z", total: 20000, estado: "Finalizado" },
      { created_at: "2026-07-03T23:30:00.000Z", total: 10000, estado: "Pendiente" },
      { created_at: "2026-07-04T02:00:00.000Z", total: 5000, estado: "Borrado" },
      { created_at: "2026-08-01T04:30:00.000Z", total: 30000, estado: "Finalizado" }
    ], [
      { fecha: "2026-07-03", valor: 8000 },
      { fecha: "2026-07-03", valor: 2000 },
      { fecha: "2026-07-31", valor: 5000 },
      { fecha: "2026-08-01", valor: 9999 }
    ], "2026-07");

    const dia3 = resumen.dias.find((dia) => dia.dia === 3);
    const dia31 = resumen.dias.find((dia) => dia.dia === 31);

    expect(resumen.totalMes).toBe(60000);
    expect(resumen.totalGastos).toBe(15000);
    expect(resumen.resultadoMes).toBe(45000);
    expect(resumen.totalPedidos).toBe(3);
    expect(dia3.total).toBe(30000);
    expect(dia3.gastos).toBe(10000);
    expect(dia3.resultado).toBe(20000);
    expect(dia3.pedidos).toBe(2);
    expect(dia31.total).toBe(30000);
    expect(dia31.gastos).toBe(5000);
    expect(dia31.resultado).toBe(25000);
  });

  it("construye navegación, calendario lunes primero y niveles de barras", () => {
    expect(desplazarMes("2026-01", -1)).toBe("2025-12");
    expect(desplazarMes("2026-12", 1)).toBe("2027-01");
    expect(obtenerOffsetCalendarioLunes("2026-07")).toBe(2);
    expect(obtenerNivelVentaDia(0, 100)).toBe(0);
    expect(obtenerNivelVentaDia(25, 100)).toBe(1);
    expect(obtenerNivelVentaDia(35, 100)).toBe(2);
    expect(obtenerNivelVentaDia(60, 100)).toBe(3);
    expect(obtenerNivelVentaDia(90, 100)).toBe(4);
  });
});
