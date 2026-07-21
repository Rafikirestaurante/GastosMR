import React, { useEffect, useMemo, useState } from "react";
import { Aviso, Boton, CampoTexto, Tarjeta } from "../../../shared/components/common";
import {
  calcularResumenInventario,
  cargarInventarioInsumos,
  guardarInventarioInsumo,
  cargarRelacionesInventarioProductos,
  guardarRelacionesInsumoProducto,
  sincronizarInventarioDesdeCatalogoInsumos
} from "../../../services/inventarioService";
import { cargarCatalogoProductosAdmin } from "../../../services/catalogoService";
import { PRODUCTOS_CATALOGO_FALLBACK } from "../../../data/catalogoProductosData";
import { dinero } from "../../../shared/utils/pedidos";
import { describirErrorSupabase, registrarErrorSupabase } from "../../../shared/utils/supabaseErrors";
import RafikiBadge from "../../../shared/components/RafikiBadge";
import RafikiEmptyState from "../../../shared/components/RafikiEmptyState";
import RafikiModal from "../../../shared/components/RafikiModal";
import RafikiTabs from "../../../shared/components/RafikiTabs";

const FORM_STOCK_INICIAL = { stockActual: "", stockMinimo: "", costoPromedio: "", activo: true };

function normalizarTextoInventario(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function productoCodigo(producto) {
  return String(producto?.catalogoId || producto?.id || `${producto?.linea}-${producto?.categoria}-${producto?.nombre}` || "") || normalizarTextoInventario(producto?.nombre);
}

function agruparProductos(productos = []) {
  const mapa = new Map();
  productos
    .filter((producto) => producto?.activo !== false)
    .forEach((producto) => {
      const linea = producto.linea || "Otros";
      const categoria = producto.categoria || "Productos";
      if (!mapa.has(linea)) mapa.set(linea, new Map());
      const categorias = mapa.get(linea);
      if (!categorias.has(categoria)) categorias.set(categoria, []);
      categorias.get(categoria).push(producto);
    });
  return Array.from(mapa.entries()).map(([linea, categorias]) => ({
    linea,
    categorias: Array.from(categorias.entries()).map(([categoria, items]) => ({ categoria, items }))
  }));
}

function estadoInsumo(item) {
  if (item.activo === false) return { texto: "Inactivo", tipo: "danger" };
  if (Number(item.stockActual || 0) <= 0) return { texto: "Agotado", tipo: "danger" };
  if (Number(item.stockActual || 0) <= Number(item.stockMinimo || 0)) return { texto: "Stock bajo", tipo: "warning" };
  return { texto: "OK", tipo: "success" };
}

export default function InventarioAdmin() {
  const [insumos, setInsumos] = useState([]);
  const [productos, setProductos] = useState(PRODUCTOS_CATALOGO_FALLBACK);
  const [relaciones, setRelaciones] = useState([]);
  const [insumoEditando, setInsumoEditando] = useState(null);
  const [formStock, setFormStock] = useState(FORM_STOCK_INICIAL);
  const [seleccionProductos, setSeleccionProductos] = useState({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState({ texto: "", tipo: "info" });
  const [busqueda, setBusqueda] = useState("");
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [vistaInventario, setVistaInventario] = useState("insumos");

  const resumen = useMemo(() => calcularResumenInventario(insumos), [insumos]);
  const relacionesPorInsumo = useMemo(() => {
    const mapa = new Map();
    relaciones.forEach((relacion) => {
      const clave = relacion.insumoId || relacion.insumo_id;
      if (!clave) return;
      const actual = mapa.get(clave) || [];
      actual.push(relacion);
      mapa.set(clave, actual);
    });
    return mapa;
  }, [relaciones]);

  const insumosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return insumos;
    return insumos.filter((item) => `${item.nombre} ${item.categoria}`.toLowerCase().includes(q));
  }, [insumos, busqueda]);

  const productosVisibles = useMemo(() => {
    const q = busquedaProducto.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter((producto) => `${producto.linea} ${producto.categoria} ${producto.nombre}`.toLowerCase().includes(q));
  }, [productos, busquedaProducto]);

  const productosAgrupados = useMemo(() => agruparProductos(productosVisibles), [productosVisibles]);

  async function cargarDatos() {
    setCargando(true);
    setMensaje({ texto: "", tipo: "info" });
    try {
      const [listaInsumos, listaRelaciones, resultadoCatalogo] = await Promise.all([
        cargarInventarioInsumos(),
        cargarRelacionesInventarioProductos(),
        cargarCatalogoProductosAdmin().catch((error) => ({ ok: false, productos: [], mensaje: describirErrorSupabase(error, "cargar el catálogo de productos") }))
      ]);
      setInsumos(listaInsumos);
      setRelaciones(listaRelaciones);
      setProductos(resultadoCatalogo?.ok && resultadoCatalogo.productos?.length ? resultadoCatalogo.productos : PRODUCTOS_CATALOGO_FALLBACK);
    } catch (error) {
      registrarErrorSupabase("cargar inventario", error);
      setMensaje({ texto: describirErrorSupabase(error, "cargar inventario"), tipo: "error" });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargarDatos(); }, []);

  async function traerBaseCatalogo() {
    setGuardando(true);
    setMensaje({ texto: "", tipo: "info" });
    try {
      const insertados = await sincronizarInventarioDesdeCatalogoInsumos(insumos);
      await cargarDatos();
      setMensaje({
        texto: insertados.length
          ? `${insertados.length} insumos fueron traídos desde el Catálogo → Insumos.`
          : "El inventario ya está sincronizado con Catálogo → Insumos.",
        tipo: "success"
      });
    } catch (error) {
      registrarErrorSupabase("traer base del catálogo a inventario", error);
      setMensaje({ texto: describirErrorSupabase(error, "traer la base del catálogo"), tipo: "error" });
    } finally {
      setGuardando(false);
    }
  }

  function abrirEditorInsumo(item) {
    const relacionesActuales = relacionesPorInsumo.get(item.id) || [];
    const seleccionInicial = {};
    relacionesActuales.forEach((relacion) => {
      seleccionInicial[relacion.productoCodigo] = {
        seleccionado: true,
        cantidad: String(relacion.cantidad || 1),
        condicion: relacion.condicion || "venta"
      };
    });
    setInsumoEditando(item);
    setFormStock({
      stockActual: String(item.stockActual),
      stockMinimo: String(item.stockMinimo),
      costoPromedio: String(item.costoPromedio),
      activo: item.activo !== false
    });
    setSeleccionProductos(seleccionInicial);
    setBusquedaProducto("");
  }

  function cerrarEditorInsumo() {
    setInsumoEditando(null);
    setFormStock(FORM_STOCK_INICIAL);
    setSeleccionProductos({});
    setBusquedaProducto("");
  }

  function actualizarStock(campo, valor) {
    setFormStock((actual) => ({ ...actual, [campo]: valor }));
  }

  function alternarProducto(producto, marcado) {
    const codigo = productoCodigo(producto);
    setSeleccionProductos((actual) => {
      const copia = { ...actual };
      if (!marcado) {
        delete copia[codigo];
        return copia;
      }
      copia[codigo] = copia[codigo] || { seleccionado: true, cantidad: "1", condicion: "venta" };
      copia[codigo] = { ...copia[codigo], seleccionado: true };
      return copia;
    });
  }

  function cambiarCantidadProducto(producto, cantidad) {
    const codigo = productoCodigo(producto);
    setSeleccionProductos((actual) => ({
      ...actual,
      [codigo]: { ...(actual[codigo] || { seleccionado: true, condicion: "venta" }), seleccionado: true, cantidad }
    }));
  }

  async function guardarEditorInsumo() {
    if (!insumoEditando) return;
    setGuardando(true);
    setMensaje({ texto: "", tipo: "info" });
    try {
      await guardarInventarioInsumo({
        ...insumoEditando,
        stockActual: formStock.stockActual,
        stockMinimo: formStock.stockMinimo,
        costoPromedio: formStock.costoPromedio,
        activo: formStock.activo !== false
      });

      const productosSeleccionados = productos
        .filter((producto) => seleccionProductos[productoCodigo(producto)]?.seleccionado)
        .map((producto) => {
          const codigo = productoCodigo(producto);
          return {
            productoCodigo: codigo,
            productoNombre: producto.nombre,
            linea: producto.linea,
            categoria: producto.categoria,
            cantidad: seleccionProductos[codigo]?.cantidad || 1,
            condicion: seleccionProductos[codigo]?.condicion || "venta"
          };
        });

      await guardarRelacionesInsumoProducto(insumoEditando, productosSeleccionados);
      await cargarDatos();
      cerrarEditorInsumo();
      setMensaje({ texto: "Insumo actualizado y productos asociados guardados.", tipo: "success" });
    } catch (error) {
      registrarErrorSupabase("guardar configuración de insumo", error);
      setMensaje({ texto: describirErrorSupabase(error, "guardar la configuración del insumo"), tipo: "error" });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="admin-stack inventario-admin-panel">
      <style>{`
        .inventario-admin-panel .inventario-lista-header { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; justify-content: space-between; }
        .inventario-admin-panel .inventario-lista-header input { min-width: min(100%, 260px); }
        .inventario-admin-panel .inventario-tabla-wrap { border: 1px solid rgba(15, 23, 42, 0.08); border-radius: 18px; overflow: auto; margin-top: 12px; }
        .inventario-admin-panel .admin-table { margin-top: 0; }
        .inventario-admin-panel .admin-table th { position: sticky; top: 0; z-index: 2; background: #fff7ed; }
        .inventario-admin-panel .inventario-numero { font-weight: 900; color: #111827; }
        .inventario-admin-panel .inventario-productos-scroll { max-height: 58vh; overflow: auto; padding-right: 4px; }
        .inventario-admin-panel .inventario-producto-card { padding: 8px; border-radius: 14px; background: #ffffff; border: 1px solid rgba(15, 23, 42, 0.08); }
        .inventario-admin-panel .inventario-modal-grid { margin: 12px 0; }
        @media (max-width: 720px) {
          .inventario-admin-panel .inventario-lista-header { align-items: stretch; }
          .inventario-admin-panel .inventario-lista-header input, .inventario-admin-panel .inventario-lista-header .button, .inventario-admin-panel .inventario-lista-header .mini-btn { width: 100%; }
        }
      `}</style>

      <Tarjeta>
        <div className="section-title-row">
          <div>
            <h2>📦 Inventario inteligente</h2>
            <p className="muted">El inventario se alimenta desde Catálogo → Insumos. Desde aquí se ajusta stock y se define qué productos consumen cada insumo.</p>
          </div>
          <div className="admin-actions-stack horizontal">
            <Boton variante="light" onClick={traerBaseCatalogo} disabled={guardando}>Traer insumos del catálogo</Boton>
            <Boton variante="light" onClick={cargarDatos}>Actualizar</Boton>
          </div>
        </div>
        <Aviso mensaje={mensaje.texto} tipo={mensaje.tipo} />
        <RafikiTabs
          activeTab={vistaInventario}
          onChange={setVistaInventario}
          ariaLabel="Secciones de inventario"
          tabs={[
            { id: "insumos", label: "Insumos", icon: "📋", count: insumos.length },
            { id: "resumen", label: "Resumen", icon: "📊" }
          ]}
        />
      </Tarjeta>

      {vistaInventario === "resumen" ? (
        <Tarjeta>
          <h3>Resumen de inventario</h3>
          <p className="muted">Indicadores principales para revisar rápido el estado del stock.</p>
          <div className="stats-grid" style={{ marginTop: 12 }}>
            <div className="stat-card"><span>Insumos activos</span><strong>{resumen.totalInsumos}</strong></div>
            <div className="stat-card"><span>Stock bajo</span><strong>{resumen.stockBajo}</strong></div>
            <div className="stat-card"><span>Agotados</span><strong>{resumen.agotados}</strong></div>
            <div className="stat-card"><span>Valor estimado</span><strong>{dinero(resumen.valorEstimado)}</strong></div>
          </div>
        </Tarjeta>
      ) : null}

      {vistaInventario === "insumos" ? (
        <Tarjeta>
          <div className="inventario-lista-header">
            <div>
              <h3>Listado de inventario</h3>
              <p className="muted">Los insumos no se crean aquí. Deben existir primero en Catálogo → Insumos y luego sincronizarse.</p>
            </div>
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="🔎 Buscar insumo..." />
          </div>
          {cargando ? <p className="muted">Cargando inventario...</p> : null}
          {!cargando && !insumosFiltrados.length ? (
            <RafikiEmptyState
              icon="📦"
              title="Sin insumos para mostrar"
              description="Primero crea o activa insumos en Catálogo → Insumos. Luego usa Traer insumos del catálogo para sincronizarlos."
              action={<Boton variante="light" onClick={traerBaseCatalogo} disabled={guardando}>Traer insumos del catálogo</Boton>}
            />
          ) : null}
          {!cargando && insumosFiltrados.length ? (
            <div className="inventario-tabla-wrap">
              <table className="admin-table">
                <thead><tr><th>Insumo</th><th>Categoría</th><th>Stock</th><th>Mínimo</th><th>Costo</th><th>Productos</th><th>Estado</th><th>Acción</th></tr></thead>
                <tbody>
                  {insumosFiltrados.map((item) => {
                    const totalRelaciones = relacionesPorInsumo.get(item.id)?.length || 0;
                    const estado = estadoInsumo(item);
                    return (
                      <tr key={item.id} style={{ opacity: item.activo === false ? 0.62 : 1 }}>
                        <td><strong>{item.nombre}</strong><br /><small className="muted">{item.unidad}</small></td>
                        <td>{item.categoria || "Sin categoría"}</td>
                        <td><span className="inventario-numero">{item.stockActual}</span> {item.unidad}</td>
                        <td>{item.stockMinimo} {item.unidad}</td>
                        <td>{dinero(item.costoPromedio)}</td>
                        <td><RafikiBadge tipo={totalRelaciones ? "info" : "neutral"}>{totalRelaciones} asociados</RafikiBadge></td>
                        <td><RafikiBadge tipo={estado.tipo}>{estado.texto}</RafikiBadge></td>
                        <td><button type="button" className="button light" onClick={() => abrirEditorInsumo(item)}>Editar</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </Tarjeta>
      ) : null}

      <RafikiModal
        open={Boolean(insumoEditando)}
        title={insumoEditando ? `Editar insumo: ${insumoEditando.nombre}` : "Editar insumo"}
        description="Ajusta stock y selecciona los productos que consumen este insumo."
        onClose={cerrarEditorInsumo}
        size="lg"
      >
        {insumoEditando ? (
          <>
            <div className="grid-form inventario-modal-grid">
              <CampoTexto etiqueta={`Stock actual (${insumoEditando.unidad})`} type="number" value={formStock.stockActual} onChange={(v) => actualizarStock("stockActual", v)} />
              <CampoTexto etiqueta={`Stock mínimo (${insumoEditando.unidad})`} type="number" value={formStock.stockMinimo} onChange={(v) => actualizarStock("stockMinimo", v)} />
              <CampoTexto etiqueta="Costo promedio" type="number" value={formStock.costoPromedio} onChange={(v) => actualizarStock("costoPromedio", v)} />
              <label className="field inline-check"><input type="checkbox" checked={formStock.activo !== false} onChange={(e) => actualizarStock("activo", e.target.checked)} /> Insumo activo</label>
            </div>

            <div className="section-title-row" style={{ marginBottom: 8 }}>
              <div>
                <h4>Productos que consumen este insumo</h4>
                <p className="muted">Marca únicamente los productos que deben descontar este insumo al venderse.</p>
              </div>
              <input value={busquedaProducto} onChange={(e) => setBusquedaProducto(e.target.value)} placeholder="🔎 Buscar producto..." />
            </div>

            <div className="admin-stack inventario-productos-scroll">
              {productosAgrupados.map((grupo) => (
                <div key={grupo.linea} className="card-soft" style={{ padding: 10 }}>
                  <h4 style={{ margin: "0 0 8px" }}>{grupo.linea}</h4>
                  {grupo.categorias.map((categoria) => (
                    <div key={`${grupo.linea}-${categoria.categoria}`} style={{ marginBottom: 10 }}>
                      <strong>{categoria.categoria}</strong>
                      <div className="grid-form" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 6 }}>
                        {categoria.items.map((producto) => {
                          const codigo = productoCodigo(producto);
                          const seleccionado = Boolean(seleccionProductos[codigo]?.seleccionado);
                          return (
                            <div key={codigo} className="inventario-producto-card">
                              <label className="inline-check" style={{ alignItems: "flex-start" }}>
                                <input type="checkbox" checked={seleccionado} onChange={(e) => alternarProducto(producto, e.target.checked)} />
                                <span><strong>{producto.nombre}</strong>{producto.precio !== "" && producto.precio != null ? <small className="muted"> · {dinero(producto.precio)}</small> : null}</span>
                              </label>
                              {seleccionado && (
                                <CampoTexto etiqueta="Cantidad a descontar" type="number" value={seleccionProductos[codigo]?.cantidad || "1"} onChange={(v) => cambiarCantidadProducto(producto, v)} placeholder="1" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {!productosAgrupados.length ? (
                <RafikiEmptyState icon="🔎" title="No hay productos para mostrar" description="Prueba limpiando la búsqueda o revisa el catálogo de productos." />
              ) : null}
            </div>

            <div className="admin-actions-stack horizontal" style={{ marginTop: 12 }}>
              <Boton onClick={guardarEditorInsumo} disabled={guardando}>{guardando ? "Guardando..." : "Guardar configuración"}</Boton>
              <Boton variante="light" onClick={cerrarEditorInsumo}>Cancelar</Boton>
            </div>
          </>
        ) : null}
      </RafikiModal>
    </div>
  );
}
