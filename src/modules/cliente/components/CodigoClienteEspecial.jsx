import { useMemo, useState } from "react";
import RafikiModal from "../../../shared/components/RafikiModal";
import {
  normalizarCodigoClienteEspecial,
  validarCodigoClienteEspecial
} from "../../../services/clientesEspecialesService";

export default function CodigoClienteEspecial({
  clienteEspecialAplicado,
  setClienteEspecialAplicado,
  setCliente,
  setTelefono,
  setUbicacion,
  setComerRestauranteCliente,
  setErrorDatosPedido
}) {
  const [codigo, setCodigo] = useState("");
  const [validando, setValidando] = useState(false);
  const [mensajeCodigo, setMensajeCodigo] = useState("");
  const [tipoMensajeCodigo, setTipoMensajeCodigo] = useState("info");
  const [modalBienvenidaAbierto, setModalBienvenidaAbierto] = useState(false);

  const codigoNormalizado = useMemo(() => normalizarCodigoClienteEspecial(codigo), [codigo]);

  const aplicarClienteEspecial = (clienteEspecial) => {
    setClienteEspecialAplicado?.(clienteEspecial);

    if (clienteEspecial?.nombre) setCliente?.(clienteEspecial.nombre);
    if (clienteEspecial?.telefono) setTelefono?.(clienteEspecial.telefono);

    if (clienteEspecial?.ubicacion) {
      setComerRestauranteCliente?.(false);
      setUbicacion?.(clienteEspecial.ubicacion);
    }

    setErrorDatosPedido?.("");
  };

  const probarCodigo = async (evento) => {
    evento?.preventDefault?.();

    if (!codigoNormalizado || codigoNormalizado.length < 3) {
      setMensajeCodigo("Ingresa un código válido de mínimo 3 caracteres.");
      setTipoMensajeCodigo("warning");
      return;
    }

    setValidando(true);
    setMensajeCodigo("");

    try {
      const resultado = await validarCodigoClienteEspecial(codigoNormalizado);

      if (!resultado.ok || !resultado.cliente) {
        setClienteEspecialAplicado?.(null);
        setMensajeCodigo(resultado.mensaje || "Código no encontrado o inactivo.");
        setTipoMensajeCodigo("error");
        return;
      }

      aplicarClienteEspecial(resultado.cliente);
      setCodigo(resultado.cliente.codigo || codigoNormalizado);
      setMensajeCodigo("");
      setTipoMensajeCodigo("success");
      setModalBienvenidaAbierto(true);
    } catch {
      setClienteEspecialAplicado?.(null);
      setMensajeCodigo("No se pudo validar el código en este momento. Puedes continuar con el pedido normal.");
      setTipoMensajeCodigo("error");
    } finally {
      setValidando(false);
    }
  };

  const quitarCodigo = () => {
    setClienteEspecialAplicado?.(null);
    setModalBienvenidaAbierto(false);
    setCodigo("");
    setMensajeCodigo("Código retirado. Puedes continuar con el pedido normal.");
    setTipoMensajeCodigo("info");
  };

  const mensajeBienvenida = clienteEspecialAplicado?.mensaje_bienvenida
    || (clienteEspecialAplicado?.nombre ? `Bienvenido, ${clienteEspecialAplicado.nombre}` : "Bienvenido");

  const mostrarMensajeEstado = mensajeCodigo && !clienteEspecialAplicado;
  const cerrarModalBienvenida = () => setModalBienvenidaAbierto(false);

  return (
    <div className="cliente-especial-box cliente-especial-box-discreta fade-step">
      <div className="cliente-especial-heading cliente-especial-heading-discreta">
        <div>
          <strong>¿Tienes código de cliente?</strong>
          <p className="muted u-mb-0">
            Puedes ingresarlo aquí.
          </p>
        </div>
        {clienteEspecialAplicado ? (
          <span className="cliente-especial-pill">Activo</span>
        ) : null}
      </div>

      <form className="cliente-especial-form" onSubmit={probarCodigo}>
        <input
          type="text"
          value={codigo}
          onChange={(evento) => {
            setCodigo(evento.target.value.toUpperCase());
            if (mensajeCodigo) setMensajeCodigo("");
          }}
          placeholder="Código"
          autoComplete="off"
          inputMode="text"
          aria-label="Código de cliente especial"
        />
        <button type="submit" className="button" disabled={validando}>
          {validando ? "Validando..." : "Aplicar"}
        </button>
      </form>

      <RafikiModal
        open={modalBienvenidaAbierto && Boolean(clienteEspecialAplicado)}
        title="¡Bienvenido!"
        onClose={cerrarModalBienvenida}
        closeLabel="Cerrar bienvenida"
        size="sm"
        className="cliente-especial-modal-bienvenida"
        footer={(
          <button type="button" className="button" onClick={cerrarModalBienvenida}>
            Continuar pedido
          </button>
        )}
      >
        <div className="cliente-especial-modal-content" role="status">
          <div className="cliente-especial-modal-icon" aria-hidden="true">⭐</div>
          <h2>{mensajeBienvenida}</h2>
          <p>Gracias por preferirnos. Ya puedes continuar con tu pedido.</p>
        </div>
      </RafikiModal>

      {mostrarMensajeEstado ? (
        <div className={`cliente-especial-message cliente-especial-message-${tipoMensajeCodigo}`} role="status">
          {mensajeCodigo}
        </div>
      ) : null}

      {clienteEspecialAplicado ? (
        <div className="cliente-especial-acciones">
          <button type="button" className="button light" onClick={quitarCodigo}>
            Quitar código
          </button>
        </div>
      ) : null}
    </div>
  );
}
