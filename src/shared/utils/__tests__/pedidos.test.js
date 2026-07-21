import { describe, expect, it } from "vitest";
import {
  dinero,
  esItemCafeteria,
  formatoNumeroPedido,
  limpiarTelefono,
  limpiarTexto,
  normalizarTexto,
  textoParaLlevarItem,
  valorParaLlevarItem
} from "../pedidos";

describe("utils/pedidos", () => {
  it("limpia texto peligroso y espacios repetidos", () => {
    expect(limpiarTexto("  Hola   <Rafiki>  ")).toBe("Hola Rafiki");
  });

  it("limpia teléfonos conservando números y símbolos útiles", () => {
    expect(limpiarTelefono("Tel: +57 (300) 123-45xx")).toBe("+57 (300) 123-45");
  });

  it("formatea el número de pedido con cuatro dígitos", () => {
    expect(formatoNumeroPedido(25)).toBe("0025");
    expect(formatoNumeroPedido(null)).toBe("----");
  });

  it("normaliza texto con tildes", () => {
    expect(normalizarTexto("  Café con Leche  ")).toBe("cafe con leche");
  });

  it("detecta productos de cafetería", () => {
    expect(esItemCafeteria({ tipo: "Batido cremoso", producto: "Milo" })).toBe(true);
    expect(esItemCafeteria({ categoria: "Almuerzo", plato: "Pechuga" })).toBe(false);
  });

  it("calcula empaque para llevar según tipo de producto", () => {
    expect(valorParaLlevarItem({ paraLlevar: true, categoria: "Almuerzo", plato: "Pechuga" })).toBe(1500);
    expect(valorParaLlevarItem({ paraLlevar: true, categoria: "cafeteria", tipo: "Batido", producto: "Milo" })).toBe(0);
    expect(valorParaLlevarItem({ paraLlevar: true, categoria: "cafeteria", tipo: "Desayuno", producto: "Huevos" })).toBe(1000);
  });

  it("genera texto de empaque claro", () => {
    expect(textoParaLlevarItem({ paraLlevar: false })).toBe("Sin empaque para llevar");
    expect(textoParaLlevarItem({ paraLlevar: true, categoria: "cafeteria", tipo: "Batido" })).toBe(
      "Para llevar sin costo adicional"
    );
    expect(textoParaLlevarItem({ paraLlevar: true, categoria: "Almuerzo", plato: "Carne" })).toBe(
      `Para llevar +${dinero(1500)}`
    );
  });
});
