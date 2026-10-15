import { useEffect, useState } from "react";

/**
 * The dashboard shares its page with the story (src/core/site.js). It is "locked in" — the page is
 * only the dashboard — once html has .mode-dash; before that it waits under the story, rendered
 * but out of sight, and must not move the page or answer keys.
 */
export const isDash = () => document.documentElement.classList.contains("mode-dash");

/** Back to the story's animation, from the top. */
export function toStory() {
  window.dispatchEvent(new Event("aerofusion:story"));
}

/** True while the dashboard has the page. */
export function useDashMode() {
  const [dash, setDash] = useState(isDash);
  useEffect(() => {
    const on = () => setDash(isDash());
    window.addEventListener("aerofusion:mode", on);
    return () => window.removeEventListener("aerofusion:mode", on);
  }, []);
  return dash;
}
