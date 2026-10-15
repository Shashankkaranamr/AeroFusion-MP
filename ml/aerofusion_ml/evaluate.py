"""Evaluation harness (PROGRESS P2.1). Every number in tables comes from the metrics.json this writes.

Input: a long prediction frame with columns t0 (UTC), lead (h), node_id, pred, obs, and optionally reference
predictions (persistence, cams) in columns named ref_<name>. Rows with missing obs are dropped first, so masked
observations never enter a metric. City-level scores use the mean of a city's station predictions and observations
per (t0, lead), computed here at evaluation time (§3.2).

The frozen test split can only be scored through scripts/final_eval.py (allow_test=True), which P4 owns.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

ML = Path(__file__).resolve().parents[1]
CFG = ML / "configs" / "eval_v1.yaml"
FROZEN = {"test", "extra_pm_only", "rolling_test"}


def load_cfg(path: Path = CFG) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def scores(pred: np.ndarray, obs: np.ndarray) -> dict:
    pred, obs = np.asarray(pred, float), np.asarray(obs, float)
    ok = ~(np.isnan(pred) | np.isnan(obs))
    p, o = pred[ok], obs[ok]
    n = int(ok.sum())
    if n == 0:
        return {"n": 0, "rmse": None, "mae": None, "r2": None, "bias": None}
    err = p - o
    sst = float(((o - o.mean()) ** 2).sum())
    return {"n": n, "rmse": float(np.sqrt((err ** 2).mean())), "mae": float(np.abs(err).mean()),
            "r2": float(1 - (err ** 2).sum() / sst) if sst > 0 else None, "bias": float(err.mean())}


def skill(rmse: float | None, rmse_ref: float | None) -> float | None:
    """1 - RMSE / RMSE_ref (positive = better than the reference)."""
    if rmse is None or not rmse_ref:
        return None
    return float(1 - rmse / rmse_ref)


def episodes(pred: np.ndarray, obs: np.ndarray, thr: float) -> dict:
    pred, obs = np.asarray(pred, float), np.asarray(obs, float)
    ok = ~(np.isnan(pred) | np.isnan(obs))
    fp, fo = pred[ok] > thr, obs[ok] > thr
    hits, fa, miss = int((fp & fo).sum()), int((fp & ~fo).sum()), int((~fp & fo).sum())
    return {"threshold": thr, "events": int(fo.sum()), "hits": hits, "false_alarms": fa, "misses": miss,
            "pod": hits / (hits + miss) if hits + miss else None,
            "far": fa / (hits + fa) if hits + fa else None,
            "csi": hits / (hits + fa + miss) if hits + fa + miss else None}


def aqi_class(x: np.ndarray, breaks: list[float]) -> np.ndarray:
    """Class index 0..len(breaks); upper bounds inclusive (CPCB: 0-30 good, 31-60 satisfactory, ...)."""
    return np.searchsorted(np.asarray(breaks, float), np.asarray(x, float), side="left")


def aqi_scores(pred: np.ndarray, obs: np.ndarray, breaks: list[float]) -> dict:
    pred, obs = np.asarray(pred, float), np.asarray(obs, float)
    ok = ~(np.isnan(pred) | np.isnan(obs))
    cp, co = aqi_class(pred[ok], breaks), aqi_class(obs[ok], breaks)
    f1s = []
    for k in range(len(breaks) + 1):
        tp = int(((cp == k) & (co == k)).sum())
        fp = int(((cp == k) & (co != k)).sum())
        fn = int(((cp != k) & (co == k)).sum())
        if tp + fp + fn:
            f1s.append(2 * tp / (2 * tp + fp + fn))
    return {"n": int(ok.sum()), "accuracy": float((cp == co).mean()) if ok.any() else None,
            "macro_f1": float(np.mean(f1s)) if f1s else None}


def city_mean(df: pd.DataFrame, city_of: dict[str, str]) -> pd.DataFrame:
    d = df.assign(city=df["node_id"].map(city_of))
    cols = ["pred", "obs", *[c for c in df.columns if c.startswith("ref_")]]
    return d.groupby(["city", "t0", "lead"], as_index=False)[cols].mean()


def season_of(valid: pd.Series, cfg: dict) -> pd.Series:
    m = valid.dt.month
    out = pd.Series("other", index=valid.index)
    for name, months in cfg["seasons"].items():
        out[m.isin(months)] = name
    return out


def _block(d: pd.DataFrame, cfg: dict) -> dict:
    s = scores(d["pred"], d["obs"])
    for c in [c for c in d.columns if c.startswith("ref_")]:
        r = scores(d[c], d["obs"])
        s[f"skill_vs_{c[4:]}"] = skill(s["rmse"], r["rmse"])
    return s


def evaluate(df: pd.DataFrame, *, split: str, model: str, setting: str, run_id: str, city_of: dict[str, str],
             cfg: dict | None = None, allow_test: bool = False) -> dict:
    if split in FROZEN and not allow_test:
        raise PermissionError(f"split {split!r} is frozen; only scripts/final_eval.py (P4) may score it")
    cfg = cfg or load_cfg()
    df = df[df["obs"].notna()].copy()  # masked observations are excluded from every metric
    df["valid"] = pd.to_datetime(df["t0"], utc=True) + pd.to_timedelta(df["lead"], unit="h")
    df["season"] = season_of(df["valid"], cfg)
    df["city"] = df["node_id"].map(city_of)
    df["region"] = np.where(df["city"].isin(cfg["igp_cities"]), "IGP", "rest")
    thr, breaks = cfg["episode_threshold_ugm3"], cfg["aqi_breaks"]
    out = {"run_id": run_id, "model": model, "setting": setting, "split": split, "status": "measured",
           "created": datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "n_issue_times": int(df["t0"].nunique()), "n_stations": int(df["node_id"].nunique()), "leads": {}}
    cities = city_mean(df, city_of)
    for lead in cfg["leads_report"]:
        d = df[df["lead"] == lead]
        c = cities[cities["lead"] == lead]
        out["leads"][str(lead)] = {
            "station": _block(d, cfg),
            "city": _block(c, cfg),
            "by_season": {k: _block(g, cfg) for k, g in d.groupby("season")},
            "by_region": {k: _block(g, cfg) for k, g in d.groupby("region")},
            "by_city": {k: _block(g, cfg) for k, g in c.groupby("city")},
            "episodes": episodes(d["pred"], d["obs"], thr),
            "aqi": aqi_scores(d["pred"], d["obs"], breaks),
        }
    return out


def write(metrics: dict, run_dir: Path) -> Path:
    run_dir.mkdir(parents=True, exist_ok=True)
    p = run_dir / "metrics.json"
    p.write_text(json.dumps(metrics, indent=1), encoding="utf-8")
    return p
