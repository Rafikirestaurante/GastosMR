import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const DESKTOP_GAP = 8;
const VIEWPORT_PADDING = 10;

function estaEnVistaMovil() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(max-width: 760px)")?.matches ?? window.innerWidth <= 760;
}

function enfocarItem(items, index) {
  const item = items[index];
  if (item) item.focus();
}

export default function RafikiActionMenu({
  label = "Opciones",
  items = [],
  align = "right",
  disabled = false
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useRef(`rafiki-action-menu-${Math.random().toString(36).slice(2)}`);
  const visibles = items.filter(Boolean);

  const cerrarMenu = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus?.();
  }, []);

  const actualizarPosicion = useCallback(() => {
    if (!open || !triggerRef.current || typeof window === "undefined") return;

    if (estaEnVistaMovil()) {
      setMenuStyle({});
      return;
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuNode = menuRef.current;
    const menuWidth = menuNode?.offsetWidth || 190;
    const menuHeight = menuNode?.offsetHeight || 220;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = triggerRect.bottom + DESKTOP_GAP;
    if (top + menuHeight + VIEWPORT_PADDING > viewportHeight) {
      top = Math.max(VIEWPORT_PADDING, triggerRect.top - menuHeight - DESKTOP_GAP);
    }

    let left = align === "left" ? triggerRect.left : triggerRect.right - menuWidth;
    left = Math.min(Math.max(VIEWPORT_PADDING, left), viewportWidth - menuWidth - VIEWPORT_PADDING);

    setMenuStyle({
      position: "fixed",
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      right: "auto",
      zIndex: 10040
    });
  }, [align, open]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    actualizarPosicion();
    const frame = window.requestAnimationFrame(actualizarPosicion);
    return () => window.cancelAnimationFrame(frame);
  }, [actualizarPosicion, open]);

  useEffect(() => {
    if (!open) return undefined;

    const manejarClickFuera = (event) => {
      const target = event.target;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    const manejarEscape = (event) => {
      if (event.key === "Escape") cerrarMenu();
    };

    const manejarReposicion = () => actualizarPosicion();

    document.addEventListener("mousedown", manejarClickFuera);
    document.addEventListener("touchstart", manejarClickFuera, { passive: true });
    document.addEventListener("keydown", manejarEscape);
    window.addEventListener("resize", manejarReposicion);
    window.addEventListener("scroll", manejarReposicion, true);

    return () => {
      document.removeEventListener("mousedown", manejarClickFuera);
      document.removeEventListener("touchstart", manejarClickFuera);
      document.removeEventListener("keydown", manejarEscape);
      window.removeEventListener("resize", manejarReposicion);
      window.removeEventListener("scroll", manejarReposicion, true);
    };
  }, [actualizarPosicion, cerrarMenu, open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const primerItem = menuRef.current?.querySelector("button:not(:disabled)");
      if (estaEnVistaMovil()) primerItem?.focus?.();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const manejarTeclaTrigger = (event) => {
    if (disabled) return;
    if (["ArrowDown", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      window.requestAnimationFrame(() => {
        const primerItem = menuRef.current?.querySelector("button:not(:disabled)");
        primerItem?.focus?.();
      });
    }
  };

  const manejarTeclaMenu = (event) => {
    const itemsActivos = Array.from(menuRef.current?.querySelectorAll("button:not(:disabled)") || []);
    if (itemsActivos.length === 0) return;

    const indiceActual = itemsActivos.indexOf(document.activeElement);
    const moverA = (indice) => {
      event.preventDefault();
      enfocarItem(itemsActivos, (indice + itemsActivos.length) % itemsActivos.length);
    };

    if (["ArrowDown", "ArrowRight"].includes(event.key)) moverA(indiceActual + 1);
    if (["ArrowUp", "ArrowLeft"].includes(event.key)) moverA(indiceActual - 1);
    if (event.key === "Home") moverA(0);
    if (event.key === "End") moverA(itemsActivos.length - 1);
    if (event.key === "Tab") setOpen(false);
  };

  if (visibles.length === 0) return null;

  const menu = open ? (
    <>
      <button
        type="button"
        className="rafiki-action-menu-mobile-backdrop"
        aria-label="Cerrar opciones"
        onClick={cerrarMenu}
      />
      <div
        ref={menuRef}
        id={menuId.current}
        className={`rafiki-action-menu-list rafiki-action-menu-portal ${align === "left" ? "align-left" : ""}`}
        role="menu"
        style={menuStyle}
        onKeyDown={manejarTeclaMenu}
      >
        {visibles.map((item) => (
          <button
            key={item.id || item.label}
            type="button"
            role="menuitem"
            className={`rafiki-action-menu-item ${item.variant ? `is-${item.variant}` : ""}`}
            disabled={item.disabled}
            onClick={() => {
              setOpen(false);
              item.onClick?.();
            }}
          >
            {item.icon ? <span aria-hidden="true">{item.icon}</span> : null}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </>
  ) : null;

  return (
    <div className="rafiki-action-menu">
      <button
        ref={triggerRef}
        type="button"
        className="mini-btn rafiki-action-menu-trigger"
        onClick={() => setOpen((valor) => !valor)}
        onKeyDown={manejarTeclaTrigger}
        disabled={disabled}
        aria-haspopup="menu"
        aria-controls={open ? menuId.current : undefined}
        aria-expanded={open}
      >
        {label} ⋮
      </button>
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
