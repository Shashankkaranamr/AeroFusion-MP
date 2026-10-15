import { categoryForPm, NAAQS_PM25_24H, pmToAqi } from "../aqi";
import type { City } from "../cities";
import { mean } from "../utils";
import { pmComponents, type Hour } from "./core";
import { predictAt, sigmaAt } from "./forecast";

export interface ScenarioInput {
  vehicles: number; // % change, −100…+100
  industry: number;
  construction: number;
  cropBurning: number;
  wind: number; // Δ m/s
  temperature: number; // Δ °C
  humidity: number; // Δ %RH
}

export const ZERO_SCENARIO: ScenarioInput = {
  vehicles: 0,
  industry: 0,
  construction: 0,
  cropBurning: 0,
  wind: 0,
  temperature: 0,
  humidity: 0,
};

/** Approximate sector shares of the local (non-fire) PM2.5 burden, for the sensitivity surrogate. */
export const SECTOR_SHARE = { vehicles: 0.27, industry: 0.22, construction: 0.17, other: 0.34 };

export const PRESETS: { id: string; label: string; description: string; input: ScenarioInput }[] = [
  {
    id: "transport",
    label: "Cleaner transport",
    description: "EV push + odd-even: vehicles −40%, road dust −10%",
    input: { ...ZERO_SCENARIO, vehicles: -40, construction: -10 },
  },
  {
    id: "industry",
    label: "Industrial control",
    description: "Stack controls & fuel switch: industry −50%",
    input: { ...ZERO_SCENARIO, industry: -50 },
  },
  {
    id: "stubble",
    label: "No stubble burning",
    description: "Happy-seeder adoption: crop-residue fires −100%",
    input: { ...ZERO_SCENARIO, cropBurning: -100 },
  },
  {
    id: "weather",
    label: "Favourable weather",
    description: "Stronger winds (+2 m/s), warmer surface (+2 °C)",
    input: { ...ZERO_SCENARIO, wind: 2, temperature: 2 },
  },
  {
    id: "grap3",
    label: "GRAP Stage III",
    description: "Construction ban, BS-III/IV restrictions, industry curbs",
    input: { ...ZERO_SCENARIO, vehicles: -30, industry: -30, construction: -60, cropBurning: -40 },
  },
];

function multiplier(s: ScenarioInput) {
  const emission =
    1 +
    SECTOR_SHARE.vehicles * (s.vehicles / 100) +
    SECTOR_SHARE.industry * (s.industry / 100) +
    SECTOR_SHARE.construction * (s.construction / 100);
  const met = Math.exp(-0.16 * s.wind) * Math.exp(-0.03 * s.temperature) * Math.exp(0.004 * s.humidity);
  return { emission: Math.max(0.05, emission), met };
}

export function runScenario(city: City, anchor: Hour, horizon: number, s: ScenarioInput) {
  const m = multiplier(s);
  const series = [];
  for (let k = 0; k <= horizon; k++) {
    const t = anchor + k;
    const c = pmComponents(city, t);
    const p = predictAt(city, anchor, t);
    const ratio = p.pred / c.pm; // model's error relative to truth, kept for consistency
    const fireShare = c.fire / c.pm;
    const coreShare = 1 - fireShare;
    const scenarioPm =
      p.pred * (coreShare * m.emission * m.met + fireShare * Math.max(0, 1 + s.cropBurning / 100) * m.met);
    const sig = sigmaAt(k) * 1.15;
    series.push({
      t,
      lead: k,
      baseline: p.pred,
      baselineLo: p.p10,
      baselineHi: p.p90,
      scenario: scenarioPm,
      scenarioLo: scenarioPm * Math.exp(-1.2816 * sig),
      scenarioHi: scenarioPm * Math.exp(1.2816 * sig),
      ratio,
    });
  }
  const base = series.map((x) => x.baseline);
  const scen = series.map((x) => x.scenario);
  const avgB = mean(base);
  const avgS = mean(scen);
  const unhealthyB = base.filter((v) => v > 90).length;
  const unhealthyS = scen.filter((v) => v > 90).length;
  const expB = city.pop * (base.filter((v) => v > NAAQS_PM25_24H).length / base.length);
  const expS = city.pop * (scen.filter((v) => v > NAAQS_PM25_24H).length / scen.length);
  const c0 = pmComponents(city, anchor);
  const fireShare0 = c0.fire / c0.pm;
  const local0 = avgB * (1 - fireShare0);
  const sectors = [
    { key: "vehicles", label: "Vehicles", base: local0 * SECTOR_SHARE.vehicles, scen: local0 * SECTOR_SHARE.vehicles * (1 + s.vehicles / 100) * m.met },
    { key: "industry", label: "Industry", base: local0 * SECTOR_SHARE.industry, scen: local0 * SECTOR_SHARE.industry * (1 + s.industry / 100) * m.met },
    { key: "construction", label: "Dust & construction", base: local0 * SECTOR_SHARE.construction, scen: local0 * SECTOR_SHARE.construction * (1 + s.construction / 100) * m.met },
    { key: "fire", label: "Crop-residue fires", base: avgB * fireShare0, scen: avgB * fireShare0 * Math.max(0, 1 + s.cropBurning / 100) * m.met },
    { key: "other", label: "Other / background", base: local0 * SECTOR_SHARE.other, scen: local0 * SECTOR_SHARE.other * m.met },
  ];
  return {
    series,
    summary: {
      avgBaseline: avgB,
      avgScenario: avgS,
      change: ((avgS - avgB) / avgB) * 100,
      aqiBaseline: pmToAqi(avgB),
      aqiScenario: pmToAqi(avgS),
      catBaseline: categoryForPm(avgB),
      catScenario: categoryForPm(avgS),
      peakBaseline: Math.max(...base),
      peakScenario: Math.max(...scen),
      unhealthyBaseline: unhealthyB,
      unhealthyScenario: unhealthyS,
      exposedBaseline: expB,
      exposedScenario: expS,
    },
    sectors,
  };
}

export type ScenarioResult = ReturnType<typeof runScenario>;
