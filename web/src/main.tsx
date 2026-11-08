import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import dayjs from "dayjs";
import "dayjs/locale/es";
import App from "./App";
import { setupPwa } from "./apps/habitfer/pwa";
import "./index.css";

// App instalable: service worker, aviso de instalacion y mensajes de las notificaciones.
setupPwa();
dayjs.locale("es");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
