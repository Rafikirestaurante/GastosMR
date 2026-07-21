import { dinero } from "../../../shared/utils/pedidos";

function porcentaje(valor, total) {
  return total > 0 ? Math.round(((Number(valor) || 0) * 100) / total) : 0;
}

function prepararDistribucionPorcentajes(items, total, claveValor = "total") {
  const lista = (items || []).map((item, index) => {
    const valor = Number(item?.[claveValor]) || 0;
    const exacto = total > 0 ? (valor * 100) / total : 0;
    return {
      ...item,
      _dashboardIndex: index,
      _dashboardValor: valor,
      _dashboardPctBase: Math.floor(exacto),
      _dashboardResiduo: exacto - Math.floor(exacto)
    };
  });

  if (!lista.length || total <= 0) return lista.map((item) => ({ ...item, porcentaje: 0 }));

  const sumaBase = lista.reduce((suma, item) => suma + item._dashboardPctBase, 0);
  const objetivo = Math.round(lista.reduce((suma, item) => suma + item._dashboardValor, 0) * 100 / total);
  const faltante = Math.max(0, objetivo - sumaBase);
  const indicesConAjuste = new Set(
    lista
      .slice()
      .sort((a, b) => b._dashboardResiduo - a._dashboardResiduo || b._dashboardValor - a._dashboardValor || a._dashboardIndex - b._dashboardIndex)
      .slice(0, faltante)
      .map((item) => item._dashboardIndex)
  );

  return lista.map((item) => ({
    ...item,
    porcentaje: item._dashboardPctBase + (indicesConAjuste.has(item._dashboardIndex) ? 1 : 0)
  }));
}

function agruparConOtros(items, limite = 8) {
  const lista = (items || []).filter((item) => (Number(item?.total) || 0) > 0);
  if (lista.length <= limite) return lista;

  const visibles = lista.slice(0, Math.max(1, limite - 1));
  const otros = lista.slice(Math.max(1, limite - 1)).reduce((acc, item) => ({
    nombre: "Otros",
    cantidad: acc.cantidad + (Number(item.cantidad) || 0),
    total: acc.total + (Number(item.total) || 0)
  }), { nombre: "Otros", cantidad: 0, total: 0 });

  return otros.total > 0 ? [...visibles, otros] : visibles;
}

function estadoDiaOperativo(utilidadAproximada, totalVentas, porcentajeGastos) {
  if (totalVentas <= 0) return { texto: "Sin ventas", detalle: "Sin movimiento", emoji: "⚪" };
  if (utilidadAproximada <= 0 || porcentajeGastos >= 70) return { texto: "Día flojo", detalle: "Revisar gastos", emoji: "🔴" };
  if (porcentajeGastos >= 45) return { texto: "Día regular", detalle: "Margen ajustado", emoji: "🟡" };
  return { texto: "Día bueno", detalle: "Margen sano", emoji: "🟢" };
}

function divisionSegura(valor, divisor) {
  return divisor > 0 ? (Number(valor) || 0) / divisor : 0;
}

function TarjetaMetrica({ titulo, valor, detalle }) {
  return (
    <div className="stat-card" style={{ minHeight: 76 }}>
      <span>{titulo}</span>
      <strong>{valor}</strong>
      {detalle && <small className="muted" style={{ display: "block", marginTop: 4 }}>{detalle}</small>}
    </div>
  );
}

function MiniBarra({ label, valor, total, detalle }) {
  const pct = porcentaje(valor, total);
  const ancho = total > 0 ? Math.max(4, pct) : 0;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
        <strong>{label}</strong>
        <span>{detalle}</span>
      </div>
      <div style={{ height: 9, background: "#f3f4f6", borderRadius: 999, overflow: "hidden", marginTop: 5 }}>
        <div style={{ width: `${ancho}%`, height: "100%", background: "#f97316", borderRadius: 999 }} />
      </div>
    </div>
  );
}

function totalizar(items) {
  return (items || []).reduce((acc, item) => ({
    cantidad: acc.cantidad + (Number(item.cantidad) || 0),
    total: acc.total + (Number(item.total) || 0)
  }), { cantidad: 0, total: 0 });
}

function totalDistribucion(items, claveValor = "total") {
  return (items || []).reduce((suma, item) => suma + (Number(item?.[claveValor]) || 0), 0);
}

function prepararGastosPorCategoriaCompletos(gastosPorCategoria, totalGastos) {
  const lista = Object.entries(gastosPorCategoria || {})
    .map(([categoria, total]) => ({
      nombre: String(categoria || "Sin categoría").trim() || "Sin categoría",
      total: Number(total) || 0
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, "es"));

  const basePorcentaje = Number(totalGastos) || totalDistribucion(lista, "total") || 0;
  return prepararDistribucionPorcentajes(lista, basePorcentaje, "total");
}

function SumatorioDashboard({ cantidad, total, textoCantidad = "Cantidad" }) {
  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
      <strong>Total</strong>
      <strong>{textoCantidad}: {Number(cantidad) || 0} · {dinero(total)}</strong>
    </div>
  );
}

function ListaDashboard({ items, totalBase, modo = "dinero", limite = 6, textoCantidad = "Cant." }) {
  const visibles = agruparConOtros(items || [], limite);
  if (!visibles.length) return <p className="muted">Sin datos en este periodo.</p>;
  const claveValor = modo === "cantidad" ? "cantidad" : "total";
  const sumatorio = totalizar(visibles);
  const basePorcentaje = totalDistribucion(visibles, claveValor) || totalBase || 0;
  const visiblesConPct = prepararDistribucionPorcentajes(visibles, basePorcentaje, claveValor);

  return (
    <div>
      {visiblesConPct.map((item) => {
        const valorBarra = modo === "cantidad" ? item.cantidad : item.total;
        const pct = item.porcentaje;
        return (
          <MiniBarra
            key={item.nombre}
            label={item.nombre}
            valor={valorBarra}
            total={basePorcentaje}
            detalle={`${textoCantidad}: ${Number(item.cantidad) || 0} · ${pct}% · ${dinero(item.total)}`}
          />
        );
      })}
      <SumatorioDashboard cantidad={sumatorio.cantidad} total={sumatorio.total} textoCantidad={textoCantidad} />
    </div>
  );
}


function ListaMeserosDashboard({ items, totalBase, limite = 8 }) {
  const visibles = (items || []).slice(0, limite);
  if (!visibles.length) return <p className="muted">Sin datos en este periodo.</p>;
  const sumatorio = totalizar(visibles);
  const basePorcentaje = totalDistribucion(visibles, "total") || totalBase || 0;
  const visiblesConPct = prepararDistribucionPorcentajes(visibles, basePorcentaje, "total");

  return (
    <div>
      {visiblesConPct.map((item) => {
        const pct = item.porcentaje;
        return (
          <MiniBarra
            key={item.nombre}
            label={item.nombre}
            valor={item.total}
            total={basePorcentaje}
            detalle={`${Number(item.cantidad) || 0} pedidos · ${pct}% · ${dinero(item.total)}`}
          />
        );
      })}
      <SumatorioDashboard cantidad={sumatorio.cantidad} total={sumatorio.total} textoCantidad="Pedidos" />
    </div>
  );
}

function CajaDashboard({ children, activa = false, onClick }) {
  return (
    <button
      type="button"
      className="soft-box"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        border: activa ? "2px solid #f97316" : undefined,
        boxShadow: activa ? "0 8px 20px rgba(249, 115, 22, 0.18)" : undefined
      }}
      title="Ver detalle"
    >
      {children}
      <small className="muted" style={{ display: "block", marginTop: 8 }}>Ver detalle</small>
    </button>
  );
}

function DetalleDashboard({ detalle, onCerrar, detalleRef }) {
  if (!detalle) return null;

  return (
    <div ref={detalleRef} className="soft-box" style={{ marginTop: 20, borderColor: "#fdba74", background: "#fff7ed" }}>
      <div className="admin-top-row">
        <div>
          <h3>{detalle.titulo}</h3>
          {detalle.descripcion && <p className="muted">{detalle.descripcion}</p>}
        </div>
        <button type="button" className="button button-secondary" onClick={onCerrar}>
          Cerrar
        </button>
      </div>

      {detalle.resumen && (
        <div className="admin-stats" style={{ marginTop: 12 }}>
          {detalle.resumen.map((item) => (
            <div className="stat-card" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.valor}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="tabla-scroll" style={{ marginTop: 14 }}>
        <table className="tabla-admin">
          <thead>
            <tr>
              {detalle.columnas.map((columna) => <th key={columna}>{columna}</th>)}
            </tr>
          </thead>
          <tbody>
            {detalle.filas.length ? detalle.filas.map((fila, index) => (
              <tr key={`${detalle.titulo}-${index}`}>
                {fila.map((celda, idx) => <td key={idx}>{celda}</td>)}
              </tr>
            )) : (
              <tr>
                <td colSpan={detalle.columnas.length}>Sin datos en este periodo.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LineaVenta({ nombre, resumen, totalVentas }) {
  const pct = porcentaje(resumen.total, totalVentas);
  return (
    <MiniBarra
      label={`${nombre} (${pct}%)`}
      valor={resumen.total}
      total={totalVentas}
      detalle={`${resumen.cantidad} vendidos · ${dinero(resumen.total)}`}
    />
  );
}

export default function DashboardRafa({
  dashboardRafa,
  resumenVentas,
  totalVentas,
  totalVentasBrutas = 0,
  totalAdicionalesParaLlevar = 0,
  totalPedidos = 0,
  totalItemsVendidos,
  totalBaseHoras,
  totalBaseMesas,
  totalGastos = 0,
  utilidadAproximada = 0,
  gastosPorCategoria = {},
  detalleDashboard,
  detalleDashboardRef,
  seleccionarDetalleDashboard,
  crearDetalleDashboardSeleccionado,
  onCerrarDetalle
}) {
  const totalPedidosMesa = dashboardRafa.resumenMesasVsLlevar.mesas.restaurante.cantidad + dashboardRafa.resumenMesasVsLlevar.mesas.cafeteria.cantidad;
  const totalVentaMesa = dashboardRafa.resumenMesasVsLlevar.mesas.restaurante.total + dashboardRafa.resumenMesasVsLlevar.mesas.cafeteria.total;
  const totalPedidosLlevar = dashboardRafa.resumenMesasVsLlevar.llevar.restaurante.cantidad + dashboardRafa.resumenMesasVsLlevar.llevar.cafeteria.cantidad;
  const totalVentaLlevar = dashboardRafa.resumenMesasVsLlevar.llevar.restaurante.total + dashboardRafa.resumenMesasVsLlevar.llevar.cafeteria.total;
  const totalMesasConVenta = (dashboardRafa.mesasTop || []).length;
  const porcentajeGastos = porcentaje(totalGastos, totalVentas);
  const porcentajeUtilidad = porcentaje(utilidadAproximada, totalVentas);
  const ticketPromedio = divisionSegura(totalVentas, totalPedidos);
  const ventaPromedioMesa = divisionSegura(totalVentaMesa, totalPedidosMesa);
  const ventaPromedioPedido = divisionSegura(totalVentas, totalPedidos);
  const ventaPromedioMesaFisica = divisionSegura(totalVentaMesa, totalMesasConVenta);
  const estadoDia = estadoDiaOperativo(utilidadAproximada, totalVentas, porcentajeGastos);
  const meseroTop = (dashboardRafa.ventasPorMesero || [])[0];
  const mesaTop = dashboardRafa.mesaTop;
  const mejorHora = dashboardRafa.mejorHora;
  const ventaBrutaMostrar = totalVentasBrutas || totalVentas;
  const gastosCategoriaCompletos = prepararGastosPorCategoriaCompletos(gastosPorCategoria, totalGastos);
  const totalGastosCategorias = totalDistribucion(gastosCategoriaCompletos, "total") || totalGastos;
  return (
    <div className="soft-box" style={{ marginBottom: 22, borderColor: "#fed7aa", background: "linear-gradient(135deg, #fff7ed, #ffffff)" }}>
      <div className="admin-top-row">
        <div>
          <h3>📊 Dashboard Rafa</h3>
          <p className="muted">Vista ejecutiva rápida del periodo seleccionado, sin modificar pedidos ni menú.</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <span className="badge badge-finalizado">Solo lectura</span>
          <p className="muted" style={{ marginTop: 6 }}>Pedidos borrados excluidos</p>
        </div>
      </div>

      <div className="soft-box" style={{ marginTop: 18, borderColor: "#bbf7d0", background: "#f0fdf4" }}>
        <h3>🧮 Dashboard financiero 23B</h3>
        <div className="admin-stats" style={{ marginTop: 12 }}>
          <TarjetaMetrica titulo="Venta bruta" valor={dinero(ventaBrutaMostrar)} detalle="Total cobrado" />
          <TarjetaMetrica titulo="Adic. llevar" valor={dinero(totalAdicionalesParaLlevar)} detalle="No suma a venta neta" />
          <TarjetaMetrica titulo="Venta neta" valor={dinero(totalVentas)} detalle="Base operativa" />
          <TarjetaMetrica titulo="Gastos" valor={dinero(totalGastos)} detalle={`${porcentajeGastos}% de venta neta`} />
          <TarjetaMetrica titulo="Utilidad aprox." valor={dinero(utilidadAproximada)} detalle={`${porcentajeUtilidad}% margen aprox.`} />
          <TarjetaMetrica titulo="Ticket promedio" valor={dinero(ticketPromedio)} detalle={`${Number(totalPedidos) || 0} pedidos`} />
          <TarjetaMetrica titulo="Prom. mesa" valor={dinero(ventaPromedioMesa)} detalle={`${totalPedidosMesa} pedidos en mesa`} />
          <TarjetaMetrica titulo="Prom. pedido" valor={dinero(ventaPromedioPedido)} detalle="Venta neta / pedidos" />
          <TarjetaMetrica titulo="Prom. mesa física" valor={dinero(ventaPromedioMesaFisica)} detalle={`${totalMesasConVenta} mesas con venta`} />
          <TarjetaMetrica titulo="Día operativo" valor={`${estadoDia.emoji} ${estadoDia.texto}`} detalle={estadoDia.detalle} />
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 18 }}>
        <div className="soft-box" style={{ borderColor: "#bfdbfe", background: "#eff6ff" }}>
          <h3>⚡ Indicadores rápidos</h3>
          <MiniBarra label="Restaurante" valor={resumenVentas.restaurante.total} total={totalVentas} detalle={`${dashboardRafa.participacionRestaurante || 0}% · ${dinero(resumenVentas.restaurante.total)}`} />
          <MiniBarra label="Cafetería" valor={resumenVentas.cafeteria.total} total={totalVentas} detalle={`${dashboardRafa.participacionCafeteria || 0}% · ${dinero(resumenVentas.cafeteria.total)}`} />
          <MiniBarra label="Gastos / venta neta" valor={totalGastos} total={totalVentas} detalle={`${porcentajeGastos}% · ${dinero(totalGastos)}`} />
          {mejorHora && <MiniBarra label={`Hora fuerte: ${mejorHora.nombre}`} valor={mejorHora.total} total={totalVentas} detalle={`${mejorHora.cantidad} pedidos · ${dinero(mejorHora.total)}`} />}
          {mesaTop && <MiniBarra label={`Mesa líder: ${mesaTop.nombre}`} valor={mesaTop.total} total={totalVentas} detalle={`${mesaTop.cantidad} pedidos · ${dinero(mesaTop.total)}`} />}
          {meseroTop && <MiniBarra label={`Mesero líder: ${meseroTop.nombre}`} valor={meseroTop.total} total={totalVentas} detalle={`${meseroTop.cantidad} pedidos · ${dinero(meseroTop.total)}`} />}
        </div>

        <div className="soft-box" style={{ borderColor: "#fed7aa", background: "#fff7ed" }}>
          <h3>💸 Gastos por categoría</h3>
          <p className="muted" style={{ marginTop: 4 }}>Se muestran todas las categorías del periodo, sin agrupar gastos menores en “Otros”.</p>
          {gastosCategoriaCompletos.length ? (
            <div style={{ marginTop: 8 }}>
              {gastosCategoriaCompletos.map((item) => (
                <MiniBarra key={item.nombre} label={item.nombre} valor={item.total} total={totalGastosCategorias} detalle={`${item.porcentaje}% · ${dinero(item.total)}`} />
              ))}
              <SumatorioDashboard cantidad={gastosCategoriaCompletos.length} total={totalGastosCategorias} textoCantidad="Categorías" />
            </div>
          ) : <p className="muted">Sin gastos registrados en este periodo.</p>}
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 18 }}>
        <CajaDashboard activa={detalleDashboard === "venta-linea"} onClick={() => seleccionarDetalleDashboard("venta-linea")}>
          <h3>🧾 Venta por línea</h3>
          <LineaVenta nombre="Restaurante" resumen={resumenVentas.restaurante} totalVentas={totalVentas} />
          <LineaVenta nombre="Cafetería" resumen={resumenVentas.cafeteria} totalVentas={totalVentas} />
          <SumatorioDashboard cantidad={totalItemsVendidos} total={totalVentas} textoCantidad="Vendidos" />
        </CajaDashboard>

        <CajaDashboard activa={detalleDashboard === "origen-linea"} onClick={() => seleccionarDetalleDashboard("origen-linea")}>
          <h3>🪑🥡 Pedidos por línea y origen</h3>
          <MiniBarra label="Restaurante en mesa" valor={dashboardRafa.resumenMesasVsLlevar.mesas.restaurante.total} total={totalVentas} detalle={`${dashboardRafa.resumenMesasVsLlevar.mesas.restaurante.cantidad} pedidos · ${dinero(dashboardRafa.resumenMesasVsLlevar.mesas.restaurante.total)}`} />
          <MiniBarra label="Restaurante para llevar" valor={dashboardRafa.resumenMesasVsLlevar.llevar.restaurante.total} total={totalVentas} detalle={`${dashboardRafa.resumenMesasVsLlevar.llevar.restaurante.cantidad} pedidos · ${dinero(dashboardRafa.resumenMesasVsLlevar.llevar.restaurante.total)}`} />
          <MiniBarra label="Cafetería en mesa" valor={dashboardRafa.resumenMesasVsLlevar.mesas.cafeteria.total} total={totalVentas} detalle={`${dashboardRafa.resumenMesasVsLlevar.mesas.cafeteria.cantidad} pedidos · ${dinero(dashboardRafa.resumenMesasVsLlevar.mesas.cafeteria.total)}`} />
          <MiniBarra label="Cafetería para llevar" valor={dashboardRafa.resumenMesasVsLlevar.llevar.cafeteria.total} total={totalVentas} detalle={`${dashboardRafa.resumenMesasVsLlevar.llevar.cafeteria.cantidad} pedidos · ${dinero(dashboardRafa.resumenMesasVsLlevar.llevar.cafeteria.total)}`} />
          <SumatorioDashboard cantidad={totalPedidosMesa + totalPedidosLlevar} total={totalVentaMesa + totalVentaLlevar} textoCantidad="Pedidos" />
        </CajaDashboard>
      </div>

      <div className="grid-2" style={{ marginTop: 18 }}>
        <CajaDashboard activa={detalleDashboard === "horas"} onClick={() => seleccionarDetalleDashboard("horas")}>
          <h3>⏱️ Ventas por hora</h3>
          <ListaDashboard items={dashboardRafa.horas} totalBase={totalBaseHoras || totalVentas} limite={12} textoCantidad="Pedidos" />
        </CajaDashboard>

        <CajaDashboard activa={detalleDashboard === "productos"} onClick={() => seleccionarDetalleDashboard("productos")}>
          <h3>🥇 Top productos</h3>
          <ListaDashboard items={dashboardRafa.productosTop} totalBase={totalItemsVendidos} modo="cantidad" limite={8} textoCantidad="Vendidos" />
        </CajaDashboard>
      </div>

      <div className="grid-2" style={{ marginTop: 18 }}>
        <CajaDashboard activa={detalleDashboard === "mesas-top"} onClick={() => seleccionarDetalleDashboard("mesas-top")}>
          <h3>🪑 Mesas que más venden</h3>
          <ListaDashboard items={dashboardRafa.mesasTop} totalBase={totalBaseMesas || totalVentas} limite={8} textoCantidad="Pedidos" />
        </CajaDashboard>

        <CajaDashboard activa={detalleDashboard === "meseros"} onClick={() => seleccionarDetalleDashboard("meseros")}>
          <h3>🙋 Ventas por mesero</h3>
          <ListaMeserosDashboard items={dashboardRafa.ventasPorMesero || []} totalBase={totalVentas} limite={8} />
        </CajaDashboard>
      </div>

      <div className="grid-2" style={{ marginTop: 18 }}>
        <CajaDashboard activa={detalleDashboard === "pagos"} onClick={() => seleccionarDetalleDashboard("pagos")}>
          <h3>💳 Métodos de pago</h3>
          <ListaDashboard items={dashboardRafa.ventasPorPago} totalBase={totalVentas} limite={6} textoCantidad="Pedidos" />
        </CajaDashboard>

        <CajaDashboard activa={detalleDashboard === "origen"} onClick={() => seleccionarDetalleDashboard("origen")}>
          <h3>📍 Origen de pedidos</h3>
          <ListaDashboard items={dashboardRafa.ventasPorOrigen} totalBase={totalVentas} limite={6} textoCantidad="Pedidos" />
        </CajaDashboard>
      </div>

      <DetalleDashboard detalle={crearDetalleDashboardSeleccionado(detalleDashboard)} onCerrar={onCerrarDetalle} detalleRef={detalleDashboardRef} />
    </div>
  );
}
