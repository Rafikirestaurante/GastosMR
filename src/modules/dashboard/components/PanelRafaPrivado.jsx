import React, { useEffect, useMemo, useRef, useState } from "react";
import DashboardRafa from "./DashboardRafa";
import VentasMensualesDashboard from "./VentasMensualesDashboard";
import DiagnosticoRafiki, { iniciarDiagnosticoRafikiLigero } from "./DiagnosticoRafiki";
import { crearDetalleDashboardSeleccionado } from "../utils/dashboardStats";
import {
  cargarGastosDashboardRango,
  cargarPedidosDashboardRango,
  crearDatosDashboardRafa,
  crearResumenClientes,
  filtrarFilasClientes
} from "../../../services/dashboardService";
import {
  dinero,
  fechaISOColombia,
  formatearFechaHora,
  obtenerEstadoPedido
} from "../../../shared/utils/pedidos";
import { describirErrorSupabase, registrarErrorSupabase } from "../../../shared/utils/supabaseErrors";


function escaparHtmlExcel(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function descargarArchivo(nombreArchivo, contenido, tipo = "text/csv;charset=utf-8") {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

function ListaResumen({ items, vacio = "Sin datos en este periodo.", mostrarTotal = true, mostrarDetalles = false }) {
  if (!items.length) return <p className="muted">{vacio}</p>;

  return (
    <ul className="simple-list">
      {items.map((item) => (
        <li key={item.nombre} style={{ display: "block" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span>{item.nombre}</span>
            <strong>{item.cantidad} {mostrarTotal ? `· ${dinero(item.total)}` : ""}</strong>
          </div>
          {mostrarDetalles && item.detalles?.length > 0 && (
            <div style={{ marginTop: 6, paddingLeft: 12 }}>
              {item.detalles.map((detalle) => (
                <div key={`${item.nombre}-${detalle.nombre}`} className="muted" style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
                  <span>↳ {detalle.nombre}</span>
                  <span>{detalle.cantidad} {mostrarTotal ? `· ${dinero(detalle.total)}` : ""}</span>
                </div>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

iniciarDiagnosticoRafikiLigero();

export default function PanelRafaPrivado() {
  const hoy = fechaISOColombia();
  const [modoFecha, setModoFecha] = useState("dia");
  const [fechaRafa, setFechaRafa] = useState(hoy);
  const [fechaInicioRafa, setFechaInicioRafa] = useState(hoy);
  const [fechaFinRafa, setFechaFinRafa] = useState(hoy);
  const [pedidosRafa, setPedidosRafa] = useState([]);
  const [metaPedidosRafa, setMetaPedidosRafa] = useState({ count: null, completo: true, advertencia: "" });
  const [gastosRafa, setGastosRafa] = useState([]);
  const [cargandoRafa, setCargandoRafa] = useState(false);
  const [errorRafa, setErrorRafa] = useState("");
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [busquedaClienteAplicada, setBusquedaClienteAplicada] = useState("");
  const [pestanaRafa, setPestanaRafa] = useState("informe");
  const [detalleDashboard, setDetalleDashboard] = useState("");
  const [mostrarTablasDashboard, setMostrarTablasDashboard] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("rafikiMostrarTablasDashboard") === "true";
  });
  const detalleDashboardRef = useRef(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBusquedaClienteAplicada(busquedaCliente);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [busquedaCliente]);

  const rangoRafa = useMemo(() => {
    const inicioTexto = modoFecha === "rango" ? (fechaInicioRafa || hoy) : (fechaRafa || hoy);
    const finTexto = modoFecha === "rango" ? (fechaFinRafa || inicioTexto) : inicioTexto;

    const inicio = new Date(`${inicioTexto}T00:00:00-05:00`);
    const fin = new Date(`${finTexto}T00:00:00-05:00`);
    fin.setDate(fin.getDate() + 1);

    return {
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
      inicioTexto,
      finTexto
    };
  }, [modoFecha, fechaRafa, fechaInicioRafa, fechaFinRafa, hoy]);

  useEffect(() => {
    let cancelado = false;

    async function cargarPedidosRafa() {
      setCargandoRafa(true);
      setErrorRafa("");

      try {
        const { data, error, count, completo = true, advertencia = "" } = await cargarPedidosDashboardRango(rangoRafa.inicio, rangoRafa.fin);

        if (cancelado) return;

        if (error) {
          registrarErrorSupabase("cargar informe Rafa", error);
          setErrorRafa(describirErrorSupabase(error, "cargar el informe"));
          setPedidosRafa([]);
          setMetaPedidosRafa({ count: null, completo: false, advertencia: "" });
          return;
        }

        setPedidosRafa(data || []);
        setMetaPedidosRafa({ count: count ?? null, completo, advertencia });
      } catch (error) {
        if (!cancelado) {
          registrarErrorSupabase("cargar informe Rafa", error);
          setErrorRafa(describirErrorSupabase(error, "cargar el informe"));
          setPedidosRafa([]);
          setMetaPedidosRafa({ count: null, completo: false, advertencia: "" });
        }
      } finally {
        if (!cancelado) setCargandoRafa(false);
      }
    }

    cargarPedidosRafa();

    return () => {
      cancelado = true;
    };
  }, [rangoRafa]);

  useEffect(() => {
    let cancelado = false;

    async function cargarGastosRafa() {
      try {
        const data = await cargarGastosDashboardRango(rangoRafa.inicioTexto, rangoRafa.finTexto);
        if (!cancelado) setGastosRafa(data);
      } catch (error) {
        if (!cancelado) {
          setGastosRafa([]);
          registrarErrorSupabase("cargar gastos del informe", error);
          setErrorRafa((prev) => prev || describirErrorSupabase(error, "cargar los gastos del periodo"));
        }
      }
    }

    cargarGastosRafa();

    return () => {
      cancelado = true;
    };
  }, [rangoRafa]);

  const { pedidosValidos, filasClientes, resumenVentas, dashboardRafa } = useMemo(() => crearDatosDashboardRafa(pedidosRafa), [pedidosRafa]);
  const totalAdicionalesParaLlevar = (resumenVentas.adicionalesParaLlevar || []).reduce((suma, item) => suma + (Number(item.total) || 0), 0);
  const cantidadAdicionalesParaLlevar = (resumenVentas.adicionalesParaLlevar || []).reduce((suma, item) => suma + (Number(item.cantidad) || 0), 0);
  const totalVentasBrutas = resumenVentas.restaurante.total + resumenVentas.cafeteria.total;
  const totalVentas = Math.max(totalVentasBrutas - totalAdicionalesParaLlevar, 0);
  const totalPedidos = pedidosValidos.length;
  const pendientes = pedidosValidos.filter((pedido) => obtenerEstadoPedido(pedido) === "Pendiente").length;
  const finalizados = pedidosValidos.filter((pedido) => obtenerEstadoPedido(pedido) === "Finalizado").length;
  const promedioPedido = totalPedidos > 0 ? totalVentas / totalPedidos : 0;
  const tituloPeriodo = modoFecha === "rango"
    ? `${rangoRafa.inicioTexto} al ${rangoRafa.finTexto}`
    : rangoRafa.inicioTexto;
  const filasClientesFiltradas = useMemo(() => filtrarFilasClientes(filasClientes, busquedaClienteAplicada), [filasClientes, busquedaClienteAplicada]);
  const resumenClientes = useMemo(() => crearResumenClientes(filasClientesFiltradas), [filasClientesFiltradas]);
  const totalClientesFiltrados = resumenClientes.length;
  const totalComprasCliente = filasClientesFiltradas.reduce((suma, fila) => suma + (Number(fila.total) || 0), 0);
  const totalCantidadCliente = filasClientesFiltradas.reduce((suma, fila) => suma + (Number(fila.cantidad) || 0), 0);
  const totalPendienteCliente = filasClientesFiltradas.reduce((suma, fila) => suma + (fila.pagoPendiente ? (Number(fila.total) || 0) : 0), 0);
  const totalItemsVendidos = filasClientes.reduce((suma, fila) => suma + (Number(fila.cantidad) || 0), 0);

  function exportarClientesFiltradosExcel() {
    const encabezados = ["Fecha", "Pedido", "Cliente", "Teléfono", "Producto", "Cantidad", "Total", "Pago", "Estado", "Ubicación", "Observaciones"];
    const filas = filasClientesFiltradas.map((fila) => [
      formatearFechaHora(fila.fecha),
      fila.codigo,
      fila.cliente,
      fila.telefono || "",
      fila.producto,
      fila.cantidad,
      Number(fila.total) || 0,
      fila.formaPago || "",
      fila.estado || "",
      fila.ubicacion || "",
      fila.observaciones || ""
    ]);

    const tabla = [encabezados, ...filas]
      .map((fila, indiceFila) => `<tr>${fila.map((celda) => {
        const etiqueta = indiceFila === 0 ? "th" : "td";
        return `<${etiqueta}>${escaparHtmlExcel(celda)}</${etiqueta}>`;
      }).join("")}</tr>`)
      .join("");

    const contenido = `<!doctype html>
<html>
<head><meta charset="utf-8" /></head>
<body>
<table border="1">${tabla}</table>
</body>
</html>`;
    const fechaBase = modoFecha === "rango" ? `${rangoRafa.inicioTexto}-a-${rangoRafa.finTexto}` : rangoRafa.inicioTexto;
    descargarArchivo(`clientes-rafiki-${fechaBase}.xls`, contenido, "application/vnd.ms-excel;charset=utf-8");
  }

  const totalBaseHoras = Math.max(...dashboardRafa.horas.map((item) => item.total), 0);
  const totalBaseMesas = Math.max(...dashboardRafa.mesasTop.map((item) => item.total), 0);
  const gastosPorCategoria = gastosRafa.reduce((acc, gasto) => {
    const clave = gasto.categoria || "Sin definir";
    acc[clave] = (acc[clave] || 0) + Number(gasto.valor || 0);
    return acc;
  }, {});
  const totalGastos = gastosRafa.reduce((suma, gasto) => suma + Number(gasto.valor || 0), 0);
  const utilidadAproximada = totalVentas - totalGastos;
  function obtenerFechaAyer() {
    const ayer = new Date(`${hoy}T00:00:00-05:00`);
    ayer.setDate(ayer.getDate() - 1);
    return fechaISOColombia(ayer);
  }

  function aplicarPeriodoRapido(tipo) {
    if (tipo === "hoy") {
      setModoFecha("dia");
      setFechaRafa(hoy);
      return;
    }

    if (tipo === "ayer") {
      setModoFecha("dia");
      setFechaRafa(obtenerFechaAyer());
      return;
    }
  }


  function alternarTablasDashboard(valor) {
    setMostrarTablasDashboard(valor);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("rafikiMostrarTablasDashboard", valor ? "true" : "false");
    }
    if (!valor) setDetalleDashboard("");
  }

  function seleccionarDetalleDashboard(tipo) {
    setDetalleDashboard(tipo);
    window.setTimeout(() => {
      detalleDashboardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function escaparHtml(valor) {
    return String(valor ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function filasResumenPdf(items, mostrarTotal = true) {
    if (!items.length) {
      return `<tr><td colspan="${mostrarTotal ? 3 : 2}">Sin datos en este periodo.</td></tr>`;
    }

    return items.map((item) => {
      const filaPrincipal = `
        <tr>
          <td>${escaparHtml(item.nombre)}</td>
          <td>${Number(item.cantidad) || 0}</td>
          ${mostrarTotal ? `<td>${dinero(item.total)}</td>` : ""}
        </tr>
      `;
      const filasDetalle = (item.detalles || []).map((detalle) => `
        <tr>
          <td style="padding-left:18px; color:#555;">↳ ${escaparHtml(detalle.nombre)}</td>
          <td>${Number(detalle.cantidad) || 0}</td>
          ${mostrarTotal ? `<td>${dinero(detalle.total)}</td>` : ""}
        </tr>
      `).join("");
      return filaPrincipal + filasDetalle;
    }).join("");
  }

  function filasProteinasPdf(items) {
    return filasResumenPdf(items, true);
  }

  function obtenerLineasAdicionalesParaInforme() {
    const lineas = [
      `🚚 *Adicionales para llevar*`,
      `Cantidad total: ${cantidadAdicionalesParaLlevar}`
    ];

    (resumenVentas.adicionalesParaLlevar || []).forEach((item) => {
      lineas.push(`${item.nombre}: ${item.cantidad} · ${dinero(item.total)}`);
    });

    lineas.push(`Valor cobrado: ${dinero(totalAdicionalesParaLlevar)}`);
    return lineas;
  }

  function generarTextoWhatsappInformeRafa() {
    const lineas = [
      `📋 *Informe Rafa*`,
      `Periodo: ${tituloPeriodo}`,
      ``,
      `💰 *Venta bruta:* ${dinero(totalVentasBrutas)}`,
      `➖ *Adicionales para llevar:* ${dinero(totalAdicionalesParaLlevar)}`,
      `✅ *Venta neta:* ${dinero(totalVentas)}`,
      `💸 *Gastos:* ${dinero(totalGastos)}`,
      `📈 *Utilidad aprox.:* ${dinero(utilidadAproximada)}`,
      `🍽️ Restaurante: ${resumenVentas.restaurante.cantidad} · ${dinero(resumenVentas.restaurante.total)}`,
      `☕ Cafetería: ${resumenVentas.cafeteria.cantidad} · ${dinero(resumenVentas.cafeteria.total)}`,
      `🧾 Pedidos válidos: ${totalPedidos}`,
      `✅ Finalizados: ${finalizados}`,
      `⏳ Pendientes: ${pendientes}`,
      `📊 Promedio por pedido: ${dinero(promedioPedido)}`
    ];

    lineas.push(``, ...obtenerLineasAdicionalesParaInforme());

    if (resumenVentas.proteinas.length) {
      lineas.push(``, `🥇 *Proteínas vendidas:*`);
      resumenVentas.proteinas.forEach((item) => {
        lineas.push(`• ${item.nombre}: ${item.cantidad} · ${dinero(item.total)}`);
        (item.detalles || []).forEach((detalle) => {
          lineas.push(`   - ${detalle.nombre}: ${detalle.cantidad} · ${dinero(detalle.total)}`);
        });
      });
    }

    if (resumenVentas.acompanantes.length) {
      lineas.push(``, `🥗 *Acompañantes más usados:*`);
      resumenVentas.acompanantes.slice(0, 6).forEach((item) => {
        lineas.push(`• ${item.nombre}: ${item.cantidad}`);
      });
    }

    if (resumenVentas.productosCafeteria?.length) {
      lineas.push(``, `☕ *Productos de cafetería:*`);
      resumenVentas.productosCafeteria.forEach((item) => {
        lineas.push(`• ${item.nombre}: ${item.cantidad} · ${dinero(item.total)}`);
        (item.detalles || []).forEach((detalle) => {
          lineas.push(`   - ${detalle.nombre}: ${detalle.cantidad} · ${dinero(detalle.total)}`);
        });
      });
    }

    lineas.push(``, `_Generado desde Rafiki Pedidos_`);
    return lineas.join("\n");
  }

  async function generarYCompartirInformeWhatsappRafa() {
    if (!pedidosValidos.length) {
      setErrorRafa("No hay pedidos válidos para compartir en este periodo.");
      return;
    }

    const texto = generarTextoWhatsappInformeRafa();

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
      }
    } catch {
      // Si el navegador no permite copiar, igual abrimos WhatsApp con el texto.
    }

    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function generarInformePdfRafa() {
    const fechaGeneracion = new Date().toLocaleString("es-CO", {
      dateStyle: "short",
      timeStyle: "short"
    });

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Informe Rafa - ${escaparHtml(tituloPeriodo)}</title>
          <style>
            @page { size: A4; margin: 14mm; }
            body { font-family: Arial, sans-serif; color: #1f2937; margin: 0; }
            .header { border-bottom: 3px solid #f97316; padding-bottom: 12px; margin-bottom: 16px; }
            h1 { margin: 0; color: #c2410c; font-size: 24px; }
            h2 { color: #c2410c; font-size: 17px; margin: 22px 0 8px; }
            .muted { color: #6b7280; font-size: 12px; margin-top: 5px; }
            .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 14px 0; }
            .stat { border: 1px solid #fed7aa; background: #fff7ed; border-radius: 12px; padding: 10px; }
            .stat span { display: block; font-size: 11px; color: #7c2d12; font-weight: bold; text-transform: uppercase; }
            .stat strong { display: block; font-size: 18px; margin-top: 4px; color: #111827; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; page-break-inside: avoid; }
            th { background: #f97316; color: white; text-align: left; padding: 8px; font-size: 12px; }
            td { border: 1px solid #e5e7eb; padding: 7px 8px; font-size: 12px; }
            tr:nth-child(even) td { background: #fff7ed; }
            .footer { margin-top: 22px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Informe Rafa · Rafiki Pedidos</h1>
            <div class="muted">Periodo: ${escaparHtml(tituloPeriodo)} · Generado: ${escaparHtml(fechaGeneracion)}</div>
          </div>

          <div class="stats">
            <div class="stat"><span>Venta bruta</span><strong>${dinero(totalVentasBrutas)}</strong></div>
            <div class="stat"><span>Adicionales para llevar</span><strong>${dinero(totalAdicionalesParaLlevar)}</strong></div>
            <div class="stat"><span>Venta neta</span><strong>${dinero(totalVentas)}</strong></div>
            <div class="stat"><span>Gastos</span><strong>${dinero(totalGastos)}</strong></div>
            <div class="stat"><span>Utilidad aprox.</span><strong>${dinero(utilidadAproximada)}</strong></div>
            <div class="stat"><span>Pedidos válidos</span><strong>${totalPedidos}</strong></div>
          </div>

          <h2>Adicionales para llevar</h2>
          <table>
            <tbody>
              <tr><td><strong>Cantidad total</strong></td><td>${cantidadAdicionalesParaLlevar}</td></tr>
              ${(resumenVentas.adicionalesParaLlevar || []).map((item) => `<tr><td><strong>${escaparHtml(item.nombre)}</strong></td><td>${Number(item.cantidad) || 0} · ${dinero(item.total)}</td></tr>`).join("")}
              <tr><td><strong>Valor cobrado</strong></td><td>${dinero(totalAdicionalesParaLlevar)}</td></tr>
            </tbody>
          </table>

          <h2>Resumen Restaurante</h2>
          <table>
            <tbody>
              <tr><td><strong>Total vendido restaurante</strong></td><td>${dinero(resumenVentas.restaurante.total)}</td></tr>
              <tr><td><strong>Almuerzos vendidos</strong></td><td>${resumenVentas.restaurante.cantidad}</td></tr>
              <tr><td><strong>Pendientes</strong></td><td>${pendientes}</td></tr>
              <tr><td><strong>Finalizados</strong></td><td>${finalizados}</td></tr>
            </tbody>
          </table>

          <h2>Productos de Cafetería</h2>
          <table>
            <thead><tr><th>Producto</th><th>Cantidad</th><th>Total</th></tr></thead>
            <tbody>${filasResumenPdf(resumenVentas.productosCafeteria || [])}</tbody>
          </table>

          <h2>Proteínas vendidas</h2>
          <table>
            <thead><tr><th>Producto</th><th>Cantidad</th><th>Total</th></tr></thead>
            <tbody>${filasProteinasPdf(resumenVentas.proteinas)}</tbody>
          </table>

          <h2>Acompañantes más usados</h2>
          <table>
            <thead><tr><th>Acompañante</th><th>Cantidad</th></tr></thead>
            <tbody>${filasResumenPdf(resumenVentas.acompanantes.slice(0, 20), false)}</tbody>
          </table>

          <h2>Tabla consolidada</h2>
          <table>
            <thead><tr><th>Categoría</th><th>Cantidad</th><th>Total</th></tr></thead>
            <tbody>${filasResumenPdf(resumenVentas.tabla)}</tbody>
          </table>

          <div class="footer">Los pedidos en estado Borrado no se incluyen en este informe ni en las estadísticas.</div>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `;

    const ventana = window.open("", "_blank", "width=900,height=700");
    if (!ventana) {
      setErrorRafa("El navegador bloqueó la ventana del PDF. Permite ventanas emergentes e intenta de nuevo.");
      return;
    }

    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
  }

  return (
    <section className="card card-pad">
      <div className="admin-top-row">
        <div>
          <h2>🔒 Panel Rafa</h2>
          <p className="muted">Resumen gerencial de ventas por restaurante, cafetería y subcategorías.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button type="button" className="button-secondary" onClick={generarYCompartirInformeWhatsappRafa} disabled={cargandoRafa || pedidosValidos.length === 0}>
            📲 Generar informe y compartir
          </button>
          <button type="button" className="button" onClick={generarInformePdfRafa} disabled={cargandoRafa || pedidosValidos.length === 0}>
            📄 Generar PDF
          </button>
        </div>
      </div>

      <div className="soft-box" style={{ marginBottom: 16 }}>
        <h3>Seleccionar periodo</h3>
        <div className="filtros-historial" style={{ marginTop: 10 }}>
          <button type="button" onClick={() => aplicarPeriodoRapido("hoy")} className={modoFecha === "dia" && fechaRafa === hoy ? "active" : ""}>
            Hoy
          </button>
          <button type="button" onClick={() => aplicarPeriodoRapido("ayer")} className={modoFecha === "dia" && fechaRafa === obtenerFechaAyer() ? "active" : ""}>
            Ayer
          </button>
          <button type="button" onClick={() => setModoFecha("rango")} className={modoFecha === "rango" ? "active" : ""}>
            Rango manual
          </button>

          {modoFecha === "rango" && (
            <>
              <label className="calendario-filtro">
                <span>Desde</span>
                <input type="date" value={fechaInicioRafa} onChange={(e) => setFechaInicioRafa(e.target.value)} />
              </label>
              <label className="calendario-filtro">
                <span>Hasta</span>
                <input type="date" value={fechaFinRafa} onChange={(e) => setFechaFinRafa(e.target.value)} />
              </label>
            </>
          )}

          <label className="calendario-filtro">
            <span>Día</span>
            <input
              type="date"
              value={fechaRafa}
              onChange={(e) => {
                setModoFecha("dia");
                setFechaRafa(e.target.value);
              }}
            />
          </label>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          Informe seleccionado: <strong>{tituloPeriodo}</strong>
        </p>
      </div>

      <div className="filtros-historial" style={{ marginBottom: 16 }}>
        <button type="button" onClick={() => setPestanaRafa("informe")} className={pestanaRafa === "informe" ? "active" : ""}>
          📋 Informe
        </button>
        <button type="button" onClick={() => setPestanaRafa("dashboard")} className={pestanaRafa === "dashboard" ? "active" : ""}>
          📊 Dashboard
        </button>
        <button type="button" onClick={() => setPestanaRafa("clientes")} className={pestanaRafa === "clientes" ? "active" : ""}>
          👤 Clientes
        </button>
        <button type="button" onClick={() => setPestanaRafa("diagnostico")} className={pestanaRafa === "diagnostico" ? "active" : ""}>
          🩺 Diagnóstico
        </button>
      </div>

      {errorRafa && <div className="alert alert-error">{errorRafa}</div>}
      {cargandoRafa && <div className="alert alert-info">Cargando informe...</div>}

      {pestanaRafa === "dashboard" && (
        <>
        <VentasMensualesDashboard
          onSeleccionarDia={(fecha) => {
            if (!fecha) return;
            setModoFecha("dia");
            setFechaRafa(fecha);
            setPestanaRafa("informe");
          }}
        />
        <DashboardRafa
          dashboardRafa={dashboardRafa}
          resumenVentas={resumenVentas}
          totalVentas={totalVentas}
          totalVentasBrutas={totalVentasBrutas}
          totalAdicionalesParaLlevar={totalAdicionalesParaLlevar}
          totalPedidos={totalPedidos}
          totalItemsVendidos={totalItemsVendidos}
          totalBaseHoras={totalBaseHoras}
          totalBaseMesas={totalBaseMesas}
          totalGastos={totalGastos}
          utilidadAproximada={utilidadAproximada}
          gastosPorCategoria={gastosPorCategoria}
          mostrarTablasDashboard={mostrarTablasDashboard}
          detalleDashboard={detalleDashboard}
          detalleDashboardRef={detalleDashboardRef}
          alternarTablasDashboard={alternarTablasDashboard}
          seleccionarDetalleDashboard={seleccionarDetalleDashboard}
          crearDetalleDashboardSeleccionado={(tipo) => crearDetalleDashboardSeleccionado(tipo, {
            pedidosValidos,
            resumenVentas,
            totalVentas,
            totalVentasBrutas,
            totalAdicionalesParaLlevar,
            totalPedidos,
            totalItemsVendidos,
            dashboardRafa,
            finalizados,
            pendientes
          })}
          onCerrarDetalle={() => setDetalleDashboard("")}
        />
        </>
      )}

      {pestanaRafa === "diagnostico" && <DiagnosticoRafiki />}

      {pestanaRafa === "informe" && (
      <>
      <div className="admin-stats">
        <div className="stat-card"><span>Venta neta</span><strong>{dinero(totalVentas)}</strong></div>
        <div className="stat-card"><span>Venta bruta</span><strong>{dinero(totalVentasBrutas)}</strong></div>
        <div className="stat-card"><span>Adic. llevar</span><strong>{dinero(totalAdicionalesParaLlevar)}</strong></div>
        <div className="stat-card"><span>Gastos</span><strong>{dinero(totalGastos)}</strong></div>
        <div className="stat-card"><span>Utilidad aprox.</span><strong>{dinero(utilidadAproximada)}</strong></div>
        <div className="stat-card"><span>Restaurante</span><strong>{dinero(resumenVentas.restaurante.total)}</strong></div>
        <div className="stat-card"><span>Cafetería</span><strong>{dinero(resumenVentas.cafeteria.total)}</strong></div>
        <div className="stat-card"><span>Pedidos</span><strong>{totalPedidos}</strong></div>
        <div className="stat-card"><span>Promedio</span><strong>{dinero(promedioPedido)}</strong></div>
        <div className="stat-card"><span>Finalizados</span><strong>{finalizados}</strong></div>
      </div>


      <div className="soft-box" style={{ marginTop: 16, borderColor: "#fde68a", background: "#fffbeb" }}>
        <h3>Adicionales para llevar</h3>
        <p><strong>Cantidad total:</strong> {cantidadAdicionalesParaLlevar}</p>
        {(resumenVentas.adicionalesParaLlevar || []).length > 0 ? (
          <div style={{ marginTop: 8 }}>
            {(resumenVentas.adicionalesParaLlevar || []).map((item) => (
              <p key={item.nombre} style={{ margin: "4px 0" }}>
                <strong>{item.nombre}:</strong> {item.cantidad} · {dinero(item.total)}
              </p>
            ))}
          </div>
        ) : (
          <p className="muted">Sin adicionales para llevar.</p>
        )}
        <p style={{ marginTop: 8 }}><strong>Valor cobrado:</strong> {dinero(totalAdicionalesParaLlevar)}</p>
      </div>

      <div className="grid-2">
        <div className="soft-box">
          <h3>🍽️ Restaurante</h3>
          <p><strong>Total vendido:</strong> {dinero(resumenVentas.restaurante.total)}</p>
          <p><strong>Almuerzos vendidos:</strong> {resumenVentas.restaurante.cantidad}</p>
          <p><strong>Pendientes:</strong> {pendientes} · <strong>Finalizados:</strong> {finalizados}</p>
        </div>

        <div className="soft-box">
          <h3>☕ Cafetería</h3>
          <p><strong>Total vendido:</strong> {dinero(resumenVentas.cafeteria.total)}</p>
          <p><strong>Productos vendidos:</strong> {resumenVentas.cafeteria.cantidad}</p>
          <ListaResumen items={resumenVentas.productosCafeteria || []} mostrarDetalles />
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 22 }}>
        <div className="soft-box">
          <h3>Proteínas vendidas</h3>
          <ListaResumen items={resumenVentas.proteinas} mostrarDetalles />
        </div>

        <div className="soft-box">
          <h3>Acompañantes más usados</h3>
          <ListaResumen items={resumenVentas.acompanantes.slice(0, 12)} mostrarTotal={false} />
        </div>
      </div>

      <div className="soft-box" style={{ marginTop: 22 }}>
        <h3>🧾 Consolidado</h3>
        {resumenVentas.tabla.length === 0 ? (
          <p className="muted">Todavía no hay ventas para este periodo.</p>
        ) : (
          <div className="pedidos-tabla-wrap">
            <table className="pedidos-tabla-compacta">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Cantidad</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {resumenVentas.tabla.map((fila) => (
                  <tr key={fila.nombre}>
                    <td><strong>{fila.nombre}</strong></td>
                    <td>{fila.cantidad}</td>
                    <td className="td-total">{dinero(fila.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      </>
      )}

      {pestanaRafa === "clientes" && (
      <div className="soft-box" style={{ marginTop: 22 }}>
        <div className="admin-top-row">
          <div>
            <h3>👤 Historial de clientes</h3>
            <p className="muted">Busca por nombre, teléfono, producto, forma de pago, estado, observaciones o número de pedido. La búsqueda no diferencia tildes, mayúsculas ni orden de palabras.</p>
          </div>
          <button
            type="button"
            className="button secondary"
            disabled={filasClientesFiltradas.length === 0}
            onClick={exportarClientesFiltradosExcel}
          >
            Exportar Excel
          </button>
        </div>

        {metaPedidosRafa.advertencia && (
          <div className="alert alert-warning" style={{ marginTop: 10 }}>
            ⚠️ {metaPedidosRafa.advertencia}
          </div>
        )}
        {metaPedidosRafa.count !== null && (
          <p className="muted" style={{ marginTop: 8 }}>
            Motor de búsqueda: {pedidosRafa.length} de {metaPedidosRafa.count} pedidos cargados para el rango seleccionado.
          </p>
        )}

        <label className="field" style={{ marginTop: 10 }}>
          <span>Buscar cliente o compra</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="search"
              value={busquedaCliente}
              onChange={(e) => setBusquedaCliente(e.target.value)}
              placeholder="Ej: Laura pechuga, pechuga laura, finalizado efectivo, 3001234567..."
              style={{ flex: 1 }}
            />
            {busquedaCliente && (
              <button type="button" className="button secondary" onClick={() => setBusquedaCliente("")}>
                Limpiar
              </button>
            )}
          </div>
        </label>

        <div className="admin-stats" style={{ marginTop: 14 }}>
          <div className="stat-card"><span>Clientes encontrados</span><strong>{totalClientesFiltrados}</strong></div>
          <div className="stat-card"><span>Productos comprados</span><strong>{totalCantidadCliente}</strong></div>
          <div className="stat-card"><span>Total comprado</span><strong>{dinero(totalComprasCliente)}</strong></div>
          <div className="stat-card"><span>Posible pendiente</span><strong>{dinero(totalPendienteCliente)}</strong></div>
        </div>

        {busquedaClienteAplicada.trim() && resumenClientes.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <h4>Resumen del cliente</h4>
            <div className="pedidos-tabla-wrap">
              <table className="pedidos-tabla-compacta">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Teléfono</th>
                    <th>Pedidos</th>
                    <th>Cantidad</th>
                    <th>Total comprado</th>
                    <th>Posible pendiente</th>
                    <th>Última compra</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenClientes.slice(0, 12).map((cliente) => (
                    <tr key={cliente.clave}>
                      <td><strong>{cliente.cliente}</strong></td>
                      <td>{cliente.telefono || "—"}</td>
                      <td>{cliente.pedidos}</td>
                      <td>{cliente.cantidad}</td>
                      <td className="td-total">{dinero(cliente.total)}</td>
                      <td className={cliente.pendiente > 0 ? "td-total" : ""}>{cliente.pendiente > 0 ? dinero(cliente.pendiente) : "—"}</td>
                      <td>{formatearFechaHora(cliente.ultimaCompra)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <h4>Detalle de compras</h4>
          {filasClientesFiltradas.length === 0 ? (
            <p className="muted">No se encontraron compras con ese criterio en el periodo seleccionado.</p>
          ) : (
            <div className="pedidos-tabla-wrap">
              <table className="pedidos-tabla-compacta">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Producto</th>
                    <th>Cant.</th>
                    <th>Total</th>
                    <th>Pago</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filasClientesFiltradas.slice(0, 80).map((fila, index) => (
                    <tr key={fila.idFila || `${fila.codigo}-${index}`}>
                      <td>{formatearFechaHora(fila.fecha)}</td>
                      <td><strong>{fila.codigo}</strong></td>
                      <td>
                        <strong>{fila.cliente}</strong>
                        {fila.telefono && <small style={{ display: "block" }}>{fila.telefono}</small>}
                      </td>
                      <td>{fila.producto}</td>
                      <td>{fila.cantidad}</td>
                      <td className="td-total">{dinero(fila.total)}</td>
                      <td>{fila.pagoPendiente ? "⚠️ " : ""}{fila.formaPago}</td>
                      <td>{fila.estado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filasClientesFiltradas.length > 80 && (
            <p className="muted" style={{ marginTop: 8 }}>Se muestran las primeras 80 líneas. Usa una búsqueda más específica para ver menos resultados.</p>
          )}
          <p className="muted" style={{ marginTop: 8 }}>
            Nota: “Posible pendiente” se calcula según la forma de pago cuando contiene palabras como pendiente, crédito, fiado, debe o pagar después.
          </p>
        </div>
      </div>
      )}

    </section>
  );
}
