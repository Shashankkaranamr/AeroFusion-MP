# ml/ — MW-AeroFusion-Net training package

Plan, rules and status: [`PROGRESS.md`](../PROGRESS.md) (§0 hard rules, §4 layout). Read it before running anything.

```bash
pip install -r ml/requirements.txt
cp ml/.env.example ml/.env          # fill in keys; never commit
pytest ml/tests                     # must be green before ticking any P1–P4 task
python ml/scripts/<script>.py --config ml/configs/exp/<name>.yaml
```

- `configs/splits_v1.yaml`: train/val/test/prospective (UTC). The test split is frozen; only `scripts/final_eval.py` reads it (P4).
- `configs/features_v1.yaml`: feature order and gating groups. Draft until feature freeze, immutable after.
- `aerofusion_ml/runs.py`: `run_id = <date>-<exp>-s<seed>-<git7>`; each run writes `ml/runs/<run_id>/`.
- `data/` and `runs/` are gitignored except `runs/*/metrics.json` and `runs/*/config.yaml`.

Phase scripts (`download_all.py`, `build_v1.py`, `run_ladder.py`, `final_eval.py`, `make_tables.py`) are added as their PROGRESS tasks are worked.
