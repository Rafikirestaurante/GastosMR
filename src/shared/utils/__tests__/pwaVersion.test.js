import { describe, expect, it, vi } from "vitest";
import {
  esVersionRemotaMasNueva,
  guardarVersionActual,
  obtenerVersionGuardada,
  RAFIKI_APP_VERSION
} from "../pwaVersion";

describe("utils/pwaVersion", () => {
  it("detecta cuando la versión remota es diferente", () => {
    expect(esVersionRemotaMasNueva("999Z-2026-05-18")).toBe(true);
    expect(esVersionRemotaMasNueva(RAFIKI_APP_VERSION)).toBe(false);
    expect(esVersionRemotaMasNueva("")).toBe(false);
  });

  it("guarda y lee la versión actual", () => {
    const storage = {
      valor: "",
      getItem: vi.fn(() => storage.valor),
      setItem: vi.fn((_, valor) => {
        storage.valor = valor;
      })
    };

    guardarVersionActual(storage);
    expect(obtenerVersionGuardada(storage)).toBe(RAFIKI_APP_VERSION);
  });
});
