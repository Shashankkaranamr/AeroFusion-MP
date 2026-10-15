/**
 * Deterministic pseudo-randomness for the demo simulator.
 * Same inputs always give the same outputs, so server, client and every page agree.
 */

export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Hash two integers into [0, 1). */
export function hash2(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b + 0x632be5ab) | 0, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 1-D value noise in [-1, 1]. */
export function valueNoise(seed: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash2(seed, i);
  const b = hash2(seed, i + 1);
  return (a + (b - a) * u) * 2 - 1;
}

/** Fractal noise in roughly [-1, 1]. */
export function fbm(seed: number, x: number, octaves = 3): number {
  let amp = 1;
  let freq = 1;
  let total = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    total += amp * valueNoise(seed + o * 1013, x * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return total / norm;
}

/** Approximate standard normal from two hashes (Box–Muller). */
export function gaussian(seed: number, i: number): number {
  const u1 = Math.max(1e-9, hash2(seed, i * 2));
  const u2 = hash2(seed, i * 2 + 1);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
