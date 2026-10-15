"""Issue-time input windows (PROGRESS §3.4 latencies, §3.9 batch contract). Everything a model sees at issue time t0
goes through these functions, so the leakage tests (tests/test_no_leakage.py) only have to cover them.

Hourly arrays share a UTC time axis; a value stamped t covers (t, t+1h] (P1.2), so "usable at t0" means t <= t0 - lag.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

WINDOW_H = 72
HORIZON_H = 48
FIRMS_LATENCY_H = 3  # §3.4 `firms_latency_h`: a detection is usable from acquisition + 3 h
# Lag on the slot stamp t, where slot t covers (t, t+1h]. CPCB/met slots end at t+1h, so t <= t0-1h means "ended by t0".
# A fire slot holds acquisitions in (t, t+1h], usable from t+1h+3h, so its lag is latency + 1 (not 3: that leaks <= 1 h).
LAG_H = {"obs": 1, "met": 1, "fire": FIRMS_LATENCY_H + 1, "cams": 1}  # cams: series built so hour t is published by t+1h (data/cams.py)
CAMS_LATENCY_H = 10  # §3.4: run R usable from R + 10 h (VERIFY typical availability; config `cams_latency_h`)
CAMS_RUN_HOURS = (0, 12)


def window_index(times: pd.DatetimeIndex, t0: pd.Timestamp, kind: str, window: int = WINDOW_H) -> np.ndarray:
    """Integer positions of the `window` hours ending at t0 - LAG_H[kind] (inclusive), oldest first.
    Raises if the window would start before the array or if t0 is not on the hourly grid."""
    last = t0 - pd.Timedelta(hours=LAG_H[kind])
    pos = times.get_indexer([last])[0]
    if pos < 0:
        raise KeyError(f"{last} not on the time axis")
    if pos - window + 1 < 0:
        raise IndexError("window starts before the data")
    return np.arange(pos - window + 1, pos + 1)


def target_index(times: pd.DatetimeIndex, t0: pd.Timestamp, horizon: int = HORIZON_H) -> np.ndarray:
    """Positions of t0+1h .. t0+horizon (the values y[t0+h] the model predicts)."""
    pos = times.get_indexer([t0])[0]
    if pos < 0 or pos + horizon >= len(times):
        raise IndexError("target horizon outside the data")
    return np.arange(pos + 1, pos + horizon + 1)


def fire_slot(acq_utc: pd.Series) -> pd.Series:
    """FIRMS acquisition time -> slot stamp t with acq in (t, t+1h] (same convention as P1.2)."""
    return acq_utc.dt.ceil("h") - pd.Timedelta(hours=1)


def latest_cams_run(t0: pd.Timestamp, latency_h: int = CAMS_LATENCY_H) -> pd.Timestamp:
    """Newest 00/12 UTC run R with R + latency <= t0."""
    r = (t0 - pd.Timedelta(hours=latency_h)).floor("h")
    while r.hour not in CAMS_RUN_HOURS:
        r -= pd.Timedelta(hours=1)
    return r


def cams_leads(t0: pd.Timestamp, run: pd.Timestamp, horizon: int = HORIZON_H) -> np.ndarray:
    """Lead hours of `run` that verify at t0+1 .. t0+horizon (e.g. t0 = 12 UTC, run 00 UTC -> 13..60)."""
    base = int((t0 - run) / pd.Timedelta(hours=1))
    return base + np.arange(1, horizon + 1)


def issue_inputs(t0: pd.Timestamp, times: pd.DatetimeIndex, arrays: dict[str, tuple[str, np.ndarray]]) -> dict[str, np.ndarray]:
    """{name: (kind, array[time, ...])} -> {name: array[WINDOW_H, ...]} using only data usable at t0."""
    return {name: a[window_index(times, t0, kind)] for name, (kind, a) in arrays.items()}


@dataclass
class Normalizer:
    """Per-feature mean/std fitted on the train split only (§0 rule: normalisation is fit on train)."""

    mean: np.ndarray
    std: np.ndarray
    fit_start: pd.Timestamp
    fit_end: pd.Timestamp

    @classmethod
    def fit(cls, x: np.ndarray, times: pd.DatetimeIndex, train: dict) -> "Normalizer":
        start = pd.Timestamp(train["start"], tz="UTC")
        end = pd.Timestamp(train["end"], tz="UTC") + pd.Timedelta(hours=23)
        sel = (times >= start) & (times <= end)
        if not sel.any():
            raise ValueError("no train rows on this time axis")
        xs = x[sel].reshape(int(sel.sum()), -1, x.shape[-1]).reshape(-1, x.shape[-1])
        mean = np.nanmean(xs, axis=0)
        std = np.nanstd(xs, axis=0)
        return cls(mean=mean, std=np.where(std > 0, std, 1.0), fit_start=start, fit_end=end)

    def __call__(self, x: np.ndarray) -> np.ndarray:
        return (x - self.mean) / self.std
