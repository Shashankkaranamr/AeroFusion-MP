"""Node meteorology from the Open-Meteo historical archive, ERA5 model (PROGRESS S2, P1.5). No key; CC-BY-4.0.

Nodes = the frozen station panel (stations_v1.csv) + the 17 upwind source regions + platform cities without a panel
station. Nodes are deduplicated to ERA5 0.25° cells (Open-Meteo snaps to the nearest cell anyway), and each cell is
fetched in yearly chunks into raw/openmeteo_era5/v1/<cell>/<year>.parquet (UTC hours). BLH verified 2026-10-15.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import httpx
import numpy as np
import pandas as pd

from . import manifest, stations as st

API = "https://archive-api.open-meteo.com/v1/archive"
HOURLY = ["temperature_2m", "relative_humidity_2m", "wind_speed_10m", "wind_direction_10m", "surface_pressure",
          "precipitation", "boundary_layer_height"]
RAW = manifest.RAW / "openmeteo_era5" / "v1"
START, END = "2017-12-01", "2025-09-30"


def cell_id(lat: float, lon: float) -> str:
    return f"{round(lat * 4) / 4:.2f}_{round(lon * 4) / 4:.2f}"


def nodes(stations_csv: Path, cities_json: Path = st.CITIES) -> pd.DataFrame:
    """node_id, kind (station | region | city), lat, lon, cell."""
    s = pd.read_csv(stations_csv)
    j = json.loads(cities_json.read_text(encoding="utf-8"))
    regions = pd.DataFrame(j["source_regions"])
    cities = pd.DataFrame(j["cities"])
    unlabeled = cities[~cities["slug"].isin(s["city"])]
    out = pd.concat([
        pd.DataFrame({"node_id": s["station_id"], "kind": "station", "lat": s["latitude"], "lon": s["longitude"]}),
        pd.DataFrame({"node_id": "region_" + regions["id"], "kind": "region", "lat": regions["lat"], "lon": regions["lon"]}),
        pd.DataFrame({"node_id": "city_" + unlabeled["slug"], "kind": "city", "lat": unlabeled["lat"], "lon": unlabeled["lon"]}),
    ], ignore_index=True)
    out["cell"] = [cell_id(a, b) for a, b in zip(out["lat"], out["lon"])]
    return out


def year_chunks(start: str = START, end: str = END) -> list[tuple[str, str, str]]:
    s, e = pd.Timestamp(start), pd.Timestamp(end)
    return [(str(y), max(s, pd.Timestamp(f"{y}-01-01")).date().isoformat(), min(e, pd.Timestamp(f"{y}-12-31")).date().isoformat())
            for y in range(s.year, e.year + 1)]


def to_frame(j: dict) -> pd.DataFrame:
    h = j["hourly"]
    df = pd.DataFrame({k: h[k] for k in HOURLY})
    df.insert(0, "time", pd.to_datetime(h["time"]).tz_localize("UTC"))
    rad = np.deg2rad(df["wind_direction_10m"].astype(float))
    # meteorological convention: direction the wind blows FROM -> u, v components it blows TO
    df["u10"] = -df["wind_speed_10m"] * np.sin(rad)
    df["v10"] = -df["wind_speed_10m"] * np.cos(rad)
    return df


def fetch(client: httpx.Client, cell: str, year: str, start: str, end: str, log=print) -> tuple[Path, bool]:
    dest = RAW / cell / f"{year}.parquet"
    mkey = dest.resolve().relative_to(manifest.RAW.resolve()).as_posix()
    if dest.exists() and mkey in manifest.load():
        return dest, False
    lat, lon = map(float, cell.split("_"))
    params = {"latitude": lat, "longitude": lon, "start_date": start, "end_date": end, "hourly": ",".join(HOURLY),
              "models": "era5", "timezone": "GMT", "wind_speed_unit": "ms"}
    for attempt in range(8):
        r = client.get(API, params=params)
        if r.status_code == 429 or (r.status_code >= 500):
            wait = 3600 if "Daily" in r.text else 60 * (attempt + 1)
            log(f"  {cell} {year}: HTTP {r.status_code} {r.text[:120]!r}; waiting {wait} s")
            time.sleep(wait)
            continue
        r.raise_for_status()
        break
    else:
        raise RuntimeError(f"{cell} {year}: gave up after retries")
    df = to_frame(r.json())
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_name(dest.name + ".part")
    df.to_parquet(part, index=False)
    part.replace(dest)
    manifest.record(dest, str(r.url), source="openmeteo_era5", rows=len(df), cell=cell)
    return dest, True
