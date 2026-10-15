import { CITIES, SOURCE_REGIONS, type City } from "../cities";
import { fbm, hashString } from "../rng";
import { bearingDeg, clamp, haversineKm } from "../utils";
import { dayOfYear, istHour, istWeekday, pmComponents, trafficSignal, weatherAt, type Hour } from "./core";

export type FeatureKey =
  | "fire"
  | "wind"
  | "neighbors"
  | "boundary"
  | "humidity"
  | "lags"
  | "traffic"
  | "season"
  | "roads"
  | "industry"
  | "landuse";

export interface FeatureMeta {
  key: FeatureKey;
  label: string;
  short: string;
  group: "Satellite" | "Meteorology" | "Spatial" | "Temporal" | "Anthropogenic" | "Static";
  source: string;
  color: string;
}

export const FEATURES: FeatureMeta[] = [
  { key: "fire", label: "Upwind fire hotspots (72 h)", short: "Fire hotspots", group: "Satellite", source: "NASA FIRMS", color: "#ef4444" },
  { key: "neighbors", label: "Neighbouring cities (graph diffusion)", short: "Neighbours", group: "Spatial", source: "Adaptive graph", color: "#f97316" },
  { key: "wind", label: "Wind speed & stagnation", short: "Wind", group: "Meteorology", source: "ERA5 / IMD", color: "#3b82f6" },
  { key: "boundary", label: "Boundary layer & temperature", short: "Boundary layer", group: "Meteorology", source: "ERA5 / IMD", color: "#06b6d4" },
  { key: "lags", label: "Recent PM2.5 history (t−1…t−24)", short: "PM2.5 history", group: "Temporal", source: "CPCB", color: "#10b981" },
  { key: "humidity", label: "Relative humidity", short: "Humidity", group: "Meteorology", source: "ERA5 / IMD", color: "#8b5cf6" },
  { key: "traffic", label: "Traffic & activity proxy", short: "Traffic", group: "Anthropogenic", source: "Calendar proxy", color: "#eab308" },
  { key: "season", label: "Season / climatology", short: "Season", group: "Temporal", source: "Calendar", color: "#64748b" },
  { key: "industry", label: "Industrial activity (static)", short: "Industry", group: "Static", source: "EDGAR / CPCB inventory", color: "#b45309" },
  { key: "roads", label: "Road & traffic density (static)", short: "Road density", group: "Static", source: "OpenStreetMap", color: "#94a3b8" },
  { key: "landuse", label: "Population & land use", short: "Land use", group: "Static", source: "WorldPop / ESA", color: "#a8a29e" },
];

export const FEATURE_BY_KEY = Object.fromEntries(FEATURES.map((f) => [f.key, f])) as Record<FeatureKey, FeatureMeta>;

/** Expected model output across the training set (SHAP base value), µg/m³. */
export const BASE_VALUE = 62;

export interface Attribution {
  baseValue: number;
  prediction: number;
  values: Record<FeatureKey, number>;
}

/**
 * SHAP-style additive attribution for the demo simulator: the log-space factors of the
 * generating process are converted into additive µg/m³ contributions that sum exactly to
 * `prediction − baseValue`.
 */
export function attribution(city: City, t: Hour): Attribution {
  const c = pmComponents(city, t);
  const h = istHour(t);
  const traffic = trafficSignal(h, istWeekday(t));
  const terms = {
    local: Math.log(c.base / BASE_VALUE),
    season: Math.log(c.season),
    diurnal: Math.log(c.diurnal) + Math.log(c.weekly),
    regime: 0.42 * c.regime,
    lags: 0.15 * c.local,
  };
  const logSum = terms.local + terms.season + terms.diurnal + terms.regime + terms.lags;
  const coreDelta = c.core - BASE_VALUE;
  const scale = Math.abs(logSum) < 1e-6 ? 0 : coreDelta / logSum;
  const trafficShare = clamp(0.25 + 0.5 * traffic, 0, 0.8);
  const values: Record<FeatureKey, number> = {
    fire: c.fire,
    wind: terms.regime * scale * 0.42,
    neighbors: terms.regime * scale * 0.36,
    humidity: terms.regime * scale * 0.22,
    boundary: terms.diurnal * scale * (1 - trafficShare),
    traffic: terms.diurnal * scale * trafficShare,
    lags: terms.lags * scale,
    season: terms.season * scale,
    ...splitStatic(city, terms.local * scale),
  };
  return { baseValue: BASE_VALUE, prediction: c.pm, values };
}

/** City-specific split of the static emission term into inventory-style features. */
function splitStatic(city: City, v: number): Pick<Record<FeatureKey, number>, "roads" | "industry" | "landuse"> {
  const h = hashString(city.slug + ":static");
  const r1 = ((h & 0xff) / 255) * 0.35;
  const r2 = (((h >>> 8) & 0xff) / 255) * 0.4;
  const r3 = (((h >>> 16) & 0xff) / 255) * 0.3;
  const w = [0.32 + r1, 0.22 + r2, 0.26 + r3];
  const s = w[0] + w[1] + w[2];
  return { roads: (v * w[0]) / s, industry: (v * w[1]) / s, landuse: (v * w[2]) / s };
}

/** Mean |φ| share across all cities over the last `hours` (global importance, %). */
export function globalImportance(anchor: Hour, hours = 72, step = 6) {
  const acc: Record<FeatureKey, number> = Object.fromEntries(FEATURES.map((f) => [f.key, 0])) as Record<FeatureKey, number>;
  for (const city of CITIES) {
    for (let k = 0; k < hours; k += step) {
      const a = attribution(city, anchor - k);
      for (const f of FEATURES) acc[f.key] += Math.abs(a.values[f.key]);
    }
  }
  const total = Object.values(acc).reduce((s, v) => s + v, 0) || 1;
  return FEATURES.map((f) => ({ ...f, value: (acc[f.key] / total) * 100 })).sort((a, b) => b.value - a.value);
}

/** Per-city importance share (%), averaged over recent hours. */
export function cityImportance(city: City, anchor: Hour, hours = 48, step = 3) {
  const acc: Record<FeatureKey, number> = Object.fromEntries(FEATURES.map((f) => [f.key, 0])) as Record<FeatureKey, number>;
  for (let k = 0; k < hours; k += step) {
    const a = attribution(city, anchor - k);
    for (const f of FEATURES) acc[f.key] += Math.abs(a.values[f.key]);
  }
  const total = Object.values(acc).reduce((s, v) => s + v, 0) || 1;
  return FEATURES.map((f) => ({ ...f, value: (acc[f.key] / total) * 100 })).sort((a, b) => b.value - a.value);
}

/** Attribution time series for the past `hours`. */
export function temporalAttribution(city: City, anchor: Hour, hours = 168, step = 3) {
  const out: ({ t: Hour } & Record<FeatureKey, number>)[] = [];
  for (let k = -hours; k <= 0; k += step) {
    const a = attribution(city, anchor + k);
    out.push({ t: anchor + k, ...a.values });
  }
  return out;
}

/** Causal temporal attention: feature × lag (hours back), each row sums to 1. */
export function attentionMatrix(city: City, anchor: Hour, lags = 24, lagStep = 3) {
  const seed = hashString(city.slug + ":attn");
  const doy = dayOfYear(anchor);
  const rows = FEATURES.map((f, fi) => {
    const raw: number[] = [];
    for (let j = 0; j < lags; j++) {
      const lag = j * lagStep;
      let w: number;
      switch (f.key) {
        case "fire":
          w = Math.exp(-0.5 * ((lag - 30) / 14) ** 2) * (0.5 + 1.5 * Math.exp(-0.5 * ((doy - 309) / 25) ** 2));
          break;
        case "neighbors":
          w = Math.exp(-0.5 * ((lag - 9) / 6) ** 2);
          break;
        case "wind":
        case "humidity":
          w = Math.exp(-lag / 9);
          break;
        case "boundary":
          w = 0.4 + 0.6 * Math.max(0, Math.cos((2 * Math.PI * lag) / 24));
          break;
        case "lags":
          w = Math.exp(-lag / 6) + 0.35 * Math.exp(-0.5 * ((lag - 24) / 3) ** 2);
          break;
        case "traffic":
          w = 0.3 + 0.7 * Math.max(0, Math.cos((2 * Math.PI * (lag - 2)) / 12));
          break;
        default:
          w = 0.5;
      }
      w *= 1 + 0.25 * fbm(seed + fi * 97, j / 3, 2);
      raw.push(Math.max(1e-4, w * 4));
    }
    const max = Math.max(...raw);
    const exps = raw.map((v) => Math.exp(v - max));
    const s = exps.reduce((a, b) => a + b, 0);
    return { feature: f, weights: exps.map((e) => e / s) };
  });
  return { lags: Array.from({ length: lags }, (_, j) => j * lagStep), rows };
}

/** Which upwind regions push PM2.5 into the target city (spatial explanation, %). */
export function spatialSources(city: City, t: Hour) {
  const w = weatherAt(city, t);
  const a = attribution(city, t);
  const transported = Math.max(0, a.values.neighbors) + Math.max(0, a.values.fire);
  const scores = SOURCE_REGIONS.map((r) => {
    const d = haversineKm(city.lat, city.lon, r.lat, r.lon);
    if (d < 40 || d > 900) return { ...r, score: 0, distance: d };
    const bearingFromCity = bearingDeg(city.lat, city.lon, r.lat, r.lon);
    let diff = Math.abs(bearingFromCity - w.windDir) % 360;
    if (diff > 180) diff = 360 - diff;
    const upwind = Math.max(0, Math.cos((diff * Math.PI) / 180));
    const fireBoost = r.id === "punjab" || r.id === "haryana" ? 1 + 3 * Math.max(0, a.values.fire) / Math.max(a.prediction, 1) : 1;
    return { ...r, score: upwind ** 1.5 * Math.exp(-d / 420) * fireBoost, distance: d };
  });
  const total = scores.reduce((s, r) => s + r.score, 0) || 1;
  const share = a.prediction > 0 ? transported / a.prediction : 0;
  return scores
    .filter((r) => r.score > 0)
    .map((r) => ({ ...r, contribution: (r.score / total) * share * 100 }))
    .sort((x, y) => y.contribution - x.contribution)
    .slice(0, 5);
}
