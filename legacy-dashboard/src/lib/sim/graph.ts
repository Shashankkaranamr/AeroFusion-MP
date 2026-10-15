import { CITIES, type City } from "../cities";
import { hash2, hashString } from "../rng";
import { bearingDeg, haversineKm } from "../utils";
import { pmAt, weatherAt, type Hour } from "./core";

export interface GraphEdge {
  source: City;
  target: City;
  /** Normalised diffusion weight 0…1. */
  weight: number;
  distance: number;
  /** Estimated PM2.5 transported (µg/m³). */
  flux: number;
}

/**
 * Adaptive diffusion graph (demo): distance-decay kernel × wind alignment × a static
 * "learned" node-embedding similarity term. Top-k outgoing edges per node.
 */
export function diffusionGraph(t: Hour, k = 3, maxKm = 700): GraphEdge[] {
  const edges: GraphEdge[] = [];
  for (const s of CITIES) {
    const w = weatherAt(s, t);
    const toDir = (w.windDir + 180) % 360;
    const cand: GraphEdge[] = [];
    for (const d of CITIES) {
      if (d === s) continue;
      const dist = haversineKm(s.lat, s.lon, d.lat, d.lon);
      if (dist > maxKm || dist < 15) continue;
      let diff = Math.abs(bearingDeg(s.lat, s.lon, d.lat, d.lon) - toDir) % 360;
      if (diff > 180) diff = 360 - diff;
      const align = Math.max(0, Math.cos((diff * Math.PI) / 180));
      const learned = 0.75 + 0.5 * hash2(hashString(s.slug), hashString(d.slug));
      const weight = Math.exp(-dist / 260) * (0.25 + 0.75 * align) * learned * Math.min(1.6, w.wind / 2.2);
      cand.push({ source: s, target: d, weight, distance: dist, flux: 0 });
    }
    cand.sort((a, b) => b.weight - a.weight);
    edges.push(...cand.slice(0, k));
  }
  const max = Math.max(...edges.map((e) => e.weight), 1e-6);
  return edges
    .map((e) => {
      const weight = e.weight / max;
      return { ...e, weight, flux: weight * pmAt(e.source, t) * 0.18 };
    })
    .filter((e) => e.weight > 0.08);
}

/** Dense adjacency (row-normalised) for the Model Lab heat-matrix view. */
export function adjacencyMatrix(t: Hour, cities: City[] = CITIES) {
  const edges = diffusionGraph(t, 6, 900);
  const idx = new Map(cities.map((c, i) => [c.slug, i]));
  const m = cities.map(() => cities.map(() => 0));
  for (const e of edges) {
    const i = idx.get(e.source.slug);
    const j = idx.get(e.target.slug);
    if (i !== undefined && j !== undefined) m[i][j] = e.weight;
  }
  return m.map((row) => {
    const s = row.reduce((a, b) => a + b, 0) || 1;
    return row.map((v) => v / s);
  });
}
