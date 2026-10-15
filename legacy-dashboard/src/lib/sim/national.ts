import { AQI_CATEGORIES, categoryForPm, NAAQS_PM25_24H, pmToAqi, type AqiCategory } from "../aqi";
import { CITIES, type City } from "../cities";
import { mean } from "../utils";
import { pmAt, weatherAt, type Hour, type Weather } from "./core";
import { predictAt } from "./forecast";

export interface CitySnapshot {
  city: City;
  pm: number;
  aqi: number;
  category: AqiCategory;
  weather: Weather;
  /** % change vs same hour yesterday. */
  change24: number;
  /** 24-h mean (past). */
  mean24: number;
  /** Predicted peak in the next 24 h. */
  peak24: number;
  peakLead: number;
}

export function citySnapshot(city: City, t: Hour): CitySnapshot {
  const pm = pmAt(city, t);
  const prev = pmAt(city, t - 24);
  let m = 0;
  for (let k = 0; k < 24; k += 2) m += pmAt(city, t - k);
  let peak = 0;
  let peakLead = 1;
  for (let k = 1; k <= 24; k++) {
    const p = predictAt(city, t, t + k).pred;
    if (p > peak) {
      peak = p;
      peakLead = k;
    }
  }
  return {
    city,
    pm,
    aqi: pmToAqi(pm),
    category: categoryForPm(pm),
    weather: weatherAt(city, t),
    change24: ((pm - prev) / prev) * 100,
    mean24: m / 12,
    peak24: peak,
    peakLead,
  };
}

export function nationalSnapshot(t: Hour) {
  const cities = CITIES.map((c) => citySnapshot(c, t));
  const sorted = [...cities].sort((a, b) => b.pm - a.pm);
  const avg = mean(cities.map((c) => c.pm));
  const prevAvg = mean(CITIES.map((c) => pmAt(c, t - 24)));
  const popTotal = cities.reduce((s, c) => s + c.city.pop, 0);
  const exposed = cities.filter((c) => c.pm > NAAQS_PM25_24H).reduce((s, c) => s + c.city.pop, 0);
  const counts = AQI_CATEGORIES.map((cat) => ({
    ...cat,
    count: cities.filter((c) => c.category.key === cat.key).length,
    stations: cities.filter((c) => c.category.key === cat.key).reduce((s, c) => s + c.city.stations, 0),
  }));
  const stations = cities.reduce((s, c) => s + c.city.stations, 0);
  const alerts = cities
    .filter((c) => c.peak24 > 90 && c.peak24 > c.pm * 1.05)
    .sort((a, b) => b.peak24 - a.peak24)
    .slice(0, 6);
  return {
    t,
    cities,
    sorted,
    avg,
    change24: ((avg - prevAvg) / prevAvg) * 100,
    popTotal,
    exposed,
    counts,
    stations,
    alerts,
    aboveNaaqs: cities.filter((c) => c.pm > NAAQS_PM25_24H).length,
    improving: cities.filter((c) => c.change24 < 0).length,
  };
}

export type NationalSnapshot = ReturnType<typeof nationalSnapshot>;

/** Monthly mean PM2.5 across all cities for a calendar year (sampled every 8 h). */
export function monthlyNational(year: number) {
  const out: { month: number; pm: number }[] = [];
  for (let m = 0; m < 12; m++) {
    const start = Date.UTC(year, m, 1) / 3_600_000;
    const end = Date.UTC(year, m + 1, 1) / 3_600_000;
    let s = 0;
    let n = 0;
    for (let t = start; t < end; t += 8) {
      for (let i = 0; i < CITIES.length; i += 2) {
        s += pmAt(CITIES[i], t);
        n++;
      }
    }
    out.push({ month: m, pm: s / n });
  }
  return out;
}

/** City daily mean series for N days (sampled every 4 h). */
export function cityDaily(city: City, anchor: Hour, days: number) {
  const out: { t: Hour; pm: number }[] = [];
  const dayStart = anchor - (anchor % 24);
  const stride = days > 120 ? 2 : 1;
  for (let d = days - 1; d >= 0; d -= stride) {
    const t0 = dayStart - d * 24;
    let s = 0;
    for (let h = 0; h < 24; h += 4) s += pmAt(city, t0 + h);
    out.push({ t: t0, pm: s / 6 });
  }
  return out;
}
