import { SelectorCantidad } from "./common";
import {
  calcularTotalItem,
  dinero,
  esItemCafeteria,
  esProductoSinAcompanantes,
  MENSAJE_ACOMPANANTES_DEL_DIA,
  textoParaLlevarItem,
  valorParaLlevarItem
} from "../utils/pedidos";

function textoLimpio(valor) {
  return String(valor || "").trim();
}

function detalleConPrecio(detalle) {
  if (!detalle) return "";
  if (typeof detalle === "string") return textoLimpio(detalle);
  const nombre = textoLimpio(detalle.nombre || detalle.producto || detalle.label || detalle.descripcion || detalle.valor || "");
  const precio = Number(detalle.precio || detalle.extra || 0) || 0;
  if (!nombre) return "";
  return precio > 0 ? `${nombre} +${dinero(precio)}` : nombre;
}

function nombreItemResumen(item = {}) {
  if (esItemCafeteria(item)) {
    const tipo = textoLimpio(item.tipo);
    const producto = textoLimpio(item.producto || item.plato || item.proteina || item.nombre);

    if (tipo === "Parfait") return "Parfait";
    if (["Batido cremoso", "Batido refrescante", "Jugo tradicional"].includes(tipo)) return tipo;
    if (tipo === "Desayuno") return producto || "Desayuno";
    return producto || tipo || "Producto";
  }

  return item.producto || item.plato || item.proteina || item.nombre || "Producto";
}

function agregarUnico(detalles, valor) {
  const limpio = textoLimpio(valor);
  if (limpio && !detalles.includes(limpio)) detalles.push(limpio);
}

function detallesCafeteria(item = {}, titulo = "") {
  const detalles = [];
  const tipo = textoLimpio(item.tipo);
  const producto = textoLimpio(item.producto || item.plato || item.proteina || item.nombre);

  if (tipo === "Parfait") {
    agregarUnico(detalles, item.tamano);
    if (Array.isArray(item.frutas) && item.frutas.length > 0) {
      agregarUnico(detalles, item.frutas.map(textoLimpio).filter(Boolean).join(" / "));
    }
  } else if (["Batido cremoso", "Batido refrescante", "Jugo tradicional"].includes(tipo)) {
    agregarUnico(detalles, producto);
    agregarUnico(detalles, item.base);
  } else {
    if (producto && producto !== titulo) agregarUnico(detalles, producto);
    agregarUnico(detalles, item.tamano);

    if (Array.isArray(item.frutas) && item.frutas.length > 0) {
      agregarUnico(detalles, item.frutas.map(textoLimpio).filter(Boolean).join(" / "));
    }

    agregarUnico(detalles, item.base);
    agregarUnico(detalles, item.acompanante);
    agregarUnico(detalles, item.bebida);
  }

  if (Number(item.extraFrutas) > 0) detalles.push(`Extra 3 frutas +${dinero(item.extraFrutas)}`);

  if (Array.isArray(item.adicionales) && item.adicionales.length > 0) {
    item.adicionales.map(detalleConPrecio).filter(Boolean).forEach((detalle) => agregarUnico(detalles, detalle));
  }

  if (item.observacionesItem?.trim()) detalles.push(`Obs: ${item.observacionesItem.trim()}`);

  return detalles.filter(Boolean);
}

export default function ResumenPedidoItem({
  grupo,
  onBorrar,
  onCambiarCantidad,
  onEditarProteina,
  onEditarAcompanantes,
  mostrarSopaBebida = true,
  mostrarTextoParaLlevar = true,
  mostrarAdicionalLlevar = false,
  etiquetaSubtotal = "Subtotal",
  className = ""
}) {
  const item = grupo?.item || {};
  const cantidad = Number(grupo?.cantidad || item.cantidad || 1) || 1;
  const nombre = nombreItemResumen(item);
  const itemEsCafeteria = esItemCafeteria(item);
  const itemSinAcompanantes = itemEsCafeteria || esProductoSinAcompanantes(item);
  const acompanantes = Array.isArray(item.acompanantes) ? item.acompanantes.filter(Boolean) : [];
  const detallesCafe = itemEsCafeteria ? detallesCafeteria(item, nombre) : [];
  const puedeEditarProteina = Boolean(onEditarProteina) && !itemEsCafeteria;
  const puedeEditarAcompanantes = Boolean(onEditarAcompanantes) && !itemEsCafeteria && !itemSinAcompanantes;
  const adicionalLlevar = valorParaLlevarItem(item);
  const idsGrupo = grupo?.ids || [];

  return (
    <div className={["summary-item", "summary-item-clean", className].filter(Boolean).join(" ")}>
      <div className="summary-product-title summary-product-title-clean">
        <strong className="summary-main-name">{cantidad} x {nombre}</strong>
        <span className="summary-main-price">{dinero(item.precioPlato || item.precioProteina || item.precio)}</span>
      </div>

      {itemEsCafeteria && detallesCafe.length > 0 ? (
        <div className="summary-detail-list summary-clean-detail-list summary-cafeteria-detail-list">
          {detallesCafe.map((detalle, index) => <span key={`${detalle}-${index}`}>{detalle}</span>)}
        </div>
      ) : null}

      {!itemEsCafeteria && !itemSinAcompanantes ? (
        <div className="summary-acompanantes-block">
          <span className="summary-section-label">Acompañantes:</span>
          <div className="summary-detail-list summary-acompanantes-list summary-clean-acompanantes-list">
            {acompanantes.length > 0 ? acompanantes.map((acompanante) => (
              <span key={acompanante}>• {acompanante}</span>
            )) : <span>Sin acompañantes</span>}
          </div>
        </div>
      ) : null}

      {!itemEsCafeteria && itemSinAcompanantes ? (
        <div className="summary-detail-list summary-clean-detail-list"><span>{MENSAJE_ACOMPANANTES_DEL_DIA}</span></div>
      ) : null}

      {!itemEsCafeteria && !itemSinAcompanantes && Array.isArray(item.adicionalesAlmuerzo) && item.adicionalesAlmuerzo.length > 0 ? (
        <div className="summary-detail-list summary-clean-detail-list">
          {item.adicionalesAlmuerzo.map((extra) => {
            const detalle = detalleConPrecio(extra);
            return detalle ? <span key={detalle}>{detalle}</span> : null;
          })}
        </div>
      ) : null}

      {!itemEsCafeteria && !itemSinAcompanantes && item.observacionAcompanantes?.trim() ? (
        <p className="summary-note">Obs. acompañantes: {item.observacionAcompanantes.trim()}</p>
      ) : null}

      {!itemEsCafeteria && !itemSinAcompanantes && mostrarSopaBebida ? (
        <p className="summary-note">Sopa + bebida incluida</p>
      ) : null}

      {mostrarTextoParaLlevar ? <p className="summary-note">{textoParaLlevarItem(item)}</p> : null}
      {mostrarAdicionalLlevar && adicionalLlevar > 0 ? <p className="summary-note">Adicional incluido: {dinero(adicionalLlevar)} por unidad.</p> : null}

      <div className="summary-qty-row">
        <span>Cantidad</span>
        <SelectorCantidad cantidad={cantidad} onChange={(valor) => onCambiarCantidad?.(idsGrupo, valor)} />
      </div>

      {grupo?.agrupado ? (
        <p className="summary-group-note">Agrupado automáticamente por producto igual.</p>
      ) : null}

      {(puedeEditarProteina || puedeEditarAcompanantes) ? (
        <div className={["summary-edit-actions", puedeEditarProteina && puedeEditarAcompanantes ? "" : "summary-edit-actions-single"].filter(Boolean).join(" ")}>
          {puedeEditarProteina ? (
            <button type="button" className="mini-btn resumen-editar-proteina-btn" onClick={() => onEditarProteina?.(grupo)}>
              Editar proteína
            </button>
          ) : null}
          {puedeEditarAcompanantes ? (
            <button type="button" className="mini-btn resumen-editar-acompanantes-btn" onClick={() => onEditarAcompanantes?.(grupo)}>
              Editar acompañantes
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="summary-item-footer-actions">
        <button
          type="button"
          className="mini-danger summary-delete-small"
          onClick={() => onBorrar?.(idsGrupo)}
          aria-label={`Borrar ${nombre} del pedido`}
        >
          Borrar
        </button>
      </div>

      <div className="total-row compact-total-row summary-item-subtotal">
        <span>{etiquetaSubtotal}</span>
        <strong>{dinero(calcularTotalItem(item))}</strong>
      </div>
    </div>
  );
}
