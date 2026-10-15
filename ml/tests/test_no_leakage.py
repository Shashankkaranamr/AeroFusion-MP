"""P1.11 leakage tests (PROGRESS §0 rule 3, §3.4) on synthetic arrays; rerun against dataset_v1 once it exists."""

import numpy as np
import pandas as pd
import pytest

from aerofusion_ml.data import windows as w

TIMES = pd.date_range("2019-10-01", periods=24 * 20, freq="h", tz="UTC")
RNG = np.random.default_rng(0)


def _arrays():
    return {
        "obs": ("obs", RNG.normal(size=(len(TIMES), 5, 3))),
        "met": ("met", RNG.normal(size=(len(TIMES), 5, 4))),
        "fire": ("fire", RNG.normal(size=(len(TIMES), 5, 2))),
    }


@pytest.mark.parametrize("t0", [TIMES[100], TIMES[250], TIMES[400]])
def test_a_inputs_unchanged_when_everything_after_t0_is_perturbed(t0):
    arrays = _arrays()
    before = w.issue_inputs(t0, TIMES, arrays)
    after_t0 = TIMES > t0 - pd.Timedelta(hours=1)  # anything ending after t0 (value at t covers (t, t+1h])
    perturbed = {k: (kind, np.where(after_t0[:, None, None], a + 1e3, a)) for k, (kind, a) in arrays.items()}
    again = w.issue_inputs(t0, TIMES, perturbed)
    for k in arrays:
        np.testing.assert_array_equal(before[k], again[k])


def test_a_window_ends_at_the_latency_lag_and_targets_start_after_t0():
    t0 = TIMES[200]
    assert TIMES[w.window_index(TIMES, t0, "obs")[-1]] == t0 - pd.Timedelta(hours=1)
    assert TIMES[w.window_index(TIMES, t0, "fire")[-1]] == t0 - pd.Timedelta(hours=4)
    assert len(w.window_index(TIMES, t0, "met")) == w.WINDOW_H
    tgt = w.target_index(TIMES, t0)
    assert TIMES[tgt[0]] == t0 + pd.Timedelta(hours=1) and len(tgt) == w.HORIZON_H


def test_b_normaliser_uses_train_rows_only():
    times = pd.date_range("2021-12-30", "2022-01-02 23:00", freq="h", tz="UTC")
    x = np.zeros((len(times), 2, 1))
    x[times >= pd.Timestamp("2022-01-01", tz="UTC")] = 1e6  # val rows: huge values must not move the stats
    n = w.Normalizer.fit(x, times, {"start": "2018-01-01", "end": "2021-12-31"})
    assert n.mean.tolist() == [0.0] and n.fit_end == pd.Timestamp("2021-12-31 23:00", tz="UTC")


def test_b_normaliser_refuses_an_axis_without_train_rows():
    times = pd.date_range("2023-01-01", periods=10, freq="h", tz="UTC")
    with pytest.raises(ValueError):
        w.Normalizer.fit(np.zeros((10, 1, 1)), times, {"start": "2018-01-01", "end": "2021-12-31"})


@pytest.mark.parametrize("t0,run", [
    ("2019-11-01 12:00", "2019-11-01 00:00"),   # §3.4 worked example: at 12 UTC the latest usable run is 00 UTC
    ("2019-11-01 09:00", "2019-10-31 12:00"),   # 00 UTC run not yet available (00 + 10 h = 10 UTC)
    ("2019-11-01 10:00", "2019-11-01 00:00"),
    ("2019-11-01 00:00", "2019-10-31 12:00"),
    ("2019-11-01 21:00", "2019-11-01 00:00"),
    ("2019-11-01 22:00", "2019-11-01 12:00"),
])
def test_c_cams_run_respects_latency(t0, run):
    t0, run = pd.Timestamp(t0, tz="UTC"), pd.Timestamp(run, tz="UTC")
    got = w.latest_cams_run(t0)
    assert got == run and got + pd.Timedelta(hours=w.CAMS_LATENCY_H) <= t0


def test_c_cams_leads_verify_at_target_times():
    t0, run = pd.Timestamp("2019-11-01 12:00", tz="UTC"), pd.Timestamp("2019-11-01 00:00", tz="UTC")
    leads = w.cams_leads(t0, run)
    assert leads[0] == 13 and leads[23] == 36  # "+24 h" for us is lead 36 of the 00 UTC run (§3.4)
    assert all(run + pd.Timedelta(hours=int(l)) == t0 + pd.Timedelta(hours=h) for h, l in zip(range(1, 49), leads))


def test_c_every_issue_hour_gets_a_run_at_least_latency_old():
    for t0 in pd.date_range("2019-11-01", periods=48, freq="h", tz="UTC"):
        r = w.latest_cams_run(t0)
        assert r.hour in w.CAMS_RUN_HOURS and pd.Timedelta(hours=10) <= t0 - r < pd.Timedelta(hours=22)


def test_a_fire_detections_in_the_window_were_all_available_at_t0():
    t0 = pd.Timestamp("2019-11-01 12:00", tz="UTC")
    acq = pd.Series(pd.date_range("2019-11-01 00:00", "2019-11-01 12:00", freq="10min", tz="UTC"))
    slots = w.fire_slot(acq)
    times = pd.date_range("2019-10-28", "2019-11-02", freq="h", tz="UTC")
    in_window = slots.isin(times[w.window_index(times, t0, "fire")])
    assert (acq[in_window] + pd.Timedelta(hours=w.FIRMS_LATENCY_H) <= t0).all()
    # and nothing usable is dropped beyond the 1-hour slot granularity
    assert in_window[acq + pd.Timedelta(hours=w.FIRMS_LATENCY_H) <= t0 - pd.Timedelta(hours=1)].all()


# --- against the real dataset_v1 (skipped until it is built) -------------------------------------------------------
from pathlib import Path  # noqa: E402

import yaml  # noqa: E402

from aerofusion_ml.data import loader  # noqa: E402

ML = Path(__file__).resolve().parents[1]
ZARR = ML / "data" / "processed" / "dataset_v1.zarr"


@pytest.fixture(scope="module")
def train_arrays():
    if not ZARR.exists():
        pytest.skip("dataset_v1 not built")
    cfg = yaml.safe_load((ML / "configs" / "features_v1.yaml").read_text(encoding="utf-8"))
    a = loader.NodeArrays.from_zarr(ZARR, cfg)
    sel = (a.times >= pd.Timestamp("2019-10-20", tz="UTC")) & (a.times < pd.Timestamp("2019-11-20", tz="UTC"))  # train only
    return loader.NodeArrays(a.times[sel], a.x[sel], a.m[sel], a.y[sel], a.feats, a.groups)


@pytest.mark.parametrize("t0", ["2019-11-01 00:00", "2019-11-05 12:00"])
def test_a_real_dataset_sample_ignores_everything_from_t0_on(train_arrays, t0):
    a, t0 = train_arrays, pd.Timestamp(t0, tz="UTC")
    s1 = loader.sample(a, t0)
    later = a.times >= t0
    x2 = a.x.copy(); x2[later] += 1e3
    m2 = a.m.copy(); m2[later] = 1 - m2[later]
    b = loader.NodeArrays(a.times, x2, m2, a.y, a.feats, a.groups)
    s2 = loader.sample(b, t0)
    np.testing.assert_array_equal(s1["x_node"], s2["x_node"])
    np.testing.assert_array_equal(s1["m_node"], s2["m_node"])


def test_a_real_dataset_fire_hours_are_hidden(train_arrays):
    a, t0 = train_arrays, pd.Timestamp("2019-11-01 12:00", tz="UTC")
    s = loader.sample(a, t0)
    fire = [i for i, g in enumerate(a.groups) if g == "fire"]
    assert s["m_node"][-3:, :, fire].sum() == 0 and s["m_node"][:-3, :, fire].sum() > 0  # fires hidden for t > t0-4h
    assert s["x_node"].shape == (72, a.x.shape[1], a.x.shape[2]) and s["y"].shape == (48, a.x.shape[1])
