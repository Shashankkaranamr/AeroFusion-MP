# Deviations from the proposal (draft for the project report, PROGRESS P6.4)

Paste this as a section of the team's report source. Every item is backed by a dated entry in PROGRESS.md §9 or the §2
traceability table. Results are **not** stated here; they come from `make_tables.py` once the frozen model is scored.

## 1. Model components (proposal → implementation)

| Proposal | Implemented as | Why |
|---|---|---|
| Multi-resolution wavelet decomposition | Causal à-trous (stationary) db4 wavelet, 3 levels, computed inside each 72 h input window | A full-series DWT uses future samples, which leaks information into the forecast (Quilty & Adamowski 2018) |
| Adaptive diffusion graph (Haversine + wind) | Diffusion convolution over a k = 8, ≤ 600 km graph with wind-aligned edge weights from past winds, plus a learned adaptive adjacency | As proposed; both graph variants are ablated |
| ConvLSTM on (B, T, C, H, W) maps | ConvLSTM over gridded wind, boundary layer, temperature, fire power and CAMS fields on a 0.75° India grid (44 × 43), sampled at each station | PM2.5 targets are station points, not a grid; the ConvLSTM runs where gridded data exists |
| Transformer encoder | Causal Transformer over the past 72 h per node (GRU in the ablation) | As proposed |
| "Causal attention" giving % source contributions | **Source-group attribution gating**: a per-node softmax over feature groups (fire, meteorology, dust, traffic proxy, CAMS, history, calendar) with an entropy penalty | The weights are learned associations, not causal identification, so they are called *learned attribution* and validated (faithfulness, sanity, stability, plausibility). "Traffic" is a proxy (NO₂, CO, weekday/holiday); no traffic data exists |
| Inputs: CPCB, IMD weather, MODIS/VIIRS fires, events | CPCB via the XKDR archive (hourly), ERA5 (instead of IMD), VIIRS + MODIS fires (India and upwind neighbours), CAMS forecasts, calendar/Diwali/stubble/lockdown flags | The IMD archive is not openly available hourly; ERA5 is the standard open substitute |
| Outputs: t+1/24/48, AQI class, hotspots, attribution maps | PM2.5 at +1…+48 h (reported at +1/+24/+48); AQI class and hotspots derived from the forecast with CPCB breakpoints; gate weights per station | One model instead of three heads |
| Baselines: LSTM, CNN-LSTM, ConvLSTM | Kept, plus persistence, same hour yesterday, climatology, raw CAMS, CAMS + bias correction, LightGBM (past-only and with CAMS), PM2.5-GNN, Graph WaveNet | Reviewers expect operational and published baselines, not only LSTMs |
| Metrics: RMSE, MAE, R², ablations | Plus bias, skill vs persistence and vs CAMS, episode scores (> 250 µg/m³), AQI-class F1, 5 seeds, Diebold–Mariano tests | Needed for a credible comparison |
| Real-time deployment (out of scope in the proposal) | Built: live platform for 33 cities; the trained model will be served via ONNX | Scope grew |

## 2. Data and protocol decisions made during the project

| Decision | Reason |
|---|---|
| **Splits shifted back one year**: train 2018–2021, validation 2022, test 2023–2024 (frozen), PM-only check Apr–Sep 2025, prospective test winter 2026–27 | CPCB coverage in the public archive ends in December 2024 (only a few stations in 2025, none with NO₂/CO/O₃). Decided before any model or metric existed |
| Fixed **station panel**: 116 stations in 28 of the 33 cities (reporting since 2020-01-01, ≥ 60 % complete) | City averages drift as new stations open. Five cities (Bhubaneswar, Dehradun, Pune, Raipur, Srinagar) have no station that old; they stay in the graph without a target |
| **No future leakage** rules: station data usable at t0 − 1 h, fires at acquisition + 3 h, a CAMS run 10 h after it starts | Every input must be something an operational system would have at forecast time |
| Short input gaps **forward-filled** (≤ 3 h) instead of interpolated | Interpolation reads the value after the gap, which can be after the forecast time |
| Past **CAMS inputs** are short-lead forecasts from the latest published run, not lead-0 analyses | A run's lead-0 field is only published 10 h after the time it describes |
| CAMS forecasts downloaded for **leads 0–72 h** | +48 h at issue time needs leads up to 69 h from the latest usable run |
| Gating sparsity term = **entropy** of the group weights (not L1) | Softmax weights always sum to 1, so an L1 penalty is constant |
| Three input settings: **S-A** past-only (primary), **S-B** + CAMS forecast, **S-C** true future weather (upper bound only) | Separates the model's own skill from CAMS post-processing, and never presents perfect-prognosis results as forecasts |
| The test split is read **once**, by one script, after model freeze; its checksums are locked | So that no choice is tuned on test data |

## 3. Corrections to the original report
- The original report listed experimental results that had not been produced; they are removed. All numbers now come
  from run files (`ml/runs/<run_id>/metrics.json`) through `ml/scripts/make_tables.py`.
- Of the 12 original references, 8 could not be found in Crossref; they are removed and replaced by the verified
  references in `docs/related_work.md` (details in `Initial Proposal/reference_check.md`, kept private).
- "Causal" wording is replaced by "learned attribution" / "source-group attribution gating".
- AI assistance is disclosed in Appendix F as the template requires.
