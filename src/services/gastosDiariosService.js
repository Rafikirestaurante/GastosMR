import { supabase } from "../supabaseClient";
import { CATEGORIAS_GASTOS_FALLBACK, PROVEEDORES_GASTOS_FALLBACK } from "./catalogoGastosService";

const SELECT_GASTOS = "id, numero_factura, fecha, proveedor, articulos, valor, categoria, metodo_pago, observacion, creado_en, actualizado_en";

function hoyISOColombia(fecha = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(fecha);
}

export const CATEGORIAS_GASTOS = CATEGORIAS_GASTOS_FALLBACK;
export const METODOS_PAGO_GASTOS = ["Efectivo", "Transferencia", "Tarjeta", "Nequi", "Daviplata", "Otro"];

export const TRABAJADORES_GASTOS_RAPIDOS = PROVEEDORES_GASTOS_FALLBACK.map((item) => ({ nombre: item.nombre, categoria: item.categoria, descripcionSugerida: item.descripcion }));

export function normalizarGastoDiario(gasto) {
  if (!gasto) return null;
  return {
    id: gasto.id,
    numeroFactura: gasto.numero_factura || "",
    fecha: gasto.fecha || hoyISOColombia(),
    proveedor: gasto.proveedor || "",
    articulos: gasto.articulos || "",
    valor: Number(gasto.valor || 0),
    categoria: gasto.categoria || "",
    metodoPago: gasto.metodo_pago || "",
    observacion: gasto.observacion || "",
    creadoEn: gasto.creado_en || "",
    actualizadoEn: gasto.actualizado_en || ""
  };
}

function prepararPayloadGasto(gasto) {
  return {
    numero_factura: String(gasto.numeroFactura || "").trim() || null,
    fecha: gasto.fecha || hoyISOColombia(),
    proveedor: String(gasto.proveedor || "").trim(),
    articulos: String(gasto.articulos || "").trim() || null,
    valor: Number(gasto.valor || 0),
    categoria: String(gasto.categoria || "").trim(),
    metodo_pago: String(gasto.metodoPago || "").trim(),
    observacion: String(gasto.observacion || "").trim() || null,
    actualizado_en: new Date().toISOString()
  };
}

export async function cargarGastosDiarios(fecha = hoyISOColombia()) {
  const { data, error } = await supabase
    .from("gastos_diarios")
    .select(SELECT_GASTOS)
    .eq("fecha", fecha)
    .order("creado_en", { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizarGastoDiario).filter(Boolean);
}

export async function cargarGastosDiariosRango(fechaInicio = hoyISOColombia(), fechaFin = fechaInicio) {
  const inicio = fechaInicio || hoyISOColombia();
  const fin = fechaFin || inicio;

  const { data, error } = await supabase
    .from("gastos_diarios")
    .select(SELECT_GASTOS)
    .gte("fecha", inicio)
    .lte("fecha", fin)
    .order("fecha", { ascending: true })
    .order("creado_en", { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizarGastoDiario).filter(Boolean);
}

export async function crearGastoDiario(gasto) {
  const payload = prepararPayloadGasto(gasto);
  if (!payload.proveedor) throw new Error("El proveedor es obligatorio.");
  if (!Number.isFinite(payload.valor) || payload.valor <= 0) throw new Error("El valor debe ser mayor a cero.");

  const { data, error } = await supabase
    .from("gastos_diarios")
    .insert(payload)
    .select(SELECT_GASTOS)
    .single();

  if (error) throw error;
  return normalizarGastoDiario(data);
}

export async function actualizarGastoDiario(id, gasto) {
  const payload = prepararPayloadGasto(gasto);
  if (!payload.proveedor) throw new Error("El proveedor es obligatorio.");
  if (!Number.isFinite(payload.valor) || payload.valor <= 0) throw new Error("El valor debe ser mayor a cero.");

  const { data, error } = await supabase
    .from("gastos_diarios")
    .update(payload)
    .eq("id", id)
    .select(SELECT_GASTOS)
    .single();

  if (error) throw error;
  return normalizarGastoDiario(data);
}

export async function eliminarGastoDiario(id) {
  const { error } = await supabase.from("gastos_diarios").delete().eq("id", id);
  if (error) throw error;
  return true;
}

export function obtenerFechaGastoHoy() {
  return hoyISOColombia();
}
