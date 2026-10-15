"""Station QC rules (PROGRESS §3.7). Frames are wide: UTC hourly DatetimeIndex (complete, no missing rows) x station_id.

Order: sentinels/bounds -> flatline -> spike. Every rule only removes (sets NaN) or flags; nothing is filled here
except `fill_short_gaps`, which is for *inputs* only (targets are never filled).

The spike rule uses a trailing window (hours t-24..t-1), so cleaning a value never looks at data after it. The same
rule can therefore run on live data, and it never leaks the future into an input.
"""

from __future__ import annotations

import warnings

import numpy as np
import pandas as pd
from numpy.lib.stride_tricks import sliding_window_view

BOUNDS = {"pm25": (0.0, 1500.0), "pm10": (0.0, 2000.0)}
SENTINELS = (999.0, 9999.0, 99999.0)
FLATLINE_H = 6
SPIKE_WINDOW_H = 24
SPIKE_MIN_OBS = 12
SPIKE_K = 6.0
MAD_SCALE = 1.4826  # Hampel convention: scaled MAD estimates sigma, so the threshold is ~6 robust SDs
MAD_FLOOR = 1.0  # µg/m³; stops a near-constant window from flagging every small change
RATIO_TOL = 1.05
MAX_INPUT_GAP_H = 3


def _check(df: pd.DataFrame) -> None:
    if not isinstance(df.index, pd.DatetimeIndex) or df.index.tz is None or str(df.index.tz) != "UTC":
        raise ValueError("QC frames need a tz-aware UTC DatetimeIndex")
    if len(df) > 1 and (df.index.to_series().diff().dropna() != pd.Timedelta(hours=1)).any():
        raise ValueError("QC frames need a complete hourly index (reindex first; missing hours = NaN rows)")


def sentinels_and_bounds(df: pd.DataFrame, pollutant: str) -> tuple[pd.DataFrame, int]:
    lo, hi = BOUNDS.get(pollutant, (0.0, np.inf))
    bad = df.isin(SENTINELS) | (df < lo) | (df > hi)
    return df.mask(bad), int(bad.sum().sum())


def flatline(df: pd.DataFrame, hours: int = FLATLINE_H) -> tuple[pd.DataFrame, int]:
    """The same value for >= `hours` consecutive hours -> NaN for the whole run. A NaN breaks a run."""
    bad = pd.DataFrame(False, index=df.index, columns=df.columns)
    for col in df.columns:
        s = df[col]
        run_id = (s != s.shift()).cumsum()
        run_len = s.groupby(run_id).transform("size")
        bad[col] = s.notna() & (run_len >= hours)
    return df.mask(bad), int(bad.sum().sum())


def spike_flags(df: pd.DataFrame, window: int = SPIKE_WINDOW_H, k: float = SPIKE_K) -> pd.DataFrame:
    """True where |x_t - median(x_{t-w..t-1})| > k * 1.4826 * MAD of that window (needs >= SPIKE_MIN_OBS past values).
    Raw MAD from 24 values is unstable (6 x raw MAD can be < 3 sigma), hence the sigma-consistent scaling."""
    out = np.zeros(df.shape, dtype=bool)
    for j, col in enumerate(df.columns):
        x = df[col].to_numpy(dtype=float)
        if len(x) <= window:
            continue
        past = sliding_window_view(x[:-1], window)  # row i covers x[i .. i+window-1], i.e. the hours before x[i+window]
        n = np.sum(~np.isnan(past), axis=1)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)  # all-NaN windows
            med = np.nanmedian(past, axis=1)
            mad = np.nanmedian(np.abs(past - med[:, None]), axis=1)
        cur = x[window:]
        dev = np.abs(cur - med)
        out[window:, j] = (n >= SPIKE_MIN_OBS) & ~np.isnan(cur) & (dev > k * np.maximum(MAD_SCALE * mad, MAD_FLOOR))
    return pd.DataFrame(out, index=df.index, columns=df.columns)


def spike(df: pd.DataFrame, city_of: dict[str, str]) -> tuple[pd.DataFrame, int, int]:
    """Remove spikes, unless >= 2 stations in the same city spike in the same hour (a real event).
    Returns (frame, n_removed, n_kept_as_city_event)."""
    flags = spike_flags(df)
    cities = pd.Series({c: city_of.get(c, c) for c in df.columns})
    per_city = flags.T.groupby(cities).transform("sum").T  # number of same-city stations spiking that hour
    event = flags & (per_city >= 2)
    bad = flags & ~event
    return df.mask(bad), int(bad.sum().sum()), int(event.sum().sum())


def pm_ratio_flags(pm25: pd.DataFrame, pm10: pd.DataFrame, tol: float = RATIO_TOL) -> pd.DataFrame:
    """PM2.5 > PM10 x tol. Flag only (kept in the data, counted in the data card)."""
    pm10 = pm10.reindex(index=pm25.index, columns=pm25.columns)
    return (pm25 > pm10 * tol).fillna(False)


def fill_short_gaps(df: pd.DataFrame, max_gap: int = MAX_INPUT_GAP_H) -> pd.DataFrame:
    """INPUTS ONLY: linearly interpolate interior gaps of <= max_gap hours; longer gaps stay NaN (and masked)."""
    filled = df.interpolate(method="linear", limit_area="inside")
    for col in df.columns:
        s = df[col]
        gap_id = s.notna().cumsum()
        gap_len = s.isna().groupby(gap_id).transform("sum")
        filled.loc[s.isna() & (gap_len > max_gap), col] = np.nan
    return filled


def run_qc(df: pd.DataFrame, pollutant: str, city_of: dict[str, str]) -> tuple[pd.DataFrame, dict]:
    """Full chain for one pollutant. Returns the cleaned frame and per-rule counts for the data card."""
    _check(df)
    n_obs = int(df.notna().sum().sum())
    df, n_bounds = sentinels_and_bounds(df, pollutant)
    df, n_flat = flatline(df)
    df, n_spike, n_event = spike(df, city_of)
    stats = {"pollutant": pollutant, "observed": n_obs, "removed_bounds_sentinel": n_bounds, "removed_flatline": n_flat, "removed_spike": n_spike, "kept_city_event": n_event, "remaining": int(df.notna().sum().sum())}
    return df, stats

