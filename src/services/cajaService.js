import { supabase } from "../supabaseClient";
import { cargarGastosDiarios } from "./gastosDiariosService";
import { cargarPedidosRango } from "./pedidosService";
import { obtenerRangoPedidos } from "../shared/utils/pedidos";
import { resumirMovimientosCaja } from "../shared/utils/financialFlows";
import { crearErrorSupabaseUsuario, esErrorEsquemaSupabase } from "../shared/utils/supabaseErrors";

const SELECT_CAJA_ARQUEOS = "id, fecha, inicio_data, fin_data, ajustes_data, inicio_total, fin_total, creado_en, actualizado_en";
const SELECT_CAJA_ARQUEOS_HISTORIAL = "id, fecha, arqueo_data, arqueo_total, creado_en";

function hoyISOColombia(fecha = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(fecha);
}

function obtenerFechaAnteriorISO(fechaISO) {
  const base = fechaISO ? new Date(`${fechaISO}T12:00:00-05:00`) : new Date();
  base.setDate(base.getDate() - 1);
  return hoyISOColombia(base);
}

function numeroSeguro(valor) {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? numero : 0;
}

export function obtenerFechaCajaHoy() {
  return hoyISOColombia();
}

function normalizarMetodoPago(valor) {
  const texto = String(valor || "No especificado").trim().toLowerCase();
  if (!texto) return "No especificado";
  if (texto.includes("efect")) return "Efectivo";
  if (texto.includes("nequi")) return "Nequi";
  if (texto.includes("rafa")) return "Rafa";
  if (texto.includes("bancolombia") || texto.includes("transfer")) return "Bancolombia / Transferencia";
  if (texto.includes("data") || texto.includes("tarjeta") || texto.includes("datáfono") || texto.includes("datafono")) return "Datáfono";
  return valor || "No especificado";
}

function sumarPorMetodo(lista = [], obtenerMetodo, obtenerValor) {
  return lista.reduce((acc, item) => {
    const metodo = normalizarMetodoPago(obtenerMetodo(item));
    acc[metodo] = numeroSeguro(acc[metodo]) + numeroSeguro(obtenerValor(item));
    return acc;
  }, {});
}

async function exigirSesionSupabaseCaja() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw crearErrorSupabaseUsuario(error, "validar la sesión de Supabase");
  }

  if (!data?.session?.user) {
    throw new Error("Debes iniciar sesión nuevamente como administrador para guardar Caja. La sesión de Supabase no está activa.");
  }

  return data.session;
}

function normalizarArqueoHistorial(registro) {
  if (!registro) return null;
  return {
    id: registro.id,
    fecha: registro.fecha || hoyISOColombia(),
    arqueoData: registro.arqueo_data || null,
    arqueoTotal: numeroSeguro(registro.arqueo_total),
    creadoEn: registro.creado_en || "",
  };
}

export function normalizarCajaArqueo(registro) {
  if (!registro) return null;
  return {
    id: registro.id,
    fecha: registro.fecha || hoyISOColombia(),
    inicioData: registro.inicio_data || null,
    finData: registro.fin_data || null,
    inicioTotal: numeroSeguro(registro.inicio_total),
    finTotal: numeroSeguro(registro.fin_total),
    ajustesData: registro.ajustes_data || null,
    creadoEn: registro.creado_en || "",
    actualizadoEn: registro.actualizado_en || "",
  };
}

export async function cargarCajaArqueoPorFecha(fecha = hoyISOColombia()) {
  const fechaConsulta = fecha || hoyISOColombia();
  const { data, error } = await supabase
    .from("caja_arqueos")
    .select(SELECT_CAJA_ARQUEOS)
    .eq("fecha", fechaConsulta)
    .maybeSingle();

  if (error) throw error;
  return normalizarCajaArqueo(data);
}

async function guardarCajaArqueoParcial({ fecha, campoData, campoTotal, estado, total }) {
  await exigirSesionSupabaseCaja();
  const fechaGuardar = fecha || hoyISOColombia();
  const payload = {
    fecha: fechaGuardar,
    [campoData]: estado || null,
    [campoTotal]: numeroSeguro(total),
    actualizado_en: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("caja_arqueos")
    .upsert(payload, { onConflict: "fecha" })
    .select(SELECT_CAJA_ARQUEOS)
    .single();

  if (error) throw error;
  return normalizarCajaArqueo(data);
}

export async function guardarAjustesCaja({ fecha, ajustes }) {
  await exigirSesionSupabaseCaja();
  const fechaGuardar = fecha || hoyISOColombia();
  const payload = {
    fecha: fechaGuardar,
    ajustes_data: ajustes || null,
    actualizado_en: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("caja_arqueos")
    .upsert(payload, { onConflict: "fecha" })
    .select(SELECT_CAJA_ARQUEOS)
    .single();

  if (error) throw error;
  return normalizarCajaArqueo(data);
}

export function guardarInicioCaja({ fecha, estado, total }) {
  return guardarCajaArqueoParcial({
    fecha,
    estado,
    total,
    campoData: "inicio_data",
    campoTotal: "inicio_total",
  });
}

export function guardarFinCaja({ fecha, estado, total }) {
  // Guarda únicamente el último arqueo vigente. El historial se crea al presionar "Arqueo Nuevo".
  return guardarCajaArqueoParcial({
    fecha,
    estado,
    total,
    campoData: "fin_data",
    campoTotal: "fin_total",
  });
}

export async function limpiarUltimoArqueoCaja({ fecha }) {
  await exigirSesionSupabaseCaja();
  const fechaGuardar = fecha || hoyISOColombia();
  const payload = {
    fecha: fechaGuardar,
    fin_data: null,
    fin_total: 0,
    actualizado_en: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("caja_arqueos")
    .upsert(payload, { onConflict: "fecha" })
    .select(SELECT_CAJA_ARQUEOS)
    .single();

  if (error) throw error;
  return normalizarCajaArqueo(data);
}

export async function guardarArqueoHistorialCaja({ fecha, estado, total }) {
  await exigirSesionSupabaseCaja();
  const fechaGuardar = fecha || hoyISOColombia();
  const payload = {
    fecha: fechaGuardar,
    arqueo_data: estado || null,
    arqueo_total: numeroSeguro(total),
    creado_en: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("caja_arqueos_historial")
    .insert(payload)
    .select(SELECT_CAJA_ARQUEOS_HISTORIAL)
    .single();

  if (error) throw error;
  return normalizarArqueoHistorial(data);
}

export async function cargarHistorialArqueosCaja(fecha = hoyISOColombia()) {
  const fechaConsulta = fecha || hoyISOColombia();
  const { data, error } = await supabase
    .from("caja_arqueos_historial")
    .select(SELECT_CAJA_ARQUEOS_HISTORIAL)
    .eq("fecha", fechaConsulta)
    .order("creado_en", { ascending: false });

  if (error) {
    // Permite que la app siga funcionando si el SQL de historial aún no se ha ejecutado.
    if (esErrorEsquemaSupabase(error, ["caja_arqueos_historial"])) return [];
    throw error;
  }

  return (data || []).map(normalizarArqueoHistorial).filter(Boolean);
}

export async function cargarUltimoArqueoDiaAnterior(fecha = hoyISOColombia()) {
  const fechaAnterior = obtenerFechaAnteriorISO(fecha || hoyISOColombia());

  const { data: historialData, error: historialError } = await supabase
    .from("caja_arqueos_historial")
    .select(SELECT_CAJA_ARQUEOS_HISTORIAL)
    .eq("fecha", fechaAnterior)
    .order("creado_en", { ascending: false })
    .limit(1);

  if (historialError) {
    if (!esErrorEsquemaSupabase(historialError, ["caja_arqueos_historial"])) {
      throw historialError;
    }
  }

  const ultimoHistorial = normalizarArqueoHistorial(historialData?.[0]);
  if (ultimoHistorial?.arqueoData) {
    return {
      fecha: fechaAnterior,
      origen: "historial",
      estado: ultimoHistorial.arqueoData,
      total: ultimoHistorial.arqueoTotal,
      creadoEn: ultimoHistorial.creadoEn,
    };
  }

  const registroAnterior = await cargarCajaArqueoPorFecha(fechaAnterior);
  if (registroAnterior?.finData) {
    return {
      fecha: fechaAnterior,
      origen: "ultimo_arqueo",
      estado: registroAnterior.finData,
      total: registroAnterior.finTotal,
      creadoEn: registroAnterior.actualizadoEn || registroAnterior.creadoEn,
    };
  }

  return null;
}

export async function cargarCuadreRealCaja(fecha = hoyISOColombia()) {
  const fechaConsulta = fecha || hoyISOColombia();
  const rango = obtenerRangoPedidos("dia", fechaConsulta);
  const [{ data: pedidosData, error: pedidosError }, gastos] = await Promise.all([
    cargarPedidosRango(rango.inicio, rango.fin, { ascendente: true }),
    cargarGastosDiarios(fechaConsulta),
  ]);

  if (pedidosError) throw pedidosError;

  const resumen = resumirMovimientosCaja({ pedidos: pedidosData, gastos });
  const pedidosValidos = resumen.pedidosValidos;
  const gastosValidos = resumen.gastosValidos;

  return {
    fecha: fechaConsulta,
    pedidosCantidad: resumen.pedidosCantidad,
    gastosCantidad: resumen.gastosCantidad,
    ventasTotal: resumen.ventasTotal,
    gastosTotal: resumen.gastosTotal,
    ventasPorMetodo: sumarPorMetodo(pedidosValidos, (pedido) => pedido.tipo_pago || pedido.forma_pago || pedido.metodo_pago, (pedido) => pedido.total),
    gastosPorMetodo: sumarPorMetodo(gastosValidos, (gasto) => gasto.metodoPago, (gasto) => gasto.valor),
    gastosDetalle: gastosValidos.map((gasto) => ({
      id: gasto.id,
      proveedor: gasto.proveedor || "Sin proveedor",
      valor: numeroSeguro(gasto.valor),
      categoria: gasto.categoria || "",
      articulos: gasto.articulos || "",
      metodoPago: gasto.metodoPago || "",
      creadoEn: gasto.creadoEn || "",
    })),
  };
}
