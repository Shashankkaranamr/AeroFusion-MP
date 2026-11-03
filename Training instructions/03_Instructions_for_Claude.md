# Instructions for Claude: running the training procedure on the new machine

> Paste this into Claude Code on the training machine, or say: *"Read `Training instructions/03_Instructions_for_Claude.md`
> and follow it."* It is written for an AI agent but humans can follow it too. Where it conflicts with
> `CLAUDE.md` or `PROGRESS.md` §0, **those win**.

---

## 0. Context you won't have on a new machine

Claude's auto-memory lives in `~/.claude/` on the laptop and does **not** come with the repo. What it held:

- The team works around blockers: if a task waits on a human (guide meeting, data-card review, key rotation), note it
  in `PROGRESS.md` and continue with the next unblocked task. Ask only for decisions that are genuinely the team's
  (for example changing a frozen split, or accepting a feature freeze).
- GitHub repo: `https://github.com/Shashankkaranamr/AeroFusion-MP`, branch `main`. The user has authorised pushing
  commits there. Vercel and Render still deploy from an older repo: **never** touch deploy settings.
- The laptop (16 GB RAM, RTX 3050 4 GB) could not run downloads, the dataset build or training. Those were paused on
  2026-10-16 and are the reason this machine exists. **This machine is where heavy work is allowed.**

Recreate these as memory files on this machine if your memory directory is empty.

---

## 1. Start of every session (mandatory)

1. Read `CLAUDE.md` in full.
2. Read `PROGRESS.md` §0 (hard rules), §1 (status), §7 (compute) and the current phase. Skim §9 (decision log) for
   anything dated after this file was written.
3. Run `git status` and `git log --oneline -5`, and `git pull` if the tree is clean.
4. Run `nvidia-smi`. Note whether the GPU is free; someone else may be using it.
5. Confirm the venv: `source .venv/bin/activate && python -c "import torch; print(torch.cuda.is_available())"`.

Don't start work until all five are done.

---

## 2. Hard rules (summary; the full text is in PROGRESS §0)

| Rule | In practice |
|---|---|
| No hand-typed metrics | Numbers in any file or message come only from `ml/runs/<run_id>/metrics.json`. Tables only from `make_tables.py`. If a number doesn't exist yet, say so. **Never estimate a result.** |
| Test split frozen | 2023-01-01 → 2024-12-31 UTC, plus 2025-04 → 2025-09. Never load it for tuning, selection or early stopping. Only `final_eval.py` (P4) reads it. Check `ml/data/SPLITS.lock` before and after any data step. |
| No leakage | Inputs only from data available at `t0` (§3.4 latencies). Train-only normalisation. Targets never interpolated. EAC4 never a test-time input. |
| Wording | "learned attribution" / "source-group attribution gating", never "causal" or "% contribution". No "first"/"novel". |
| No silent drops | All five components stay. A component that doesn't help is reported as an ablation. |
| Immutability | After feature freeze, `dataset_v1` and `features_v1.yaml` never change. A fix means `v2` and rerunning everything. |
| Secrets | Never `cat`, print, log, echo or commit `ml/.env`, `backend/.env` or `~/.cdsapirc`. Use `check_keys.py` to verify them. Use `.env.example` for names. |
| Budget | Never call Bedrock or Groq in loops or tests. |
| Deploys | Never deploy, push to Render/Vercel or change their settings unless asked. |

---

## 3. Procedure (do the steps in order and verify each one before moving on)

Human-readable detail for every step is in `Training instructions/01_System_Setup_Guide.md`. Below is what you must
do and check.

### Step A: Environment
- Run `bash ml/scripts/setup_machine.sh` (Linux) or the Appendix A commands (Windows).
- **Verify:** `CUDA available: True`, the GPU name and memory printed, `pytest ml/tests` all green.
- If CUDA is False, fix the torch wheel (cu118/cu121/cu124 to match `nvidia-smi`). Don't proceed on CPU without telling the user.

### Step B: Keys
- Ask the user to place `ml/.env` and `~/.cdsapirc` themselves (scp or editor). **Don't ask them to paste keys into chat.**
  If they paste one anyway, don't repeat it, and remind them to rotate it.
- **Verify:** `python ml/scripts/check_keys.py` gives `ok` for XKDR, FIRMS, OpenAQ, CDS and ADS.

### Step C: Data transfer
- Ask whether the laptop data (`ml/data/raw`, `ml/data/processed`, about 2.6 GB) was copied over. Prefer copying to
  re-downloading. The `jobs.json` files in `ml/data/raw/{era5_grid,cams_fc}/v1/` hold the queued Copernicus job ids.
- **Verify:** `ml/data/raw/MANIFEST.json` exists; `ls ml/data/raw/era5_grid/v1 | wc -l` (should be about 30+ months);
  `sha256sum ml/data/SPLITS.lock`, and record the hash.

### Step D: Smoke test
- `python ml/aerofusion_ml/train.py --config ml/configs/exp/smoke_m6.yaml --max-steps 5`, then delete `ml/runs/*smoke_m6*`.
- **Verify:** it finishes and `nvidia-smi` showed the process on the GPU. A smoke run is never a result.

### Step E: Resume downloads (background)
- In tmux, or with `run_in_background`, never in the foreground:
  `python ml/scripts/download_all.py --source era5_grid --max-active 2` and
  `python ml/scripts/download_all.py --source cams_fc --max-active 2`.
- **Verify:** the logs `ml/data/raw/logs/{era5_grid,cams_fc}.log` advance. Report progress (months done / 94) to the
  user when asked or at the end of a turn. Don't poll in tight loops. These take days.
- While waiting, work on unblocked tasks: anything that doesn't need CAMS or the full ERA5 grid (for example LightGBM
  S-A on the current partial dataset as a **dry run of the code only**; its numbers don't count until the rebuilt
  dataset is frozen).

### Step F: Rebuild the dataset (after downloads finish)
- Run in order: `build_fires.py` → `build_v1.py` → `build_grid_v1.py` → `build_cams_fc.py` → `make_data_card.py` → `pytest ml/tests`.
- **Verify:** CAMS channels are no longer NaN in `grid_v1.zarr`; BLH 2024-01..06 is filled from the ERA5 grid; the
  data card covers train + val only.
- `SPLITS.lock` may change because the features changed. Show the user the diff and ask before committing it. That
  commit is the moment the split hashes become official.
- Then **stop and ask the team to review `DATA_CARD.md`** and declare feature freeze (P1 exit). Don't declare it yourself.

### Step G: Validation experiments (P2, P3)
Only after feature freeze. One background job at a time unless the GPU has room:
1. `run_cams_baselines.py` (P2.3)
2. `run_gbm.py` (P2.3, S-A and S-B)
3. `run_ladder.py --group baselines` (P2.3 LSTM + P3.8)
4. `run_ladder.py --group ladder` (P3.1–P3.7, seed 0, val only)
5. `run_ladder.py --group settings` (P3.9)
6. `make_tables.py`

Rules while training:
- Commit from a **clean tree** before each group, so run ids carry a real git hash, not `+dirty`.
- Hyperparameter search: at most 20 trials per rung, on **val**, with the search space recorded in the config. Each
  experiment is one YAML in `ml/configs/exp/`. Never edit a config that already has runs; copy it under a new name.
- After each run, check `metrics.json` exists and that `ml/runs/ladder_log.jsonl` shows no failure. If a run failed,
  read its log, fix the cause, and rerun. Don't hide failures.
- Tick the PROGRESS task only when its *Acceptance* line is met, with a dated note naming the run_id(s). Report
  results **by quoting `metrics.json` or the generated tables**, never from memory.
- If a component doesn't help, write that down as an ablation result. Don't remove the component and don't tune
  until the story looks better.
- Commit `ml/runs/*/metrics.json` and `config.yaml` (git ignores everything else) and push when the user asks or has authorised it.
- Back up checkpoints (`ckpt.pt`) somewhere off-machine before access ends; P4 and P5 need them.

### Step H: Final evaluation (P4): only on the team's explicit go-ahead
- Needs `ml/MODEL_FREEZE.json` written and committed **by the team** (git commit + run_ids). Don't write it for them.
- `run_ladder.py --group final --seeds 0 1 2 3 4`, then `final_eval.py` (it checks `SPLITS.lock`), then `make_tables.py --final`.
- `final_eval.py` runs **once**. If something breaks after the test split has been read, stop and tell the user. Don't
  rerun with changes without logging it in §9 as a deviation.
- Then P4.4 (attribution validation with `explain.py`), P4.5 (case studies), P4.6 (compute report: params, GPU type,
  time per epoch, total GPU-hours, ONNX latency, all measured).

---

## 4. When to stop and ask the user

- `SPLITS.lock` changed unexpectedly, or anything wants to read test-period data outside `final_eval.py`.
- Feature freeze, model freeze, or any change to a frozen file.
- A result is suspiciously good (for example beating CAMS by a huge margin). Check for leakage first, then report.
- The GPU is occupied by someone else's job, or the machine is shared and you'd need more than your agreed slot.
- Disk under 20 GB free, or RAM-killed jobs.
- Anything involving keys, deploys, or spending LLM API budget.

Otherwise keep going and batch your questions at the end of the turn.

---

## 5. End of every session

1. `PROGRESS.md`: tick finished tasks with dated notes and run_ids; update the §1 bars and snapshot; add decisions and
   VERIFY answers to §9.
2. Check `git status`. Commit code, configs, `metrics.json` and `config.yaml`, with commit messages that name the task (for example `P3.2: M1 static graph, run <id>`).
3. Tell the user: what ran, which run_ids, what is still running in the background (with log paths), what is blocked
   and on whom.
4. Leave long jobs running in tmux and say how to check them (`tmux attach -t aero`, `tail -f <log>`).
