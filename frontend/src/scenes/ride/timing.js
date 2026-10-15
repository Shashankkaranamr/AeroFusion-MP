/**
 * Scene 3's clock, shared by the scene (words, scale bar, clock) and the 3D world (camera,
 * particle), so the two can never drift apart. p is the scene's scroll progress, 0..1.
 */

/**
 * The scene opens with the farm-to-orbit transition, then the ride proper:
 *   [0, PRE.seq]          the transition's frames (Scene 2's farm climbing into the cloud, the
 *                         satellite in orbit), scrubbed: its clock TV runs 0 → 10.6 s
 *   [PRE.seq, PRE.desc]   the live ride, arriving under the transition's dive wipe and
 *                         descending onto the particle (TV 10.6 → 14.6 s)
 *   [PRE.desc, 1]         the ride, on its own schedule ("ride p", STEP below, from 0.28)
 */
export const PRE = { seq: 0.29, desc: 0.37 };
export const TV = { cut: 10.6, settle: 14.6 };
const RIDE0 = 0.28; // ride p at which the chase cam is established
/** Scene progress → ride p. */
export const rideP = (p) => (p < PRE.desc ? RIDE0 : RIDE0 + ((p - PRE.desc) / (1 - PRE.desc)) * (1 - RIDE0));
/** Ride p → scene progress (for placing the ride's beats on the scene timeline). */
export const sceneP = (r) => PRE.desc + ((r - RIDE0) / (1 - RIDE0)) * (1 - PRE.desc);
/** Scene progress → the transition's clock (seconds). */
export const tvAt = (p) =>
  p <= PRE.seq ? (p / PRE.seq) * TV.cut : TV.cut + Math.min(1, (p - PRE.seq) / (PRE.desc - PRE.seq)) * (TV.settle - TV.cut);

/** The ride's steps, in ride p. */
export const STEP = {
  s21: [0.16, 0.3], // chase cam; the wind
  s22: [0.3, 0.62], // cities slide past; trails join; dusk
  s23: [0.62, 0.8], // camera lifts and slows; a glow ahead
  s24: [0.8, 1.0], // high oblique over the city; the number
};

/** Monotone cubic through [x, y] keys: smooth (C1), never overshoots between keys. */
export function monotone(keys) {
  const n = keys.length;
  const xs = keys.map((k) => k[0]);
  const ys = keys.map((k) => k[1]);
  const d = [];
  const m = new Array(n);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

/**
 * How far along the path the particle is (0 = the fire, 1 = in the city's dome). Slow while the
 * camera swings round, steady through the cities, slowing again as the camera lifts, then the
 * plunge. The corner clock runs on this too: at a steady wind, time is distance.
 */
export const pathAt = monotone([
  [0, 0],
  [RIDE0, 0], // still at the fire's time until the chase cam is established
  [STEP.s22[0] + 0.05, 0.07],
  [STEP.s22[1], 0.7],
  [STEP.s24[0], 0.86],
  [0.95, 1],
  [1, 1],
]);

/**
 * Darkness for a time of day (minutes since midnight): 0 = the violet daylight look of the
 * Scene 2 render, 1 = full night. The ride is longer than a day, so the light follows the clock.
 */
export const nightAtMinutes = (() => {
  const curve = monotone([
    [0, 1], [300, 1], [390, 0.45], [480, 0], [990, 0], [1080, 0.45], [1170, 1], [1440, 1],
  ]);
  return (m) => curve(((m % 1440) + 1440) % 1440);
})();

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
