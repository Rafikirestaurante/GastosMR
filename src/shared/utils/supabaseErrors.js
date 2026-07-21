const MENSAJE_ERROR_GENERICO = "No se pudo completar la operación. Revisa la conexión e intenta nuevamente.";
const MENSAJE_CONFIG_SUPABASE = "Falta configuración de Supabase. Revisa las variables del proyecto y vuelve a desplegar.";

function textoError(error) {
  return [
    error?.code,
    error?.status,
    error?.statusCode,
    error?.message,
    error?.details,
    error?.hint,
    error?.name,
    String(error || "")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function obtenerCodigoErrorSupabase(error) {
  return String(error?.code || error?.status || error?.statusCode || "").trim();
}

export function esErrorConexionSupabase(error) {
  const texto = textoError(error);
  return (
    texto.includes("failed to fetch") ||
    texto.includes("networkerror") ||
    texto.includes("network request failed") ||
    texto.includes("load failed") ||
    texto.includes("timeout") ||
    texto.includes("tiempo máximo") ||
    texto.includes("time-out") ||
    texto.includes("aborterror")
  );
}

export function esErrorPermisosSupabase(error) {
  const codigo = obtenerCodigoErrorSupabase(error);
  const texto = textoError(error);
  return (
    codigo === "42501" ||
    codigo === "401" ||
    codigo === "403" ||
    texto.includes("row-level security") ||
    texto.includes("permission denied") ||
    texto.includes("not authorized") ||
    texto.includes("unauthorized") ||
    texto.includes("violates row-level security")
  );
}

export function esErrorDuplicadoSupabase(error) {
  return obtenerCodigoErrorSupabase(error) === "23505" || textoError(error).includes("duplicate key");
}

export function esErrorRelacionSupabase(error) {
  const codigo = obtenerCodigoErrorSupabase(error);
  const texto = textoError(error);
  return codigo === "23503" || texto.includes("foreign key");
}

export function esErrorCampoObligatorioSupabase(error) {
  const codigo = obtenerCodigoErrorSupabase(error);
  const texto = textoError(error);
  return codigo === "23502" || texto.includes("null value in column");
}

export function esErrorFormatoSupabase(error) {
  const codigo = obtenerCodigoErrorSupabase(error);
  const texto = textoError(error);
  return codigo === "22P02" || texto.includes("invalid input syntax");
}

export function esErrorEsquemaSupabase(error, columnasEsperadas = []) {
  const codigo = obtenerCodigoErrorSupabase(error);
  const texto = textoError(error);
  const columnas = columnasEsperadas.map((columna) => String(columna || "").toLowerCase()).filter(Boolean);

  return (
    codigo === "42P01" ||
    codigo === "42703" ||
    codigo === "42883" ||
    codigo === "PGRST200" ||
    codigo === "PGRST202" ||
    codigo === "PGRST204" ||
    texto.includes("schema cache") ||
    texto.includes("could not find") ||
    texto.includes("does not exist") ||
    columnas.some((columna) => texto.includes(columna))
  );
}

export function esErrorSinDatosSupabase(error) {
  const codigo = obtenerCodigoErrorSupabase(error);
  const texto = textoError(error);
  return codigo === "PGRST116" || texto.includes("json object requested") || texto.includes("0 rows");
}

export function describirErrorSupabase(error, contexto = "la operación", opciones = {}) {
  const {
    accion = contexto,
    incluirDetalleSeguro = false,
    mensajeFallback = MENSAJE_ERROR_GENERICO,
    mensajeDuplicado = "El registro ya existe. Revisa si fue creado anteriormente.",
    mensajePermisos = "No tienes permisos suficientes o falta ajustar las políticas RLS de Supabase.",
    mensajeEsquema = "La estructura de Supabase no está actualizada. Ejecuta el SQL pendiente y refresca la estructura de la API.",
    mensajeConexion = "No hay conexión estable con Supabase. Revisa internet e intenta nuevamente.",
    mensajeRelacion = "No se puede completar porque el registro está relacionado con otra información.",
    mensajeCampoObligatorio = "Falta un dato obligatorio para guardar la información.",
    mensajeFormato = "Algún dato tiene un formato inválido. Revisa los campos e intenta nuevamente.",
    mensajeSinDatos = "No se encontró información para esta consulta."
  } = opciones;

  if (!error) return mensajeFallback;

  let mensaje = mensajeFallback;

  if (esErrorConexionSupabase(error)) mensaje = mensajeConexion;
  else if (esErrorPermisosSupabase(error)) mensaje = mensajePermisos;
  else if (esErrorDuplicadoSupabase(error)) mensaje = mensajeDuplicado;
  else if (esErrorRelacionSupabase(error)) mensaje = mensajeRelacion;
  else if (esErrorCampoObligatorioSupabase(error)) mensaje = mensajeCampoObligatorio;
  else if (esErrorFormatoSupabase(error)) mensaje = mensajeFormato;
  else if (esErrorEsquemaSupabase(error)) mensaje = mensajeEsquema;
  else if (esErrorSinDatosSupabase(error)) mensaje = mensajeSinDatos;
  else if (error?.message && incluirDetalleSeguro) mensaje = limpiarMensajeTecnico(error.message);

  const accionLimpia = String(accion || "").trim();
  if (!accionLimpia) return mensaje;

  const mensajeNormalizado = mensaje.endsWith(".") ? mensaje : `${mensaje}.`;
  return `No se pudo ${accionLimpia}. ${mensajeNormalizado}`;
}

export function limpiarMensajeTecnico(mensaje) {
  const texto = String(mensaje || "").trim();
  if (!texto) return MENSAJE_ERROR_GENERICO;

  if (/schema cache|column .* does not exist|could not find|row-level security|duplicate key|foreign key|invalid input syntax/i.test(texto)) {
    return MENSAJE_ERROR_GENERICO;
  }

  return texto.slice(0, 220);
}

export function registrarErrorSupabase(contexto, error, extras = {}) {
  if (!error) return;
  const codigo = obtenerCodigoErrorSupabase(error);
  console.warn(`[Rafiki Supabase] ${contexto}`, {
    codigo: codigo || null,
    mensaje: error?.message || String(error),
    detalle: error?.details || null,
    pista: error?.hint || null,
    ...extras
  });
}

export function crearErrorSupabaseUsuario(error, contexto, opciones = {}) {
  const errorUsuario = new Error(describirErrorSupabase(error, contexto, opciones));
  errorUsuario.cause = error;
  errorUsuario.codigoSupabase = obtenerCodigoErrorSupabase(error) || null;
  return errorUsuario;
}

export function describirConfigSupabase() {
  return MENSAJE_CONFIG_SUPABASE;
}
