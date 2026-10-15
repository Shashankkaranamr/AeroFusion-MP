"""Paper figures and the compute report from run artifacts only (PROGRESS P4.5, P4.6).

    python ml/scripts/make_figures.py --compute                       # docs/paper/tables/compute.md from runs/*/metrics.json
    python ml/scripts/make_figures.py --cases --runs <id> <id> ...    # case studies (needs preds_test.parquet: after final_eval)
    python ml/scripts/make_figures.py --ladder                        # val RMSE per rung (M0..M6) at +1/+24/+48 h

Case studies (§P4.5): Delhi stubble episodes (1-15 Nov 2023 and 2024), Diwali 2023 (12 Nov) and 2024 (31 Oct) +-3 days,
and one dust event (pre-monsoon; pick the window from CAMS dust AOD on train/val, not from test errors).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

ML = Path(__file__).resolve().parents[1]
REPO = ML.parent
FIG = REPO / "docs" / "paper" / "figures"
TAB = REPO / "docs" / "paper" / "tables"

CASES = {
    "stubble_2023": ("2023-11-01", "2023-11-15", "delhi"),
    "stubble_2024": ("2024-11-01", "2024-11-15", "delhi"),
    "diwali_2023": ("2023-11-09", "2023-11-15", "delhi"),
    "diwali_2024": ("2024-10-28", "2024-11-03", "delhi"),
}


def compute_table(runs_dir: Path = ML / "runs") -> pd.DataFrame:
    rows = []
    for f in sorted(runs_dir.glob("*/metrics.json")):
        m = json.loads(f.read_text(encoding="utf-8"))
        t = m.get("training")
        if not t or m.get("status") != "measured":
            continue
        rows.append({"run_id": m["run_id"], "model": m["model"], "setting": m["setting"], "params": t["n_params"], "device": t.get("gpu") or t["device"],
                     "epochs": t["epochs_run"], "hours": round(t["wall_sec"] / 3600, 2),
                     "sec_per_epoch": round(sum(e["sec"] for e in t["log"]) / max(len(t["log"]), 1), 1)})
    return pd.DataFrame(rows)


def case_frame(preds: pd.DataFrame, city_of: dict, start: str, end: str, city: str, lead: int) -> pd.DataFrame:
    """City-mean prediction and observation at one lead, indexed by valid time, for one case window."""
    d = preds[preds["lead"] == lead].assign(city=lambda x: x["node_id"].map(city_of))
    d = d[d["city"] == city]
    d = d.assign(valid=pd.to_datetime(d["t0"], utc=True) + pd.to_timedelta(d["lead"], unit="h"))
    d = d[(d["valid"] >= pd.Timestamp(start, tz="UTC")) & (d["valid"] <= pd.Timestamp(end, tz="UTC") + pd.Timedelta(hours=23))]
    return d.groupby("valid")[["pred", "obs"]].mean()


def plot_cases(run_ids: list[str], split: str = "test") -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import xarray as xr

    ds = xr.open_zarr(ML / "data/processed/dataset_v1.zarr")
    city_of = dict(zip([str(v) for v in ds.node.values], [str(v) for v in ds.node_city_slug.values]))
    preds = {r: pd.read_parquet(ML / "runs" / r / f"preds_{split}.parquet") for r in run_ids}
    FIG.mkdir(parents=True, exist_ok=True)
    for name, (a, b, city) in CASES.items():
        fig, axes = plt.subplots(1, 2, figsize=(10, 3), sharey=True)
        for ax, lead in zip(axes, (24, 48)):
            obs = None
            for r, p in preds.items():
                c = case_frame(p, city_of, a, b, city, lead)
                ax.plot(c.index, c["pred"], label=r.split("-")[1], lw=1)
                obs = c["obs"] if obs is None else obs
            if obs is not None:
                ax.plot(obs.index, obs, color="k", lw=1.5, label="observed (city mean)")
            ax.set_title(f"{city} {name.replace('_', ' ')}, +{lead} h", fontsize=9)
            ax.tick_params(labelsize=7)
        axes[0].set_ylabel("PM2.5 (µg/m³)")
        axes[1].legend(fontsize=7)
        fig.savefig(FIG / f"case_{name}.png", dpi=200, bbox_inches="tight")
        plt.close(fig)


LADDER = ["m0_gru", "m1_static_graph", "m2_adaptive_graph", "m3_transformer", "m4_wavelet", "m5_convlstm", "m6_mwafn"]


def ladder_table(runs_dir: Path = ML / "runs") -> pd.DataFrame:
    """Latest measured val run per rung -> RMSE at +1/+24/+48 h with run_id."""
    best = {}
    for f in sorted(runs_dir.glob("*/metrics.json")):
        m = json.loads(f.read_text(encoding="utf-8"))
        if m.get("status") == "measured" and m.get("split") == "val" and m.get("model") in LADDER and m.get("setting") == "S-A":
            best[m["model"]] = m
    return pd.DataFrame([{"rung": k, "run_id": m["run_id"], **{f"rmse_{L}h": m["leads"][L]["station"]["rmse"] for L in ("1", "24", "48")}}
                         for k, m in sorted(best.items(), key=lambda kv: LADDER.index(kv[0]))])


def plot_ladder() -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    t = ladder_table()
    if t.empty:
        print("no ladder runs yet")
        return
    FIG.mkdir(parents=True, exist_ok=True)
    fig, ax = plt.subplots(figsize=(5, 3))
    for L in ("1", "24", "48"):
        ax.plot(t["rung"].str[:2].str.upper(), t[f"rmse_{L}h"], marker="o", label=f"+{L} h")
    ax.set_ylabel("val RMSE (µg/m³)")
    ax.legend(fontsize=8)
    fig.savefig(FIG / "ladder_val.png", dpi=200, bbox_inches="tight")
    t.to_markdown(TAB / "ladder_val.md", index=False)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--compute", action="store_true")
    ap.add_argument("--cases", action="store_true")
    ap.add_argument("--ladder", action="store_true")
    ap.add_argument("--runs", nargs="*", default=[])
    a = ap.parse_args()
    if a.compute:
        t = compute_table()
        TAB.mkdir(parents=True, exist_ok=True)
        (TAB / "compute.md").write_text("<!-- generated by ml/scripts/make_figures.py --compute -->\n" + (t.to_markdown(index=False) if len(t) else "No trained runs yet.\n"), encoding="utf-8")
        print(f"compute table: {len(t)} trained runs")
    if a.ladder:
        plot_ladder()
    if a.cases:
        if not a.runs:
            raise SystemExit("--cases needs --runs (frozen runs scored by final_eval.py)")
        plot_cases(a.runs)


if __name__ == "__main__":
    main()
