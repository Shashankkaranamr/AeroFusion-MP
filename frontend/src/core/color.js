// Small colour helpers. Hex in, hex out, so tweened values stay readable in devtools.

/** "#rrggbb" or "rgb()/rgba()" (what GSAP writes when it tweens a colour) → [r, g, b]. */
export function hexToRgb(hex) {
  if (hex[0] !== '#') return hex.match(/[\d.]+/g).slice(0, 3).map(Number);
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  const h = (v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Linear mix in sRGB. t=0 → a, t=1 → b. */
export function mixHex(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

/** For WebGL uniforms. */
export function hexToRgb01(hex) {
  return hexToRgb(hex).map((v) => v / 255);
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (v) => Math.min(1, Math.max(0, v));
