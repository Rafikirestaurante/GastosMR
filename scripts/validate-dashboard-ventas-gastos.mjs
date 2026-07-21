import fs from "node:fs";
import path from "node:path";
import { versionRafikiEsAlMenos } from "./validation-utils.mjs";

const root = process.cwd();
const leer = (archivo) => fs.readFileSync(path.join(root, archivo), "utf8");
const archivos = {
  componente: leer("src/modules/dashboard/components/VentasMensualesDashboard.jsx"),
  utilidad: leer("src/modules/dashboard/utils/ventasMensuales.js"),
  servicio: leer("src/services/dashboardService.js"),
  panel: leer("src/modules/dashboard/components/PanelRafaPrivado.jsx"),
  version: leer("src/config/rafikiBuild.js")
};

const validaciones = [
  ["Dashboard integra el módulo mensual", archivos.panel.includes("<VentasMensualesDashboard")],
  [
    "Existe vista Calendario",
    archivos.componente.includes('setVista("calendario")') && archivos.componente.includes("Calendario")
  ],
  [
    "Existe vista Barras",
    archivos.componente.includes('setVista("barras")') && archivos.componente.includes("Barras")
  ],
  [
    "Existe vista combinada",
    archivos.componente.includes('setVista("ambos")') && archivos.componente.includes("Ambos")
  ],
  ["Carga gastos del rango mensual", archivos.componente.includes("cargarGastosDashboardRango")],
  ["Muestra gastos del mes", archivos.componente.includes('etiqueta="Gastos del mes"')],
  ["Muestra total de gastos diario", archivos.componente.includes("Total de gastos")],
  ["Muestra resultado diario", archivos.componente.includes("Resultado ventas - gastos")],
  ["No muestra desglose por forma de pago", !archivos.componente.includes("Ventas por forma de pago")],
  ["Agrupa gastos por fecha", archivos.utilidad.includes("dia.gastos +=")],
  ["Calcula resultado mensual", archivos.utilidad.includes("resultadoMes: totalMes - totalGastos")],
  ["Excluye pedidos borrados", archivos.utilidad.includes('obtenerEstadoPedido(pedido) === "Borrado"')],
  ["Servicio expone carga de gastos", archivos.servicio.includes("cargarGastosDashboardRango")],
  [
    "Versión es 127.0 o posterior",
    versionRafikiEsAlMenos(archivos.version, "127.0")
  ]
];

let fallos = 0;
for (const [mensaje, ok] of validaciones) {
  console.log(`${ok ? "✓" : "✗"} ${mensaje}`);
  if (!ok) fallos += 1;
}

if (fallos > 0) {
  console.error(`\nValidación Dashboard ventas/gastos FALLÓ: ${fallos} problema(s).`);
  process.exit(1);
}

console.log("\nValidación Dashboard ventas/gastos OK.");
