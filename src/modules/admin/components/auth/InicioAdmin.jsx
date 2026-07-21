import { Aviso, Boton, Tarjeta } from "../../../../shared/components/common";
import { BOTONES, TEXTOS_APP } from "../../../../config/textos";

export function InicioRafiki({ navegar }) {
  return (
    <main className="welcome">
      <section className="welcome-card">
        <img src="/logo-rafiki.png" alt="Rafiki Restaurante" className="welcome-logo" />
        <h2>{TEXTOS_APP.BIENVENIDA_TITULO}</h2>
        <p>{TEXTOS_APP.BIENVENIDA_DESCRIPCION}</p>

        <div className="welcome-actions">
          <button type="button" onClick={() => navegar("/cliente", "cliente")} className="welcome-button">
            {BOTONES.CLIENTE_PEDIR}
          </button>
        </div>
      </section>
    </main>
  );
}

export function AdminLogin({
  adminEmail,
  adminPassword,
  errorClaveAdmin,
  setAdminEmail,
  setAdminPassword,
  setErrorClaveAdmin,
  validarClaveAdmin,
  navegar,
}) {
  return (
    <main style={{ maxWidth: 520, margin: "0 auto" }}>
      <Tarjeta>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div className="brand">{TEXTOS_APP.PANEL_ADMIN_MARCA}</div>
          <h2>{TEXTOS_APP.PANEL_ADMIN_TITULO}</h2>
          <p className="muted">{TEXTOS_APP.PANEL_ADMIN_DESCRIPCION}</p>
        </div>

        <Aviso mensaje={errorClaveAdmin} tipo="error" />

        <form onSubmit={validarClaveAdmin}>
          <label className="field">
            <span>Email administrativo</span>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => {
                setAdminEmail(e.target.value);
                setErrorClaveAdmin("");
              }}
              placeholder="admin@tudominio.com"
              autoComplete="username"
              autoFocus
            />
          </label>

          <label className="field">
            <span>Contraseña</span>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => {
                setAdminPassword(e.target.value);
                setErrorClaveAdmin("");
              }}
              placeholder={TEXTOS_APP.CLAVE_PLACEHOLDER}
              autoComplete="current-password"
            />
          </label>

          <p className="muted small">
            El acceso administrativo se realiza únicamente con usuarios creados en Supabase Auth.
          </p>

          <Boton tipo="submit" full>
            {BOTONES.ENTRAR_PANEL}
          </Boton>
        </form>

        <Boton
          onClick={() => {
            setAdminEmail("");
            setAdminPassword("");
            setErrorClaveAdmin("");
            navegar("/", "inicio");
          }}
          variante="light"
          full
          style={{ marginTop: 12 }}
        >
          {BOTONES.VOLVER_INICIO}
        </Boton>
      </Tarjeta>
    </main>
  );
}
