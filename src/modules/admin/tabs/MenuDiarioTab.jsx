import { CampoTexto } from "../../../shared/components/common";

export default function MenuDiarioTab({
  menu,
  setMenu,
  platosTexto,
  setPlatosTexto,
  acompanantesTexto,
  setAcompanantesTexto,
  traerTextoDesdeGeneradorMenu,
  imprimirMenuDiarioTicket,
  guardarMenu,
  guardandoMenu,
  mensajeMenu,
}) {
  return (
    <section className="card card-pad">
      <h2>✏️ Editar menú diario</h2>
      <p className="muted">
        Aquí modificas los platos, precios, categorías y acompañantes disponibles para los clientes.
      </p>

      <div className="box soft" style={{ marginBottom: 14 }}>
        <strong>Traer desde Generador de menú</strong>
        <p className="muted small" style={{ margin: "4px 0 10px" }}>
          Carga automáticamente el texto de platos del día y acompañantes generado en la sección Generador.
        </p>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <button
            type="button"
            className="button"
            onClick={traerTextoDesdeGeneradorMenu}
            style={{ width: "100%", fontWeight: 900 }}
          >
            📥 Traer platos y acompañantes del generador
          </button>
          <button
            type="button"
            className="button light"
            onClick={imprimirMenuDiarioTicket}
            style={{ width: "100%", padding: "8px 10px", fontSize: 13 }}
          >
            🧾 Imprimir menú del día
          </button>
        </div>
      </div>

      <CampoTexto
        etiqueta="Fecha"
        value={menu.fecha || ""}
        onChange={(valor) => setMenu((actual) => ({ ...actual, fecha: valor }))}
      />

      <CampoTexto
        etiqueta="Nombre del menú"
        value={menu.titulo || ""}
        onChange={(valor) => setMenu((actual) => ({ ...actual, titulo: valor }))}
      />

      <CampoTexto
        etiqueta="Descripción"
        value={menu.descripcion || ""}
        onChange={(valor) => setMenu((actual) => ({ ...actual, descripcion: valor }))}
        multiline
        rows={3}
      />

      <CampoTexto
        etiqueta="Platos del día"
        value={platosTexto}
        onChange={setPlatosTexto}
        placeholder={
          "Pechuga | Pechuga asada sin salsa:17500\nPechuga | Pechuga en salsa criolla:18500\nCerdo | Cerdo asado sin salsa:17000\nSopas | Sopas medianas sin arroz:7000\nSopas | Sopas medianas con arroz:9000\nSopas | Sancocho de pollo con arroz:15000\nCarnes | Carne guisada:19000"
        }
        multiline
        rows={9}
      />

      <CampoTexto
        etiqueta="Acompañantes del día"
        value={acompanantesTexto}
        onChange={setAcompanantesTexto}
        placeholder={"Arroz con coco\nEnsalada verde\nPuré de papa\nTajadas maduras\nYuca cocida"}
        multiline
        rows={7}
      />

      <div className="box soft small">
        <strong>Platos:</strong> escribe un plato por línea con este formato:
        <br />
        Categoría | Nombre del plato:Precio
        <br />
        <br />
        <strong>Ejemplo:</strong> Pechuga | Pechuga en salsa criolla:18500
        <br />
        <br />
        <strong>Sopas:</strong> los platos con categoría Sopas no permiten acompañantes ni incluyen sopa + bebida.
        <br />
        <br />
        <strong>Para llevar:</strong> las sopas configuradas como “Sopas medianas sin arroz”, “Sopas medianas con arroz” y “Sancocho de pollo con arroz” tienen empaque sin costo adicional.
      </div>

      <button
        type="button"
        onClick={guardarMenu}
        disabled={guardandoMenu}
        className="button"
        style={{ width: "100%", marginTop: 14 }}
      >
        {guardandoMenu ? "Guardando menú..." : "Guardar menú del día"}
      </button>

      {mensajeMenu.texto && (
        <div
          id="confirmacion-menu-diario"
          className={`alert alert-${mensajeMenu.tipo} menu-action-message`}
          role="alert"
        >
          {mensajeMenu.texto}
        </div>
      )}
    </section>
  );
}
