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
const pkg = JSON.parse(read("package.json"));

check("Servicio térmico tiene modo tabla de texto térmico", service.includes("renderListadoTabla") && service.includes("thermal-pre-table") && service.includes("formatearCeldaTablaTermica"));
check("Servicio conserva modo bloques para casos no tabulares", service.includes("renderListadoBloques") && service.includes('modo === "tabla"'));
check("Pedidos Hoy usa tabla compacta 1x1", pedidos.includes('modo: "tabla"') && pedidos.includes('chars58: 5') && pedidos.includes('chars58: 7') && pedidos.includes('chars58: 8'));
check("Pedidos Hoy conserva columnas clave", pedidos.includes('etiqueta: "Pedido"') && pedidos.includes('etiqueta: "Cliente"') && pedidos.includes('etiqueta: "Ubicación"') && pedidos.includes('etiqueta: "Total"'));
const inicioCamposPedidos = pedidos.indexOf("function crearCamposPedidosTermicos()");
const finCamposPedidos = pedidos.indexOf("function imprimirResumenPedidosFiltradosTermico", inicioCamposPedidos);
const bloqueCamposPedidos = inicioCamposPedidos >= 0 && finCamposPedidos > inicioCamposPedidos ? pedidos.slice(inicioCamposPedidos, finCamposPedidos) : "";
check("Pedidos Hoy no vuelve a imprimir detalle largo", !bloqueCamposPedidos.includes('etiqueta: "Detalle"') && !bloqueCamposPedidos.includes('resumirItemsPedidoCompacto(pedido)') && !bloqueCamposPedidos.includes('formatearHoraPedidoTermico'));
check("Gastos imprime listado como tabla", gastos.includes('modo: "tabla"') && gastos.includes('Detalle de gastos') && gastos.includes('etiqueta: "Proveedor"') && gastos.includes('etiqueta: "Valor"'));
check("Cartera imprime listados como tabla", cartera.includes('Top saldos pendientes') && cartera.includes('Detalle movimientos') && (cartera.match(/modo: "tabla"/g) || []).length >= 2);
check("package.json incluye validador", pkg.scripts?.["thermal-tabla:check"] === "node scripts/validate-thermal-tabla-compacta.mjs");

const errores = checks.filter((item) => !item.condicion);
if (errores.length) {
  console.error("Validación tabla térmica compacta falló:");
  errores.forEach((error) => console.error(`- ${error.nombre}`));
  process.exit(1);
}

console.log("Validación tabla térmica compacta OK");
