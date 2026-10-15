import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/app.css";
import { App } from "./App";
import { sound } from "./lib/sound";

/** Mounts the dashboard under the story (src/core/site.js loads this on its own). */
export function mountDashboard(el: HTMLElement) {
  createRoot(el).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  sound.wakeOnGesture();
}
