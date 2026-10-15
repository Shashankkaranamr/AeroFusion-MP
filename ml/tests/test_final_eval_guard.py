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
