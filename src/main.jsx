import "./styles/app.css";
import "./styles/pwaMobile.css";
import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { registerServiceWorker } from "./registerSW.js";
import {
  esRutaPublicaCliente,
  prepararClientePublicoSinServiceWorker
} from "./shared/utils/clientePublicoRuntime.js";
import { activarRecuperacionPWA } from "./shared/utils/pwaRecovery.js";
import ErrorBoundary from "./shared/components/ErrorBoundary.jsx";

const PWAInternalRuntime = lazy(() => import("./shared/components/PWAInternalRuntime.jsx"));
const rutaPublicaCliente = esRutaPublicaCliente();

activarRecuperacionPWA();

if (rutaPublicaCliente) {
  prepararClientePublicoSinServiceWorker().catch((error) => {
    console.warn("No se pudo preparar /cliente como link público sin service worker:", error);
  });
} else {
  registerServiceWorker();
}

createRoot(document.getElementById("root")).render(
  <ErrorBoundary nombreModulo="Rafiki Pedidos" usarRecuperacionPWA>
    <App />
    {!rutaPublicaCliente && (
      <Suspense fallback={null}>
        <PWAInternalRuntime />
      </Suspense>
    )}
  </ErrorBoundary>
);
