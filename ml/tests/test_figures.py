"""make_figures helpers on synthetic run artifacts."""

import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import make_figures as mf  # noqa: E402


def test_compute_table_reads_only_measured_trained_runs(tmp_path):
    (tmp_path / "a").mkdir(); (tmp_path / "b").mkdir()
    (tmp_path / "a" / "metrics.json").write_text(json.dumps({"run_id": "a", "model": "m6", "setting": "S-A", "status": "measured",
        "training": {"n_params": 10, "device": "cuda", "gpu": "RTX", "epochs_run": 2, "wall_sec": 7200, "log": [{"sec": 10}, {"sec": 20}]}}))
    (tmp_path / "b" / "metrics.json").write_text(json.dumps({"run_id": "b", "model": "x", "setting": "S-A", "status": "smoke", "training": {}}))
    t = mf.compute_table(tmp_path)
    assert t["run_id"].tolist() == ["a"] and t["hours"].iloc[0] == 2.0 and t["sec_per_epoch"].iloc[0] == 15.0


def test_case_frame_city_mean_at_lead():
    t0 = pd.Timestamp("2023-11-01 00:00", tz="UTC")
    p = pd.DataFrame({"t0": [t0] * 4, "lead": [24, 24, 24, 48], "node_id": ["a", "b", "c", "a"], "pred": [1.0, 3.0, 9.0, 5.0], "obs": [2.0, 4.0, 9.0, 6.0]})
    c = mf.case_frame(p, {"a": "delhi", "b": "delhi", "c": "pune"}, "2023-11-01", "2023-11-05", "delhi", 24)
    assert c.loc[pd.Timestamp("2023-11-02 00:00", tz="UTC")].tolist() == [2.0, 3.0]
