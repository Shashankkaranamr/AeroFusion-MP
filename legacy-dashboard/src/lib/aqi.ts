import { scaleLinear } from "d3-scale";

/**
 * India National Air Quality Index (CPCB) — PM2.5 (24-h) breakpoints.
 * https://cpcb.nic.in/national-air-quality-index/
 */
export type AqiKey = "good" | "satisfactory" | "moderate" | "poor" | "veryPoor" | "severe";

export interface AqiCategory {
  key: AqiKey;
  label: string;
  short: string;
  pm: [number, number];
  aqi: [number, number];
  color: string;
  /** Darker shade for text on light tinted backgrounds. */
  ink: string;
  impact: string;
  advice: string[];
}

export const AQI_CATEGORIES: AqiCategory[] = [
  {
    key: "good",
    label: "Good",
    short: "Good",
    pm: [0, 30],
    aqi: [0, 50],
    color: "#10b981",
    ink: "#047857",
    impact: "Minimal impact.",
    advice: ["Great time for outdoor exercise", "Ventilate your home", "No precautions needed"],
  },
  {
    key: "satisfactory",
    label: "Satisfactory",
    short: "Satisf.",
    pm: [30, 60],
    aqi: [50, 100],
    color: "#84cc16",
    ink: "#4d7c0f",
    impact: "Minor breathing discomfort for sensitive people.",
    advice: [
      "Outdoor activity is fine for most people",
      "Sensitive groups: watch for symptoms",
      "Prefer parks over traffic corridors",
    ],
  },
  {
    key: "moderate",
    label: "Moderate",
    short: "Moderate",
    pm: [60, 90],
    aqi: [100, 200],
    color: "#eab308",
    ink: "#a16207",
    impact: "Breathing discomfort for people with lung or heart disease, children and older adults.",
    advice: [
      "Reduce prolonged outdoor exertion",
      "Children & elderly: limit time outside",
      "Keep reliever inhalers handy",
      "Avoid jogging near busy roads",
    ],
  },
  {
    key: "poor",
    label: "Poor",
    short: "Poor",
    pm: [90, 120],
    aqi: [200, 300],
    color: "#f97316",
    ink: "#c2410c",
    impact: "Breathing discomfort for most people on prolonged exposure.",
    advice: [
      "Wear an N95 mask outdoors",
      "Avoid outdoor exercise",
      "Keep windows closed during peak hours",
      "Run an air purifier indoors",
    ],
  },
  {
    key: "veryPoor",
    label: "Very Poor",
    short: "V. Poor",
    pm: [120, 250],
    aqi: [300, 400],
    color: "#ef4444",
    ink: "#b91c1c",
    impact: "Respiratory illness on prolonged exposure.",
    advice: [
      "Stay indoors as much as possible",
      "N95 / FFP2 mask if you must go out",
      "Use air purifiers; seal gaps in windows",
      "Elderly, children & patients: avoid all exertion",
    ],
  },
  {
    key: "severe",
    label: "Severe",
    short: "Severe",
    pm: [250, 500],
    aqi: [400, 500],
    color: "#a21caf",
    ink: "#86198f",
    impact: "Affects healthy people; serious impact on those with existing diseases.",
    advice: [
      "Avoid going outside entirely",
      "Schools & outdoor events should pause",
      "Seek medical help for breathing difficulty",
      "Follow GRAP emergency advisories",
    ],
  },
];

export function categoryForPm(pm: number): AqiCategory {
  for (const c of AQI_CATEGORIES) if (pm <= c.pm[1]) return c;
  return AQI_CATEGORIES[AQI_CATEGORIES.length - 1];
}

export function categoryForAqi(aqi: number): AqiCategory {
  for (const c of AQI_CATEGORIES) if (aqi <= c.aqi[1]) return c;
  return AQI_CATEGORIES[AQI_CATEGORIES.length - 1];
}

/** PM2.5 concentration (µg/m³) → CPCB sub-index (0–500) by linear interpolation. */
export function pmToAqi(pm: number): number {
  const p = Math.max(0, pm);
  const bps: [number, number, number, number][] = [
    [0, 30, 0, 50],
    [30, 60, 50, 100],
    [60, 90, 100, 200],
    [90, 120, 200, 300],
    [120, 250, 300, 400],
    [250, 380, 400, 500],
  ];
  for (const [cl, ch, il, ih] of bps) {
    if (p <= ch) return Math.round(il + ((ih - il) * (p - cl)) / (ch - cl));
  }
  return 500;
}

/** Continuous colour scale for heat maps (PM2.5 µg/m³). */
const heatScale = scaleLinear<string>()
  .domain([0, 30, 60, 90, 120, 200, 300])
  .range(["#10b981", "#84cc16", "#eab308", "#f97316", "#ef4444", "#be123c", "#7e22ce"])
  .clamp(true);

export function pmColor(pm: number): string {
  return heatScale(pm);
}

/** RGB triple for canvas work. */
export function pmRgb(pm: number): [number, number, number] {
  const c = heatScale(pm);
  const m = c.match(/\d+/g);
  if (!m) return [0, 0, 0];
  return [Number(m[0]), Number(m[1]), Number(m[2])];
}

export const WHO_PM25_24H = 15;
export const NAAQS_PM25_24H = 60;
