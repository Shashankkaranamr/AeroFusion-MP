"""Run a group of experiments one after another (GPU machine). Each run is train.py with one config and one seed.

    python ml/scripts/run_ladder.py --group ladder            # P3: M0..M6, seed 0
    python ml/scripts/run_ladder.py --group baselines         # P2.3 LSTM + P3.8 tier-2, seed 0
    python ml/scripts/run_ladder.py --group settings          # P3.9: M6 in S-B and S-C
    python ml/scripts/run_ladder.py --group final --seeds 0 1 2 3 4   # P4.1 (after model freeze): M6 S-A/S-B + ablations
    python ml/scripts/run_ladder.py --configs ml/configs/exp/m3_transformer.yaml --seeds 0 1

A failed run is logged and the next one starts; ml/runs/ladder_log.jsonl records every attempt.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import yaml

ML = Path(__file__).resolve().parents[1]
EXP = ML / "configs" / "exp"
GROUPS = {
    "ladder": ["m0_gru", "m1_static_graph", "m2_adaptive_graph", "m3_transformer", "m4_wavelet", "m5_convlstm", "m6_mwafn"],
    "baselines": ["base_lstm", "base_cnn_lstm", "base_convlstm_base", "base_pm25gnn", "base_graph_wavenet"],
    "settings": ["m6_mwafn_sb", "m6_mwafn_sc"],
    "final": ["m6_mwafn", "m6_mwafn_sb", "abl_no_wavelet", "abl_no_graph", "abl_fixed_graph", "abl_no_convlstm", "abl_gru_temporal", "abl_no_gating"],
}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--group", choices=sorted(GROUPS))
    ap.add_argument("--configs", nargs="*", default=[])
    ap.add_argument("--seeds", nargs="*", type=int, default=[0])
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    cfgs = [EXP / f"{n}.yaml" for n in GROUPS.get(a.group, [])] + [Path(c) for c in a.configs]
    if not cfgs:
        raise SystemExit("give --group or --configs")
    log = ML / "runs" / "ladder_log.jsonl"
    log.parent.mkdir(exist_ok=True)
    for cfg_path in cfgs:
        cfg = yaml.safe_load(cfg_path.read_text(encoding="utf-8"))
        for seed in a.seeds:
            cfg["seed"] = seed
            with tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False, encoding="utf-8") as f:
                yaml.safe_dump(cfg, f)
            cmd = [sys.executable, str(ML / "aerofusion_ml" / "train.py"), "--config", f.name]
            print(f"== {cfg['name']} seed {seed}", flush=True)
            if a.dry_run:
                continue
            t = time.time()
            rc = subprocess.run(cmd).returncode
            with log.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps({"config": cfg_path.name, "seed": seed, "returncode": rc, "minutes": round((time.time() - t) / 60, 1)}) + "\n")


if __name__ == "__main__":
    main()
