import { describe, expect, it } from "vitest";
import {
  limpiarLista,
  limpiarPrecio,
  generarTextoEditorMenu,
  generarTextoAcompanantesEditor
} from "../generadorMenu";

describe("utils/generadorMenu", () => {
  it("convierte texto por líneas en una lista limpia", () => {
    expect(limpiarLista("Arroz\n\n Ensalada \nPuré")).toEqual(["Arroz", "Ensalada", "Puré"]);
  });

  it("limpia precios dejando solo números y punto", () => {
    expect(limpiarPrecio("$16.000 COP")).toBe("16.000");
  });

  it("genera el texto del editor separando pechuga/cerdo, sopas y productos fijos", () => {
    const texto = generarTextoEditorMenu([
      { nombre: "Pastas boloñesa", precio: "17.000" },
      { nombre: "Pechuga o cerdo en salsa miel mostaza", precio: "16000" },
      { nombre: "Sancocho de costilla", precio: "17.000" }
    ]);

    expect(texto).toContain("Platos | pastas boloñesa:17000");
    expect(texto).toContain("Platos | pechuga en salsa miel mostaza:16000");
    expect(texto).toContain("Platos | cerdo en salsa miel mostaza:16000");
    expect(texto).toContain("Sopas | sancocho de costilla:17000");
    expect(texto).toContain("Platos | Pechuga Asada sin salsa:16000");
    expect(texto).toContain("Sopas | Sancocho de pollo con arroz:15000");
  });

  it("genera acompañantes separados por 'o' y agrega Solo esos dos", () => {
    expect(generarTextoAcompanantesEditor(["Arroz de cebolla", "Tajadas o lentejas"])).toBe(
      "Arroz de cebolla\nTajadas\nlentejas\nSolo esos dos"
    );
  });
});
