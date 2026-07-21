import { supabase } from "../supabaseClient";

const SELECT_CIERRE = "id, fecha, ventas_total, gastos_total, utilidad_aproximada, pedidos_total, pedidos_finalizados, pedidos_pendientes, pedidos_cancelados, ventas_restaurante, ventas_cafeteria, gastos_por_categoria, pagos_por_metodo, observaciones, creado_en, actualizado_en";

export function normalizarCierreDiario(cierre) {
  if (!cierre) return null;
  return {
    id: cierre.id,
    fecha: cierre.fecha || "",
    ventasTotal: Number(cierre.ventas_total || 0),
    gastosTotal: Number(cierre.gastos_total || 0),
    utilidadAproximada: Number(cierre.utilidad_aproximada || 0),
    pedidosTotal: Number(cierre.pedidos_total || 0),
    pedidosFinalizados: Number(cierre.pedidos_finalizados || 0),
    pedidosPendientes: Number(cierre.pedidos_pendientes || 0),
    pedidosCancelados: Number(cierre.pedidos_cancelados || 0),
    ventasRestaurante: Number(cierre.ventas_restaurante || 0),
    ventasCafeteria: Number(cierre.ventas_cafeteria || 0),
    gastosPorCategoria: cierre.gastos_por_categoria || {},
    pagosPorMetodo: cierre.pagos_por_metodo || {},
    observaciones: cierre.observaciones || "",
    creadoEn: cierre.creado_en || "",
    actualizadoEn: cierre.actualizado_en || ""
  };
}

export async function cargarCierreDiario(fecha) {
  if (!fecha) return null;
  const { data, error } = await supabase
    .from("cierres_diarios")
    .select(SELECT_CIERRE)
    .eq("fecha", fecha)
    .maybeSingle();

  if (error) throw error;
  return normalizarCierreDiario(data);
}

export async function guardarCierreDiario(resumen) {
  const payload = {
    fecha: resumen.fecha,
    ventas_total: Number(resumen.ventasTotal || 0),
    gastos_total: Number(resumen.gastosTotal || 0),
    utilidad_aproximada: Number(resumen.utilidadAproximada || 0),
    pedidos_total: Number(resumen.pedidosTotal || 0),
    pedidos_finalizados: Number(resumen.pedidosFinalizados || 0),
    pedidos_pendientes: Number(resumen.pedidosPendientes || 0),
    pedidos_cancelados: Number(resumen.pedidosCancelados || 0),
    ventas_restaurante: Number(resumen.ventasRestaurante || 0),
    ventas_cafeteria: Number(resumen.ventasCafeteria || 0),
    gastos_por_categoria: resumen.gastosPorCategoria || {},
    pagos_por_metodo: resumen.pagosPorMetodo || {},
    observaciones: String(resumen.observaciones || "").trim() || null,
    actualizado_en: new Date().toISOString()
  };

  if (!payload.fecha) throw new Error("La fecha del cierre es obligatoria.");

  const { data, error } = await supabase
    .from("cierres_diarios")
    .upsert(payload, { onConflict: "fecha" })
    .select(SELECT_CIERRE)
    .single();

  if (error) throw error;
  return normalizarCierreDiario(data);
}
