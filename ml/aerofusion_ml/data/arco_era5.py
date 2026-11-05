"""ERA5 grid months from Google's public ARCO-ERA5 Zarr (same ECMWF ERA5 reanalysis, CC-BY-4.0, anonymous access).

Replaces the CDS route for `era5_grid` (PROGRESS §9, 2026-11-05): CDS jobs waited ~20 h each in the queue; ARCO serves a
month in minutes. Checked on 2017-12 against the CDS file: max |diff| u10/v10 5e-4 m/s, t2m 8e-4 K, blh 0.05 m (GRIB
packing precision). Output files have the same name, variables and coordinates as the CDS ones
(`era5_grid/v1/<YYYY-MM>.nc`: u10, v10, blh, t2m on valid_time x latitude x longitude), so build_v1/build_grid_v1 are unchanged.
"""

from __future__ import annotations

import pandas as pd
import xarray as xr

from . import manifest
from .copernicus import AREA

STORE = "gs://gcp-public-data-arco-era5/ar/full_37-1h-0p25deg-chunk-1.zarr-v3"
VARS = {"u10": "10m_u_component_of_wind", "v10": "10m_v_component_of_wind", "blh": "boundary_layer_height", "t2m": "2m_temperature"}
OUT = manifest.RAW / "era5_grid" / "v1"


def open_store() -> xr.Dataset:
    return xr.open_zarr(STORE, chunks=None, storage_options={"token": "anon"})


def month_dataset(ds: xr.Dataset, month: str) -> xr.Dataset:
    """3-hourly (00, 03, .. 21 UTC) fields for `month` on the native 0.25° grid inside the §3.2 India bbox."""
    n, w, s, e = AREA
    t0 = pd.Timestamp(f"{month}-01")
    times = pd.date_range(t0, t0 + pd.offsets.MonthEnd(0) + pd.Timedelta(hours=21), freq="3h")
    sub = ds[list(VARS.values())].sel(time=times, latitude=slice(n, s), longitude=slice(w, e)).load()
    out = sub.rename({v: k for k, v in VARS.items()}).rename({"time": "valid_time"})
    for k in VARS:
        out[k] = out[k].astype("float32")
        if bool(out[k].isnull().any()):  # the store pre-allocates its time axis; unfilled steps read as NaN
            raise ValueError(f"ARCO-ERA5 {month} {k}: missing values (not yet published in the store?)")
    out.attrs = {"source": "ARCO-ERA5 (Google Research), ECMWF ERA5 reanalysis", "store": STORE, "license": "CC-BY-4.0"}
    return out


def download(ds: xr.Dataset, month: str) -> tuple[str, float]:
    dest = OUT / f"{month}.nc"
    if dest.exists():
        return month, 0.0
    OUT.mkdir(parents=True, exist_ok=True)
    part = dest.with_name(dest.name + ".part")
    month_dataset(ds, month).to_netcdf(part)
    part.replace(dest)
    manifest.record(dest, f"{STORE}#{month}", source="era5_grid", provider="arco-era5", variables=list(VARS.values()), area=AREA)
    return month, dest.stat().st_size / 1e6
