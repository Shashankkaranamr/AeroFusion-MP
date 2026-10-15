"""Prospective scorer on synthetic snapshots/observations: slot alignment, persistence, no look-ahead."""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import prospective_eval as pe  # noqa: E402


def _snap(updated, start, values):
    t = pd.date_range(start, periods=len(values), freq="h", tz="UTC").strftime("%Y-%m-%dT%H:%MZ").tolist()
    return {"updated_at": updated, "cities": [{"slug": "delhi", "series": {"time": t, "pm25": values}}]}


def test_forecast_uses_slot_mean_and_issue_time_floor():
    vals = list(np.arange(100, dtype=float))  # value = hours since 2026-10-15 00:00
    fc = pe.cams_forecasts([_snap("2026-10-15T17:03:21Z", "2026-10-15T00:00", vals)])
    r = fc[fc.lead == 1].iloc[0]
    assert r.t0 == pd.Timestamp("2026-10-15 17:00", tz="UTC") and r.pred == 18.5  # slot 18:00 = mean(CAMS 18, 19)


def test_frame_obs_and_persistence():
    fc = pe.cams_forecasts([_snap("2026-10-15T17:03:21Z", "2026-10-15T00:00", [50.0] * 100)])
    idx = pd.date_range("2026-10-15", periods=100, freq="h", tz="UTC")
    obs = pd.DataFrame({"delhi": np.arange(100, dtype=float)}, index=idx)
    df = pe.frame(fc, obs)
    r = df[df.lead == 24].iloc[0]
    assert r.obs == 17 + 24 and r.ref_persistence == 16  # slot t0+24 h; persistence = slot t0-1 h
