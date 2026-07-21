import fs from "fs";
import path from "path";
import { obtenerVersionBuild, obtenerVersionPublica, versionRafikiEsAlMenos } from "./validation-utils.mjs";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];

function check(nombre, condicion, detalle = "") {
  checks.push({ nombre, condicion: Boolean(condicion), detalle });
}

const caja = read("src/modules/caja/components/CajaAdmin.jsx");
const service = read("src/modules/impresion/thermalReportService.js");

check("Caja usa servicio térmico central", caja.includes("imprimirReporteTermico") && caja.includes("imprimirInformeCajaTermico"));
check("Caja conserva impresión 58 y 80 mediante selector", caja.includes("ThermalPrintControls") && caja.includes("onPrint={imprimirInformeCajaTermico}"));
check("Caja declara misma información para ambos formatos", caja.includes("misma información") && caja.includes("58/80 optimizado por ancho"));
check("Caja imprime resumen operativo reforzado", ["Resumen operativo", "Caja esperada", "Fin / arqueo contado", "Ingresos días anteriores"].every((texto) => caja.includes(texto)));
check("Caja imprime ajustes de caja", ["Ajustes de Caja", "Gastos Rafa", "Cuentas por cobrar", "Ajustes egresos"].every((texto) => caja.includes(texto)));
check("Caja imprime ventas y gastos por método", caja.includes("Ventas por método") && caja.includes("Gastos por método") && caja.includes("crearFilasPorMetodoTermico"));
check("Caja imprime saldos de inicio y último arqueo", caja.includes("Inicio del día - saldos") && caja.includes("Saldos último arqueo") && caja.includes("crearFilasSaldosTermicos"));
check("Caja imprime arqueos realizados con saldos", caja.includes("crearFilasArqueosTermicos") && caja.includes("Registradora / Azul") && caja.includes("Rafa / Datafono"));
check("Caja imprime detalle de gastos enriquecido", caja.includes("gasto.metodoPago") && caja.includes("Detalle gastos"));
check("Caja conserva fórmula opción 2", caja.includes("Arqueo + ingresos ant. - caja esperada") && caja.includes("Ingresos días anteriores no suben ventas ni caja esperada"));
check("Servicio térmico sigue compartiendo data para 58/80", service.includes("renderSecciones(secciones)") && service.includes("normalizarFormatoTermico"));
check("Versión posterior al cierre térmico 125.9", versionRafikiEsAlMenos(obtenerVersionBuild(), "125.9"));
check("Metadatos de versión sincronizados", obtenerVersionBuild() === obtenerVersionPublica());

const errores = checks.filter((item) => !item.condicion);
if (errores.length) {
  console.error("Validación Informe Caja térmico falló:");
  errores.forEach((error) => console.error(`- ${error.nombre}${error.detalle ? `: ${error.detalle}` : ""}`));
  process.exit(1);
}

console.log("Validación Informe Caja térmico OK");
