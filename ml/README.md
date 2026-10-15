# ml/ — MW-AeroFusion-Net training package

Plan, rules and status: [`PROGRESS.md`](../PROGRESS.md) (§0 hard rules, §3 data design, §5 phases). Read §0 before
running anything: never type a metric by hand, never open the test split outside `scripts/final_eval.py`.

## Setup (any machine)
```bash
python -m venv .venv && source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r ml/requirements.txt                        # GPU box: install the CUDA build of torch first
cp ml/.env.example ml/.env                                # keys: XKDR, FIRMS, OpenAQ (never commit)
# Copernicus: ~/.cdsapirc with one ECMWF token (url + key lines); accept the CC-BY licence on the dataset pages
python ml/scripts/check_keys.py                           # prints ok/FAILED per key, never the key
pytest ml/tests                                           # must be green
```

## 1. Data (P1) — CPU, resumable, run in the background
```bash
python ml/scripts/download_all.py --source xkdr           # CPCB archive (~0.4 GB)
python ml/scripts/download_all.py --source openmeteo      # node weather (66 ERA5 cells)
python ml/scripts/download_all.py --source firms          # fires, yearly CSVs (no key)
python ml/scripts/download_all.py --source era5_grid --max-active 2   # CDS queue: hours-days
python ml/scripts/download_all.py --source cams_fc   --max-active 2   # ADS queue: days (leads 0-72 h)
python ml/scripts/build_station_panel.py                  # frozen 116-station panel (already committed)
python ml/scripts/build_fires.py                          # per-node fire features
python ml/scripts/build_v1.py                             # dataset_v1.zarr + SPLITS.lock (~3 GB RAM)
python ml/scripts/build_grid_v1.py                        # grid_v1.zarr (44 x 43, 3-hourly)
python ml/scripts/build_cams_fc.py                        # CAMS forecasts at nodes (S-B, CAMS baselines)
python ml/scripts/make_data_card.py                       # DATA_CARD.md (train + val only)
```

## 2. Baselines on validation (P2)
```bash
python ml/scripts/run_baselines.py                        # persistence, same-hour-yesterday, climatology
python ml/scripts/run_cams_baselines.py                   # raw CAMS, CAMS + linear bias correction
python ml/scripts/run_gbm.py                              # LightGBM S-A (needs ~32 GB RAM)
python ml/scripts/run_ladder.py --group baselines         # LSTM, CNN-LSTM, ConvLSTM, PM2.5-GNN, Graph WaveNet (GPU)
python ml/scripts/make_tables.py                          # docs/paper/tables/*.tex|md from ml/runs/*/metrics.json
```

## 3. Model ladder (P3, GPU)
```bash
python ml/aerofusion_ml/train.py --config ml/configs/exp/smoke_m6.yaml --max-steps 5   # 1-minute pipeline check
python ml/scripts/run_ladder.py --group ladder            # M0 ... M6 on val, seed 0
python ml/scripts/run_ladder.py --group settings          # M6 in S-B and S-C (S-C = upper bound only)
```
Each run writes `ml/runs/<date>-<exp>-s<seed>-<git7>/` (config, metrics.json, preds_val.parquet, ckpt.pt, norm stats).
Commit from a clean tree so run_ids carry a real commit, not `+dirty`.

## 4. Final evaluation (P4, after model freeze only)
```bash
python ml/scripts/run_ladder.py --group final --seeds 0 1 2 3 4
# team writes ml/MODEL_FREEZE.json: {"git_commit": "<sha>", "run_ids": [...]} and commits it
python ml/scripts/final_eval.py                           # the ONLY test-split reader; checks SPLITS.lock
python ml/scripts/make_tables.py --final
```
Attribution checks: `aerofusion_ml/explain.py`. Export for the website: `python ml/aerofusion_ml/export_onnx.py --run <id>`.

## Prospective test (S8)
```bash
python ml/scripts/collect_openaq.py --match               # once (done: 112/116 stations matched)
python ml/scripts/collect_openaq.py --months 2026-10 2026-11   # monthly through 2027-02
```

## Layout
- `aerofusion_ml/data/`: sources (xkdr, copernicus, cams, openmeteo, firms, openaq), qc, stations, events, grid,
  windows (latency rules), loader, torch_dataset.
- `aerofusion_ml/models/`: baselines, gbm, cams_baseline, neural_baselines, and the MW-AeroFusion-Net parts
  (wavelet, graph, temporal, convlstm, gating, mwafn).
- `aerofusion_ml/{train,evaluate,significance,explain,export_onnx}.py`.
- `configs/`: splits, features, events, eval, `exp/*.yaml` (one per experiment).
- Licences and attribution for every source: [`docs/data_licences.md`](../docs/data_licences.md).
