import { supabase, supabaseConfigOk } from "../supabaseClient";
import { aPesosEnteros } from "../shared/utils/money";

function limpiarTexto(valor) {
  return String(valor || "").trim().replace(/\s+/g, " ");
}

function normalizarTelefono(valor) {
  return String(valor || "").trim();
}

function normalizarNumero(valor) {
  return aPesosEnteros(valor);
}

const CAMPOS_CLIENTE_CREDITO = "id,nombre,alias,telefono,observaciones,fecha_ultimo_pedido,total_pedidos,saldo_pendiente,activo,creado_en,actualizado_en";
const CAMPOS_CLIENTE_CREDITO_MINIMOS = "id,nombre,alias,activo";

export function normalizarNombreClienteCredito(nombre) {
  return limpiarTexto(nombre);
}

export function generarNombreNormalizadoClienteCredito(nombre) {
  return normalizarNombreClienteCredito(nombre)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function errorNombreNormalizadoNoDisponible(error) {
  const texto = String(error?.message || error?.details || error?.hint || "").toLowerCase();
  return texto.includes("nombre_normalizado") || texto.includes("no unique") || texto.includes("conflict") || texto.includes("schema cache");
}

function normalizarAlias(alias = []) {
  return Array.isArray(alias)
    ? alias.map((item) => limpiarTexto(item)).filter(Boolean)
    : [];
}

async function buscarClientePorNombreExacto(nombreLimpio, campos = CAMPOS_CLIENTE_CREDITO_MINIMOS) {
  if (!nombreLimpio || !supabaseConfigOk) return null;

  const { data, error } = await supabase
    .from("clientes_credito")
    .select(campos)
    .ilike("nombre", nombreLimpio)
    .maybeSingle();

  if (error) return null;
  return data || null;
}

export async function listarClientesCreditoActivos() {
  if (!supabaseConfigOk) return [];

  const { data, error } = await supabase
    .from("clientes_credito")
    .select("id,nombre,alias,activo")
    .eq("activo", true)
    .order("nombre", { ascending: true });

  if (error) {
    console.warn("No se pudieron cargar clientes de crédito:", error.message);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

export async function listarClientesCredito({ busqueda = "", incluirInactivos = true } = {}) {
  if (!supabaseConfigOk) return [];

  let consulta = supabase
    .from("clientes_credito")
    .select(CAMPOS_CLIENTE_CREDITO)
    .order("activo", { ascending: false })
    .order("nombre", { ascending: true });

  if (!incluirInactivos) consulta = consulta.eq("activo", true);

  const texto = limpiarTexto(busqueda);
  if (texto) {
    consulta = consulta.or(`nombre.ilike.%${texto}%,telefono.ilike.%${texto}%,observaciones.ilike.%${texto}%`);
  }

  const { data, error } = await consulta;

  if (error) {
    console.warn("No se pudo listar clientes de crédito:", error.message);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

export async function buscarClientesCredito(busqueda) {
  return listarClientesCredito({ busqueda, incluirInactivos: true });
}

export async function obtenerClienteCredito(id) {
  if (!id || !supabaseConfigOk) return null;

  const { data, error } = await supabase
    .from("clientes_credito")
    .select(CAMPOS_CLIENTE_CREDITO)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("No se pudo obtener cliente de crédito:", error.message);
    return null;
  }

  return data || null;
}

export async function crearClienteCredito({ nombre, telefono = "", observaciones = "", alias = [] } = {}) {
  const nombreLimpio = normalizarNombreClienteCredito(nombre);
  const nombreNormalizado = generarNombreNormalizadoClienteCredito(nombreLimpio);
  if (!nombreLimpio || !supabaseConfigOk) return null;

  const payload = {
    nombre: nombreLimpio,
    nombre_normalizado: nombreNormalizado,
    telefono: normalizarTelefono(telefono),
    observaciones: limpiarTexto(observaciones),
    alias: normalizarAlias(alias),
    activo: true,
    total_pedidos: 0,
    saldo_pendiente: 0,
  };

  const { data, error } = await supabase
    .from("clientes_credito")
    .upsert(payload, { onConflict: "nombre_normalizado" })
    .select(CAMPOS_CLIENTE_CREDITO)
    .single();

  if (!error) return data;

  if (!errorNombreNormalizadoNoDisponible(error)) {
    console.warn("No se pudo crear cliente de crédito:", error.message);
    throw error;
  }

  const existente = await buscarClientePorNombreExacto(nombreLimpio, CAMPOS_CLIENTE_CREDITO);
  if (existente?.id) return existente;

  const { nombre_normalizado: _omitido, ...payloadCompatible } = payload;
  const { data: creado, error: errorInsert } = await supabase
    .from("clientes_credito")
    .insert(payloadCompatible)
    .select(CAMPOS_CLIENTE_CREDITO)
    .single();

  if (errorInsert) {
    console.warn("No se pudo crear cliente de crédito:", errorInsert.message);
    throw errorInsert;
  }

  return creado;
}

export async function editarClienteCredito(id, cambios = {}) {
  if (!id || !supabaseConfigOk) return null;

  const payload = {};
  if (Object.prototype.hasOwnProperty.call(cambios, "nombre")) {
    payload.nombre = normalizarNombreClienteCredito(cambios.nombre);
    payload.nombre_normalizado = generarNombreNormalizadoClienteCredito(payload.nombre);
  }
  if (Object.prototype.hasOwnProperty.call(cambios, "telefono")) payload.telefono = normalizarTelefono(cambios.telefono);
  if (Object.prototype.hasOwnProperty.call(cambios, "observaciones")) payload.observaciones = limpiarTexto(cambios.observaciones);
  if (Object.prototype.hasOwnProperty.call(cambios, "activo")) payload.activo = Boolean(cambios.activo);
  if (Object.prototype.hasOwnProperty.call(cambios, "total_pedidos")) payload.total_pedidos = normalizarNumero(cambios.total_pedidos);
  if (Object.prototype.hasOwnProperty.call(cambios, "saldo_pendiente")) payload.saldo_pendiente = normalizarNumero(cambios.saldo_pendiente);
  if (Object.prototype.hasOwnProperty.call(cambios, "fecha_ultimo_pedido")) payload.fecha_ultimo_pedido = cambios.fecha_ultimo_pedido || null;

  if (!Object.keys(payload).length) return obtenerClienteCredito(id);

  const { data, error } = await supabase
    .from("clientes_credito")
    .update(payload)
    .eq("id", id)
    .select(CAMPOS_CLIENTE_CREDITO)
    .single();

  if (!error) return data;

  if (payload.nombre_normalizado && errorNombreNormalizadoNoDisponible(error)) {
    const { nombre_normalizado: _omitido, ...payloadCompatible } = payload;
    const { data: dataCompatible, error: errorCompatible } = await supabase
      .from("clientes_credito")
      .update(payloadCompatible)
      .eq("id", id)
      .select(CAMPOS_CLIENTE_CREDITO)
      .single();

    if (!errorCompatible) return dataCompatible;
  }

  if (String(error?.code || "") === "23505") {
    throw new Error("Ya existe un cliente crédito con un nombre muy similar. Usa el cliente existente para evitar duplicados.");
  }

  console.warn("No se pudo editar cliente de crédito:", error.message);
  throw error;
}

export async function desactivarClienteCredito(id) {
  return editarClienteCredito(id, { activo: false });
}

export async function activarClienteCredito(id) {
  return editarClienteCredito(id, { activo: true });
}

export async function asegurarClienteCredito(nombre) {
  const nombreLimpio = normalizarNombreClienteCredito(nombre);
  const nombreNormalizado = generarNombreNormalizadoClienteCredito(nombreLimpio);
  if (!nombreLimpio || !supabaseConfigOk) return null;

  if (nombreNormalizado) {
    const { data: existenteNormalizado, error: errorNormalizado } = await supabase
      .from("clientes_credito")
      .select(CAMPOS_CLIENTE_CREDITO_MINIMOS)
      .eq("nombre_normalizado", nombreNormalizado)
      .maybeSingle();

    if (!errorNormalizado && existenteNormalizado?.id) return existenteNormalizado;
  }

  const existente = await buscarClientePorNombreExacto(nombreLimpio);
  if (existente?.id) return existente;

  const payload = {
    nombre: nombreLimpio,
    nombre_normalizado: nombreNormalizado,
    activo: true,
    total_pedidos: 0,
    saldo_pendiente: 0,
  };

  const { data, error } = await supabase
    .from("clientes_credito")
    .upsert(payload, { onConflict: "nombre_normalizado" })
    .select(CAMPOS_CLIENTE_CREDITO_MINIMOS)
    .single();

  if (!error) return data;

  if (!errorNombreNormalizadoNoDisponible(error)) {
    console.warn("No se pudo registrar cliente de crédito:", error.message);
    return null;
  }

  const { nombre_normalizado: _omitido, ...payloadCompatible } = payload;
  const { data: creado, error: errorInsert } = await supabase
    .from("clientes_credito")
    .insert(payloadCompatible)
    .select(CAMPOS_CLIENTE_CREDITO_MINIMOS)
    .single();

  if (errorInsert) {
    console.warn("No se pudo registrar cliente de crédito:", errorInsert.message);
    return null;
  }

  return creado;
}
