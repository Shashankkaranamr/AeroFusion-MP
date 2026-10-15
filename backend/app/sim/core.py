"""Demo simulator — port of frontend/src/lib/sim/core.ts.

Physically-motivated, deterministic PM2.5 and weather series for 33 Indian cities. Everything
here is SIMULATED; responses carry ``data_mode: "demo"`` so clients can label it.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

from .rng import fbm, hash_string, mulberry32

HOUR_MS = 3_600_000
IST = 5.5

_DATA = json.loads((Path(__file__).resolve().parent.parent / "data" / "cities.json").read_text(encoding="utf-8"))


@dataclass(frozen=True)
class City:
    slug: str
    name: str
    state: str
    lat: float
    lon: float
    base: float
    region: str
    coastal: bool
    elev: float
    pop: float
    stations: int
    landmark: str


CITIES: list[City] = [City(**c) for c in _DATA["cities"]]
CITY_BY_SLUG: dict[str, City] = {c.slug: c for c in CITIES}
SOURCE_REGIONS: list[dict] = _DATA["source_regions"]


def clamp(v: float, lo: float, hi: float) -> float:
    return min(hi, max(lo, v))


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = p2 - p1
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


# ───────────────────────── time helpers ─────────────────────────


def now_hour() -> int:
    return int(datetime.now(timezone.utc).timestamp() // 3600)


def hour_to_datetime(t: int) -> datetime:
    return datetime.fromtimestamp(t * 3600, tz=timezone.utc)


def ist_hour(t: float) -> float:
    return ((t + IST) % 24 + 24) % 24


def day_of_year(t: float) -> float:
    ms = (t + IST) * HOUR_MS
    d = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    start = datetime(d.year, 1, 1, tzinfo=timezone.utc).timestamp() * 1000
    return (ms - start) / 86_400_000


def ist_weekday(t: float) -> int:
    """0 = Sunday … 6 = Saturday (JavaScript getUTCDay convention)."""
    d = datetime.fromtimestamp((t + IST) * 3600, tz=timezone.utc)
    return (d.weekday() + 1) % 7


# ───────────────────────── seasonality ─────────────────────────

MONTH_MID = [15, 45, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349]
SEASON_N = [1.75, 1.35, 1.0, 0.85, 0.8, 0.6, 0.38, 0.36, 0.48, 1.0, 2.0, 1.8]
SEASON_DAMP = {"nw": 1, "north": 1, "east": 0.9, "northeast": 0.7, "west": 0.72, "central": 0.8, "south": 0.42, "hill": 0.75}
TEMP_SHAPE = [-1.05, -0.76, -0.19, 0.38, 0.76, 0.86, 0.57, 0.48, 0.38, 0.1, -0.48, -0.95]


def _cyclic_interp(doy: float, values: list[float], smooth: bool) -> float:
    for i in range(12):
        a = MONTH_MID[i]
        b = MONTH_MID[0] + 365 if i == 11 else MONTH_MID[i + 1]
        d = doy + 365 if doy < MONTH_MID[0] else doy
        if a <= d < b:
            f = (d - a) / (b - a)
            u = f * f * (3 - 2 * f) if smooth else f
            return values[i] + (values[(i + 1) % 12] - values[i]) * u
    return 1.0 if smooth else 0.0


def season_factor(city: City, doy: float) -> float:
    damp = min(SEASON_DAMP[city.region], 0.55) if city.coastal else SEASON_DAMP[city.region]
    return 1 + (_cyclic_interp(doy, SEASON_N, True) - 1) * damp


def winterness(doy: float) -> float:
    return 0.5 + 0.5 * math.cos(2 * math.pi * (doy - 5) / 365)


DIURNAL = [1.18, 1.22, 1.25, 1.26, 1.25, 1.22, 1.18, 1.12, 1.04, 0.95, 0.86, 0.79, 0.74, 0.71, 0.7, 0.72, 0.77, 0.85, 0.96, 1.06, 1.12, 1.15, 1.16, 1.17]


def diurnal_factor(hour: float, doy: float) -> float:
    i = int(math.floor(hour)) % 24
    f = hour - math.floor(hour)
    base = DIURNAL[i] + (DIURNAL[(i + 1) % 24] - DIURNAL[i]) * f
    amp = 0.75 + 0.5 * winterness(doy)
    return 1 + (base - 1) * amp


def traffic_signal(hour: float, weekday: int) -> float:
    am = math.exp(-0.5 * ((hour - 9) / 1.4) ** 2)
    pm = math.exp(-0.5 * ((hour - 19.5) / 1.8) ** 2)
    wk = 0.6 if weekday == 0 else 0.85 if weekday == 6 else 1.0
    return (0.8 * am + pm) * wk


REGIME_CENTERS = [
    (30.2, 75.8, 101),
    (26.8, 80.6, 202),
    (24.6, 86.4, 303),
    (23.4, 72.8, 404),
    (21.8, 79.6, 505),
    (14.6, 78.2, 606),
    (26.2, 92.4, 707),
    (33.6, 75.2, 808),
]


def regime(lat: float, lon: float, t: float) -> float:
    acc = 0.0
    wsum = 0.0
    for clat, clon, seed in REGIME_CENTERS:
        d = haversine_km(lat, lon, clat, clon)
        w = math.exp(-((d / 520) ** 2))
        acc += w * fbm(seed, t / 41 + seed * 0.37, 3)
        wsum += w
    national = fbm(999, t / 96, 2)
    return clamp((acc / max(wsum, 1e-6)) * 1.25 + national * 0.35, -1.2, 1.2)


@lru_cache(maxsize=128)
def city_seed(slug: str) -> int:
    return hash_string(slug)


# ───────────────────────── fires ─────────────────────────


def fire_season(doy: float) -> float:
    return math.exp(-0.5 * ((doy - 309) / 13) ** 2) + 0.35 * math.exp(-0.5 * ((doy - 118) / 11) ** 2)


PUNJAB = (30.6, 75.4)


def upwind_fire_exposure(city: City) -> float:
    d = haversine_km(city.lat, city.lon, *PUNJAB)
    igp = city.lat > 23 and city.lon < 88.5
    return math.exp(-d / 380) if igp else 0.25 * math.exp(-d / 250)


def fire_term(city: City, t: float) -> float:
    season = fire_season(day_of_year(t))
    if season < 0.01:
        return 0.0
    pulse = 0.55 + 0.45 * ((fbm(777, t / 18, 2) + 1) / 2)
    transport = 0.65 + 0.35 * math.sin(2 * math.pi * (t + 7) / 61)
    return 135 * season * upwind_fire_exposure(city) * pulse * transport


FIRE_BOXES = [
    ("Punjab", (29.8, 32.0), (74.6, 76.9), 0.5, True),
    ("Haryana", (28.6, 30.6), (75.0, 77.4), 0.22, True),
    ("Madhya Pradesh", (21.5, 25.5), (75.5, 81.5), 0.1, False),
    ("Chhattisgarh", (18.5, 23.0), (80.5, 84.0), 0.07, False),
    ("Odisha", (19.0, 22.0), (83.0, 86.5), 0.06, False),
    ("Assam", (24.5, 27.2), (90.5, 94.5), 0.05, False),
]


def fire_hotspots(t: int, max_points: int = 420) -> dict:
    day_index = math.floor((t + IST) / 24)
    doy = day_of_year(t)
    season = fire_season(doy)
    rnd = mulberry32(day_index * 7919 + 13)
    spring = math.exp(-0.5 * ((doy - 105) / 28) ** 2)
    total = round(2400 * season + 60 + 260 * spring + 50 * rnd())
    n = min(total, max_points)
    seasonal_share = clamp(season * 4, 0.12, 0.92)
    points = []
    for i in range(n):
        use_seasonal = rnd() < seasonal_share
        pool = [b for b in FIRE_BOXES if b[4] == use_seasonal]
        wsum = sum(b[3] for b in pool)
        r = rnd() * wsum
        box = pool[0]
        for b in pool:
            r -= b[3]
            if r <= 0:
                box = b
                break
        region, (lat0, lat1), (lon0, lon1), _, _ = box
        lat = lat0 + (lat1 - lat0) * (0.5 + 0.5 * (rnd() - 0.5) + 0.25 * (rnd() - 0.5))
        lon = lon0 + (lon1 - lon0) * rnd()
        conf = rnd()
        points.append(
            {
                "id": f"{day_index}-{i}",
                "lat": lat,
                "lon": lon,
                "frp": round(4 + rnd() ** 2 * 60),
                "confidence": "high" if conf > 0.55 else "nominal" if conf > 0.18 else "low",
                "region": region,
            }
        )
    return {"total": total, "points": points}


# ───────────────────────── PM2.5 ─────────────────────────


@dataclass
class PmComponents:
    base: float
    season: float
    diurnal: float
    regime: float
    local: float
    weekly: float
    fire: float
    core: float
    pm: float


def pm_components(city: City, t: float) -> PmComponents:
    doy = day_of_year(t)
    h = ist_hour(t)
    s = city_seed(city.slug)
    season = season_factor(city, doy)
    diurnal = diurnal_factor(h, doy)
    r = regime(city.lat, city.lon, t)
    c = fbm(s, t / 8.5, 3)
    weekday = ist_weekday(t)
    weekly = 0.93 if weekday == 0 else 0.97 if weekday == 6 else 1.0
    coastal_vent = 0.86 if city.coastal else 1.0
    core = city.base * season * diurnal * math.exp(0.42 * r) * math.exp(0.15 * c) * weekly * coastal_vent
    fire = fire_term(city, t)
    spike = max(0.0, fbm(s + 31, t / 2.2, 2) - 0.55) * 60 * season
    pm = max(3.0, core + fire + spike)
    return PmComponents(city.base, season, diurnal, r, c, weekly, fire + spike, core, pm)


def pm_at(city: City, t: float) -> float:
    return pm_components(city, t).pm


# ───────────────────────── weather ─────────────────────────


def weather_at(city: City, t: float) -> dict:
    doy = day_of_year(t)
    h = ist_hour(t)
    s = city_seed(city.slug)
    r = regime(city.lat, city.lon, t)
    lat = city.lat
    t_ann = 33 - 0.4 * (lat - 8) + city.elev
    amp = (1.5 + 0.45 * max(0.0, lat - 8)) * (0.45 if city.coastal else 1.0)
    diurnal_amp = 3 if city.coastal else 6.5 if city.region == "west" else 5
    temp = t_ann + amp * _cyclic_interp(doy, TEMP_SHAPE, False) + diurnal_amp * math.cos(2 * math.pi * (h - 15) / 24) + 1.3 * fbm(s + 5, t / 30, 2)
    monsoon = math.exp(-0.5 * ((doy - 210) / 42) ** 2)
    rh = clamp(
        48 + 32 * monsoon + (16 if city.coastal else 0) - (10 if city.region == "west" else 0) - 13 * math.cos(2 * math.pi * (h - 15) / 24) + 9 * r + 5 * fbm(s + 9, t / 12, 2),
        12,
        98,
    )
    wind = clamp(
        1.0 + 2.5 * (1 - (r + 1) / 2) + (1.5 if city.coastal else 0) + 0.6 * fbm(s + 17, t / 7, 2) + 0.8 * math.cos(2 * math.pi * (h - 14) / 24),
        0.3,
        12,
    )
    monsoon_w = clamp((monsoon - 0.2) * 1.4, 0, 1)
    prevailing = 300 if lat > 21 else 65
    direction = prevailing * (1 - monsoon_w) + 230 * monsoon_w + 28 * fbm(s + 23, t / 20, 2)
    pblh = clamp(350 + 900 * max(0.0, math.cos(2 * math.pi * (h - 14) / 24)) * (1 - 0.45 * winterness(doy)) + 180 * (1 - r), 120, 2600)
    return {"temp": temp, "rh": rh, "wind": wind, "wind_dir": direction % 360, "pblh": pblh}
