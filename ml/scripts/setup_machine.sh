#!/usr/bin/env bash
# One-shot setup for the training machine (Ubuntu 22.04/24.04 + NVIDIA driver, or any Linux with CUDA 12.x).
#
#   git clone https://github.com/Shashankkaranamr/AeroFusion-MP.git && cd AeroFusion-MP
#   bash ml/scripts/setup_machine.sh            # venv, CUDA torch, deps, GPU check, tests, 1-minute smoke run
#
# Keys are NOT copied by this script: put ml/.env (XKDR, FIRMS, OpenAQ) and ~/.cdsapirc on the machine yourself
# (scp from your laptop or type them in an editor there); never commit them. Then follow ml/README.md from step 1.
set -euo pipefail
cd "$(dirname "$0")/../.."

python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
# CUDA 12.x wheels; on a CPU-only machine use --index-url https://download.pytorch.org/whl/cpu
pip install torch --index-url https://download.pytorch.org/whl/cu124
pip install -r ml/requirements.txt -r backend/requirements.txt onnxscript pypdf

python - <<'PY'
import torch
print("torch", torch.__version__, "| CUDA available:", torch.cuda.is_available())
if torch.cuda.is_available():
    p = torch.cuda.get_device_properties(0)
    print(f"GPU: {p.name}, {p.total_memory / 2**30:.1f} GB")
PY

pytest ml/tests -q -W ignore

if [ -f ml/.env ] && [ -f ~/.cdsapirc ]; then
  python ml/scripts/check_keys.py
else
  echo "Keys missing: add ml/.env and ~/.cdsapirc, then run: python ml/scripts/check_keys.py"
fi

if [ -d ml/data/processed/dataset_v1.zarr ]; then
  python ml/aerofusion_ml/train.py --config ml/configs/exp/smoke_m6.yaml --max-steps 5
  rm -rf ml/runs/*smoke_m6*
else
  echo "No dataset yet: run the data steps in ml/README.md (downloads, build_v1.py, build_grid_v1.py), then the smoke run."
fi
echo "Setup done. Next: ml/README.md section 1 (data), then 2-3 (baselines, ladder)."
