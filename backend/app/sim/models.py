"""Forecasts, attributions, graph and scenarios for the demo simulator (port of the TS modules)."""

from __future__ import annotations

import math

from .core import (
    CITIES,
    CITY_BY_SLUG,
    SOURCE_REGIONS,
    City,
    bearing_deg,
    clamp,
    day_of_year,
    haversine_km,
    ist_hour,
    ist_weekday,
    pm_at,
    pm_components,
    traffic_signal,
    weather_at,
)
from .rng import _i32, fbm, hash2, hash_string

Z90 = 1.2816

# ───────────────────────── AQI ─────────────────────────

AQI_BREAKPOINTS = [(0, 30, 0, 50), (30, 60, 50, 100), (60, 90, 100, 200), (90, 120, 200, 300), (120, 250, 300, 400), (250, 380, 400, 500)]
AQI_CATEGORIES = [
    ("good", "Good", 30),
    ("satisfactory", "Satisfactory", 60),
    ("moderate", "Moderate", 90),
    ("poor", "Poor", 120),
    ("veryPoor", "Very Poor", 250),
    ("severe", "Severe", 10_000),
]


def pm_to_aqi(pm: float) -> int:
    p = max(0.0, pm)
    for cl, ch, il, ih in AQI_BREAKPOINTS:
        if p <= ch:
            return round(il + (ih - il) * (p - cl) / (ch - cl))
    return 500


def category(pm: float) -> dict:
    for key, label, hi in AQI_CATEGORIES:
        if pm <= hi:
            return {"key": key, "label": label}
    return {"key": "severe", "label": "Severe"}


# ───────────────────────── forecast ─────────────────────────


def sigma_at(lead: float) -> float:
    return 0.035 + 0.0049 * lead


def _model_error(city: City, issued: int, lead: float) -> float:
    seed = (hash_string(city.slug) ^ _i32(issued * 2654435761)) & 0xFFFFFFFF
    return sigma_at(lead) * 1.25 * fbm(seed, lead / 9 + 0.3, 2)


def _cams_bias(city: City) -> float:
    return -0.2 if city.region in ("nw", "north", "east") else -0.06


def predict_at(city: City, issued: int, t: int) -> dict:
    lead = max(0, t - issued)
    truth = pm_at(city, t)
    pred = truth * math.exp(_model_error(city, issued, lead))
    s = sigma_at(lead)
    return {"truth": truth, "pred": pred, "p10": pred * math.exp(-Z90 * s), "p90": pred * math.exp(Z90 * s)}


def cams_at(city: City, t: int) -> float:
    seed = hash_string(city.slug + ":cams")
    return pm_at(city, t) * math.exp(_cams_bias(city) + 0.2 * fbm(seed, t / 11, 2))


def forecast_series(city: City, anchor: int, horizon: int, past: int = 12, step: int = 1) -> list[dict]:
    out = []
    persistence = pm_at(city, anchor)
    for k in range(-past, horizon + 1, step):
        t = anchor + k
        w = weather_at(city, t)
        if k <= 0:
            truth = pm_at(city, t)
            p = {"truth": truth, "pred": truth, "p10": truth, "p90": truth}
            actual = truth
            pers = truth
        else:
            p = predict_at(city, anchor, t)
            actual = None
            pers = persistence
        out.append(
            {
                "t": t,
                "lead": k,
                "actual": actual,
                "p10": p["p10"],
                "p50": p["pred"],
                "p90": p["p90"],
                "cams": cams_at(city, t),
                "persistence": pers,
                "temp": w["temp"],
                "rh": w["rh"],
                "wind": w["wind"],
            }
        )
    return out


def backtest(city: City, anchor: int, hours: int, lead: int = 24, step: int = 1) -> list[dict]:
    out = []
    for k in range(-hours, 1, step):
        t = anchor + k
        issued = t - lead
        p = predict_at(city, issued, t)
        out.append({"t": t, "actual": p["truth"], "pred": p["pred"], "cams": cams_at(city, t), "persistence": pm_at(city, issued)})
    return out


def error_stats(pairs: list[tuple[float, float]]) -> dict:
    n = len(pairs) or 1
    mean = sum(a for a, _ in pairs) / n
    ae = sum(abs(p - a) for a, p in pairs)
    se = sum((p - a) ** 2 for a, p in pairs)
    ss = sum((a - mean) ** 2 for a, _ in pairs)
    return {"mae": ae / n, "rmse": math.sqrt(se / n), "r2": clamp(1 - se / max(ss, 1e-9), -1, 1)}


# ───────────────────────── attribution ─────────────────────────

FEATURES = [
    ("fire", "Upwind fire hotspots (72 h)", "NASA FIRMS"),
    ("neighbors", "Neighbouring cities (graph diffusion)", "Adaptive graph"),
    ("wind", "Wind speed & stagnation", "ERA5 / IMD"),
    ("boundary", "Boundary layer & temperature", "ERA5 / IMD"),
    ("lags", "Recent PM2.5 history (t-1…t-24)", "CPCB"),
    ("humidity", "Relative humidity", "ERA5 / IMD"),
    ("traffic", "Traffic & activity proxy", "Calendar proxy"),
    ("season", "Season / climatology", "Calendar"),
    ("industry", "Industrial activity (static)", "EDGAR / CPCB inventory"),
    ("roads", "Road & traffic density (static)", "OpenStreetMap"),
    ("landuse", "Population & land use", "WorldPop / ESA"),
]
BASE_VALUE = 62.0


def _split_static(city: City, v: float) -> dict:
    h = hash_string(city.slug + ":static")
    r1 = ((h & 0xFF) / 255) * 0.35
    r2 = (((h >> 8) & 0xFF) / 255) * 0.4
    r3 = (((h >> 16) & 0xFF) / 255) * 0.3
    w = [0.32 + r1, 0.22 + r2, 0.26 + r3]
    s = sum(w)
    return {"roads": v * w[0] / s, "industry": v * w[1] / s, "landuse": v * w[2] / s}


def attribution(city: City, t: int) -> dict:
    c = pm_components(city, t)
    traffic = traffic_signal(ist_hour(t), ist_weekday(t))
    terms = {
        "local": math.log(c.base / BASE_VALUE),
        "season": math.log(c.season),
        "diurnal": math.log(c.diurnal) + math.log(c.weekly),
        "regime": 0.42 * c.regime,
        "lags": 0.15 * c.local,
    }
    log_sum = sum(terms.values())
    scale = 0.0 if abs(log_sum) < 1e-6 else (c.core - BASE_VALUE) / log_sum
    traffic_share = clamp(0.25 + 0.5 * traffic, 0, 0.8)
    values = {
        "fire": c.fire,
        "wind": terms["regime"] * scale * 0.42,
        "neighbors": terms["regime"] * scale * 0.36,
        "humidity": terms["regime"] * scale * 0.22,
        "boundary": terms["diurnal"] * scale * (1 - traffic_share),
        "traffic": terms["diurnal"] * scale * traffic_share,
        "lags": terms["lags"] * scale,
        "season": terms["season"] * scale,
        **_split_static(city, terms["local"] * scale),
    }
    return {"base_value": BASE_VALUE, "prediction": c.pm, "values": values}


def global_importance(anchor: int, hours: int = 48, step: int = 6) -> list[dict]:
    acc = {k: 0.0 for k, _, _ in FEATURES}
    for city in CITIES:
        for k in range(0, hours, step):
            a = attribution(city, anchor - k)
            for f in acc:
                acc[f] += abs(a["values"][f])
    total = sum(acc.values()) or 1
    return sorted(
        ({"key": k, "label": label, "source": src, "share": acc[k] / total * 100} for k, label, src in FEATURES),
        key=lambda x: -x["share"],
    )


def attention_matrix(city: City, anchor: int, lags: int = 24, lag_step: int = 3) -> dict:
    seed = hash_string(city.slug + ":attn")
    doy = day_of_year(anchor)
    rows = []
    for fi, (key, label, _) in enumerate(FEATURES):
        raw = []
        for j in range(lags):
            lag = j * lag_step
            if key == "fire":
                w = math.exp(-0.5 * ((lag - 30) / 14) ** 2) * (0.5 + 1.5 * math.exp(-0.5 * ((doy - 309) / 25) ** 2))
            elif key == "neighbors":
                w = math.exp(-0.5 * ((lag - 9) / 6) ** 2)
            elif key in ("wind", "humidity"):
                w = math.exp(-lag / 9)
            elif key == "boundary":
                w = 0.4 + 0.6 * max(0.0, math.cos(2 * math.pi * lag / 24))
            elif key == "lags":
                w = math.exp(-lag / 6) + 0.35 * math.exp(-0.5 * ((lag - 24) / 3) ** 2)
            elif key == "traffic":
                w = 0.3 + 0.7 * max(0.0, math.cos(2 * math.pi * (lag - 2) / 12))
            else:
                w = 0.5
            w *= 1 + 0.25 * fbm(seed + fi * 97, j / 3, 2)
            raw.append(max(1e-4, w * 4))
        m = max(raw)
        exps = [math.exp(v - m) for v in raw]
        s = sum(exps)
        rows.append({"feature": key, "label": label, "weights": [e / s for e in exps]})
    return {"lags": [j * lag_step for j in range(lags)], "rows": rows}


def spatial_sources(city: City, t: int) -> list[dict]:
    w = weather_at(city, t)
    a = attribution(city, t)
    transported = max(0.0, a["values"]["neighbors"]) + max(0.0, a["values"]["fire"])
    scored = []
    for r in SOURCE_REGIONS:
        d = haversine_km(city.lat, city.lon, r["lat"], r["lon"])
        if d < 40 or d > 900:
            continue
        diff = abs(bearing_deg(city.lat, city.lon, r["lat"], r["lon"]) - w["wind_dir"]) % 360
        if diff > 180:
            diff = 360 - diff
        upwind = max(0.0, math.cos(math.radians(diff)))
        boost = 1 + 3 * max(0.0, a["values"]["fire"]) / max(a["prediction"], 1) if r["id"] in ("punjab", "haryana") else 1
        scored.append({**r, "score": upwind**1.5 * math.exp(-d / 420) * boost, "distance_km": d})
    total = sum(s["score"] for s in scored) or 1
    share = transported / a["prediction"] if a["prediction"] > 0 else 0
    out = [{**s, "contribution": s["score"] / total * share * 100} for s in scored if s["score"] > 0]
    return sorted(out, key=lambda x: -x["contribution"])[:5]


# ───────────────────────── graph ─────────────────────────


def diffusion_graph(t: int, k: int = 3, max_km: float = 700) -> list[dict]:
    edges = []
    for s in CITIES:
        w = weather_at(s, t)
        to_dir = (w["wind_dir"] + 180) % 360
        cand = []
        for d in CITIES:
            if d is s:
                continue
            dist = haversine_km(s.lat, s.lon, d.lat, d.lon)
            if dist > max_km or dist < 15:
                continue
            diff = abs(bearing_deg(s.lat, s.lon, d.lat, d.lon) - to_dir) % 360
            if diff > 180:
                diff = 360 - diff
            align = max(0.0, math.cos(math.radians(diff)))
            learned = 0.75 + 0.5 * hash2(hash_string(s.slug), hash_string(d.slug))
            weight = math.exp(-dist / 260) * (0.25 + 0.75 * align) * learned * min(1.6, w["wind"] / 2.2)
            cand.append({"source": s.slug, "target": d.slug, "weight": weight, "distance_km": dist})
        cand.sort(key=lambda e: -e["weight"])
        edges.extend(cand[:k])
    mx = max((e["weight"] for e in edges), default=1e-6)
    out = []
    for e in edges:
        wn = e["weight"] / mx
        if wn > 0.08:
            out.append({**e, "weight": wn, "flux": wn * pm_at(CITY_BY_SLUG[e["source"]], t) * 0.18})
    return out


# ───────────────────────── scenario ─────────────────────────

SECTOR_SHARE = {"vehicles": 0.27, "industry": 0.22, "construction": 0.17, "other": 0.34}


def run_scenario(city: City, anchor: int, horizon: int, s: dict) -> dict:
    emission = max(
        0.05,
        1 + SECTOR_SHARE["vehicles"] * s.get("vehicles", 0) / 100 + SECTOR_SHARE["industry"] * s.get("industry", 0) / 100 + SECTOR_SHARE["construction"] * s.get("construction", 0) / 100,
    )
    met = math.exp(-0.16 * s.get("wind", 0)) * math.exp(-0.03 * s.get("temperature", 0)) * math.exp(0.004 * s.get("humidity", 0))
    crop = max(0.0, 1 + s.get("cropBurning", 0) / 100)
    series = []
    for k in range(horizon + 1):
        t = anchor + k
        c = pm_components(city, t)
        p = predict_at(city, anchor, t)
        fire_share = c.fire / c.pm
        scen = p["pred"] * ((1 - fire_share) * emission * met + fire_share * crop * met)
        sig = sigma_at(k) * 1.15
        series.append(
            {
                "t": t,
                "lead": k,
                "baseline": p["pred"],
                "baseline_p10": p["p10"],
                "baseline_p90": p["p90"],
                "scenario": scen,
                "scenario_p10": scen * math.exp(-Z90 * sig),
                "scenario_p90": scen * math.exp(Z90 * sig),
            }
        )
    base = [x["baseline"] for x in series]
    scen = [x["scenario"] for x in series]
    avg_b = sum(base) / len(base)
    avg_s = sum(scen) / len(scen)
    return {
        "series": series,
        "summary": {
            "avg_baseline": avg_b,
            "avg_scenario": avg_s,
            "change_pct": (avg_s - avg_b) / avg_b * 100,
            "aqi_baseline": pm_to_aqi(avg_b),
            "aqi_scenario": pm_to_aqi(avg_s),
            "unhealthy_hours_baseline": sum(1 for v in base if v > 90),
            "unhealthy_hours_scenario": sum(1 for v in scen if v > 90),
        },
    }


# ───────────────────────── national snapshot ─────────────────────────


def city_snapshot(city: City, t: int) -> dict:
    pm = pm_at(city, t)
    prev = pm_at(city, t - 24)
    peak, peak_lead = 0.0, 1
    for k in range(1, 25):
        p = predict_at(city, t, t + k)["pred"]
        if p > peak:
            peak, peak_lead = p, k
    return {
        "slug": city.slug,
        "name": city.name,
        "pm25": pm,
        "aqi": pm_to_aqi(pm),
        "category": category(pm),
        "change_24h_pct": (pm - prev) / prev * 100,
        "peak_24h": peak,
        "peak_lead_h": peak_lead,
        "weather": weather_at(city, t),
    }


def national_snapshot(t: int) -> dict:
    cities = [city_snapshot(c, t) for c in CITIES]
    avg = sum(c["pm25"] for c in cities) / len(cities)
    return {
        "t": t,
        "national_avg_pm25": avg,
        "above_naaqs": sum(1 for c in cities if c["pm25"] > 60),
        "cities": sorted(cities, key=lambda c: -c["pm25"]),
    }
