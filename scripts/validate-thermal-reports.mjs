import fs from "fs";
import path from "path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];

function check(nombre, condicion, detalle = "") {
  checks.push({ nombre, condicion: Boolean(condicion), detalle });
}

const service = read("src/modules/impresion/thermalReportService.js");
const pedidos = read("src/modules/admin/components/pedidos/AdminPedidosSection.jsx");
const caja = read("src/modules/caja/components/CajaAdmin.jsx");

check("Existe servicio central de reportes térmicos", service.includes("imprimirReporteTermico") && service.includes("FORMATOS_TERMICOS"));
check("El servicio soporta 58 mm", service.includes('"58"') && service.includes("58mm"));
check("El servicio soporta 80 mm", service.includes('"80"') && service.includes("80mm"));
check("El formato solo ajusta CSS, no cambia la data", service.includes("renderSecciones(secciones)") && service.includes("renderListado(listado, claveFormato, cfg)"));
check("Pedidos Hoy usa el servicio térmico central", pedidos.includes("imprimirResumenPedidosFiltradosTermico") && pedidos.includes("imprimirReporteTermico"));
check("Pedidos Hoy imprime los mismos filtros con selector 58/80", pedidos.includes("ThermalPrintControls") && pedidos.includes("onPrint={imprimirPedidosFiltradosTermico}") && pedidos.includes("resumenFiltrosRapidos"));
check("Pedidos Hoy conserva datos clave", pedidos.includes("Pedido") && pedidos.includes("Cliente") && pedidos.includes("Ubicación") && pedidos.includes("Total"));
check("Informe Caja imprime con selector 58/80", caja.includes("ThermalPrintControls") && caja.includes("onPrint={imprimirInformeCajaTermico}"));
check("Informe Caja conserva la fórmula validada", caja.includes("Arqueo + ingresos ant. - caja esperada") && caja.includes("Inicio + ventas - gastos - Rafa - CxC"));
check("Informe Caja conserva secciones críticas", ["Resumen del día", "Saldos último arqueo", "Detalle gastos", "Arqueos realizados"].every((texto) => caja.includes(texto)));

const errores = checks.filter((item) => !item.condicion);
if (errores.length) {
  console.error("Validación de reportes térmicos falló:");
  errores.forEach((error) => console.error(`- ${error.nombre}${error.detalle ? `: ${error.detalle}` : ""}`));
  process.exit(1);
}

console.log("Validación reportes térmicos OK");
