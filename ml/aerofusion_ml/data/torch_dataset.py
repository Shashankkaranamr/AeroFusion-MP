"""PyTorch dataset over dataset_v1 + grid_v1 (PROGRESS §3.9 batch contract). Windows are cut on the fly through
loader.sample / windows.py, never materialised. Normalisation stats are fitted on the train split only.

Lags on the grid (3-hourly steps t): ERA5 and CAMS channels like met (step t usable if t <= t0 - 1 h); FRP step t holds
acquisitions in (t, t+3h], usable from t+3h+3h, so FRP steps with t > t0 - 6 h are hidden.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import torch
import xarray as xr
import yaml

from . import loader, windows

ML = Path(__file__).resolve().parents[2]
GRID_STEPS = 24
FRP_HIDE_H = windows.FIRMS_LATENCY_H + 3


class Stats:
    """Per-feature mean/std on train rows (NaN-aware); y in log1p space by default (chosen on val in P3)."""

    def __init__(self, x_train: np.ndarray, y_train: np.ndarray, log_target: bool = True):
        flat = x_train.reshape(-1, x_train.shape[-1]).astype(np.float64)
        self.x_mean = np.nanmean(flat, 0).astype(np.float32)
        sd = np.nanstd(flat, 0)
        self.x_std = np.where(sd > 0, sd, 1.0).astype(np.float32)
        self.log_target = log_target
        yt = np.log1p(np.clip(y_train, 0, None)) if log_target else y_train
        self.y_mean, self.y_std = float(np.nanmean(yt)), float(np.nanstd(yt) or 1.0)

    def y_fwd(self, y):
        return ((np.log1p(np.clip(y, 0, None)) if self.log_target else y) - self.y_mean) / self.y_std

    def y_inv(self, z):
        v = z * self.y_std + self.y_mean
        return np.expm1(v) if self.log_target else v

    def to_dict(self) -> dict:
        return {"x_mean": self.x_mean.tolist(), "x_std": self.x_std.tolist(), "y_mean": self.y_mean, "y_std": self.y_std, "log_target": self.log_target}


class WindowDataset(torch.utils.data.Dataset):
    def __init__(self, arrays: loader.NodeArrays, t0s: pd.DatetimeIndex, stats: Stats, grid: xr.DataArray | None = None,
                 grid_stats: tuple[np.ndarray, np.ndarray] | None = None):
        self.a, self.t0s, self.stats, self.grid, self.grid_stats = arrays, t0s, stats, grid, grid_stats
        self.iu, self.iv = arrays.feats.index("u10"), arrays.feats.index("v10")
        if grid is not None:
            self.gtimes = pd.DatetimeIndex(grid.time.values).tz_localize("UTC")
            self.frp = list(grid.channel.values).index("frp")

    def __len__(self):
        return len(self.t0s)

    def __getitem__(self, i):
        t0 = self.t0s[i]
        s = loader.sample(self.a, t0)
        x = (s["x_node"] - self.stats.x_mean) / self.stats.x_std
        wind = np.nanmean(s["x_node"][-6:, :, [self.iu, self.iv]], axis=0)  # raw m/s, past only
        out = {"x_node": np.nan_to_num(x).astype(np.float32), "m_node": s["m_node"], "wind_uv": np.nan_to_num(wind).astype(np.float32),
               "y": self.stats.y_fwd(s["y"]).astype(np.float32), "y_mask": s["y_mask"], "t0_ns": np.int64(t0.value)}
        if self.grid is not None:
            last = self.gtimes.searchsorted(t0 - pd.Timedelta(hours=1), side="right") - 1
            idx = np.arange(last - GRID_STEPS + 1, last + 1)
            g = self.grid.isel(time=idx).values.astype(np.float32)  # [Tg, C, H, W]
            hide = self.gtimes[idx] > t0 - pd.Timedelta(hours=FRP_HIDE_H)
            g[hide, self.frp] = np.nan
            mu, sd = self.grid_stats
            out["x_grid"] = np.nan_to_num((g - mu[None, :, None, None]) / sd[None, :, None, None]).astype(np.float32)
        return {k: torch.from_numpy(np.asarray(v)) for k, v in out.items()}


def issue_times(times: pd.DatetimeIndex, split: dict, hours: list[int] | None, stop: pd.Timestamp) -> pd.DatetimeIndex:
    lo = pd.Timestamp(split["start"], tz="UTC") + pd.Timedelta(hours=windows.WINDOW_H)
    hi = min(pd.Timestamp(split["end"], tz="UTC") + pd.Timedelta(hours=23), stop) - pd.Timedelta(hours=windows.HORIZON_H)
    t = times[(times >= lo) & (times <= hi)]
    return t[t.hour.isin(hours)] if hours else t


def build(cfg: dict, splits_to_load=("train", "val")) -> dict:
    """Load arrays, fit train stats, and return datasets for the requested non-frozen splits."""
    if any(s in ("test", "extra_pm_only") for s in splits_to_load):
        raise PermissionError("frozen splits are loaded only by scripts/final_eval.py (P4)")
    sp = yaml.safe_load((ML / "configs" / "splits_v1.yaml").read_text(encoding="utf-8"))
    # smoke tests may shrink train/val to a few weeks; they can never point at frozen dates (checked below)
    for k, v in (cfg.get("splits_override") or {}).items():
        if k not in ("train", "val") or pd.Timestamp(v["end"]) >= pd.Timestamp(sp["splits"]["test"]["start"]):
            raise PermissionError("splits_override may only shrink train/val")
        sp["splits"][k] = v
    feats_cfg = yaml.safe_load((ML / "configs" / "features_v1.yaml").read_text(encoding="utf-8"))
    stop = pd.Timestamp(sp["splits"]["val"]["end"], tz="UTC") + pd.Timedelta(hours=23)  # nothing after val is read
    first = pd.Timestamp(sp["splits"]["train"]["start"]) - pd.Timedelta(hours=windows.WINDOW_H + 1)
    a = loader.NodeArrays.from_zarr(ML / cfg.get("dataset", "data/processed/dataset_v1.zarr"), feats_cfg, first, stop.tz_convert(None))
    tr = sp["splits"]["train"]
    sel = (a.times >= pd.Timestamp(tr["start"], tz="UTC")) & (a.times <= pd.Timestamp(tr["end"], tz="UTC") + pd.Timedelta(hours=23))
    stats = Stats(a.x[sel], a.y[sel], cfg.get("log_target", True))
    grid = gstats = None
    if cfg.get("use_grid", False):
        g = xr.open_zarr(ML / cfg.get("grid", "data/processed/grid_v1.zarr"))["x_grid"]
        g = g.sel(time=slice(first, stop.tz_convert(None)))
        gt = g.sel(time=slice(tr["start"], tr["end"] + " 23:00")).values
        gstats = (np.nanmean(gt, axis=(0, 2, 3)).astype(np.float32), np.maximum(np.nanstd(gt, axis=(0, 2, 3)), 1e-6).astype(np.float32))
        grid = g.load()
    out = {"arrays": a, "stats": stats, "grid_stats": gstats}
    for name in splits_to_load:
        hours = cfg.get("train_issue_hours") if name == "train" else sp["issue_hours_eval"]
        out[name] = WindowDataset(a, issue_times(a.times, sp["splits"][name], hours, stop), stats, grid, gstats)
    return out
