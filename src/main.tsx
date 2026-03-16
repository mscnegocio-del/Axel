import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

// Montar React solo después de que Office.js esté listo; si no, Office.context no existe y crashea.
Office.onReady(() => {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
