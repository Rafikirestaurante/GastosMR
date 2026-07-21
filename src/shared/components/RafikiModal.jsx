import React, { useEffect, useId, useRef } from "react";

let modalesAbiertos = 0;

function bloquearScrollBody() {
  modalesAbiertos += 1;
  document.body.classList.add("rafiki-modal-open");
}

function liberarScrollBody() {
  modalesAbiertos = Math.max(0, modalesAbiertos - 1);
  if (modalesAbiertos === 0) document.body.classList.remove("rafiki-modal-open");
}

export default function RafikiModal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  closeLabel = "Cerrar",
  size = "md",
  className = ""
}) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const manejarEscape = (event) => {
      if (event.key === "Escape") onCloseRef.current?.();
    };

    const manejarTab = (event) => {
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focuseables = Array.from(
        dialogRef.current.querySelectorAll(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((elemento) => elemento.offsetParent !== null);

      if (focuseables.length === 0) return;
      const primero = focuseables[0];
      const ultimo = focuseables[focuseables.length - 1];

      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primero.focus();
      }
    };

    const elementoActivoPrevio = document.activeElement;
    document.addEventListener("keydown", manejarEscape);
    document.addEventListener("keydown", manejarTab);
    bloquearScrollBody();

    const frame = window.requestAnimationFrame(() => {
      const primerCampo = dialogRef.current?.querySelector(
        'input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), [href]'
      );
      primerCampo?.focus?.();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", manejarEscape);
      document.removeEventListener("keydown", manejarTab);
      liberarScrollBody();
      elementoActivoPrevio?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="rafiki-ui-modal-backdrop" role="presentation" onMouseDown={() => onCloseRef.current?.()}>
      <section
        ref={dialogRef}
        className={["rafiki-ui-modal-card", `rafiki-ui-modal-${size}`, className].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="rafiki-ui-modal-header">
          <div>
            <h3 id={titleId}>{title}</h3>
            {description ? <p>{description}</p> : null}
          </div>
          <button type="button" className="rafiki-ui-modal-close" onClick={() => onCloseRef.current?.()} aria-label={closeLabel}>
            ×
          </button>
        </header>
        <div className="rafiki-ui-modal-body">{children}</div>
        {footer ? <footer className="rafiki-ui-modal-footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
