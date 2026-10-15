"""0.75° India grid for the ConvLSTM (PROGRESS §3.2: 5–38 °N, 66–98 °E, 44 × 43 cells, 3-hourly).

Cells are 3 × 3 blocks of ERA5 0.25° points: latitude points 5.00..37.75 (the 38.00 row is dropped) and longitude points
66.00..98.00, so cell centres are lat 5.25 + 0.75 i (i < 44) and lon 66.25 + 0.75 j (j < 43). ERA5 fields are block
means; CAMS (0.4°) is bilinearly interpolated to the centres; FIRMS FRP is summed per cell and 3-hour slot.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import xarray as xr

NLAT, NLON = 44, 43
LAT = 5.25 + 0.75 * np.arange(NLAT)
LON = 66.25 + 0.75 * np.arange(NLON)
ERA5_VARS = ["u10", "v10", "blh", "t2m"]


def coarsen_era5(ds: xr.Dataset) -> xr.Dataset:
    """ERA5 0.25° India subset (latitude descending 38..5, longitude 66..98) -> 44 × 43 block means, latitude ascending."""
    ds = ds.sortby("latitude").sel(latitude=slice(4.99, 37.76), longitude=slice(65.99, 98.01))
    if ds.sizes["latitude"] != 3 * NLAT or ds.sizes["longitude"] != 3 * NLON:
        raise ValueError(f"unexpected ERA5 subset {dict(ds.sizes)}")
    out = ds[ERA5_VARS].coarsen(latitude=3, longitude=3).mean()
    return out.assign_coords(latitude=LAT, longitude=LON)


def frp_raster(det: pd.DataFrame, times: pd.DatetimeIndex) -> np.ndarray:
    """det: lat, lon, frp, slot (hourly slot stamps, windows.fire_slot). Returns [len(times), 44, 43] summed FRP per
    3-hour step: step t holds slots t .. t+2h (acquisitions in (t, t+3h]); the issue-time lag is applied by the loader."""
    i = np.floor((det["lat"].to_numpy() - 4.875) / 0.75).astype(int)  # cell i spans 4.875 + 0.75 i .. +0.75
    j = np.floor((det["lon"].to_numpy() - 65.875) / 0.75).astype(int)
    step = det["slot"].dt.floor("3h")
    k = times.get_indexer(step)
    ok = (i >= 0) & (i < NLAT) & (j >= 0) & (j < NLON) & (k >= 0)
    out = np.zeros((len(times), NLAT, NLON), dtype=np.float32)
    np.add.at(out, (k[ok], i[ok], j[ok]), det["frp"].to_numpy(dtype=np.float32)[ok])
    return out
