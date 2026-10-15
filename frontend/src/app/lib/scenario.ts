import type { LiveCity } from "./api";
import { categoryForPm, NAAQS_PM25_24H, pmToAqi } from "./aqi";
import { CITY_BY_SLUG } from "./cities";
import { citySeries, mean, window } from "./live";

export interface ScenarioInput {
  vehicles: number; // % change, −100…+100
  industry: number;
  construction: number;
  cropBurning: number;
  wind: number; // Δ m/s
  temperature: number; // Δ °C
  humidity: number; // Δ %RH
}

export const ZERO_SCENARIO: ScenarioInput = { vehicles: 0, industry: 0, construction: 0, cropBurning: 0, wind: 0, temperature: 0, humidity: 0 };

/** Approximate sector shares of the local (non-fire) urban PM2.5 burden, from published Indian source-apportionment studies. */
export const SECTOR_SHARE = { vehicles: 0.27, industry: 0.22, construction: 0.17, other: 0.34 };

export const PRESETS: { id: string; label: string; description: string; input: ScenarioInput }[] = [
  { id: "transport", label: "Cleaner transport", description: "EV push + odd-even: vehicles −40%, road dust −10%", input: { ...ZERO_SCENARIO, vehicles: -40, construction: -10 } },
  { id: "industry", label: "Industrial control", description: "Stack controls & fuel switch: industry −50%", input: { ...ZERO_SCENARIO, industry: -50 } },
  { id: "stubble", label: "No stubble burning", description: "Crop-residue fires −100%", input: { ...ZERO_SCENARIO, cropBurning: -100 } },
  { id: "weather", label: "Favourable weather", description: "Stronger winds (+2 m/s), warmer surface (+2 °C)", input: { ...ZERO_SCENARIO, wind: 2, temperature: 2 } },
  { id: "grap3", label: "GRAP Stage III", description: "Construction ban, BS-III/IV restrictions, industry curbs", input: { ...ZERO_SCENARIO, vehicles: -30, industry: -30, construction: -60, cropBurning: -40 } },
];

/** Share of PM2.5 attributed to upwind fires: a saturating function of the live NASA FIRMS upwind count. */
export function fireShare(c: LiveCity) {
  const n = c.fires_upwind ?? 0;
  return Math.min(0.4, n / (n + 60));
}

function multipliers(s: ScenarioInput) {
  const emission = 1 + SECTOR_SHARE.vehicles * (s.vehicles / 100) + SECTOR_SHARE.industry * (s.industry / 100) + SECTOR_SHARE.construction * (s.construction / 100);
  const met = Math.exp(-0.16 * s.wind) * Math.exp(-0.03 * s.temperature) * Math.exp(0.004 * s.humidity);
  return { emission: Math.max(0.05, emission), met, fire: Math.max(0, 1 + s.cropBurning / 100) };
}

/** Sensitivity scenario on top of the live CAMS forecast for one city. */
export function runScenario(c: LiveCity, nowMs: number, horizon: number, s: ScenarioInput) {
  const m = multipliers(s);
  const fs = fireShare(c);
  const factor = ((1 - fs) * m.emission + fs * m.fire) * m.met;
  const series = window(citySeries(c, nowMs), 0, horizon)
    .filter((p) => p.pm25 !== null)
    .map((p) => ({ ms: p.ms, lead: p.lead, baseline: p.pm25 as number, scenario: (p.pm25 as number) * factor }));
  const base = series.map((x) => x.baseline);
  const scen = series.map((x) => x.scenario);
  const avgB = mean(base) ?? 0;
  const avgS = mean(scen) ?? 0;
  const pop = CITY_BY_SLUG[c.slug]?.pop ?? 0;
  const frac = (xs: number[]) => (xs.length ? xs.filter((v) => v > NAAQS_PM25_24H).length / xs.length : 0);
  const local = avgB * (1 - fs);
  const sectors = [
    { key: "vehicles", label: "Vehicles", base: local * SECTOR_SHARE.vehicles, scen: local * SECTOR_SHARE.vehicles * (1 + s.vehicles / 100) * m.met },
    { key: "industry", label: "Industry", base: local * SECTOR_SHARE.industry, scen: local * SECTOR_SHARE.industry * (1 + s.industry / 100) * m.met },
    { key: "construction", label: "Dust & construction", base: local * SECTOR_SHARE.construction, scen: local * SECTOR_SHARE.construction * (1 + s.construction / 100) * m.met },
    { key: "fire", label: "Crop-residue fires", base: avgB * fs, scen: avgB * fs * m.fire * m.met },
    { key: "other", label: "Other / background", base: local * SECTOR_SHARE.other, scen: local * SECTOR_SHARE.other * m.met },
  ];
  return {
    series,
    factor,
    fireShare: fs,
    sectors,
    summary: {
      avgBaseline: avgB,
      avgScenario: avgS,
      change: avgB ? ((avgS - avgB) / avgB) * 100 : 0,
      aqiBaseline: pmToAqi(avgB),
      aqiScenario: pmToAqi(avgS),
      catBaseline: categoryForPm(avgB),
      catScenario: categoryForPm(avgS),
      unhealthyBaseline: base.filter((v) => v > 90).length,
      unhealthyScenario: scen.filter((v) => v > 90).length,
      exposedBaseline: pop * frac(base),
      exposedScenario: pop * frac(scen),
    },
  };
}

export type ScenarioResult = ReturnType<typeof runScenario>;
