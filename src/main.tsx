import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import OverlayPanel from "./components/OverlayPanel";
import "./index.css";

// Determine if we're in the overlay window
const urlParams = new URLSearchParams(window.location.search);
const isOverlay = urlParams.get("view") === "overlay";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isOverlay ? <OverlayPanel /> : <App />}
  </React.StrictMode>,
);
