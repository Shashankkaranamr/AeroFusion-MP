"""CAMS input series (§3.4 latency): which run and lead feed each hour, and that nothing unpublished is used."""

import numpy as np
import pandas as pd
import xarray as xr

from aerofusion_ml.data import cams, windows


def _pts(runs):
    leads = np.arange(0, 49, 3)
    # value = run hour-of-month * 1000 + lead, so the run and lead used can be read back
    rr = pd.DatetimeIndex(runs)
    a = (((rr - rr[0]) / pd.Timedelta(hours=1)).to_numpy()[:, None] * 1000 + leads[None, :])[:, :, None].astype("f4")
    data = {v: (("run", "lead", "point"), a) for v in cams.VARS}
    return xr.Dataset(data, coords={"run": rr, "lead": leads, "point": [0]})


RUNS = pd.date_range("2019-11-01 00:00", "2019-11-04 12:00", freq="12h")


def test_run_selection_and_leads():
    t = pd.DatetimeIndex(["2019-11-02 00:00", "2019-11-02 08:00", "2019-11-02 09:00", "2019-11-02 20:00", "2019-11-02 21:00"], tz="UTC")
    r = cams.run_for(t)
    assert list(r.hour) == [12, 12, 0, 0, 12]
    lead = (t - r) / pd.Timedelta(hours=1)
    assert lead.min() >= 9 and lead.max() <= 20


def test_every_value_was_published_by_t_plus_1h():
    t = pd.date_range("2019-11-02", periods=72, freq="h", tz="UTC")
    r = cams.run_for(t)
    assert ((r + pd.Timedelta(hours=windows.CAMS_LATENCY_H)) <= t + pd.Timedelta(hours=windows.LAG_H["obs"])).all()


def test_series_interpolates_within_one_run():
    t = pd.DatetimeIndex(["2019-11-02 10:00", "2019-11-02 12:00"], tz="UTC")  # run 00 UTC 2 Nov: leads 10 and 12
    s = cams.series(_pts(RUNS), t)["cams_pm25"][:, 0]
    run_h = 24.0  # 2 Nov 00 UTC is 24 h after the first run
    np.testing.assert_allclose(s, [run_h * 1000 + 10, run_h * 1000 + 12])


def test_missing_run_gives_nan():
    t = pd.DatetimeIndex(["2019-11-10 12:00"], tz="UTC")
    assert np.isnan(cams.series(_pts(RUNS), t)["cams_pm25"]).all()
