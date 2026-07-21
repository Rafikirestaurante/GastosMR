import { describe, expect, it } from "vitest";
import { fechaColombiaYYYYMMDD, fechaDentroRangoColombia, formatearFechaColombia } from "../fechasColombia";

describe("utils/fechasColombia", () => {
  it("convierte timestamps UTC a la fecha operativa de Colombia", () => {
    expect(fechaColombiaYYYYMMDD("2026-06-21T04:30:00.000Z")).toBe("2026-06-20");
  });

  it("filtra rangos usando fecha Colombia y no el día UTC", () => {
    expect(fechaDentroRangoColombia("2026-06-21T04:30:00.000Z", "2026-06-20", "2026-06-20")).toBe(true);
    expect(fechaDentroRangoColombia("2026-06-21T05:30:00.000Z", "2026-06-20", "2026-06-20")).toBe(false);
  });

  it("formatea fechas visibles en español Colombia", () => {
    expect(formatearFechaColombia("2026-06-21T04:30:00.000Z")).toBe("20/06/2026");
    expect(formatearFechaColombia("2026-06-20")).toBe("20/06/2026");
  });
});
