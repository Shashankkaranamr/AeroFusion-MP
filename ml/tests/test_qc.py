"""P1.4: QC rules on synthetic cases (PROGRESS §3.7)."""

import numpy as np
import pandas as pd
import pytest

from aerofusion_ml.data import qc

IDX = pd.date_range("2023-01-01", periods=96, freq="h", tz="UTC")


def frame(**cols):
    return pd.DataFrame({k: np.asarray(v, dtype=float) for k, v in cols.items()}, index=IDX[: len(next(iter(cols.values())))])


def noisy(n=96, level=80.0, sd=8.0, seed=0):
    """Deterministic per call, so results never depend on test order."""
    return level + np.random.default_rng(seed).normal(0, sd, n)


def test_sentinels_negatives_and_bounds_removed():
    x = noisy()
    x[[3, 10, 20, 30]] = [999, -5, 1600, 9999]
    out, n = qc.sentinels_and_bounds(frame(a=x), "pm25")
    assert n == 4 and out["a"].iloc[[3, 10, 20, 30]].isna().all()
    assert out["a"].notna().sum() == 92


def test_pm10_has_its_own_upper_bound():
    out, n = qc.sentinels_and_bounds(frame(a=[1800.0, 2100.0]), "pm10")
    assert n == 1 and out["a"].iloc[0] == 1800.0


def test_flatline_six_hours_removed_five_kept():
    x = noisy()
    x[10:16] = 55.0  # 6 h, removed
    x[40:45] = 66.0  # 5 h, kept
    out, n = qc.flatline(frame(a=x))
    assert n == 6 and out["a"].iloc[10:16].isna().all() and out["a"].iloc[40:45].notna().all()


def test_flatline_broken_by_nan():
    x = noisy()
    x[10:13] = 55.0
    x[13] = np.nan
    x[14:17] = 55.0
    _, n = qc.flatline(frame(a=x))
    assert n == 0


def test_isolated_spike_removed():
    x = noisy()
    x[50] = 900.0
    out, n, kept = qc.spike(frame(a=x, b=noisy(seed=1)), {"a": "delhi", "b": "delhi"})
    assert n == 1 and kept == 0 and np.isnan(out["a"].iloc[50])


def test_city_wide_spike_kept_as_event():
    a, b, c = noisy(seed=1), noisy(seed=2), noisy(seed=3)
    a[50] = b[50] = 900.0  # two Delhi stations together -> real event (e.g. Diwali)
    c[50] = 900.0  # alone in its city -> removed
    out, n, kept = qc.spike(frame(a=a, b=b, c=c), {"a": "delhi", "b": "delhi", "c": "pune"})
    assert kept == 2 and n == 1
    assert out["a"].iloc[50] == 900.0 and out["b"].iloc[50] == 900.0 and np.isnan(out["c"].iloc[50])


def test_spike_uses_only_the_past():
    """Changing values after t must not change whether t is flagged (no future leakage in QC)."""
    x = noisy()
    x[50] = 900.0
    y = x.copy()
    y[51:] = 5000.0
    f1 = qc.spike_flags(frame(a=x))["a"].iloc[: 51]
    f2 = qc.spike_flags(frame(a=y))["a"].iloc[: 51]
    assert f1.equals(f2) and f1.iloc[50]


def test_spike_needs_enough_history():
    x = np.full(96, np.nan)
    x[30:36] = noisy(6)
    x[36] = 900.0  # only 6 past values in the window -> not judged
    assert not qc.spike_flags(frame(a=x))["a"].any()


def test_pm_ratio_flag():
    f = qc.pm_ratio_flags(frame(a=[50.0, 110.0, np.nan]), frame(a=[100.0, 100.0, 100.0]))
    assert f["a"].tolist() == [False, True, False]


def test_fill_short_gaps_inputs_only():
    x = noisy(30)
    x[5:8] = np.nan  # 3 h -> filled
    x[15:19] = np.nan  # 4 h -> stays NaN
    out = qc.fill_short_gaps(frame(a=x))["a"]
    assert np.allclose(out.iloc[5:8], np.interp([5, 6, 7], [4, 8], [x[4], x[8]]))
    assert out.iloc[15:19].isna().all()


def test_fill_short_gaps_never_extrapolates_edges():
    x = noisy(20)
    x[:2] = np.nan
    x[-2:] = np.nan
    out = qc.fill_short_gaps(frame(a=x))["a"]
    assert out.iloc[:2].isna().all() and out.iloc[-2:].isna().all()


def test_run_qc_counts_add_up():
    x = noisy()
    x[3] = 999
    x[20:26] = 40.0
    x[60] = 950.0
    out, s = qc.run_qc(frame(a=x), "pm25", {"a": "delhi"})
    assert s["observed"] == 96
    assert s["removed_bounds_sentinel"] + s["removed_flatline"] + s["removed_spike"] + s["remaining"] == s["observed"]
    assert (s["removed_bounds_sentinel"], s["removed_flatline"], s["removed_spike"]) == (1, 6, 1)


def test_run_qc_rejects_non_utc_or_gappy_index():
    with pytest.raises(ValueError):
        qc.run_qc(pd.DataFrame({"a": [1.0, 2.0]}, index=pd.date_range("2023-01-01", periods=2, freq="h")), "pm25", {})
    with pytest.raises(ValueError):
        qc.run_qc(pd.DataFrame({"a": [1.0, 2.0]}, index=IDX[[0, 2]]), "pm25", {})
