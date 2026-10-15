"""P2.3 no-training baselines: leakage-safe and correct on a ramp series."""

import numpy as np
import pandas as pd

from aerofusion_ml.models import baselines as bl

T = pd.date_range("2019-01-01", periods=24 * 10, freq="h", tz="UTC")
RAMP = np.arange(len(T), dtype=float)[:, None] * np.ones((1, 2))  # value = hour index


def test_persistence_uses_t0_minus_1():
    pos0 = 100
    p = bl.persistence(RAMP, pos0)
    assert p.shape == (48, 2) and (p == 99).all()


def test_same_hour_yesterday_is_usable_and_same_hour():
    pos0 = 120
    p = bl.same_hour_yesterday(RAMP, pos0)[:, 0]
    valid = pos0 + bl.LEADS
    assert (p <= pos0 - 1).all() and ((valid - p) % 24 == 0).all()
    assert p[0] == pos0 + 1 - 24 and p[23] == pos0 + 24 - 48 and p[47] == pos0 + 48 - 72


def test_climatology_fits_train_only():
    times = pd.date_range("2021-12-31", periods=48, freq="h", tz="UTC")
    y = np.where((times.year == 2021)[:, None], 10.0, 1000.0) * np.ones((1, 1))
    c = bl.Climatology(times, y, {"start": "2018-01-01", "end": "2021-12-31"})
    assert np.allclose(c.predict(pd.DatetimeIndex(["2022-12-31 05:00"], tz="UTC")), 10.0)


def test_frame_layout():
    df = bl.frame(T, RAMP, ["a", "b"], T[[100, 112]], lambda pos0, t0: bl.persistence(RAMP, pos0))
    assert len(df) == 2 * 48 * 2 and set(df.columns) == {"t0", "lead", "node_id", "pred", "obs"}
    r = df[(df.t0 == T[100]) & (df.lead == 5) & (df.node_id == "b")].iloc[0]
    assert r.pred == 99 and r.obs == 105
