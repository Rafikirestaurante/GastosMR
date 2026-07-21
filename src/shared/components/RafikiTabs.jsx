import React, { useRef } from "react";

export default function RafikiTabs({ tabs = [], activeTab, onChange, className = "", ariaLabel = "Secciones" }) {
  const tabsVisibles = tabs.filter(Boolean);
  const botonesRef = useRef([]);

  if (tabsVisibles.length === 0) return null;

  const cambiarTabConTeclado = (event, index) => {
    const teclas = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!teclas.includes(event.key)) return;

    event.preventDefault();
    let nuevoIndex = index;

    if (["ArrowRight", "ArrowDown"].includes(event.key)) nuevoIndex = (index + 1) % tabsVisibles.length;
    if (["ArrowLeft", "ArrowUp"].includes(event.key)) {
      nuevoIndex = (index - 1 + tabsVisibles.length) % tabsVisibles.length;
    }
    if (event.key === "Home") nuevoIndex = 0;
    if (event.key === "End") nuevoIndex = tabsVisibles.length - 1;

    const tabDestino = tabsVisibles[nuevoIndex];
    onChange?.(tabDestino.id);
    window.requestAnimationFrame(() => botonesRef.current[nuevoIndex]?.focus?.());
  };

  return (
    <div className={["rafiki-tabs", className].filter(Boolean).join(" ")} role="tablist" aria-label={ariaLabel}>
      {tabsVisibles.map((tab, index) => {
        const activo = tab.id === activeTab;
        return (
          <button
            ref={(elemento) => {
              botonesRef.current[index] = elemento;
            }}
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activo}
            tabIndex={activo ? 0 : -1}
            className={`rafiki-tab ${activo ? "active" : ""}`}
            onClick={() => onChange?.(tab.id)}
            onKeyDown={(event) => cambiarTabConTeclado(event, index)}
          >
            {tab.icon ? <span aria-hidden="true">{tab.icon}</span> : null}
            <strong>{tab.label}</strong>
            {tab.count !== undefined && tab.count !== null ? <small>{tab.count}</small> : null}
          </button>
        );
      })}
    </div>
  );
}
