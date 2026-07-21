import fs from "node:fs";
import path from "node:path";
import { versionRafikiEsAlMenos } from "./validation-utils.mjs";

const root = process.cwd();
const leer = (archivo) => fs.readFileSync(path.join(root, archivo), "utf8");
const archivos = {
  componente: leer("src/modules/dashboard/components/VentasMensualesDashboard.jsx"),
  estilos: leer("src/styles/app.css"),
  version: leer("src/config/rafikiBuild.js"),
  documento: leer("docs/FASE36B1B-GRAFICO-BARRAS-FILTROS.md")
};

const validaciones = [
  ["La fase visible es 36B.1B", archivos.componente.includes("Fase 36B.1B")],
  ["Existe configuración de métricas", archivos.componente.includes("const METRICAS_BARRAS")],
  ["Incluye filtro Ventas", archivos.componente.includes('etiqueta: "Ventas"')],
  ["Incluye filtro Pedidos", archivos.componente.includes('etiqueta: "Pedidos"')],
  ["Incluye filtro Ticket promedio", archivos.componente.includes('etiqueta: "Ticket promedio"')],
  ["La métrica inicial es ventas", archivos.componente.includes('useState("ventas")')],
  ["La escala depende del indicador activo", archivos.componente.includes("dia?.[configuracion.campo]")],
  ["Calcula el mejor día por indicador", archivos.componente.includes("obtenerMejorDiaMetrica")],
  ["Muestra acumulado o indicador mensual", archivos.componente.includes("configuracion.etiquetaPrincipal")],
  ["Muestra promedio contextual", archivos.componente.includes("configuracion.etiquetaPromedio")],
  ["Muestra mayor valor diario", archivos.componente.includes("Mayor valor diario")],
  ["Los filtros informan estado accesible", archivos.componente.includes("aria-pressed={metrica === clave}")],
  [
    "Cada barra conserva apertura del detalle",
    archivos.componente.includes("onClick={() => onSeleccionarDia(dia)}")
  ],
  ["El detalle conserva total de gastos", archivos.componente.includes("Total de gastos")],
  ["Hay estilos responsivos de filtros", archivos.estilos.includes(".ventas-barras-filtros")],
  ["Hay estilos para el resumen de barras", archivos.estilos.includes(".ventas-barras-resumen")],
  ["Existe documentación de la subfase", archivos.documento.includes("Fase 36B.1B")],
  ["Versión es 127.1 o posterior", versionRafikiEsAlMenos(archivos.version, "127.1")]
];

let fallos = 0;
for (const [mensaje, ok] of validaciones) {
  console.log(`${ok ? "✓" : "✗"} ${mensaje}`);
  if (!ok) fallos += 1;
}

if (fallos > 0) {
  console.error(`\nValidación gráfico de barras FALLÓ: ${fallos} problema(s).`);
  process.exit(1);
}

console.log("\nValidación gráfico de barras 36B.1B OK.");
