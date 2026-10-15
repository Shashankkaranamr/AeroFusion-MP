"""P2.3 LightGBM baselines on val: S-A (lags + met) and, with --setting S-B, MOS with the CAMS forecast.

    python ml/scripts/run_gbm.py [--setting S-B] [--train-leads 8] [--seed 0]

CPU/RAM-bound (~3 M training rows at 8 sampled leads); run it on the bigger machine. Train rows: train-split issue
times at 00/12 UTC, a random subset of leads per issue time; val: all 48 leads at 00/12 UTC, scored by evaluate.py.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML))
from aerofusion_ml import evaluate as ev  # noqa: E402
from aerofusion_ml.data import loader, torch_dataset as tds  # noqa: E402
from aerofusion_ml.models import gbm  # noqa: E402
from aerofusion_ml.runs import make_run_id  # noqa: E402


def main() -> None:
    import lightgbm as lgb
    import xarray as xr

    ap = argparse.ArgumentParser()
    ap.add_argument("--setting", default="S-A", choices=["S-A", "S-B"])
    ap.add_argument("--train-leads", type=int, default=8)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()
    if args.setting == "S-B":
        raise SystemExit("S-B needs processed/cams_fc_v1.zarr (P1.7, scripts/build_cams_fc.py) - wire cams_fc here once it exists")
    sp = yaml.safe_load((ML / "configs" / "splits_v1.yaml").read_text(encoding="utf-8"))
    feats_cfg = yaml.safe_load((ML / "configs" / "features_v1.yaml").read_text(encoding="utf-8"))
    stop = pd.Timestamp(sp["splits"]["val"]["end"]) + pd.Timedelta(hours=23)
    a = loader.NodeArrays.from_zarr(ML / "data/processed/dataset_v1.zarr", feats_cfg, None, stop)
    ds = xr.open_zarr(ML / "data/processed/dataset_v1.zarr")
    stations = np.where(ds.node_kind.values == "station")[0]
    static = pd.DataFrame({"lat": ds.node_lat.values, "lon": ds.node_lon.values, "elev": ds.node_elevation.values, "region": ds.node_region.values})
    rng = np.random.default_rng(args.seed)
    tz_stop = stop.tz_localize("UTC")
    t_tr = tds.issue_times(a.times, sp["splits"]["train"], sp["issue_hours_eval"], tz_stop)
    t_va = tds.issue_times(a.times, sp["splits"]["val"], sp["issue_hours_eval"], tz_stop)
    Xtr, ytr = [], []
    for t0 in t_tr:
        leads = np.sort(rng.choice(np.arange(1, 49), args.train_leads, replace=False))
        Xtr.append(gbm.features(a, t0, leads, stations, static))
        ytr.append(gbm.target(a, t0, leads, stations))
    Xtr, ytr = pd.concat(Xtr, ignore_index=True), np.concatenate(ytr)
    ok = ~np.isnan(ytr)
    cols = [c for c in Xtr.columns if c not in ("t0", "lead_h")]
    model = lgb.train({**gbm.PARAMS, "seed": args.seed}, lgb.Dataset(Xtr.loc[ok, cols], np.log1p(np.clip(ytr[ok], 0, None))), num_boost_round=800)
    leads = np.arange(1, 49)
    rows = []
    for t0 in t_va:
        X = gbm.features(a, t0, leads, stations, static)
        rows.append(pd.DataFrame({"t0": t0, "lead": X["lead_h"], "node_id": [str(v) for v in ds.node.values[X["node_idx"].to_numpy()]],  # node_idx = absolute node index
                                  "pred": np.expm1(model.predict(X[cols])), "obs": gbm.target(a, t0, leads, stations)}))
    df = pd.concat(rows, ignore_index=True)
    name = "lgbm_sa" if args.setting == "S-A" else "lgbm_mos_sb"
    run_id = make_run_id(name, args.seed)
    city_of = dict(zip(np.array([str(v) for v in ds.node.values]), np.array([str(v) for v in ds.node_city_slug.values])))
    m = ev.evaluate(df, split="val", model=name, setting=args.setting, run_id=run_id, city_of=city_of)
    run_dir = ML / "runs" / run_id
    ev.write(m, run_dir)
    df.to_parquet(run_dir / "preds_val.parquet", index=False)
    (run_dir / "config.yaml").write_text(yaml.safe_dump({"model": name, "setting": args.setting, "seed": args.seed, "train_leads": args.train_leads,
                                                          "params": gbm.PARAMS, "rounds": 800, "features": cols}), encoding="utf-8")
    model.save_model(str(run_dir / "model.txt"))
    print(f"{name}: {run_id} ({len(Xtr):,} train rows)")


if __name__ == "__main__":
    main()
