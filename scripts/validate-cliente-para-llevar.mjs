import fs from "node:fs";

function leer(ruta) {
  return fs.readFileSync(ruta, "utf8");
}

function exigir(condicion, mensaje) {
  if (!condicion) {
    console.error(`❌ ${mensaje}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${mensaje}`);
  }
}

const app = leer("src/App.jsx");
const usePedidos = leer("src/shared/hooks/usePedidos.js");
const pedidos = leer("src/shared/utils/pedidos.js");
const pedidoCliente = leer("src/modules/cliente/components/PedidoCliente.jsx");

exigir(
  pedidos.includes("export function normalizarItemsParaDestinoCliente") && pedidos.includes("pedidoClienteVaParaLlevar"),
  "Existe una normalización centralizada para destino de pedidos desde /cliente."
);

exigir(
  app.includes("itemsPedidoClienteNormalizados") && app.includes("itemsPedidoOperativos") && app.includes("normalizarItemsParaDestinoCliente(itemsPedido"),
  "App calcula items efectivos de /cliente antes de total, resumen y render."
);

exigir(
  /setItemsPedido\s*\(\s*\(actual\)\s*=>[\s\S]{0,320}normalizarItemsParaDestinoCliente\s*\(\s*actual\s*,\s*\{\s*comerRestauranteCliente(?:\s*:\s*comerEnRestaurante)?\s*\}\s*\)/s.test(app),
  "App sincroniza el estado visual de /cliente con para llevar/restaurante."
);

exigir(
  app.includes("itemsPedido: itemsPedidoOperativos") && app.includes("itemsPedido={itemsPedidoOperativos}"),
  "El guardado y la pantalla reciben los items normalizados de /cliente."
);

exigir(
  usePedidos.includes("const itemsClienteNormalizados = normalizarItemsParaDestinoCliente(itemsPedido, { comerRestauranteCliente })") &&
    usePedidos.includes("const itemsValidos = itemsClienteNormalizados"),
  "El guardado normaliza nuevamente los items antes de insertar en Supabase."
);

exigir(
  usePedidos.includes('tipo_pedido: comerRestauranteCliente ? "mesa" : "llevar"'),
  "Los pedidos públicos externos se guardan como tipo_pedido llevar; comer en restaurante se guarda como mesa."
);

exigir(
  pedidoCliente.includes('checked={!comerRestauranteCliente}') && pedidoCliente.includes("disabled") && pedidoCliente.includes("readOnly"),
  "El check Para llevar en /cliente permanece bloqueado y depende solo de Comer en restaurante."
);

exigir(
  pedidoCliente.includes("setComerRestauranteCliente?.(false, { preservarUbicacion: true })"),
  "Al modificar ubicación tras Comer en restaurante, vuelve a para llevar sin borrar la ubicación escrita."
);

if (process.exitCode) {
  console.error("\nValidación cliente para llevar falló.");
  process.exit(process.exitCode);
}

console.log("\nValidación cliente para llevar OK.");
