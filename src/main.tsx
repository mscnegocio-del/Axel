import { ClerkProvider } from "@clerk/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { clerkPublishableKey } from "./lib/clerk";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

// Montar React solo después de que Office.js esté listo; si no, Office.context no existe y crashea.
Office.onReady(() => {
  createRoot(rootEl).render(
    <StrictMode>
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <App />
      </ClerkProvider>
    </StrictMode>
  );
});
