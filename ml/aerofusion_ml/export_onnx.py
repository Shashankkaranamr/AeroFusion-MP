"""P5.1: export a trained run to ONNX for the CPU-only backend (onnxruntime, no torch on the server).

    python ml/aerofusion_ml/export_onnx.py --run <run_id> [--out backend/app/ml]

Writes mwafn_v1.onnx, norm_stats.json (train-fitted), graph.json (node ids/kinds/coords, static adjacency is inside
the model) and export_check.json (max |onnx - torch| on a random batch; the export fails above 1e-3).
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import numpy as np
import torch

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML))

INPUTS = ["x_node", "m_node", "x_grid", "wind_uv", "x_fut"]


class _Wrap(torch.nn.Module):
    def __init__(self, model, names):
        super().__init__()
        self.model, self.names = model, names

    def forward(self, *args):
        out = self.model(dict(zip(self.names, args)))
        return (out["pred"], out["gates"]) if out["gates"] is not None else (out["pred"],)


def export(model: torch.nn.Module, example: dict, path: Path) -> float:
    """Export with a fixed batch of 1 and check onnxruntime against torch; returns max abs difference."""
    import onnxruntime as ort

    model.eval()
    names = [k for k in INPUTS if k in example]
    args = tuple(example[k] for k in names)
    wrap = _Wrap(model, names)
    with torch.no_grad():
        ref = wrap(*args)
    out_names = ["pred", "gates"][: len(ref)]
    torch.onnx.export(wrap, args, str(path), input_names=names, output_names=out_names, opset_version=17, dynamo=False)
    sess = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    used = {i.name for i in sess.get_inputs()}  # unused inputs (e.g. wind_uv for rungs without a graph) are pruned
    got = sess.run(None, {k: v.numpy() for k, v in zip(names, args) if k in used})
    return float(max(np.abs(g - r.numpy()).max() for g, r in zip(got, ref)))


def main() -> None:
    import xarray as xr
    import yaml

    from aerofusion_ml.data import loader
    from aerofusion_ml.train import make_model

    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True)
    ap.add_argument("--out", default=str(ML.parent / "backend" / "app" / "ml"))
    a = ap.parse_args()
    rd = ML / "runs" / a.run
    cfg = yaml.safe_load((rd / "config.yaml").read_text(encoding="utf-8"))
    feats_cfg = yaml.safe_load((ML / "configs" / "features_v1.yaml").read_text(encoding="utf-8"))
    arr = loader.NodeArrays.from_zarr(ML / "data/processed/dataset_v1.zarr", feats_cfg, "2019-11-01", "2019-11-02")
    model = make_model(cfg, arr)
    model.load_state_dict(torch.load(rd / "ckpt.pt", map_location="cpu"))
    N, F = arr.x.shape[1], arr.x.shape[2]
    ex = {"x_node": torch.randn(1, 72, N, F), "m_node": torch.ones(1, 72, N, F), "wind_uv": torch.randn(1, N, 2)}
    if cfg.get("use_grid"):
        ex["x_grid"] = torch.randn(1, 24, cfg.get("grid_channels", 8), 44, 43)
    if cfg.get("setting", "S-A") != "S-A":
        ex["x_fut"] = torch.randn(1, 48, N, 1 if cfg["setting"] == "S-B" else 9)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    diff = export(model, ex, out / "mwafn_v1.onnx")
    if diff > 1e-3:
        raise SystemExit(f"ONNX output differs from torch by {diff}")
    shutil.copy(rd / "norm_stats.json", out / "norm_stats.json")
    ds = xr.open_zarr(ML / "data/processed/dataset_v1.zarr")
    (out / "graph.json").write_text(json.dumps({"run_id": a.run, "node_id": np.array([str(v) for v in ds.node.values]).tolist(), "kind": np.array([str(v) for v in ds.node_kind.values]).tolist(),
                                                "lat": ds.node_lat.values.tolist(), "lon": ds.node_lon.values.tolist(), "feat": arr.feats}), encoding="utf-8")
    (out / "export_check.json").write_text(json.dumps({"run_id": a.run, "max_abs_diff": diff}), encoding="utf-8")
    print(f"exported {a.run} -> {out / 'mwafn_v1.onnx'} (max |onnx - torch| = {diff:.2e})")


if __name__ == "__main__":
    main()
