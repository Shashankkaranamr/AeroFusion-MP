# Kaggle fallback (PROGRESS §7)

Use only if the college GPU is not available. Kaggle gives ~30 GPU-hours/week **per person**; each member runs their own
experiments on their own account (pooling accounts breaks Kaggle's terms).

## One-time: upload the processed data as a private Kaggle Dataset
On the machine that built the data (after `build_v1.py`, `build_grid_v1.py`, `build_cams_fc.py`):
```bash
mkdir aerofusion-processed-v1
cp -r ml/data/processed/dataset_v1.zarr ml/data/processed/grid_v1.zarr ml/data/processed/cams_fc_v1.zarr ml/data/SPLITS.lock aerofusion-processed-v1/
pip install kaggle   # needs ~/.kaggle/kaggle.json (your own API token)
kaggle datasets init -p aerofusion-processed-v1     # edit dataset-metadata.json: id "<user>/aerofusion-processed-v1", keep it PRIVATE
kaggle datasets create -p aerofusion-processed-v1 --dir-mode zip
```
Share the dataset (Kaggle "Share" button) with teammates' accounts. Licences allow sharing these derived files with
attribution (`docs/data_licences.md`); **do not** include OpenAQ data.

## Each run
Open `ml/kaggle/train_kaggle.ipynb` on Kaggle (File → Import notebook), set `CONFIG`, enable the GPU, run all, then copy the
run folder from `/kaggle/working/runs/` into `ml/runs/` in the repo and commit `metrics.json` + `config.yaml`.
The test split is never touched on Kaggle: `final_eval.py` runs once, on one machine, after model freeze.
