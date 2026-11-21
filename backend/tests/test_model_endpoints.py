"""P5.2/P5.3: model endpoints answer "pending" until a measured model exists (never placeholder numbers), and the
live input builder reproduces the training feature code."""

import asyncio
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pytest

from app.ml import inference as inf
from app.ml.service import ModelService

REPO = Path(__file__).resolve().parents[2]


def test_pending_without_metrics(tmp_path):
    s = ModelService(tmp_path / "none.json")
    assert s.metrics()["status"] == "pending"
    assert asyncio.run(s.forecast("delhi", None))["status"] == "pending"
    assert s.status()["forecasts"] == "pending"


def test_unmeasured_metrics_not_served(tmp_path):
    f = tmp_path / "m.json"
    f.write_text(json.dumps({"status": "illustrative", "rmse": 1.0}))
    assert ModelService(f).metrics()["status"] == "pending"


def test_measured_metrics_served(tmp_path):
    f = tmp_path / "m.json"
    f.write_text(json.dumps({"status": "measured", "run_id": "20270110-m6_mwafn-s0-abcdef1", "leads": {}}))
    assert ModelService(f).metrics()["run_id"].startswith("20270110")


def test_ensemble_runs_on_missing_inputs():
    """All five seeds load and give finite, positive µg/m³ when every input is missing (mean-filled)."""
    e = inf.Ensemble()
    assert len(e) == 5
    c = inf._contract()
    N, F = len(c["nodes"]["lat"]), len(c["feats"])
    raw = {"x_node": np.full((72, N, F), np.nan, np.float32), "x_grid": np.full((24, 8, 44, 43), np.nan, np.float32),
           "wind_uv": np.zeros((N, 2), np.float32)}
    p = e.predict(raw)
    assert p.shape == (48, N) and np.isfinite(p).all() and (p > 0).all()


def test_issue_time_and_window():
    t0 = inf.issue_time(datetime(2026, 11, 21, 17, 40, tzinfo=timezone.utc))
    assert t0 == datetime(2026, 11, 21, 12, tzinfo=timezone.utc)
    h = inf.hours(t0)
    assert len(h) == 72 and h[0] == t0 - timedelta(hours=72) and h[-1] == t0 - timedelta(hours=1)


def _ml():
    ml = REPO / "ml"
    if not (ml / "aerofusion_ml").exists():
        pytest.skip("ml package not present")
    pd = pytest.importorskip("pandas")
    pytest.importorskip("holidays")
    pytest.importorskip("yaml")
    sys.path.insert(0, str(ml))
    return pd


def test_calendar_matches_training_code():
    pd = _ml()
    from aerofusion_ml.data import events

    times = pd.date_range("2026-10-01", "2026-11-30 23:00", freq="h", tz="UTC")
    ref = events.calendar_features(times).to_numpy()
    got = inf.calendar([t.to_pydatetime() for t in times], inf._contract()["calendar"])
    assert np.allclose(ref, got, atol=1e-5)


def test_fire_features_match_training_code():
    pd = _ml()
    from aerofusion_ml.data import fires, windows

    rng = np.random.default_rng(0)
    t0 = datetime(2026, 11, 1, 12, tzinfo=timezone.utc)
    times = inf.hours(t0)
    c = inf._contract()["nodes"]
    lat, lon = np.asarray(c["lat"]), np.asarray(c["lon"])
    acq = [t0 - timedelta(minutes=int(m)) for m in rng.integers(30, 70 * 60, 400)]
    det = [(float(a), float(b), float(f), q) for a, b, f, q in zip(rng.uniform(20, 32, 400), rng.uniform(70, 90, 400), rng.uniform(1, 50, 400), acq)]
    wind_from = rng.uniform(0, 360, (72, len(lat)))
    got = inf.fire_features(det, times, lat, lon, wind_from)
    d = pd.DataFrame({"lat": [x[0] for x in det], "lon": [x[1] for x in det], "frp": [x[2] for x in det],
                      "slot": windows.fire_slot(pd.Series(pd.to_datetime([x[3] for x in det], utc=True)))})
    nodes = pd.DataFrame({"node_id": c["node_id"], "lat": lat, "lon": lon})
    wf = pd.DataFrame(wind_from, index=pd.DatetimeIndex(times), columns=c["node_id"])
    ref = fires.node_features(d, nodes, wf)
    want = np.zeros_like(got)
    pos = {pd.Timestamp(t): i for i, t in enumerate(times)}
    col = {n: j for j, n in enumerate(c["node_id"])}
    for r in ref.itertuples():
        want[pos[r.slot], col[r.node_id]] = [r.fires_300km, r.frp_300km, r.fires_upwind_500km]
    assert np.allclose(got, want, atol=1e-3)
