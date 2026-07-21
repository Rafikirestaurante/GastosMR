import fs from "fs";
import path from "path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const service = read("src/modules/impresion/thermalReportService.js");
const pkg = JSON.parse(read("package.json"));
const checks = [];

function check(nombre, condicion) {
  checks.push({ nombre, condicion: Boolean(condicion) });
}

check("Mantiene tamaño normal 1x1", service.includes('fontSize: "12px"') && service.includes('tableFontSize: "12px"'));
check("No vuelve a letra diminuta", !service.includes('fontSize: "9px"') && !service.includes('tableFontSize: "9px"') && !service.includes('fontSize: "10px"'));
check("Usa peso térmico firme", service.includes('fontWeight: "700"') && service.includes('font-weight: ${cfg.fontWeight}'));
check("Usa negro puro", service.includes("color: #000 !important"));
check("Refuerza trazo de impresión", service.includes("printStroke") && service.includes("-webkit-text-stroke: ${cfg.printStroke} #000"));
check("Conserva tabla preformateada", service.includes("thermal-pre-table") && service.includes("white-space: pre"));
check("Conserva pedidos compactos", service.includes("crearCamposListadoPedidosTermico") && service.includes("Pedido") && service.includes("Cliente") && service.includes("Ubicación") && service.includes("Total"));
check("package.json expone validador de contraste", pkg.scripts?.["thermal-contraste:check"] === "node scripts/validate-thermal-contraste.mjs");

const errores = checks.filter((item) => !item.condicion);
if (errores.length) {
  console.error("Validación contraste térmico falló:");
  errores.forEach((error) => console.error(`- ${error.nombre}`));
  process.exit(1);
}

console.log("Validación contraste térmico OK");
