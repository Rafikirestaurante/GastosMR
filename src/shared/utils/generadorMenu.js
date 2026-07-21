export function limpiarLista(texto) {
  return String(texto || "")
    .split("\n")
    .map((linea) => linea.trim())
    .filter(Boolean);
}

export function limpiarPrecio(valor) {
  return String(valor || "").replace(/[^\d.]/g, "");
}

export function precioVisible(valor) {
  const limpio = String(valor || "").replace(/[^\d]/g, "");
  if (!limpio) return "";
  return new Intl.NumberFormat("es-CO").format(Number(limpio));
}
export function fechaHoyISO(fecha = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(fecha);
}


export const GENERADOR_MENU_EDITOR_STORAGE_KEY = "rafikiGeneradorMenuEditorUltimo";

export function guardarUltimoTextoEditorGenerador({ platosTexto = "", acompanantesTexto = "" } = {}) {
  if (typeof window === "undefined" || !window.localStorage) return false;

  const payload = {
    platosTexto: String(platosTexto || ""),
    acompanantesTexto: String(acompanantesTexto || ""),
    actualizadoEn: new Date().toISOString()
  };

  try {
    window.localStorage.setItem(GENERADOR_MENU_EDITOR_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function leerUltimoTextoEditorGenerador() {
  if (typeof window === "undefined" || !window.localStorage) return null;

  try {
    const crudo = window.localStorage.getItem(GENERADOR_MENU_EDITOR_STORAGE_KEY);
    if (!crudo) return null;

    const payload = JSON.parse(crudo);
    const platosTexto = String(payload?.platosTexto || "").trim();
    const acompanantesTexto = String(payload?.acompanantesTexto || "").trim();

    if (!platosTexto && !acompanantesTexto) return null;

    return {
      platosTexto,
      acompanantesTexto,
      actualizadoEn: payload?.actualizadoEn || null
    };
  } catch {
    return null;
  }
}

export function normalizarPlatos(platos) {
  return platos
    .map((plato) => ({
      nombre: String(plato.nombre || "").trim(),
      precio: Number(String(plato.precio || "").replace(/[^\d]/g, "")) || 0
    }))
    .filter((plato) => plato.nombre);
}

export function formatearFechaCorta(fechaISO) {
  if (!fechaISO) return "Sin fecha";
  const [year, month, day] = String(fechaISO).split("-").map(Number);
  if (!year || !month || !day) return String(fechaISO);
  const fecha = new Date(year, month - 1, day);
  return fecha.toLocaleDateString("es-CO", { day: "numeric", month: "long" });
}

export function formatearFechaInformeMenu(fechaISO) {
  if (!fechaISO) return { diaSemana: "Sin fecha", fechaCorta: "" };
  const [year, month, day] = String(fechaISO).split("-").map(Number);
  if (!year || !month || !day) return { diaSemana: String(fechaISO), fechaCorta: "" };

  const fecha = new Date(year, month - 1, day);
  const diaSemana = fecha.toLocaleDateString("es-CO", { weekday: "long" });
  const fechaCorta = fecha.toLocaleDateString("es-CO", { day: "numeric", month: "long" });

  return {
    diaSemana: diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1),
    fechaCorta
  };
}

export function obtenerPlatosSinPrecio(registro) {
  const platos = Array.isArray(registro?.platos) ? registro.platos : [];
  return platos
    .map((plato) => String(plato?.nombre || plato || "").trim())
    .filter(Boolean);
}


export function normalizarTextoBusqueda(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function nombreMenuEditor(texto) {
  return String(texto || "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function precioEditor(valor) {
  return String(valor || "").replace(/[^\d]/g, "");
}

export function esSopaMenu(nombre) {
  const limpio = normalizarTextoBusqueda(nombre);
  return /\b(sancocho|ajiaco|sopa|sopas)\b/.test(limpio);
}

export function expandirPlatoMenuEditor(plato) {
  const nombreOriginal = nombreMenuEditor(plato?.nombre);
  const precio = precioEditor(plato?.precio);
  if (!nombreOriginal) return [];

  const nombreBusqueda = normalizarTextoBusqueda(nombreOriginal);

  if (nombreBusqueda.includes("pechuga o cerdo")) {
    const resto = nombreOriginal.replace(/pechuga\s+o\s+cerdo/i, "").replace(/\s+/g, " ").trim();
    return [
      { tipo: "pechuga", categoria: "Platos", nombre: `pechuga ${resto}`.replace(/\s+/g, " ").trim(), precio },
      { tipo: "cerdo", categoria: "Platos", nombre: `cerdo ${resto}`.replace(/\s+/g, " ").trim(), precio }
    ];
  }

  if (esSopaMenu(nombreOriginal)) {
    return [{ tipo: "sopa", categoria: "Sopas", nombre: nombreOriginal, precio }];
  }

  if (/\bpechuga\b/.test(nombreBusqueda)) {
    return [{ tipo: "pechuga", categoria: "Platos", nombre: nombreOriginal, precio }];
  }

  if (/\bcerdo\b/.test(nombreBusqueda)) {
    return [{ tipo: "cerdo", categoria: "Platos", nombre: nombreOriginal, precio }];
  }

  return [{ tipo: "plato", categoria: "Platos", nombre: nombreOriginal, precio }];
}

const PRODUCTOS_FIJOS_MENU_EDITOR = [
  { tipo: "pechuga", categoria: "Platos", nombre: "Pechuga Asada sin salsa", precio: "16000" },
  { tipo: "cerdo", categoria: "Platos", nombre: "Cerdo Asado sin salsa", precio: "16000" },
  { tipo: "sopa", categoria: "Sopas", nombre: "Sopas medianas sin arroz", precio: "7000" },
  { tipo: "sopa", categoria: "Sopas", nombre: "Sopas medianas con arroz", precio: "9000" },
  { tipo: "sopa", categoria: "Sopas", nombre: "Sancocho de pollo con arroz", precio: "15000" }
];

export function generarTextoEditorMenu(platos = []) {
  const expandidos = platos.flatMap(expandirPlatoMenuEditor);
  const ordenados = [
    ...expandidos.filter((item) => item.tipo === "plato"),
    ...expandidos.filter((item) => item.tipo === "pechuga"),
    ...PRODUCTOS_FIJOS_MENU_EDITOR.filter((item) => item.tipo === "pechuga"),
    ...expandidos.filter((item) => item.tipo === "cerdo"),
    ...PRODUCTOS_FIJOS_MENU_EDITOR.filter((item) => item.tipo === "cerdo"),
    ...expandidos.filter((item) => item.tipo === "sopa"),
    ...PRODUCTOS_FIJOS_MENU_EDITOR.filter((item) => item.tipo === "sopa")
  ];

  return ordenados
    .map((item) => `${item.categoria} | ${item.nombre}:${item.precio}`)
    .join("\n");
}

export function dividirAcompananteEditor(linea) {
  return String(linea || "")
    .split(/\s+o\s+/i)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function tipoOrdenAcompananteEditor(nombre) {
  const normalizado = normalizarTextoBusqueda(nombre);
  if (normalizado.startsWith("arroz")) return 0;
  if (normalizado.startsWith("ensalada")) return 2;
  return 1;
}

export function generarTextoAcompanantesEditor(acompanantes = []) {
  const base = Array.isArray(acompanantes) ? acompanantes : limpiarLista(acompanantes);
  const items = base
    .flatMap(dividirAcompananteEditor)
    .filter(Boolean)
    .sort((a, b) => tipoOrdenAcompananteEditor(a) - tipoOrdenAcompananteEditor(b));
  return [...items, "Solo esos dos"].join("\n");
}


export function escapeSvg(texto) {
  return String(texto || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function wrapText(texto, max = 26) {
  const palabras = String(texto || "").split(" ");
  const lineas = [];
  let linea = "";

  palabras.forEach((palabra) => {
    const prueba = linea ? `${linea} ${palabra}` : palabra;
    if (prueba.length > max && linea) {
      lineas.push(linea);
      linea = palabra;
    } else {
      linea = prueba;
    }
  });

  if (linea) lineas.push(linea);
  return lineas.slice(0, 2);
}

export function crearSvgMenu({ platos, acompanantes }) {
  const width = 1080;
  const rows = platos.slice(0, 8);
  const sides = acompanantes.slice(0, 7);

  let currentY = 282;
  const rowsSvg = rows
    .map((plato, index) => {
      const lineas = wrapText(plato.nombre || "Plato", 27);
      const rowHeight = lineas.length > 1 ? 96 : 68;
      const y = currentY;
      currentY += rowHeight;

      const nombreSvg = lineas
        .map(
          (linea, i) =>
            `<text x="158" y="${y + i * 34}" font-family="Arial, sans-serif" font-size="31" font-weight="900" fill="#2f1b10">${escapeSvg(linea)}</text>`
        )
        .join("");

      return `
        <rect x="112" y="${y - 48}" width="856" height="${rowHeight - 6}" rx="24" fill="${index % 2 === 0 ? "#fffaf2" : "#ffffff"}" stroke="#f4d6a6" stroke-width="2"/>
        <circle cx="140" cy="${y - 18}" r="8" fill="#b45309"/>
        ${nombreSvg}
        <text x="925" y="${lineas.length > 1 ? y + 17 : y + 1}" font-family="Arial, sans-serif" font-size="33" font-weight="900" fill="#7f1d1d" text-anchor="end">$${escapeSvg(precioVisible(plato.precio))}</text>
      `;
    })
    .join("");

  const sidesBoxY = Math.max(815, currentY + 28);
  const sidesTitleY = sidesBoxY - 25;
  const sidesTitleTextY = sidesTitleY + 36;
  const sidesStartY = sidesBoxY + 85;
  const sidesBoxHeight = Math.max(176, 118 + Math.max(sides.length, 1) * 42);
  const height = Math.max(1080, sidesBoxY + sidesBoxHeight + 58);
  const sidesSvg = sides
    .map(
      (item, index) =>
        `<text x="170" y="${sidesStartY + index * 42}" font-family="Arial, sans-serif" font-size="30" font-weight="800" fill="#321b0f">• ${escapeSvg(item)}</text>`
    )
    .join("");

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff7ed"/>
        <stop offset="0.55" stop-color="#fffaf3"/>
        <stop offset="1" stop-color="#f6d38c"/>
      </linearGradient>
      <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#92400e"/>
        <stop offset="0.5" stop-color="#f59e0b"/>
        <stop offset="1" stop-color="#92400e"/>
      </linearGradient>
      <linearGradient id="wine" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#9f2419"/>
        <stop offset="1" stop-color="#5f150f"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#7c2d12" flood-opacity="0.20"/>
      </filter>
      <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="6" stdDeviation="9" flood-color="#7c2d12" flood-opacity="0.12"/>
      </filter>
    </defs>

    <rect width="1080" height="${height}" fill="url(#bg)"/>
    <circle cx="82" cy="112" r="170" fill="#fed7aa" opacity="0.42"/>
    <circle cx="1000" cy="${height - 80}" r="250" fill="#fdba74" opacity="0.34"/>

    <rect x="64" y="58" width="952" height="${height - 116}" rx="54" fill="#ffffff" opacity="0.95" filter="url(#shadow)"/>
    <rect x="92" y="86" width="896" height="${height - 172}" rx="42" fill="none" stroke="#b45309" stroke-width="4" opacity="0.48"/>
    <rect x="113" y="107" width="854" height="${height - 214}" rx="34" fill="none" stroke="#fde7c3" stroke-width="6" opacity="0.95"/>

    <circle cx="540" cy="155" r="58" fill="url(#wine)" filter="url(#softShadow)"/>
    <text x="540" y="174" font-family="Georgia, serif" font-size="60" font-weight="900" fill="#fff8ed" text-anchor="middle">R</text>
    <text x="540" y="244" font-family="Arial, sans-serif" font-size="46" font-weight="900" fill="#7f1d1d" text-anchor="middle" letter-spacing="3">RAFIKI</text>

    <rect x="320" y="270" width="440" height="52" rx="26" fill="url(#wine)"/>
    <text x="540" y="306" font-family="Arial, sans-serif" font-size="26" font-weight="900" fill="#f79e1c" text-anchor="middle" letter-spacing="1">MENÚ DEL DÍA</text>

    ${rowsSvg || `<text x="540" y="485" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#78716c" text-anchor="middle">Agrega los platos del día</text>`}

    <rect x="112" y="${sidesBoxY}" width="856" height="${sidesBoxHeight}" rx="32" fill="#fffaf2" stroke="#efc68e" stroke-width="4" filter="url(#softShadow)"/>
    <rect x="330" y="${sidesTitleY}" width="420" height="54" rx="27" fill="url(#gold)"/>
    <text x="540" y="${sidesTitleTextY}" font-family="Arial, sans-serif" font-size="26" font-weight="900" fill="#f79e1c" text-anchor="middle">ACOMPAÑANTES</text>
    ${sidesSvg || `<text x="170" y="884" font-family="Arial, sans-serif" font-size="30" fill="#78716c">• Escribe acompañantes...</text>`}
  </svg>`;
}

export function crearSvgMenuSoloTexto({ platos, acompanantes }) {
  const width = 1080;
  const rows = platos.slice(0, 8);
  const sides = acompanantes.slice(0, 8);

  let currentY = 170;
  const rowsSvg = rows
    .map((plato) => {
      const lineas = wrapText(plato.nombre || "Plato", 27);
      const rowHeight = lineas.length > 1 ? 92 : 66;
      const y = currentY;
      currentY += rowHeight;

      const nombreSvg = lineas
        .map(
          (linea, i) =>
            `<text x="115" y="${y + i * 38}" font-family="Arial, sans-serif" font-size="38" font-weight="900" fill="#1f130c">${escapeSvg(linea)}</text>`
        )
        .join("");

      return `
        ${nombreSvg}
        <text x="965" y="${lineas.length > 1 ? y + 18 : y + 2}" font-family="Arial, sans-serif" font-size="38" font-weight="900" fill="#1f130c" text-anchor="end">$${escapeSvg(precioVisible(plato.precio))}</text>
      `;
    })
    .join("");

  const separadorY = currentY + 18;
  const tituloAcompanantesY = separadorY + 60;
  const sidesStartY = tituloAcompanantesY + 70;
  const height = Math.max(930, sidesStartY + Math.max(sides.length, 1) * 44 + 58);
  const sidesSvg = sides
    .map(
      (item, index) =>
        `<text x="115" y="${sidesStartY + index * 44}" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#1f130c">• ${escapeSvg(item)}</text>`
    )
    .join("");

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <text x="540" y="78" font-family="Arial, sans-serif" font-size="58" font-weight="900" fill="#f79e1c" text-anchor="middle" letter-spacing="3">MENÚ DEL DÍA</text>
    <line x1="150" y1="112" x2="930" y2="112" stroke="#1f130c" stroke-width="5" opacity="0.72"/>

    ${rowsSvg || `<text x="540" y="300" font-family="Arial, sans-serif" font-size="40" font-weight="800" fill="#1f130c" text-anchor="middle">Agrega los platos del día</text>`}

    <line x1="115" y1="${separadorY}" x2="965" y2="${separadorY}" stroke="#1f130c" stroke-width="4" opacity="0.58"/>
    <text x="115" y="${tituloAcompanantesY}" font-family="Arial, sans-serif" font-size="36" font-weight="900" fill="#f79e1c">ACOMPAÑANTES</text>
    ${sidesSvg || `<text x="115" y="${sidesStartY}" font-family="Arial, sans-serif" font-size="34" fill="#1f130c">• Escribe acompañantes...</text>`}
  </svg>`;
}

