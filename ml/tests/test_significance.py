"""P2.2 DM test and block bootstrap: behaviour on constructed cases."""

import numpy as np

from aerofusion_ml import significance as sg


def test_identical_forecasts_not_significant():
    e = np.random.default_rng(0).normal(size=500)
    r = sg.diebold_mariano(e, e, h=1)
    assert r["dm"] == 0.0 and r["p"] == 1.0


def test_clearly_better_model_is_significant_and_negative():
    rng = np.random.default_rng(1)
    e1, e2 = rng.normal(0, 1, 2000), rng.normal(0, 2, 2000)
    r = sg.diebold_mariano(e1, e2, h=24)
    assert r["dm"] < 0 and r["p"] < 1e-6


def test_same_distribution_not_significant_usually():
    rng = np.random.default_rng(2)
    ps = [sg.diebold_mariano(rng.normal(size=400), rng.normal(size=400), h=1)["p"] for _ in range(200)]
    assert 0.02 < np.mean(np.array(ps) < 0.05) < 0.10  # size close to 5 %


def test_hln_correction_shrinks_statistic():
    rng = np.random.default_rng(3)
    e1, e2 = rng.normal(0, 1, 60), rng.normal(0, 1.3, 60)
    d = e1 ** 2 - e2 ** 2
    raw = d.mean() / np.sqrt(d.var() / len(d))
    assert abs(sg.diebold_mariano(e1, e2, h=1)["dm"]) < abs(raw)


def test_block_bootstrap_interval_contains_point_and_excludes_zero_when_clear():
    rng = np.random.default_rng(4)
    e1, e2 = rng.normal(0, 1, 2400), rng.normal(0, 1.5, 2400)
    r = sg.block_bootstrap_rmse_diff(e1, e2, block=24, n_boot=500)
    assert r["ci95"][0] <= r["diff"] <= r["ci95"][1] and r["ci95"][1] < 0


def test_nan_pairs_dropped():
    e1 = np.array([1.0, np.nan, 2.0, 3.0, 1.0])
    r = sg.diebold_mariano(e1, np.ones(5), h=1)
    assert r["n"] == 4
