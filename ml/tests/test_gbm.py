"""LightGBM feature builder: shape, and no value from t0 onwards can change a feature (reuses loader.sample)."""

import numpy as np
import pandas as pd

from aerofusion_ml.data import loader
from aerofusion_ml.models import gbm

FEATS = ["pm25", *gbm.NOW, *gbm.FIRE]
GROUPS = ["history"] * 1 + ["met"] * len(gbm.NOW) + ["fire"] * len(gbm.FIRE)


def _arrays():
    t = pd.date_range("2019-11-01", periods=240, freq="h", tz="UTC")
    rng = np.random.default_rng(0)
    x = rng.normal(size=(len(t), 3, len(FEATS))).astype(np.float32)
    return loader.NodeArrays(t, x, np.ones_like(x, dtype=np.uint8), rng.normal(size=(len(t), 3)).astype(np.float32), FEATS, GROUPS)


def test_feature_rows_and_columns():
    a = _arrays()
    st = pd.DataFrame({"lat": [1.0, 2, 3], "lon": [4.0, 5, 6]})
    X = gbm.features(a, a.times[100], np.array([1, 24, 48]), np.array([0, 2]), st)
    assert len(X) == 6 and "pm25_lag1" in X and "cams_pm25" in X and "lat" in X
    assert X.loc[X.lead_h == 1, "pm25_lag1"].tolist() == a.x[99, [0, 2], 0].tolist()


def test_features_ignore_the_future():
    a = _arrays()
    t0 = a.times[150]
    st = pd.DataFrame({"lat": [1.0, 2, 3]})
    X1 = gbm.features(a, t0, np.array([1, 48]), np.arange(3), st)
    x2 = a.x.copy(); x2[a.times >= t0] += 1e3
    b = loader.NodeArrays(a.times, x2, a.m, a.y, a.feats, a.groups)
    X2 = gbm.features(b, t0, np.array([1, 48]), np.arange(3), st)
    pd.testing.assert_frame_equal(X1, X2)
