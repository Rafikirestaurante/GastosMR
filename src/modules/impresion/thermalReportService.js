const FORMATOS_TERMICOS = {
  "58": {
    etiqueta: "58 mm",
    pageSize: "58mm auto",
    width: "58mm",
    ventana: "width=340,height=720",
    bodyPadding: "1px 0 2px",
    fontSize: "12px",
    titleSize: "12px",
    subtitleSize: "12px",
    sectionTitleSize: "12px",
    fontWeight: "700",
    printStroke: "0.08px",
    rowGap: "0",
    tableFontSize: "12px",
    tableHeaderSize: "12px",
    tableRowPadding: "0",
    tableColumnGap: "1ch",
    tableChars: 30,
    lineHeight: "1",
    tableLineHeight: "1",
  },
  "80": {
    etiqueta: "80 mm",
    pageSize: "80mm auto",
    width: "80mm",
    ventana: "width=460,height=760",
    bodyPadding: "1px 0 2px",
    fontSize: "12px",
    titleSize: "12px",
    subtitleSize: "12px",
    sectionTitleSize: "12px",
    fontWeight: "700",
    printStroke: "0.06px",
    rowGap: "0",
    tableFontSize: "12px",
    tableHeaderSize: "12px",
    tableRowPadding: "0",
    tableColumnGap: "1ch",
    tableChars: 42,
    lineHeight: "1",
    tableLineHeight: "1",
  },
};

export function normalizarFormatoTermico(formato = "80") {
  const clave = String(formato || "80").replace(/[^0-9]/g, "");
  return FORMATOS_TERMICOS[clave] ? clave : "80";
}


export const THERMAL_REPORT_FORMAT_STORAGE_KEY = "rafiki:thermal-report-format";

export function obtenerFormatoTermicoPreferido(formatoRespaldo = "80") {
  const fallback = normalizarFormatoTermico(formatoRespaldo);
  if (typeof window === "undefined") return fallback;

  try {
    return normalizarFormatoTermico(window.localStorage?.getItem(THERMAL_REPORT_FORMAT_STORAGE_KEY) || fallback);
  } catch {
    return fallback;
  }
}

export function guardarFormatoTermicoPreferido(formato = "80") {
  const normalizado = normalizarFormatoTermico(formato);
  if (typeof window === "undefined") return normalizado;

  try {
    window.localStorage?.setItem(THERMAL_REPORT_FORMAT_STORAGE_KEY, normalizado);
  } catch {
    // La impresión debe seguir funcionando aunque localStorage no esté disponible.
  }

  return normalizado;
}

export function escapeHtmlTermico(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderTextoTermico(valor) {
  return escapeHtmlTermico(valor).replace(/\n/g, "<br />");
}

export function formatearFechaTermica(valor = new Date()) {
  const fecha = valor ? new Date(valor) : new Date();
  if (Number.isNaN(fecha.getTime())) return "--/--/--";

  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
}

function renderMeta(meta = []) {
  const visibles = (Array.isArray(meta) ? meta : [])
    .filter((item) => item?.etiqueta || item?.valor)
    .map((item) => `
      <div class="meta-row">
        <span>${renderTextoTermico(item.etiqueta)}</span>
        <strong>${renderTextoTermico(item.valor)}</strong>
      </div>
    `)
    .join("");

  return visibles ? `<section class="thermal-meta">${visibles}</section>` : "";
}

function renderRows(filas = []) {
  return (Array.isArray(filas) ? filas : [])
    .filter((fila) => fila?.etiqueta || fila?.valor)
    .map((fila) => `
      <div class="thermal-row ${fila.fuerte ? "thermal-row-strong" : ""} ${fila.tipo ? `thermal-row-${escapeHtmlTermico(fila.tipo)}` : ""}">
        <span>${renderTextoTermico(fila.etiqueta)}</span>
        <strong>${renderTextoTermico(fila.valor)}</strong>
      </div>
    `)
    .join("");
}

function renderSecciones(secciones = []) {
  return (Array.isArray(secciones) ? secciones : [])
    .filter((seccion) => seccion?.titulo || (Array.isArray(seccion?.filas) && seccion.filas.length))
    .map((seccion) => `
      <section class="thermal-section">
        ${seccion.titulo ? `<h3>${escapeHtmlTermico(seccion.titulo)}</h3>` : ""}
        ${renderRows(seccion.filas)}
      </section>
    `)
    .join("");
}

function resolverValorCampoTermico(campo, item) {
  if (!campo) return "";
  return typeof campo.valor === "function" ? campo.valor(item) : item?.[campo.key];
}

function etiquetaCampoTermico(campo, formato) {
  if (formato === "58" && campo?.etiqueta58) return campo.etiqueta58;
  if (campo?.etiquetaCorta) return campo.etiquetaCorta;
  const etiqueta = String(campo?.etiqueta || "");
  const mapa = {
    Pedido: "Ped",
    Cliente: "Cli",
    "Ubicación": "Ubic",
    Ubicacion: "Ubic",
    Total: "Total",
    Proveedor: "Prov",
    "Categoría": "Cat",
    Categoria: "Cat",
    Pago: "Pago",
    Valor: "Valor",
    "Teléfono": "Tel",
    Telefono: "Tel",
    Saldo: "Saldo",
    Estado: "Est",
  };
  return mapa[etiqueta] || etiqueta;
}

function limpiarTextoTablaTermica(valor) {
  return String(valor ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cortarTextoTablaTermica(valor, ancho) {
  const texto = limpiarTextoTablaTermica(valor);
  const limite = Math.max(1, Number(ancho) || 1);
  if (texto.length <= limite) return texto;
  if (limite <= 2) return texto.slice(0, limite);
  return `${texto.slice(0, limite - 1)}.`;
}

function formatearCeldaTablaTermica(valor, ancho, alinear = "left") {
  const texto = cortarTextoTablaTermica(valor, ancho);
  return alinear === "right" ? texto.padStart(ancho, " ") : texto.padEnd(ancho, " ");
}

function normalizarPorcentajeColumnaTermica(campo, totalCampos) {
  const raw = campo?.ancho || campo?.width;
  if (!raw) return 100 / Math.max(1, totalCampos);
  const numero = Number(String(raw).replace("%", "").trim());
  return Number.isFinite(numero) && numero > 0 ? numero : 100 / Math.max(1, totalCampos);
}

function resolverAnchosTextoTablaTermica(columnas, formato, totalCaracteres) {
  const espacios = Math.max(0, columnas.length - 1);
  const disponible = Math.max(columnas.length, Number(totalCaracteres || 30) - espacios);
  const clave = formato === "58" ? "chars58" : "chars80";
  const fijos = columnas.map((campo) => Number(campo?.[clave] || campo?.chars || 0));
  const totalFijos = fijos.reduce((acc, ancho) => acc + (Number.isFinite(ancho) && ancho > 0 ? ancho : 0), 0);

  if (totalFijos > 0 && totalFijos <= disponible) {
    const pendientes = columnas.filter((_, index) => !fijos[index]).length;
    const restante = disponible - totalFijos;
    return columnas.map((_, index) => {
      const fijo = fijos[index];
      if (Number.isFinite(fijo) && fijo > 0) return Math.max(1, Math.floor(fijo));
      return Math.max(1, Math.floor(restante / Math.max(1, pendientes)));
    });
  }

  const porcentajes = columnas.map((campo) => normalizarPorcentajeColumnaTermica(campo, columnas.length));
  const totalPorcentaje = porcentajes.reduce((acc, n) => acc + n, 0) || 100;
  let anchos = porcentajes.map((n) => Math.max(1, Math.floor((n / totalPorcentaje) * disponible)));
  let usados = anchos.reduce((acc, n) => acc + n, 0);
  let index = 0;
  while (usados < disponible) {
    anchos[index % anchos.length] += 1;
    usados += 1;
    index += 1;
  }
  while (usados > disponible) {
    const pos = anchos.findIndex((ancho) => ancho > 1);
    if (pos < 0) break;
    anchos[pos] -= 1;
    usados -= 1;
  }
  return anchos;
}

function renderListadoTabla(listado = {}, campos = [], items = [], formato = "80", cfg = FORMATOS_TERMICOS["80"]) {
  const columnas = campos.filter((campo) => !campo?.bloque);
  if (!columnas.length) return "";

  const totalCaracteres = cfg?.tableChars || (formato === "58" ? 30 : 42);
  const anchos = resolverAnchosTextoTablaTermica(columnas, formato, totalCaracteres);
  const construirLinea = (item, usarEtiquetas = false) => columnas.map((campo, index) => {
    const valor = usarEtiquetas ? etiquetaCampoTermico(campo, formato) : resolverValorCampoTermico(campo, item);
    return formatearCeldaTablaTermica(valor, anchos[index], campo.alinear === "right" ? "right" : "left");
  }).join(" ").replace(/\s+$/g, "");

  const lineas = [construirLinea({}, true), ...items.map((item) => construirLinea(item, false))];

  return `
    <section class="thermal-list-section thermal-list-section-table">
      ${listado.titulo ? `<h3>${renderTextoTermico(listado.titulo)}</h3>` : ""}
      <pre class="thermal-pre-table">${escapeHtmlTermico(lineas.join("\n"))}</pre>
    </section>
  `;
}

function renderListadoBloques(listado = {}, campos = [], items = []) {
  return `
    <section class="thermal-list-section">
      ${listado.titulo ? `<h3>${renderTextoTermico(listado.titulo)}</h3>` : ""}
      <div class="thermal-list">
        ${items.map((item) => `
          <article class="thermal-list-item">
            ${campos.map((campo) => `
              <div class="thermal-list-line ${campo.fuerte ? "thermal-list-line-strong" : ""} ${campo.bloque ? "thermal-list-line-block" : ""}">
                <span>${renderTextoTermico(campo.etiqueta)}</span>
                <strong>${renderTextoTermico(resolverValorCampoTermico(campo, item))}</strong>
              </div>
            `).join("")}
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderListado(listado = {}, formato = "80", cfg = FORMATOS_TERMICOS["80"]) {
  const items = Array.isArray(listado.items) ? listado.items : [];
  if (!items.length) return listado.vacio ? `<div class="thermal-empty">${renderTextoTermico(listado.vacio)}</div>` : "";

  const campos = Array.isArray(listado.campos) ? listado.campos : [];
  const modo = String(listado.modo || listado.layout || "bloques").toLowerCase();
  if (modo === "tabla" || listado.tabla === true) {
    return renderListadoTabla(listado, campos, items, formato, cfg);
  }

  return renderListadoBloques(listado, campos, items);
}

function construirHtmlReporteTermico({ formato = "80", titulo = "Reporte Rafiki", subtitulo = "", meta = [], secciones = [], listado = null, pie = "" }) {
  const claveFormato = normalizarFormatoTermico(formato);
  const cfg = FORMATOS_TERMICOS[claveFormato];
  const tituloSeguro = escapeHtmlTermico(titulo);

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${tituloSeguro} ${cfg.etiqueta}</title>
        <style>
          @page { size: ${cfg.pageSize}; margin: 0; }
          * { box-sizing: border-box; }
          body {
            width: ${cfg.width};
            margin: 0;
            padding: ${cfg.bodyPadding};
            background: #fff;
            color: #000;
            font-family: "Courier New", "Lucida Console", monospace;
            font-size: ${cfg.fontSize};
            line-height: ${cfg.lineHeight};
            font-weight: ${cfg.fontWeight};
            color: #000 !important;
            -webkit-font-smoothing: none;
            -moz-osx-font-smoothing: auto;
            text-rendering: optimizeSpeed;
            -webkit-text-stroke: ${cfg.printStroke} #000;
          }
          h1, h2, h3, p { margin: 0; padding: 0; }
          strong, b { font-weight: ${cfg.fontWeight}; color: #000 !important; }
          .thermal-title {
            text-align: center;
            font-size: ${cfg.titleSize};
            line-height: ${cfg.lineHeight};
            font-weight: ${cfg.fontWeight};
            text-transform: uppercase;
            margin: 0;
          }
          .thermal-subtitle {
            text-align: center;
            font-size: ${cfg.subtitleSize};
            line-height: ${cfg.lineHeight};
            font-weight: ${cfg.fontWeight};
            margin: 0;
          }
          .thermal-meta,
          .thermal-section,
          .thermal-list-section {
            border: 0;
            padding: 0;
            margin: 1px 0 0;
          }
          .thermal-section h3,
          .thermal-list-section h3 {
            margin: 1px 0 0;
            font-size: ${cfg.sectionTitleSize};
            line-height: ${cfg.lineHeight};
            text-transform: uppercase;
            text-align: left;
            letter-spacing: 0;
            font-weight: ${cfg.fontWeight};
          }
          .meta-row,
          .thermal-row,
          .thermal-list-line {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 2px;
            margin: 0;
            padding: 0;
          }
          .meta-row span,
          .thermal-row span,
          .thermal-list-line span {
            flex: 1 1 auto;
            min-width: 0;
            overflow-wrap: anywhere;
            word-break: break-word;
          }
          .meta-row strong,
          .thermal-row strong,
          .thermal-list-line strong {
            flex: 0 0 auto;
            max-width: 52%;
            text-align: right;
            overflow-wrap: anywhere;
            word-break: break-word;
          }
          .thermal-row-strong,
          .thermal-list-line-strong,
          .thermal-row-strong span,
          .thermal-row-strong strong,
          .thermal-list-line-strong span,
          .thermal-list-line-strong strong {
            font-size: 1em;
            font-weight: ${cfg.fontWeight};
          }
          .thermal-list,
          .thermal-list-item {
            margin: 0;
            padding: 0;
            border: 0;
          }
          .thermal-list-line-block {
            display: block;
            margin: 0;
          }
          .thermal-list-line-block span,
          .thermal-list-line-block strong {
            display: block;
            width: 100%;
            max-width: 100%;
            text-align: left;
          }
          .thermal-list-line-block span {
            font-size: 1em;
            text-transform: uppercase;
            font-weight: ${cfg.fontWeight};
          }
          .thermal-pre-table {
            width: 100%;
            margin: 0;
            padding: 0;
            border: 0;
            font-family: "Courier New", "Lucida Console", monospace;
            font-size: ${cfg.tableFontSize};
            line-height: ${cfg.tableLineHeight};
            font-weight: ${cfg.fontWeight};
            letter-spacing: 0;
            white-space: pre;
            overflow: hidden;
            -webkit-font-smoothing: none;
            text-rendering: optimizeSpeed;
          }
          .thermal-table {
            width: 100%;
            font-family: "Courier New", "Lucida Console", monospace;
            letter-spacing: 0;
            margin: 0;
            padding: 0;
          }
          .thermal-table-row {
            display: grid;
            column-gap: ${cfg.tableColumnGap};
            align-items: start;
            border: 0;
            margin: 0;
            padding: ${cfg.tableRowPadding};
          }
          .thermal-table-head { border: 0; margin: 0; padding: 0; }
          .thermal-table-cell {
            min-width: 0;
            overflow-wrap: anywhere;
            word-break: break-word;
            line-height: ${cfg.tableLineHeight};
            font-size: ${cfg.tableFontSize};
            font-weight: ${cfg.fontWeight};
          }
          .thermal-table-head-cell { font-size: ${cfg.tableHeaderSize}; text-transform: uppercase; font-weight: ${cfg.fontWeight}; }
          .thermal-table-cell-strong { font-weight: ${cfg.fontWeight}; }
          .thermal-table-cell-right { text-align: right; }
          .thermal-empty {
            border: 0;
            margin: 1px 0 0;
            padding: 0;
            text-align: center;
            font-weight: ${cfg.fontWeight};
          }
          .thermal-footer {
            border: 0;
            margin: 1px 0 0;
            padding: 0;
            text-align: center;
            font-size: 0.9em;
            font-weight: ${cfg.fontWeight};
          }
          @media print {
            body, .thermal-pre-table, .thermal-table-cell, .thermal-row, .meta-row {
              color: #000 !important;
              font-weight: ${cfg.fontWeight} !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <h1 class="thermal-title">${tituloSeguro}</h1>
        ${subtitulo ? `<p class="thermal-subtitle">${escapeHtmlTermico(subtitulo)}</p>` : ""}
        ${renderMeta(meta)}
        ${renderSecciones(secciones)}
        ${listado ? renderListado(listado, claveFormato, cfg) : ""}
        <div class="thermal-footer">${escapeHtmlTermico(pie || `Formato ${cfg.etiqueta} · ${formatearFechaTermica(new Date())}`)}</div>
        <script>
          window.onload = function () {
            setTimeout(function () {
              window.print();
              window.close();
            }, 250);
          };
        </script>
      </body>
    </html>
  `;
}

export function imprimirReporteTermico(opciones = {}) {
  if (typeof window === "undefined") return false;

  const formato = normalizarFormatoTermico(opciones.formato);
  const cfg = FORMATOS_TERMICOS[formato];
  const ventana = window.open("", "_blank", cfg.ventana);
  if (!ventana) return false;

  ventana.document.open();
  ventana.document.write(construirHtmlReporteTermico({ ...opciones, formato }));
  ventana.document.close();
  return true;
}

export function crearCamposListadoPedidosTermico({ obtenerNumero, obtenerClientePedido, obtenerUbicacionPedido, obtenerTotalPedido }) {
  return [
    { etiqueta: "Pedido", etiquetaCorta: "Ped", ancho: "17%", chars58: 5, chars80: 7, valor: (pedido) => `#${obtenerNumero(pedido)}`, fuerte: true },
    { etiqueta: "Cliente", etiquetaCorta: "Cli", ancho: "29%", chars58: 7, chars80: 13, valor: obtenerClientePedido },
    { etiqueta: "Ubicación", etiquetaCorta: "Ubic", ancho: "31%", chars58: 8, chars80: 13, valor: obtenerUbicacionPedido },
    { etiqueta: "Total", etiquetaCorta: "Total", ancho: "23%", chars58: 7, chars80: 9, alinear: "right", valor: obtenerTotalPedido, fuerte: true },
  ];
}
