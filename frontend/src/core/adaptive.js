/**
 * Adaptive resolution for the WebGL worlds.
 *
 * A dropped frame is far more visible than a slightly softer one. Each world reports its frames
 * here; when they run long the world's pixel ratio is stepped down, and when there is headroom it
 * climbs back. Steps are small, rare (a cooldown) and hysteretic, so the image never "breathes".
 *
 *   const quality = createAdaptiveQuality(() => resize(W, H));
 *   resize: const dpr = baseDpr * quality.scale;
 *   render: quality.frame();
 */
const SLOW = 1000 / 48; // ms: below ~48 fps, give up pixels
const FAST = 1000 / 58; // ms: comfortably at 60, take pixels back
const MIN = 0.55;
const STEP = 0.1;
const COOLDOWN = 1200; // ms between changes

export function createAdaptiveQuality(apply) {
  let scale = 1;
  let ema = 1000 / 60;
  let last = 0;
  let changedAt = 0;
  return {
    get scale() {
      return scale;
    },
    /** Call once per rendered frame. */
    frame() {
      const now = performance.now();
      const dt = last ? now - last : 0;
      last = now;
      // A pause (scene off screen, tab hidden) is not a slow frame.
      if (!dt || dt > 250) return;
      ema += (dt - ema) * 0.08;
      if (now - changedAt < COOLDOWN) return;
      let next = scale;
      if (ema > SLOW && scale > MIN) next = Math.max(MIN, scale - STEP);
      else if (ema < FAST && scale < 1) next = Math.min(1, scale + STEP / 2);
      if (next !== scale) {
        scale = next;
        changedAt = now;
        apply();
      }
    },
  };
}
