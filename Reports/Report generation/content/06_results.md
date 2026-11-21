@chapter Results and Discussion

## Presentation of Results

### Status of the evaluation

All results in this chapter are on the validation year 2022. They were produced by the code at git commit e6b796e and read from the run files (`metrics.json`, `preds_val.parquet`). The table rows and the numbers in the text are filled in by the report's build script from those files, and Table {tab:runids} lists the run behind each development row. The first sections report the development runs with seed 0, which were used to build the model ladder. The five-seed final runs of MW-AeroFusion-Net, its six ablations and the four neural baselines finished on 21 November 2026; their results, with Diebold-Mariano tests and the attribution checks, follow in the sections on five seeds. The test years 2023 to 2024 have not been read. They will be scored once by `final_eval.py` after the team writes `MODEL_FREEZE.json`, and the test tables, season and city breakdowns and episode scores will be added then. No test-set number appears in this report.

### Live platform

The AeroFusion platform is deployed and refreshes every 12 hours. At the time of writing it shows all 33 cities, with six of the six data sources reporting. The platform presents CAMS forecasts, labelled as model output, and the measured CPCB history; it does not yet serve MW-AeroFusion-Net. The figures in this section were captured from the running dashboard on 20 November 2026, and Appendix A shows every view.

Figure {fig:web-pipeline} shows the pipeline as the dashboard explains it to a visitor: six sources are fetched, fused into one block of numbers and explained. Every panel of the site reads from that block, so the map, the city pages and the language-model analyst always agree with each other.

!fig ../../Report generation/snapshots/dark/web_pipeline.png | The data pipeline as shown on the dashboard: sources, fusion, tensor and explanation | web-pipeline

The map view (Figure {fig:web-map}) places the 33 cities on the map of India with their current PM2.5 class, together with the NASA FIRMS fire detections of the last 24 hours. Selecting a city lists the cities and regions from which today's wind carries air towards it. On the day of the capture most fire detections were in Uttar Pradesh and Punjab, close to the cities with the highest values.

!fig ../../Report generation/snapshots/dark/web_map.png | Live map view: city PM2.5 classes, NASA FIRMS fire detections and the incoming sources for Delhi | web-map

Figure {fig:web-orbit} shows four of the satellite layers that the platform takes from NASA GIBS for the previous day: thermal anomalies from VIIRS, aerosol optical depth and true-colour reflectance from MODIS, and land surface temperature. The aerosol layer shows the haze over the Indo-Gangetic Plain that the station data also records, and the true-colour image shows the same haze as a grey veil over the north of the country.

!fig ../../Report generation/snapshots/dark/web_orbit4.png | India from orbit on the previous day (NASA GIBS): thermal anomalies, aerosol optical depth, true colour and land surface temperature | web-orbit

The fused data is a tensor of time by city by feature. Figure {fig:web-tensor} shows the slice for the latest hour: one row per city and one column per feature, with each cell scaled against the other cities. The northern cities stand out in the pollutant columns, and the fire columns are brightest for the cities near the burning areas. Empty cells mark gaps left by a source; they are shown, not filled.

!fig ../../Report generation/snapshots/dark/web_tensor.png | The unified live tensor: 33 cities by 20 features for the latest hour, with the feature list | web-tensor

Each city page combines these inputs into a four-day outlook (Figure {fig:web-city}). The chart shows the CAMS forecast for the next 96 hours, marks the cleanest and the worst three-hour windows, and compares the forecast with the CPCB measurements of November 2024. The note under the chart states that the curve is CAMS and that MW-AeroFusion-Net will appear next to it only after it has been evaluated on data it has never seen.

!fig ../../Report generation/snapshots/dark/web_city_forecast.png | City view for Delhi: the four-day CAMS outlook with the cleanest and worst windows | web-city

Figure {fig:web-wind} shows the station archive that the history view is built on and the wind links of the day: for each city, the neighbouring city towards which the wind at that city is blowing.

!fig ../../Report generation/snapshots/dark/web_archive_wind.png | The CPCB station archive behind the history view, and the day's wind links between cities | web-wind

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

### Errors by season

PM2.5 in India follows a strong annual cycle, and so do the forecast errors. Figure {fig:season} splits the +24 hour error by season. The monsoon months are the easiest for every model: M0 has an RMSE of {r:m0_gru|24|by_season.monsoon_JJAS.rmse} µg/m³ from June to September, against {r:m0_gru|24|by_season.winter_DJF.rmse} µg/m³ in winter and {r:m0_gru|24|by_season.postmonsoon_ON.rmse} µg/m³ in October and November. The post-monsoon months, when crop-residue fires and a shallow boundary layer combine, are the hardest. Persistence suffers most in these months ({r:persistence|24|by_season.postmonsoon_ON.rmse} µg/m³), because concentrations change fastest then. The learned models stay within a few µg/m³ of each other in every season, and M6 is behind M0 and M4 in all four.

!fig fig5_3_season_rmse.png | Station RMSE at +24 hours by season, validation 2022 (seed 0) | season

### Errors by city

Figure {fig:city} shows the +24 hour error for each of the 28 cities with stations. The error follows the pollution level: the coastal and southern cities have the lowest errors, with Kochi at {r:m0_gru|24|by_city.kochi.rmse} µg/m³ for M0, while Delhi, Ghaziabad and Noida have the highest, with Delhi at {r:m0_gru|24|by_city.delhi.rmse} µg/m³. M0 has a lower error than LightGBM in {c:m0_vs_lgbm} of the 28 cities. M0 is below persistence in {c:m0_vs_pers} of the 28 cities, and LightGBM in {c:lgbm_vs_pers}.

!fig fig5_4_city_rmse.png | Station RMSE at +24 hours by city: persistence, LightGBM and M0 (validation 2022, seed 0) | city

### Variation between seeds

A neural network trained twice with different random seeds gives different results, and the ladder above uses one seed. Figure {fig:seeds} shows the full model trained with five seeds in settings S-A and S-B. In S-A the +1 hour error ranges from {s:m6_mwafn.1.min} to {s:m6_mwafn.1.max} µg/m³ (mean {s:m6_mwafn.1.mean}), and seed 0, the run in the ladder table, is at the high end of that range. At +24 hours the range is {s:m6_mwafn.24.min} to {s:m6_mwafn.24.max} µg/m³ (mean {s:m6_mwafn.24.mean}), and at +48 hours {s:m6_mwafn.48.min} to {s:m6_mwafn.48.max} µg/m³. Setting S-B is behind S-A at +1 and +24 hours for every seed. The spread at +1 hour is large enough that a single-seed comparison at that lead is not reliable, which is why the final comparison uses the seed mean and significance tests. The other rungs have one seed so far, so the figure compares M6 with the seed-0 runs of M0 and LightGBM only as reference lines.

!fig fig5_5_seed_spread.png | Full model trained with five seeds: station RMSE at +1, +24 and +48 hours in settings S-A and S-B (validation 2022) | seeds

### High-pollution episodes and AQI classes

For public warnings, the hours above 250 µg/m³ matter more than the average error. Figure {fig:episodes} shows how well each model forecasts these episodes 24 hours ahead. The models detect only a minority of the episode hours. Persistence has the highest hit rate ({r:persistence|24|episodes.pod}) but also the highest false-alarm rate ({r:persistence|24|episodes.far}), since it repeats yesterday's peak. The learned models are more cautious: M0 has a hit rate of {r:m0_gru|24|episodes.pod} with a false-alarm rate of {r:m0_gru|24|episodes.far}. M6 detects more episodes than M0 ({r:m6_mwafn|24|episodes.pod}) at the cost of more false alarms. The AQI class of the +24 hour forecast is correct for {r:m0_gru|24|aqi.accuracy|pct} of station-hours with M0 and {r:lgbm_mos_sb|24|aqi.accuracy|pct} with LightGBM MOS in setting S-B.

!fig fig5_6_episodes.png | Episode scores above 250 µg/m³ at +24 hours: hit rate, false-alarm rate and critical success index (validation 2022) | episodes

### Explained variance across leads

Figure {fig:r2} summarises every model by its R² at the three leads. All learned models explain most of the variance at +1 hour and lose roughly a third of it by +48 hours. Climatology and raw CAMS have nearly the same R² at every lead, because neither uses the recent station history. The learned models are grouped closely at every lead, which agrees with the small differences in RMSE.

!fig fig5_7_r2_by_lead.png | R² at the station level for each model at +1, +24 and +48 hours (validation 2022, seed 0) | r2

### CAMS and the CAMS-informed setting

Table {tab:val-sb} gives the results with CAMS. Raw CAMS has an RMSE of about 45 µg/m³ at every lead ({m:cams_raw.24.rmse} µg/m³ at +24 hours), which is similar to climatology and worse than every learned model in S-A. The per-station linear bias correction, fitted on the training years, does not help on 2022 and is slightly worse than raw CAMS ({m:cams_bc.24.rmse} µg/m³). A likely reason is that the bias of CAMS against the stations changed between the training years and 2022, so a correction fitted on 2018 to 2021 does not carry over. This will be checked on the test years.

LightGBM used as MOS on CAMS gives the best +48 hour result of all models ({m:lgbm_mos_sb.48.rmse} µg/m³), a small gain over LightGBM without CAMS ({m:lgbm_sa.48.rmse} µg/m³). The CAMS forecast therefore carries some useful information at longer leads when it is combined with station history. MW-AeroFusion-Net in S-B, however, is worse than in S-A at every lead, and the S-C run with true future weather is also worse than S-A. Since perfect future weather should not make a forecast worse, this points to a training problem in the full model, not to a lack of information in the inputs. The per-lead CAMS input and the extra future inputs in S-B and S-C are the first suspects, together with the gating.

!include gen_val_sb.md

### Regional breakdown

Table {tab:region} splits the +24 hour error between the Indo-Gangetic Plain and the rest of the panel. The IGP error is about twice the error elsewhere for every model, because concentrations and their swings are much larger there in winter. The ranking of models is the same in both regions. Raw CAMS has the largest IGP error, and the learned models reduce it by roughly a quarter. Most models have a small negative bias at +24 hours, meaning they under-forecast on average, while MW-AeroFusion-Net in S-B has a positive bias.

!include gen_region.md

!fig fig5_8_region_rmse.png | RMSE at +24 hours in the Indo-Gangetic Plain and in the rest of the panel (validation 2022) | region-fig

### Five seeds and significance tests

Table {tab:seeds} repeats the comparison with five seeds for every neural model and gives Diebold-Mariano p-values against LightGBM MOS, the strongest single model at +24 and +48 hours. The test uses the mean squared station error of each issue time, with a Newey-West variance and the Harvey-Leybourne-Newbold correction; a p-value below 0.05 is marked better or worse.

Over five seeds MW-AeroFusion-Net reaches {m:s_m6_mwafn.1.rmse} ± {m:s_m6_mwafn.1.sd} µg/m³ at +1 hour, {m:s_m6_mwafn.24.rmse} µg/m³ at +24 hours and {m:s_m6_mwafn.48.rmse} µg/m³ at +48 hours. It beats CAMS with bias correction at every lead (p = {m:s_m6_mwafn.24.pcams} at +24 hours). It does not beat LightGBM MOS: the difference is not significant at +1 hour (p = {m:s_m6_mwafn.1.plgbm}), and M6 is significantly worse at +24 hours (p = {m:s_m6_mwafn.24.plgbm}) and +48 hours (p = {m:s_m6_mwafn.48.plgbm}). The four neural baselines are within about 0.5 µg/m³ of each other at every lead and have small seed spreads; PM2.5-GNN has the lowest mean error of the neural models at +24 and +48 hours ({m:s_base_pm25gnn.24.rmse} and {m:s_base_pm25gnn.48.rmse} µg/m³), and M6 is behind all four on the mean. MW-AeroFusion-Net in S-B stays worse than in S-A at +1 and +24 hours over all five seeds, so the S-B result of the development run was not a single bad seed.

The spread of M6 at +1 hour is large because its seeds fall into two groups. Three seeds reach between {m:s_m6_mwafn.1.min} and about 22 µg/m³, close to the best neural baselines, while two seeds stay near {m:s_m6_mwafn.1.max} µg/m³, worse than persistence. The same split appears in the ablations that keep the gating (Table {tab:ablation}). One seed of the variant without ConvLSTM did not train at all and has an error of about 42 µg/m³ at +1 and +24 hours. Following the protocol, no run was repeated or removed; these seeds are part of the means.

!include gen_seeds.md

### Ablations

Table {tab:ablation} removes one component of M6 at a time, with five seeds each. Removing the source-group gating gives the largest change: the variant without gating has a lower mean error than the full model at every lead ({m:s_abl_no_gating.1.rmse}, {m:s_abl_no_gating.24.rmse} and {m:s_abl_no_gating.48.rmse} µg/m³) and the smallest seed spread of all M6 variants ({m:s_abl_no_gating.1.sd} µg/m³ at +1 hour), and every one of its seeds is in the good group. Removing the wavelet bands, removing the graph or replacing the Transformer by a GRU changes the mean error by about 1 µg/m³ or less at +24 and +48 hours, which is within the seed spread. Keeping only the fixed distance graph, without the learned adaptive matrix, is the only change that makes the model clearly worse on average ({m:s_abl_fixed_graph.24.rmse} µg/m³ at +24 hours), and three of its seeds stay above 28 µg/m³ at +1 hour.

In other words, on validation the gating as built does not help accuracy and makes training unstable. This matches the explanation suggested by the development runs: the gate summarises each group with a window mean and the last value, and on some seeds it appears to down-weight the recent PM2.5 history that matters most at short leads.

!include gen_ablation.md

### Attribution checks

The four attribution checks (deletion faithfulness, randomisation sanity, stability across seeds and plausibility against upwind fires) were run on the five seeds of MW-AeroFusion-Net on validation 2022 (Table {tab:attr}); the test years were not used. The results are mixed, and the failed checks are reported as failed.

- **Faithfulness.** Removing the two groups with the highest gate weight raises the error more than removing two random groups in {m:attr.0.nfaith} of {m:attr.0.seeds} seeds. The top-2 groups by gate and by Integrated Gradients are the same in three of the five seeds.
- **Sanity.** After cascading randomisation of the weights, the gate weights no longer match the trained ones in {m:attr.0.nsanity} of {m:attr.0.seeds} seeds, so the gates depend on what the model has learned.
- **Stability.** The mean gate weights of the five seeds do not agree: the mean pairwise Spearman correlation is {m:attr.0.stab}. This check fails. It is consistent with the two groups of seeds above: different seeds rely on different groups.
- **Fire plausibility.** At IGP stations in October and November, the fire gate rises with the upwind fire count of the last 24 hours in only {m:attr.0.nplaus} of {m:attr.0.seeds} seeds; in the others the correlation is negative. This check fails.

For comparison, the TreeSHAP values of LightGBM MOS put most weight on the PM2.5 history, then on the CAMS forecast and the calendar, with the fire group small. Because two of the four checks fail, the gate weights of MW-AeroFusion-Net cannot be read as source contributions, and the platform should not present them as such.

!include gen_attr.md

### Discussion

Four points stand out from the validation results.

First, the components do not add up, and the five-seed runs show why. Each of the graph, the wavelet bands and the ConvLSTM changes the error by about 1 µg/m³ or less, within the seed spread, while the source-group gating makes the model worse and unstable. Without the gating the model is close to the neural baselines; with it, two of five seeds fail at short leads. The gating was the component meant to provide explanations, and its attribution checks also fail on stability and plausibility, so on this evidence it costs accuracy without giving trustworthy explanations.

Second, simple and well-tuned models are hard to beat at this scale. The LSTM, CNN-LSTM, PM2.5-GNN and Graph WaveNet are within about 0.5 µg/m³ of each other over five seeds, and LightGBM MOS is significantly better than every neural model at +48 hours. This agrees with the motivation of the project: a fair comparison needs these baselines, and a complex model has to earn its complexity. On validation, MW-AeroFusion-Net has not.

Third, CAMS alone is far from the station observations in 2022, and a fixed bias correction does not fix it. Station-level learning gives a large and significant gain over CAMS, and LightGBM shows that CAMS can still add value as an input at longer leads, while the neural model in S-B does not yet use it well.

Fourth, the results show why several seeds are needed. With seed 0 alone, the variant without ConvLSTM would look like a failure and M6 would look worse than it is on average; with five seeds the instability itself becomes the finding.

These are validation results. The frozen test years will give the final comparison, scored once with the models listed in `MODEL_FREEZE.json`.

!include gen_runids.md

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

- **Validation only.** The results are from one validation year. The test years may rank the models differently.
- **The full model underperforms.** On validation, MW-AeroFusion-Net is behind the neural baselines on average and significantly behind LightGBM MOS at +24 and +48 hours. The ablations point to the source-group gating, which makes training unstable across seeds. The project cannot claim that the combination of components helps.
- **Station coverage.** Five of the 33 platform cities have no station in the panel, and some cities have a single station, so city-level conclusions there rest on one monitor.
- **Inputs.** ERA5 is a reanalysis and slightly better than the weather a real forecaster has at issue time; the S-A setting uses only past ERA5 values to limit this. Traffic is a proxy, and emission inventories are not used.
- **Attribution.** Gate weights describe what the model uses, and even passing checks would not make them source apportionment. On validation they fail the stability and fire plausibility checks.
- **No tuning after the ablations.** The gating problem was found after the final runs had started. Fixing it would need new runs at a new commit, which the schedule and the freeze protocol did not allow.
- **Live platform.** The platform currently shows CAMS, not the trained model, and its what-if view uses hand-set coefficients from the literature as an illustrative heuristic.
- **Time.** The Copernicus queue and a move to a new training machine took most of the schedule, which left little time for tuning before the deadline.
