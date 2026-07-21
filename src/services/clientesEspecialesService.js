import { supabase, supabaseConfigOk } from "../supabaseClient";
import { describirErrorSupabase } from "../shared/utils/supabaseErrors";

const CAMPOS_CLIENTE_ESPECIAL =
  "id,codigo,codigo_normalizado,nombre,telefono,ubicacion,activo,mensaje_bienvenida,sin_restriccion_acompanantes,habilita_cafeteria,permite_modificar_datos,reglas_json,observaciones,creado_en,actualizado_en";

function limpiarTexto(valor) {
  return String(valor || "").trim().replace(/\s+/g, " ");
}

export function normalizarCodigoClienteEspecial(codigo) {
  return String(codigo || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase();
}

function normalizarClienteEspecial(cliente = {}) {
  if (!cliente || typeof cliente !== "object") return null;
  return {
    ...cliente,
    codigo: String(cliente.codigo || "").trim().toUpperCase(),
    codigo_normalizado: normalizarCodigoClienteEspecial(cliente.codigo_normalizado || cliente.codigo),
    nombre: limpiarTexto(cliente.nombre),
    telefono: String(cliente.telefono || "").trim(),
    ubicacion: limpiarTexto(cliente.ubicacion),
    mensaje_bienvenida: limpiarTexto(cliente.mensaje_bienvenida) || (cliente.nombre ? `Bienvenido, ${limpiarTexto(cliente.nombre)}` : ""),
    sin_restriccion_acompanantes: cliente.sin_restriccion_acompanantes !== false,
    habilita_cafeteria: cliente.habilita_cafeteria !== false,
    permite_modificar_datos: cliente.permite_modificar_datos !== false,
    reglas_json: cliente.reglas_json && typeof cliente.reglas_json === "object" ? cliente.reglas_json : {},
    activo: cliente.activo !== false
  };
}

function crearPayloadClienteEspecial(cambios = {}) {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(cambios, "codigo")) {
    payload.codigo = String(cambios.codigo || "").trim().toUpperCase();
    payload.codigo_normalizado = normalizarCodigoClienteEspecial(payload.codigo);
  }
  if (Object.prototype.hasOwnProperty.call(cambios, "nombre")) payload.nombre = limpiarTexto(cambios.nombre);
  if (Object.prototype.hasOwnProperty.call(cambios, "telefono")) payload.telefono = String(cambios.telefono || "").trim();
  if (Object.prototype.hasOwnProperty.call(cambios, "ubicacion")) payload.ubicacion = limpiarTexto(cambios.ubicacion);
  if (Object.prototype.hasOwnProperty.call(cambios, "activo")) payload.activo = Boolean(cambios.activo);
  if (Object.prototype.hasOwnProperty.call(cambios, "mensaje_bienvenida")) payload.mensaje_bienvenida = limpiarTexto(cambios.mensaje_bienvenida);
  if (Object.prototype.hasOwnProperty.call(cambios, "sin_restriccion_acompanantes")) payload.sin_restriccion_acompanantes = Boolean(cambios.sin_restriccion_acompanantes);
  if (Object.prototype.hasOwnProperty.call(cambios, "habilita_cafeteria")) payload.habilita_cafeteria = Boolean(cambios.habilita_cafeteria);
  if (Object.prototype.hasOwnProperty.call(cambios, "permite_modificar_datos")) payload.permite_modificar_datos = Boolean(cambios.permite_modificar_datos);
  if (Object.prototype.hasOwnProperty.call(cambios, "reglas_json")) payload.reglas_json = cambios.reglas_json && typeof cambios.reglas_json === "object" ? cambios.reglas_json : {};
  if (Object.prototype.hasOwnProperty.call(cambios, "observaciones")) payload.observaciones = limpiarTexto(cambios.observaciones);

  return payload;
}

export async function validarCodigoClienteEspecial(codigo) {
  const codigoNormalizado = normalizarCodigoClienteEspecial(codigo);
  if (!codigoNormalizado || !supabaseConfigOk) return { ok: false, cliente: null, mensaje: "Código no válido." };

  try {
    const { data, error } = await supabase.rpc("validar_cliente_especial_codigo", {
      p_codigo: codigoNormalizado
    });

    if (error) {
      return {
        ok: false,
        cliente: null,
        mensaje: describirErrorSupabase(error, "validar el código de cliente especial")
      };
    }

    const cliente = normalizarClienteEspecial(data);
    if (!cliente?.id) return { ok: false, cliente: null, mensaje: "Código no encontrado o inactivo." };

    return { ok: true, cliente, mensaje: cliente.mensaje_bienvenida || `Bienvenido, ${cliente.nombre}` };
  } catch (error) {
    return {
      ok: false,
      cliente: null,
      mensaje: describirErrorSupabase(error, "validar el código de cliente especial")
    };
  }
}

export async function listarClientesEspeciales({ busqueda = "", incluirInactivos = true } = {}) {
  if (!supabaseConfigOk) return { ok: false, clientes: [], mensaje: "Falta configuración de Supabase." };

  try {
    let consulta = supabase
      .from("clientes_especiales")
      .select(CAMPOS_CLIENTE_ESPECIAL)
      .order("activo", { ascending: false })
      .order("nombre", { ascending: true });

    if (!incluirInactivos) consulta = consulta.eq("activo", true);

    const texto = limpiarTexto(busqueda);
    if (texto) {
      consulta = consulta.or(`nombre.ilike.%${texto}%,codigo.ilike.%${texto}%,telefono.ilike.%${texto}%,ubicacion.ilike.%${texto}%`);
    }

    const { data, error } = await consulta;
    if (error) throw error;

    return {
      ok: true,
      clientes: Array.isArray(data) ? data.map(normalizarClienteEspecial).filter(Boolean) : [],
      mensaje: "Clientes especiales cargados."
    };
  } catch (error) {
    return {
      ok: false,
      clientes: [],
      mensaje: describirErrorSupabase(error, "cargar clientes especiales")
    };
  }
}

export async function crearClienteEspecial(datos = {}) {
  if (!supabaseConfigOk) return { ok: false, cliente: null, mensaje: "Falta configuración de Supabase." };

  const payload = crearPayloadClienteEspecial({
    activo: true,
    sin_restriccion_acompanantes: true,
    habilita_cafeteria: true,
    permite_modificar_datos: true,
    reglas_json: {},
    ...datos
  });

  if (!payload.codigo_normalizado || payload.codigo_normalizado.length < 3) {
    return { ok: false, cliente: null, mensaje: "El código debe tener al menos 3 caracteres." };
  }
  if (!payload.nombre || payload.nombre.length < 2) {
    return { ok: false, cliente: null, mensaje: "El nombre del cliente especial es obligatorio." };
  }

  try {
    const { data, error } = await supabase
      .from("clientes_especiales")
      .upsert(payload, { onConflict: "codigo_normalizado" })
      .select(CAMPOS_CLIENTE_ESPECIAL)
      .single();

    if (error) throw error;
    return { ok: true, cliente: normalizarClienteEspecial(data), mensaje: "Cliente especial guardado." };
  } catch (error) {
    return {
      ok: false,
      cliente: null,
      mensaje: describirErrorSupabase(error, "guardar el cliente especial", {
        mensajeDuplicado: "Ya existe un cliente especial con ese código."
      })
    };
  }
}

export async function actualizarClienteEspecial(id, cambios = {}) {
  if (!id || !supabaseConfigOk) return { ok: false, cliente: null, mensaje: "Cliente especial no válido." };

  const payload = crearPayloadClienteEspecial(cambios);
  if (!Object.keys(payload).length) return { ok: false, cliente: null, mensaje: "No hay cambios para guardar." };

  try {
    const { data, error } = await supabase
      .from("clientes_especiales")
      .update(payload)
      .eq("id", id)
      .select(CAMPOS_CLIENTE_ESPECIAL)
      .single();

    if (error) throw error;
    return { ok: true, cliente: normalizarClienteEspecial(data), mensaje: "Cliente especial actualizado." };
  } catch (error) {
    return {
      ok: false,
      cliente: null,
      mensaje: describirErrorSupabase(error, "actualizar el cliente especial", {
        mensajeDuplicado: "Ya existe un cliente especial con ese código."
      })
    };
  }
}

export function crearReglasClienteEspecialBase(reglas = {}) {
  return {
    promociones: false,
    regalo: null,
    descuento: null,
    prioridad: "normal",
    ...reglas
  };
}
