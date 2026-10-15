"""Calendar/event features per UTC hour (PROGRESS §3.6 calendar + traffic-proxy groups, P1.9).

Every feature is a deterministic function of the clock, so it is known in advance and is leak-free at any lead.
Local time for India is IST = UTC + 5:30.
"""

from __future__ import annotations

from pathlib import Path

import holidays
import numpy as np
import pandas as pd
import yaml

CONFIG = Path(__file__).resolve().parents[2] / "configs" / "events.yaml"
IST = pd.Timedelta(hours=5, minutes=30)


def load(path: Path = CONFIG) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def calendar_features(times: pd.DatetimeIndex, cfg: dict | None = None) -> pd.DataFrame:
    """times: tz-aware UTC hours. Returns one row per time with the calendar feature columns."""
    if times.tz is None or str(times.tz) != "UTC":
        raise ValueError("times must be tz-aware UTC")
    cfg = cfg or load()
    local = times.tz_convert(None) + IST
    day = local.normalize()
    hour = local.hour + local.minute / 60
    doy = local.dayofyear - 1
    ndays = np.where(local.is_leap_year, 366, 365)

    diwali = pd.to_datetime(cfg["diwali"]["dates"])
    lo, hi = cfg["diwali"]["window_days"]
    win = {d + pd.Timedelta(days=k) for d in diwali for k in range(lo, hi + 1)}
    years = sorted(set(local.year))
    hol = holidays.India(years=years)
    mmdd = local.strftime("%m-%d")
    lock = cfg["lockdown"]

    return pd.DataFrame(
        {
            "weekday": local.weekday.astype(np.float32),
            "holiday": np.array([d.date() in hol for d in day], dtype=np.float32),
            "hour_sin": np.sin(2 * np.pi * hour / 24),
            "hour_cos": np.cos(2 * np.pi * hour / 24),
            "doy_sin": np.sin(2 * np.pi * doy / ndays),
            "doy_cos": np.cos(2 * np.pi * doy / ndays),
            "diwali_window": day.isin(list(win)).astype(np.float32),
            "stubble_season": ((mmdd >= cfg["stubble_season"]["start"]) & (mmdd <= cfg["stubble_season"]["end"])).astype(np.float32),
            "lockdown": ((day >= pd.Timestamp(lock["start"])) & (day <= pd.Timestamp(lock["end"]))).astype(np.float32),
        },
        index=times,
    ).astype(np.float32)
