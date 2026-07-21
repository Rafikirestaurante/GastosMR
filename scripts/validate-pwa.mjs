import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const warnings = [];

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function warn(condition, message) {
  if (!condition) warnings.push(message);
}

function pngSize(file) {
  const buffer = fs.readFileSync(path.join(root, file));
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") throw new Error(`${file} no parece ser PNG válido`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

const manifest = readJson("public/manifest.json");
const version = readJson("public/rafiki-version.json");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const viteConfig = fs.readFileSync(path.join(root, "vite.config.js"), "utf8");
const buildConfig = fs.readFileSync(path.join(root, "src/config/rafikiBuild.js"), "utf8");

assert(manifest.name === "Rafiki Pedidos", "Manifest: nombre inesperado.");
assert(manifest.start_url?.startsWith("/mesas"), "Manifest: start_url debe iniciar en /mesas.");
assert(
  !JSON.stringify(manifest).includes("/cliente"),
  "Manifest: no debe promover /cliente como PWA interna."
);
assert(
  Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 2,
  "Manifest: faltan shortcuts internos."
);
assert(
  manifest.shortcuts.every((shortcut) => !shortcut.url?.startsWith("/cliente")),
  "Manifest: hay shortcut hacia /cliente."
);
assert(manifest.display === "standalone", "Manifest: display debe ser standalone.");
assert(manifest.orientation === "portrait", "Manifest: orientation debe ser portrait.");
assert(manifest.theme_color === "#f97316", "Manifest: theme_color no coincide con Rafiki.");
assert(manifest.background_color === "#fff4e6", "Manifest: background_color no coincide con Rafiki.");

for (const icon of manifest.icons || []) {
  const file = `public${icon.src}`;
  assert(fs.existsSync(path.join(root, file)), `Icono no encontrado: ${icon.src}`);
  if (fs.existsSync(path.join(root, file)) && icon.src.endsWith(".png")) {
    const [expectedWidth, expectedHeight] = icon.sizes.split("x").map(Number);
    const size = pngSize(file);
    assert(
      size.width === expectedWidth && size.height === expectedHeight,
      `Icono ${icon.src}: tamaño real ${size.width}x${size.height}, esperado ${icon.sizes}.`
    );
  }
  warn(icon.purpose?.includes("maskable"), `Icono ${icon.src}: considera purpose maskable.`);
}

assert(indexHtml.includes("viewport-fit=cover"), "index.html: falta viewport-fit=cover.");
assert(indexHtml.includes("mobile-web-app-capable"), "index.html: falta mobile-web-app-capable.");
assert(indexHtml.includes("apple-mobile-web-app-capable"), "index.html: falta apple-mobile-web-app-capable.");
assert(indexHtml.includes("apple-touch-icon"), "index.html: falta apple-touch-icon.");
assert(
  viteConfig.includes("NetworkOnly") && viteConfig.includes("supabase.co"),
  "vite.config.js: Supabase debe permanecer NetworkOnly."
);
assert(
  /registerType\s*:\s*["']prompt["']/.test(viteConfig),
  "vite.config.js: las actualizaciones deben seguir con prompt, no autoUpdate."
);
assert(
  /^\d+(?:\.\d+)?-[A-Z0-9-]+$/.test(version.version),
  "rafiki-version.json: versión debe tener formato Rafiki vigente, por ejemplo 120.1-FASE30B-OPTIMIZACION-PEDIDOS-HOY."
);
assert(
  viteConfig.includes("skipWaiting: false") && viteConfig.includes("clientsClaim: false"),
  "vite.config.js: Workbox debe conservar actualizaciones con confirmación para evitar cambios de versión en mitad de un pedido."
);
assert(
  viteConfig.includes("NetworkFirst") && viteConfig.includes("rafiki-pwa-metadata-network-first"),
  "vite.config.js: metadata PWA debe usar NetworkFirst."
);
assert(
  viteConfig.includes("globIgnores") && viteConfig.includes("rafiki-version.json"),
  "vite.config.js: rafiki-version.json no debe quedar precacheado."
);
assert(
  buildConfig.includes(version.version),
  "src/config/rafikiBuild.js: la versión central debe coincidir con public/rafiki-version.json."
);

if (warnings.length) {
  console.log("Advertencias PWA:");
  for (const item of warnings) console.log(`- ${item}`);
}

if (errors.length) {
  console.error("Errores PWA:");
  for (const item of errors) console.error(`- ${item}`);
  process.exit(1);
}

console.log(
  "Validación PWA OK: manifest en /mesas, iconos, Supabase NetworkOnly, rutas internas y metadatos móviles."
);
