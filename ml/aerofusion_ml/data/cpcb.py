"""CPCB/XKDR measurements -> wide UTC hourly frames (time x station) for the frozen panel (PROGRESS P1.10 input).

IST labels are converted with `xkdr.to_utc_hour`. Rare duplicate (station, hour) rows are averaged and counted.
"""

from __future__ import annotations

import pandas as pd

from . import stations as st, xkdr

PARAMS = {"PM2.5": "pm25", "PM10": "pm10", "NO2": "no2", "CO": "co", "Ozone": "o3"}  # CO in mg/m³, the rest µg/m³


def load_long(station_ids: list[str], start: str, end: str) -> pd.DataFrame:
    """Rows (station_id, t UTC, pollutant, value) for months start..end (YYYY-MM) of the bulk export."""
    parts = []
    for f in st.month_files(start, end):
        m = pd.read_parquet(f, columns=["station_id", "parameter_name", "collected_at", "value"],
                            filters=[("parameter_name", "in", list(PARAMS)), ("station_id", "in", list(station_ids))])
        parts.append(pd.DataFrame({"station_id": m["station_id"].astype(str), "t": xkdr.to_utc_hour(m["collected_at"]),
                                   "pollutant": m["parameter_name"].map(PARAMS), "value": m["value"].astype(float)}))
    return pd.concat(parts, ignore_index=True)


def wide(long: pd.DataFrame, pollutant: str, station_ids: list[str], t0: str, t1: str) -> tuple[pd.DataFrame, int]:
    """Complete hourly UTC index t0..t1 (inclusive) x station_ids; returns (frame, n_duplicate_rows_averaged)."""
    d = long[long["pollutant"] == pollutant]
    dup = int(d.duplicated(["station_id", "t"]).sum())
    w = d.groupby(["t", "station_id"])["value"].mean().unstack("station_id")
    idx = pd.date_range(pd.Timestamp(t0, tz="UTC"), pd.Timestamp(t1, tz="UTC"), freq="h")
    return w.reindex(index=idx, columns=station_ids), dup
