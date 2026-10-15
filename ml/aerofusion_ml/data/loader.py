"""Issue-time samples from dataset_v1 (PROGRESS §3.9 batch contract, node part). numpy only; the torch wrapper is P2.

All features share the 72 hourly timestamps t0-72h .. t0-1h. A feature whose latency lag is longer than 1 h (fires:
4 h, see windows.LAG_H) has its most recent hours masked (x = NaN, m = 0) instead of being shifted, so the time axis
stays aligned. Calendar features are known in advance and use the same window.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from . import windows

GROUP_KIND = {"history": "obs", "traffic_proxy": "obs", "met": "met", "fire": "fire", "calendar": "obs", "cams": "cams", "dust": "cams"}
CALENDAR = {"weekday", "holiday", "hour_sin", "hour_cos", "doy_sin", "doy_cos", "diwali_window", "stubble_season", "lockdown"}


@dataclass
class NodeArrays:
    times: pd.DatetimeIndex  # tz-aware UTC
    x: np.ndarray  # [T, N, F]
    m: np.ndarray  # [T, N, F]
    y: np.ndarray  # [T, N]
    feats: list[str]
    groups: list[str]

    @classmethod
    def from_zarr(cls, path, features_cfg: dict) -> "NodeArrays":
        import xarray as xr

        ds = xr.open_zarr(path)
        feats = list(ds.feat.values)
        gmap = {f["key"]: f["group"] for f in features_cfg["features"]}
        return cls(pd.DatetimeIndex(ds.time.values).tz_localize("UTC"), ds.x_node.values, ds.m_node.values, ds.y.values, feats, [gmap[f] for f in feats])

    def lags(self) -> np.ndarray:
        """Per-feature lag in hours (calendar: 1, i.e. same window as observations)."""
        out = []
        for f, g in zip(self.feats, self.groups):
            kind = "obs" if f in CALENDAR else GROUP_KIND[g]
            out.append(windows.LAG_H[kind])
        return np.array(out)


def sample(a: NodeArrays, t0: pd.Timestamp) -> dict[str, np.ndarray]:
    idx = windows.window_index(a.times, t0, "obs")  # t0-72h .. t0-1h
    x, m = a.x[idx].copy(), a.m[idx].copy()
    lag = a.lags()
    win_t = a.times[idx]
    for j, L in enumerate(lag):
        hide = np.ones(len(idx), bool) if L < 0 else (win_t > t0 - pd.Timedelta(hours=int(L)))
        x[hide, :, j] = np.nan
        m[hide, :, j] = 0
    tgt = windows.target_index(a.times, t0)
    y = a.y[tgt]
    return {"x_node": x, "m_node": m, "y": y, "y_mask": (~np.isnan(y)).astype(np.uint8), "t0": np.datetime64(t0.tz_convert(None))}
