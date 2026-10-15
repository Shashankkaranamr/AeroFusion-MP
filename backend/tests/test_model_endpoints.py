"""P5.3: model endpoints say "pending" until a measured model exists; never placeholder numbers."""

import json

from app.ml.service import ModelService


def test_pending_without_files(tmp_path):
    s = ModelService(tmp_path / "none.onnx", tmp_path / "none.json")
    assert s.metrics()["status"] == "pending" and s.forecast("delhi")["status"] == "pending"
    assert s.status() == {"model": "MW-AeroFusion-Net v1", "model_file": False, "metrics": "pending", "forecasts": "pending"}


def test_unmeasured_metrics_not_served(tmp_path):
    f = tmp_path / "m.json"
    f.write_text(json.dumps({"status": "illustrative", "rmse": 1.0}))
    assert ModelService(tmp_path / "none.onnx", f).metrics()["status"] == "pending"


def test_measured_metrics_served(tmp_path):
    f = tmp_path / "m.json"
    f.write_text(json.dumps({"status": "measured", "run_id": "20270110-m6_mwafn-s0-abcdef1", "leads": {}}))
    assert ModelService(tmp_path / "none.onnx", f).metrics()["run_id"].startswith("20270110")
