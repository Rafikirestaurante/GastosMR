import fs from "fs";
import path from "path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];

function check(nombre, condicion) {
  checks.push({ nombre, condicion: Boolean(condicion) });
}

const service = read("src/modules/impresion/thermalReportService.js");
const controls = read("src/modules/impresion/ThermalPrintControls.jsx");
const styles = read("src/styles/app.css");
const pedidos = read("src/modules/admin/components/pedidos/AdminPedidosSection.jsx");
const caja = read("src/modules/caja/components/CajaAdmin.jsx");
const gastos = read("src/modules/gastos/components/GastosDiarios.jsx");
const cartera = read("src/modules/cartera/components/CarteraClientesCredito.jsx");
const pkg = JSON.parse(read("package.json"));

check(
  "Servicio térmico guarda preferencia global",
  service.includes("THERMAL_REPORT_FORMAT_STORAGE_KEY") &&
    service.includes("obtenerFormatoTermicoPreferido") &&
    service.includes("guardarFormatoTermicoPreferido")
);
check(
  "Componente selector térmico existe",
  controls.includes("ThermalPrintControls") &&
    controls.includes("select") &&
    controls.includes("onPrint?.(formato)")
);
check(
  "Selector conserva 58 y 80",
  controls.includes('<option value="80">80 mm</option>') &&
    controls.includes('<option value="58">58 mm</option>')
);
check("Selector declara misma información", controls.includes("Misma información, optimizada al ancho"));
check(
  "Estilos del selector térmico existen",
  styles.includes("thermal-print-controls") && styles.includes("thermal-print-format")
);
check(
  "Pedidos Hoy usa selector térmico",
  pedidos.includes("ThermalPrintControls") && pedidos.includes("onPrint={imprimirPedidosFiltradosTermico}")
);
check(
  "Caja usa selector térmico",
  caja.includes("ThermalPrintControls") && caja.includes("onPrint={imprimirInformeCajaTermico}")
);
check(
  "Gastos usa selector térmico",
  gastos.includes("ThermalPrintControls") && gastos.includes("onPrint={imprimirGastosTermico}")
);
check(
  "Cartera usa selector térmico en resumen y movimientos",
  cartera.includes("onPrint={imprimirResumenCarteraTermico}") &&
    cartera.includes("onPrint={imprimirMovimientosCarteraTermico}")
);
check(
  "package.json incluye validador",
  pkg.scripts?.["thermal-selector:check"] === "node scripts/validate-thermal-selector.mjs"
);

const errores = checks.filter((item) => !item.condicion);
if (errores.length) {
  console.error("Validación selector térmico falló:");
  errores.forEach((error) => console.error(`- ${error.nombre}`));
  process.exit(1);
}

console.log("Validación selector térmico OK");
