"""P4.2 main tables: mean ± sd over seeds per model and lead, and Diebold-Mariano tests (PROGRESS P4.2).

    python ml/scripts/make_final_tables.py --split val            # development check, any time
    python ml/scripts/make_final_tables.py --split test --final   # only after final_eval.py has written metrics_test.json

Reads only run artifacts at one ml/ commit (--commit, default e6b796e): metrics.json / metrics_<split>.json and
preds_<split>.parquet. Neural models use every seed found (0-4); deterministic baselines have one run.
DM test: per issue time t0, the loss is the mean squared station error at that lead (seed losses averaged for a
multi-seed model). The loss differential d_t = L_model - L_ref is tested with a Newey-West variance (lag = number of
issue times a forecast window overlaps, ceil(lead / 12) - 1 for 00/12 UTC issues) and the Harvey-Leybourne-Newbold
small-sample correction; two-sided p from Student t(n-1). Negative mean d = the model is better.
Writes docs/paper/tables/final_<split>_seeds.{md,tex,json}. Never type a number into a table by hand.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ML = Path(__file__).resolve().parents[1]
REPO = ML.parent
OUT = REPO / "docs" / "paper" / "tables"
LEADS = [1, 24, 48]
NEURAL = ["m6_mwafn", "m6_mwafn_sb", "abl_no_wavelet", "abl_no_graph", "abl_fixed_graph", "abl_no_convlstm",
          "abl_gru_temporal", "abl_no_gating", "base_cnn_lstm", "base_pm25gnn", "base_lstm", "base_graph_wavenet"]
SINGLE = ["persistence", "same_hour_yesterday", "climatology", "cams_raw", "cams_bc", "lgbm_sa", "lgbm_mos_sb"]


def runs_of(model: str, commit: str, split: str) -> list[Path]:
    mfile = "metrics.json" if split == "val" else f"metrics_{split}.json"
    out = []
    for s in range(5):
        c = [d for d in sorted((ML / "runs").glob(f"*-{model}-s{s}-{commit}")) if (d / mfile).exists()]
        if c:
            out.append(c[-1])
    return out


def metrics(rd: Path, split: str) -> dict:
    return json.loads((rd / ("metrics.json" if split == "val" else f"metrics_{split}.json")).read_text(encoding="utf-8"))


def t0_loss(rds: list[Path], split: str, lead: int) -> pd.Series:
    """Mean squared station error per issue time at one lead, averaged over the seeds' losses."""
    per = []
    for rd in rds:
        df = pd.read_parquet(rd / f"preds_{split}.parquet", columns=["t0", "lead", "node_id", "pred", "obs"], filters=[("lead", "==", lead)])
        df = df[df["obs"].notna() & df["pred"].notna()]
        per.append(((df["pred"].astype("float64") - df["obs"]) ** 2).groupby(df["t0"]).mean())
    return pd.concat(per, axis=1).mean(axis=1)


def dm_test(d: np.ndarray, lag: int) -> tuple[float, float]:
    """Diebold-Mariano with Newey-West variance and the HLN correction. Returns (statistic, two-sided p)."""
    from scipy import stats

    d = d[np.isfinite(d)]
    n = len(d)
    if n < 10:
        return float("nan"), float("nan")
    e = d - d.mean()
    var = e @ e / n
    for k in range(1, lag + 1):
        var += 2 * (1 - k / (lag + 1)) * (e[k:] @ e[:-k]) / n
    if var <= 0:
        return float("nan"), float("nan")
    dm = d.mean() / math.sqrt(var / n)
    h = lag + 1
    hln = math.sqrt((n + 1 - 2 * h + h * (h - 1) / n) / n)
    stat = dm * hln
    return stat, float(2 * stats.t.sf(abs(stat), n - 1))


def ms(v: list[float]) -> str:
    if not v:
        return "-"
    if len(v) == 1:
        return f"{v[0]:.1f}"
    return f"{np.mean(v):.1f} ± {np.std(v, ddof=1):.1f}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", default="val")
    ap.add_argument("--commit", default="e6b796e")
    ap.add_argument("--final", action="store_true")
    ap.add_argument("--refs", nargs="*", default=["lgbm_mos_sb", "cams_bc"], help="DM reference models")
    ap.add_argument("--no-dm", action="store_true")
    a = ap.parse_args()
    if a.split != "val" and not a.final:
        raise SystemExit("frozen splits need --final (after final_eval.py)")
    rows, found = [], {}
    for model in NEURAL + SINGLE:
        rds = runs_of(model, a.commit, a.split)
        if not rds:
            continue
        found[model] = rds
        ms_ = [metrics(rd, a.split) for rd in rds]
        row = {"model": model, "setting": ms_[0].get("setting"), "seeds": len(rds), "run_ids": [rd.name for rd in rds]}
        for L in LEADS:
            st = [m["leads"][str(L)]["station"] for m in ms_]
            row[f"rmse_{L}"] = [s["rmse"] for s in st]
            row[f"mae_{L}"] = [s["mae"] for s in st]
            row[f"skill_{L}"] = [s.get("skill_vs_persistence") for s in st if s.get("skill_vs_persistence") is not None]
        rows.append(row)
    dm = {}
    if not a.no_dm:
        for ref in a.refs:
            if ref not in found:
                continue
            ref_loss = {L: t0_loss(found[ref], a.split, L) for L in LEADS}
            for model, rds in found.items():
                if model == ref:
                    continue
                for L in LEADS:
                    lm = t0_loss(rds, a.split, L)
                    j = pd.concat([lm, ref_loss[L]], axis=1, join="inner").dropna()
                    d = (j.iloc[:, 0] - j.iloc[:, 1]).to_numpy()
                    stat, p = dm_test(d, max(0, math.ceil(L / 12) - 1))
                    dm[f"{model}|{ref}|{L}"] = {"mean_d": float(np.mean(d)), "stat": stat, "p": p, "n": int(len(d))}
                print(f"DM {model} vs {ref} done", flush=True)
    OUT.mkdir(parents=True, exist_ok=True)
    stem = f"final_{a.split}_seeds"
    (OUT / f"{stem}.json").write_text(json.dumps({"split": a.split, "commit": a.commit, "rows": rows, "dm": dm}, indent=1), encoding="utf-8")
    hdr = "| Model | Setting | Seeds | " + " | ".join(f"RMSE +{L} h" for L in LEADS) + " | " + " | ".join(f"MAE +{L} h" for L in LEADS)
    refs = [r for r in a.refs if r in found and not a.no_dm]
    hdr += "".join(f" | DM p vs {r} +{L} h" for r in refs for L in LEADS) + " |"
    md = [f"Station RMSE/MAE (µg/m³), split {a.split}, commit {a.commit}: mean ± sd over seeds. Generated by ml/scripts/make_final_tables.py; do not edit.", "",
          hdr, "|" + "---|" * (hdr.count("|") - 1)]
    tex = [f"% generated by ml/scripts/make_final_tables.py; split={a.split}, commit={a.commit}. Do not edit.",
           r"\begin{tabular}{lll" + "r" * len(LEADS) + "}", r"\toprule", "Model & Setting & Seeds & " + " & ".join(f"RMSE +{L} h" for L in LEADS) + r" \\", r"\midrule"]
    for r in rows:
        cells = [ms(r[f"rmse_{L}"]) for L in LEADS] + [ms(r[f"mae_{L}"]) for L in LEADS]
        for ref in refs:
            for L in LEADS:
                x = dm.get(f"{r['model']}|{ref}|{L}")
                cells.append("-" if not x else f"{x['p']:.3f} " + ("n.s." if not x["p"] < 0.05 else ("better" if x["mean_d"] < 0 else "worse")))
        md.append(f"| {r['model']} | {r['setting']} | {r['seeds']} | " + " | ".join(cells) + " |")
        name = r["model"].replace("_", r"\_")
        tex.append(f"{name} & {r['setting']} & {r['seeds']} & " + " & ".join(c.replace("±", r"$\pm$") for c in cells[:len(LEADS)]) + r" \\ % " + " ".join(f"run_id: {x}" for x in r["run_ids"]))
    tex += [r"\bottomrule", r"\end{tabular}", ""]
    (OUT / f"{stem}.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    (OUT / f"{stem}.tex").write_text("\n".join(tex), encoding="utf-8")
    print(f"wrote {stem}.md/.tex/.json: {len(rows)} models, {len(dm)} DM tests")


if __name__ == "__main__":
    main()
