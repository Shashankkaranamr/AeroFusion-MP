/**
 * AeroFusion demo simulator.
 *
 * Generates deterministic, physically-plausible PM2.5 + weather series for the UI while the
 * real MW-AeroFusion-Net model is being trained. Every value produced here is SIMULATED and the
 * UI labels it as such. Swap to the FastAPI backend (NEXT_PUBLIC_API_URL) for model outputs.
 */
import { CITIES, type City, type Region } from "../cities";
import { fbm, hash2, hashString, mulberry32 } from "../rng";
import { clamp, haversineKm } from "../utils";

export const HOUR_MS = 3_600_000;
/** Hours since the Unix epoch (UTC). */
export type Hour = number;

export const nowHour = (): Hour => Math.floor(Date.now() / HOUR_MS);
export const hourToDate = (t: Hour) => new Date(t * HOUR_MS);

const IST = 5.5;

/** Local (IST) clock hour 0–23.5. */
export function istHour(t: Hour): number {
  return (((t + IST) % 24) + 24) % 24;
}

/** Fractional day-of-year in IST. */
export function dayOfYear(t: Hour): number {
  const ms = (t + IST) * HOUR_MS;
  const d = new Date(ms);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return (ms - start) / 86_400_000;
}

/** 0 = Sunday … 6 = Saturday, IST. */
export function istWeekday(t: Hour): number {
  return new Date((t + IST) * HOUR_MS).getUTCDay();
}

// ───────────────────────── Seasonality ─────────────────────────

const MONTH_MID = [15, 45, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];
/** North-Indian PM2.5 seasonal multipliers (Jan…Dec). */
const SEASON_N = [1.75, 1.35, 1.0, 0.85, 0.8, 0.6, 0.38, 0.36, 0.48, 1.0, 2.0, 1.8];

const SEASON_DAMP: Record<Region, number> = {
  nw: 1,
  north: 1,
  east: 0.9,
  northeast: 0.7,
  west: 0.72,
  central: 0.8,
  south: 0.42,
  hill: 0.75,
};

function seasonalN(doy: number): number {
  for (let i = 0; i < 12; i++) {
    const a = MONTH_MID[i];
    const b = i === 11 ? MONTH_MID[0] + 365 : MONTH_MID[i + 1];
    const d = doy < MONTH_MID[0] ? doy + 365 : doy;
    if (d >= a && d < b) {
      const f = (d - a) / (b - a);
      const u = f * f * (3 - 2 * f);
      return SEASON_N[i] + (SEASON_N[(i + 1) % 12] - SEASON_N[i]) * u;
    }
  }
  return 1;
}

export function seasonFactor(city: City, doy: number): number {
  const damp = city.coastal ? Math.min(SEASON_DAMP[city.region], 0.55) : SEASON_DAMP[city.region];
  return 1 + (seasonalN(doy) - 1) * damp;
}

/** Winter-ness 0…1 (peaks around early January). */
export function winterness(doy: number) {
  return 0.5 + 0.5 * Math.cos((2 * Math.PI * (doy - 5)) / 365);
}

// ───────────────────────── Diurnal ─────────────────────────

const DIURNAL = [
  1.18, 1.22, 1.25, 1.26, 1.25, 1.22, 1.18, 1.12, 1.04, 0.95, 0.86, 0.79, 0.74, 0.71, 0.7, 0.72, 0.77, 0.85, 0.96,
  1.06, 1.12, 1.15, 1.16, 1.17,
];

export function diurnalFactor(hour: number, doy: number): number {
  const i = Math.floor(hour) % 24;
  const f = hour - Math.floor(hour);
  const base = DIURNAL[i] + (DIURNAL[(i + 1) % 24] - DIURNAL[i]) * f;
  const amp = 0.75 + 0.5 * winterness(doy);
  return 1 + (base - 1) * amp;
}

/** Share of the diurnal swing attributed to traffic (rush-hour bumps). */
export function trafficSignal(hour: number, weekday: number): number {
  const am = Math.exp(-0.5 * ((hour - 9) / 1.4) ** 2);
  const pm = Math.exp(-0.5 * ((hour - 19.5) / 1.8) ** 2);
  const wk = weekday === 0 ? 0.6 : weekday === 6 ? 0.85 : 1;
  return (0.8 * am + pm) * wk;
}

// ───────────────────────── Weather regimes (spatially smooth) ─────────────────────────

const REGIME_CENTERS = [
  { lat: 30.2, lon: 75.8, seed: 101 },
  { lat: 26.8, lon: 80.6, seed: 202 },
  { lat: 24.6, lon: 86.4, seed: 303 },
  { lat: 23.4, lon: 72.8, seed: 404 },
  { lat: 21.8, lon: 79.6, seed: 505 },
  { lat: 14.6, lon: 78.2, seed: 606 },
  { lat: 26.2, lon: 92.4, seed: 707 },
  { lat: 33.6, lon: 75.2, seed: 808 },
];

/** Synoptic regime in ~[-1, 1]: + = stagnant air (high PM, low wind), − = ventilated. */
export function regime(lat: number, lon: number, t: Hour): number {
  let acc = 0;
  let wsum = 0;
  for (const c of REGIME_CENTERS) {
    const d = haversineKm(lat, lon, c.lat, c.lon);
    const w = Math.exp(-((d / 520) ** 2));
    acc += w * fbm(c.seed, t / 41 + c.seed * 0.37, 3);
    wsum += w;
  }
  const national = fbm(999, t / 96, 2);
  return clamp((acc / Math.max(wsum, 1e-6)) * 1.25 + national * 0.35, -1.2, 1.2);
}

const citySeed = (c: City) => hashString(c.slug);

// ───────────────────────── Fires (NASA FIRMS-like) ─────────────────────────

/** Relative crop-residue burning intensity 0…1 by day-of-year (kharif peak ≈ early Nov, rabi ≈ late Apr). */
export function fireSeason(doy: number): number {
  return Math.exp(-0.5 * ((doy - 309) / 13) ** 2) + 0.35 * Math.exp(-0.5 * ((doy - 118) / 11) ** 2);
}

const PUNJAB = { lat: 30.6, lon: 75.4 };

export function upwindFireExposure(city: City): number {
  const d = haversineKm(city.lat, city.lon, PUNJAB.lat, PUNJAB.lon);
  const igp = city.lat > 23 && city.lon < 88.5;
  return igp ? Math.exp(-d / 380) : 0.25 * Math.exp(-d / 250);
}

/** Fire-driven PM2.5 increment (µg/m³). */
export function fireTerm(city: City, t: Hour): number {
  const doy = dayOfYear(t);
  const season = fireSeason(doy);
  if (season < 0.01) return 0;
  const pulse = 0.55 + 0.45 * ((fbm(777, t / 18, 2) + 1) / 2);
  // Transport only when winds blow from the north-west; regime adds variability.
  const transport = 0.65 + 0.35 * Math.sin((2 * Math.PI * (t + 7)) / 61);
  return 135 * season * upwindFireExposure(city) * pulse * transport;
}

export interface FireHotspot {
  id: string;
  lat: number;
  lon: number;
  frp: number;
  confidence: "high" | "nominal" | "low";
  region: string;
}

const FIRE_BOXES = [
  { region: "Punjab", lat: [29.8, 32.0], lon: [74.6, 76.9], w: 0.5, seasonal: true },
  { region: "Haryana", lat: [28.6, 30.6], lon: [75.0, 77.4], w: 0.22, seasonal: true },
  { region: "Madhya Pradesh", lat: [21.5, 25.5], lon: [75.5, 81.5], w: 0.1, seasonal: false },
  { region: "Chhattisgarh", lat: [18.5, 23.0], lon: [80.5, 84.0], w: 0.07, seasonal: false },
  { region: "Odisha", lat: [19.0, 22.0], lon: [83.0, 86.5], w: 0.06, seasonal: false },
  { region: "Assam", lat: [24.5, 27.2], lon: [90.5, 94.5], w: 0.05, seasonal: false },
] as const;

/** Active fire detections for the IST day containing `t`. Deterministic per day. */
export function fireHotspots(t: Hour, max = 420): { total: number; points: FireHotspot[] } {
  const dayIndex = Math.floor((t + IST) / 24);
  const doy = dayOfYear(t);
  const season = fireSeason(doy);
  const rnd = mulberry32(dayIndex * 7919 + 13);
  const spring = Math.exp(-0.5 * ((doy - 105) / 28) ** 2); // central-India forest fires, Mar–May
  const total = Math.round(2400 * season + 60 + 260 * spring + 50 * rnd());
  const n = Math.min(total, max);
  const pts: FireHotspot[] = [];
  const seasonalShare = clamp(season * 4, 0.12, 0.92);
  for (let i = 0; i < n; i++) {
    const useSeasonal = rnd() < seasonalShare;
    const pool = FIRE_BOXES.filter((b) => b.seasonal === useSeasonal);
    const wsum = pool.reduce((s, b) => s + b.w, 0);
    let r = rnd() * wsum;
    let box: (typeof FIRE_BOXES)[number] = pool[0];
    for (const b of pool) {
      r -= b.w;
      if (r <= 0) {
        box = b;
        break;
      }
    }
    // Cluster points a little so they look like burning districts.
    const cx = box.lat[0] + (box.lat[1] - box.lat[0]) * (0.5 + 0.5 * (rnd() - 0.5) + 0.25 * (rnd() - 0.5));
    const cy = box.lon[0] + (box.lon[1] - box.lon[0]) * rnd();
    const conf = rnd();
    pts.push({
      id: `${dayIndex}-${i}`,
      lat: cx,
      lon: cy,
      frp: Math.round(4 + rnd() ** 2 * 60),
      confidence: conf > 0.55 ? "high" : conf > 0.18 ? "nominal" : "low",
      region: box.region,
    });
  }
  return { total, points: pts };
}

// ───────────────────────── PM2.5 truth ─────────────────────────

export interface PmComponents {
  base: number;
  season: number;
  diurnal: number;
  regime: number;
  local: number;
  weekly: number;
  fire: number;
  core: number;
  pm: number;
}

export function pmComponents(city: City, t: Hour): PmComponents {
  const doy = dayOfYear(t);
  const h = istHour(t);
  const s = citySeed(city);
  const season = seasonFactor(city, doy);
  const diurnal = diurnalFactor(h, doy);
  const R = regime(city.lat, city.lon, t);
  const C = fbm(s, t / 8.5, 3);
  const weekday = istWeekday(t);
  const weekly = weekday === 0 ? 0.93 : weekday === 6 ? 0.97 : 1.0;
  const coastalVent = city.coastal ? 0.86 : 1;
  const regimeMul = Math.exp(0.42 * R);
  const localMul = Math.exp(0.15 * C);
  const core = city.base * season * diurnal * regimeMul * localMul * weekly * coastalVent;
  const fire = fireTerm(city, t);
  const spike = Math.max(0, fbm(s + 31, t / 2.2, 2) - 0.55) * 60 * season; // short events (festivals, local fires)
  const pm = Math.max(3, core + fire + spike);
  return { base: city.base, season, diurnal, regime: R, local: C, weekly, fire: fire + spike, core, pm };
}

export const pmAt = (city: City, t: Hour) => pmComponents(city, t).pm;

// ───────────────────────── Weather ─────────────────────────

/** Normalised monthly temperature anomaly (north-Indian shape; minimum mid-Jan, maximum early June). */
const TEMP_SHAPE = [-1.05, -0.76, -0.19, 0.38, 0.76, 0.86, 0.57, 0.48, 0.38, 0.1, -0.48, -0.95];

function tempShape(doy: number): number {
  for (let i = 0; i < 12; i++) {
    const a = MONTH_MID[i];
    const b = i === 11 ? MONTH_MID[0] + 365 : MONTH_MID[i + 1];
    const d = doy < MONTH_MID[0] ? doy + 365 : doy;
    if (d >= a && d < b) {
      const f = (d - a) / (b - a);
      return TEMP_SHAPE[i] + (TEMP_SHAPE[(i + 1) % 12] - TEMP_SHAPE[i]) * f;
    }
  }
  return 0;
}

export interface Weather {
  temp: number;
  rh: number;
  wind: number;
  /** Direction wind blows FROM, degrees clockwise from north. */
  windDir: number;
  pblh: number;
}

export function weatherAt(city: City, t: Hour): Weather {
  const doy = dayOfYear(t);
  const h = istHour(t);
  const s = citySeed(city);
  const R = regime(city.lat, city.lon, t);
  const lat = city.lat;
  const tAnn = 33 - 0.4 * (lat - 8) + city.elev;
  const amp = (1.5 + 0.45 * Math.max(0, lat - 8)) * (city.coastal ? 0.45 : 1);
  const diurnalAmp = city.coastal ? 3 : city.region === "west" ? 6.5 : 5;
  const temp =
    tAnn +
    amp * tempShape(doy) +
    diurnalAmp * Math.cos((2 * Math.PI * (h - 15)) / 24) +
    1.3 * fbm(s + 5, t / 30, 2);

  const monsoon = Math.exp(-0.5 * ((doy - 210) / 42) ** 2);
  const rh = clamp(
    48 + 32 * monsoon + (city.coastal ? 16 : 0) - (city.region === "west" ? 10 : 0) - 13 * Math.cos((2 * Math.PI * (h - 15)) / 24) + 9 * R + 5 * fbm(s + 9, t / 12, 2),
    12,
    98,
  );

  const wind = clamp(
    1.0 + 2.5 * (1 - (R + 1) / 2) + (city.coastal ? 1.5 : 0) + 0.6 * fbm(s + 17, t / 7, 2) + 0.8 * Math.cos((2 * Math.PI * (h - 14)) / 24),
    0.3,
    12,
  );

  const monsoonW = clamp((monsoon - 0.2) * 1.4, 0, 1);
  const north = lat > 21;
  const prevailing = north ? 300 : 65;
  const dir = prevailing * (1 - monsoonW) + 230 * monsoonW + 28 * fbm(s + 23, t / 20, 2);

  const pblh = clamp(
    350 + 900 * Math.max(0, Math.cos((2 * Math.PI * (h - 14)) / 24)) * (1 - 0.45 * winterness(doy)) + 180 * (1 - R),
    120,
    2600,
  );
  return { temp, rh, wind, windDir: ((dir % 360) + 360) % 360, pblh };
}

// ───────────────────────── Wind field over India (for particles) ─────────────────────────

/** Unit-ish wind vector (u east, v north) in m/s at lat/lon. */
export function windVector(lat: number, lon: number, t: Hour): [number, number] {
  const doy = dayOfYear(t);
  const monsoon = clamp((Math.exp(-0.5 * ((doy - 210) / 42) ** 2) - 0.2) * 1.4, 0, 1);
  const R = regime(lat, lon, t);
  const speed = 1.2 + 2.6 * (1 - (R + 1) / 2);
  // Post-monsoon / winter: NW flow down the Indo-Gangetic plain, NE over the peninsula.
  const north = clamp((lat - 19) / 6, 0, 1);
  const igpAngle = 300 + 8 * Math.sin((lon - 75) / 5);
  const peninsulaAngle = 50 + 20 * Math.sin((lat - 12) / 3);
  let fromDeg = igpAngle * north + peninsulaAngle * (1 - north);
  fromDeg = fromDeg * (1 - monsoon) + 225 * monsoon;
  fromDeg += 30 * fbm(4242, t / 30 + lat * 0.15 + lon * 0.11, 2);
  const toRad = ((fromDeg + 180) * Math.PI) / 180;
  return [Math.sin(toRad) * speed, Math.cos(toRad) * speed];
}

// ───────────────────────── Convenience ─────────────────────────

export function allCitiesAt(t: Hour) {
  return CITIES.map((city) => {
    const c = pmComponents(city, t);
    return { city, pm: c.pm, comp: c, weather: weatherAt(city, t) };
  });
}

export { hash2 };
