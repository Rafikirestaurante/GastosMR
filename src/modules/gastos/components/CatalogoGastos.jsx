import React, { useEffect, useMemo, useState } from "react";
import { supabaseConfigMensaje, supabaseConfigOk } from "../../../supabaseClient";
import {
  actualizarCategoriaGasto,
  actualizarProveedorGasto,
  cargarCatalogoGastos,
  crearCategoriaGasto,
  crearProveedorGasto,
  fallbackCategoriasGasto,
  fallbackProveedoresGasto
} from "../../../services/catalogoGastosService";
import { describirErrorSupabase, registrarErrorSupabase } from "../../../shared/utils/supabaseErrors";

const FORM_CATEGORIA = { nombre: "", orden: "" };
const FORM_PROVEEDOR = { nombre: "", categoria: "Trabajadores", descripcionSugerida: "", orden: "" };

export default function CatalogoGastos() {
  const [categorias, setCategorias] = useState(fallbackCategoriasGasto());
  const [proveedores, setProveedores] = useState(fallbackProveedoresGasto());
  const [tipo, setTipo] = useState("proveedores");
  const [formCategoria, setFormCategoria] = useState(FORM_CATEGORIA);
  const [formProveedor, setFormProveedor] = useState(FORM_PROVEEDOR);
  const [editandoCategoriaId, setEditandoCategoriaId] = useState("");
  const [editandoProveedorId, setEditandoProveedorId] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const categoriasActivas = useMemo(() => categorias.filter((item) => item.activo !== false), [categorias]);
  const listaActual = tipo === "categorias" ? categorias : proveedores;

  async function cargar() {
    setCargando(true);
    const resultado = await cargarCatalogoGastos();
    setCategorias(resultado.categorias);
    setProveedores(resultado.proveedores);
    setMensaje(resultado.ok ? "" : `Usando respaldo local. ${resultado.mensaje || "Ejecuta el SQL pendiente de catálogo de gastos."}`);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  function limpiarCategoria() {
    setFormCategoria(FORM_CATEGORIA);
    setEditandoCategoriaId("");
  }

  function limpiarProveedor() {
    setFormProveedor(FORM_PROVEEDOR);
    setEditandoProveedorId("");
  }

  async function guardarCategoria(event) {
    event.preventDefault();
    const nombre = formCategoria.nombre.trim();
    if (!nombre) return setMensaje("Escribe el nombre de la categoría.");
    setGuardando(true);
    try {
      if (!supabaseConfigOk) throw new Error(supabaseConfigMensaje);
      const orden = formCategoria.orden || Math.max(0, ...categorias.map((item) => Number(item.orden || 0))) + 1;
      const guardada = editandoCategoriaId
        ? await actualizarCategoriaGasto(editandoCategoriaId, { nombre, orden })
        : await crearCategoriaGasto({ nombre, orden });
      setCategorias((prev) => editandoCategoriaId ? prev.map((item) => item.id === editandoCategoriaId ? { ...item, ...guardada } : item) : [guardada, ...prev]);
      setMensaje(editandoCategoriaId ? "Categoría actualizada." : "Categoría creada.");
      limpiarCategoria();
    } catch (error) {
      registrarErrorSupabase("guardar categoría de gasto", error);
      setMensaje(describirErrorSupabase(error, "guardar la categoría de gasto"));
    } finally {
      setGuardando(false);
    }
  }

  async function guardarProveedor(event) {
    event.preventDefault();
    const nombre = formProveedor.nombre.trim();
    if (!nombre) return setMensaje("Escribe el nombre del proveedor.");
    setGuardando(true);
    try {
      if (!supabaseConfigOk) throw new Error(supabaseConfigMensaje);
      const orden = formProveedor.orden || Math.max(0, ...proveedores.map((item) => Number(item.orden || 0))) + 1;
      const payload = { ...formProveedor, nombre, orden };
      const guardado = editandoProveedorId
        ? await actualizarProveedorGasto(editandoProveedorId, payload)
        : await crearProveedorGasto(payload);
      setProveedores((prev) => editandoProveedorId ? prev.map((item) => item.id === editandoProveedorId ? { ...item, ...guardado } : item) : [guardado, ...prev]);
      setMensaje(editandoProveedorId ? "Proveedor actualizado." : "Proveedor creado.");
      limpiarProveedor();
    } catch (error) {
      registrarErrorSupabase("guardar proveedor de gasto", error);
      setMensaje(describirErrorSupabase(error, "guardar el proveedor"));
    } finally {
      setGuardando(false);
    }
  }

  async function toggleCategoria(item) {
    try {
      if (!supabaseConfigOk || item.origenCatalogo === "local") throw new Error("Este registro todavía no está en Supabase.");
      const actualizado = await actualizarCategoriaGasto(item.catalogoId || item.id, { activo: item.activo === false });
      setCategorias((prev) => prev.map((cat) => cat.id === item.id ? { ...cat, ...actualizado } : cat));
    } catch (error) {
      setCategorias((prev) => prev.map((cat) => cat.id === item.id ? { ...cat, activo: cat.activo === false } : cat));
      registrarErrorSupabase("cambiar estado categoría de gasto", error);
      setMensaje("Cambio aplicado visualmente. Para dejarlo fijo, revisa permisos o ejecuta el SQL pendiente de Supabase.");
    }
  }

  async function toggleProveedor(item) {
    try {
      if (!supabaseConfigOk || item.origenCatalogo === "local") throw new Error("Este registro todavía no está en Supabase.");
      const actualizado = await actualizarProveedorGasto(item.catalogoId || item.id, { activo: item.activo === false });
      setProveedores((prev) => prev.map((prov) => prov.id === item.id ? { ...prov, ...actualizado } : prov));
    } catch (error) {
      setProveedores((prev) => prev.map((prov) => prov.id === item.id ? { ...prov, activo: prov.activo === false } : prov));
      registrarErrorSupabase("cambiar estado proveedor de gasto", error);
      setMensaje("Cambio aplicado visualmente. Para dejarlo fijo, revisa permisos o ejecuta el SQL pendiente de Supabase.");
    }
  }

  function editarCategoria(item) {
    setTipo("categorias");
    setEditandoCategoriaId(item.catalogoId || item.id);
    setFormCategoria({ nombre: item.nombre || "", orden: item.orden || "" });
  }

  function editarProveedor(item) {
    setTipo("proveedores");
    setEditandoProveedorId(item.catalogoId || item.id);
    setFormProveedor({ nombre: item.nombre || "", categoria: item.categoria || "Otros", descripcionSugerida: item.descripcionSugerida || "", orden: item.orden || "" });
  }

  return (
    <section className="soft-box catalogo-gastos-panel" style={{ marginTop: 14, borderColor: "#fed7aa", background: "linear-gradient(135deg, #fff7ed, #ffffff)" }}>
      <div className="admin-top-row">
        <h3>💸 Catálogo de gastos</h3>
        <button type="button" className="button button-secondary" onClick={cargar} disabled={cargando}>{cargando ? "Cargando..." : "Recargar"}</button>
      </div>

      <style>{`
        .badge-estado-negro { color: #111827 !important; }
        .catalogo-gastos-panel .pedidos-tabla-compacta { min-width: 620px; }
        .catalogo-gastos-panel .catalogo-selector-card small { display: none; }
        @media (max-width: 720px) {
          .catalogo-gastos-panel { padding: 10px !important; }
          .catalogo-gastos-panel .catalogo-selector-tarjetas { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
          .catalogo-gastos-panel .catalogo-selector-card { padding: 9px 10px; border-radius: 14px; gap: 8px; }
          .catalogo-gastos-panel .catalogo-selector-icono { width: 32px; height: 32px; border-radius: 11px; font-size: 17px; }
          .catalogo-gastos-panel .catalogo-selector-card strong { font-size: 12px; line-height: 1.1; }
          .catalogo-gastos-panel .grid-2 { grid-template-columns: 1fr !important; }
          .catalogo-gastos-panel .pedidos-tabla-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .catalogo-gastos-panel .pedidos-tabla-compacta { min-width: 520px; font-size: 11px; }
          .catalogo-gastos-panel .pedidos-tabla-compacta th,
          .catalogo-gastos-panel .pedidos-tabla-compacta td { padding: 7px 6px; }
          .catalogo-gastos-panel .button-small { padding: 6px 8px; font-size: 11px; }
        }
      `}</style>
      <div className="catalogo-selector-tarjetas" style={{ marginTop: 12 }}>
        <button type="button" onClick={() => setTipo("proveedores")} className={`catalogo-selector-card ${tipo === "proveedores" ? "active" : ""}`}>
          <span className="catalogo-selector-icono">🏪</span><span><strong>Proveedores</strong><small>{proveedores.length} registros</small></span>
        </button>
        <button type="button" onClick={() => setTipo("categorias")} className={`catalogo-selector-card ${tipo === "categorias" ? "active" : ""}`}>
          <span className="catalogo-selector-icono">🏷️</span><span><strong>Categorías</strong><small>{categorias.length} registros</small></span>
        </button>
      </div>

      {mensaje && <div className="alert alert-info" style={{ marginTop: 12 }}>{mensaje}</div>}

      {tipo === "categorias" ? (
        <form onSubmit={guardarCategoria} className="soft-box" style={{ marginTop: 12, background: "#fff" }}>
          <h4>{editandoCategoriaId ? "Editar categoría" : "Agregar categoría"}</h4>
          <div className="grid-2" style={{ marginTop: 10 }}>
            <label className="field-label">Nombre
              <input value={formCategoria.nombre} onChange={(e) => setFormCategoria((prev) => ({ ...prev, nombre: e.target.value }))} placeholder="Ej: Trabajadores, Batidos, Servicios" />
            </label>
            <label className="field-label">Orden
              <input type="number" value={formCategoria.orden} onChange={(e) => setFormCategoria((prev) => ({ ...prev, orden: e.target.value }))} placeholder="Opcional" />
            </label>
          </div>
          <div className="admin-actions-stack horizontal" style={{ marginTop: 10 }}>
            <button type="submit" className="button" disabled={guardando}>{guardando ? "Guardando..." : editandoCategoriaId ? "Guardar cambios" : "Agregar categoría"}</button>
            {editandoCategoriaId && <button type="button" className="button light" onClick={limpiarCategoria}>Cancelar</button>}
          </div>
        </form>
      ) : (
        <form onSubmit={guardarProveedor} className="soft-box" style={{ marginTop: 12, background: "#fff" }}>
          <h4>{editandoProveedorId ? "Editar proveedor" : "Agregar proveedor"}</h4>
          <div className="grid-2" style={{ marginTop: 10 }}>
            <label className="field-label">Nombre
              <input value={formProveedor.nombre} onChange={(e) => setFormProveedor((prev) => ({ ...prev, nombre: e.target.value }))} placeholder="Ej: Alexa, Tienda de verduras, Gas" />
            </label>
            <label className="field-label">Categoría sugerida
              <select value={formProveedor.categoria} onChange={(e) => setFormProveedor((prev) => ({ ...prev, categoria: e.target.value }))}>
                {categoriasActivas.map((cat) => <option key={cat.nombre} value={cat.nombre}>{cat.nombre}</option>)}
              </select>
            </label>
            <label className="field-label">Orden
              <input type="number" value={formProveedor.orden} onChange={(e) => setFormProveedor((prev) => ({ ...prev, orden: e.target.value }))} placeholder="Opcional" />
            </label>
          </div>
          <div className="admin-actions-stack horizontal" style={{ marginTop: 10 }}>
            <button type="submit" className="button" disabled={guardando}>{guardando ? "Guardando..." : editandoProveedorId ? "Guardar cambios" : "Agregar proveedor"}</button>
            {editandoProveedorId && <button type="button" className="button light" onClick={limpiarProveedor}>Cancelar</button>}
          </div>
        </form>
      )}

      <div className="pedidos-tabla-wrap" style={{ marginTop: 12 }}>
        <table className="pedidos-tabla-compacta">
          <thead>
            <tr>
              <th>Estado</th><th>Nombre</th>{tipo === "proveedores" && <th>Categoría</th>}<th>Orden</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {listaActual.map((item) => (
              <tr key={item.id} style={{ opacity: item.activo ? 1 : 0.58 }}>
                <td><button type="button" className={item.activo ? "badge badge-estado-negro" : "badge badge-estado-negro"} onClick={() => tipo === "categorias" ? toggleCategoria(item) : toggleProveedor(item)}>{item.activo ? "Activo" : "Inactivo"}</button></td>
                <td><strong>{item.nombre}</strong></td>
                {tipo === "proveedores" && <td>{item.categoria}</td>}
                <td>{item.orden || "—"}</td>
                <td><button type="button" className="button button-small" onClick={() => tipo === "categorias" ? editarCategoria(item) : editarProveedor(item)}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
