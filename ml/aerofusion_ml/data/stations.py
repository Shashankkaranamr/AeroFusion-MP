"""Fixed station panel (PROGRESS §3.2, P1.3): CPCB/XKDR PM2.5 stations within 25 km of the 33 platform cities that
start by 2020-01-01 and have >= 60 % hourly PM2.5 completeness from their start to 2024-12-31 (end of the test split).

Completeness uses presence only (a non-sentinel PM2.5 value in a UTC hour); no target statistics are computed.
"Start" is clipped to the data window (2017-12-01, the 72 h warm-up before train), so years before the study period
don't count against a station (PROGRESS §9).
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from . import manifest, qc, xkdr

REPO = Path(__file__).resolve().parents[3]
CITIES = REPO / "backend" / "app" / "data" / "cities.json"
RADIUS_KM = 25.0
START_BY = pd.Timestamp("2020-01-01", tz="UTC")
WINDOW_START = pd.Timestamp("2017-12-01", tz="UTC")
COMPLETENESS_END = pd.Timestamp("2024-12-31 23:00", tz="UTC")
MIN_COMPLETENESS = 0.60


def haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 6371.0 * 2 * np.arcsin(np.sqrt(a))


def load_cities(path: Path = CITIES) -> pd.DataFrame:
    return pd.DataFrame(json.loads(path.read_text(encoding="utf-8"))["cities"])[["slug", "name", "lat", "lon"]]


def nearest_city(stations: pd.DataFrame, cities: pd.DataFrame) -> pd.DataFrame:
    """Add `city` (slug) and `dist_km` for each station's nearest platform city; city is NA beyond RADIUS_KM."""
    d = haversine_km(stations["latitude"].to_numpy()[:, None], stations["longitude"].to_numpy()[:, None],
                     cities["lat"].to_numpy()[None, :], cities["lon"].to_numpy()[None, :])
    i = d.argmin(axis=1)
    out = stations.copy()
    out["dist_km"] = d[np.arange(len(d)), i].round(2)
    out["city"] = pd.Series(cities["slug"].to_numpy()[i], index=out.index).where(out["dist_km"] <= RADIUS_KM)
    return out


def pm25_hours(month_files: list[Path]) -> pd.DataFrame:
    """Distinct (station_id, UTC hour) pairs with a usable PM2.5 value, from monthly export files."""
    parts = []
    for f in month_files:
        m = pd.read_parquet(f, columns=["station_id", "parameter_name", "collected_at", "value"], filters=[("parameter_name", "==", "PM2.5")])
        m = m[m["value"].notna() & ~m["value"].isin(qc.SENTINELS) & (m["value"] >= 0)]
        parts.append(pd.DataFrame({"station_id": m["station_id"].astype(str), "t": xkdr.to_utc_hour(m["collected_at"])}).drop_duplicates())
    return pd.concat(parts, ignore_index=True).drop_duplicates()


def panel(hours: pd.DataFrame, stations: pd.DataFrame) -> pd.DataFrame:
    """Apply the §3.2 rule to every station near a city; returns all candidates with `keep` and the reason."""
    hours = hours[(hours["t"] >= WINDOW_START) & (hours["t"] <= COMPLETENESS_END)]
    g = hours.groupby("station_id")["t"].agg(pm25_start="min", pm25_last="max", n_hours="count")
    c = stations[stations["city"].notna()].set_index("station_id").join(g, how="left")
    span_h = ((COMPLETENESS_END - c["pm25_start"]) / pd.Timedelta(hours=1)) + 1
    c["completeness"] = (c["n_hours"] / span_h).round(4)
    c["keep"] = c["pm25_start"].notna() & (c["pm25_start"] <= START_BY) & (c["completeness"] >= MIN_COMPLETENESS)
    c["reason"] = np.select(
        [c["pm25_start"].isna(), c["pm25_start"] > START_BY, c["completeness"] < MIN_COMPLETENESS],
        ["no PM2.5 in window", "starts after 2020-01-01", "completeness < 60 %"], default="kept")
    return c.reset_index()


def month_files(start: str = "2017-12", end: str = "2024-12") -> list[Path]:
    from .copernicus import months

    root = manifest.RAW / "xkdr" / "v1" / "measurements"
    return [root / f"year={m[:4]}" / f"month={m[5:]}" / "data.parquet" for m in months(start, end)]
