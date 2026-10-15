"""CAMS forecast lookup (latency + leads) and the per-station linear bias correction."""

import numpy as np
import pandas as pd
import xarray as xr

from aerofusion_ml.data import cams, windows
from aerofusion_ml.models.cams_baseline import LinearBC


def _fc():
    runs = pd.date_range("2019-11-01", periods=8, freq="12h")
    leads = np.arange(0, 73, 3)
    v = (np.arange(len(runs))[:, None] * 1000 + leads[None, :])[:, :, None] * np.ones((1, 1, 2))
    return xr.Dataset({"pm2p5": (("run", "lead", "point"), v.astype("f4"))}, coords={"run": runs, "lead": leads, "point": ["a", "b"]})


def test_forecast_uses_latest_published_run_and_matched_leads():
    t0 = pd.Timestamp("2019-11-02 12:00", tz="UTC")  # latest usable run: 2 Nov 00 UTC (index 2), leads 13..60
    f = cams.forecast(_fc(), t0)
    assert f.shape == (48, 2)
    np.testing.assert_allclose(f[[0, 23, 47], 0], [2000 + 13, 2000 + 36, 2000 + 60])
    assert windows.latest_cams_run(t0) + pd.Timedelta(hours=10) <= t0


def test_forecast_nan_when_run_missing():
    assert np.isnan(cams.forecast(_fc(), pd.Timestamp("2019-12-20 00:00", tz="UTC"))).all()


def test_linear_bc_recovers_bias_and_falls_back():
    rng = np.random.default_rng(0)
    x = rng.uniform(20, 300, size=(400, 48, 2))
    y = 10 + 0.5 * x
    y[:, :, 1] = np.nan  # station without targets -> raw forecast
    bc = LinearBC().fit(x, y)
    np.testing.assert_allclose(bc.coef[0, 0], [10, 0.5], atol=1e-6)
    np.testing.assert_allclose(bc.predict(x[0])[:, 1], x[0][:, 1])
