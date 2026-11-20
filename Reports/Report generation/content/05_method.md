@chapter Methodology

## Tools and Techniques

The data pipeline and models are written in Python 3.12. PyTorch 2.11 with CUDA 12.8 runs the neural models on the RTX PRO 4500 workstation, and the same code runs on a CPU for tests. Large arrays are stored in zarr and opened with xarray, so the loader streams windows from disk and never holds all windows in memory. LightGBM provides the gradient-boosted baselines and TreeSHAP attributions. PyWavelets supplies the db4 filter coefficients for the causal wavelet. Copernicus data comes through the CDS and ADS APIs, and the other sources through their REST APIs with httpx. pytest runs 146 tests, among them the leakage and split-lock tests. The live platform uses FastAPI on the backend and Vite, React 19, MapLibre GL, Recharts, Three.js and GSAP on the frontend. All figures in this report were drawn from scratch by the team's scripts, and the result charts are generated from run files.

The main techniques are robust outlier detection (Hampel filter), the stationary wavelet transform, diffusion convolution on graphs, ConvLSTM, Transformer encoders with causal masks, variable-selection gating, Huber regression with masking, gradient boosting, and forecast-comparison statistics (Diebold-Mariano test, block bootstrap).

## Data Set with Explanation

### CPCB stations

Hourly PM2.5, PM10, NO2, CO and O3 come from the XKDR bulk export of the CPCB CAAQM network together with the US Embassy monitors [@xkdr]. CPCB labels each hour in Indian Standard Time at the start of the averaging interval, and the ingest step converts these labels to UTC. The number of stations grew several-fold over the study period, so a city average built from all stations would change with every new station. The project fixes a panel instead: stations within 25 km of one of the 33 platform cities that have reported since 1 January 2020 and are at least 60% complete through 2024. This gives 116 stations in 28 cities, with Delhi (32 stations), Mumbai (12) and Kolkata (10) the largest groups.

Table {tab:datacard} summarises the data card for the training and validation years. Quality control removed about 1% of PM2.5 station-hours. The median PM2.5 coverage per city is lower in the training years than in the validation year, because several cities had sparse reporting before 2021 (Figure {fig:coverage}).

!table Data summary for the training and validation years (from the generated data card) | datacard | 60,40
| Item | Value |
|---|---|
| Stations in the panel / cities with a station | 116 / 28 |
| Upwind context regions (no target) | 17 |
| Input window / forecast horizon | 72 h / 48 h |
| PM2.5 station-hours after QC (train and validation) | 4.13 million |
| PM2.5 removed by QC, all rules | 1.0% |
| PM2.5 spikes kept as city-wide events | 16,191 station-hours |
| Median city PM2.5 coverage, train / validation | 85.8% / 94.2% |
| Hours with PM2.5 above 1.05 times PM10 (flagged, kept) | 0.24% |

!fig fig5_4_coverage_heatmap.png | PM2.5 coverage per station and month in the training and validation years (blue marks gaps) | coverage

### Meteorology

Node meteorology comes from ERA5 [@Hersbach_2020]: 2 m temperature, relative humidity, 10 m wind components and speed, surface pressure, precipitation and boundary-layer height (BLH). A ventilation index, wind speed times BLH, describes how well the air mixes and moves. ERA5 is used in place of India Meteorological Department data, which is not openly available at hourly resolution. For the gridded branch, ERA5 wind, BLH and temperature are regridded to 0.75° on a 44 by 43 grid over India and its neighbours at 3-hour steps.

### CAMS forecasts

CAMS global forecasts are downloaded for leads 0 to 72 hours from both daily runs. For every issue time, the builder finds the newest run that was already published, which is the run that started at least 10 hours earlier. Past values of the CAMS fields are taken from short leads of that run, not from analyses, because a run's analysis is itself published only 10 hours after the time it describes. The future CAMS forecast at each lead is used only in setting S-B and in the CAMS baselines.

### Fire detections

Active fires from MODIS and VIIRS (S-NPP) come from NASA FIRMS [@firms]. For each node and hour the builder counts detections within 300 km, sums their fire radiative power (FRP) in the same radius, and counts detections within 500 km whose bearing from the node lies within 45° of the direction the wind is coming from. A detection becomes usable three hours after the satellite overpass.

### Calendar and events

Calendar inputs are the hour of day and day of year as sine and cosine pairs, weekday, public holidays, a Diwali window, the stubble-burning season (October and November) and the 2020 lockdown. Holiday and Diwali dates come from a pinned version of the python-holidays package.

### Splits and the lock file

!fig fig5_2_data_splits.png | Training, validation and frozen test periods | splits

The splits are chronological in UTC (Figure {fig:splits}). Training uses 2018 to 2021, with December 2017 providing the first input windows. Validation uses 2022. The test period is 2023 to 2024, which contains two winters, two stubble seasons and two Diwalis. An extra PM2.5-only test runs from April to September 2025, and a prospective test on the winter of 2026 to 2027 is collected from live data. The splits were moved back one year from the original plan, before any model existed, because the public archive has very few stations after December 2024.

The input and target arrays of each test period are hashed with SHA-256 and the hashes are stored in `SPLITS.lock`. Only `final_eval.py` may open these arrays, and only after `MODEL_FREEZE.json` exists. A test fails if any other module reads them. Model selection, early stopping and hyperparameter tuning use the validation year only.

## Flowchart of Methodology from Start to End

Figure {fig:flow} shows the full methodology. Raw data is downloaded and checksummed, the station panel is fixed, quality control and time conversion are applied, and the node and grid stores are built with the publication delays. After the team reviews the data card and declares feature freeze, the baselines, the ladder, the settings and the ablations are trained and scored on validation. After model freeze, the final configuration is trained with five seeds, the test years are scored once, the attribution checks are run, and the model is exported to ONNX for the live platform.

!fig fig5_1_methodology_flowchart.png | Flowchart of the methodology from data download to deployment | flow

## Explanation of Methodology in Detail with Equations and Formulae

### Quality control and latency-safe inputs

Quality control runs per pollutant and per station. Values outside physical bounds and sentinel values such as 999 are removed. A flat line of six or more identical hours is removed, since it usually means a stuck sensor. Isolated spikes are found with a trailing Hampel rule. For hour t, let m_t be the median and MAD_t the median absolute deviation of the previous 24 hours, with at least 12 values present. The hour is flagged as a spike when

$$ |x_t − m_t| > k · max(1.4826 · MAD_t, 1) | hampel

with k = 6, which is about six robust standard deviations. The floor of 1 µg/m³ stops a nearly constant window from flagging every small change. A spike seen at two or more stations of the same city in the same hour is kept, because a real event such as fireworks raises all nearby stations together. Targets are never filled. Input gaps of up to three hours are filled forward with the last value, never interpolated, since interpolation would read the value after the gap.

At issue time t0, an input value is usable only if it was published before t0:

$$ station data ≤ t0 − 1 h,   fires: acquisition + 3 h ≤ t0,   CAMS run R: R + 10 h ≤ t0 | latency

Figure {fig:latency} shows these rules on a timeline. Normalisation statistics are fitted on the training years only. A unit test changes every value after t0 and checks that the input window does not change.

!fig fig5_3_latency_timeline.png | Inputs available at issue time t0 | latency

!fig alg1_qc_and_windows.png | Algorithm 1: quality control and latency-safe input windows | alg1

### Causal wavelet bands

Let the input of node n be X ∈ ℝ^(T×F) with T = 72 hours and F = 29 features in seven groups. For PM2.5 and PM10, MW-AeroFusion-Net adds bands from an undecimated (à-trous) db4 wavelet transform with three levels. At level j the low-pass and high-pass filters h and g of length 8 are dilated by 2^(j−1), and the convolution only looks back in time:

$$ a_j(t) = Σ_k h_k · a_(j−1)(t − 2^(j−1)·k),   d_j(t) = Σ_k g_k · a_(j−1)(t − 2^(j−1)·k) | swt

with a_0 = x. The transform runs inside each 72-hour window with left padding, so a band value at hour t depends only on samples at or before t. The details d_1, d_2, d_3 and the approximation a_3 are appended as input channels. A unit test checks that changing a future sample leaves every earlier band value unchanged. Figure {fig:wavelet} shows the bands for one window in the training year.

!fig fig5_5_wavelet_bands.png | Causal wavelet bands of one 72-hour window (Delhi, November 2021, training year) | wavelet

### Source-group attribution gating

The 29 features are divided into seven groups: pollutant history, traffic proxy (NO2, CO, weekday, holiday), meteorology, fire, CAMS, dust and calendar. For node n, a summary s_(n,k) of group k (window mean and last value) passes through a small network φ_k. The gate weights are

$$ g_n = softmax( W [φ_1(s_(n,1)); … ; φ_G(s_(n,G))] ) | gate

and the input at each step is the gated sum of per-group projections,

$$ h_(t,n) = Σ_k g_(n,k) · P_k( x_(t,n,G_k) ) | gatesum

This follows the variable selection of the Temporal Fusion Transformer [@Lim_2021]. To encourage the model to rely on a few groups, the loss includes the mean entropy of the gate weights with weight λ = 0.01:

$$ L_gate = λ · E[ −Σ_k g_(n,k) · log g_(n,k) ] | entropy

The proposal planned an L1 penalty, but softmax weights always sum to one, so an L1 penalty would be constant. The weights g_n are called learned attribution. They show which inputs the model relies on for a node, not how much each source contributes to the pollution.

### Transformer temporal encoder

A two-layer Transformer encoder [@vaswani2017attention] with four heads, hidden size 64 and a causal mask runs over the 72 steps of each node. With queries Q, keys K and values V from the gated inputs, each head computes

$$ Attention(Q, K, V) = softmax( Q K^⊤ / √d + M ) V | attn

where the mask M is −∞ above the diagonal, so step t cannot see later steps. The last state gives the node embedding e_n. Rungs M0 to M2 use a GRU in its place.

### ConvLSTM grid context

A ConvLSTM [@shi2015convolutional] runs over the past gridded fields (wind, BLH, temperature, FRP and CAMS aerosol fields). Its gates are convolutions over the grid:

$$ i_t = σ(W_xi ∗ X_t + W_hi ∗ H_(t−1) + b_i),   f_t = σ(W_xf ∗ X_t + W_hf ∗ H_(t−1) + b_f) | convlstm1

$$ C_t = f_t ⊙ C_(t−1) + i_t ⊙ tanh(W_xc ∗ X_t + W_hc ∗ H_(t−1) + b_c),   H_t = o_t ⊙ tanh(C_t) | convlstm2

The last hidden map H_T is sampled bilinearly at each node's location and joined to e_n. FRP on the grid is hidden for the most recent hours to respect the detection delay. The grid branch exists because PM2.5 targets are points, while wind, boundary layer and fire fields are continuous over the region.

### Wind-aware adaptive diffusion graph

Each node is joined to its eight nearest nodes within 600 km (Figure {fig:graph}). The static weight is

$$ A_ij = exp( −d_ij / σ ) | static

where d_ij is the great-circle distance and σ the median neighbour distance. At issue time the weight is scaled by how well the past wind at the sender points toward the receiver, as in PM2.5-GNN [@Wang_2020]:

$$ Ã_ij(t0) = A_ij · max( 0, cos(θ_j − β_(j→i)) ) | wind

where θ_j is the direction toward which the mean wind of the last six hours at node j blows and β_(j→i) is the bearing from j to i. Two residual diffusion-convolution layers [@li2017diffusion] use the forward and backward random-walk matrices of Ã and an adaptive matrix softmax(ReLU(E_1 E_2^⊤)) learned from node embeddings [@Wu_2019], each with diffusion order K = 2:

$$ H' = H + ReLU( [ H ; {P^k H} for P ∈ 𝒫, k = 1..K ] W ) | diffusion

!fig fig5_6_station_graph.png | Station graph: eight nearest neighbours within 600 km | graph

### Decoder and loss

A two-layer MLP maps each node state to all 48 leads at once, so there is one model instead of one per lead. The target is the standardised log(1 + PM2.5). In setting S-B, the latest published CAMS forecast for each lead is added through a per-lead input. Training minimises a masked Huber loss over observed targets only, plus the gate penalty:

$$ L = Σ_(l,n) m_(l,n) · Huber_δ( ŷ_(l,n) − y_(l,n) ) / Σ_(l,n) m_(l,n) + L_gate | loss

with δ = 1 and m_(l,n) = 1 where the target exists. Figure {fig:mwafn} shows the full architecture with tensor shapes.

!fig fig4_2_mwafn_architecture.png | MW-AeroFusion-Net architecture with tensor shapes | mwafn

### Model size and cost

The model is small. At hidden size 64, the full M6 has 242,663 parameters in setting S-A, and the rungs range from 43,248 (M0) upward (Table {tab:ladder} in Chapter 6). The cost per step grows linearly with the number of nodes N and the window length T for the graph and recurrent parts, quadratically with T for the attention, and with the grid size and window for the ConvLSTM, which is the most expensive branch. Training runs with automatic mixed precision and gradient clipping, and every epoch writes an atomic checkpoint so that a power cut costs at most one epoch (Algorithm 2).

!fig alg2_restart_safe_training.png | Algorithm 2: restart-safe training with early stopping | alg2

## Experimental Setup

### Research questions

1. Does MW-AeroFusion-Net beat persistence, LightGBM and CAMS with bias correction at +1, +24 and +48 hours when it uses only past data?
2. Which components help? Each rung of the ladder adds one component, and each ablation removes one from the full model.
3. How much does the CAMS forecast add (S-B), and how far is a real forecast from one with perfect future weather (S-C)?
4. Are the gate weights faithful, sensitive to randomisation, stable across seeds and plausible against known events?

### Settings

- **S-A, past only (primary).** Inputs end at the issue time. This is the main result.
- **S-B, CAMS-informed.** S-A plus the latest published CAMS forecast at matched leads. The model then acts as a post-processor of CAMS.
- **S-C, perfect prognosis.** S-A plus the true future meteorology. It is reported only as an upper bound and never as a forecast.

### Baselines

Persistence repeats the last observed value. Same hour yesterday repeats the value 24 hours earlier. Climatology is the training-year mean for each station, month and hour. Raw CAMS is the latest published CAMS forecast at the matched lead, and CAMS with bias correction applies a per-station linear correction fitted on the training years. LightGBM uses lags and meteorology in S-A, and acts as model output statistics on CAMS in S-B. The neural baselines are an LSTM, a CNN-LSTM, a ConvLSTM, PM2.5-GNN with past-only meteorology [@Wang_2020] and Graph WaveNet [@Wu_2019]. All neural models share the data loader, the loss and the training schedule.

### Model ladder and ablations

!fig fig5_7_model_ladder.png | Model ladder M0 to M6 and the leave-one-out ablations | ladderfig

The ladder starts from a GRU per node (M0) and adds one component per rung: a static distance graph (M1), the wind-aware adaptive graph (M2), the Transformer in place of the GRU (M3), the causal wavelet bands (M4), the ConvLSTM grid context (M5) and source-group gating (M6, the full MW-AeroFusion-Net). The ablations start from M6 and remove one part at a time: no wavelet, no graph, a fixed graph without wind or adaptive parts, no ConvLSTM, a GRU in place of the Transformer, and no gating.

### Training

All neural models use AdamW with learning rate 0.001, weight decay 0.0001 and cosine decay, batch size 32, up to 60 epochs with early stopping on validation RMSE (patience 8), mixed precision and gradient clipping at 1.0. Hyperparameters may be tuned on validation with at most 20 trials per rung. Seed 0 is used for the development runs, and the final configurations are trained with seeds 0 to 4.

### Metrics

For each lead l, with forecasts ŷ and observations y over all station-hours with a target:

$$ RMSE = √( mean (ŷ − y)² ),   MAE = mean |ŷ − y|,   bias = mean (ŷ − y) | metrics

$$ R² = 1 − Σ (y − ŷ)² / Σ (y − ȳ)²,   Skill_ref = 1 − RMSE / RMSE_ref | skill

Skill is computed against persistence and against CAMS. Results are broken down by season, by IGP versus the rest of the panel, and by city. For episodes above 250 µg/m³ the hit rate, false-alarm rate and critical success index CSI = hits / (hits + misses + false alarms) are reported, and AQI classes from the CPCB breakpoints are scored by accuracy and macro-F1. Differences between two models are tested with the Diebold-Mariano test [@Diebold_1995] with the Harvey-Leybourne-Newbold correction and with a 24-hour moving-block bootstrap.

## Software Testing and Validation

The repository has 146 automated tests in `ml/tests`, run with pytest on every change. Table {tab:tests} lists the main groups.

!table Main groups of automated tests | tests | 32,68
| Test group | What it checks |
|---|---|
| No leakage (`test_no_leakage.py`) | Changing any value after t0 leaves the input window unchanged; fires and CAMS respect their delays |
| Causal wavelet (`test_wavelet_causal.py`) | A band value at hour t does not change when later samples change |
| Final-eval guard (`test_final_eval_guard.py`) | Only `final_eval.py` can read the test arrays, and only with a model freeze file |
| No illustrative metrics (`test_no_illustrative_metrics.py`) | Paper tables carry a run identifier; result sections hold no metric-like numbers typed by hand |
| Time conversion (`test_xkdr_time.py`) | IST start-of-interval labels map to the correct UTC hour |
| Quality control (`test_qc.py`) | Bounds, flat lines, Hampel spikes and city-event exceptions on synthetic series |
| Stations (`test_stations.py`) | The 25 km city rule, the start-date and completeness rules of the panel |
| Models (`test_models.py`) | Every rung and baseline runs and learns a training step; gates form a distribution over groups; wind-aligned edges are positive only upwind; the masked Huber loss ignores missing targets |
| Metrics and significance (`test_metrics.py`, `test_significance.py`) | Metric formulas on known inputs; Diebold-Mariano on simulated forecasts |
| Data sources (`test_cams.py`, `test_fires.py`, `test_grid.py` and others) | Parsing, regridding and issue-time selection of each source |
| Export (`test_export_onnx.py`) | The ONNX export gives the same output as PyTorch |

Beyond the tests, the persistence baseline was reproduced from raw data by a separate code path (`test_persistence_repro.py`), and the station panel and split lock were checked after every dataset rebuild. A smoke run of M6 on the GPU checked the full pipeline before the long runs, and was deleted afterwards so that it could not be mistaken for a result.
