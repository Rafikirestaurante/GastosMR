import fs from "node:fs";
import path from "node:path";
import { ROOT, obtenerVersionBuild, versionRafikiEsAlMenos } from "./validation-utils.mjs";

const archivosFuente = [];

function recorrer(directorio) {
  for (const entrada of fs.readdirSync(directorio, { withFileTypes: true })) {
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) recorrer(ruta);
    else if (/\.(js|jsx|mjs)$/.test(entrada.name)) archivosFuente.push(ruta);
  }
}

recorrer(path.join(ROOT, "src"));

const errores = [];
const version = obtenerVersionBuild();
if (!versionRafikiEsAlMenos(version, "127.4")) {
  errores.push(`La versión ${version || "sin definir"} debe ser 127.4 o posterior.`);
}

for (const archivo of archivosFuente) {
  const contenido = fs.readFileSync(archivo, "utf8");
  const relativa = path.relative(ROOT, archivo);
  if (/window\s*\.\s*(alert|confirm)\s*\(/.test(contenido)) {
    errores.push(`${relativa}: contiene window.alert/window.confirm.`);
  }
  if (/(^|[^\w.])(alert|confirm)\s*\(/m.test(contenido)) {
    errores.push(`${relativa}: contiene alert/confirm nativo.`);
  }
}

const comunes = fs.readFileSync(path.join(ROOT, "src/shared/components/common.jsx"), "utf8");
const estilos = fs.readFileSync(path.join(ROOT, "src/styles/app.css"), "utf8");
const gastos = fs.readFileSync(path.join(ROOT, "src/modules/gastos/components/GastosDiarios.jsx"), "utf8");
const catalogo = fs.readFileSync(path.join(ROOT, "src/modules/catalogo/components/CatalogoRafa.jsx"), "utf8");
const pwa = fs.readFileSync(path.join(ROOT, "src/shared/components/PWAClearCacheButton.jsx"), "utf8");
const caja = fs.readFileSync(path.join(ROOT, "src/modules/caja/components/CajaAdmin.jsx"), "utf8");
const pedidosAdmin = fs.readFileSync(
  path.join(ROOT, "src/modules/admin/components/pedidos/AdminPedidosSection.jsx"),
  "utf8"
);
const tickets = fs.readFileSync(path.join(ROOT, "src/shared/utils/pedidos.js"), "utf8");

const controles = [
  [comunes.includes("export function useAvisosRafiki"), "Falta el hook reutilizable useAvisosRafiki."],
  [comunes.includes("export function RafikiAvisos"), "Falta el componente de avisos breves RafikiAvisos."],
  [
    estilos.includes(".rafiki-avisos-region") &&
      estilos.includes(".rafiki-aviso-success") &&
      estilos.includes(".rafiki-aviso-error"),
    "Faltan estilos uniformes para avisos breves."
  ],
  [
    gastos.includes("useConfirmacion") &&
      gastos.includes("useAvisosRafiki") &&
      gastos.includes('titulo: "Eliminar gasto"'),
    "Gastos no usa confirmación y avisos uniformes."
  ],
  [
    catalogo.includes("useConfirmacion") &&
      catalogo.includes("useAvisosRafiki") &&
      catalogo.includes('titulo: "Restaurar catálogo base"'),
    "Catálogo no usa confirmación y avisos uniformes."
  ],
  [
    pwa.includes("useConfirmacion") && pwa.includes("titulo: 'Actualizar Rafiki en este dispositivo'"),
    "La limpieza PWA no usa confirmación Rafiki."
  ],
  [
    caja.includes('titulo: "Impresión bloqueada"'),
    "Caja no muestra un modal uniforme al bloquearse la impresión."
  ],
  [
    pedidosAdmin.includes('titulo: "Impresión bloqueada"'),
    "Pedidos Hoy no muestra un modal uniforme al bloquearse la impresión."
  ],
  [
    tickets.includes("if (!ventana) return false") && tickets.includes("return true;"),
    "El ticket de pedido no informa correctamente éxito o bloqueo de impresión."
  ]
];

for (const [correcto, mensaje] of controles) {
  if (!correcto) errores.push(mensaje);
}

if (errores.length) {
  console.error("Validación de modales y mensajes uniformes fallida:");
  errores.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("✓ No existen alertas o confirmaciones nativas en src.");
console.log("✓ Avisos breves uniformes disponibles para éxito, información, advertencia y error.");
console.log("✓ Confirmaciones críticas migradas en Gastos, Catálogo y actualización PWA.");
console.log("✓ Bloqueos de impresión informados mediante modal Rafiki.");
console.log("Validación de modales y mensajes uniformes completada.");
