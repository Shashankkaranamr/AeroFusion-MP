# Setting up the training machine (step by step)

This guide is for the team. Follow it once you get access to a college GPU machine, or any machine with an NVIDIA GPU.
It takes you from a fresh login to a working pipeline that is ready to train. Training itself comes after this guide
(see step 12).

Read before you start:
- **Never type a metric by hand.** Every number has to come from `ml/runs/<run_id>/metrics.json`.
- **Never open the test split** (2023-01-01 → 2024-12-31, plus 2025-04 → 2025-09). Only `ml/scripts/final_eval.py` reads it, once, after model freeze.
- **Never commit or paste keys** (`ml/.env`, `~/.cdsapirc`, `backend/.env`).
- The full rules are in `PROGRESS.md` §0. The runbook is `ml/README.md`.

---

## 0. What the machine needs

| Item | Minimum | Preferred |
|---|---|---|
| GPU | NVIDIA, 16 GB VRAM (RTX 4080, A4000, T4 works but is slow) | RTX 4090 / 3090 / A5000, 24 GB |
| CPU RAM | 32 GB (LightGBM needs about 32 GB) | 64 GB |
| Disk free | 100 GB | 150 GB+ on SSD/NVMe |
| OS | Ubuntu 22.04 / 24.04 with NVIDIA driver (CUDA 12.x) | same |
| Network | Outbound HTTPS (Copernicus, XKDR, NASA FIRMS, GitHub, PyPI) | same |
| Access | SSH, and permission for overnight runs | about 15 h/week reserved, weeks 8–14 (7 Dec 2026 → 24 Jan 2027) |

If the machine runs Windows, see **Appendix A**. If you get no college machine at all, see **Appendix B** (Kaggle).

---

## 1. Check the hardware (5 minutes)

Log in (for example `ssh <user>@<college-server>`) and run:

```bash
nvidia-smi                 # GPU name, driver version, "CUDA Version: 12.x", free memory
free -h                    # RAM
df -h ~                    # free disk in your home directory
python3 --version          # needs 3.11 or newer (3.12 is fine)
git --version
```

What to look for:
- `nvidia-smi` must list the GPU. If it says "command not found" or "No devices were found", the driver is missing. Ask the lab admin to install it; you can't fix this without sudo.
- `CUDA Version` should be 12.x. If it is 11.x, use the `cu118` torch wheel in step 4.
- If the GPU is shared, check whether other people's jobs are already using memory (the processes table in `nvidia-smi`).

If Python is older than 3.11 and you have no sudo, install Miniconda in your home directory:
```bash
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
bash Miniconda3-latest-Linux-x86_64.sh -b -p ~/miniconda3
~/miniconda3/bin/conda create -y -n aero python=3.12
source ~/miniconda3/bin/activate aero
```
Then use `python` in place of `python3` below, and skip the venv lines in the setup script (or just let it create a venv inside the conda env, which also works).

---

## 2. Install tmux so jobs survive disconnects

Long jobs must not die when your SSH session drops.
```bash
tmux -V || sudo apt install -y tmux      # ask the admin if you have no sudo; `screen` also works
tmux new -s aero                          # start a session
# detach: Ctrl+B then D      re-attach later: tmux attach -t aero
```

---

## 3. Get the code

```bash
cd ~
git clone https://github.com/Shashankkaranamr/AeroFusion-MP.git
cd AeroFusion-MP
git config user.name  "<your name>"
git config user.email "<your email>"
git log --oneline -3       # you should see the latest commits from main
```

To push results back you need a GitHub login on this machine. Use one of:
- `gh auth login` (GitHub CLI), or
- a personal access token used as the password when you `git push`, or
- an SSH key added to your GitHub account.

Don't store anybody else's token on a shared machine.

---

## 4. Run the one-shot setup script

```bash
bash ml/scripts/setup_machine.sh
```

It does the following:
1. Creates `.venv` and activates it.
2. Installs the CUDA 12.4 build of PyTorch, then `ml/requirements.txt` and `backend/requirements.txt`.
3. Prints the torch version, `CUDA available: True/False` and the GPU name and memory.
4. Runs `pytest ml/tests`.
5. Runs `check_keys.py` if the keys are present (step 5).
6. Runs a 5-step smoke training if the dataset exists (step 7).

**Check the output:**
- `CUDA available: True`. If it says `False`, the torch build doesn't match the driver. Fix it with:
  ```bash
  source .venv/bin/activate
  pip uninstall -y torch
  pip install torch --index-url https://download.pytorch.org/whl/cu118   # for an older driver (CUDA 11.x)
  python -c "import torch; print(torch.cuda.is_available())"
  ```
- All tests pass. Any failure has to be fixed before training. Don't skip tests.

From now on, every new shell needs `cd ~/AeroFusion-MP && source .venv/bin/activate`.

---

## 5. Put the keys on the machine (never commit them)

Two files are needed. Neither is in git.

**a) `ml/.env`.** Start from the template:
```bash
cp ml/.env.example ml/.env
nano ml/.env          # fill XKDR_API_KEY, FIRMS_MAP_KEY, OPENAQ_API_KEY (DATAGOVIN_KEY, WANDB_API_KEY optional)
chmod 600 ml/.env
```

**b) `~/.cdsapirc`.** This is the Copernicus token. One ECMWF token works for both CDS (ERA5) and ADS (CAMS):
```bash
nano ~/.cdsapirc
#   url: https://cds.climate.copernicus.eu/api
#   key: <your token>
chmod 600 ~/.cdsapirc
```
The account must have accepted the licence on both dataset pages (ERA5 single levels on CDS and CAMS global
forecasts on ADS), or requests are rejected.

Easiest way to move them from the laptop, run on the laptop:
```bash
scp ml/.env <user>@<server>:~/AeroFusion-MP/ml/.env
scp ~/.cdsapirc <user>@<server>:~/.cdsapirc
```

**Check:**
```bash
python ml/scripts/check_keys.py      # prints ok / FAILED per key, never the key itself
```
Every line should say `ok`. A `FAILED` usually means a typo, an expired key, or a licence that hasn't been accepted.

On a shared machine, `chmod 600` stops other users from reading your keys. Never print them (`cat ml/.env`) in a
shared terminal or screen-share.

---

## 6. Bring the data over (saves days of downloading)

The raw data isn't in git. The laptop already holds about 2.6 GB of it, including ERA5 grid months already downloaded
and the `jobs.json` files that remember which Copernicus jobs are queued. **Copy it instead of downloading again.**

On the laptop (Git Bash), from the repo root:
```bash
tar -czf aero_data.tgz ml/data/raw ml/data/processed
scp aero_data.tgz <user>@<server>:~/AeroFusion-MP/
```
Or use a pendrive or Google Drive if SCP is blocked.

On the server:
```bash
cd ~/AeroFusion-MP
tar -xzf aero_data.tgz && rm aero_data.tgz
ls ml/data/raw            # cams_fc  era5_grid  firms  logs  openaq  openmeteo_era5  xkdr  MANIFEST.json
ls ml/data/raw/*/v1/jobs.json
```

If you can't copy, the downloads in step 8 fetch everything from scratch. XKDR, Open-Meteo and FIRMS take minutes to
hours. ERA5 and CAMS take days, because of the Copernicus queue.

---

## 7. Smoke test: one-minute pipeline check

Only possible once `ml/data/processed/dataset_v1.zarr` exists (it comes with the copied data):
```bash
python ml/aerofusion_ml/train.py --config ml/configs/exp/smoke_m6.yaml --max-steps 5
nvidia-smi                # in a second tmux pane, while it runs: the python process should appear on the GPU
rm -rf ml/runs/*smoke_m6*  # a smoke run is not a result, so delete it
```
If it crashes with `CUDA out of memory`, the GPU is busy or too small. Check `nvidia-smi` and reduce `batch_size` in a
**copy** of the config, never in a config that has already been used for reported runs.

---

## 8. Resume the paused downloads (run in the background)

Inside tmux:
```bash
source .venv/bin/activate
python ml/scripts/download_all.py --source era5_grid --max-active 2 2>&1 | tee -a ml/data/raw/logs/era5_grid.console.log
```
Open a second tmux window (`Ctrl+B` then `C`):
```bash
source .venv/bin/activate
python ml/scripts/download_all.py --source cams_fc --max-active 2 2>&1 | tee -a ml/data/raw/logs/cams_fc.console.log
```
- Both are resumable. Re-running them is always safe, and they skip finished months.
- Progress is in `ml/data/raw/logs/era5_grid.log` and `cams_fc.log` (`tail -f` them).
- Expect about 94 months each. ERA5 was 30/94 and CAMS 0/94 when paused on 2026-10-16. Copernicus queues make this take **days**.
- If you didn't copy the data in step 6, run the quick sources first: `--source xkdr`, `--source openmeteo`, `--source firms`.

---

## 9. Build the dataset (after the downloads finish)

Run in this order (CPU and RAM, about 3 GB+ RAM):
```bash
python ml/scripts/build_fires.py
python ml/scripts/build_v1.py          # dataset_v1.zarr + SPLITS.lock
python ml/scripts/build_grid_v1.py     # grid_v1.zarr (44 x 43, 3-hourly)
python ml/scripts/build_cams_fc.py     # CAMS forecasts at nodes
python ml/scripts/make_data_card.py    # ml/data/DATA_CARD.md (train + val only)
pytest ml/tests                        # must be green again
git diff ml/data/SPLITS.lock           # check what changed and tell the team before committing
```
Then the team reviews `ml/data/DATA_CARD.md`. That review is the P1 exit, and **feature freeze** follows. After feature
freeze, `dataset_v1` and `features_v1.yaml` never change.

---

## 10. Pre-training checklist

Tick all of these before the first real training run:
- [ ] `nvidia-smi` shows the GPU, and `torch.cuda.is_available()` is `True`
- [ ] `pytest ml/tests` is green
- [ ] `check_keys.py` is all `ok`
- [ ] Downloads finished, dataset rebuilt, data card reviewed, `SPLITS.lock` committed
- [ ] The smoke run worked and was deleted
- [ ] `git status` is clean (run ids include the git commit; a dirty tree gives `+dirty` ids)
- [ ] You know which experiments are yours (owner list in `PROGRESS.md` §1)

---

## 11. Daily routine on the machine

```bash
ssh <user>@<server>
tmux attach -t aero || tmux new -s aero
cd ~/AeroFusion-MP && source .venv/bin/activate
git pull                       # get teammates' changes first
nvidia-smi                     # is the GPU free?
# ... run your experiments (step 12) ...
git add ml/runs/*/metrics.json ml/runs/*/config.yaml
git commit -m "P3.x: <what ran> (<run_id>)"
git push
```
`.gitignore` only lets `metrics.json` and `config.yaml` from each run into git. Checkpoints and predictions stay on the
machine. Back them up (for example `tar` the `ml/runs/` folder to Drive) before your access ends.

---

## 12. What comes after setup (training order)

This is the order from `ml/README.md`. Each line is a background job inside tmux:
```bash
python ml/scripts/run_cams_baselines.py               # P2: raw CAMS, CAMS + bias correction
python ml/scripts/run_gbm.py                          # P2: LightGBM (needs ~32 GB RAM)
python ml/scripts/run_ladder.py --group baselines     # P2/P3: LSTM, CNN-LSTM, ConvLSTM, PM2.5-GNN, Graph WaveNet
python ml/scripts/run_ladder.py --group ladder        # P3: M0 ... M6, seed 0
python ml/scripts/run_ladder.py --group settings      # P3: M6 in S-B and S-C
python ml/scripts/make_tables.py                      # tables from metrics.json only
```
`run_ladder.py --group final` and `final_eval.py` only happen **after model freeze** (P4), on one machine, once.
`ml/runs/ladder_log.jsonl` records every attempt, including failed ones.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `CUDA available: False` | torch build doesn't match the driver | reinstall torch with `cu118` or `cu121`; check `nvidia-smi` |
| `CUDA out of memory` | GPU shared or too small | wait for it to free up; smaller batch in a new config |
| Job died overnight | SSH dropped without tmux | always run inside tmux; check the `*.log` files |
| `check_keys` FAILED (Copernicus) | licence not accepted, or wrong `url` | accept the licences on both dataset pages; `url: https://cds.climate.copernicus.eu/api` |
| Downloads stuck "queued" for hours | normal Copernicus queue | leave it; `--max-active 2` keeps you under the queue limit |
| `Killed` with no traceback | out of RAM (LightGBM, dataset build) | close other jobs; ask for more RAM; run alone |
| Tests fail after `git pull` | a teammate's change, or you're missing new deps | `pip install -r ml/requirements.txt`, then ask the person who changed it |
| `pip` can't reach PyPI | college proxy | `export HTTPS_PROXY=http://<proxy>:<port>` (ask the lab admin) |

---

## Appendix A: Windows GPU machine

1. Install Python 3.12 (python.org, tick "Add to PATH"), Git for Windows, and the latest NVIDIA driver.
2. In PowerShell:
   ```powershell
   git clone https://github.com/Shashankkaranamr/AeroFusion-MP.git; cd AeroFusion-MP
   python -m venv .venv; .venv\Scripts\activate
   pip install torch --index-url https://download.pytorch.org/whl/cu124
   pip install -r ml/requirements.txt -r backend/requirements.txt onnxscript pypdf
   python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
   pytest ml/tests -q
   ```
3. Keys: `ml\.env` as above; the Copernicus file goes to `C:\Users\<you>\.cdsapirc`.
4. There is no tmux. Run long jobs with `Start-Process` in a separate window, keep the machine from sleeping
   (Power settings → Never), and keep Remote Desktop sessions disconnected rather than signed out.

## Appendix B: no college GPU (Kaggle)

See `ml/kaggle/README.md`. In short: upload the processed data once as a **private** Kaggle Dataset. Each member runs
their own experiments on their own account (about 30 GPU-h/week each; pooling accounts breaks Kaggle's terms). Copy each
run folder back into `ml/runs/` and commit `metrics.json` and `config.yaml`. The test split is never touched on Kaggle.
