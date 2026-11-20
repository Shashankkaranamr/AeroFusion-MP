"""P4.2: the ONLY code allowed to read the frozen test split (PROGRESS §0 rule 2).

    python ml/scripts/final_eval.py --freeze ml/MODEL_FREEZE.json

Refuses to run unless:
  1. ml/MODEL_FREEZE.json exists and is committed (written by the team at model freeze): {"git_commit": sha,
     "run_ids": [neural runs], "baselines": {name: its val run_id}}. git_commit is the ml/ commit the frozen runs were
     trained at (the suffix of every run_id). The tree must be clean, and the model code, configs and frozen data files
     (FROZEN_CODE) must be identical at git_commit and at HEAD. (Changed 2026-11-20: the old rule "HEAD == git_commit"
     could never pass, because committing MODEL_FREEZE.json itself moves HEAD.)
  2. the test-split sha256 of x and y in the current dataset_v1 equals ml/data/SPLITS.lock (checked again afterwards).
Each frozen run gets ml/runs/<run_id>/metrics_<split>.json (status measured, split test / extra_pm_only). No tuning,
selection or early stopping may use these numbers (P4.3).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ML = Path(__file__).resolve().parents[1]
REPO = ML.parent
sys.path.insert(0, str(ML))

FROZEN_SPLITS = ("test", "extra_pm_only")
FROZEN_CODE = ["ml/aerofusion_ml", "ml/configs", "ml/data/SPLITS.lock", "ml/data/stations_v1.csv", "ml/data/nodes_v1.csv"]  # what a frozen run depends on


def sha(a: np.ndarray) -> str:
    return hashlib.sha256(np.ascontiguousarray(a).tobytes()).hexdigest()


def check_lock(zarr_path: Path, lock_path: Path, splits=FROZEN_SPLITS) -> dict:
    """Recompute sha256 of x/y for the frozen splits and compare with SPLITS.lock. Raises on any mismatch."""
    import xarray as xr

    lock = json.loads(lock_path.read_text(encoding="utf-8"))
    ds = xr.open_zarr(zarr_path)
    times = pd.DatetimeIndex(ds.time.values)
    out = {}
    for name in splits:
        if name not in lock["splits"]:
            continue
        s = lock["splits"][name]
        sel = (times >= pd.Timestamp(s["start"])) & (times <= pd.Timestamp(s["end"]) + pd.Timedelta(hours=23))
        part = ds.isel(time=np.where(sel)[0])  # read only this split's rows
        got = {"sha256_y": sha(part.y.values), "sha256_x": sha(part.x_node.values)}
        for k, v in got.items():
            if v != s[k]:
                raise RuntimeError(f"SPLITS.lock mismatch for {name}.{k}: dataset changed after the split was locked")
        out[name] = got
    return out


def check_freeze(freeze_path: Path) -> dict:
    if not freeze_path.exists():
        raise PermissionError(f"{freeze_path} not found: the test split opens only after model freeze (P3 exit, week 12)")
    fz = json.loads(freeze_path.read_text(encoding="utf-8"))
    sha_ = fz.get("git_commit", "")
    if len(sha_) < 7:
        raise PermissionError("MODEL_FREEZE.json needs git_commit (the ml/ commit of the frozen runs, >= 7 hex digits)")
    if not fz.get("run_ids"):
        raise PermissionError("MODEL_FREEZE.json lists no run_ids")
    git = lambda *a: subprocess.run(["git", *a], cwd=REPO, capture_output=True, text=True)
    if git("cat-file", "-e", f"{sha_}^{{commit}}").returncode != 0:
        raise PermissionError(f"git_commit {sha_} is not a commit in this repository")
    dirty = git("status", "--porcelain", "--", ".", ":(exclude)ml/runs").stdout.strip()
    if dirty:
        raise PermissionError("the tree must be clean (commit MODEL_FREEZE.json first): " + dirty)
    if git("ls-files", "--error-unmatch", str(freeze_path.resolve().relative_to(REPO.resolve())).replace("\\", "/")).returncode != 0:
        raise PermissionError(f"{freeze_path.name} must be committed")
    if git("diff", "--quiet", sha_, "HEAD", "--", *FROZEN_CODE).returncode != 0:
        raise PermissionError(f"model code/configs/frozen data changed between {sha_} and HEAD: " + git("diff", "--stat", sha_, "HEAD", "--", *FROZEN_CODE).stdout)
    short = sha_[:7]
    bad = [r for r in list(fz["run_ids"]) + list(fz.get("baselines", {}).values()) if not r.endswith("-" + short)]
    if bad:
        raise PermissionError(f"run ids not trained at {short}: {bad}")
    missing = [r for r in fz["run_ids"] if not (ML / "runs" / r / "ckpt.pt").exists()]
    if missing:
        raise PermissionError(f"frozen runs without ckpt.pt: {missing}")
    return fz


def score_frozen_runs(fz: dict, splits=FROZEN_SPLITS) -> None:
    """Neural runs (ckpt.pt + norm_stats.json): predict and score each frozen split. Non-neural baselines are scored by
    their own scripts' --final mode (P4), which must call evaluate(..., allow_test=True) only from here as well."""
    import torch
    import xarray as xr
    import yaml

    from aerofusion_ml import evaluate as ev
    from aerofusion_ml.data import torch_dataset as tds
    from aerofusion_ml.train import make_model, predict

    ds = xr.open_zarr(ML / "data/processed/dataset_v1.zarr")
    node_ids = [str(n) for n in ds.node.values]
    stations = set(np.array(node_ids)[ds.node_kind.values == "station"])
    city_of = dict(zip(node_ids, np.array([str(v) for v in ds.node_city_slug.values])))
    for run_id in fz["run_ids"]:
        rd = ML / "runs" / run_id
        cfg = yaml.safe_load((rd / "config.yaml").read_text(encoding="utf-8"))
        stats = tds.Stats.from_dict(json.loads((rd / "norm_stats.json").read_text(encoding="utf-8")))
        gstats = None
        if (rd / "grid_stats.json").exists():
            g = json.loads((rd / "grid_stats.json").read_text(encoding="utf-8"))
            gstats = (np.asarray(g["mean"], np.float32), np.asarray(g["std"], np.float32))
        for split in splits:
            data = tds.build_frozen(cfg, split, stats, gstats, _caller="final_eval")
            model = make_model(cfg, data.a)
            dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")  # GPU when present (2026-11-20; same weights, float32)
            model.load_state_dict(torch.load(rd / "ckpt.pt", map_location="cpu"))
            model.to(dev)
            dl = torch.utils.data.DataLoader(data, batch_size=cfg.get("batch", 32))
            with torch.no_grad():
                p, y, t0 = predict(model, dl, dev, stats)
            n = p.shape[-1]
            df = pd.DataFrame({"t0": np.repeat(pd.to_datetime(t0, utc=True), 48 * n), "lead": np.tile(np.repeat(np.arange(1, 49), n), len(t0)),
                               "node_id": np.tile(node_ids, len(t0) * 48), "pred": p.reshape(-1), "obs": y.reshape(-1)})
            df = df[df["node_id"].isin(stations)]
            m = ev.evaluate(df, split=split, model=cfg["name"], setting=cfg.get("setting", "S-A"), run_id=run_id, city_of=city_of, allow_test=True)
            (rd / f"metrics_{split}.json").write_text(json.dumps(m, indent=1), encoding="utf-8")
            df.to_parquet(rd / f"preds_{split}.parquet", index=False)
            print(f"{run_id} {split}: scored")


def _frozen_slice(split: str):
    """Arrays for one frozen split: from 72 h before its start (input warm-up) to its end."""
    import xarray as xr
    import yaml

    sp = yaml.safe_load((ML / "configs" / "splits_v1.yaml").read_text(encoding="utf-8"))
    s = sp["splits"][split]
    ds = xr.open_zarr(ML / "data/processed/dataset_v1.zarr")
    lo = pd.Timestamp(s["start"]) - pd.Timedelta(hours=73)
    hi = pd.Timestamp(s["end"]) + pd.Timedelta(hours=23)
    part = ds.sel(time=slice(lo, hi))
    st = part.node_kind.values == "station"
    times = pd.DatetimeIndex(part.time.values).tz_localize("UTC")
    return sp, s, part, st, times


def score_baselines(fz: dict, splits=FROZEN_SPLITS) -> None:
    """Non-neural baselines named in MODEL_FREEZE.json "baselines": {name: val_run_id}. Fitted parts (climatology,
    CAMS bias correction, LightGBM) are re-fitted on train / loaded from the val run, never on test."""
    import xarray as xr
    import yaml

    from aerofusion_ml import evaluate as ev
    from aerofusion_ml.data import cams, torch_dataset as tds, windows
    from aerofusion_ml.models import baselines as bl
    from aerofusion_ml.models.cams_baseline import LinearBC

    names = fz.get("baselines", {})
    if not names:
        return
    full = xr.open_zarr(ML / "data/processed/dataset_v1.zarr")
    city_of = dict(zip(np.array([str(v) for v in full.node.values]), np.array([str(v) for v in full.node_city_slug.values])))
    sp = yaml.safe_load((ML / "configs" / "splits_v1.yaml").read_text(encoding="utf-8"))
    tr = sp["splits"]["train"]
    trsel = full.sel(time=slice(tr["start"], tr["end"] + " 23:00"))
    st_all = full.node_kind.values == "station"
    clim = bl.Climatology(pd.DatetimeIndex(trsel.time.values).tz_localize("UTC"), trsel.y.values[:, st_all], tr)
    fc = None
    if any(n.startswith("cams") for n in names):
        ids = np.array([str(v) for v in full.node.values[st_all]])
        fc = xr.open_zarr(ML / "data/processed/cams_fc_v1.zarr").sel(point=ids).load()
        ttimes = pd.DatetimeIndex(full.time.values).tz_localize("UTC")
        y_all = full.y.values[:, st_all]
        t_tr = tds.issue_times(ttimes, tr, sp["issue_hours_eval"], pd.Timestamp(tr["end"], tz="UTC") + pd.Timedelta(hours=23))
        bc = LinearBC().fit(np.stack([cams.forecast(fc, t) for t in t_tr]), np.stack([y_all[windows.target_index(ttimes, t)] for t in t_tr]))
    for split in splits:
        _, s, part, st, times = _frozen_slice(split)
        ids = np.array([str(v) for v in part.node.values[st]])
        y, pm_in = part.y.values[:, st], part.x_node.sel(feat="pm25").values[:, st]
        t0s = tds.issue_times(times, s, sp["issue_hours_eval"], times[-1])
        pers = bl.frame(times, y, ids, t0s, lambda pos0, t0: bl.persistence(pm_in, pos0))["pred"].to_numpy()
        fns = {
            "persistence": lambda pos0, t0: bl.persistence(pm_in, pos0),
            "same_hour_yesterday": lambda pos0, t0: bl.same_hour_yesterday(pm_in, pos0),
            "climatology": lambda pos0, t0: clim.predict(t0 + pd.to_timedelta(bl.LEADS, unit="h")),
            "cams_raw": lambda pos0, t0: cams.forecast(fc, t0),
            "cams_bc": lambda pos0, t0: bc.predict(cams.forecast(fc, t0)),
        }
        for name, val_run in names.items():
            if name.startswith("lgbm"):
                m, df = score_gbm(ML / "runs" / val_run, split, city_of)
                (ML / "runs" / val_run / f"metrics_{split}.json").write_text(json.dumps(m, indent=1), encoding="utf-8")
                df.to_parquet(ML / "runs" / val_run / f"preds_{split}.parquet", index=False)
                print(f"{name} ({val_run}) {split}: scored")
                continue
            if name not in fns:
                print(f"{name}: no frozen scorer")
                continue
            df = bl.frame(times, y, ids, t0s, fns[name])
            df["ref_persistence"] = pers
            m = ev.evaluate(df, split=split, model=name, setting="S-B" if name.startswith("cams") else "S-A", run_id=val_run, city_of=city_of, allow_test=True)
            rd = ML / "runs" / val_run
            (rd / f"metrics_{split}.json").write_text(json.dumps(m, indent=1), encoding="utf-8")
            print(f"{name} ({val_run}) {split}: scored")


def score_gbm(run_dir: Path, split: str, city_of: dict) -> tuple[dict, pd.DataFrame]:
    """LightGBM (S-A or S-B MOS): the booster saved by run_gbm.py (fitted on train only, chosen on val) predicts every
    issue time of `split`, with the same features and CAMS latency rule as run_gbm.py. Added 2026-11-20 (P4.2).
    `split` may be "val" to check that this path reproduces the val run's metrics.json."""
    import lightgbm as lgb
    import xarray as xr
    import yaml

    from aerofusion_ml import evaluate as ev
    from aerofusion_ml.data import cams, loader, torch_dataset as tds
    from aerofusion_ml.models import gbm

    cfg = yaml.safe_load((run_dir / "config.yaml").read_text(encoding="utf-8"))
    sp = yaml.safe_load((ML / "configs" / "splits_v1.yaml").read_text(encoding="utf-8"))
    feats_cfg = yaml.safe_load((ML / "configs" / "features_v1.yaml").read_text(encoding="utf-8"))
    s = sp["splits"][split]
    lo = pd.Timestamp(s["start"]) - pd.Timedelta(hours=73)
    hi = pd.Timestamp(s["end"]) + pd.Timedelta(hours=23)
    a = loader.NodeArrays.from_zarr(ML / "data/processed/dataset_v1.zarr", feats_cfg, lo, hi)
    ds = xr.open_zarr(ML / "data/processed/dataset_v1.zarr")
    stations = np.where(ds.node_kind.values == "station")[0]
    static = pd.DataFrame({"lat": ds.node_lat.values, "lon": ds.node_lon.values, "elev": ds.node_elevation.values, "region": ds.node_region.values})
    fc = None
    if cfg["setting"] == "S-B":
        fc = xr.open_zarr(ML / "data/processed/cams_fc_v1.zarr").sel(point=[str(v) for v in ds.node.values])[["pm2p5"]].load()
    model = lgb.Booster(model_file=str(run_dir / "model.txt"))
    cols = cfg["features"]
    leads = np.arange(1, 49)
    t0s = tds.issue_times(a.times, s, sp["issue_hours_eval"], hi.tz_localize("UTC"))
    rows = []
    for t0 in t0s:
        X = gbm.features(a, t0, leads, stations, static, cams.forecast(fc, t0) if fc is not None else None)
        rows.append(pd.DataFrame({"t0": t0, "lead": X["lead_h"], "node_id": [str(v) for v in ds.node.values[X["node_idx"].to_numpy()]],
                                  "pred": np.expm1(model.predict(X[cols])), "obs": gbm.target(a, t0, leads, stations)}))
    df = pd.concat(rows, ignore_index=True)
    kw = {} if split == "val" else {"allow_test": True}
    m = ev.evaluate(df, split=split, model=cfg["model"], setting=cfg["setting"], run_id=run_dir.name, city_of=city_of, **kw)
    return m, df


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--freeze", default=str(ML / "MODEL_FREEZE.json"))
    a = ap.parse_args()
    fz = check_freeze(Path(a.freeze))
    zarr_path, lock_path = ML / "data/processed/dataset_v1.zarr", ML / "data/SPLITS.lock"
    before = check_lock(zarr_path, lock_path)
    score_frozen_runs(fz, FROZEN_SPLITS)
    score_baselines(fz, FROZEN_SPLITS)
    after = check_lock(zarr_path, lock_path)
    assert before == after
    print("final evaluation complete; SPLITS.lock verified before and after")


if __name__ == "__main__":
    main()
