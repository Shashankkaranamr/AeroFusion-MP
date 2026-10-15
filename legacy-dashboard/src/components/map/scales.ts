import { scaleLinear } from "d3-scale";
import { pmColor, pmToAqi } from "@/lib/aqi";
import type { FieldMetric } from "@/lib/sim/field";

const tempScale = scaleLinear<string>()
  .domain([8, 16, 22, 27, 32, 38])
  .range(["#3b82f6", "#22d3ee", "#a3e635", "#facc15", "#f97316", "#dc2626"])
  .clamp(true);

const windScale = scaleLinear<string>()
  .domain([0, 1.5, 3, 4.5, 6.5, 9])
  .range(["#7c3aed", "#6366f1", "#3b82f6", "#06b6d4", "#10b981", "#a3e635"])
  .clamp(true);

export function metricColor(metric: FieldMetric, v: number): string {
  if (metric === "temp") return tempScale(v);
  if (metric === "wind") return windScale(v);
  return pmColor(v);
}

export function rgbOf(color: string): [number, number, number] {
  const m = color.match(/\d+/g);
  if (!m) return [0, 0, 0];
  return [Number(m[0]), Number(m[1]), Number(m[2])];
}

export function metricLabel(metric: FieldMetric, v: number) {
  if (metric === "temp") return `${v.toFixed(0)}°C`;
  if (metric === "wind") return `${v.toFixed(1)} m/s`;
  if (metric === "aqi") return `${pmToAqi(v)}`;
  return `${Math.round(v)}`;
}

export const METRIC_UNITS: Record<FieldMetric, string> = {
  pm: "µg/m³",
  aqi: "AQI",
  temp: "°C",
  wind: "m/s",
};

export const LEGEND_STOPS: Record<FieldMetric, { stops: number[]; labels: string[] }> = {
  pm: { stops: [0, 30, 60, 90, 120, 200, 300], labels: ["0", "30", "60", "90", "120", "200", "300+"] },
  aqi: { stops: [0, 30, 60, 90, 120, 200, 300], labels: ["0", "50", "100", "200", "300", "400", "500"] },
  temp: { stops: [8, 16, 22, 27, 32, 38], labels: ["8°", "16°", "22°", "27°", "32°", "38°"] },
  wind: { stops: [0, 1.5, 3, 4.5, 6.5, 9], labels: ["0", "1.5", "3", "4.5", "6.5", "9"] },
};
