"""Model status, metrics and (once a trained model is exported) forecasts.

Honesty rules (PROGRESS §0): no model numbers are shown until a trained, exported model and a measured
metrics.json exist. Until then both endpoints answer status "pending" with a plain explanation.
Files (written by ml/aerofusion_ml/export_onnx.py and copied at P5):
  backend/app/ml/mwafn_v1.onnx, norm_stats.json, graph.json      model + inputs contract
  backend/app/data/model_metrics.json                            measured metrics of the frozen model (status "measured")
"""

from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODEL = HERE / "mwafn_v1.onnx"
METRICS = HERE.parent / "data" / "model_metrics.json"
PENDING = "MW-AeroFusion-Net is still being trained and evaluated; no model forecast or score is shown yet."


class ModelService:
    def __init__(self, model_path: Path = MODEL, metrics_path: Path = METRICS):
        self.model_path, self.metrics_path = model_path, metrics_path
        self._session = None

    def status(self) -> dict:
        has_model = self.model_path.exists()
        m = self.metrics()
        return {"model": "MW-AeroFusion-Net v1", "model_file": has_model, "metrics": m["status"],
                "forecasts": "available" if (has_model and m["status"] == "measured") else "pending"}

    def metrics(self) -> dict:
        if not self.metrics_path.exists():
            return {"status": "pending", "message": PENDING}
        data = json.loads(self.metrics_path.read_text(encoding="utf-8"))
        if data.get("status") != "measured" or not data.get("run_id"):
            return {"status": "pending", "message": "metrics file present but not a measured run; not shown"}
        return data

    def session(self):
        if self._session is None and self.model_path.exists():
            import onnxruntime as ort  # lazy: the API runs without it until a model is deployed

            self._session = ort.InferenceSession(str(self.model_path), providers=["CPUExecutionProvider"])
        return self._session

    def forecast(self, city: str) -> dict:
        if self.status()["forecasts"] != "available":
            return {"status": "pending", "city": city, "message": PENDING}
        # Live input assembly (fetchers + S8 stations -> batch contract) is wired at P5.2 with the frozen model.
        return {"status": "pending", "city": city, "message": "model exported; live input assembly is not wired yet"}
