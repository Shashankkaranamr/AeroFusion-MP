"""Write the Chapter 6 result tables for the report from run artifacts only (validation split, seed 0).

Reads ml/runs/20261114-<model>-s0-e6b796e/metrics.json and writes
  ../content/valmetrics.json   values the prose can quote through {m:<model>.<lead>.<metric>} placeholders
  ../content/gen_*.md          table blocks spliced into chapter 6 with `!include gen_<name>.md`
No number is typed by hand. Test-split tables are not produced here; they come after final_eval.py.
"""
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parents[1] / "content"
TAG = "20261114-{}-s0-e6b796e"

NAMES = {
    "persistence": "Persistence", "same_hour_yesterday": "Same hour yesterday", "climatology": "Climatology",
    "cams_raw": "CAMS (raw)", "cams_bc": "CAMS + bias correction", "lgbm_sa": "LightGBM (S-A)", "lgbm_mos_sb": "LightGBM MOS (S-B)",
    "base_lstm": "LSTM", "base_cnn_lstm": "CNN-LSTM", "base_convlstm_base": "ConvLSTM", "base_pm25gnn": "PM2.5-GNN (past met.)",
    "base_graph_wavenet": "Graph WaveNet", "m0_gru": "M0 GRU", "m1_static_graph": "M1 + static graph",
    "m2_adaptive_graph": "M2 + adaptive graph", "m3_transformer": "M3 + Transformer", "m4_wavelet": "M4 + causal wavelet",
    "m5_convlstm": "M5 + ConvLSTM", "m6_mwafn": "M6 MW-AeroFusion-Net", "m6_mwafn_sb": "MW-AeroFusion-Net (S-B)",
    "m6_mwafn_sc": "MW-AeroFusion-Net (S-C, upper bound)",
}
ABL = {"abl_no_wavelet": "M6 without wavelet bands", "abl_no_graph": "M6 without graph", "abl_fixed_graph": "M6 with fixed graph only",
       "abl_no_convlstm": "M6 without ConvLSTM", "abl_gru_temporal": "M6 with GRU instead of Transformer", "abl_no_gating": "M6 without gating"}
SEEDS_JSON = [REPO / "docs" / "paper" / "tables" / "final_val_seeds.json", REPO / "ml" / "data" / "raw" / "logs" / "post" / "tables" / "final_val_seeds.json"]
ATTR_JSON = [REPO / "docs" / "paper" / "tables" / "attribution_val.json", REPO / "ml" / "data" / "raw" / "logs" / "post" / "attr" / "attribution_val.json"]
LEADS = ["1", "24", "48"]


def load(name):
    m = json.loads((REPO / "ml" / "runs" / TAG.format(name) / "metrics.json").read_text(encoding="utf-8"))
    assert m["split"] == "val" and m.get("status") == "measured", name
    return m


def main():
    vals, runs = {}, {}
    for n in NAMES:
        m = load(n)
        runs[n] = m
        v = {"run_id": m["run_id"], "setting": m["setting"]}
        for L in LEADS:
            st = m["leads"][L]["station"]
            for k in ("rmse", "mae", "r2", "bias"):
                v[f"{L}.{k}"] = st[k]
            for g, r in m["leads"][L]["by_region"].items():
                v[f"{L}.{g}"] = r["rmse"]
        tr = m.get("training") or {}
        v["params"], v["epochs"], v["wall"] = tr.get("n_params"), tr.get("epochs_run"), tr.get("wall_sec")
        vals[n] = v
    pers = vals["persistence"]
    for n, v in vals.items():
        for L in LEADS:
            v[f"{L}.skill"] = 1 - v[f"{L}.rmse"] / pers[f"{L}.rmse"]
    (OUT / "valmetrics.json").write_text(json.dumps(vals, indent=1), encoding="utf-8")

    def tbl(fname, caption, label, models, cols, widths):
        rows = ["| " + " | ".join(h for h, _ in cols) + " |", "|" + "---|" * len(cols)]
        for n in models:
            rows.append("| " + " | ".join(f(n, vals[n]) for _, f in cols) + " |")
        (OUT / fname).write_text(f"!table {caption} | {label} | {widths}\n" + "\n".join(rows) + "\n", encoding="utf-8")

    f1 = lambda k: (lambda n, v: "--" if v.get(k) is None else f"{v[k]:.1f}")
    f3 = lambda k: (lambda n, v: "--" if v.get(k) is None else f"{v[k]:.3f}")
    nm = lambda n, v: NAMES[n]
    err = [(f"RMSE +{L} h", f1(f"{L}.rmse")) for L in LEADS] + [(f"MAE +{L} h", f1(f"{L}.mae")) for L in LEADS]

    sa = ["persistence", "same_hour_yesterday", "climatology", "lgbm_sa", "base_lstm", "base_cnn_lstm", "base_convlstm_base",
          "base_pm25gnn", "base_graph_wavenet", "m6_mwafn"]
    tbl("gen_val_sa.md", "Validation errors (2022, station level, µg/m³), setting S-A, seed 0", "val-sa", sa,
        [("Model", nm)] + err, "30,10,10,10,10,10,10")
    sb = ["cams_raw", "cams_bc", "lgbm_mos_sb", "m6_mwafn_sb", "m6_mwafn_sc"]
    tbl("gen_val_sb.md", "Validation errors (2022, station level, µg/m³), settings S-B and S-C, seed 0", "val-sb", sb,
        [("Model", nm)] + err, "30,10,10,10,10,10,10")
    lad = ["m0_gru", "m1_static_graph", "m2_adaptive_graph", "m3_transformer", "m4_wavelet", "m5_convlstm", "m6_mwafn"]
    tbl("gen_ladder.md", "Model ladder on validation (2022, S-A, seed 0): RMSE in µg/m³ and R² at +24 h", "ladder", lad,
        [("Rung", nm), ("Parameters", lambda n, v: f"{v['params']:,}"), ("RMSE +1 h", f1("1.rmse")), ("RMSE +24 h", f1("24.rmse")),
         ("RMSE +48 h", f1("48.rmse")), ("R² +24 h", f3("24.r2")), ("Epochs", lambda n, v: str(v["epochs"])),
         ("Train time (min)", lambda n, v: f"{v['wall'] / 60:.0f}")], "24,15,9,9,9,9,11,14")
    skill = ["same_hour_yesterday", "climatology", "cams_raw", "lgbm_sa", "lgbm_mos_sb", "base_lstm", "base_pm25gnn", "m0_gru",
             "m4_wavelet", "m6_mwafn"]
    tbl("gen_skill.md", "Skill against persistence (1 - RMSE/RMSE of persistence) and R², validation 2022, seed 0", "skill", skill,
        [("Model", nm)] + [(f"Skill +{L} h", f3(f"{L}.skill")) for L in LEADS] + [(f"R² +{L} h", f3(f"{L}.r2")) for L in LEADS],
        "30,10,10,10,10,10,10")
    reg = ["persistence", "cams_raw", "lgbm_sa", "lgbm_mos_sb", "base_pm25gnn", "m0_gru", "m4_wavelet", "m6_mwafn", "m6_mwafn_sb"]
    tbl("gen_region.md", "RMSE at +24 h by region (µg/m³): Indo-Gangetic Plain (IGP) and the rest of the panel, validation 2022", "region", reg,
        [("Model", nm), ("IGP", f1("24.IGP")), ("Rest", f1("24.rest")), ("All stations", f1("24.rmse")), ("Bias +24 h", f1("24.bias"))],
        "36,14,14,16,16")
    runs_tbl = ["| Model | Setting | run_id |", "|---|---|---|"] + [f"| {NAMES[n]} | {vals[n]['setting']} | `{vals[n]['run_id']}` |" for n in NAMES]
    (OUT / "gen_runids.md").write_text("!table Run identifiers behind every number in Chapter 6 | runids | 40,12,48\n" + "\n".join(runs_tbl) + "\n", encoding="utf-8")
    seeds_tables(vals)
    (OUT / "valmetrics.json").write_text(json.dumps(vals, indent=1), encoding="utf-8")
    print("wrote", len(vals), "models")


def _first(paths):
    return next((p for p in paths if p.exists()), None)


def seeds_tables(vals):
    """Five-seed validation tables (from ml/scripts/make_final_tables.py) and attribution checks (run_explain.py)."""
    import statistics as stt

    src = _first(SEEDS_JSON)
    if not src:
        return
    fs = json.loads(src.read_text(encoding="utf-8"))
    rows = {r["model"]: r for r in fs["rows"]}
    allnames = {**NAMES, **ABL}
    for n, r in rows.items():
        v = {"seeds": r["seeds"]}
        for L in LEADS:
            xs = r[f"rmse_{L}"]
            v[f"{L}.rmse"], v[f"{L}.sd"] = stt.mean(xs), (stt.stdev(xs) if len(xs) > 1 else 0.0)
            v[f"{L}.min"], v[f"{L}.max"] = min(xs), max(xs)
            v[f"{L}.mae"] = stt.mean(r[f"mae_{L}"])
            for ref, key in (("lgbm_mos_sb", "plgbm"), ("cams_bc", "pcams")):
                d = fs["dm"].get(f"{n}|{ref}|{L}")
                if d:
                    v[f"{L}.{key}"] = d["p"]
        vals[f"s_{n}"] = v
    ms = lambda k: (lambda n, v: "--" if v.get(f"{k}.rmse") is None else (f"{v[f'{k}.rmse']:.1f} ± {v[f'{k}.sd']:.1f}" if v["seeds"] > 1 else f"{v[f'{k}.rmse']:.1f}"))

    def dmcell(L, key):
        def f(n, v):
            p = v.get(f"{L}.{key}")
            if p is None:
                return "--"
            better = vals[f"s_{n}"][f"{L}.rmse"] < vals[f"s_{'lgbm_mos_sb' if key == 'plgbm' else 'cams_bc'}"][f"{L}.rmse"]
            return f"{p:.3f}" + ("" if p >= 0.05 else (" (better)" if better else " (worse)"))
        return f

    def tbl(fname, caption, label, models, cols, widths):
        hdr = ["| " + " | ".join(h for h, _ in cols) + " |", "|" + "---|" * len(cols)]
        body = ["| " + " | ".join(f(n, vals[f"s_{n}"]) for _, f in cols) + " |" for n in models if f"s_{n}" in vals]
        (OUT / fname).write_text(f"!table {caption} | {label} | {widths}\n" + "\n".join(hdr + body) + "\n", encoding="utf-8")

    nm = lambda n, v: allnames.get(n, n)
    sd = lambda n, v: str(v["seeds"])
    main = ["persistence", "climatology", "cams_bc", "lgbm_sa", "lgbm_mos_sb", "base_lstm", "base_cnn_lstm", "base_pm25gnn",
            "base_graph_wavenet", "m6_mwafn", "m6_mwafn_sb"]
    tbl("gen_seeds.md", "Validation RMSE over five seeds (2022, station level, µg/m³, mean ± sd) and Diebold-Mariano p-values against LightGBM MOS", "seeds", main,
        [("Model", nm), ("Seeds", sd)] + [(f"RMSE +{L} h", ms(L)) for L in LEADS] + [(f"DM p +{L} h", dmcell(L, "plgbm")) for L in ("24", "48")],
        "28,8,13,13,13,12,13")
    abl = ["m6_mwafn"] + list(ABL)
    def delta(L):
        return lambda n, v: "--" if n == "m6_mwafn" else f"{v[f'{L}.rmse'] - vals['s_m6_mwafn'][f'{L}.rmse']:+.1f}"
    tbl("gen_ablation.md", "Leave-one-out ablations of MW-AeroFusion-Net on validation (2022, S-A, five seeds, µg/m³); Δ is the change in mean RMSE against the full model (negative = the variant is better)", "ablation", abl,
        [("Variant", nm), ("Seeds", sd)] + [(f"RMSE +{L} h", ms(L)) for L in LEADS] + [(f"Δ +{L} h", delta(L)) for L in ("1", "24")],
        "30,8,13,13,13,11,12")
    a = _first(ATTR_JSON)
    if a:
        at = json.loads(a.read_text(encoding="utf-8"))
        rows_ = ["| Seed run | Faithfulness: error rise, top-2 gated / top-2 IG / random | Pass | Sanity ρ | Pass | Fire plausibility ρ (n) | Pass |", "|---|---|---|---|---|---|---|"]
        for rid, r in at["runs"].items():
            if "skipped" in r:
                continue
            f, s_, p = r["faithfulness"], r["sanity"], r["plausibility_fire"]
            rows_.append(f"| `{rid}` | {f['delta_top_gate']:.3f} / {f['delta_top_ig']:.3f} / {f['delta_random_mean']:.3f} | {'yes' if f['pass'] else 'no'} | "
                         f"{s_['final_spearman']:.2f} | {'yes' if s_['pass'] else 'no'} | " + (f"{p['spearman']:.2f} ({p['n']})" if 'spearman' in p else '--') + f" | {'yes' if p.get('pass') else 'no'} |")
        (OUT / "gen_attr.md").write_text("!table Attribution checks of MW-AeroFusion-Net on validation 2022 (one row per seed) | attr | 26,26,7,10,7,16,8\n" + "\n".join(rows_) + "\n", encoding="utf-8")
        st = at.get("stability", {})
        vals["attr"] = {"0.stab": st.get("mean_spearman"), "0.seeds": len(at["runs"]),
                        "0.nfaith": sum(r["faithfulness"]["pass"] for r in at["runs"].values() if "faithfulness" in r),
                        "0.nsanity": sum(r["sanity"]["pass"] for r in at["runs"].values() if "sanity" in r),
                        "0.nplaus": sum(bool(r["plausibility_fire"].get("pass")) for r in at["runs"].values() if "plausibility_fire" in r)}


if __name__ == "__main__":
    main()
