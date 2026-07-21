import fs from "node:fs";
import path from "node:path";

export const ROOT = process.cwd();

export function leerArchivo(ruta) {
  return fs.readFileSync(path.join(ROOT, ruta), "utf8");
}

export function leerJson(ruta) {
  return JSON.parse(leerArchivo(ruta));
}

export function extraerVersionRafiki(valor = "") {
  const coincidencia = String(valor).match(/\b(\d+)(?:\.(\d+))?-/);
  if (!coincidencia) return null;

  return {
    mayor: Number(coincidencia[1]),
    menor: Number(coincidencia[2] || 0),
    texto: coincidencia[0].slice(0, -1)
  };
}

export function compararVersionesRafiki(a, b) {
  const versionA = typeof a === "string" ? extraerVersionRafiki(`${a}-`) : a;
  const versionB = typeof b === "string" ? extraerVersionRafiki(`${b}-`) : b;

  if (!versionA || !versionB) return null;
  if (versionA.mayor !== versionB.mayor) return versionA.mayor - versionB.mayor;
  return versionA.menor - versionB.menor;
}

export function versionRafikiEsAlMenos(valor, minima) {
  const actual = extraerVersionRafiki(valor);
  const requerida = extraerVersionRafiki(`${minima}-`);
  const comparacion = compararVersionesRafiki(actual, requerida);
  return comparacion !== null && comparacion >= 0;
}

export function obtenerVersionBuild() {
  const build = leerArchivo("src/config/rafikiBuild.js");
  return build.match(/version:\s*["']([^"']+)["']/)?.[1] || "";
}

export function obtenerVersionPublica() {
  return String(leerJson("public/rafiki-version.json").version || "");
}
