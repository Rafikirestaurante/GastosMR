import { useEffect, useMemo, useState } from "react";
import { PRODUCTOS_CATALOGO_FALLBACK } from "../../../data/catalogoProductosData";
import { cargarCatalogoProductosAdmin } from "../../../services/catalogoService";
import { dinero, normalizarTexto } from "../../../shared/utils/pedidos";

const STORAGE_CATALOGO_PRODUCTOS = "rafiki_catalogo_productos_v1";

const CATEGORIAS_PRIORITARIAS = [
  "Parfait",
  "Batidos cremosos",
  "Batidos refrescantes",
  "Jugos tradicionales",
  "Desayunos",
  "Sándwiches y fritos",
  "Bebidas",
  "Postres y ensaladas"
];

function leerProductosCatalogoStorage() {
  if (typeof window === "undefined") return PRODUCTOS_CATALOGO_FALLBACK;

  try {
    const raw = window.localStorage.getItem(STORAGE_CATALOGO_PRODUCTOS);
    if (!raw) return PRODUCTOS_CATALOGO_FALLBACK;

    const data = JSON.parse(raw);
    return Array.isArray(data) && data.length ? data : PRODUCTOS_CATALOGO_FALLBACK;
  } catch {
    return PRODUCTOS_CATALOGO_FALLBACK;
  }
}

function guardarProductosCatalogoStorage(productos) {
  if (typeof window === "undefined" || !Array.isArray(productos) || !productos.length) return;

  try {
    window.localStorage.setItem(STORAGE_CATALOGO_PRODUCTOS, JSON.stringify(productos));
  } catch {
    // Si el navegador bloquea localStorage, se conserva el catálogo cargado en memoria.
  }
}

function productoEsCafeteria(producto = {}) {
  const linea = normalizarTexto(producto?.linea || "Cafetería");
  return linea === "cafeteria" || linea.includes("cafeteria");
}

function normalizarProductoCafeteria(producto = {}) {
  const nombre = String(producto?.nombre || "").trim();
  const categoria = String(producto?.categoria || "Cafetería").trim() || "Cafetería";
  const precio = Number(producto?.precio || 0);

  if (!nombre || precio <= 0) return null;

  return {
    ...producto,
    id: producto.id || `${normalizarTexto(categoria)}-${normalizarTexto(nombre)}`,
    catalogoId: producto.catalogoId || producto.id || null,
    linea: producto.linea || "Cafetería",
    categoria,
    nombre,
    precio,
    orden: Number(producto?.orden || 0)
  };
}

function agruparProductosCafeteria(productos = []) {
  const productosValidos = (productos || [])
    .filter((producto) => producto?.activo !== false && producto?.agotado !== true)
    .filter(productoEsCafeteria)
    .map(normalizarProductoCafeteria)
    .filter(Boolean)
    .sort((a, b) => a.orden - b.orden || String(a.nombre || "").localeCompare(String(b.nombre || ""), "es"));

  return productosValidos.reduce((grupos, producto) => {
    const categoria = producto.categoria || "Cafetería";
    if (!grupos[categoria]) grupos[categoria] = [];
    grupos[categoria].push(producto);
    return grupos;
  }, {});
}

function ordenarCategorias([categoriaA], [categoriaB]) {
  const indiceA = CATEGORIAS_PRIORITARIAS.findIndex((categoria) => normalizarTexto(categoria) === normalizarTexto(categoriaA));
  const indiceB = CATEGORIAS_PRIORITARIAS.findIndex((categoria) => normalizarTexto(categoria) === normalizarTexto(categoriaB));
  const ordenA = indiceA === -1 ? 999 : indiceA;
  const ordenB = indiceB === -1 ? 999 : indiceB;

  return ordenA - ordenB || String(categoriaA).localeCompare(String(categoriaB), "es");
}

export default function CafeteriaClienteEspecial({ visible = false, onAgregarProducto }) {
  const [productosCatalogo, setProductosCatalogo] = useState(() => leerProductosCatalogoStorage());
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;

    let activo = true;
    setCargandoCatalogo(true);

    cargarCatalogoProductosAdmin()
      .then((resultado) => {
        if (!activo || !resultado?.ok || !Array.isArray(resultado.productos) || !resultado.productos.length) return;
        setProductosCatalogo(resultado.productos);
        guardarProductosCatalogoStorage(resultado.productos);
      })
      .catch(() => {
        // No bloquea el pedido público: conserva catálogo local/fallback.
      })
      .finally(() => {
        if (activo) setCargandoCatalogo(false);
      });

    return () => {
      activo = false;
    };
  }, [visible]);

  const productosPorCategoria = useMemo(
    () => agruparProductosCafeteria(productosCatalogo),
    [productosCatalogo]
  );

  if (!visible) return null;

  const categorias = Object.entries(productosPorCategoria).sort(ordenarCategorias);

  if (categorias.length === 0) {
    return (
      <div className="box soft cliente-cafeteria-especial cliente-cafeteria-especial-visible" id="cliente-cafeteria-especial">
        <strong>☕ Cafetería habilitada</strong>
        <p className="muted u-mb-0">
          No hay productos de cafetería con precio disponible en este momento. Revisa el Catálogo de productos.
        </p>
      </div>
    );
  }

  return (
    <div className="cliente-cafeteria-especial cliente-cafeteria-especial-visible fade-step" id="cliente-cafeteria-especial">
      <div className="box soft cliente-cafeteria-hero u-mb-12">
        <div>
          <strong>☕ Cafetería habilitada para cliente especial</strong>
          <p className="muted u-mb-0">
            Selecciona aquí productos de cafetería para agregarlos a este mismo pedido.
          </p>
        </div>
        {cargandoCatalogo ? <span className="badge badge-estado-negro">Actualizando catálogo...</span> : <span className="badge badge-estado-negro">Disponible</span>}
      </div>

      {categorias.map(([categoria, productos]) => (
        <div key={categoria} className="category-block cliente-cafeteria-categoria">
          <h3 className="category-title">{categoria}</h3>
          <div className="option-grid">
            {productos.map((producto) => (
              <button
                key={`${producto.id || producto.categoria}-${producto.nombre}`}
                type="button"
                className="option cliente-cafeteria-option"
                onClick={() => onAgregarProducto?.(producto)}
              >
                <div>{producto.nombre}</div>
                <small>{dinero(producto.precio)}</small>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
