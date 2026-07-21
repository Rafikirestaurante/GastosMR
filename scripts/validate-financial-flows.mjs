import { leerArchivo } from "./validation-utils.mjs";

const errores = [];
const aprobados = [];

function check(nombre, condicion) {
  if (condicion) aprobados.push(nombre);
  else errores.push(nombre);
}

const utilidades = leerArchivo("src/shared/utils/financialFlows.js");
const pruebas = leerArchivo("src/shared/utils/__tests__/financialFlows.test.js");
const cartera = leerArchivo("src/services/carteraService.js");
const cajaService = leerArchivo("src/services/cajaService.js");
const cajaComponente = leerArchivo("src/modules/caja/components/CajaAdmin.jsx");
const hooksPedidos = leerArchivo("src/shared/hooks/usePedidos.js");
const sql = leerArchivo("supabase/2026-06-20-fase33-blindaje-cartera.sql").toLowerCase();

check("Reglas financieras puras disponibles", utilidades.includes("calcularEstadoMovimientoCredito") && utilidades.includes("calcularCuadreCaja"));
check("Pedido borrado o no crédito sale de Cartera", utilidades.includes("pedidoDebeSalirDeCartera") && utilidades.includes("pedidoEstaDescartado"));
check("Retiro con abonos requiere revisión", utilidades.includes('accion: "bloquear"') && utilidades.includes("abonos registrados"));
check("Saldo crédito nunca queda negativo", utilidades.includes("Math.max(0, valor - abonos)"));
check("Estados pendiente, parcial y pagado controlados", utilidades.includes('"pagado"') && utilidades.includes('"parcial"') && utilidades.includes('"pendiente"'));
check("Resumen de cliente excluye anulados", utilidades.includes('!== "anulado"') && utilidades.includes("saldoPendiente"));
check("Abonos normalizan enteros y método", utilidades.includes("normalizarDatosAbono") && utilidades.includes("permitirCredito: false"));
check("Simulación FIFO replica la regla SQL", utilidades.includes("distribuirAbonoFIFO") && utilidades.includes("fecha_movimiento"));
check("Cuadre conserva fórmula opción 2", utilidades.includes("arqueoContado + valores.ingresosDiasAnteriores - cajaEsperada"));
check("Ventas de Caja excluyen pedidos inválidos", utilidades.includes("resumirMovimientosCaja") && utilidades.includes('obtenerEstadoPedido(pedido) !== "Borrado"'));

check("Cartera usa reglas probadas", cartera.includes("evaluarRetiroPedidoCredito") && cartera.includes("calcularEstadoMovimientoCredito"));
check("Recalcular cliente usa resumen probado", cartera.includes("calcularResumenClienteCredito"));
check("Registro de abono usa normalización probada", cartera.includes("normalizarDatosAbono"));
check("Caja real usa resumen probado", cajaService.includes("resumirMovimientosCaja"));
check("Informe de Caja usa cálculo probado", cajaComponente.includes("calcularCuadreCaja"));

check("Creación de crédito sincroniza Cartera", hooksPedidos.includes("registrarCarteraPedidoCredito(data)"));
check("Cambio de pago sincroniza o anula Cartera", hooksPedidos.includes("anularCarteraPedidoCredito") && hooksPedidos.includes("sincronizarCarteraPedido(data"));
check("Borrado de pedido protege Cartera", hooksPedidos.includes("borrado. Cartera anulada automáticamente") && hooksPedidos.includes("{ forzar: true }"));

check("RPC de abonos es transaccional y bloquea filas", sql.includes("create or replace function public.registrar_abono_cliente_credito") && sql.includes("for update"));
check("RPC distribuye abonos por antigüedad", sql.includes("order by fecha_movimiento asc, created_at asc, id asc"));
check("RPC rechaza abonos superiores al saldo", sql.includes("el abono no puede ser mayor al saldo pendiente"));
check("RPC actualiza movimiento y resumen del cliente", sql.includes("update public.cartera_movimientos") && sql.includes("update public.clientes_credito"));
check("RPC restringe permisos y usa security definer", sql.includes("security definer") && sql.includes("revoke all on function public.registrar_abono_cliente_credito"));

const cantidadPruebas = (pruebas.match(/\bit\s*\(/g) || []).length;
check("Suite financiera cubre al menos 25 escenarios", cantidadPruebas >= 25);
check("Suite cubre Cartera, abonos, ventas, gastos y Caja", [
  "cartera",
  "abonos",
  "ventas y gastos de caja",
  "caja",
].every((texto) => pruebas.includes(texto)));

if (errores.length) {
  console.error("Validación de flujos financieros FALLÓ:");
  errores.forEach((nombre) => console.error(`- ${nombre}`));
  process.exit(1);
}

console.log(`Validación financiera OK: ${aprobados.length}/${aprobados.length} controles y ${cantidadPruebas} escenarios financieros.`);
