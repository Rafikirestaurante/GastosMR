import { describe, expect, it } from "vitest";
import {
  crearMensajeSolicitudProductos,
  obtenerProductosSolicitudSeleccionados,
  ordenarProductosPorNombre
} from "../solicitudProductos";

describe("utils/solicitudProductos", () => {
  it("ordena productos por nombre", () => {
    const productos = [{ nombre: "Tocineta" }, { nombre: "Jamón" }, { nombre: "Pechuga" }];
    expect(ordenarProductosPorNombre(productos).map((p) => p.nombre)).toEqual(["Jamón", "Pechuga", "Tocineta"]);
  });

  it("obtiene productos seleccionados normalizando campos", () => {
    const productos = [
      { nombre: "Jamón", seleccionada: true, cantidad: " 2 ", unidad: "und", nota: "" },
      { nombre: "Queso", seleccionada: false, cantidad: "5" }
    ];

    expect(obtenerProductosSolicitudSeleccionados(productos)).toEqual([
      { nombre: "Jamón", seleccionada: true, cantidad: "2", unidad: "und", nota: "" }
    ]);
  });

  it("crea mensaje de solicitud con formato por categorías", () => {
    const mensaje = crearMensajeSolicitudProductos({
      fechaSolicitud: "2026-05-17",
      fechaPara: "2026-05-18",
      productos: [
        { categoria: "Carnes", nombre: "Pechuga", cantidad: "2", unidad: "kg", nota: "" },
        { categoria: "Carnes", nombre: "Tocineta", cantidad: "1", unidad: "kg", nota: "bien tajada" }
      ],
      observaciones: "Enviar temprano"
    });

    expect(mensaje).toContain("Fecha de solicitud: 2026-05-17");
    expect(mensaje).toContain("*Carnes*");
    expect(mensaje).toContain("• Pechuga: 2 kg");
    expect(mensaje).toContain("• Tocineta: 1 kg — bien tajada");
    expect(mensaje).toContain("Observaciones: Enviar temprano");
  });
});
