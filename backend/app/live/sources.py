"""Live data source fetchers (all free / open).

1. Open-Meteo Air Quality (Copernicus CAMS)  — live modelled PM2.5, PM10, AOD, dust, NO2, CO   (no key)
2. Open-Meteo Weather (ECMWF/GFS blend)      — temperature, RH, wind, pressure, rain, PBLH       (no key)
3. NASA FIRMS (VIIRS NOAA-20 + S-NPP, 24 h)   — active fire detections with FRP & confidence    (no key, public CSV)
4. NASA GIBS (WMS)                            — satellite imagery: true colour, thermal anomalies, AOD (no key)
5. XKDR India Air Quality API (CPCB CAAQMS)  — measured station archive → historical PM2.5 baseline (API key)
"""

from __future__ import annotations

import asyncio
import csv
import io
import math
import os
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

import httpx

from ..sim.core import CITIES, City, haversine_km

INDIA_BBOX = (6.0, 68.0, 37.5, 98.0)  # lat_min, lon_min, lat_max, lon_max


@dataclass
class SourceResult:
    id: str
    ok: bool
    records: int = 0
    latency_ms: int = 0
    error: str | None = None
    fetched_at: str = ""
    data: object = field(default=None, repr=False)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


async def _timed(source_id: str, coro) -> SourceResult:
    t0 = time.perf_counter()
    try:
        data, n = await coro
        return SourceResult(source_id, True, n, int((time.perf_counter() - t0) * 1000), None, _now_iso(), data)
    except Exception as e:  # noqa: BLE001 — every source failure is reported, never fatal
        return SourceResult(source_id, False, 0, int((time.perf_counter() - t0) * 1000), f"{type(e).__name__}: {e}"[:300], _now_iso(), None)


def _latlon_params(cities: list[City]) -> dict[str, str]:
    return {
        "latitude": ",".join(f"{c.lat:.4f}" for c in cities),
        "longitude": ",".join(f"{c.lon:.4f}" for c in cities),
    }


# ───────────────────────── 1. Open-Meteo Air Quality (CAMS) ─────────────────────────

AQ_VARS = ["pm2_5", "pm10", "aerosol_optical_depth", "dust", "nitrogen_dioxide", "carbon_monoxide", "us_aqi"]


OM_HOSTS = {"air": "https://air-quality-api.open-meteo.com/v1/air-quality", "forecast": "https://api.open-meteo.com/v1/forecast"}


async def _om_get(client: httpx.AsyncClient, target: str, params: dict) -> httpx.Response:
    """Open-Meteo GET with 429 handling. Free Open-Meteo limits per IP and cloud hosts share IPs, so after a
    retry we go through the frontend's relay (/api/om on Vercel, different egress IPs)."""
    r = await client.get(OM_HOSTS[target], params=params)
    if r.status_code != 429:
        return r
    await asyncio.sleep(3)
    r = await client.get(OM_HOSTS[target], params=params)
    if r.status_code != 429:
        return r
    relay = os.getenv("OM_RELAY_URL", "https://aerofusion.vercel.app/api/om")
    if relay:
        try:
            rr = await client.get(relay, params={"target": target, **params}, timeout=60)
            if rr.status_code == 200:
                return rr
            print(f"[open-meteo] relay {rr.status_code}: {rr.text[:120]}")
        except Exception as e:  # noqa: BLE001
            print(f"[open-meteo] relay failed: {e}")
    return r


async def fetch_air_quality(client: httpx.AsyncClient) -> SourceResult:
    async def run():
        r = await _om_get(
            client,
            "air",
            {**_latlon_params(CITIES), "current": ",".join(AQ_VARS), "hourly": "pm2_5,pm10,aerosol_optical_depth", "past_days": 2, "forecast_days": 4},
        )
        r.raise_for_status()
        rows = r.json()
        rows = rows if isinstance(rows, list) else [rows]
        out = {}
        for c, row in zip(CITIES, rows):
            cur = row.get("current", {})
            out[c.slug] = {
                **{k: cur.get(k) for k in AQ_VARS},
                "time": cur.get("time"),
                "hourly_time": row.get("hourly", {}).get("time", []),
                "hourly_pm2_5": row.get("hourly", {}).get("pm2_5", []),
                "hourly_pm10": row.get("hourly", {}).get("pm10", []),
                "hourly_aod": row.get("hourly", {}).get("aerosol_optical_depth", []),
            }
        return out, len(out)

    return await _timed("cams", run())


# ───────────────────────── 2. Open-Meteo Weather ─────────────────────────

WX_VARS = ["temperature_2m", "relative_humidity_2m", "wind_speed_10m", "wind_direction_10m", "surface_pressure", "precipitation", "boundary_layer_height"]


async def _weather_metno(client: httpx.AsyncClient) -> tuple[dict, int]:
    """MET Norway Locationforecast (api.met.no, free, no key) mapped onto the Open-Meteo field names."""
    sem = asyncio.Semaphore(8)
    headers = {"User-Agent": "AeroFusion/0.2 github.com/Srujan4812/aerofusion"}

    async def one(c: City):
        async with sem:
            r = await client.get(
                "https://api.met.no/weatherapi/locationforecast/2.0/compact",
                params={"lat": round(c.lat, 3), "lon": round(c.lon, 3)},
                headers=headers,
                timeout=30,
            )
            r.raise_for_status()
            ts = r.json()["properties"]["timeseries"]
        hourly = {k: [] for k in ("time", "temperature_2m", "relative_humidity_2m", "wind_speed_10m", "wind_direction_10m", "boundary_layer_height")}
        for t in ts[:96]:
            d = t["data"]["instant"]["details"]
            hourly["time"].append(t["time"][:16])
            hourly["temperature_2m"].append(d.get("air_temperature"))
            hourly["relative_humidity_2m"].append(d.get("relative_humidity"))
            hourly["wind_speed_10m"].append(d.get("wind_speed"))
            hourly["wind_direction_10m"].append(d.get("wind_from_direction"))
            hourly["boundary_layer_height"].append(None)
        d0 = ts[0]["data"]["instant"]["details"]
        rain = (ts[0]["data"].get("next_1_hours") or {}).get("details", {}).get("precipitation_amount")
        current = {
            "temperature_2m": d0.get("air_temperature"),
            "relative_humidity_2m": d0.get("relative_humidity"),
            "wind_speed_10m": d0.get("wind_speed"),
            "wind_direction_10m": d0.get("wind_from_direction"),
            "surface_pressure": d0.get("air_pressure_at_sea_level"),
            "precipitation": rain,
            "boundary_layer_height": None,
        }
        return c.slug, {**current, "time": ts[0]["time"][:16], "hourly": hourly, "provider": "MET Norway"}

    rows = await asyncio.gather(*(one(c) for c in CITIES), return_exceptions=True)
    out = {slug: v for row in rows if not isinstance(row, BaseException) for slug, v in [row]}
    if not out:
        raise RuntimeError("Open-Meteo rate-limited and MET Norway fallback failed")
    return out, len(out)


async def fetch_weather(client: httpx.AsyncClient) -> SourceResult:
    async def run():
        params = {
            **_latlon_params(CITIES),
            "current": ",".join(WX_VARS),
            "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,boundary_layer_height",
            "wind_speed_unit": "ms",
            "past_days": 2,
            "forecast_days": 4,
        }
        r = await _om_get(client, "forecast", params)
        if r.status_code == 429:
            # Open-Meteo quota exhausted on this (shared) IP → MET Norway fallback (no PBL height)
            return await _weather_metno(client)
        r.raise_for_status()
        rows = r.json()
        rows = rows if isinstance(rows, list) else [rows]
        out = {
            c.slug: {**{k: row.get("current", {}).get(k) for k in WX_VARS}, "time": row.get("current", {}).get("time"), "hourly": row.get("hourly", {})}
            for c, row in zip(CITIES, rows)
        }
        return out, len(out)

    return await _timed("weather", run())


# ───────────────────────── 3. NASA FIRMS (public 24 h CSV) ─────────────────────────

FIRMS_CSV = {
    "VIIRS NOAA-20": "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_Asia_24h.csv",
    "VIIRS S-NPP": "https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_Asia_24h.csv",
}


async def fetch_fires(client: httpx.AsyncClient) -> SourceResult:
    async def run():
        lat0, lon0, lat1, lon1 = INDIA_BBOX
        pts = []
        for sat, url in FIRMS_CSV.items():
            r = await client.get(url)
            r.raise_for_status()
            for row in csv.DictReader(io.StringIO(r.text)):
                try:
                    lat, lon = float(row["latitude"]), float(row["longitude"])
                except (KeyError, ValueError):
                    continue
                if not (lat0 <= lat <= lat1 and lon0 <= lon <= lon1):
                    continue
                pts.append(
                    {
                        "lat": round(lat, 4),
                        "lon": round(lon, 4),
                        "frp": float(row.get("frp") or 0),
                        "confidence": {"h": "high", "n": "nominal", "l": "low"}.get((row.get("confidence") or "n")[0].lower(), "nominal"),
                        "acq": f"{row.get('acq_date')} {row.get('acq_time', '')[:2]}:{row.get('acq_time', '')[2:]}Z",
                        "daynight": row.get("daynight"),
                        "satellite": sat,
                    }
                )
        return pts, len(pts)

    return await _timed("firms", run())


# ───────────────────────── 4. NASA GIBS imagery ─────────────────────────

GIBS_WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"

GIBS_LAYERS = [
    {"id": "truecolor-viirs", "title": "VIIRS true colour", "subtitle": "Suomi-NPP · corrected reflectance", "layers": "VIIRS_SNPP_CorrectedReflectance_TrueColor", "lag_days": 1, "transparent": False},
    {"id": "fires", "title": "Thermal anomalies", "subtitle": "VIIRS NOAA-20 · 375 m fire detections", "layers": "VIIRS_SNPP_CorrectedReflectance_TrueColor,VIIRS_NOAA20_Thermal_Anomalies_375m_All", "lag_days": 1, "transparent": False},
    {"id": "aod", "title": "Aerosol optical depth", "subtitle": "MODIS Terra · aerosol", "layers": "MODIS_Terra_Aerosol", "lag_days": 1, "transparent": True},
    {"id": "truecolor-modis", "title": "MODIS true colour", "subtitle": "Terra · corrected reflectance", "layers": "MODIS_Terra_CorrectedReflectance_TrueColor", "lag_days": 1, "transparent": False},
    {"id": "aerosol-index", "title": "UV aerosol index", "subtitle": "Suomi-NPP OMPS · smoke & dust", "layers": "OMPS_Aerosol_Index", "lag_days": 1, "transparent": True},
    {"id": "lst", "title": "Land surface temperature", "subtitle": "MODIS Terra · daytime", "layers": "MODIS_Terra_Land_Surface_Temp_Day", "lag_days": 1, "transparent": True},
]

GIBS_CITIES = ["delhi", "mumbai", "kolkata", "bengaluru", "chennai", "hyderabad", "lucknow", "ludhiana"]


def gibs_url(layers: str, bbox: tuple[float, float, float, float], day: date, width: int, height: int, transparent: bool) -> str:
    lat0, lon0, lat1, lon1 = bbox
    fmt = "image/png" if transparent else "image/jpeg"
    q = (
        f"SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS={layers}&STYLES=&FORMAT={fmt}"
        f"&TRANSPARENT={'TRUE' if transparent else 'FALSE'}&CRS=EPSG:4326&WIDTH={width}&HEIGHT={height}"
        f"&TIME={day.isoformat()}&BBOX={lat0},{lon0},{lat1},{lon1}"
    )
    return f"{GIBS_WMS}?{q}"


async def fetch_gibs(client: httpx.AsyncClient) -> SourceResult:
    """Build image descriptors and probe one tile so the dashboard knows GIBS is reachable."""

    async def run():
        today = datetime.now(timezone.utc).date()
        layers = []
        for L in GIBS_LAYERS:
            day = today - timedelta(days=L["lag_days"])
            layers.append({**L, "date": day.isoformat(), "url": gibs_url(L["layers"], INDIA_BBOX, day, 900, 940, L["transparent"])})
        crops = []
        day = today - timedelta(days=1)
        by = {c.slug: c for c in CITIES}
        for slug in GIBS_CITIES:
            c = by[slug]
            bbox = (c.lat - 1.2, c.lon - 1.2, c.lat + 1.2, c.lon + 1.2)
            crops.append(
                {
                    "city": slug,
                    "name": c.name,
                    "date": day.isoformat(),
                    "url": gibs_url("VIIRS_SNPP_CorrectedReflectance_TrueColor,VIIRS_NOAA20_Thermal_Anomalies_375m_All", bbox, day, 480, 480, False),
                }
            )
        probe = await client.get(layers[0]["url"].replace("WIDTH=900&HEIGHT=940", "WIDTH=64&HEIGHT=64"))
        probe.raise_for_status()
        return {"layers": layers, "cities": crops}, len(layers) + len(crops)

    return await _timed("gibs", run())


# ───────────────────────── 5. XKDR India Air Quality API (CPCB archive) ─────────────────────────

XKDR = "https://airquality.xkdr.org/v1"


async def fetch_cpcb_baseline(client: httpx.AsyncClient, api_key: str | None) -> SourceResult:
    """Same-month historical PM2.5 mean per city from measured CPCB stations (the archive isn't real-time)."""

    async def run():
        if not api_key:
            raise RuntimeError("XKDR_API_KEY not set")
        h = {"Authorization": f"Bearer {api_key}"}
        st = await client.get(f"{XKDR}/stations", headers=h, timeout=90)
        st.raise_for_status()
        stations = [s for s in st.json()["data"] if "PM2.5" in s.get("parameters", []) and s.get("latitude")]
        today = datetime.now(timezone.utc).date()
        year = today.year - 2  # last complete CPCB year in the archive is 2024
        start = date(year, today.month, 1)
        end = (date(year + (today.month == 12), today.month % 12 + 1, 1)) - timedelta(days=1)
        out: dict[str, dict] = {}
        for c in CITIES:
            near = [s for s in stations if haversine_km(c.lat, c.lon, s["latitude"], s["longitude"]) < 30]
            if not near:
                continue
            ids = [s["station_id"] for s in near][:12]
            r = await client.get(
                f"{XKDR}/measurements",
                headers=h,
                params={"station": ids, "parameter": "PM2.5", "start": start.isoformat(), "end": end.isoformat(), "agg": "daily"},
                timeout=90,
            )
            if r.status_code != 200:
                continue
            vals = [d["mean"] for d in r.json().get("data", []) if d.get("mean") is not None]
            if vals:
                out[c.slug] = {
                    "pm25_mean": sum(vals) / len(vals),
                    "pm25_p90": sorted(vals)[int(0.9 * (len(vals) - 1))],
                    "n_days": len(vals),
                    "stations": len(near),
                    "period": f"{start.isoformat()}…{end.isoformat()}",
                    "station_names": [s["station_name"] for s in near][:3],
                }
        return out, len(out)

    return await _timed("cpcb", run())


# ───────────────────────── helpers ─────────────────────────


def fire_features(city: City, fires: list[dict], wind_dir_from: float | None) -> dict[str, float]:
    """Counts/FRP within 300 km, and fires inside the upwind ±45° sector within 500 km."""
    n300 = 0
    frp300 = 0.0
    upwind = 0
    for f in fires:
        d = haversine_km(city.lat, city.lon, f["lat"], f["lon"])
        if d <= 300:
            n300 += 1
            frp300 += f["frp"]
        if wind_dir_from is not None and d <= 500:
            # bearing from city to fire; upwind if it matches where wind blows FROM
            y = math.sin(math.radians(f["lon"] - city.lon)) * math.cos(math.radians(f["lat"]))
            x = math.cos(math.radians(city.lat)) * math.sin(math.radians(f["lat"])) - math.sin(math.radians(city.lat)) * math.cos(math.radians(f["lat"])) * math.cos(
                math.radians(f["lon"] - city.lon)
            )
            b = (math.degrees(math.atan2(y, x)) + 360) % 360
            diff = abs(b - wind_dir_from) % 360
            if min(diff, 360 - diff) <= 45:
                upwind += 1
    return {"fires_300km": n300, "frp_300km": frp300, "fires_upwind": upwind}


def fire_regions(fires: list[dict]) -> list[dict]:
    """Rough state-level grouping for the dashboard (nearest tracked city's state)."""
    counts: Counter[str] = Counter()
    frp: defaultdict[str, float] = defaultdict(float)
    for f in fires:
        c = min(CITIES, key=lambda c: (c.lat - f["lat"]) ** 2 + (c.lon - f["lon"]) ** 2)
        counts[c.state] += 1
        frp[c.state] += f["frp"]
    return [{"region": k, "count": v, "frp": round(frp[k], 1)} for k, v in counts.most_common(8)]


# ───────────────────────── XKDR archive: history & meta ─────────────────────────


async def _pm25_stations(client: httpx.AsyncClient, h: dict) -> list[dict]:
    st = await client.get(f"{XKDR}/stations", headers=h, timeout=90)
    st.raise_for_status()
    return [s for s in st.json()["data"] if "PM2.5" in s.get("parameters", []) and s.get("latitude")]


def _near(city: City, stations: list[dict], km: float = 30, limit: int = 12) -> list[dict]:
    return [s for s in stations if haversine_km(city.lat, city.lon, s["latitude"], s["longitude"]) < km][:limit]


async def cpcb_history(client: httpx.AsyncClient, api_key: str, city: City, years: tuple[int, int] = (2022, 2024)) -> dict:
    """Measured PM2.5 for one city (mean of nearby CPCB stations): monthly for the archive years + daily for the last year."""
    h = {"Authorization": f"Bearer {api_key}"}
    near = _near(city, await _pm25_stations(client, h))
    if not near:
        return {"city": city.slug, "months": [], "days": [], "stations": []}
    ids = [s["station_id"] for s in near]

    async def agg(start: str, end: str, kind: str) -> list[dict]:
        r = await client.get(
            f"{XKDR}/measurements",
            headers=h,
            params={"station": ids, "parameter": "PM2.5", "start": start, "end": end, "agg": kind},
            timeout=90,
        )
        r.raise_for_status()
        acc: dict[str, list[float]] = defaultdict(list)
        for d in r.json().get("data", []):
            if d.get("mean") is not None:
                acc[d["period_start"][:10]].append(d["mean"])
        return [{"date": k, "pm25": sum(v) / len(v), "stations": len(v)} for k, v in sorted(acc.items())]

    monthly, daily = await asyncio.gather(
        agg(f"{years[0]}-01-01", f"{years[1]}-12-31", "monthly"),
        agg(f"{years[1]}-01-01", f"{years[1]}-12-31", "daily"),
    )
    return {
        "city": city.slug,
        "months": [{"month": m["date"][:7], "pm25": m["pm25"], "stations": m["stations"]} for m in monthly],
        "days": daily,
        "stations": [s["station_name"] for s in near][:6],
    }


async def cpcb_history_all(client: httpx.AsyncClient, api_key: str, years: tuple[int, int] = (2022, 2024)) -> dict:
    """Monthly measured PM2.5 for every city in batched archive queries (stations within 30 km)."""
    h = {"Authorization": f"Bearer {api_key}"}
    stations = await _pm25_stations(client, h)
    by_city = {c.slug: [s["station_id"] for s in _near(c, stations)] for c in CITIES}
    ids = sorted({i for v in by_city.values() for i in v})
    sem = asyncio.Semaphore(4)

    async def batch(chunk: list[str]) -> list[dict]:
        async with sem:
            r = await client.get(
                f"{XKDR}/measurements",
                headers=h,
                params={"station": chunk, "parameter": "PM2.5", "start": f"{years[0]}-01-01", "end": f"{years[1]}-12-31", "agg": "monthly"},
                timeout=90,
            )
            r.raise_for_status()
            return r.json().get("data", [])

    rows = [d for part in await asyncio.gather(*(batch(ids[i : i + 40]) for i in range(0, len(ids), 40))) for d in part]
    per_station: dict[str, dict[str, float]] = defaultdict(dict)
    for d in rows:
        if d.get("mean") is not None:
            per_station[d["station_id"]][d["period_start"][:7]] = d["mean"]
    out: dict[str, list[dict]] = {}
    for slug, sids in by_city.items():
        acc: dict[str, list[float]] = defaultdict(list)
        for sid in sids:
            for m, v in per_station.get(sid, {}).items():
                acc[m].append(v)
        out[slug] = [{"month": m, "pm25": round(sum(v) / len(v), 2), "stations": len(v)} for m, v in sorted(acc.items())]
    return {"years": list(years), "stations": len(ids), "cities": out}


async def cpcb_meta(client: httpx.AsyncClient, api_key: str) -> dict:
    h = {"Authorization": f"Bearer {api_key}"}
    meta = (await client.get(f"{XKDR}/meta", headers=h, timeout=60)).json()
    params = (await client.get(f"{XKDR}/parameters", headers=h, timeout=60)).json().get("data", [])
    return {"meta": meta, "parameters": params}
