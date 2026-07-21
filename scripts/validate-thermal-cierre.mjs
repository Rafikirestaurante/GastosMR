import fs from "fs";
import path from "path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];

function check(nombre, condicion) {
  checks.push({ nombre, condicion: Boolean(condicion) });
}

const service = read("src/modules/impresion/thermalReportService.js");
const pedidos = read("src/modules/admin/components/pedidos/AdminPedidosSection.jsx");
const gastos = read("src/modules/gastos/components/GastosDiarios.jsx");
const cartera = read("src/modules/cartera/components/CarteraClientesCredito.jsx");
const caja = read("src/modules/caja/components/CajaAdmin.jsx");
const pkg = JSON.parse(read("package.json"));

check("Motor térmico conserva formatos 58 y 80", service.includes('"58"') && service.includes('"80"') && service.includes('pageSize: "58mm auto"') && service.includes('pageSize: "80mm auto"'));
check("Tablas térmicas tienen modo texto 1x1 por formato", service.includes("tableFontSize") && service.includes("tableChars") && service.includes("thermal-pre-table"));
check("Tablas usan estilo térmico monoespaciado 1x1", service.includes('font-family: "Courier New", "Lucida Console", monospace') && service.includes('fontSize: "12px"') && service.includes("font-weight: ${cfg.fontWeight}") && service.includes('fontWeight: "700"') && service.includes("border: 0"));
check("Pedidos Hoy imprime tabla compacta", pedidos.includes('modo: "tabla"') && pedidos.includes('etiqueta: "Pedido"') && pedidos.includes('etiqueta: "Cliente"') && pedidos.includes('etiqueta: "Ubicación"') && pedidos.includes('etiqueta: "Total"'));
const inicioCamposPedidos = pedidos.indexOf("function crearCamposPedidosTermicos()");
const finCamposPedidos = pedidos.indexOf("function imprimirResumenPedidosFiltradosTermico", inicioCamposPedidos);
const bloqueCamposPedidos = inicioCamposPedidos >= 0 && finCamposPedidos > inicioCamposPedidos ? pedidos.slice(inicioCamposPedidos, finCamposPedidos) : "";
check("Pedidos Hoy no imprime detalle largo", !bloqueCamposPedidos.includes('etiqueta: "Detalle"') && !bloqueCamposPedidos.includes('resumirItemsPedidoCompacto(pedido)') && !bloqueCamposPedidos.includes('formatearHoraPedidoTermico'));
check("Gastos conserva tabla compacta", gastos.includes('modo: "tabla"') && gastos.includes('etiqueta: "Proveedor"') && gastos.includes('etiqueta: "Categoría"') && gastos.includes('etiqueta: "Pago"') && gastos.includes('etiqueta: "Valor"'));
check("Cartera conserva tablas compactas", (cartera.match(/modo: "tabla"/g) || []).length >= 2 && cartera.includes('Top saldos pendientes') && cartera.includes('Detalle movimientos'));
check("Caja usa impresión térmica central", caja.includes("imprimirReporteTermico") && caja.includes("imprimirInformeCajaTermico"));
check("package.json incluye validador de cierre", pkg.scripts?.["thermal-cierre:check"] === "node scripts/validate-thermal-cierre.mjs");

const errores = checks.filter((item) => !item.condicion);
if (errores.length) {
  console.error("Validación cierre impresión térmica falló:");
  errores.forEach((error) => console.error(`- ${error.nombre}`));
  process.exit(1);
}

console.log("Validación cierre impresión térmica OK");
