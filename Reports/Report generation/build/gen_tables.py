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
    print("wrote", len(vals), "models")


if __name__ == "__main__":
    main()
