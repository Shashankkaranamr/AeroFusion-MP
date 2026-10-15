import { NAAQS_PM25_24H } from "./aqi";
import { CITY_BY_SLUG } from "./cities";
import type { LiveCity, LiveSnapshot } from "./api";

export interface SeriesPoint {
  ms: number;
  lead: number; // hours relative to now (negative = past)
  pm25: number | null;
  pm10: number | null;
  aod: number | null;
  temp: number | null;
  rh: number | null;
  wind: number | null;
  wind_dir: number | null;
  pblh: number | null;
}

/** Hourly CAMS + weather series for a city with lead hours relative to `nowMs`. */
export function citySeries(c: LiveCity, nowMs = Date.now()): SeriesPoint[] {
  const s = c.series;
  if (!s?.time) return [];
  return s.time.map((t, i) => {
    const ms = Date.parse(t);
    return {
      ms,
      lead: Math.round((ms - nowMs) / 3_600_000),
      pm25: s.pm25[i] ?? null,
      pm10: s.pm10[i] ?? null,
      aod: s.aod[i] ?? null,
      temp: s.temp[i] ?? null,
      rh: s.rh[i] ?? null,
      wind: s.wind[i] ?? null,
      wind_dir: s.wind_dir[i] ?? null,
      pblh: s.pblh[i] ?? null,
    };
  });
}

export function window(points: SeriesPoint[], from: number, to: number) {
  return points.filter((p) => p.lead >= from && p.lead <= to);
}

export function at(points: SeriesPoint[], lead: number) {
  return points.reduce<SeriesPoint | null>((best, p) => (best === null || Math.abs(p.lead - lead) < Math.abs(best.lead - lead) ? p : best), null);
}

export function peak(points: SeriesPoint[]) {
  return points.reduce<SeriesPoint | null>((m, p) => (p.pm25 !== null && (m === null || (m.pm25 ?? -1) < p.pm25) ? p : m), null);
}

export function mean(xs: (number | null | undefined)[]) {
  const v = xs.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function national(snap: LiveSnapshot) {
  const cities = snap.cities.filter((c) => c.pm25 !== null);
  const avg = mean(cities.map((c) => c.pm25)) ?? 0;
  const prevAvg = mean(cities.map((c) => c.pm25_24h[0])) ?? avg;
  const above = cities.filter((c) => (c.pm25 ?? 0) > NAAQS_PM25_24H);
  const pop = (slug: string) => CITY_BY_SLUG[slug]?.pop ?? 0;
  return {
    avg,
    change24: prevAvg ? ((avg - prevAvg) / prevAvg) * 100 : 0,
    aboveNaaqs: above.length,
    exposedM: above.reduce((s, c) => s + pop(c.slug), 0),
    popTotal: cities.reduce((s, c) => s + pop(c.slug), 0),
    sorted: [...cities].sort((a, b) => (b.pm25 ?? 0) - (a.pm25 ?? 0)),
    count: cities.length,
  };
}

/** Spearman rank correlation (robust to outliers, fine for 33 cities). */
export function spearman(xs: (number | null)[], ys: (number | null)[]) {
  const pairs = xs.map((x, i) => [x, ys[i]] as const).filter((p): p is readonly [number, number] => p[0] !== null && p[1] !== null);
  if (pairs.length < 5) return null;
  const rank = (arr: number[]) => {
    const idx = arr.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
    const r = new Array(arr.length);
    idx.forEach(([, i], k) => (r[i] = k + 1));
    return r as number[];
  };
  const rx = rank(pairs.map((p) => p[0]));
  const ry = rank(pairs.map((p) => p[1]));
  const n = pairs.length;
  const mx = (n + 1) / 2;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (rx[i] - mx) * (ry[i] - mx);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - mx) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}

export function fmtIst(ms: number, opts: Intl.DateTimeFormatOptions = { hour: "numeric", hour12: true }) {
  return new Intl.DateTimeFormat("en-IN", { ...opts, timeZone: "Asia/Kolkata" }).format(new Date(ms)).replace(/\s?(am|pm)/i, (m) => " " + m.trim().toUpperCase());
}

export function compass(deg: number | null) {
  if (deg === null) return "—";
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];
}

/** Ventilation index (m²/s) = wind speed × boundary-layer height. < 6000 is poor dispersion. */
export function ventilation(p: Pick<SeriesPoint, "wind" | "pblh">) {
  return p.wind !== null && p.pblh !== null ? p.wind * p.pblh : null;
}

/** Cleanest and dirtiest `len`-hour windows in a series. */
export function bestWindow(points: SeriesPoint[], len = 3) {
  type W = { start: SeriesPoint; end: SeriesPoint; mean: number };
  let best: W | null = null;
  let worst: W | null = null;
  for (let i = 0; i + len <= points.length; i++) {
    const chunk = points.slice(i, i + len);
    const m = mean(chunk.map((p) => p.pm25));
    if (m === null) continue;
    const w = { start: chunk[0], end: chunk[len - 1], mean: m };
    if (!best || m < best.mean) best = w;
    if (!worst || m > worst.mean) worst = w;
  }
  return { best: best as W | null, worst: worst as W | null };
}

export interface LiveInsight {
  tone: "up" | "down" | "warn" | "info";
  title: string;
  body: string;
}

/** Plain-language insights computed only from the live CAMS / Open-Meteo / FIRMS / CPCB values. */
export function liveInsights(c: LiveCity, pts: SeriesPoint[]): LiveInsight[] {
  const out: LiveInsight[] = [];
  const now = at(pts, 0);
  const next = window(pts, 1, 24);
  const pk = peak(next);
  const nowPm = now?.pm25 ?? c.pm25 ?? 0;
  if (pk?.pm25 != null) {
    const d = pk.pm25 - nowPm;
    out.push({
      tone: d > 10 ? "up" : d < -10 ? "down" : "info",
      title: d > 10 ? `Rising to ${Math.round(pk.pm25)} µg/m³ by ${fmtIst(pk.ms)}` : d < -10 ? "Improving over the next day" : "Broadly steady next 24 h",
      body: `CAMS expects a 24-h peak of ${Math.round(pk.pm25)} µg/m³ (${pk.lead} h from now) against ${Math.round(nowPm)} µg/m³ now.`,
    });
  }
  const vents = next.map(ventilation).filter((v): v is number => v !== null);
  const poorHours = vents.filter((v) => v < 6000).length;
  if (vents.length) {
    out.push({
      tone: poorHours > 12 ? "warn" : poorHours > 4 ? "info" : "down",
      title: poorHours ? `${poorHours} h of poor ventilation ahead` : "Good dispersion conditions",
      body: `Wind × mixing height stays below 6,000 m²/s for ${poorHours} of the next ${vents.length} hours, so pollutants ${poorHours > 8 ? "accumulate near the ground, mostly overnight" : "disperse reasonably well"}.`,
    });
  }
  if ((c.fires_upwind ?? 0) > 0) {
    out.push({
      tone: (c.fires_upwind ?? 0) > 20 ? "warn" : "info",
      title: `${c.fires_upwind} active fires upwind`,
      body: `NASA FIRMS sees ${c.fires_300km ?? 0} fires within 300 km (${Math.round(c.frp_300km ?? 0)} MW total FRP), ${c.fires_upwind} of them upwind of the city.`,
    });
  }
  if (c.cpcb) {
    const r = nowPm / c.cpcb.pm25_mean;
    out.push({
      tone: "info",
      title: r > 1.15 ? "Above the same month last year" : r < 0.85 ? "Below the same month last year" : "In line with last year",
      body: `CPCB monitors averaged ${Math.round(c.cpcb.pm25_mean)} µg/m³ in ${fmtPeriod(c.cpcb.period)} (${c.cpcb.stations} stations). CAMS has ${Math.round(nowPm)} µg/m³ now.`,
    });
  }
  return out.slice(0, 4);
}

const RAD = Math.PI / 180;

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function bearingDeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const y = Math.sin((b.lon - a.lon) * RAD) * Math.cos(b.lat * RAD);
  const x = Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) - Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lon - a.lon) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/**
 * Directed transport graph from live winds: edge i→j = distance kernel × how well the wind at i
 * points at j × wind-speed factor. This is the physical prior the graph module will learn from.
 */
export function windGraph(cities: LiveCity[], sigmaKm = 350, maxKm = 900) {
  const n = cities.length;
  const W: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const edges: { from: LiveCity; to: LiveCity; w: number; km: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = cities[i];
    if (a.wind === null || a.wind_dir === null) continue;
    const toward = (a.wind_dir + 180) % 360;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const b = cities[j];
      const km = haversineKm(a, b);
      if (km > maxKm) continue;
      const align = Math.cos((bearingDeg(a, b) - toward) * RAD);
      if (align <= 0) continue;
      const w = Math.exp(-((km / sigmaKm) ** 2)) * align * (a.wind / (a.wind + 2));
      W[i][j] = w;
      if (w > 0.02) edges.push({ from: a, to: b, w, km });
    }
  }
  edges.sort((x, y) => y.w - x.w);
  return { W, edges };
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2024-10-01…2024-10-31" or "2024-10" → "Oct 2024" */
export function fmtPeriod(p: string) {
  const [y, m] = p.slice(0, 7).split("-");
  return `${MON[Number(m) - 1] ?? m} ${y}`;
}

export interface CityHistory {
  city: string;
  months: { month: string; pm25: number; stations: number }[];
  days: { date: string; pm25: number; stations: number }[];
  stations: string[];
}

export interface AllHistory {
  years: number[];
  stations: number;
  cities: Record<string, { month: string; pm25: number; stations: number }[]>;
}
