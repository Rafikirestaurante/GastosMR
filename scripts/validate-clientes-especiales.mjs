import fs from 'node:fs';
import path from 'node:path';
import { obtenerVersionBuild, obtenerVersionPublica, versionRafikiEsAlMenos } from './validation-utils.mjs';

const root = process.cwd();
let errores = 0;

function leer(ruta) {
  return fs.readFileSync(path.join(root, ruta), 'utf8');
}

function ok(condicion, mensaje) {
  if (!condicion) {
    errores += 1;
    console.error(`✗ ${mensaje}`);
    return;
  }
  console.log(`✓ ${mensaje}`);
}

function contiene(ruta, fragmento, mensaje) {
  const texto = leer(ruta);
  ok(texto.includes(fragmento), mensaje || `${ruta} contiene ${fragmento}`);
}

function contieneRegex(ruta, regex, mensaje) {
  const texto = leer(ruta);
  ok(regex.test(texto), mensaje || `${ruta} cumple ${regex}`);
}

console.log('Validando Clientes Especiales /cliente...');

contiene('src/shared/utils/clientePublicoRuntime.js', "ruta === '/' || ruta === '/cliente' || ruta === '/pedido'", '/cliente se mantiene como link público sin depender de PWA');
contiene('src/main.jsx', 'prepararClientePublicoSinServiceWorker', 'main.jsx limpia service worker en rutas públicas de cliente');
contiene('src/main.jsx', 'registerServiceWorker();', 'main.jsx conserva service worker para rutas internas');

contiene('src/modules/cliente/components/CodigoClienteEspecial.jsx', 'validarCodigoClienteEspecial', 'el recuadro valida código mediante servicio/RPC');
contiene('src/modules/cliente/components/CodigoClienteEspecial.jsx', 'RafikiModal', 'la bienvenida usa RafikiModal');
contiene('src/modules/cliente/components/CodigoClienteEspecial.jsx', 'Gracias por preferirnos. Ya puedes continuar con tu pedido.', 'el modal muestra el mensaje final aprobado');
contiene('src/modules/cliente/components/CodigoClienteEspecial.jsx', 'Continuar pedido', 'el modal conserva botón Continuar pedido');

contiene('src/modules/cliente/components/PedidoCliente.jsx', 'useState("restaurante")', 'Restaurante queda abierto por defecto para cliente especial');
contiene('src/modules/cliente/components/PedidoCliente.jsx', 'Restaurante', 'existe pestaña Restaurante');
contiene('src/modules/cliente/components/PedidoCliente.jsx', 'Cafetería', 'existe pestaña Cafetería');
contiene('src/modules/cliente/components/PedidoCliente.jsx', '<strong>⭐ Cliente especial activo</strong>', 'el aviso visual se limita a Cliente especial activo');
contieneRegex('src/modules/cliente/components/PedidoCliente.jsx', /clienteEspecialAplicado\s*&&\s*clienteEspecialAplicado\.sin_restriccion_acompanantes\s*!==\s*false/, 'cliente especial puede omitir mínimo de acompañantes');
contieneRegex('src/modules/cliente/components/PedidoCliente.jsx', /clienteEspecialAplicado\s*&&\s*clienteEspecialAplicado\.habilita_cafeteria\s*!==\s*false/, 'cliente especial habilita Cafetería cuando la regla lo permite');

const pedidoCliente = leer('src/modules/cliente/components/PedidoCliente.jsx');
ok(!pedidoCliente.includes('Puedes continuar el pedido sin seleccionar acompañantes manualmente.'), 'se eliminó el texto largo del aviso de cliente especial');

contiene('src/modules/cliente/components/CafeteriaClienteEspecial.jsx', 'cargarCatalogoProductosAdmin', 'Cafetería carga catálogo dinámico');
contiene('src/modules/cliente/components/CafeteriaClienteEspecial.jsx', 'PRODUCTOS_CATALOGO_FALLBACK', 'Cafetería conserva fallback local');
contiene('src/modules/cliente/components/CafeteriaClienteEspecial.jsx', 'productoEsCafeteria', 'Cafetería filtra productos por línea');

contiene('src/shared/hooks/usePedidos.js', 'normalizarClienteEspecialParaPedido(clienteEspecialAplicado)', 'el pedido normaliza cliente especial antes de guardar');
contiene('src/shared/hooks/usePedidos.js', 'cliente_especial: clienteEspecialPedido || undefined', 'cada item guarda referencia cliente_especial');
contiene('src/shared/utils/pedidos.js', 'normalizarClienteEspecialParaPedido', 'existe normalizador de cliente especial');
contiene('src/shared/utils/pedidos.js', 'obtenerClienteEspecialPedido', 'existe lector de cliente especial en pedidos');
contiene('src/modules/cliente/components/ConfirmacionPedidoCliente.jsx', 'Cliente especial aplicado', 'confirmación muestra cliente especial aplicado');

contiene('src/shared/utils/pedidos.js', 'Este Producto viene con acompañantes del día', 'mensaje de acompañantes del día se mantiene');
contieneRegex('src/shared/utils/pedidos.js', /nombre\.includes\("pasta"\)/, 'Pastas dentro de Platos se detectan por nombre');

const panelMesas = leer('src/modules/mesas/components/PanelMesas.jsx');
ok(!panelMesas.includes('clienteEspecialAplicado'), '/mesas no depende de clienteEspecialAplicado');
ok(!panelMesas.includes('CodigoClienteEspecial'), '/mesas no renderiza recuadro de código especial');

const versionBuild = obtenerVersionBuild();
const versionPublica = obtenerVersionPublica();
ok(versionRafikiEsAlMenos(versionBuild, '124.44'), 'versión de build es 124.44 o posterior');
ok(versionBuild === versionPublica, 'versión de build y versión pública están sincronizadas');

if (errores > 0) {
  console.error(`\nValidación Clientes Especiales FALLÓ: ${errores} problema(s).`);
  process.exit(1);
}

console.log('\nValidación Clientes Especiales OK.');
