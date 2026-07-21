import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { ROOT, obtenerVersionBuild, versionRafikiEsAlMenos } from "./validation-utils.mjs";

const errores = [];
const controles = [];
function controlar(nombre, condicion, detalle = "") {
  const correcto = Boolean(condicion);
  controles.push({ nombre, correcto, detalle });
  if (!correcto) errores.push(`${nombre}${detalle ? `: ${detalle}` : ""}`);
}
const app = fs.readFileSync(path.join(ROOT, "src/App.jsx"), "utf8");
const main = fs.readFileSync(path.join(ROOT, "src/main.jsx"), "utf8");
const vite = fs.readFileSync(path.join(ROOT, "vite.config.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const version = obtenerVersionBuild();
const cssPath = path.join(ROOT, "src/styles/app.css");
const estilosAnteriores = path.join(ROOT, "src/styles/appStyles.js");
const runtimePwa = path.join(ROOT, "src/shared/components/PWAInternalRuntime.jsx");
const dist = path.join(ROOT, "dist");
controlar("Versión 127.5 o posterior", versionRafikiEsAlMenos(version, "127.5"), version);
controlar("Los estilos globales viven en CSS", fs.existsSync(cssPath));
controlar("Se retiró el template literal appStyles", !fs.existsSync(estilosAnteriores));
controlar("main.jsx importa app.css", main.includes('import "./styles/app.css"'));
controlar(
  "App no inyecta un style gigante",
  !app.includes("<style>{appStyles}</style>") && !app.includes("styles/appStyles")
);
controlar(
  "Pedidos Hoy se carga bajo demanda",
  app.includes('import("./modules/admin/components/pedidos/AdminPedidosSection")')
);
controlar(
  "Pedido Cliente se carga bajo demanda",
  app.includes('import("./modules/cliente/components/PedidoCliente")')
);
controlar(
  "Editor de menú se carga bajo demanda",
  app.includes('import("./modules/admin/tabs/MenuDiarioTab")')
);
controlar(
  "Cabecera Admin se carga bajo demanda",
  app.includes('import("./modules/admin/components/layout/AdminHeaderTabs")')
);
controlar(
  "Runtime PWA interno está separado",
  fs.existsSync(runtimePwa) &&
    main.includes('lazy(() => import("./shared/components/PWAInternalRuntime.jsx"))')
);
controlar(
  "Ruta pública no monta runtime PWA",
  main.includes("!rutaPublicaCliente") && main.includes("<PWAInternalRuntime />")
);
controlar("Vite separa React", vite.includes('return "vendor-react"'));
controlar("Vite separa Supabase", vite.includes('return "vendor-supabase"'));
controlar("Vite separa Workbox", vite.includes('return "vendor-pwa"'));
controlar(
  "Existe comando performance:check",
  packageJson.scripts?.["performance:check"] === "node scripts/validate-performance-bundle.mjs"
);
controlar(
  "Existe compilación dist para medir",
  fs.existsSync(dist),
  "ejecuta npm run build antes del control de rendimiento"
);
if (fs.existsSync(dist)) {
  const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  const entryMatch = html.match(/<script[^>]+src="\/assets\/([^"]+\.js)"/);
  const preloadMatches = [...html.matchAll(/rel="modulepreload"[^>]+href="\/assets\/([^"]+\.js)"/g)].map(
    (match) => match[1]
  );
  const cssMatch = html.match(/<link[^>]+rel="stylesheet"[^>]+href="\/assets\/([^"]+\.css)"/);
  const assetsDir = path.join(dist, "assets");
  const jsFiles = fs.readdirSync(assetsDir).filter((archivo) => archivo.endsWith(".js"));
  controlar("El HTML referencia un paquete de entrada", Boolean(entryMatch));
  controlar(
    "React y Supabase son preloads separados",
    preloadMatches.some((x) => x.startsWith("vendor-react-")) &&
      preloadMatches.some((x) => x.startsWith("vendor-supabase-"))
  );
  controlar(
    "La compilación genera al menos 20 paquetes JS",
    jsFiles.length >= 20,
    `${jsFiles.length} paquetes`
  );
  const bytes = (archivo) => fs.statSync(path.join(assetsDir, archivo)).size;
  const gzipBytes = (archivo) => zlib.gzipSync(fs.readFileSync(path.join(assetsDir, archivo))).length;
  if (entryMatch) {
    const entry = entryMatch[1];
    controlar(
      "Paquete principal menor de 220 KB",
      bytes(entry) <= 220 * 1024,
      `${(bytes(entry) / 1024).toFixed(1)} KB`
    );
    const iniciales = [entry, ...preloadMatches];
    const inicialRaw = iniciales.reduce((total, archivo) => total + bytes(archivo), 0);
    const inicialGzip = iniciales.reduce((total, archivo) => total + gzipBytes(archivo), 0);
    controlar(
      "JavaScript inicial menor de 560 KB",
      inicialRaw <= 560 * 1024,
      `${(inicialRaw / 1024).toFixed(1)} KB`
    );
    controlar(
      "JavaScript inicial comprimido menor de 165 KB",
      inicialGzip <= 165 * 1024,
      `${(inicialGzip / 1024).toFixed(1)} KB gzip`
    );
  }
  const mayorJs = jsFiles
    .map((archivo) => ({ archivo, tamano: bytes(archivo) }))
    .sort((a, b) => b.tamano - a.tamano)[0];
  controlar(
    "Ningún paquete JS supera 240 KB",
    mayorJs?.tamano <= 240 * 1024,
    `${mayorJs?.archivo}: ${((mayorJs?.tamano || 0) / 1024).toFixed(1)} KB`
  );
  for (const prefijo of ["PedidoCliente-", "AdminPedidosSection-", "MenuDiarioTab-", "PWAInternalRuntime-"]) {
    controlar(
      `Existe paquete diferido ${prefijo.replace("-", "")}`,
      jsFiles.some((archivo) => archivo.startsWith(prefijo))
    );
  }
  if (cssMatch) {
    const css = cssMatch[1];
    controlar(
      "CSS global comprimido menor de 26 KB",
      gzipBytes(css) <= 26 * 1024,
      `${(gzipBytes(css) / 1024).toFixed(1)} KB gzip`
    );
  } else controlar("El HTML referencia CSS global", false);
}
for (const control of controles)
  console.log(
    `${control.correcto ? "✓" : "✗"} ${control.nombre}${control.detalle ? ` — ${control.detalle}` : ""}`
  );
if (errores.length) {
  console.error(`\nValidación de rendimiento FALLÓ: ${errores.length} problema(s).`);
  process.exit(1);
}
console.log("\nValidación de rendimiento y división del paquete OK.");
