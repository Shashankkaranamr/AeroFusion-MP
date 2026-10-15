"""P1.10 grid part: ml/data/processed/grid_v1.zarr, dims time (UTC 3-hourly), channel, lat (44), lon (43).

    python ml/scripts/build_grid_v1.py

Channels: ERA5 u10, v10, blh, t2m (block means of the CDS 0.25° grid, instantaneous at the step time), FIRMS FRP
(sum over acquisitions in (t, t+3h]), CAMS pm2p5/aod550/duaod550 (data/cams.py series, lead 9..18 h). Missing months stay NaN
and are listed in attrs["pending"]. Lags are applied by the loader (ERA5 like met, FRP like fires).
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML))
from aerofusion_ml.data import cams, fires, grid, manifest  # noqa: E402

OUT = ML / "data" / "processed" / "grid_v1.zarr"
T0, T1 = "2017-12-01 00:00", "2025-09-30 21:00"
CHANNELS = [*grid.ERA5_VARS, "frp", "cams_pm25", "cams_aod550", "cams_dust_aod"]


def main() -> None:
    times = pd.date_range(pd.Timestamp(T0, tz="UTC"), pd.Timestamp(T1, tz="UTC"), freq="3h")
    det = fires.load_detections(fires.files())
    pending = {"era5_missing_months": [], "cams_missing_months": []}
    glat, glon = np.meshgrid(grid.LAT, grid.LON, indexing="ij")
    have = set(cams.months_available())
    first = True
    for year in sorted(set(times.year)):
        t = times[times.year == year]
        a = np.full((len(t), len(CHANNELS), grid.NLAT, grid.NLON), np.nan, dtype=np.float32)
        for month in sorted(set(t.strftime("%Y-%m"))):
            f = manifest.RAW / "era5_grid" / "v1" / f"{month}.nc"
            if not f.exists():
                pending["era5_missing_months"].append(month)
                continue
            g = grid.coarsen_era5(xr.open_dataset(f))
            vt = pd.DatetimeIndex(g["valid_time"].values).tz_localize("UTC")
            k = t.get_indexer(vt)
            for c, v in enumerate(grid.ERA5_VARS):
                a[k[k >= 0], c] = g[v].values[k >= 0]
        a[:, CHANNELS.index("frp")] = grid.frp_raster(det[det["slot"].dt.year == year], t)
        r = cams.run_for(t)
        for month in sorted(set(r.strftime("%Y-%m"))):
            sel = np.where(r.strftime("%Y-%m") == month)[0]
            if month not in have:
                pending["cams_missing_months"].append(month)
                continue
            pts = cams.at_points(cams.open_month(month), glat.ravel(), glon.ravel())
            for k, v in cams.series(pts, t[sel]).items():
                a[sel, CHANNELS.index(k)] = v.reshape(len(sel), grid.NLAT, grid.NLON)
        ds = xr.Dataset({"x_grid": (("time", "channel", "lat", "lon"), a)},
                        coords={"time": t.tz_convert(None), "channel": CHANNELS, "lat": grid.LAT, "lon": grid.LON})
        if first:
            ds.attrs = {"version": "v1", "created": datetime.now(timezone.utc).isoformat(timespec="seconds")}
            ds.to_zarr(OUT, mode="w", encoding={"x_grid": {"chunks": (8 * 30, len(CHANNELS), grid.NLAT, grid.NLON)}}, consolidated=True)
            first = False
        else:
            ds.to_zarr(OUT, append_dim="time", consolidated=True)
        print(f"  {year}: {len(t)} steps", flush=True)
    import zarr

    root = zarr.open_group(str(OUT), mode="r+")
    root.attrs.update({"pending": json.dumps(pending), "status": "partial"})
    zarr.consolidate_metadata(str(OUT))
    print("pending:", pending)


if __name__ == "__main__":
    main()
