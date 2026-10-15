"""LightGBM baselines (PROGRESS P2.3): S-A "lags + met" and S-B "MOS" (+ CAMS forecast at the matched lead).

One model for all leads (lead is a feature). Features are cut from loader.sample(), i.e. the same leakage-tested
issue-time window the neural models see (fires already hidden for t > t0 - 4 h), plus calendar features of the
*valid* time (known in advance) and static node descriptors. Target: log1p PM2.5 at t0 + lead.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from ..data import loader

LAGS = [1, 2, 3, 6, 12, 24, 48, 72]  # hours before t0 (lag 1 = the value stamped t0 - 1 h)
NOW = ["pm10", "no2", "co", "o3", "t2m", "rh", "u10", "v10", "wind_speed", "pressure", "precip", "blh", "ventilation", "cams_pm25", "cams_aod550", "cams_dust_aod"]
FIRE = ["fires_300km", "frp_300km", "fires_upwind_500km"]


def _last_valid(win: np.ndarray) -> np.ndarray:
    """win [T, N] -> last non-NaN value per node (NaN if none)."""
    ok = ~np.isnan(win)
    idx = np.where(ok.any(0), win.shape[0] - 1 - np.argmax(ok[::-1], axis=0), 0)
    out = win[idx, np.arange(win.shape[1])]
    return np.where(ok.any(0), out, np.nan)


def features(a: loader.NodeArrays, t0: pd.Timestamp, leads: np.ndarray, nodes: np.ndarray, static: pd.DataFrame,
             cams_fc: np.ndarray | None = None) -> pd.DataFrame:
    """Rows for every (node in `nodes`, lead in `leads`). cams_fc: [48, N] CAMS forecast valid at t0+1..t0+48 (S-B)."""
    s = loader.sample(a, t0)
    x = s["x_node"]  # [72, N, F], hidden values already NaN
    f = {k: i for i, k in enumerate(a.feats)}
    base = {}
    pm = x[:, :, f["pm25"]]
    for L in LAGS:
        base[f"pm25_lag{L}"] = pm[-L]
    base["pm25_mean24"] = np.nanmean(pm[-24:], 0)
    base["pm25_max24"] = np.nanmax(np.where(np.isnan(pm[-24:]), -np.inf, pm[-24:]), 0)
    base["pm25_max24"][np.isinf(base["pm25_max24"])] = np.nan
    for k in NOW:
        base[k] = _last_valid(x[-6:, :, f[k]])
    for k in FIRE:
        base[f"{k}_sum24"] = np.nansum(x[-24:, :, f[k]], 0)
    rows = []
    for lead in leads:
        valid = t0 + pd.Timedelta(hours=int(lead))
        d = pd.DataFrame({k: v[nodes] for k, v in base.items()})
        d["lead"] = lead
        loc = valid.tz_convert(None) + pd.Timedelta(hours=5, minutes=30)
        d["v_hour_sin"], d["v_hour_cos"] = np.sin(2 * np.pi * loc.hour / 24), np.cos(2 * np.pi * loc.hour / 24)
        d["v_doy_sin"], d["v_doy_cos"] = np.sin(2 * np.pi * loc.dayofyear / 366), np.cos(2 * np.pi * loc.dayofyear / 366)
        d["v_weekday"] = loc.weekday()
        if cams_fc is not None:
            d["cams_fc_pm25"] = cams_fc[lead - 1, nodes]
        d["node_idx"] = nodes
        d = d.join(static.iloc[nodes].reset_index(drop=True))
        d["t0"], d["lead_h"] = t0, lead
        rows.append(d)
    return pd.concat(rows, ignore_index=True)


def target(a: loader.NodeArrays, t0: pd.Timestamp, leads: np.ndarray, nodes: np.ndarray) -> np.ndarray:
    pos = a.times.get_loc(t0)
    return np.concatenate([a.y[pos + int(L), nodes] for L in leads])


PARAMS = dict(objective="huber", alpha=1.0, learning_rate=0.05, num_leaves=63, min_data_in_leaf=200, feature_fraction=0.8,
              bagging_fraction=0.8, bagging_freq=1, lambda_l2=1.0, verbose=-1)
