import PWAClearCacheButton from "../../../../shared/components/PWAClearCacheButton.jsx";

export default function AdminHeaderTabs({
  adminTab,
  setAdminTab,
  puedeVerMenu,
  puedeVerProductos,
  puedeVerGenerador,
  puedeVerRafa,
  puedeVerCatalogo,
  puedeVerInventario,
  puedeVerCaja,
  cerrarPanelAdmin,
  navegar,
}) {
  return (
    <>
      <header className="topbar admin-panel-header">
        <div>
          <div className="brand">⚙️ Admin</div>
        </div>
        <div className="nav nav-wrap">
          <button type="button" onClick={() => navegar("/mesas", "mesas")}>
            Mesas
          </button>
          <button type="button" onClick={() => navegar("/pedidos", "pedidos")}>
            Pedidos hoy
          </button>
          {puedeVerRafa && (
            <button type="button" onClick={() => navegar("/gerencia", "gerencia")}>
              Gerencia
            </button>
          )}
          <PWAClearCacheButton compact />
        </div>
      </header>

      <div className="admin-tabs">
        <button
          type="button"
          onClick={() => setAdminTab("pedidos")}
          className={adminTab === "pedidos" ? "active" : ""}
        >
          Pedidos hoy
        </button>

        {puedeVerMenu && (
          <button
            type="button"
            onClick={() => setAdminTab("menu")}
            className={adminTab === "menu" ? "active" : ""}
          >
            Editar menú diario
          </button>
        )}

        {puedeVerProductos && (
          <button
            type="button"
            onClick={() => setAdminTab("productos")}
            className={adminTab === "productos" ? "active" : ""}
          >
            Solicitud de insumos
          </button>
        )}

        {puedeVerGenerador && (
          <button
            type="button"
            onClick={() => setAdminTab("generador")}
            className={adminTab === "generador" ? "active" : ""}
          >
            Generador de menú
          </button>
        )}

        {puedeVerGenerador && (
          <button
            type="button"
            onClick={() => setAdminTab("historialMenu")}
            className={adminTab === "historialMenu" ? "active" : ""}
          >
            Historial menú
          </button>
        )}

        {puedeVerCatalogo && (
          <button
            type="button"
            onClick={() => setAdminTab("catalogo")}
            className={adminTab === "catalogo" ? "active" : ""}
          >
            Catálogo
          </button>
        )}
        {puedeVerInventario && (
          <button
            type="button"
            onClick={() => setAdminTab("inventario")}
            className={adminTab === "inventario" ? "active" : ""}
          >
            Inventario
          </button>
        )}

        {puedeVerCaja && (
          <button
            type="button"
            onClick={() => setAdminTab("caja")}
            className={adminTab === "caja" ? "active" : ""}
          >
            Caja
          </button>
        )}

        {puedeVerRafa && (
          <button
            type="button"
            onClick={() => setAdminTab("rafa")}
            className={adminTab === "rafa" ? "active" : ""}
          >
            Rafa
          </button>
        )}

        <button
          type="button"
          onClick={cerrarPanelAdmin}
          className="button light admin-tab-close"
        >
          Cerrar panel
        </button>
      </div>
    </>
  );
}
