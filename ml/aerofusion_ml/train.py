"""Train one experiment config and score it on val (PROGRESS P3 training defaults).

    python ml/aerofusion_ml/train.py --config ml/configs/exp/m0_gru.yaml [--max-steps N]

Writes ml/runs/<run_id>/{config.yaml, metrics.json, preds_val.parquet, ckpt.pt, norm_stats.json, env.txt}.
Masked Huber on standardised log1p PM2.5, AdamW + cosine, early stopping on val RMSE (µg/m³), AMP on CUDA, grad clip.
Device comes from the config ("auto" = cuda if available), so the same code runs on a laptop, Kaggle and the GPU box.
"""

from __future__ import annotations

import argparse
import json
import platform
import random
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import yaml

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML))
from aerofusion_ml import evaluate as ev  # noqa: E402
from aerofusion_ml.data import torch_dataset as tds  # noqa: E402
from aerofusion_ml.models import graph as gr  # noqa: E402
from aerofusion_ml.models.convlstm import node_xy  # noqa: E402
from aerofusion_ml.models.mwafn import MWAFN, Config, masked_huber  # noqa: E402
from aerofusion_ml.runs import make_run_id  # noqa: E402


def seed_all(s: int) -> None:
    random.seed(s), np.random.seed(s), torch.manual_seed(s), torch.cuda.manual_seed_all(s)


def make_model(cfg: dict, a, grid_lat=None, grid_lon=None) -> MWAFN:
    import xarray as xr

    ds = xr.open_zarr(ML / cfg.get("dataset", "data/processed/dataset_v1.zarr"))
    lat, lon = ds.node_lat.values.astype(float), ds.node_lon.values.astype(float)
    mc = Config.rung(cfg["rung"], n_feat=len(a.feats), n_nodes=len(lat), groups=a.groups,
                     wavelet_feats=[a.feats.index(f) for f in cfg.get("wavelet_feats", ["pm25", "pm10"])],
                     hidden=cfg.get("hidden", 64), grid_channels=cfg.get("grid_channels", 8))
    A = torch.from_numpy(gr.static_adjacency(lat, lon, k=8, max_km=600))
    _, bearing = gr.distance_bearing(lat, lon)
    xy = node_xy(lat, lon, torch.tensor([5.25, 37.5]), torch.tensor([66.25, 97.75]))
    return MWAFN(mc, A, torch.from_numpy(bearing.T.copy()), xy)


@torch.no_grad()
def predict(model, dl, device, stats) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    model.eval()
    P, Y, T0 = [], [], []
    for b in dl:
        b = {k: v.to(device) for k, v in b.items()}
        P.append(model(b)["pred"].float().cpu().numpy())
        y = b["y"].cpu().numpy()
        Y.append(np.where(b["y_mask"].cpu().numpy() > 0, y, np.nan))
        T0.append(b["t0_ns"].cpu().numpy())
    return stats.y_inv(np.concatenate(P)), stats.y_inv(np.concatenate(Y)), np.concatenate(T0)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    ap.add_argument("--max-steps", type=int, default=None, help="smoke test: stop after N optimiser steps")
    args = ap.parse_args()
    cfg = yaml.safe_load(Path(args.config).read_text(encoding="utf-8"))
    seed_all(cfg.get("seed", 0))
    dev = cfg.get("device", "auto")
    device = torch.device("cuda" if dev == "auto" and torch.cuda.is_available() else ("cpu" if dev == "auto" else dev))
    data = tds.build(cfg)
    a, stats = data["arrays"], data["stats"]
    model = make_model(cfg, a).to(device)
    n_params = sum(p.numel() for p in model.parameters())
    dl_tr = torch.utils.data.DataLoader(data["train"], batch_size=cfg.get("batch", 32), shuffle=True, num_workers=cfg.get("workers", 0), drop_last=True)
    dl_va = torch.utils.data.DataLoader(data["val"], batch_size=cfg.get("batch", 32), num_workers=cfg.get("workers", 0))
    opt = torch.optim.AdamW(model.parameters(), lr=cfg.get("lr", 1e-3), weight_decay=cfg.get("weight_decay", 1e-4))
    epochs = cfg.get("epochs", 60)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs * max(1, len(dl_tr)))
    amp = device.type == "cuda" and cfg.get("amp", True)
    scaler = torch.amp.GradScaler("cuda", enabled=amp)
    run_id = make_run_id(cfg["name"], cfg.get("seed", 0))
    run_dir = ML / "runs" / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    best, bad, step, t_start, log = np.inf, 0, 0, time.time(), []
    for epoch in range(epochs):
        model.train()
        t_ep = time.time()
        for b in dl_tr:
            b = {k: v.to(device) for k, v in b.items()}
            with torch.autocast(device.type, enabled=amp):
                out = model(b)
                loss = masked_huber(out["pred"].float(), b["y"], b["y_mask"]) + out["aux_loss"]
            opt.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.unscale_(opt)
            torch.nn.utils.clip_grad_norm_(model.parameters(), cfg.get("grad_clip", 1.0))
            scaler.step(opt), scaler.update(), sched.step()
            step += 1
            if args.max_steps and step >= args.max_steps:
                break
        p, y, _ = predict(model, dl_va, device, stats)
        rmse = float(np.sqrt(np.nanmean((p - y) ** 2)))
        log.append({"epoch": epoch, "val_rmse_ugm3": rmse, "train_loss_last": float(loss), "sec": round(time.time() - t_ep, 1)})
        print(json.dumps(log[-1]), flush=True)
        if rmse < best - 1e-4:
            best, bad = rmse, 0
            torch.save(model.state_dict(), run_dir / "ckpt.pt")
        else:
            bad += 1
        if bad >= cfg.get("patience", 8) or (args.max_steps and step >= args.max_steps):
            break
    model.load_state_dict(torch.load(run_dir / "ckpt.pt", map_location=device))
    p, y, t0 = predict(model, dl_va, device, stats)
    st = a.x.shape[1]
    import xarray as xr

    ds = xr.open_zarr(ML / cfg.get("dataset", "data/processed/dataset_v1.zarr"))
    node_ids = [str(n) for n in ds.node.values]
    is_station = ds.node_kind.values == "station"
    B = len(t0)
    df = pd.DataFrame({"t0": np.repeat(pd.to_datetime(t0, utc=True), 48 * st), "lead": np.tile(np.repeat(np.arange(1, 49), st), B),
                       "node_id": np.tile(node_ids, B * 48), "pred": p.reshape(-1), "obs": y.reshape(-1)})
    df = df[df["node_id"].isin(set(np.array(node_ids)[is_station]))]
    city_of = dict(zip(node_ids, [str(c) for c in ds.node_city_slug.values]))
    m = ev.evaluate(df, split="val", model=cfg["name"], setting=cfg.get("setting", "S-A"), run_id=run_id, city_of=city_of)
    m["training"] = {"epochs_run": len(log), "best_val_rmse_ugm3": best, "n_params": n_params, "device": str(device),
                     "gpu": torch.cuda.get_device_name(0) if device.type == "cuda" else None, "wall_sec": round(time.time() - t_start, 1),
                     "smoke_test": bool(args.max_steps), "log": log}
    if args.max_steps:
        m["status"] = "smoke"  # never a paper number: make_tables.py only reads status == measured
    ev.write(m, run_dir)
    df.to_parquet(run_dir / "preds_val.parquet", index=False)
    (run_dir / "config.yaml").write_text(yaml.safe_dump(cfg), encoding="utf-8")
    (run_dir / "norm_stats.json").write_text(json.dumps(stats.to_dict()), encoding="utf-8")
    (run_dir / "env.txt").write_text(f"python {platform.python_version()}\ntorch {torch.__version__}\nplatform {platform.platform()}\n", encoding="utf-8")
    print(f"done: {run_id} params={n_params:,} best_val_rmse={best:.2f}")


if __name__ == "__main__":
    main()
