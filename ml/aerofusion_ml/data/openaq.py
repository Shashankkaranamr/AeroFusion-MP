"""OpenAQ v3 CPCB hourly PM2.5 for the panel stations (PROGRESS S8): ground truth for the prospective winter 2026-27
test and live model inputs. Key: OPENAQ_API_KEY in ml/.env (never printed). Rate limit 60 requests/min.

Verified 2026-10-15 (§9): CPCB on OpenAQ runs ~2 days behind real time; each parameter has an old (2016-18) and a
current sensor id (use the one with the latest datetimeLast); hourly periods [from, from+1h) start at :30 UTC, and
stamping them at t = from + 30 min reproduces the XKDR values exactly (R K Puram, Jan 2018, train period), i.e. the
same slot convention as P1.2. Periods not starting at :30 are dropped.
"""

from __future__ import annotations

import time
from pathlib import Path

import httpx
import numpy as np
import pandas as pd

from . import manifest
from ..env import need

API = "https://api.openaq.org/v3"
RAW = manifest.RAW / "openaq" / "v1"
MATCH_KM = 1.0


def client() -> httpx.Client:
    return httpx.Client(timeout=90, headers={"X-API-Key": need("OPENAQ_API_KEY")})


def get(c: httpx.Client, path: str, **params) -> dict:
    for attempt in range(6):
        r = c.get(f"{API}{path}", params=params)
        if r.status_code == 429 or r.status_code >= 500:
            time.sleep(10 * (attempt + 1))
            continue
        r.raise_for_status()
        time.sleep(1.1)  # stay under 60 requests/min
        return r.json()
    raise RuntimeError(f"OpenAQ {path}: gave up")


def match_stations(c: httpx.Client, panel: pd.DataFrame) -> pd.DataFrame:
    """Nearest CPCB/caaqm OpenAQ location within 1 km of each panel station, and its current PM2.5 sensor."""
    rows = []
    for s in panel.itertuples():
        res = get(c, "/locations", coordinates=f"{s.latitude:.5f},{s.longitude:.5f}", radius=int(MATCH_KM * 1000), limit=20)["results"]
        best = None
        for loc in res:
            sensors = [x for x in loc.get("sensors", []) if x["parameter"]["name"] == "pm25"]
            if not sensors:
                continue
            d = np.hypot((loc["coordinates"]["latitude"] - s.latitude) * 111, (loc["coordinates"]["longitude"] - s.longitude) * 111 * np.cos(np.radians(s.latitude)))
            last = (loc.get("datetimeLast") or {}).get("utc", "")
            if best is None or (d, -len(last)) < best[0]:
                best = ((d, -len(last)), loc, sensors)
        if best is None:
            rows.append({"station_id": s.station_id, "openaq_location": None})
            continue
        (d, _), loc, sensors = best
        # current sensor = the pm25 sensor with the latest data; resolve via /sensors (location payload lacks dates)
        info = [get(c, f"/sensors/{x['id']}")["results"][0] for x in sensors]
        cur = max(info, key=lambda z: (z.get("datetimeLast") or {}).get("utc", ""))
        rows.append({"station_id": s.station_id, "openaq_location": loc["id"], "openaq_name": loc["name"], "dist_km": round(float(d), 3),
                     "provider": (loc.get("provider") or {}).get("name"), "pm25_sensor": cur["id"],
                     "sensor_first": (cur.get("datetimeFirst") or {}).get("utc"), "sensor_last": (cur.get("datetimeLast") or {}).get("utc")})
    return pd.DataFrame(rows)


def hours_frame(results: list[dict]) -> pd.DataFrame:
    """OpenAQ hourly results -> (t UTC slot, value); keeps only :30-aligned hourly periods (see module doc)."""
    if not results:
        return pd.DataFrame(columns=["t", "value"])
    frm = pd.to_datetime([z["period"]["datetimeFrom"]["utc"] for z in results], utc=True)
    to = pd.to_datetime([z["period"]["datetimeTo"]["utc"] for z in results], utc=True)
    v = np.array([z["value"] for z in results], dtype=float)
    ok = (frm.minute == 30) & ((to - frm) == pd.Timedelta(hours=1))
    return pd.DataFrame({"t": (frm + pd.Timedelta(minutes=30))[ok], "value": v[ok]}).drop_duplicates("t").sort_values("t")


def fetch_month(c: httpx.Client, station_id: str, sensor: int, month: str) -> Path:
    dest = RAW / station_id / f"{month}.parquet"
    start = pd.Timestamp(month + "-01", tz="UTC")
    end = start + pd.offsets.MonthBegin(1)
    res, page = [], 1
    while True:
        j = get(c, f"/sensors/{sensor}/hours", datetime_from=start.isoformat(), datetime_to=end.isoformat(), limit=1000, page=page)
        res += j["results"]
        if len(j["results"]) < 1000:
            break
        page += 1
    df = hours_frame(res)
    dest.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(dest, index=False)
    manifest.record(dest, f"{API}/sensors/{sensor}/hours?month={month}", source="openaq", rows=len(df), sensor=sensor)
    return dest
