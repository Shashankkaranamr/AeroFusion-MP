"""NASA FIRMS active fires, yearly country CSVs (PROGRESS S6, P1.8). Public, no key; the MAP_KEY is only for the live/area API.

India plus upwind neighbours (Pakistan Punjab smoke reaches Amritsar/Delhi; Nepal and Bangladesh border the IGP/east).
Files: raw/firms/v1/<sensor>/<year>/<sensor>_<year>_<Country>.csv
"""

from __future__ import annotations

from pathlib import Path

import httpx

from . import manifest

BASE = "https://firms.modaps.eosdis.nasa.gov/data/country"
SENSORS = ["modis", "viirs-snpp"]
COUNTRIES = ["India", "Pakistan", "Nepal", "Bangladesh"]
YEARS = list(range(2017, 2026))
RAW = manifest.RAW / "firms" / "v1"


def url(sensor: str, year: int, country: str) -> str:
    return f"{BASE}/{sensor}/{year}/{sensor}_{year}_{country}.csv"


def download(client: httpx.Client, sensor: str, year: int, country: str) -> tuple[Path, bool]:
    dest = RAW / sensor / str(year) / f"{sensor}_{year}_{country}.csv"
    mkey = dest.resolve().relative_to(manifest.RAW.resolve()).as_posix()
    if dest.exists() and mkey in manifest.load():
        return dest, False
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_name(dest.name + ".part")
    u = url(sensor, year, country)
    with client.stream("GET", u) as r:
        r.raise_for_status()
        with part.open("wb") as f:
            for chunk in r.iter_bytes(1 << 20):
                f.write(chunk)
    part.replace(dest)
    rows = sum(1 for _ in dest.open("rb")) - 1
    manifest.record(dest, u, source="firms", rows=rows)
    return dest, True
