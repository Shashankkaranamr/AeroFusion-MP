# CLAUDE.md: AeroFusion / MW-AeroFusion-Net

B.E. CSE major project (BMSCE, group 40). It has two parts:
1. **AeroFusion**: a deployed live PM2.5 monitoring platform for 33 Indian cities (done).
2. **MW-AeroFusion-Net**: the proposed forecasting model (wavelet + adaptive diffusion graph + ConvLSTM +
   Transformer + source-group gating). It is being built now and must be evaluated honestly enough to publish one IEEE-conference paper.

**`PROGRESS.md` is the plan and the source of truth.** At the start of every session, read §0 (hard rules), §1 (status)
and the current phase. Work the first unchecked task, meet its *Acceptance* line, tick it, and add a dated note
(with run_id or file). Append decisions and VERIFY answers to §9 of `PROGRESS.md`.

## Integrity rules (non-negotiable)
The original report claimed experimental results that were never produced. Do not repeat that.
- **Never write, invent, estimate or "fill in" a metric.** Every number shown anywhere (paper, report, README, UI,
  `PROGRESS.md`) must come from `ml/runs/<run_id>/metrics.json`. Tables come from `ml/scripts/make_tables.py`.
  If asked for numbers that don't exist yet, say so.
- **The test split (2023-01-01 → 2024-12-31 UTC, plus the PM-only 2025-04 → 2025-09 check) is frozen.** Never read it for tuning, selection or early stopping. Only `ml/scripts/final_eval.py` (phase P4) may load it. Check `ml/data/SPLITS.lock` before and after.
- **No future leakage.** Build inputs only from data available at issue time `t0` (latencies in PROGRESS §3.4).
  Wavelets are causal and computed per input window. Normalisation is fitted on train only. Targets are never interpolated.
  EAC4 reanalysis is never a test-time input.
- **Wording.** Write "learned attribution" or "source-group attribution gating", never "causal" or "% source contribution".
  No "first"/"novel" claims unless `docs/related_work.md` supports them. Only cite references verified by DOI or URL.
- **Never silently drop a proposed component** (wavelet, graph, ConvLSTM, Transformer, gating). If one doesn't help, report the ablation.
- `dataset_v1` and `features_v1.yaml` are immutable after feature freeze. A change means `v2` and rerunning everything.
- The What-if simulator (`frontend/src/app/lib/scenario.ts`) uses hand-set literature coefficients. Always label it an
  illustrative heuristic, never a model result.

## Secrets
- Keys live only in `backend/.env`, `ml/.env` (gitignored) and `~/.cdsapirc` (Copernicus ADS/CDS).
- Never print, log, commit or echo key values. Never read `.env` files into the conversation. Use `.env.example` for names.
- Production secrets live in Render (`render.yaml`, `sync: false`). The Bedrock key was once shared in chat; it is due for rotation (PROGRESS Phase 0).

## Repo map
```
backend/            FastAPI API (deployed on Render, rootDir=backend)
  app/main.py         routes: /health, /api/live/*, /api/history*, /api/archive, /api/tensor, /api/ai/*
  app/live/sources.py fetchers: CAMS + weather (Open-Meteo, MET Norway fallback), FIRMS, GIBS, XKDR (CPCB)
  app/live/service.py refresh loop (12 h) → fusion → (T≤72, 33 cities, 20 features) tensor, FEATURES list
  app/live/ai.py      LLM chain Bedrock Nova Micro → Groq (→ Ollama): insights + streamed chat
  app/data/cities.json 33 cities + 17 upwind source_regions (used by the ML graph too)
  app/sim/            unused simulator, to be deleted
frontend/           Vite. index.html = Three.js/GSAP scroll story (src/core, src/scenes);
                    app.html = React 19 dashboard (src/app: views/, lib/api.ts, lib/live.ts, lib/scenario.ts)
legacy-dashboard/   old Next.js dashboard, reference only, do not edit
ml/                 training package (PROGRESS §4; runbook in ml/README.md): data pipeline, models, train/evaluate/final_eval
docs/               related_work.md, paper/ (main.tex, refs.bib, generated tables), report/, viva_prep.md, data_licences.md
Initial Proposal/   original report PDF (contains unearned result claims, fixed in P0.4)
21stdev/, apple-design-skill-main/, hairline-main/, skills-main/, design-reference/
                    third-party design/skill reference material, not project code; don't edit or lint
```

## Commands
```bash
# backend (Python 3.11+; prod runs 3.12)
python -m venv .venv && .venv/Scripts/activate        # Windows
pip install -r backend/requirements.txt
python -m uvicorn app.main:app --app-dir backend --port 8000   # no --reload: restart after edits

# frontend (Node 20+)
cd frontend && npm install
npm run dev        # story :5173, dashboard /app.html; /api proxied to the deployed API
AEROFUSION_API=http://localhost:8000 npm run dev      # use the local backend instead
npm run build      # must pass before any frontend change is considered done

# ml (after P0.8)
pip install -r ml/requirements.txt
pytest ml/tests                                       # must be green before ticking any P1–P4 task
python ml/scripts/<script>.py --config ml/configs/exp/<name>.yaml
```
The shell is Windows (PowerShell primary, Git Bash available). Use forward slashes in Python paths.

## Conventions
- **Backend:** keep dependencies minimal (fastapi, httpx, numpy). **No torch on the server.** The model is served via
  `onnxruntime` from `backend/app/ml/` (P5). All external fetches go through `sources.py` with timeouts and last-good fallback.
- **ML:**
  - All times are **UTC** (CPCB/XKDR are IST and get converted at ingest).
  - Every model implements the batch → `{"pred", "gates"}` contract in PROGRESS §3.9.
  - Every experiment is one YAML in `ml/configs/exp/`.
  - `run_id = <date>-<exp>-<seed>-<git7>`, and each run saves config, metrics.json, predictions and env.
  - Seeds are fixed. Data is streamed from zarr; never materialise all windows.
  - Code must run unchanged on a laptop CPU, Kaggle and the college GPU (device from config).
- **Large data** goes under `ml/data/raw/` with `MANIFEST.json` (sha256) and is never committed. Download scripts
  must be resumable and idempotent. Prefer XKDR bulk Parquet (`/v1/files`) over many API queries.
- **Frontend:** the live platform labels CAMS values as "CAMS model", never as measurements. Keep the honesty notes.
  `maplibre-gl` upgrades require re-copying the worker to `frontend/public/maplibre/`.
- Before pinning any third-party API detail (archive ranges, latencies, timestamp conventions), verify it
  against the live API and record the result in PROGRESS §9.

## Don't
- Don't deploy, push or change Render/Vercel settings without the user asking.
- Don't spend the Bedrock/Groq budget in loops or tests; mock the LLM in tests.
- Don't edit the proposal PDF. Report corrections go in the team's source document.
- Don't run long downloads or training in the foreground. Use background runs and report progress.
