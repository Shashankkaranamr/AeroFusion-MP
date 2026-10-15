import type { City } from "../cities";
import { fbm, hashString } from "../rng";
import { clamp } from "../utils";
import { pmAt, weatherAt, type Hour } from "./core";

/** Forecast spread (log-space σ) as a function of lead time in hours. */
export const sigmaAt = (lead: number) => 0.035 + 0.0049 * lead;

const Z90 = 1.2816;

export interface ForecastPoint {
  t: Hour;
  lead: number;
  /** Observed value (only for t ≤ anchor). */
  actual: number | null;
  /** Hidden "truth" — used for backtests only. */
  truth: number;
  pred: number;
  p10: number;
  p90: number;
  /** CAMS-like external benchmark (simulated). */
  cams: number;
  persistence: number;
  temp: number;
  rh: number;
  wind: number;
}

function modelError(city: City, issued: Hour, lead: number) {
  const seed = hashString(city.slug) ^ (issued * 2654435761);
  return sigmaAt(lead) * 1.25 * fbm(seed >>> 0, lead / 9 + 0.3, 2);
}

function camsBias(city: City) {
  // External regional models tend to under-predict Indo-Gangetic winter peaks.
  return city.region === "nw" || city.region === "north" || city.region === "east" ? -0.2 : -0.06;
}

/** Model prediction for time `t` issued at `issued` (lead = t - issued). */
export function predictAt(city: City, issued: Hour, t: Hour) {
  const lead = Math.max(0, t - issued);
  const truth = pmAt(city, t);
  const pred = truth * Math.exp(modelError(city, issued, lead));
  const s = sigmaAt(lead);
  return { truth, pred, p10: pred * Math.exp(-Z90 * s), p90: pred * Math.exp(Z90 * s) };
}

export function camsAt(city: City, t: Hour) {
  const seed = hashString(city.slug + ":cams");
  return pmAt(city, t) * Math.exp(camsBias(city) + 0.2 * fbm(seed, t / 11, 2));
}

/**
 * Forecast series around an anchor time: `past` hours of observations followed by `horizon`
 * hours of forecast issued at `anchor`.
 */
export function forecastSeries(city: City, anchor: Hour, horizon: number, past = 12, step = 1): ForecastPoint[] {
  const out: ForecastPoint[] = [];
  const persistence = pmAt(city, anchor);
  for (let k = -past; k <= horizon; k += step) {
    const t = anchor + k;
    const w = weatherAt(city, t);
    if (k <= 0) {
      const truth = pmAt(city, t);
      out.push({
        t,
        lead: k,
        actual: truth,
        truth,
        pred: truth,
        p10: truth,
        p90: truth,
        cams: camsAt(city, t),
        persistence: truth,
        temp: w.temp,
        rh: w.rh,
        wind: w.wind,
      });
    } else {
      const p = predictAt(city, anchor, t);
      out.push({
        t,
        lead: k,
        actual: null,
        truth: p.truth,
        pred: p.pred,
        p10: p.p10,
        p90: p.p90,
        cams: camsAt(city, t),
        persistence,
        temp: w.temp,
        rh: w.rh,
        wind: w.wind,
      });
    }
  }
  return out;
}

/** Observed history (hourly) ending at `anchor`. */
export function history(city: City, anchor: Hour, hours: number, step = 1) {
  const out: { t: Hour; pm: number }[] = [];
  for (let k = -hours; k <= 0; k += step) out.push({ t: anchor + k, pm: pmAt(city, anchor + k) });
  return out;
}

/** Daily means for the last `days` days ending at anchor (sampled every 3 h). */
export function dailyMeans(city: City, anchor: Hour, days: number) {
  const out: { t: Hour; pm: number }[] = [];
  const dayStart = anchor - (anchor % 24);
  for (let d = days - 1; d >= 0; d--) {
    const t0 = dayStart - d * 24;
    let s = 0;
    for (let h = 0; h < 24; h += 3) s += pmAt(city, t0 + h);
    out.push({ t: t0, pm: s / 8 });
  }
  return out;
}

/** Backtest: what the model predicted `lead` hours earlier vs what happened, over `hours`. */
export function backtest(city: City, anchor: Hour, hours: number, lead = 24, step = 1) {
  const out: { t: Hour; actual: number; pred: number; cams: number; persistence: number }[] = [];
  for (let k = -hours; k <= 0; k += step) {
    const t = anchor + k;
    const issued = t - lead;
    const p = predictAt(city, issued, t);
    out.push({ t, actual: p.truth, pred: p.pred, cams: camsAt(city, t), persistence: pmAt(city, issued) });
  }
  return out;
}

export function errorStats(pairs: { actual: number; pred: number }[]) {
  const n = pairs.length || 1;
  let ae = 0;
  let se = 0;
  let mean = 0;
  for (const p of pairs) mean += p.actual;
  mean /= n;
  let ss = 0;
  for (const p of pairs) {
    const e = p.pred - p.actual;
    ae += Math.abs(e);
    se += e * e;
    ss += (p.actual - mean) ** 2;
  }
  return { mae: ae / n, rmse: Math.sqrt(se / n), r2: clamp(1 - se / Math.max(ss, 1e-9), -1, 1) };
}
