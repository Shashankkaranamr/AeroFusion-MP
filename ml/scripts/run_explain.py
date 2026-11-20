"""P4.4 attribution validation on the validation year (no test data needed): drives aerofusion_ml/explain.py.

    python ml/scripts/run_explain.py --runs <m6 seed run ids...> [--lgbm <lgbm run id>] [--n-batches 6] [--batch 8]

For every run (CPU, eval mode, a fixed spread of val issue times):
  (a) faithfulness: error increase when the top-2 gated groups are removed, vs top-2 by Integrated Gradients and vs
      random pairs (mean over batches);
  (b) sanity: cascading weight randomisation on the first batch;
  mean gate weight per group -> (c) stability across seeds (mean pairwise Spearman);
  (d) plausibility: per (issue time, IGP station) in Oct-Nov, fire-group gate vs the upwind fire count of the last
      24 h (input feature fires_upwind_500km, unnormalised);
  (e) --lgbm: mean |TreeSHAP| per feature group for the LightGBM baseline on the same val issue times.
A check that fails is reported as failed (PROGRESS P4.4). Writes docs/paper/tables/attribution_val.{json,md}.
Needs the memory of one training process (it builds the train-fitted stats), so run it when the GPU lanes are idle.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import yaml

ML = Path(__file__).resolve().parents[1]
REPO = ML.parent
OUT = REPO / "docs" / "paper" / "tables"
sys.path.insert(0, str(ML))


def _batches(ds, n_batches: int, bs: int, only_months=None):
    """Evenly spaced val issue times (optionally restricted to some months) collated into n_batches CPU batches."""
    idx = np.arange(len(ds))
    if only_months:
        idx = idx[np.isin(pd.DatetimeIndex(ds.t0s).month, only_months)]
    if len(idx) == 0:
        return []
    pick = idx[np.linspace(0, len(idx) - 1, min(len(idx), n_batches * bs)).astype(int)]
    out = []
    for k in range(0, len(pick), bs):
        items = [ds[int(i)] for i in pick[k:k + bs]]
        out.append({key: torch.stack([torch.as_tensor(it[key]) for it in items]) for key in items[0]})
    return out


def main() -> None:
    from aerofusion_ml import explain
    from aerofusion_ml.data import torch_dataset as tds
    from aerofusion_ml.train import make_model

    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", nargs="+", required=True)
    ap.add_argument("--lgbm", default=None)
    ap.add_argument("--n-batches", type=int, default=6)
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--splits-override", default=None, help="smoke test only: JSON for cfg['splits_override']")
    ap.add_argument("--out", default=str(OUT))
    a = ap.parse_args()
    torch.set_grad_enabled(True)
    res = {"runs": {}, "note": "validation year only; test data not used"}
    gates_per_seed = []
    import xarray as xr

    dsz = xr.open_zarr(ML / "data/processed/dataset_v1.zarr")
    from aerofusion_ml import evaluate as ev

    igp = np.isin([str(c) for c in dsz.node_city_slug.values], ev.load_cfg()["igp_cities"])  # same IGP definition as evaluate.py
    station = dsz.node_kind.values == "station"
    data = None
    for run_id in a.runs:
        rd = ML / "runs" / run_id
        cfg = yaml.safe_load((rd / "config.yaml").read_text(encoding="utf-8"))
        if a.splits_override:
            cfg["splits_override"] = json.loads(a.splits_override)
        if data is None or data["key"] != (cfg.get("setting"), cfg.get("use_grid")):
            data = tds.build(cfg, splits_to_load=("val",))
            data["key"] = (cfg.get("setting"), cfg.get("use_grid"))
            batches = _batches(data["val"], a.n_batches, a.batch)
            fire_batches = _batches(data["val"], 2, a.batch, only_months=[10, 11])
        model = make_model(cfg, data["arrays"])
        model.load_state_dict(torch.load(rd / "ckpt.pt", map_location="cpu"))
        model.eval()
        if model(batches[0]).get("gates") is None:
            res["runs"][run_id] = {"skipped": "model has no gates"}
            continue
        fa = [explain.faithfulness(model, b, k=2, n_random=10) for b in batches]
        faith = {k: float(np.mean([f[k] for f in fa])) for k in ("base_mse", "delta_top_gate", "delta_top_ig", "delta_random_mean", "gate_vs_ig_spearman")}
        faith["top_gate_groups"] = fa[0]["top_gate_groups"]
        faith["top_ig_groups"] = fa[0]["top_ig_groups"]
        faith["pass"] = bool(faith["delta_top_gate"] > faith["delta_random_mean"])
        san = explain.sanity_randomisation(model, batches[0])
        with torch.no_grad():
            g = torch.cat([model(b)["gates"] for b in batches]).mean(dim=(0, 1)).numpy()
        gates_per_seed.append(g)
        # (d) plausibility: fire gate vs upwind fire count (raw, last 24 h of the input window), IGP stations, Oct-Nov
        plaus = {"skipped": "no Oct-Nov issue times or no fire group"}
        groups = list(model.group_names)
        feats = list(data["arrays"].feats)
        if fire_batches and "fire" in groups and "fires_upwind_500km" in feats:
            fi, gi = feats.index("fires_upwind_500km"), groups.index("fire")
            mean, std = data["stats"].x_mean[fi], data["stats"].x_std[fi]
            w, r = [], []
            with torch.no_grad():
                for b in fire_batches:
                    gw = model(b)["gates"][..., gi].numpy()  # [B, N]
                    x = b["x_node"][:, -24:, :, fi].numpy() * std + mean  # unnormalise
                    x = np.where(b["m_node"][:, -24:, :, fi].numpy() > 0, x, np.nan)
                    cnt = np.nanmean(x, axis=1)  # [B, N]
                    sel = igp & station
                    w.append(gw[:, sel].ravel()), r.append(cnt[:, sel].ravel())
            plaus = explain.plausibility(np.concatenate(w), np.concatenate(r))
        res["runs"][run_id] = {"groups": groups, "mean_gates": g.tolist(), "faithfulness": faith,
                               "sanity": {"final_spearman": san["final_spearman"], "pass": san["pass"]}, "plausibility_fire": plaus}
        print(f"{run_id}: faithfulness pass={faith['pass']} sanity pass={san['pass']} plausibility={plaus.get('pass')}", flush=True)
    if len(gates_per_seed) > 1:
        res["stability"] = explain.stability(gates_per_seed)
    if a.lgbm:
        import lightgbm as lgb
        from aerofusion_ml.models import gbm

        rd = ML / "runs" / a.lgbm
        cfg = yaml.safe_load((rd / "config.yaml").read_text(encoding="utf-8"))
        booster = lgb.Booster(model_file=str(rd / "model.txt"))
        arr = data["arrays"]
        stations = np.where(station)[0]
        static = pd.DataFrame({"lat": dsz.node_lat.values, "lon": dsz.node_lon.values, "elev": dsz.node_elevation.values, "region": dsz.node_region.values})
        fc = None
        if cfg["setting"] == "S-B":
            from aerofusion_ml.data import cams
            fcz = xr.open_zarr(ML / "data/processed/cams_fc_v1.zarr").sel(point=[str(v) for v in dsz.node.values])[["pm2p5"]].load()
            fc = lambda t0: cams.forecast(fcz, t0)  # noqa: E731
        t0s = [pd.Timestamp(int(t), tz="UTC") for b in batches for t in b["t0_ns"].numpy()]
        X = pd.concat([gbm.features(arr, t0, np.array([1, 24, 48]), stations, static, fc(t0) if fc else None) for t0 in t0s], ignore_index=True)
        cols = cfg["features"]
        fmap = {f["key"]: f["group"] for f in yaml.safe_load((ML / "configs/features_v1.yaml").read_text(encoding="utf-8"))["features"]}
        col_groups = {}
        for c in cols:
            key = c.split("_lag")[0].replace("_mean24", "").replace("_max24", "").replace("_sum24", "")
            col_groups[c] = fmap.get(key, "cams" if c == "cams_fc_pm25" else ("calendar" if c.startswith("v_") or c == "lead" else "static"))
        res["lgbm_shap"] = {"run_id": a.lgbm, "mean_abs_shap_by_group": explain.lgbm_shap_by_group(booster, X[cols], col_groups)}
    outd = Path(a.out)
    outd.mkdir(parents=True, exist_ok=True)
    (outd / "attribution_val.json").write_text(json.dumps(res, indent=1, default=float), encoding="utf-8")
    md = ["Attribution checks (P4.4), validation year. Generated by ml/scripts/run_explain.py; do not edit.", "",
          "| Run | (a) faithfulness: Δ top-2 gate / IG / random | pass | (b) sanity final ρ | pass | (d) fire plausibility ρ (n) | pass |",
          "|---|---|---|---|---|---|---|"]
    for rid, r in res["runs"].items():
        if "skipped" in r:
            md.append(f"| {rid} | skipped: {r['skipped']} | | | | | |")
            continue
        f, s, p = r["faithfulness"], r["sanity"], r["plausibility_fire"]
        md.append(f"| {rid} | {f['delta_top_gate']:.4f} / {f['delta_top_ig']:.4f} / {f['delta_random_mean']:.4f} | {f['pass']} | "
                  f"{s['final_spearman']:.2f} | {s['pass']} | " + (f"{p['spearman']:.2f} ({p['n']})" if "spearman" in p else p.get("skipped", "-")) + f" | {p.get('pass', '-')} |")
    if "stability" in res:
        st = res["stability"]
        md += ["", f"(c) Stability across {len(gates_per_seed)} seeds: mean pairwise Spearman of mean gates = {st['mean_spearman']:.2f}, pass = {st['pass']}."]
    if "lgbm_shap" in res:
        md += ["", f"(e) LightGBM {res['lgbm_shap']['run_id']} mean |SHAP| by group: " +
               ", ".join(f"{k} {v:.3f}" for k, v in sorted(res["lgbm_shap"]["mean_abs_shap_by_group"].items(), key=lambda kv: -kv[1]))]
    (outd / "attribution_val.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    print("\n".join(md))


if __name__ == "__main__":
    main()
