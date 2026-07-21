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

const camposStart = pedidos.indexOf("function crearCamposPedidosTermicos()");
const camposEnd = pedidos.indexOf("function imprimirResumenPedidosFiltradosTermico", camposStart);
const bloqueCampos = camposStart >= 0 && camposEnd > camposStart ? pedidos.slice(camposStart, camposEnd) : "";

check("Servicio térmico conserva misma data para 58 y 80", service.includes("renderSecciones(secciones)") && service.includes("renderListado(listado, claveFormato, cfg)") && service.includes("tableChars"));
check("Pedidos Hoy define clasificación robusta", pedidos.includes("pedidoCumpleFiltroTipoPedido") && pedidos.includes("pedidoPareceParaLlevar") && pedidos.includes("pedidoSinItemsPareceCafeteria") && pedidos.includes("itemEsCafeteriaPedidoHoy") && pedidos.includes("itemEsRestaurantePedidoHoy"));
check("Pedidos Hoy imprime rango y búsqueda", pedidos.includes("describirRangoBusquedaPedidosTermico") && pedidos.includes("rangoBusquedaPedidosTermico"));
check("Pedidos Hoy conserva resumen compacto", pedidos.includes("titulo: \"Resumen\"") && pedidos.includes("{ etiqueta: \"Pedidos\"") && pedidos.includes("{ etiqueta: \"Total\""));
check("Pedidos Hoy imprime listado compacto", bloqueCampos.includes("Pedido") && bloqueCampos.includes("Cliente") && bloqueCampos.includes("Ubicación") && bloqueCampos.includes("Total"));
check("Pedidos Hoy no imprime detalle largo", !bloqueCampos.includes("Detalle") && !bloqueCampos.includes("Pago / Estado") && !bloqueCampos.includes("Línea") && !bloqueCampos.includes("formatearHoraPedidoTermico"));
check("Modal de filtros permite imprimir con selector 58/80", pedidos.includes("pedidos-filtros-modal-impresion") && pedidos.includes("ThermalPrintControls") && pedidos.includes("onPrint={imprimirPedidosFiltradosTermico}"));
check("La descripción respeta regla de misma información", pedidos.includes("solo cambia la optimización del ancho") && pedidos.includes("58 mm y 80 mm"));

const errores = checks.filter((item) => !item.condicion);
if (errores.length) {
  console.error("Validación impresión Pedidos Hoy falló:");
  errores.forEach((error) => console.error(`- ${error.nombre}${error.detalle ? `: ${error.detalle}` : ""}`));
  process.exit(1);
}

console.log("Validación impresión Pedidos Hoy OK");
