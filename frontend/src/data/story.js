import { parseClock, formatClock } from '../core/timeOfDay.js';

/**
 * The story's data-driven values — the [bracketed] words in the script.
 *
 * PLACEHOLDERS until the data is wired in. Each one names its source; replace the value (or
 * load it) and every line that uses it updates. Values the script gives a formula for are
 * derived below (ride), never typed in.
 */
export const story = {
  /** Highest-FRP upwind fire — fires.points: acquisition time (local). */
  fireTime: '1:42 PM',
  /** Nearest town to that fire. */
  firePlace: 'Sangrur',
  /** That fire's position — fires.points lat/lon. PLACEHOLDER: Sangrur town centre. */
  fireLat: 30.25,
  fireLon: 75.84,
  /** Detecting instrument — fires.points. */
  fireSensor: "NASA's VIIRS satellite",
  /** Daytime boundary-layer height, metres — source pblh. Used by step 1.4. */
  ceilingMetres: 1800,

  /** Wind along the path — wind_u / wind_v, hourly. Direction it blows FROM, in words. */
  windFrom: 'northwest',
  /** Mean wind speed along the path, m/s. */
  windMs: 3,
  /**
   * Path cities — the trajectory from today's winds, fire → destination, [name, lat, lon].
   * PLACEHOLDER: the Grand Trunk corridor, Sangrur → Delhi.
   */
  path: [
    ['Sangrur', 30.245, 75.844],
    ['Patiala', 30.34, 76.386],
    ['Rajpura', 30.484, 76.594],
    ['Ambala', 30.378, 76.777],
    ['Kurukshetra', 29.969, 76.878],
    ['Karnal', 29.686, 76.99],
    ['Panipat', 29.391, 76.964],
    ['Sonipat', 28.994, 77.019],
    ['Delhi', 28.614, 77.209],
  ],
  /** The first city the particle passes over (named in step 2.2). */
  passCity: 'Patiala',
  /** Cities whose haze domes merge with the destination's at the arrival. [name, lat, lon] */
  neighbours: [
    ['Gurugram', 28.459, 77.026],
    ['Noida', 28.535, 77.391],
    ['Ghaziabad', 28.669, 77.453],
    ['Faridabad', 28.408, 77.317],
  ],
  /** Destination city PM2.5 now, µg/m³ — city pm25 (the live number). */
  pm25: 184,

  /**
   * Tonight over the destination, hourly from sunset — [time, pblh m, pm25 µg/m³, wind m/s].
   * Sources: hourly pblh, pm25, wind. PLACEHOLDERS shaped like a calm winter night in Delhi.
   */
  night: [
    ['6 PM', 1500, 190, 2.4],
    ['7 PM', 1150, 228, 1.9],
    ['8 PM', 800, 285, 1.4],
    ['9 PM', 520, 352, 1.0],
    ['10 PM', 300, 418, 0.7],
    ['11 PM', 220, 468, 0.5],
    ['12 AM', 185, 505, 0.4],
    ['1 AM', 162, 531, 0.3],
    ['2 AM', 150, 548, 0.3],
  ],
  /** Qutub Minar, metres — the yardstick in step 3.3. */
  qutubMetres: 73,

  /**
   * The morning after — morning or forecast-peak hour pm25 from the series. PLACEHOLDER.
   * `kind` is how the corner reading labels it: 'Forecast' or 'Now'.
   */
  morning: { time: '6:10 AM', pm25: 462, kind: 'Forecast' },

  /** Destination's worst day — /api/history/{city}: max daily value and its date. PLACEHOLDER. */
  worstDay: { city: 'Delhi', year: 2024, date: '18 November 2024', pm25: 487 },

  /** Yesterday's fire count — fires.total; upwind of the destination — city fires_upwind. PLACEHOLDER. */
  fires: { total: 2314, upwindOf: { Delhi: 380 } },
};

/** 24-hour PM2.5 guideline (WHO, 2021) and standard (India, NAAQS), µg/m³. Fixed. */
export const LIMITS = { who: 15, india: 60 };

/** Particle sizes, micrometres — PM10 vs PM2.5 (the dots in step 4.2). */
export const SIZES = { pm10: 10, pm25: 2.5, redCell: 7.5 };

/** India's 24-hour PM2.5 standard (NAAQS), µg/m³. */
export const SAFE_LIMIT = 60;

/* ------------------------------------------------------------------ derived -- */

const R_EARTH = 6371;
const rad = (d) => (d * Math.PI) / 180;
function km([, la1, lo1], [, la2, lo2]) {
  const a = Math.sin(rad(la2 - la1) / 2) ** 2 + Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(rad(lo2 - lo1) / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(a));
}

/** India AQI category for a 24-hour PM2.5 value (CPCB breakpoints). */
export function pm25Category(v) {
  if (v <= 30) return 'Good';
  if (v <= 60) return 'Satisfactory';
  if (v <= 90) return 'Moderate';
  if (v <= 120) return 'Poor';
  if (v <= 250) return 'Very poor';
  return 'Severe';
}

const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

/** Everything Scene 3 says that is computed from the data above. */
export const ride = (() => {
  const { path, windMs, pm25, fireTime } = story;
  const legs = path.slice(1).map((p, i) => km(path[i], p));
  const pathKm = legs.reduce((a, b) => a + b, 0);
  const passIndex = Math.max(1, path.findIndex(([name]) => name === story.passCity));
  // Travel time = distance ÷ wind speed.
  const hours = Math.round(pathKm / (windMs * 3.6));
  const arrivalMinutes = parseClock(fireTime) + hours * 60;
  const times = pm25 / SAFE_LIMIT;
  const rounded = Math.round(times);
  return {
    pathKm,
    /** How far along the path (0..1) the city named in step 2.2 is. */
    passS: legs.slice(0, passIndex).reduce((a, b) => a + b, 0) / pathKm,
    hours,
    destination: path[path.length - 1][0],
    /** Whole days the clock runs past the fire's time-of-day (for scene.clock.days). */
    days: Math.floor((parseClock(fireTime) + hours * 60) / 1440),
    arrival: formatClock(arrivalMinutes),
    category: pm25Category(pm25),
    timesWord: rounded <= 10 ? WORDS[rounded] : String(rounded),
  };
})();

/** Everything Scene 4 says that comes from the night's data. */
export const trap = (() => {
  const { night, qutubMetres } = story;
  const first = night[0];
  const last = night[night.length - 1];
  const peak = Math.max(...night.map((h) => h[2]));
  const times = last[1] / qutubMetres;
  const whole = Math.round(times);
  const multiple = whole === 2 ? 'twice' : whole === 1 ? 'about' : `${WORDS[whole]?.toLowerCase() ?? whole} times`;
  return {
    startTime: first[0],
    endTime: last[0],
    ceilingStart: first[1],
    ceilingEnd: last[1],
    peak,
    /** "Barely twice the height of Qutub Minar." */
    qutubLine: whole <= 1 ? 'About the height of Qutub Minar.' : `${times < whole + 0.25 ? 'Barely' : 'About'} ${multiple} the height of Qutub Minar.`,
  };
})();

/** The night's values at a clock time (minutes since the first hour), interpolated hourly. */
export function nightAt(minutesSinceStart) {
  const { night } = story;
  const h = Math.min(night.length - 1, Math.max(0, minutesSinceStart / 60));
  const i = Math.min(night.length - 2, Math.floor(h));
  const t = h - i;
  // Smoothstep between hours so the ceiling eases rather than kinks on the hour.
  const e = t * t * (3 - 2 * t);
  const mix = (k) => night[i][k] + (night[i + 1][k] - night[i][k]) * e;
  return { pblh: mix(1), pm25: mix(2), wind: mix(3) };
}

/** 30.25 → "30.25°N" */
export const formatLat = (v) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? 'N' : 'S'}`;
export const formatLon = (v) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? 'E' : 'W'}`;
