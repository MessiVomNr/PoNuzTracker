import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { BrowserRouter } from "react-router-dom";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/service-worker.js");

      // regelmäßig auf Updates prüfen
      setInterval(() => reg.update(), 60 * 1000);

      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;

        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            // neue Version ist bereit -> sofort aktivieren
            nw.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        // neue Version übernimmt -> reload
        window.location.reload();
      });
    } catch (e) {
      console.error("Service Worker registration failed:", e);
    }
  });
}

