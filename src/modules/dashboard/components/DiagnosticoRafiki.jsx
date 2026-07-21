import React, { useEffect, useMemo, useState } from "react";
import { supabase, supabaseConfigOk } from "../../../supabaseClient";
import { fechaISOColombia } from "../../../shared/utils/pedidos";

const CLAVE_ERRORES = "rafikiDiagnosticoErrores";

function limitarErrores(items) {
  return (items || []).slice(-8);
}

function leerErroresGuardados() {
  if (typeof window === "undefined") return [];
  try {
    return limitarErrores(JSON.parse(window.localStorage.getItem(CLAVE_ERRORES) || "[]"));
  } catch {
    return [];
  }
}

function guardarErrorDiagnostico(error) {
  if (typeof window === "undefined") return;
  const nuevo = {
    fecha: new Date().toLocaleString("es-CO"),
    mensaje: String(error?.message || error || "Error no identificado").slice(0, 260),
    origen: String(error?.origen || "app")
  };
  const actuales = leerErroresGuardados();
  window.localStorage.setItem(CLAVE_ERRORES, JSON.stringify(limitarErrores([...actuales, nuevo])));
}

export function iniciarDiagnosticoRafikiLigero() {
  if (typeof window === "undefined" || window.__rafikiDiagnosticoActivo) return;
  window.__rafikiDiagnosticoActivo = true;

  window.addEventListener("error", (event) => {
    guardarErrorDiagnostico({ origen: "error", message: event?.message });
  });

  window.addEventListener("unhandledrejection", (event) => {
    guardarErrorDiagnostico({ origen: "promesa", message: event?.reason?.message || event?.reason });
  });
}

function ms(valor) {
  if (!Number.isFinite(valor) || valor < 0) return "—";
  return `${Math.round(valor)} ms`;
}

function obtenerInfoNavegacion() {
  if (typeof window === "undefined" || !window.performance) return null;
  const nav = window.performance.getEntriesByType?.("navigation")?.[0];
  if (!nav) return null;
  return {
    carga: nav.loadEventEnd ? nav.loadEventEnd - nav.startTime : 0,
    dom: nav.domContentLoadedEventEnd ? nav.domContentLoadedEventEnd - nav.startTime : 0,
    respuesta: nav.responseEnd && nav.requestStart ? nav.responseEnd - nav.requestStart : 0,
    tipo: nav.type || "—"
  };
}

function contarRecursos() {
  if (typeof window === "undefined" || !window.performance) return { total: 0, lentos: 0 };
  const recursos = window.performance.getEntriesByType?.("resource") || [];
  return {
    total: recursos.length,
    lentos: recursos.filter((item) => Number(item.duration) > 1200).length
  };
}

function estadoServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return "No disponible";
  if (navigator.serviceWorker.controller) return "Activo";
  return "Disponible, sin controlar esta pestaña";
}

async function conTimeout(promesa, msTimeout = 5000) {
  let timer;
  try {
    return await Promise.race([
      promesa,
      new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(`Supabase tardó más de ${msTimeout / 1000}s en responder. Revisa conexión y vuelve a intentar.`)), msTimeout);
      })
    ]);
  } finally {
    window.clearTimeout(timer);
  }
}

export default function DiagnosticoRafiki() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [errores, setErrores] = useState(() => leerErroresGuardados());
  const [probando, setProbando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const navegacion = useMemo(() => obtenerInfoNavegacion(), []);
  const recursos = useMemo(() => contarRecursos(), []);

  useEffect(() => {
    function actualizarOnline() {
      setOnline(navigator.onLine);
    }
    window.addEventListener("online", actualizarOnline);
    window.addEventListener("offline", actualizarOnline);
    const intervalo = window.setInterval(() => setErrores(leerErroresGuardados()), 3500);
    return () => {
      window.removeEventListener("online", actualizarOnline);
      window.removeEventListener("offline", actualizarOnline);
      window.clearInterval(intervalo);
    };
  }, []);

  async function probarSupabase() {
    setProbando(true);
    setResultado(null);
    const inicio = Date.now();
    try {
      if (!supabaseConfigOk) throw new Error("Variables de Supabase incompletas.");
      // Prueba liviana: evita count exact porque en tablas grandes puede superar 5s.
      const { error } = await conTimeout(
        supabase.from("pedidos").select("id").limit(1),
        10000
      );
      if (error) throw error;
      setResultado({ ok: true, texto: `Supabase respondió en ${Date.now() - inicio} ms.` });
    } catch (error) {
      guardarErrorDiagnostico({ origen: "supabase", message: error?.message });
      setErrores(leerErroresGuardados());
      setResultado({ ok: false, texto: error?.message || "No se pudo conectar con Supabase." });
    } finally {
      setProbando(false);
    }
  }

  function limpiarErrores() {
    window.localStorage.removeItem(CLAVE_ERRORES);
    setErrores([]);
  }

  return (
    <div className="soft-box" style={{ marginTop: 16 }}>
      <div className="admin-top-row">
        <div>
          <h3>🩺 Diagnóstico de estabilidad</h3>
          <p className="muted">Panel liviano para revisar estado del celular, PWA, red y últimos errores sin cargar más módulos.</p>
        </div>
        <button type="button" className="button" onClick={probarSupabase} disabled={probando}>
          {probando ? "Probando..." : "Probar Supabase"}
        </button>
      </div>

      <div className="admin-stats" style={{ marginTop: 14 }}>
        <div className="stat-card"><span>Fecha Colombia</span><strong>{fechaISOColombia()}</strong></div>
        <div className="stat-card"><span>Conexión</span><strong>{online ? "Online" : "Offline"}</strong></div>
        <div className="stat-card"><span>PWA / SW</span><strong>{estadoServiceWorker()}</strong></div>
        <div className="stat-card"><span>Carga inicial</span><strong>{ms(navegacion?.carga)}</strong></div>
        <div className="stat-card"><span>DOM listo</span><strong>{ms(navegacion?.dom)}</strong></div>
        <div className="stat-card"><span>Recursos lentos</span><strong>{recursos.lentos}/{recursos.total}</strong></div>
      </div>

      {resultado && (
        <div className={`alert ${resultado.ok ? "alert-success" : "alert-error"}`} style={{ marginTop: 12 }}>
          {resultado.texto}
        </div>
      )}

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="soft-box">
          <h4>Estado técnico</h4>
          <p><strong>Supabase config:</strong> {supabaseConfigOk ? "OK" : "Falta configuración"}</p>
          <p><strong>Tipo de carga:</strong> {navegacion?.tipo || "—"}</p>
          <p><strong>Respuesta documento:</strong> {ms(navegacion?.respuesta)}</p>
          <p><strong>Memoria:</strong> {navigator.deviceMemory ? `${navigator.deviceMemory} GB aprox.` : "No reportada"}</p>
          <p><strong>Red:</strong> {navigator.connection?.effectiveType || "No reportada"}</p>
        </div>

        <div className="soft-box">
          <div className="admin-top-row">
            <h4>Últimos errores</h4>
            <button type="button" className="button-secondary" onClick={limpiarErrores}>Limpiar</button>
          </div>
          {errores.length === 0 ? (
            <p className="muted">No hay errores recientes guardados.</p>
          ) : (
            <ul className="simple-list">
              {errores.slice().reverse().map((error, index) => (
                <li key={`${error.fecha}-${index}`} style={{ display: "block" }}>
                  <strong>{error.origen}</strong> · {error.fecha}
                  <small style={{ display: "block" }}>{error.mensaje}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
