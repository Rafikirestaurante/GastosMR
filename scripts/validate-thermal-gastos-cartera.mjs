import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exitCode = 1;
  }
};

const gastos = read('src/modules/gastos/components/GastosDiarios.jsx');
const cartera = read('src/modules/cartera/components/CarteraClientesCredito.jsx');
const pkg = JSON.parse(read('package.json'));

assert(gastos.includes('imprimirReporteTermico'), 'Gastos debe usar el servicio central imprimirReporteTermico.');
assert(gastos.includes('imprimirGastosTermico'), 'Gastos debe tener función imprimirGastosTermico.');
assert(gastos.includes('ThermalPrintControls') && gastos.includes('onPrint={imprimirGastosTermico}'), 'Gastos debe mostrar selector global 58/80.');
assert(gastos.includes('Detalle de gastos'), 'Gastos debe imprimir el detalle de gastos.');
assert(gastos.includes('Por categoría') && gastos.includes('Por método de pago'), 'Gastos debe imprimir categorías y métodos de pago.');

assert(cartera.includes('imprimirReporteTermico'), 'Cartera debe usar el servicio central imprimirReporteTermico.');
assert(cartera.includes('imprimirResumenCarteraTermico'), 'Cartera debe tener impresión de resumen térmico.');
assert(cartera.includes('imprimirMovimientosCarteraTermico'), 'Cartera debe tener impresión de movimientos térmicos.');
assert(cartera.includes('onPrint={imprimirResumenCarteraTermico}'), 'Cartera debe mostrar selector global para resumen 58/80.');
assert(cartera.includes('onPrint={imprimirMovimientosCarteraTermico}'), 'Cartera debe mostrar selector global para movimientos 58/80.');
assert(cartera.includes('Detalle movimientos'), 'Cartera debe imprimir el detalle de movimientos filtrados.');
assert(cartera.includes('Por estado'), 'Cartera debe imprimir resumen por estado.');

assert(pkg.scripts?.['thermal-gastos-cartera:check'] === 'node scripts/validate-thermal-gastos-cartera.mjs', 'package.json debe incluir thermal-gastos-cartera:check.');

if (!process.exitCode) {
  console.log('✅ Validación térmica Gastos/Cartera OK');
}
