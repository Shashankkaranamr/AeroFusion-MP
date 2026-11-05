import numpy as np
import pandas as pd
import pytest
import xarray as xr

from aerofusion_ml.data import arco_era5


def fake_store(nan_at=None):
    t = pd.date_range("2018-01-31", "2018-03-02", freq="1h")
    lat = np.arange(40, 3.75, -0.25)
    lon = np.arange(64, 100.25, 0.25)
    shape = (len(t), len(lat), len(lon))
    data = {v: (("time", "latitude", "longitude"), np.ones(shape, np.float64)) for v in arco_era5.VARS.values()}
    ds = xr.Dataset(data, coords={"time": t, "latitude": lat, "longitude": lon})
    if nan_at is not None:
        ds["boundary_layer_height"].loc[{"time": nan_at}] = np.nan
    return ds


def test_month_matches_cds_layout():
    out = arco_era5.month_dataset(fake_store(), "2018-02")
    assert set(out.data_vars) == {"u10", "v10", "blh", "t2m"}
    assert out.sizes == {"valid_time": 28 * 8, "latitude": 133, "longitude": 129}  # same as the CDS files
    vt = pd.DatetimeIndex(out["valid_time"].values)
    assert vt[0] == pd.Timestamp("2018-02-01 00:00") and vt[-1] == pd.Timestamp("2018-02-28 21:00")
    assert (vt.hour % 3 == 0).all()
    assert out["u10"].dtype == np.float32


def test_unpublished_steps_raise():
    with pytest.raises(ValueError, match="missing values"):
        arco_era5.month_dataset(fake_store(nan_at="2018-02-10T06:00"), "2018-02")
