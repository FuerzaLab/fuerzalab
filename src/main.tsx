import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Service worker mínimo (public/sw.js): permite instalar la app como ícono en
// celulares con Android o Chrome antiguos. Solo en la versión publicada; en
// "npm run dev" no se registra, para no interferir mientras se programa.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* si el navegador no lo permite, la app funciona igual */
    });
  });
}
