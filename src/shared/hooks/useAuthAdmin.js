import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigOk } from "../../supabaseClient";
import { conTiempoMaximo } from "../utils/async";
import { guardarSesionTemporal, obtenerSesionActiva } from "../utils/pedidos";
import {
  describirActor,
  nombreRol,
  obtenerRolCacheadoRapido,
  obtenerRolUsuarioDesdeTabla,
  primeraPestanaPermitida,
  usuarioPuede
} from "../utils/authAdmin";
import { describirErrorSupabase, registrarErrorSupabase } from "../utils/supabaseErrors";

function estaEnModoPWAInstalada() {
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches ||
      window.matchMedia?.('(display-mode: fullscreen)').matches ||
      window.navigator.standalone
  );
}

export const ADMIN_TAB_STORAGE_KEY = "rafikiAdminTabActiva";

export const ADMIN_TABS_VALIDAS = new Set([
  "pedidos",
  "menu",
  "productos",
  "generador",
  "catalogo",
  "inventario",
  "caja",
  "rafa"
]);

export function leerAdminTabGuardada() {
  try {
    const tab = window.localStorage.getItem(ADMIN_TAB_STORAGE_KEY);
    return ADMIN_TABS_VALIDAS.has(tab) ? tab : "pedidos";
  } catch {
    return "pedidos";
  }
}

export function guardarAdminTabActiva(tab) {
  try {
    if (ADMIN_TABS_VALIDAS.has(tab)) {
      window.localStorage.setItem(ADMIN_TAB_STORAGE_KEY, tab);
    }
  } catch {
    // No bloquea el panel si localStorage no está disponible.
  }
}

export function useAuthAdmin({ vista, setVista, navegar }) {
  const [adminTab, setAdminTab] = useState(() => leerAdminTabGuardada());
  const [adminAutenticado, setAdminAutenticado] = useState(() => obtenerSesionActiva("rafikiAdminActivo"));
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminUsuario, setAdminUsuario] = useState(null);
  const [adminRol, setAdminRol] = useState("usuario");
  const [adminAuthCargando, setAdminAuthCargando] = useState(false);
  const [errorClaveAdmin, setErrorClaveAdmin] = useState("");
  const verificacionAdminRef = useRef({ enCurso: false, ultimoChequeo: 0 });

  const adminNombreRol = nombreRol(adminRol);
  const adminActor = describirActor(
    adminUsuario,
    adminAutenticado ? "Clave administrativa local" : "Sin sesión"
  );

  const puedeVerMenu = usuarioPuede(adminRol, "menu");
  const puedeVerProductos = usuarioPuede(adminRol, "productos");
  const puedeVerGenerador = usuarioPuede(adminRol, "generador");
  const puedeVerRafa = usuarioPuede(adminRol, "rafa");
  const puedeVerCatalogo = usuarioPuede(adminRol, "catalogo");
  const puedeVerGastos = usuarioPuede(adminRol, "gastos");
  const puedeVerInventario = usuarioPuede(adminRol, "inventario");
  const puedeVerCaja = usuarioPuede(adminRol, "caja");
  const puedeVerInformeGastos = usuarioPuede(adminRol, "gastos_informe");
  const puedeEliminarPedido = usuarioPuede(adminRol, "eliminar_pedido");
  const puedeEditarPedido = usuarioPuede(adminRol, "editar_pedido");
  const puedeCambiarEstado = usuarioPuede(adminRol, "cambiar_estado");
  const puedeFinalizarPendientes = usuarioPuede(adminRol, "finalizar_pendientes");

  const cargarRolAdmin = useCallback(async (usuario) => {
    const rol = await obtenerRolUsuarioDesdeTabla(supabase, usuario);
    setAdminRol(rol);
    return rol;
  }, []);

  const activarSesionAdmin = useCallback((usuario, rol, opciones = {}) => {
    const { preservarPestana = false } = opciones;
    guardarSesionTemporal("rafikiAdminActivo");
    setAdminUsuario(usuario || null);
    setAdminRol(rol || "usuario");
    setAdminAutenticado(true);

    if (!preservarPestana) {
      const pestanaInicial = primeraPestanaPermitida(rol || "usuario");
      guardarAdminTabActiva(pestanaInicial);
      setAdminTab(pestanaInicial);
    }
  }, []);

  useEffect(() => {
    let activo = true;
    const rutaAdmin =
      vista === "admin" ||
      vista === "adminLogin" ||
      vista === "pedidos" ||
      vista === "inventario" ||
      vista === "gerencia";
    const rutaMesas = vista === "mesas";
    const rutaMesasPWA = rutaMesas && estaEnModoPWAInstalada();
    const haySesionLocalAdmin = obtenerSesionActiva("rafikiAdminActivo");
    const debeVerificarSesion = rutaAdmin || rutaMesasPWA || (rutaMesas && haySesionLocalAdmin);

    const enviarALoginAdmin = () => {
      localStorage.removeItem("rafikiAdminActivo");
      setAdminRol("usuario");
      setAdminUsuario(null);
      setAdminAutenticado(false);
      if (rutaAdmin || rutaMesasPWA) {
        setVista("adminLogin");
      }
    };

    if (!supabaseConfigOk || !debeVerificarSesion) {
      setAdminAuthCargando(false);
      return () => {
        activo = false;
      };
    }

    const ahora = Date.now();
    const verificacionReciente = ahora - verificacionAdminRef.current.ultimoChequeo < 120000;

    // En celular/PWA no bloqueamos el panel si ya hay una sesión local reciente.
    // La verificación completa sigue corriendo, pero en segundo plano para evitar
    // que la pantalla quede pegada en "Verificando sesión administrativa...".
    if (adminAutenticado && adminUsuario && verificacionReciente) {
      setAdminAuthCargando(false);
      return () => {
        activo = false;
      };
    }

    if (verificacionAdminRef.current.enCurso) {
      setAdminAuthCargando(false);
      return () => {
        activo = false;
      };
    }

    setAdminAuthCargando(!adminAutenticado);

    async function revisarSesionAdmin() {
      verificacionAdminRef.current.enCurso = true;
      try {
        const { data } = await conTiempoMaximo(
          supabase.auth.getSession(),
          adminAutenticado ? 3000 : 4500,
          "La revisión de sesión administrativa"
        );
        if (!activo) return;

        const usuario = data?.session?.user || null;
        verificacionAdminRef.current.ultimoChequeo = Date.now();

        if (usuario && obtenerSesionActiva("rafikiAdminActivo")) {
          const rolRapido = obtenerRolCacheadoRapido(usuario);
          activarSesionAdmin(usuario, rolRapido, { preservarPestana: true });
          setAdminAuthCargando(false);

          // Validamos el rol real en segundo plano. Si la red móvil está lenta,
          // el panel no queda bloqueado; se mantiene el último rol cacheado.
          cargarRolAdmin(usuario).catch((error) => {
            console.warn("No se pudo refrescar el rol administrativo:", error?.message || error);
          });

          const rutaActualAdmin = window.location.pathname.replace(/\/$/, "");
          if (rutaActualAdmin === "/admin") {
            setVista("admin");
          }
          if (rutaActualAdmin === "/gerencia" || rutaActualAdmin === "/rafa") {
            setVista("gerencia");
          }
          if (rutaActualAdmin === "/mesas") {
            setVista("mesas");
          }
          return;
        }

        if (usuario && !obtenerSesionActiva("rafikiAdminActivo")) {
          // No cerramos la sesión global de Supabase aquí. En móvil/PWA, forzar
          // signOut durante verificaciones lentas puede dejar módulos como Caja
          // intentando operar como anon y disparar errores RLS. La autorización
          // del panel sigue dependiendo de rafikiAdminActivo y del rol.
          enviarALoginAdmin();
          return;
        }

        enviarALoginAdmin();
      } catch (error) {
        console.warn("No se pudo revisar la sesión administrativa:", error?.message || error);
        if (!activo) return;

        if (adminAutenticado && obtenerSesionActiva("rafikiAdminActivo")) {
          setAdminAuthCargando(false);
          return;
        }

        if (rutaAdmin) {
          enviarALoginAdmin();
        }
      } finally {
        verificacionAdminRef.current.enCurso = false;
        if (activo) setAdminAuthCargando(false);
      }
    }

    revisarSesionAdmin();

    return () => {
      activo = false;
    };
  }, [vista, adminAutenticado, adminUsuario, cargarRolAdmin, activarSesionAdmin, setVista]);

  useEffect(() => {
    if (!supabaseConfigOk) return undefined;

    let activo = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!activo) return;

      const usuario = session?.user || null;
      setAdminUsuario(usuario);

      if (usuario && obtenerSesionActiva("rafikiAdminActivo")) {
        const rolRapido = obtenerRolCacheadoRapido(usuario);
        activarSesionAdmin(usuario, rolRapido, { preservarPestana: true });
        setErrorClaveAdmin("");

        window.setTimeout(() => {
          if (!activo) return;
          cargarRolAdmin(usuario).catch((error) => {
            console.warn("No se pudo refrescar el rol administrativo:", error?.message || error);
          });
        }, 0);
        return;
      }

      if (!usuario) {
        setAdminRol("usuario");
        if (!obtenerSesionActiva("rafikiAdminActivo")) {
          setAdminAutenticado(false);
        }
      }
    });

    return () => {
      activo = false;
      authListener?.subscription?.unsubscribe?.();
    };
  }, [cargarRolAdmin, activarSesionAdmin]);

  useEffect(() => {
    if (!adminAutenticado || adminAuthCargando) return;
    const pestanaPermitida = primeraPestanaPermitida(adminRol);

    if (!usuarioPuede(adminRol, adminTab)) {
      guardarAdminTabActiva(pestanaPermitida);
      setAdminTab(pestanaPermitida);
    }
  }, [adminAutenticado, adminAuthCargando, adminRol, adminTab]);

  async function validarClaveAdmin(e) {
    e.preventDefault();
    setErrorClaveAdmin("");

    const email = adminEmail.trim();
    const password = adminPassword.trim();

    if (!email) {
      setErrorClaveAdmin("Ingresa el email del usuario administrativo.");
      return;
    }

    if (!password) {
      setErrorClaveAdmin("Ingresa la contraseña del usuario administrativo.");
      return;
    }

    localStorage.removeItem("rafikiAdminActivo");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      registrarErrorSupabase("iniciar sesión administrativa", error);
      setErrorClaveAdmin(describirErrorSupabase(error, "iniciar sesión"));
      return;
    }

    const usuarioAutenticado = data?.user || null;
    const rol = await cargarRolAdmin(usuarioAutenticado);
    activarSesionAdmin(usuarioAutenticado, rol);
    setAdminPassword("");
    setErrorClaveAdmin("");
    const rutaActual = window.location.pathname.replace(/\/$/, "") || "/";
    if (rutaActual === "/mesas") {
      navegar("/mesas", "mesas");
    } else if (rutaActual === "/pedidos") {
      navegar("/pedidos", "pedidos");
    } else if (rutaActual === "/inventario") {
      navegar("/inventario", "inventario");
    } else if (rutaActual === "/gerencia" || rutaActual === "/rafa") {
      navegar("/gerencia", "gerencia");
    } else {
      navegar("/admin", "admin");
    }
  }

  async function cerrarPanelAdmin() {
    const rutaActual = window.location.pathname.replace(/\/$/, "") || "/";
    localStorage.removeItem("rafikiAdminActivo");
    await supabase.auth.signOut();
    setAdminAutenticado(false);
    setAdminUsuario(null);
    setAdminRol("usuario");
    setAdminEmail("");
    setAdminPassword("");
    setErrorClaveAdmin("");
    if (rutaActual === "/mesas") {
      navegar("/mesas", estaEnModoPWAInstalada() ? "adminLogin" : "mesas");
      return;
    }

    navegar(
      rutaActual === "/pedidos" ? "/pedidos" : rutaActual === "/inventario" ? "/inventario" : "/admin",
      "adminLogin"
    );
  }

  return {
    adminTab,
    setAdminTab,
    adminAutenticado,
    adminEmail,
    adminPassword,
    adminUsuario,
    adminRol,
    adminAuthCargando,
    errorClaveAdmin,
    setAdminEmail,
    setAdminPassword,
    setErrorClaveAdmin,
    adminNombreRol,
    adminActor,
    puedeVerMenu,
    puedeVerProductos,
    puedeVerGenerador,
    puedeVerRafa,
    puedeVerCatalogo,
    puedeVerGastos,
    puedeVerInventario,
    puedeVerCaja,
    puedeVerInformeGastos,
    puedeEliminarPedido,
    puedeEditarPedido,
    puedeCambiarEstado,
    puedeFinalizarPendientes,
    cargarRolAdmin,
    activarSesionAdmin,
    validarClaveAdmin,
    cerrarPanelAdmin
  };
}
