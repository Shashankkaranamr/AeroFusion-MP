import { CITIES } from "../cities";
import { clamp } from "../utils";
import { dayOfYear, fireSeason, pmAt, weatherAt, windVector, type Hour } from "./core";

export type FieldMetric = "pm" | "aqi" | "temp" | "wind";

export interface FieldPoint {
  lat: number;
  lon: number;
  value: number;
}

export const INDIA_BBOX = { minLat: 6, maxLat: 37.5, minLon: 67.5, maxLon: 97.8 };

/** City values for a metric at time t. `override` lets callers inject forecast/scenario values. */
export function cityValues(t: Hour, metric: FieldMetric, override?: Record<string, number>): FieldPoint[] {
  return CITIES.map((c) => {
    let v: number;
    if (metric === "temp") v = weatherAt(c, t).temp;
    else if (metric === "wind") v = weatherAt(c, t).wind;
    else v = override?.[c.slug] ?? pmAt(c, t);
    return { lat: c.lat, lon: c.lon, value: v };
  });
}

/**
 * Smooth interpolated surface (Gaussian kernel regression in degrees) + fire plume for PM.
 * DISPLAY ONLY — the model forecasts at stations/nodes; the surface is labelled "interpolated".
 */
export function fieldGrid(points: FieldPoint[], t: Hour, metric: FieldMetric, step = 0.3) {
  const { minLat, maxLat, minLon, maxLon } = INDIA_BBOX;
  const nLat = Math.ceil((maxLat - minLat) / step);
  const nLon = Math.ceil((maxLon - minLon) / step);
  const values = new Float32Array(nLat * nLon);
  const sigma2 = 2 * 2.1 * 2.1;
  const mean = points.reduce((s, p) => s + p.value, 0) / points.length;
  const season = metric === "pm" ? fireSeason(dayOfYear(t)) : 0;
  for (let i = 0; i < nLat; i++) {
    const lat = minLat + (i + 0.5) * step;
    for (let j = 0; j < nLon; j++) {
      const lon = minLon + (j + 0.5) * step;
      let ws = 0.02;
      let vs = 0.02 * mean;
      for (const p of points) {
        const dl = lat - p.lat;
        const dn = (lon - p.lon) * Math.cos((lat * Math.PI) / 180);
        const w = Math.exp(-(dl * dl + dn * dn) / sigma2);
        ws += w;
        vs += w * p.value;
      }
      let v = vs / ws;
      if (season > 0.02) {
        // smoke plume from Punjab/Haryana drifting south-east along the Indo-Gangetic plain
        const dLat = lat - 30.3;
        const dLon = lon - 75.8;
        const along = (dLon * 0.8 - dLat * 0.6) / 1;
        const across = dLon * 0.6 + dLat * 0.8;
        const plume = Math.exp(-((across / 1.6) ** 2)) * Math.exp(-((Math.max(0, -along) / 1.2) ** 2)) * Math.exp(-Math.max(0, along) / 7);
        v += 120 * season * plume;
      }
      values[i * nLon + j] = v;
    }
  }
  return { values, nLat, nLon, step, ...INDIA_BBOX };
}

/** Coarse wind grid (u, v in m/s) for particle advection. */
export function windGrid(t: Hour, step = 1) {
  const { minLat, maxLat, minLon, maxLon } = INDIA_BBOX;
  const nLat = Math.ceil((maxLat - minLat) / step) + 1;
  const nLon = Math.ceil((maxLon - minLon) / step) + 1;
  const u = new Float32Array(nLat * nLon);
  const v = new Float32Array(nLat * nLon);
  for (let i = 0; i < nLat; i++) {
    for (let j = 0; j < nLon; j++) {
      const [uu, vv] = windVector(minLat + i * step, minLon + j * step, t);
      u[i * nLon + j] = uu;
      v[i * nLon + j] = vv;
    }
  }
  const sample = (lat: number, lon: number): [number, number] => {
    const fi = clamp((lat - minLat) / step, 0, nLat - 1.001);
    const fj = clamp((lon - minLon) / step, 0, nLon - 1.001);
    const i0 = Math.floor(fi);
    const j0 = Math.floor(fj);
    const di = fi - i0;
    const dj = fj - j0;
    const k = (a: Float32Array) =>
      a[i0 * nLon + j0] * (1 - di) * (1 - dj) +
      a[i0 * nLon + j0 + 1] * (1 - di) * dj +
      a[(i0 + 1) * nLon + j0] * di * (1 - dj) +
      a[(i0 + 1) * nLon + j0 + 1] * di * dj;
    return [k(u), k(v)];
  };
  return { sample };
}
