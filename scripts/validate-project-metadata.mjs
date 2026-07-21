import fs from "node:fs";
import path from "node:path";
import {
  ROOT,
  extraerVersionRafiki,
  leerArchivo,
  leerJson,
  obtenerVersionBuild,
  obtenerVersionPublica
} from "./validation-utils.mjs";

const errores = [];
const avisos = [];

function exigir(condicion, mensaje) {
  if (!condicion) errores.push(mensaje);
}

function avisar(condicion, mensaje) {
  if (!condicion) avisos.push(mensaje);
}

const packageJson = leerJson("package.json");
const versionPublica = leerJson("public/rafiki-version.json");
const versionBuild = obtenerVersionBuild();
const versionPublicaTexto = obtenerVersionPublica();
const buildConfig = leerArchivo("src/config/rafikiBuild.js");
const readme = leerArchivo("README.md");
const lockPath = path.join(ROOT, "package-lock.json");

exigir(
  packageJson.name === "rafiki-pedidos",
  "package.json debe identificar el proyecto como rafiki-pedidos."
);
exigir(packageJson.private === true, "package.json debe mantener el proyecto como privado.");
exigir(
  Boolean(packageJson.devDependencies?.["eslint-plugin-react"]),
  "Falta eslint-plugin-react para validar correctamente el uso de componentes JSX."
);
exigir(
  Boolean(extraerVersionRafiki(versionBuild)),
  "La versión de build no cumple el formato numérico de Rafiki."
);
exigir(
  versionBuild === versionPublicaTexto,
  "src/config/rafikiBuild.js y public/rafiki-version.json tienen versiones diferentes."
);
exigir(
  buildConfig.includes(`phase: "${versionPublica.phase}"`),
  "La fase pública no coincide con la fase del build."
);
exigir(
  buildConfig.includes(`date: "${versionPublica.date}"`),
  "La fecha pública no coincide con la fecha del build."
);
exigir(readme.includes(versionBuild), "README.md no documenta la versión actual.");
exigir(fs.existsSync(lockPath), "Falta package-lock.json; la instalación no es reproducible.");

if (fs.existsSync(lockPath)) {
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  exigir(Number(lock.lockfileVersion) >= 3, "package-lock.json debe usar lockfileVersion 3 o posterior.");

  const raizLock = lock.packages?.[""] || {};
  for (const [nombre, rango] of Object.entries(packageJson.dependencies || {})) {
    exigir(
      raizLock.dependencies?.[nombre] === rango,
      `Dependencia ${nombre} no está sincronizada en package-lock.json.`
    );
  }
  for (const [nombre, rango] of Object.entries(packageJson.devDependencies || {})) {
    exigir(
      raizLock.devDependencies?.[nombre] === rango,
      `Dependencia de desarrollo ${nombre} no está sincronizada en package-lock.json.`
    );
  }
}

const scriptsRequeridos = [
  "lint",
  "test",
  "build",
  "pwa:check",
  "clientes-especiales:check",
  "cliente-para-llevar:check",
  "dashboard-ventas:check",
  "dashboard-barras:check",
  "financial-flows:check",
  "performance:check",
  "thermal-reports:check",
  "thermal-pedidos-hoy:check",
  "thermal-caja:check",
  "thermal-gastos-cartera:check",
  "thermal-selector:check",
  "thermal-tabla:check",
  "thermal-cierre:check",
  "thermal-ahorro:check",
  "thermal-contraste:check",
  "check"
];

for (const script of scriptsRequeridos) {
  exigir(Boolean(packageJson.scripts?.[script]), `Falta el script obligatorio npm run ${script}.`);
}

avisar(
  !fs.existsSync(path.join(ROOT, "dist")),
  "La carpeta dist existe localmente; debe excluirse al crear el ZIP."
);
avisar(
  !fs.existsSync(path.join(ROOT, "node_modules")),
  "La carpeta node_modules existe localmente; debe excluirse al crear el ZIP."
);
exigir(
  fs.existsSync(path.join(ROOT, "docs/FASE36B2-SANEAMIENTO-VERIFICACION-AUTOMATICA.md")),
  "Falta la documentación de la Fase 36B.2."
);
exigir(
  fs.existsSync(path.join(ROOT, "docs/FASE36B3-PRUEBAS-FLUJOS-FINANCIEROS.md")),
  "Falta la documentación de la Fase 36B.3."
);
exigir(
  fs.existsSync(path.join(ROOT, "docs/FASE36B5-RENDIMIENTO-DIVISION-PAQUETE.md")),
  "Falta la documentación de la Fase 36B.5."
);

if (avisos.length) {
  console.log("Avisos de empaquetado:");
  avisos.forEach((mensaje) => console.log(`- ${mensaje}`));
}

if (errores.length) {
  console.error("Validación de metadatos FALLÓ:");
  errores.forEach((mensaje) => console.error(`- ${mensaje}`));
  process.exit(1);
}

console.log(`Validación de metadatos OK: ${versionBuild}, lock y scripts sincronizados.`);
