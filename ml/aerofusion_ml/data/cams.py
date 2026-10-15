"""CAMS global forecasts (ADS, P1.7) -> leakage-safe input series for nodes and grid (PROGRESS §3.4, §3.6).

§3.6 asks for CAMS "analyses (lead 0)" as past inputs, but a run R is only available from R + CAMS_LATENCY_H (10 h),
so its lead 0 is never known at the hour it describes. Instead, the input value for hour t comes from the newest run
R <= t - (CAMS_LATENCY_H - 1) h, at lead t - R (9..20 h). That value is published at R + 10 h <= t + 1 h, so it is
usable under the same 1 h lag as CPCB observations, and the series does not depend on t0 (§9).
"""

from __future__ import annotations

import tempfile
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr

from . import manifest, windows

RAW = manifest.RAW / "cams_fc" / "v1"
VARS = {"pm2p5": "cams_pm25", "aod550": "cams_aod550", "duaod550": "cams_dust_aod"}
KG_TO_UG = 1e9  # pm2p5 is kg m-3
SHIFT_H = windows.CAMS_LATENCY_H - 1  # run R feeds hours t >= R + 9 h


def open_month(month: str) -> xr.Dataset:
    """dims (run, lead, latitude, longitude); pm2p5 in µg/m³; run tz-naive UTC, lead in hours."""
    with zipfile.ZipFile(RAW / f"{month}.zip") as z, tempfile.TemporaryDirectory() as tmp:
        z.extractall(tmp)
        with xr.open_dataset(Path(tmp) / "data_sfc.nc") as src:  # close before the temp dir is removed (Windows locks)
            ds = src.load()
    ds = ds.rename({"forecast_reference_time": "run", "forecast_period": "lead"})
    ds = ds.assign_coords(lead=(ds["lead"].values / np.timedelta64(1, "h")).astype(int))
    ds["pm2p5"] = ds["pm2p5"] * KG_TO_UG
    return ds[list(VARS)].transpose("run", "lead", "latitude", "longitude")


def at_points(ds: xr.Dataset, lat: np.ndarray, lon: np.ndarray) -> xr.Dataset:
    """Bilinear values at points -> dims (run, lead, point)."""
    return ds.interp(latitude=xr.DataArray(lat, dims="point"), longitude=xr.DataArray(lon, dims="point"))


def run_for(t: pd.DatetimeIndex) -> pd.DatetimeIndex:
    """Newest 00/12 UTC run R with R <= t - SHIFT_H."""
    return (t - pd.Timedelta(hours=SHIFT_H)).floor("12h")


def series(pts: xr.Dataset, times: pd.DatetimeIndex) -> dict[str, np.ndarray]:
    """pts: (run, lead, point) for consecutive months. Returns {feature: [len(times), point]} with hourly leads
    interpolated linearly between the two 3-hourly leads of the same run; NaN where the run is missing."""
    runs = pd.DatetimeIndex(pts["run"].values).tz_localize("UTC")
    leads = pts["lead"].values
    r = run_for(times)
    ri = runs.get_indexer(r)
    lead = ((times - r) / pd.Timedelta(hours=1)).to_numpy()
    lo = np.searchsorted(leads, lead, side="right") - 1
    hi = np.minimum(lo + 1, len(leads) - 1)
    w = np.where(hi > lo, (lead - leads[lo]) / np.maximum(leads[hi] - leads[lo], 1), 0.0)
    out = {}
    for v, name in VARS.items():
        a = pts[v].values  # [run, lead, point]
        val = np.full((len(times), a.shape[-1]), np.nan, dtype=np.float32)
        ok = ri >= 0
        val[ok] = (1 - w[ok, None]) * a[ri[ok], lo[ok]] + w[ok, None] * a[ri[ok], hi[ok]]
        out[name] = val
    return out


def months_available() -> list[str]:
    return sorted(p.stem for p in RAW.glob("*.zip"))
