const ROL_POR_DEFECTO = "usuario";

export const ROLES_ADMIN = {
  ADMIN: "admin",
  USUARIO: "usuario",
};

export const NOMBRES_ROLES = {
  admin: "Administrador",
  usuario: "Usuario",
};

const PERMISOS_POR_ROL = {
  admin: ["pedidos", "menu", "productos", "generador", "catalogo", "gastos", "gastos_informe", "inventario", "caja", "rafa", "eliminar_pedido", "editar_pedido", "cambiar_estado", "finalizar_pendientes"],
  usuario: ["pedidos", "menu", "productos", "generador", "gastos", "cambiar_estado", "finalizar_pendientes"],
};

const STORAGE_ROL_ADMIN = "rafikiAdminRolCache";
const ROL_CACHE_MS = 12 * 60 * 60 * 1000;

export function leerRolCache(email) {
  try {
    const normalizado = String(email || "").trim().toLowerCase();
    if (!normalizado) return "";
    const cache = JSON.parse(window.localStorage.getItem(STORAGE_ROL_ADMIN) || "null");
    if (!cache || cache.email !== normalizado || !cache.rol || !cache.exp) return "";
    if (Date.now() > cache.exp) {
      window.localStorage.removeItem(STORAGE_ROL_ADMIN);
      return "";
    }
    return PERMISOS_POR_ROL[cache.rol] ? cache.rol : "";
  } catch {
    return "";
  }
}

function guardarRolCache(email, rol) {
  try {
    const normalizado = String(email || "").trim().toLowerCase();
    if (!normalizado || !PERMISOS_POR_ROL[rol]) return;
    window.localStorage.setItem(
      STORAGE_ROL_ADMIN,
      JSON.stringify({ email: normalizado, rol, exp: Date.now() + ROL_CACHE_MS })
    );
  } catch {
    // No bloquea el panel si el navegador no permite localStorage.
  }
}

function limpiarRol(valor) {
  return String(valor || "").trim().toLowerCase();
}

export function obtenerRolUsuario(usuario) {
  const metadata = usuario?.user_metadata || {};
  const appMetadata = usuario?.app_metadata || {};
  const rol = limpiarRol(metadata.rol || metadata.role || appMetadata.rol || appMetadata.role);
  return PERMISOS_POR_ROL[rol] ? rol : ROL_POR_DEFECTO;
}

export function obtenerRolCacheadoRapido(usuario) {
  const email = String(usuario?.email || "").trim().toLowerCase();
  return leerRolCache(email) || obtenerRolUsuario(usuario);
}

export async function obtenerRolUsuarioDesdeTabla(supabase, usuario) {
  const email = String(usuario?.email || "").trim().toLowerCase();

  if (!email) {
    return ROL_POR_DEFECTO;
  }

  const consultaRol = supabase
    .from("usuarios_roles")
    .select("email, rol")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  const tiempoMaximo = new Promise((resolve) => {
    window.setTimeout(() => {
      resolve({ data: null, error: new Error("Tiempo máximo consultando usuarios_roles") });
    }, 3000);
  });

  try {
    const { data, error } = await Promise.race([consultaRol, tiempoMaximo]);

    if (error) {
      console.warn("No se pudo leer usuarios_roles:", error.message || error);
      return leerRolCache(email) || obtenerRolUsuario(usuario);
    }

    const rolTabla = limpiarRol(data?.rol);
    if (PERMISOS_POR_ROL[rolTabla]) {
      guardarRolCache(email, rolTabla);
      return rolTabla;
    }

    return leerRolCache(email) || obtenerRolUsuario(usuario);
  } catch (error) {
    console.warn("Error inesperado leyendo usuarios_roles:", error?.message || error);
    return leerRolCache(email) || obtenerRolUsuario(usuario);
  }
}

export function nombreRol(rol) {
  return NOMBRES_ROLES[rol] || NOMBRES_ROLES[ROL_POR_DEFECTO];
}

export function usuarioPuede(rol, permiso) {
  return Boolean(PERMISOS_POR_ROL[rol]?.includes(permiso));
}

export function primeraPestanaPermitida(rol) {
  const orden = ["pedidos", "menu", "productos", "generador", "catalogo", "gastos", "inventario", "caja", "rafa"];
  return orden.find((permiso) => usuarioPuede(rol, permiso)) || "pedidos";
}

export function describirActor(usuario, respaldo = "Clave local") {
  if (usuario?.email) return usuario.email;
  return respaldo;
}
