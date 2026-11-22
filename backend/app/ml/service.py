"""Model status, metrics and live forecasts of the frozen MW-AeroFusion-Net (PROGRESS P5).

Honesty rules (PROGRESS §0): model numbers come only from a measured metrics file of the frozen model; forecasts only
from the exported ONNX ensemble. Files:
  backend/app/ml/serving/seed*/model.onnx, norm_stats.json, grid_stats.json   five seeds of the serving model
  backend/app/ml/serving/contract.json                                       node list, feature order, calendar
  backend/app/data/model_metrics.json   measured test-year metrics of the serving model (status "measured")
"""

from __future__ import annotations

import json
from pathlib import Path

from .inference import LiveForecaster

HERE = Path(__file__).resolve().parent
METRICS = HERE.parent / "data" / "model_metrics.json"
PENDING = "MW-AeroFusion-Net is still being trained and evaluated; no model forecast or score is shown yet."


class ModelService:
    def __init__(self, metrics_path: Path = METRICS, cache_dir: Path | None = None):
        self.metrics_path = metrics_path
        self.live = LiveForecaster(cache_dir)

    def status(self) -> dict:
        m = self.metrics()
        ok = self.live.ready and m["status"] == "measured"
        r = self.live.result
        return {"model": "MW-AeroFusion-Net v1 (no gating, 5-seed mean)", "model_file": self.live.ready, "seeds": len(self.live.ens),
                "metrics": m["status"], "forecasts": "available" if ok else "pending",
                "last_issue": r["issued_at"] if r else None, "last_error": self.live.error}

    def metrics(self) -> dict:
        if not self.metrics_path.exists():
            return {"status": "pending", "message": PENDING}
        data = json.loads(self.metrics_path.read_text(encoding="utf-8"))
        if data.get("status") != "measured" or not data.get("run_id"):
            return {"status": "pending", "message": "metrics file present but not a measured run; not shown"}
        return data

    async def forecast_all(self, om_get) -> dict:
        """Every city's forecast from the same cached issue, for the map slider and the Now view.
        Cities without a station in the model's panel are absent from `cities` (never filled in)."""
        if self.status()["forecasts"] != "available":
            return {"status": "pending", "message": PENDING}
        r = await self.live.ensure(om_get)
        if not r:
            return {"status": "pending", "message": "the live forecast could not be built just now; try again later",
                    "error": self.live.error}
        return {"status": "available", "issued_at": r["issued_at"], "valid_times": r["valid_times"],
                "cities": {slug: {"pm25": c["pm25"], "stations": c["stations"]} for slug, c in r["cities"].items()},
                "model": r["model"], "run_ids": r["run_ids"], "notes": r["notes"], "generated_at": r["generated_at"]}

    async def forecast(self, city: str, om_get) -> dict:
        if self.status()["forecasts"] != "available":
            return {"status": "pending", "city": city, "message": PENDING}
        r = await self.live.ensure(om_get)
        if not r:
            return {"status": "pending", "city": city, "message": "the live forecast could not be built just now; try again later",
                    "error": self.live.error}
        c = r["cities"].get(city)
        if c is None:
            return {"status": "no_station", "city": city, "issued_at": r["issued_at"],
                    "message": "This city has no measuring station in the model's panel, so the model makes no forecast for it."}
        return {"status": "available", "city": city, "issued_at": r["issued_at"], "valid_times": r["valid_times"], "pm25": c["pm25"],
                "stations": c["stations"], "model": r["model"], "run_ids": r["run_ids"], "inputs": r["inputs"], "notes": r["notes"],
                "generated_at": r["generated_at"]}
