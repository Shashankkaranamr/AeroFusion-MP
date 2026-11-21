"""P4.2 guards: the test split stays closed without a model freeze, and a changed dataset is detected."""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
import xarray as xr

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML / "scripts"))
import final_eval as fe  # noqa: E402

from aerofusion_ml.data import torch_dataset as tds  # noqa: E402


def test_refuses_without_freeze_file(tmp_path):
    with pytest.raises(PermissionError):
        fe.check_freeze(tmp_path / "MODEL_FREEZE.json")


def test_build_frozen_refuses_other_callers():
    with pytest.raises(PermissionError):
        tds.build_frozen({}, "test", None)


def test_training_build_refuses_frozen_splits():
    with pytest.raises(PermissionError):
        tds.build({}, splits_to_load=("train", "test"))


def test_lock_mismatch_detected(tmp_path):
    t = pd.date_range("2023-01-01", periods=48, freq="h")
    x = np.zeros((48, 2, 3), np.float32)
    y = np.zeros((48, 2), np.float32)
    xr.Dataset({"x_node": (("time", "node", "feat"), x), "y": (("time", "node"), y)}, coords={"time": t}).to_zarr(tmp_path / "d.zarr")
    lock = {"splits": {"test": {"start": "2023-01-01", "end": "2023-01-02", "sha256_y": fe.sha(y), "sha256_x": fe.sha(x)}}}
    (tmp_path / "SPLITS.lock").write_text(json.dumps(lock))
    fe.check_lock(tmp_path / "d.zarr", tmp_path / "SPLITS.lock")  # unchanged: passes
    lock["splits"]["test"]["sha256_y"] = "0" * 64
    (tmp_path / "SPLITS.lock").write_text(json.dumps(lock))
    with pytest.raises(RuntimeError):
        fe.check_lock(tmp_path / "d.zarr", tmp_path / "SPLITS.lock")


def test_real_lock_matches_current_dataset():
    if not (ML / "data/processed/dataset_v1.zarr").exists():
        pytest.skip("dataset not built")
    fe.check_lock(ML / "data/processed/dataset_v1.zarr", ML / "data/SPLITS.lock")


def _repo(tmp_path, monkeypatch):
    """A throwaway git repo shaped like ours: ml/aerofusion_ml, ml/configs, ml/data/SPLITS.lock, one run with a ckpt."""
    import subprocess

    def git(*a):
        subprocess.run(["git", *a], cwd=tmp_path, check=True, capture_output=True)

    ml = tmp_path / "ml"
    for d in ("aerofusion_ml", "configs", "data", "scripts"):
        (ml / d).mkdir(parents=True)
    (ml / "aerofusion_ml" / "m.py").write_text("x = 1\n")
    (ml / "configs" / "c.yaml").write_text("a: 1\n")
    (ml / "data" / "SPLITS.lock").write_text("{}")
    (tmp_path / ".gitignore").write_text("ml/runs/\n")
    git("init", "-q"); git("config", "user.email", "t@t"); git("config", "user.name", "t")
    git("add", "."); git("commit", "-qm", "code")
    sha = subprocess.run(["git", "rev-parse", "--short=7", "HEAD"], cwd=tmp_path, capture_output=True, text=True).stdout.strip()
    run = ml / "runs" / f"20261120-m6_mwafn-s0-{sha}"
    run.mkdir(parents=True)
    (run / "ckpt.pt").write_bytes(b"0")
    monkeypatch.setattr(fe, "REPO", tmp_path)
    monkeypatch.setattr(fe, "ML", ml)
    return tmp_path, ml, sha, run.name, git


def test_freeze_accepts_committed_freeze_after_training_commit(tmp_path, monkeypatch):
    root, ml, sha, run_id, git = _repo(tmp_path, monkeypatch)
    (ml / "MODEL_FREEZE.json").write_text(json.dumps({"git_commit": sha, "run_ids": [run_id]}))
    (ml / "scripts" / "final_eval.py").write_text("# eval fix after training is allowed\n")
    (root / "PROGRESS.md").write_text("docs\n")
    git("add", "."); git("commit", "-qm", "freeze")
    assert fe.check_freeze(ml / "MODEL_FREEZE.json")["run_ids"] == [run_id]


def test_freeze_refuses_uncommitted_or_changed_code(tmp_path, monkeypatch):
    root, ml, sha, run_id, git = _repo(tmp_path, monkeypatch)
    fz = ml / "MODEL_FREEZE.json"
    fz.write_text(json.dumps({"git_commit": sha, "run_ids": [run_id]}))
    with pytest.raises(PermissionError, match="clean"):
        fe.check_freeze(fz)  # not committed
    git("add", "."); git("commit", "-qm", "freeze")
    (ml / "aerofusion_ml" / "m.py").write_text("x = 2\n")
    git("add", "."); git("commit", "-qm", "model change after training")
    with pytest.raises(PermissionError, match="changed"):
        fe.check_freeze(fz)


def test_freeze_refuses_runs_from_another_commit(tmp_path, monkeypatch):
    root, ml, sha, run_id, git = _repo(tmp_path, monkeypatch)
    (ml / "MODEL_FREEZE.json").write_text(json.dumps({"git_commit": sha, "run_ids": [run_id, "20261114-m0_gru-s0-1234567"]}))
    git("add", "."); git("commit", "-qm", "freeze")
    with pytest.raises(PermissionError, match="not trained"):
        fe.check_freeze(ml / "MODEL_FREEZE.json")
