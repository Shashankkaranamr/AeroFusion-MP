"""Grid helpers (§3.2): ERA5 coarsening to 44 × 43 and the FIRMS FRP raster."""

import numpy as np
import pandas as pd
import xarray as xr

from aerofusion_ml.data import grid


def _era5_like():
    lat = np.arange(38.0, 4.99, -0.25)  # 133 points, descending like the CDS files
    lon = np.arange(66.0, 98.01, 0.25)  # 129 points
    t = pd.date_range("2019-11-01", periods=2, freq="3h")
    data = np.broadcast_to(lat[None, :, None], (2, len(lat), len(lon))).astype("f4")
    return xr.Dataset({v: (("valid_time", "latitude", "longitude"), data) for v in grid.ERA5_VARS},
                      coords={"valid_time": t, "latitude": lat, "longitude": lon})


def test_coarsen_gives_44_by_43_block_means_at_cell_centres():
    out = grid.coarsen_era5(_era5_like())
    assert out["blh"].shape == (2, 44, 43)
    np.testing.assert_allclose(out["blh"].values[0, :, 0], grid.LAT)  # mean of 3 latitudes = centre latitude
    assert out.latitude.values[-1] == 37.5 and out.longitude.values[-1] == 97.75


def test_frp_raster_cells_and_3h_steps():
    times = pd.date_range("2019-11-01", periods=4, freq="3h", tz="UTC")
    det = pd.DataFrame({"lat": [5.25, 4.9, 37.8, 28.6], "lon": [66.25, 66.25, 97.9, 77.2], "frp": [1.0, 2.0, 3.0, 4.0],
                        "slot": pd.to_datetime(["2019-11-01 00:00", "2019-11-01 02:00", "2019-11-01 04:00", "2019-11-01 23:00"], utc=True)})
    r = grid.frp_raster(det, times)
    assert r[0, 0, 0] == 3.0  # both first detections fall in cell (0, 0), step 00-03
    assert r[1, 43, 42] == 3.0  # NE corner (top row ends at 37.875 N), step 03-06
    assert r.sum() == 6.0  # the 23:00 slot is outside the 4 steps
