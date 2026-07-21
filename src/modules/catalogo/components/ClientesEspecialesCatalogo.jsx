import React, { useEffect, useMemo, useState } from "react";
import {
  actualizarClienteEspecial,
  crearClienteEspecial,
  crearReglasClienteEspecialBase,
  listarClientesEspeciales,
  normalizarCodigoClienteEspecial,
  validarCodigoClienteEspecial
} from "../../../services/clientesEspecialesService";
import { supabaseConfigOk, supabaseConfigMensaje } from "../../../supabaseClient";

const FORM_INICIAL = {
  codigo: "",
  nombre: "",
  telefono: "",
  ubicacion: "",
  mensaje_bienvenida: "",
  observaciones: "",
  activo: true,
  sin_restriccion_acompanantes: true,
  habilita_cafeteria: true,
  permite_modificar_datos: true
};

function limpiarTexto(valor) {
  return String(valor || "").trim().replace(/\s+/g, " ");
}

function formDesdeCliente(cliente = {}) {
  return {
    codigo: String(cliente.codigo || ""),
    nombre: String(cliente.nombre || ""),
    telefono: String(cliente.telefono || ""),
    ubicacion: String(cliente.ubicacion || ""),
    mensaje_bienvenida: String(cliente.mensaje_bienvenida || ""),
    observaciones: String(cliente.observaciones || ""),
    activo: cliente.activo !== false,
    sin_restriccion_acompanantes: cliente.sin_restriccion_acompanantes !== false,
    habilita_cafeteria: cliente.habilita_cafeteria !== false,
    permite_modificar_datos: cliente.permite_modificar_datos !== false
  };
}

function prepararPayload(form) {
  const nombre = limpiarTexto(form.nombre);
  return {
    codigo: normalizarCodigoClienteEspecial(form.codigo),
    nombre,
    telefono: String(form.telefono || "").trim(),
    ubicacion: limpiarTexto(form.ubicacion),
    mensaje_bienvenida: limpiarTexto(form.mensaje_bienvenida) || (nombre ? `Bienvenido, ${nombre}` : ""),
    observaciones: limpiarTexto(form.observaciones),
    activo: form.activo !== false,
    sin_restriccion_acompanantes: form.sin_restriccion_acompanantes !== false,
    habilita_cafeteria: form.habilita_cafeteria !== false,
    permite_modificar_datos: form.permite_modificar_datos !== false,
    reglas_json: crearReglasClienteEspecialBase()
  };
}

function ClienteEspecialTabla({ clientes, onEditar, onToggleActivo }) {
  if (!clientes.length) {
    return <div className="alert alert-info">No hay clientes especiales con ese filtro.</div>;
  }

  return (
    <>
      <div className="pedidos-tabla-wrap catalogo-tabla-desktop" style={{ marginTop: 12 }}>
        <table className="pedidos-tabla-compacta">
          <thead>
            <tr>
              <th>Estado</th>
              <th>Código</th>
              <th>Cliente</th>
              <th>Teléfono</th>
              <th>Ubicación</th>
              <th>Reglas</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((cliente) => (
              <tr key={cliente.id} style={{ opacity: cliente.activo ? 1 : 0.6 }}>
                <td>
                  <button
                    type="button"
                    className="badge badge-estado-negro"
                    onClick={() => onToggleActivo(cliente)}
                  >
                    {cliente.activo ? "Activo" : "Inactivo"}
                  </button>
                </td>
                <td><strong>{cliente.codigo}</strong></td>
                <td>
                  <strong>{cliente.nombre}</strong>
                  {cliente.mensaje_bienvenida && (
                    <small style={{ display: "block", color: "#6b7280" }}>{cliente.mensaje_bienvenida}</small>
                  )}
                </td>
                <td>{cliente.telefono || "—"}</td>
                <td>{cliente.ubicacion || "—"}</td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {cliente.sin_restriccion_acompanantes && <span className="badge badge-estado-negro">Sin mínimo</span>}
                    {cliente.habilita_cafeteria && <span className="badge badge-estado-negro">Cafetería</span>}
                    {cliente.permite_modificar_datos && <span className="badge badge-estado-negro">Datos editables</span>}
                  </div>
                </td>
                <td>
                  <button type="button" className="button button-small" onClick={() => onEditar(cliente)}>Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="catalogo-cards-mobile">
        {clientes.map((cliente) => (
          <article key={cliente.id} className="catalogo-card" style={{ opacity: cliente.activo ? 1 : 0.65 }}>
            <div className="catalogo-card-head">
              <strong>{cliente.nombre}</strong>
              <button
                type="button"
                className="badge badge-estado-negro"
                onClick={() => onToggleActivo(cliente)}
              >
                {cliente.activo ? "Activo" : "Inactivo"}
              </button>
            </div>
            <div className="catalogo-card-meta">
              <span>Código: {cliente.codigo}</span>
              {cliente.telefono && <span>{cliente.telefono}</span>}
              {cliente.ubicacion && <span>{cliente.ubicacion}</span>}
            </div>
            {cliente.mensaje_bienvenida && <p style={{ margin: "8px 0 0", color: "#4b5563" }}>{cliente.mensaje_bienvenida}</p>}
            <div className="catalogo-card-meta" style={{ marginTop: 8 }}>
              {cliente.sin_restriccion_acompanantes && <span>Sin mínimo</span>}
              {cliente.habilita_cafeteria && <span>Cafetería</span>}
              {cliente.permite_modificar_datos && <span>Datos editables</span>}
            </div>
            <div className="catalogo-card-actions">
              <button type="button" className="button button-small" onClick={() => onEditar(cliente)}>Editar</button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

export default function ClientesEspecialesCatalogo() {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [form, setForm] = useState(FORM_INICIAL);
  const [editandoId, setEditandoId] = useState("");
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [codigoPrueba, setCodigoPrueba] = useState("");
  const [validandoCodigo, setValidandoCodigo] = useState(false);
  const [resultadoValidacion, setResultadoValidacion] = useState(null);

  const clientesFiltrados = useMemo(() => {
    const terminos = busqueda
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return clientes
      .filter((cliente) => {
        const texto = [cliente.codigo, cliente.nombre, cliente.telefono, cliente.ubicacion, cliente.observaciones]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const coincideBusqueda = terminos.length === 0 || terminos.every((termino) => texto.includes(termino));
        const coincideEstado = estadoFiltro === "todos" || (estadoFiltro === "activos" && cliente.activo !== false) || (estadoFiltro === "inactivos" && cliente.activo === false);
        return coincideBusqueda && coincideEstado;
      })
      .sort((a, b) => Number(a.activo === false) - Number(b.activo === false) || String(a.nombre || "").localeCompare(String(b.nombre || ""), "es"));
  }, [busqueda, clientes, estadoFiltro]);

  const resumen = useMemo(() => {
    const activos = clientes.filter((cliente) => cliente.activo !== false).length;
    return { total: clientes.length, activos, inactivos: clientes.length - activos };
  }, [clientes]);

  async function cargarClientes() {
    setCargando(true);
    const resultado = await listarClientesEspeciales({ incluirInactivos: true });
    if (resultado.ok) {
      setClientes(resultado.clientes);
      setMensaje(resultado.clientes.length ? "Clientes especiales cargados." : "Aún no hay clientes especiales creados.");
    } else {
      setMensaje(resultado.mensaje || "No se pudo cargar clientes especiales.");
    }
    setCargando(false);
  }

  useEffect(() => {
    cargarClientes();
  }, []);

  function cambiarCampo(campo, valor) {
    setForm((prev) => ({
      ...prev,
      [campo]: campo === "codigo" ? normalizarCodigoClienteEspecial(valor) : valor
    }));
  }

  function limpiarFormulario() {
    setForm(FORM_INICIAL);
    setEditandoId("");
  }

  function editarCliente(cliente) {
    setEditandoId(cliente.id);
    setForm(formDesdeCliente(cliente));
    setMensaje(`Editando cliente especial ${cliente.nombre}.`);
  }

  async function guardarCliente(e) {
    e.preventDefault();
    const payload = prepararPayload(form);

    if (!payload.codigo || payload.codigo.length < 3) {
      setMensaje("El código debe tener al menos 3 caracteres.");
      return;
    }

    if (!payload.nombre || payload.nombre.length < 2) {
      setMensaje("El nombre del cliente especial es obligatorio.");
      return;
    }

    setGuardando(true);
    const resultado = editandoId
      ? await actualizarClienteEspecial(editandoId, payload)
      : await crearClienteEspecial(payload);

    if (resultado.ok && resultado.cliente) {
      const actualizados = editandoId
        ? clientes.map((cliente) => cliente.id === editandoId ? resultado.cliente : cliente)
        : [resultado.cliente, ...clientes.filter((cliente) => cliente.id !== resultado.cliente.id)];
      setClientes(actualizados);
      setMensaje(editandoId ? "Cliente especial actualizado." : "Cliente especial creado.");
      limpiarFormulario();
    } else {
      setMensaje(resultado.mensaje || "No se pudo guardar el cliente especial.");
    }

    setGuardando(false);
  }

  async function toggleActivo(cliente) {
    if (!cliente?.id) return;
    const nuevoActivo = cliente.activo === false;
    setGuardando(true);
    const resultado = await actualizarClienteEspecial(cliente.id, { activo: nuevoActivo });
    if (resultado.ok && resultado.cliente) {
      setClientes((prev) => prev.map((item) => item.id === cliente.id ? resultado.cliente : item));
      setMensaje(nuevoActivo ? "Cliente especial activado." : "Cliente especial desactivado.");
    } else {
      setMensaje(resultado.mensaje || "No se pudo cambiar el estado del cliente especial.");
    }
    setGuardando(false);
  }


  async function probarCodigoEspecial(e) {
    e.preventDefault();
    const codigoNormalizado = normalizarCodigoClienteEspecial(codigoPrueba);

    if (!codigoNormalizado || codigoNormalizado.length < 3) {
      setResultadoValidacion({ ok: false, mensaje: "Ingresa un código de al menos 3 caracteres para probar." });
      return;
    }

    setValidandoCodigo(true);
    const resultado = await validarCodigoClienteEspecial(codigoNormalizado);
    setResultadoValidacion(resultado);
    setValidandoCodigo(false);
  }

  function limpiarPruebaCodigo() {
    setCodigoPrueba("");
    setResultadoValidacion(null);
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="alert alert-info">
        Esta pantalla solo administra la base de clientes especiales. En esta subfase todavía no cambia el comportamiento de <strong>/cliente</strong> ni <strong>/mesas</strong>.
      </div>

      {!supabaseConfigOk && (
        <div className="alert alert-warning" style={{ marginTop: 12 }}>
          Catálogo sin conexión a Supabase: {supabaseConfigMensaje}. Ejecuta el SQL de Fase 34A y revisa las variables de entorno antes de administrar clientes especiales.
        </div>
      )}

      <div className="catalogo-resumen-mini" style={{ marginTop: 12 }}>
        <span><strong>{resumen.total}</strong> clientes</span>
        <span><strong>{resumen.activos}</strong> activos</span>
        <span><strong>{resumen.inactivos}</strong> inactivos</span>
      </div>

      <div className="catalogo-filtros-avanzados" style={{ marginTop: 12 }}>
        <label className="field catalogo-busqueda-field">
          <span>🔎 Buscar cliente especial</span>
          <input
            type="search"
            placeholder="Código, nombre, teléfono o ubicación"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="catalogo-busqueda"
          />
        </label>
        <label className="field-label">
          Estado
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
          </select>
        </label>
        <button type="button" className="button button-secondary" onClick={cargarClientes} disabled={cargando}>
          {cargando ? "Cargando..." : "Actualizar"}
        </button>
      </div>


      <form onSubmit={probarCodigoEspecial} className="soft-box" style={{ marginTop: 14, background: "#f8fafc", borderColor: "#bfdbfe" }}>
        <h4>Validación controlada de código</h4>
        <p style={{ margin: "6px 0 0", color: "#4b5563" }}>
          Prueba aquí la RPC <strong>validar_cliente_especial_codigo</strong> antes de activar el campo en <strong>/cliente</strong>. Esta prueba no crea pedidos ni cambia reglas operativas.
        </p>
        <div className="catalogo-filtros-avanzados" style={{ marginTop: 12 }}>
          <label className="field catalogo-busqueda-field">
            <span>Código a validar</span>
            <input
              type="search"
              placeholder="Ej: RAFIKI-VIP"
              value={codigoPrueba}
              onChange={(e) => {
                setCodigoPrueba(normalizarCodigoClienteEspecial(e.target.value));
                setResultadoValidacion(null);
              }}
              className="catalogo-busqueda"
              autoComplete="off"
            />
          </label>
          <button type="submit" className="button" disabled={validandoCodigo || !supabaseConfigOk}>
            {validandoCodigo ? "Validando..." : "Probar código"}
          </button>
          {(codigoPrueba || resultadoValidacion) && (
            <button type="button" className="button button-secondary" onClick={limpiarPruebaCodigo}>
              Limpiar prueba
            </button>
          )}
        </div>

        {resultadoValidacion && (
          <div className={resultadoValidacion.ok ? "alert alert-success" : "alert alert-warning"} style={{ marginTop: 12 }}>
            <strong>{resultadoValidacion.ok ? "Código válido." : "Código no habilitado."}</strong> {resultadoValidacion.mensaje}
            {resultadoValidacion.ok && resultadoValidacion.cliente && (
              <div className="catalogo-resumen-mini" style={{ marginTop: 10 }}>
                <span><strong>{resultadoValidacion.cliente.nombre}</strong></span>
                <span>Código: <strong>{resultadoValidacion.cliente.codigo}</strong></span>
                <span>Teléfono: <strong>{resultadoValidacion.cliente.telefono || "—"}</strong></span>
                <span>Ubicación: <strong>{resultadoValidacion.cliente.ubicacion || "—"}</strong></span>
                <span>{resultadoValidacion.cliente.sin_restriccion_acompanantes ? "Sin restricción de acompañantes" : "Mantiene restricción"}</span>
                <span>{resultadoValidacion.cliente.habilita_cafeteria ? "Cafetería habilitada" : "Cafetería no habilitada"}</span>
                <span>{resultadoValidacion.cliente.permite_modificar_datos ? "Datos editables" : "Datos bloqueados"}</span>
              </div>
            )}
          </div>
        )}
      </form>

      <form onSubmit={guardarCliente} className="soft-box" style={{ marginTop: 14, background: "#fff" }}>
        <h4>{editandoId ? "Editar cliente especial" : "Agregar cliente especial"}</h4>
        <div className="grid-2" style={{ marginTop: 10 }}>
          <label className="field-label">
            Código
            <input
              value={form.codigo}
              onChange={(e) => cambiarCampo("codigo", e.target.value)}
              placeholder="Ej: RAFIKI-VIP"
              autoComplete="off"
            />
          </label>
          <label className="field-label">
            Nombre
            <input
              value={form.nombre}
              onChange={(e) => cambiarCampo("nombre", e.target.value)}
              placeholder="Nombre del cliente"
            />
          </label>
          <label className="field-label">
            Teléfono predeterminado
            <input
              value={form.telefono}
              onChange={(e) => cambiarCampo("telefono", e.target.value)}
              placeholder="Opcional"
              inputMode="tel"
            />
          </label>
          <label className="field-label">
            Ubicación predeterminada
            <input
              value={form.ubicacion}
              onChange={(e) => cambiarCampo("ubicacion", e.target.value)}
              placeholder="Ej: Oficina, apartamento, recepción"
            />
          </label>
          <label className="field-label">
            Mensaje de bienvenida
            <input
              value={form.mensaje_bienvenida}
              onChange={(e) => cambiarCampo("mensaje_bienvenida", e.target.value)}
              placeholder="Si se deja vacío, se genera automáticamente"
            />
          </label>
          <label className="field-label">
            Observaciones internas
            <input
              value={form.observaciones}
              onChange={(e) => cambiarCampo("observaciones", e.target.value)}
              placeholder="Opcional, no visible para el cliente"
            />
          </label>
        </div>

        <div className="catalogo-selector-tarjetas" style={{ marginTop: 12 }}>
          <button
            type="button"
            className={`catalogo-selector-card ${form.activo ? "active" : ""}`}
            onClick={() => cambiarCampo("activo", !form.activo)}
            aria-pressed={form.activo}
          >
            <span className="catalogo-selector-icono">✅</span>
            <span><strong>Cliente activo</strong><small style={{ display: "block" }}>El código podrá validarse</small></span>
          </button>
          <button
            type="button"
            className={`catalogo-selector-card ${form.sin_restriccion_acompanantes ? "active" : ""}`}
            onClick={() => cambiarCampo("sin_restriccion_acompanantes", !form.sin_restriccion_acompanantes)}
            aria-pressed={form.sin_restriccion_acompanantes}
          >
            <span className="catalogo-selector-icono">🍽️</span>
            <span><strong>Sin restricción</strong><small style={{ display: "block" }}>Acompañantes libres</small></span>
          </button>
          <button
            type="button"
            className={`catalogo-selector-card ${form.habilita_cafeteria ? "active" : ""}`}
            onClick={() => cambiarCampo("habilita_cafeteria", !form.habilita_cafeteria)}
            aria-pressed={form.habilita_cafeteria}
          >
            <span className="catalogo-selector-icono">☕</span>
            <span><strong>Cafetería</strong><small style={{ display: "block" }}>Base para 34D/34E</small></span>
          </button>
          <button
            type="button"
            className={`catalogo-selector-card ${form.permite_modificar_datos ? "active" : ""}`}
            onClick={() => cambiarCampo("permite_modificar_datos", !form.permite_modificar_datos)}
            aria-pressed={form.permite_modificar_datos}
          >
            <span className="catalogo-selector-icono">✏️</span>
            <span><strong>Datos editables</strong><small style={{ display: "block" }}>Teléfono y ubicación</small></span>
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <button type="submit" className="button" disabled={guardando || !supabaseConfigOk}>
            {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Agregar cliente"}
          </button>
          {editandoId && <button type="button" className="button button-secondary" onClick={limpiarFormulario}>Cancelar edición</button>}
        </div>
      </form>

      {mensaje && <div className="alert alert-info" style={{ marginTop: 12 }}>{mensaje}</div>}

      <ClienteEspecialTabla clientes={clientesFiltrados} onEditar={editarCliente} onToggleActivo={toggleActivo} />
    </div>
  );
}
