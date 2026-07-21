import InstallPWA from "./InstallPWA.jsx";
import PWAUpdatePrompt from "./PWAUpdatePrompt.jsx";
import PWAOfflineNotice from "./PWAOfflineNotice.jsx";
import PWAOldVersionGuard from "./PWAOldVersionGuard.jsx";
import PedidosOfflineStatus from "../../modules/pedidos/components/PedidosOfflineStatus.jsx";

export default function PWAInternalRuntime() {
  return (
    <>
      <InstallPWA />
      <PWAUpdatePrompt />
      <PWAOfflineNotice />
      <PWAOldVersionGuard />
      <PedidosOfflineStatus />
    </>
  );
}
