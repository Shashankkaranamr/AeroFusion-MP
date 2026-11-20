@chapter Results and Discussion

## Presentation of Results

### Status of the evaluation

All results in this chapter are on the validation year 2022, from the development runs with seed 0. They were produced by the code at git commit e6b796e and read from each run's `metrics.json`. The table rows and the numbers in the text are filled in by the report's build script from those files, and Table {tab:runids} lists the run behind each row. The five-seed final runs and the ablations started on 20 November 2026 and are still training. The test years 2023 to 2024 have not been read. They will be scored once by `final_eval.py` after the team writes `MODEL_FREEZE.json`, and the test tables, significance tests, season and city breakdowns, episode scores and attribution checks will be added then. No test-set number appears in this report.

### Live platform

The AeroFusion platform is deployed and refreshes every 12 hours. At the time of writing it shows all 33 cities, with six of the six data sources reporting. Appendix A shows the main views. The platform presents CAMS forecasts, labelled as model output, and the measured CPCB history; it does not yet serve MW-AeroFusion-Net.

### Baselines in the past-only setting

Table {tab:val-sa} gives the validation errors in setting S-A. Persistence is strong at one hour ahead (RMSE {m:persistence.1.rmse} µg/m³) because PM2.5 changes slowly from one hour to the next, but its error grows to {m:persistence.48.rmse} µg/m³ at +48 hours. Climatology has almost the same error at every lead ({m:climatology.24.rmse} µg/m³ at +24 hours), and at +48 hours it is slightly better than persistence. Same hour yesterday is worse than both at every lead.

The learned models all beat persistence at +24 and +48 hours. LightGBM reaches {m:lgbm_sa.24.rmse} µg/m³ at +24 hours and {m:lgbm_sa.48.rmse} µg/m³ at +48 hours, but at +1 hour it is slightly worse than persistence. The neural baselines are close to each other. The LSTM, the CNN-LSTM and PM2.5-GNN are between {m:base_pm25gnn.1.rmse} and {m:base_cnn_lstm.1.rmse} µg/m³ at +1 hour and between {m:base_cnn_lstm.24.rmse} and {m:base_lstm.24.rmse} µg/m³ at +24 hours. The ConvLSTM baseline, which sees only gridded fields at the station location, is the weakest neural model at +1 hour ({m:base_convlstm_base.1.rmse} µg/m³). Graph WaveNet does not improve on PM2.5-GNN at any lead.

!include gen_val_sa.md

!fig fig6_1_ladder_validation.png | Validation RMSE of the model ladder and the baselines at +1, +24 and +48 hours (2022, seed 0, from metrics.json) | val-chart

### Model ladder

Table {tab:ladder} shows the ladder. The rungs M0 to M4 are within about 1 µg/m³ of each other at +24 and +48 hours. The static graph (M1) and the causal wavelet bands (M4) lower the +1 hour error compared with M0, to {m:m1_static_graph.1.rmse} and {m:m4_wavelet.1.rmse} µg/m³ against {m:m0_gru.1.rmse} µg/m³. Moving from the GRU to the Transformer (M3) raises the +1 hour error to {m:m3_transformer.1.rmse} µg/m³, and the wavelet bands in M4 bring it back down. Adding the ConvLSTM grid context (M5) gives the lowest +1 hour error of all models, {m:m5_convlstm.1.rmse} µg/m³, but a higher error at +24 and +48 hours than M4.

The full model M6, which adds source-group gating, has the highest error of the ladder at +1 hour ({m:m6_mwafn.1.rmse} µg/m³) and at +24 hours ({m:m6_mwafn.24.rmse} µg/m³). At +48 hours it is close to M5. In this development run the full MW-AeroFusion-Net does not beat its own simpler rungs, LightGBM or the neural baselines on validation.

!include gen_ladder.md

Figure {fig:curves} shows the validation RMSE after each epoch. Every rung reaches its best validation error within the first four epochs, after which the validation error drifts upward, and early stopping ends the runs after 9 to 12 epochs. The models appear to fit the training years quickly and then overfit them, which suggests that stronger regularisation or a smaller learning rate late in training could help all rungs. M6 starts with a higher validation error than every other rung and stays above them for the whole run. Two diagnostic runs of M6 with a lower learning rate did not close the gap. They were exploratory, are not part of the ladder, and their numbers are not reported here.

!fig fig6_2_learning_curves.png | Validation RMSE per epoch for the ladder rungs (2022, seed 0) | curves

### Skill against persistence

Table {tab:skill} gives skill against persistence, where a positive value means a lower RMSE than persistence. At +24 hours every learned model in the table has positive skill, from {m:m6_mwafn.24.skill} for M6 to {m:m0_gru.24.skill} for M0. At +48 hours the skill rises for all learned models because persistence degrades fastest, and LightGBM MOS in setting S-B reaches the highest value, {m:lgbm_mos_sb.48.skill}. At +1 hour the recurrent and graph models beat persistence by a small margin, while LightGBM, the ConvLSTM baseline and M6 do not.

!include gen_skill.md

### CAMS and the CAMS-informed setting

Table {tab:val-sb} gives the results with CAMS. Raw CAMS has an RMSE of about 45 µg/m³ at every lead ({m:cams_raw.24.rmse} µg/m³ at +24 hours), which is similar to climatology and worse than every learned model in S-A. The per-station linear bias correction, fitted on the training years, does not help on 2022 and is slightly worse than raw CAMS ({m:cams_bc.24.rmse} µg/m³). A likely reason is that the bias of CAMS against the stations changed between the training years and 2022, so a correction fitted on 2018 to 2021 does not carry over. This will be checked on the test years.

LightGBM used as MOS on CAMS gives the best +48 hour result of all models ({m:lgbm_mos_sb.48.rmse} µg/m³), a small gain over LightGBM without CAMS ({m:lgbm_sa.48.rmse} µg/m³). The CAMS forecast therefore carries some useful information at longer leads when it is combined with station history. MW-AeroFusion-Net in S-B, however, is worse than in S-A at every lead, and the S-C run with true future weather is also worse than S-A. Since perfect future weather should not make a forecast worse, this points to a training problem in the full model, not to a lack of information in the inputs. The per-lead CAMS input and the extra future inputs in S-B and S-C are the first suspects, together with the gating.

!include gen_val_sb.md

### Regional breakdown

Table {tab:region} splits the +24 hour error between the Indo-Gangetic Plain and the rest of the panel. The IGP error is about twice the error elsewhere for every model, because concentrations and their swings are much larger there in winter. The ranking of models is the same in both regions. Raw CAMS has the largest IGP error, and the learned models reduce it by roughly a quarter. Most models have a small negative bias at +24 hours, meaning they under-forecast on average, while MW-AeroFusion-Net in S-B has a positive bias.

!include gen_region.md

### Discussion

Three points stand out from the validation results.

First, the components do not add up. Each of the graph, the wavelet bands and the ConvLSTM helps at one lead or another, but the gains are small and do not stack, and the full model is behind its parts. One explanation is optimisation: M6 is the largest model, it adds an entropy term to the loss, and the gate summarises each group with a window mean and the last value, which may down-weight the most recent PM2.5 history that matters most at +1 hour. The leave-one-out ablations, in particular the run without gating, test this directly. They are in progress and their results will be reported with the final tables, whatever they show.

Second, simple and well-tuned models are hard to beat at this scale. LightGBM, a GRU and an LSTM are within 1 to 2 µg/m³ of each other at +24 and +48 hours. This agrees with the motivation of the project: a fair comparison needs these baselines, and a complex model has to earn its complexity.

Third, CAMS alone is far from the station observations in 2022, and a fixed bias correction does not fix it. Station-level learning gives a large gain over CAMS, and LightGBM shows that CAMS can still add value as an input at longer leads.

These are development results on one seed and one year. The five-seed runs will give the spread between seeds, and the frozen test years will give the final comparison with significance tests.

!include gen_runids.md

### Attribution checks

The four attribution checks (deletion faithfulness, randomisation sanity, stability across seeds and plausibility against upwind fires in October and November) are implemented in `explain.py` and tested. They run on the frozen model after the final evaluation, so no attribution results are reported yet. A failed check will be reported as failed.

## Deviations from the Proposal

Table {tab:deviations} records where the implementation differs from the original proposal and why. Every item has a dated entry in the project log.

!table Proposal compared with the implementation | deviations | 24,36,40
| Proposal | Implemented as | Reason |
|---|---|---|
| Multi-resolution wavelet decomposition | Causal à-trous db4 wavelet, three levels, inside each 72-hour window | A full-series transform uses future samples [@Quilty_2018] |
| Adaptive diffusion graph (distance and wind) | Diffusion convolution on an 8-neighbour, 600 km graph with wind-aligned weights and a learned adaptive matrix | As proposed; both graph variants are ablated |
| ConvLSTM on map tensors | ConvLSTM over gridded wind, BLH, temperature, fire and CAMS fields, sampled at each station | Targets are station points; the ConvLSTM runs where gridded data exists |
| Transformer encoder | Causal Transformer over 72 hours per node (GRU in the ablation) | As proposed |
| "Causal attention" giving percentage source contributions | Source-group attribution gating with an entropy penalty, validated by four checks | The weights are learned associations; "traffic" is a proxy because no traffic data exists |
| CPCB, IMD weather, MODIS/VIIRS fires, events | CPCB via XKDR, ERA5 in place of IMD, VIIRS and MODIS fires, CAMS forecasts, calendar and event flags | IMD data is not openly available hourly |
| Three output heads (+1, +24, +48 h) | One model for +1 to +48 hours; AQI class and hotspots derived from the forecast | Simpler and consistent across leads |
| Baselines LSTM, CNN-LSTM, ConvLSTM | Kept, plus persistence, same hour yesterday, climatology, CAMS, CAMS with bias correction, LightGBM, PM2.5-GNN, Graph WaveNet | A useful forecaster must beat operational and published baselines |
| Metrics RMSE, MAE, R² | Plus bias, skill, episode scores, AQI-class F1, five seeds, Diebold-Mariano tests | Needed for a credible comparison |
| Deployment out of scope | Live platform for 33 cities built; ONNX serving planned after model freeze | Scope grew |
| Test years not fixed | Train 2018 to 2021, validation 2022, test 2023 to 2024, locked by checksum | The public archive thins out after 2024 |

The original proposal also listed experimental results that had not been produced. They have been removed, and every number in this report comes from a run file. Of the twelve original references, eight could not be found in Crossref; they were replaced by the verified references listed at the end of this report.

## Limitations of the Study

- **Validation only.** The results are from one seed on one validation year. They can change with the five-seed runs, and the test years may rank the models differently.
- **The full model underperforms.** On validation, MW-AeroFusion-Net is behind its simpler rungs and the strongest baselines. Until the ablations explain this, the project cannot claim that the combination of components helps.
- **Station coverage.** Five of the 33 platform cities have no station in the panel, and some cities have a single station, so city-level conclusions there rest on one monitor.
- **Inputs.** ERA5 is a reanalysis and slightly better than the weather a real forecaster has at issue time; the S-A setting uses only past ERA5 values to limit this. Traffic is a proxy, and emission inventories are not used.
- **Attribution.** Gate weights describe what the model uses. Even if they pass the four checks, they are not source apportionment.
- **Live platform.** The platform currently shows CAMS, not the trained model, and its what-if view uses hand-set coefficients from the literature as an illustrative heuristic.
- **Time.** The Copernicus queue and a move to a new training machine took most of the schedule, which left little time for tuning before the deadline.
