@chapter Designs

## System Architecture Overview

The system is organised in five layers (Figure {fig:arch}). The data layer holds the external sources: CPCB stations through XKDR, the Copernicus CAMS and ERA5 stores, NASA FIRMS and GIBS, and Open-Meteo. The ingestion layer has two paths. The live path in `backend/app/live/sources.py` fetches current values for 33 cities with timeouts and a last-good fallback. The offline path in `ml/aerofusion_ml/data/` downloads the full archives with resumable scripts and records each file in a manifest with its SHA-256 checksum.

The processing layer applies quality control, converts all times to UTC, enforces the publication delays and builds two stores. The node store holds hourly features for every station, unlabelled city and upwind region. The grid store holds 3-hourly fields on a 0.75° India grid. The model layer trains the baselines, the ladder and the final model on the GPU workstation and writes each run to its own folder. The serving layer is the FastAPI backend on Render and the React dashboard on Vercel. Once the model is frozen and evaluated, its ONNX export runs inside the backend with ONNX Runtime, so the server never needs PyTorch.

!fig fig4_1_system_architecture.png | High-level system architecture | arch

Figure {fig:deploy} shows where each part runs. The training workstation holds the raw data, the datasets and the run folders. GitHub holds the code, the configurations and the small run artifacts (`metrics.json` and configurations), while checkpoints and data stay off the repository. Render builds the backend from the `backend/` folder, and Vercel builds the frontend from `frontend/` on every push to the main branch. Secrets are stored in Render's environment settings and never in the repository.

!fig fig4_7_deployment.png | Deployment diagram: training workstation, code repository, backend host, frontend host and external services | deploy

## Module and Component Design

Table {tab:modules} maps each module to its files and its main responsibility.

!table Modules and their source files | modules | 22,36,42
| Module | Files | Responsibility |
|---|---|---|
| Live fetchers | `backend/app/live/sources.py` | CAMS and weather from Open-Meteo, FIRMS fires, GIBS layers, XKDR history, with timeouts and fallbacks |
| Live fusion service | `backend/app/live/service.py` | 12-hour refresh loop, fusion into the 72 by 33 by 20 tensor, last-good cache |
| AI analyst | `backend/app/live/ai.py` | Insight cards and streamed chat; Bedrock first, then Groq, then optional Ollama |
| REST API | `backend/app/main.py` | Health, live status and snapshot, history, archive, tensor, model status, AI routes |
| Dashboard | `frontend/src/app/views/*.tsx`, `lib/api.ts` | Now, Map, City, Why, What-if, History and Behind-the-data views |
| Story page | `frontend/index.html`, `src/scenes` | Scroll-driven introduction built with Three.js and GSAP |
| Downloaders | `ml/scripts/download_all.py`, `data/xkdr.py`, `copernicus.py`, `firms.py`, `openmeteo.py` | Resumable downloads with manifests |
| Station panel and QC | `data/stations.py`, `data/qc.py`, `scripts/build_station_panel.py` | Fixed 116-station panel, bounds, flat-line and spike rules |
| Dataset builders | `scripts/build_v1.py`, `build_grid_v1.py`, `build_cams_fc.py`, `build_fires.py` | Node store, grid store, CAMS forecasts at issue time, fire features |
| Windows and loader | `data/windows.py`, `data/loader.py`, `data/torch_dataset.py` | Latency-safe 72-hour input windows and 48-hour targets streamed from zarr |
| Models | `models/wavelet.py`, `graph.py`, `convlstm.py`, `temporal.py`, `gating.py`, `mwafn.py` | The five components and the assembled MW-AeroFusion-Net |
| Baselines | `models/baselines.py`, `cams_baseline.py`, `gbm.py`, `neural_baselines.py` | Persistence, climatology, CAMS, LightGBM, LSTM, CNN-LSTM, ConvLSTM, PM2.5-GNN, Graph WaveNet |
| Training | `aerofusion_ml/train.py`, `scripts/run_ladder.py` | Restart-safe training, early stopping, run folders |
| Evaluation | `evaluate.py`, `significance.py`, `scripts/final_eval.py`, `make_tables.py` | Metrics, Diebold-Mariano tests, the one-time test evaluation, tables |
| Explanation and export | `explain.py`, `export_onnx.py` | Attribution checks; ONNX export for serving |

## Detailed Design

### System Actors and Use Cases

Figure {fig:usecase} shows the actors and their use cases. A citizen views current air quality, a city's outlook and the map, and asks the data questions in plain language. An analyst or researcher also reads the drivers, compares cities, downloads history and inspects the data pipeline. The project team downloads data, builds the dataset, trains and evaluates models, and freezes features and the model. External data services and the LLM service are secondary actors that the system calls.

!fig fig4_3_use_case.png | Use-case diagram | usecase

### System Classes and Their Relationships

Figure {fig:class} shows the main classes. On the model side, `MWAFN` is composed of a `CausalSWT` wavelet block, a `GroupGate` gating block, a temporal encoder (`TransformerEncoder`, or `GRUEncoder` in rungs M0 to M2), a `GridContext` built from `ConvLSTMCell` units, and `DiffusionConv` graph layers. A `Config` object, read from the experiment YAML, decides which of these components are switched on, so the ladder rungs and ablations share one class. `WindowDataset` produces batches from the zarr stores using normalisation `Stats` fitted on the training years. The training loop in `train.py` writes the run folder, and `final_eval.py` is the only entry point allowed to open the test split. On the backend side, `LiveService` owns the fetchers, which return `SourceResult` objects, the fusion step and the cache; `ai.py` wraps the LLM provider chain.

!fig fig4_4_class_diagram.png | Class diagram of the model package and the live backend | class

### Interaction Sequence

Figure {fig:seqlive} shows the live refresh. Every 12 hours, or when a user presses refresh, the service asks each source for new data in parallel. Each fetch has a timeout. A source that fails keeps its last good values and is marked stale in the source-health panel. The fused tensor is saved, and the AI analyst is asked for a new set of insight cards, which are cached. A dashboard request reads from the cache, so page loads do not wait for the external services or the LLM.

!fig fig4_5_sequence_live.png | Sequence diagram: 12-hour live refresh and a dashboard request | seqlive

Figure {fig:seqtrain} shows the offline pipeline. Downloads write raw files and manifests. The builders produce the station panel, the node store, the grid store and the CAMS forecast store, and the split lock is checked before and after. Training reads only the training and validation windows. After the team writes `MODEL_FREEZE.json`, `final_eval.py` checks the lock, reads the test windows once, scores the frozen runs and writes the test tables.

!fig fig4_6_sequence_training.png | Sequence diagram: data preparation, training and final evaluation | seqtrain

### Data-Flow Diagrams

The level-0 diagram (Figure {fig:dfd0}) treats AeroFusion as one process with its external entities: data providers send observations, forecasts, fires and imagery, users send requests and questions, and the system returns views, forecasts and explanations. The level-1 diagram (Figure {fig:dfd1}) splits the system into ingestion, quality control and fusion, model training and evaluation, serving, and explanation, with the data stores between them.

!fig fig4_8a_dfd_level0.png | Data-flow diagram, level 0 | dfd0

!fig fig4_8b_dfd_level1.png | Data-flow diagram, level 1 | dfd1

## Data Design

Figure {fig:datadesign} shows the stores and the model batch. The main stores are:

- **Station panel** (`stations_v1.csv`): 116 stations with identifier, name, city, state, latitude, longitude, distance to the city centre, first and last PM2.5 report and completeness. It is built by a script and committed, so the panel cannot drift.
- **Node store** (`dataset_v1`, zarr): hourly arrays of shape time by nodes by features for pollutants, meteorology, fire features, CAMS fields and calendar flags, with a mask array of the same shape. Targets are kept separately with their own mask.
- **Grid store** (zarr): 3-hourly fields on a 44 by 43 grid at 0.75°: 10 m wind components, boundary-layer height, temperature, rasterised fire radiative power and CAMS aerosol fields.
- **CAMS forecast store**: for each issue time, the latest CAMS run published before it, with leads 0 to 72 hours sampled at every node.
- **Split lock** (`SPLITS.lock`): SHA-256 checksums of the input and target arrays for each split period.
- **Run folders** (`ml/runs/<run_id>/`): `config.yaml`, `metrics.json`, validation predictions, `ckpt.pt`, `last.pt`, normalisation statistics and an environment file. The run identifier joins the date, experiment name, seed and git hash.

A training batch holds the input window X of shape (B, 72, N, F) with its mask, the grid window of shape (B, T_g, C, 44, 43), the static and wind-aligned adjacency for the issue time, and the target y of shape (B, 48, N) with its mask.

!fig fig4_9_data_design.png | Data design: stores and the model batch | datadesign

## Implementation Structure

Figure {fig:repo} shows the repository layout. The backend and the frontend are deployed from their own folders. The `ml/` folder holds the package, the scripts, the experiment configurations, the tests and the run folders. The `docs/` folder holds the related-work matrix, the data licences, the paper source with its generated tables, and the viva notes. `PROGRESS.md` at the root is the plan and the decision log, and every change of plan is recorded there with a date.

!fig fig4_10_repository_structure.png | Repository structure | repo
