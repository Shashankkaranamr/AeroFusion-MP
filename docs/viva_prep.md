# Viva preparation (PROGRESS P6.5)

Every member should be able to answer these five in their own words. Short answers first, then the detail to fall
back on. Add the measured results (from `docs/paper/tables/`) once the frozen model has been scored.

## (a) How did you prevent future information from leaking into the forecast?
**Short:** every input is cut at the forecast time with the delay it would have in real life, and the test years were
locked and read only once, after the model was frozen.

- Station readings: usable up to t0 − 1 h (a reading stamped t covers the hour ending at t + 1 h, verified on the XKDR API).
- Fires: a detection is usable 3 h after the satellite pass, so the hourly fire slots lag 4 h (found by a leakage test).
- CAMS: a run is published ~10 h after it starts, so past CAMS inputs come from runs at least 9–10 h old.
- Wavelets are computed inside each input window with causal filters (a full-series transform would look ahead).
- Normalisation is fitted on the training years only; targets are never filled; short input gaps are only carried
  forward (interpolation would use the value after the gap).
- Tests perturb every value after t0 and assert that the inputs do not change (`ml/tests/test_no_leakage.py`).
- The test split's checksums are stored in `SPLITS.lock`; `final_eval.py` refuses to run without a model freeze file
  and re-checks the checksums before and after.

## (b) Why does the ConvLSTM run on a grid when you forecast stations?
**Short:** the stations are points; the ConvLSTM is used for the things that are naturally maps (wind, boundary layer,
fires, CAMS), and its output is sampled at each station as regional context.

- Pollution at a station depends on what is happening upwind over hundreds of km (e.g. Punjab smoke reaching Delhi).
- The grid is 0.75° over India (44 × 43 cells), 3-hourly, built from ERA5, FIRMS and CAMS.
- Whether this helps is measured by the M5 rung and the "−ConvLSTM" ablation.

## (c) Why did "causal attention" become "attribution"?
**Short:** a model's weights show what it relied on, not what caused the pollution. Claiming causes would need
causal identification, which we do not do.

- The gate gives each source group (fire, weather, dust, traffic proxy, CAMS, history, calendar) a weight per station.
- We test those weights: removing high-weight groups should hurt more than removing random ones (faithfulness);
  randomising the model must change them (sanity, Adebayo et al. 2018); they should agree across seeds (stability);
  fire weights should rise with upwind fire counts in Oct–Nov (plausibility). Failed checks are reported as failed.
- Attention or gate weights are not explanations by themselves (Jain & Wallace 2019).

## (d) What did each ablation show?
**Short:** fill in from the ladder (validation) and ablation (test, 5 seeds) tables. Do not quote numbers from memory.

| Component | Rung / ablation | Result (from tables) |
|---|---|---|
| Wind-aware graph | M1 vs M0; −graph | _from table_ |
| Learned adjacency | M2 vs M1; fixed graph only | _from table_ |
| Transformer | M3 vs M2; Transformer→GRU | _from table_ |
| Causal wavelet | M4 vs M3; −wavelet | _from table_ |
| ConvLSTM context | M5 vs M4; −ConvLSTM | _from table_ |
| Gating | M6 vs M5; −gating | _from table_ |

A component that did not help stays in the proposed model and is reported honestly (PROGRESS §0).

## (e) Why is CAMS the baseline to beat?
**Short:** CAMS is the global operational forecast that anyone in India can already download; a learned model is only
useful if it adds skill on top of it at the same lead times.

- We compare at matched leads using only CAMS runs that were published by the forecast time.
- Raw CAMS has known biases over India (e.g. carbonaceous aerosol, Soni et al. 2021), so we also beat a per-station
  bias-corrected CAMS, the stronger and fairer baseline.
- Setting S-B (model + CAMS forecast) frames the model as CAMS post-processing; S-A (no CAMS forecast) shows the
  model's own skill.

## Other likely questions
- *Why only 28 cities in the tables?* Five cities have no station reporting since 2020; they are graph nodes without targets.
- *Why not 2025–26 as test?* The public CPCB archive has almost no data after 2024; the split was moved before any model existed.
- *Why ERA5, not IMD?* IMD hourly data is not openly available; ERA5 is the standard open reanalysis. In live use, forecast weather replaces it, a stated limitation.
- *How big is the model?* Full model (M6) ≈ 243 k parameters (counted from the code, `PROGRESS.md` §7).
