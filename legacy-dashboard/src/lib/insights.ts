import { categoryForPm } from "./aqi";
import type { City } from "./cities";
import { fmtHour } from "./format";
import { weatherAt, type Hour } from "./sim/core";
import { attribution, FEATURE_BY_KEY, type FeatureKey } from "./sim/explain";
import type { ForecastPoint } from "./sim/forecast";

export interface Insight {
  tone: "up" | "down" | "info" | "warn";
  title: string;
  body: string;
}

/** Template-generated, data-grounded insights (no LLM): every number comes from the forecast/attribution. */
export function forecastInsights(city: City, anchor: Hour, series: ForecastPoint[]): Insight[] {
  const future = series.filter((p) => p.lead > 0);
  const now = series.find((p) => p.lead === 0);
  if (!now || future.length === 0) return [];
  const out: Insight[] = [];
  const at6 = future.find((p) => p.lead === 6) ?? future[Math.min(5, future.length - 1)];
  const change6 = ((at6.pred - now.truth) / now.truth) * 100;
  const a6 = attribution(city, at6.t);
  const a0 = attribution(city, anchor);
  // Static/slow features (inventories, season) can't explain an hour-scale change — rank dynamic drivers only.
  const dynamic = (Object.keys(a6.values) as FeatureKey[]).filter((k) => !["roads", "industry", "landuse", "season"].includes(k));
  const deltas = dynamic.map((k) => [k, a6.values[k] - a0.values[k]] as [FeatureKey, number]);
  const drivers = deltas.sort((x, y) => (change6 >= 0 ? y[1] - x[1] : x[1] - y[1]));
  const d1 = FEATURE_BY_KEY[drivers[0][0]].short.toLowerCase();
  const d2 = FEATURE_BY_KEY[drivers[1][0]].short.toLowerCase();
  const w = weatherAt(city, at6.t);
  out.push({
    tone: change6 >= 0 ? "up" : "down",
    title: `PM2.5 expected to ${change6 >= 0 ? "rise" : "ease"} ${Math.abs(change6).toFixed(0)}% in the next 6 hours`,
    body: `Driven mainly by ${d1} and ${d2}; wind ${w.wind.toFixed(1)} m/s, humidity ${Math.round(w.rh)}%.`,
  });

  const day = future.filter((p) => p.lead <= 24);
  const peak = day.reduce((m, p) => (p.pred > m.pred ? p : m), day[0]);
  const low = day.reduce((m, p) => (p.pred < m.pred ? p : m), day[0]);
  out.push({
    tone: categoryForPm(peak.pred).key === "good" || categoryForPm(peak.pred).key === "satisfactory" ? "info" : "warn",
    title: `Peak of ${Math.round(peak.pred)} µg/m³ around ${fmtHour(peak.t)}`,
    body: `Cleanest hour is ${fmtHour(low.t)} at ~${Math.round(low.pred)} µg/m³ — plan outdoor activity then.`,
  });

  const mean24 = day.reduce((s, p) => s + p.pred, 0) / day.length;
  const cat = categoryForPm(mean24);
  const spread = day.reduce((s, p) => s + (p.p90 - p.p10), 0) / day.length;
  out.push({
    tone: "info",
    title: `24-hour outlook: ${cat.label}`,
    body: `Mean ${Math.round(mean24)} µg/m³ with a typical P10–P90 spread of ±${Math.round(spread / 2)} µg/m³.`,
  });
  return out;
}

/** Find the cleanest contiguous window of `len` hours in the next 24 h. */
export function bestWindow(series: ForecastPoint[], len = 3) {
  const f = series.filter((p) => p.lead > 0 && p.lead <= 24);
  let best = { start: f[0], end: f[Math.min(len - 1, f.length - 1)], mean: Infinity };
  let worst = { start: f[0], end: f[Math.min(len - 1, f.length - 1)], mean: -Infinity };
  for (let i = 0; i + len <= f.length; i++) {
    const m = f.slice(i, i + len).reduce((s, p) => s + p.pred, 0) / len;
    if (m < best.mean) best = { start: f[i], end: f[i + len - 1], mean: m };
    if (m > worst.mean) worst = { start: f[i], end: f[i + len - 1], mean: m };
  }
  return { best, worst };
}
