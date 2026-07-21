import { cargarPedidosRango } from "./pedidosService";
import { cargarGastosDiariosRango } from "./gastosDiariosService";
import {
  crearDashboardRafa,
  crearFilasClientes,
  crearResumenClientes,
  crearResumenVentas,
  filtrarFilasClientes
} from "../modules/dashboard/utils/dashboardStats";
import { obtenerEstadoPedido } from "../shared/utils/pedidos";

export {
  crearDashboardRafa,
  crearFilasClientes,
  crearResumenClientes,
  crearResumenVentas,
  filtrarFilasClientes
};

export function filtrarPedidosValidosDashboard(pedidos = []) {
  return (pedidos || []).filter((pedido) => obtenerEstadoPedido(pedido) !== "Borrado");
}

export function crearDatosDashboardRafa(pedidos = []) {
  const pedidosValidos = filtrarPedidosValidosDashboard(pedidos);
  const filasClientes = crearFilasClientes(pedidosValidos);
  const resumenVentas = crearResumenVentas(pedidosValidos);
  const dashboardRafa = crearDashboardRafa(
    pedidosValidos,
    filasClientes,
    crearResumenClientes(filasClientes),
    resumenVentas
  );

  return { pedidosValidos, filasClientes, resumenVentas, dashboardRafa };
}

export async function cargarPedidosDashboardRango(inicio, fin, opciones = {}) {
  return cargarPedidosRango(inicio, fin, { ascendente: true, ...opciones });
}

export async function cargarGastosDashboardRango(fechaInicio, fechaFin) {
  return cargarGastosDiariosRango(fechaInicio, fechaFin);
}
