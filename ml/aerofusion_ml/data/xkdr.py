"""XKDR India Air Quality API bulk Parquet export (PROGRESS S1, P1.1). CC BY 4.0: attribute XKDR Forum, CPCB CAAQM,
US State Dept/AirNow.

`GET /v1/files` lists the export (stations, parameters, one measurements file per month, hive-partitioned);
`GET /v1/files/<key>` returns the file. `collected_at` is naive IST (UTC+05:30) per /v1/meta; convert at ingest.
"""

from __future__ import annotations

from pathlib import Path

import httpx
import pandas as pd

from . import manifest

API = "https://airquality.xkdr.org"
RAW = manifest.RAW / "xkdr"
IST = pd.Timedelta(hours=5, minutes=30)
INTERVAL = pd.Timedelta(hours=1)


def to_utc_hour(collected_at: pd.Series) -> pd.Series:
    """Naive IST interval-start labels -> the UTC hour `t` whose slot (t, t+1h] contains the interval's end.

    Verified 2026-10-15 on site_103 days 2023-11-01 and 2019-11-01 (PROGRESS §9): the export is hourly (CPCB quarter-hour means), and a day query returns
    labels 00:00..23:00 IST, i.e. labels mark the interval start. CPCB label H IST covers [H-5:30, H-4:30) UTC, so
    t = H - 5h (the hour at the interval's centre); US-Embassy rows (stored at IST :30, i.e. UTC hour starts) map to
    their own UTC start hour. With this rule a value at index t never ends after t+1h, so the §3.4 latency rule
    (CPCB usable at t0 if t <= t0 - 1h) never admits an interval that ends after t0.
    """
    end_utc = pd.to_datetime(collected_at) - IST + INTERVAL
    return (end_utc.dt.ceil("h") - INTERVAL).dt.tz_localize("UTC")


def list_files(client: httpx.Client, key: str) -> dict:
    r = client.get(f"{API}/v1/files", headers={"Authorization": f"Bearer {key}"})
    r.raise_for_status()
    return r.json()


def download(client: httpx.Client, key: str, entry: dict, out: Path = RAW) -> tuple[Path, bool]:
    """Fetch one listed file. Idempotent: skipped when the local copy has the listed size and is in the manifest."""
    dest = out / entry["key"]
    known = manifest.load()
    mkey = dest.resolve().relative_to(manifest.RAW.resolve()).as_posix()
    if dest.exists() and dest.stat().st_size == entry["bytes"] and mkey in known:
        return dest, False
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_name(dest.name + ".part")
    url = f"{API}/v1/files/{entry['key']}"
    with client.stream("GET", url, headers={"Authorization": f"Bearer {key}"}) as r:
        r.raise_for_status()
        with part.open("wb") as f:
            for chunk in r.iter_bytes(1 << 20):
                f.write(chunk)
    if part.stat().st_size != entry["bytes"]:
        raise OSError(f"{entry['key']}: got {part.stat().st_size} bytes, listing says {entry['bytes']}")
    part.replace(dest)
    manifest.record(dest, url, rows=entry.get("rows"), source="xkdr")
    return dest, True
