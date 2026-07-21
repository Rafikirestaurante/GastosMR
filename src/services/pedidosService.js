import { supabase } from "../supabaseClient";

export const SELECT_PEDIDOS_ADMIN = [
  "id",
  "created_at",
  "numero_pedido",
  "ciclo_pedido",
  "estado",
  "cliente",
  "cliente_nombre",
  "telefono",
  "ubicacion",
  "mesa",
  "mesero",
  "tipo_pedido",
  "tipo_pago",
  "pedido_texto",
  "observaciones",
  "items",
  "total",
  "enviado_whatsapp"
].join(", ");

export async function crearPedido(pedido) {
  return supabase.from("pedidos").insert(pedido).select(SELECT_PEDIDOS_ADMIN).single();
}

export async function registrarAuditoriaPedido(payload) {
  return supabase.from("auditoria_pedidos").insert(payload);
}

export async function actualizarEstadoPedido(id, estado) {
  return supabase
    .from("pedidos")
    .update({ estado })
    .eq("id", id)
    .select(SELECT_PEDIDOS_ADMIN)
    .single();
}

export async function finalizarPedidosPorIds(ids = []) {
  return supabase
    .from("pedidos")
    .update({ estado: "Finalizado" })
    .in("id", ids)
    .select(SELECT_PEDIDOS_ADMIN);
}

export async function marcarPedidoBorrado(id) {
  return supabase
    .from("pedidos")
    .update({ estado: "Borrado" })
    .eq("id", id)
    .select(SELECT_PEDIDOS_ADMIN)
    .single();
}

export async function actualizarPedido(id, payload) {
  return supabase
    .from("pedidos")
    .update(payload)
    .eq("id", id)
    .select(SELECT_PEDIDOS_ADMIN)
    .single();
}

export async function actualizarFechaPedido(id, createdAt) {
  return supabase
    .from("pedidos")
    .update({ created_at: createdAt })
    .eq("id", id)
    .select(SELECT_PEDIDOS_ADMIN)
    .single();
}

const TAMANO_PAGINA_PEDIDOS_RANGO = 1000;
const MAXIMO_PAGINAS_PEDIDOS_RANGO = 250;
const LIMITE_MAXIMO_PEDIDOS_PAGINA = 1000;

function normalizarEnteroPositivo(valor, respaldo = 0) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0) return respaldo;
  return Math.floor(numero);
}

export async function cargarPedidosRango(inicio, fin, opciones = {}) {
  const {
    ascendente = true,
    paginar = true,
    limite = null,
    offset = 0,
    contar = true
  } = opciones;

  const limitePagina = Number(limite);
  const usarCargaLimitada = Number.isFinite(limitePagina) && limitePagina > 0;

  if (usarCargaLimitada) {
    const desde = normalizarEnteroPositivo(offset, 0);
    const limiteSeguro = Math.min(Math.floor(limitePagina), LIMITE_MAXIMO_PEDIDOS_PAGINA);
    const hasta = desde + limiteSeguro - 1;

    const { data, error, count } = await supabase
      .from("pedidos")
      .select(SELECT_PEDIDOS_ADMIN, contar ? { count: "exact" } : undefined)
      .gte("created_at", inicio)
      .lt("created_at", fin)
      .order("created_at", { ascending: ascendente })
      .range(desde, hasta);

    const lote = Array.isArray(data) ? data : [];
    const totalEsperado = Number.isFinite(count) ? count : null;
    const cargadosHastaAhora = desde + lote.length;
    const hayMas = totalEsperado === null ? lote.length === limiteSeguro : cargadosHastaAhora < totalEsperado;

    return {
      data: lote,
      error,
      count: totalEsperado,
      desde,
      hasta,
      limite: limiteSeguro,
      cargados: cargadosHastaAhora,
      hayMas,
      completo: !hayMas,
      cargaLimitada: true
    };
  }

  if (!paginar) {
    return supabase
      .from("pedidos")
      .select(SELECT_PEDIDOS_ADMIN)
      .gte("created_at", inicio)
      .lt("created_at", fin)
      .order("created_at", { ascending: ascendente });
  }

  const acumulado = [];
  let totalEsperado = null;

  for (let pagina = 0; pagina < MAXIMO_PAGINAS_PEDIDOS_RANGO; pagina += 1) {
    const desde = pagina * TAMANO_PAGINA_PEDIDOS_RANGO;
    const hasta = desde + TAMANO_PAGINA_PEDIDOS_RANGO - 1;

    const consulta = supabase
      .from("pedidos")
      .select(SELECT_PEDIDOS_ADMIN, pagina === 0 ? { count: "exact" } : undefined)
      .gte("created_at", inicio)
      .lt("created_at", fin)
      .order("created_at", { ascending: ascendente })
      .range(desde, hasta);

    const { data, error, count } = await consulta;

    if (error) return { data: acumulado, error };
    if (pagina === 0 && Number.isFinite(count)) totalEsperado = count;

    const lote = Array.isArray(data) ? data : [];
    acumulado.push(...lote);

    if (lote.length < TAMANO_PAGINA_PEDIDOS_RANGO || (totalEsperado !== null && acumulado.length >= totalEsperado)) {
      return { data: acumulado, error: null, count: totalEsperado, completo: true };
    }
  }

  return {
    data: acumulado,
    error: null,
    count: totalEsperado,
    completo: false,
    advertencia: `Se cargaron ${acumulado.length} registros, pero el rango puede tener más. Para auditoría crítica, reduce el rango o exporta por periodos.`
  };
}


export async function buscarPedidosPorNumeroGlobal(numeroPedido, opciones = {}) {
  const numero = Number(String(numeroPedido || "").replace(/\D+/g, ""));
  const limite = Number(opciones.limite) || 20;

  if (!Number.isFinite(numero) || numero <= 0) {
    return { data: [], error: null };
  }

  return supabase
    .from("pedidos")
    .select(SELECT_PEDIDOS_ADMIN)
    .eq("numero_pedido", numero)
    .order("created_at", { ascending: false })
    .limit(limite);
}



export async function listarPedidosPorCliente(nombreCliente, opciones = {}) {
  const nombre = String(nombreCliente || "").trim().replace(/\s+/g, " ");
  const limite = Number(opciones.limite) || 100;

  if (!nombre) {
    return { data: [], error: null };
  }

  const filtroNombre = nombre.replace(/[%_]/g, "");

  const consultaPorCampo = async (campo) => supabase
    .from("pedidos")
    .select(SELECT_PEDIDOS_ADMIN)
    .ilike(campo, `%${filtroNombre}%`)
    .order("created_at", { ascending: false })
    .limit(limite);

  const [porClienteNombre, porCliente] = await Promise.all([
    consultaPorCampo("cliente_nombre"),
    consultaPorCampo("cliente")
  ]);

  const error = porClienteNombre.error || porCliente.error || null;
  if (error) return { data: [], error };

  const mapa = new Map();
  [...(porClienteNombre.data || []), ...(porCliente.data || [])].forEach((pedido) => {
    if (pedido?.id) mapa.set(pedido.id, pedido);
  });

  const data = [...mapa.values()]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, limite);

  return { data, error: null };
}


export function crearCanalPedidosRealtime(nombreCanal, onCambio, onEstado) {
  return supabase
    .channel(nombreCanal)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "pedidos" },
      onCambio
    )
    .subscribe(onEstado);
}

export function removerCanalSupabase(canal) {
  if (!canal) return;
  supabase.removeChannel(canal);
}
