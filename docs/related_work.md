# Related work matrix (PROGRESS P0.6)

Built 2026-10-15. **Every entry below was checked against Crossref (DOI) or the arXiv API**; the "Verified as" column
is the title/venue returned by that lookup. Any reference not in this file must be verified the same way before it is cited.

**Column key.**
- **Graph / Wavelet / CAMS baseline:** read from the paper's design as described in its title, abstract or our working knowledge.
- **Leakage-safe** asks whether decompositions, normalisation and inputs use only data available at issue time.
- **XAI validated** asks whether the explanations are tested, for example with sanity checks or ablations against known events.

Values: `Y` yes, `N` no, `–` not applicable, `?` not yet checked in the full text.
**The `?` cells must be filled from the full text before the paper's related-work section is written** (owner: team, P6).

## A. Spatio-temporal graph and attention models (method lineage)

| # | Paper | Verified as | Task | Region | Data | Graph | Wavelet | CAMS baseline | Leakage-safe | XAI validated |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Wang et al. 2020, PM2.5-GNN | [10.1145/3397536.3422208](https://doi.org/10.1145/3397536.3422208), SIGSPATIAL '20 | PM2.5 forecast | China, 184 cities | PM2.5 + reanalysis met | Y (distance + wind-direction edges) | N | N | ? (check whether future met is an input) | N |
| 2 | Li et al. 2018, DCRNN | [arXiv:1707.01926](https://arxiv.org/abs/1707.01926) | traffic forecast | US freeways | loop sensors | Y (diffusion conv) | N | – | – | N |
| 3 | Wu et al. 2019, Graph WaveNet | [10.24963/ijcai.2019/264](https://doi.org/10.24963/ijcai.2019/264), IJCAI | traffic forecast | US freeways | loop sensors | Y (learned adaptive adjacency) | N (dilated causal conv; "WaveNet" is not a wavelet) | – | – | N |
| 4 | Yu et al. 2018, STGCN | [10.24963/ijcai.2018/505](https://doi.org/10.24963/ijcai.2018/505), IJCAI | traffic forecast | China / US | loop sensors | Y (spectral graph conv) | N | – | – | N |
| 5 | Liang et al. 2023, AirFormer | [10.1609/aaai.v37i12.26676](https://doi.org/10.1609/aaai.v37i12.26676), AAAI | air quality forecast | China, nationwide | station AQ + met | N (local spatial attention) | N | N | ? | N |
| 6 | Liang et al. 2018, GeoMAN | [10.24963/ijcai.2018/476](https://doi.org/10.24963/ijcai.2018/476), IJCAI | geo-sensory forecast (incl. AQ) | China | sensors | N (multi-level attention) | N | N | ? | N |
| 7 | Zheng et al. 2015 | [10.1145/2783258.2788573](https://doi.org/10.1145/2783258.2788573), KDD | AQ forecast | China | station AQ + met + forecasts | N | N | N | ? | N |
| 8 | Yi et al. 2018, DeepAir | [10.1145/3219819.3219822](https://doi.org/10.1145/3219819.3219822), KDD | AQ forecast | China | station AQ + met | N (spatial fusion net) | N | N | ? | N |
| 9 | Zhang et al. 2022, TDGTN | [10.3389/fenvs.2022.924986](https://doi.org/10.3389/fenvs.2022.924986), Front. Environ. Sci. | PM2.5 forecast | China (Beijing, Taizhou) | station PM2.5 | Y (graph transformer) | N | N | ? | ? |
| 10 | Lu et al. 2025, MSDGNN | [10.1371/journal.pone.0338392](https://doi.org/10.1371/journal.pone.0338392), PLOS One | PM2.5 forecast | China, 22 stations | station AQ + met | Y (multi-scale dynamic) | N | N | ? | ? |
| 11 | Wang et al. 2024, VMD–GAT–BiLSTM | [10.1038/s41598-024-68874-x](https://doi.org/10.1038/s41598-024-68874-x), Sci. Rep. | AQ forecast | China (Beijing) | station AQ | Y (GAT) | N (uses **VMD** decomposition) | N | ? (check whether VMD runs on the full series) | ? |
| 12 | Shi et al. 2015, ConvLSTM | [arXiv:1506.04214](https://arxiv.org/abs/1506.04214) | precipitation nowcast | Hong Kong | radar grids | N (conv grid) | N | – | – | N |
| 13 | Lim et al. 2021, TFT | [10.1016/j.ijforecast.2021.03.012](https://doi.org/10.1016/j.ijforecast.2021.03.012), IJF | multi-horizon forecast | – | various | N | N | – | Y (known future inputs separated) | partial (attention/variable-selection analyses) |

## B. India: station-level ML forecasting and operational systems

| # | Paper | Verified as | Task | Region | Data | Graph | Wavelet | CAMS baseline | Leakage-safe | XAI validated |
|---|---|---|---|---|---|---|---|---|---|---|
| 14 | Ejurothu et al. 2022 | [10.1007/s13143-022-00291-4](https://doi.org/10.1007/s13143-022-00291-4), Asia-Pac. J. Atmos. Sci. | PM2.5 forecast | India, multi-state | CPCB stations + met | Y (cluster-based hybrid GNN + GRU) | N | ? | ? | ? |
| 15 | Mandal et al. 2023, SA-GNN | [10.1016/j.jclepro.2023.137036](https://doi.org/10.1016/j.jclepro.2023.137036), J. Clean. Prod. (corrigendum [10.1016/j.jclepro.2023.137905](https://doi.org/10.1016/j.jclepro.2023.137905)) | PM2.5 forecast | India, Delhi | CPCB stations | Y (spatially attentive cluster GNN) | N | ? | ? | ? |
| 16 | Beig et al. 2021, SAFAR | [10.1016/j.envsoft.2021.105204](https://doi.org/10.1016/j.envsoft.2021.105204), Environ. Model. Softw. | operational AQ forecast | India megacities | CTM + emissions + obs | – | – | – | – | – |
| 17 | Ghude et al. 2020, IITM AQEWS | [10.18520/cs/v118/i11/1803-1815](https://doi.org/10.18520/cs/v118/i11/1803-1815), Curr. Sci. | operational PM2.5 forecast (WRF-Chem + chemical DA) | Delhi | model + obs | – | – | – | – | – |
| 18 | Jena et al. 2021 | [10.1038/s41598-021-83467-8](https://doi.org/10.1038/s41598-021-83467-8), Sci. Rep. | 400 m PM2.5 forecast evaluation | Delhi | WRF-Chem + obs | – | – | – | – | – |
| 19 | Cusworth et al. 2018 | [10.1088/1748-9326/aab303](https://doi.org/10.1088/1748-9326/aab303), Environ. Res. Lett. | crop-fire influence on Delhi PM | NW India → Delhi | fire + transport model | – | – | – | – | – |

## C. Wavelet / decomposition hybrids (and the leakage issue)

| # | Paper | Verified as | Task | Region | Data | Graph | Wavelet | CAMS baseline | Leakage-safe | XAI validated |
|---|---|---|---|---|---|---|---|---|---|---|
| 20 | Bai et al. 2016 | [10.1016/j.apr.2016.01.004](https://doi.org/10.1016/j.apr.2016.01.004), Atmos. Pollut. Res. | pollutant forecast | China | station AQ + met | N | Y (DWT + BPNN) | N | ? | N |
| 21 | Qiao et al. 2019 | [10.1109/access.2019.2944755](https://doi.org/10.1109/access.2019.2944755), IEEE Access | PM2.5 forecast | China | station PM2.5 | N | Y (WT + improved deep model) | N | ? | N |
| 22 | He et al. 2025 | [10.3390/toxics13040254](https://doi.org/10.3390/toxics13040254), Toxics | daily PM2.5 | China (Guangzhou) | station PM2.5 | N | Y (wavelet + CNN/BiGRU/BiLSTM) | N | ? | ? |
| 23 | Lu et al. 2025, WTCrossformer | [10.1007/s44273-025-00067-y](https://doi.org/10.1007/s44273-025-00067-y), Asian J. Atmos. Environ. | PM2.5 forecast | China (Beijing, 12 stations) | station AQ + met | N (cross-variable attention) | Y (wavelet-transform convolution) | N | ? | ? |
| 24 | Quilty & Adamowski 2018 | [10.1016/j.jhydrol.2018.05.003](https://doi.org/10.1016/j.jhydrol.2018.05.003), J. Hydrol. | **method critique**: incorrect wavelet use leaks future data | – | – | – | Y | – | (defines the problem) | – |
| 25 | Barzegar et al. 2021 | [10.1016/j.jhydrol.2021.126196](https://doi.org/10.1016/j.jhydrol.2021.126196), J. Hydrol. | boundary-corrected MODWT + CNN-LSTM | lakes | water level | N | Y (boundary-corrected, leakage-aware) | – | Y (by design) | – |

## D. CAMS evaluation and post-processing

| # | Paper | Verified as | Task | Region | Data | Graph | Wavelet | CAMS baseline | Leakage-safe | XAI validated |
|---|---|---|---|---|---|---|---|---|---|---|
| 26 | Wu et al. 2020 | [10.3390/rs12223813](https://doi.org/10.3390/rs12223813), Remote Sens. | CAMS PM2.5 forecast validation + RF calibration | China, US | CAMS + stations (2017–18) | N | N | Y (it *is* CAMS) | ? | – |
| 27 | Petetin et al. 2022 | [10.5194/acp-22-11603-2022](https://doi.org/10.5194/acp-22-11603-2022), ACP | MOS post-processing of CAMS O₃ | Europe | CAMS + stations | N | N | Y | ? | – |
| 28 | Soni et al. 2021 | [10.1039/d1ea00067e](https://doi.org/10.1039/d1ea00067e), Environ. Sci.: Atmos. | CAMS & MERRA-2 carbonaceous aerosol evaluation | IGP, India | ground sites | – | – | – | – | – |
| 29 | Ansari et al. 2023 | [10.1016/j.atmosenv.2022.119434](https://doi.org/10.1016/j.atmosenv.2022.119434), Atmos. Environ. | AERONET vs MERRA-2/CAMS aerosol | IGP, India | AERONET | – | – | – | – | – |
| 30 | Amarillo et al. 2024 | [10.1016/j.atmosenv.2024.120683](https://doi.org/10.1016/j.atmosenv.2024.120683), Atmos. Environ. | CAMS aerosol composition validation | global ground data | ground networks | – | – | – | – | – |

## E. Explainability, statistics, data

| # | Paper | Verified as | Use in our work |
|---|---|---|---|
| 31 | Adebayo et al. 2018, Sanity checks for saliency maps | [arXiv:1810.03292](https://arxiv.org/abs/1810.03292) | model/data randomisation tests for the gating weights (P4.4) |
| 32 | Jain & Wallace 2019, Attention is not Explanation | [arXiv:1902.10186](https://arxiv.org/abs/1902.10186) | why gate weights are called "learned attribution" and validated, not read as causes |
| 33 | Lundberg & Lee 2017, SHAP | [arXiv:1705.07874](https://arxiv.org/abs/1705.07874) | LightGBM baseline attributions |
| 34 | Sundararajan et al. 2017, Integrated Gradients | [arXiv:1703.01365](https://arxiv.org/abs/1703.01365) | gradient attribution cross-check |
| 35 | Diebold & Mariano 1995 | [10.1080/07350015.1995.10524599](https://doi.org/10.1080/07350015.1995.10524599), J. Bus. Econ. Stat. | significance of forecast-error differences |
| 36 | Vaswani et al. 2017 | [arXiv:1706.03762](https://arxiv.org/abs/1706.03762) | Transformer encoder |
| 37 | Kipf & Welling 2017 | [arXiv:1609.02907](https://arxiv.org/abs/1609.02907) | graph convolution |
| 38 | Hersbach et al. 2020, ERA5 | [10.1002/qj.3803](https://doi.org/10.1002/qj.3803), QJRMS | meteorology (S2/S3) |
| 39 | Inness et al. 2019, CAMS reanalysis (EAC4) | [10.5194/acp-19-3515-2019](https://doi.org/10.5194/acp-19-3515-2019), ACP | XAI plausibility checks only (S5) |

## Search log (what was looked for, 2026-10-15)
Searches were run on Crossref and the web. Queries:
- wavelet + graph neural network + PM2.5
- wavelet + graph convolution + multi-station PM2.5
- GNN + PM2.5 + India / CPCB
- CAMS PM2.5 forecast evaluation over India / the IGP
- ML / deep-learning bias correction of CAMS PM2.5

What they found:
- **Wavelet + graph:** no paper combining a wavelet with a graph model for multi-station PM2.5. The closest designs are #11 (VMD + GAT) and #23 (wavelet convolution with attention, no graph).
- **CAMS over India:** no study that scores CAMS **global PM2.5 forecasts** against CPCB stations at matched lead times. The India CAMS evaluations found (#28–29) cover aerosol composition and AOD.

These are search results, not proof of absence. Repeat the searches on Google Scholar/Scopus before submission and update this section.

## Novelty statement (honest; 3 sentences)
Spatio-temporal graph models for PM2.5 (including in India: #1, #5, #14, #15) and wavelet or decomposition hybrids (#11, #20–23) already exist, and source-group gating is an application of TFT-style variable selection (#13), so no single component is new. In our search (above) we did not find a model that combines per-window causal wavelets, a wind-aware adaptive graph and gridded ConvLSTM context for station-level PM2.5 in India, nor a study that benchmarks such models against CAMS global forecasts at matched leads over CPCB stations. The defensible contribution is therefore a leakage-safe multi-city Indian benchmark against CAMS with full component ablations and sanity-checked learned attribution (#24, #31, #32), not a new architecture, and "first"/"novel" wording stays out unless a Scholar/Scopus search before submission confirms the gap.

## Original report references
Checked 2026-10-15 against Crossref. The result is in `Initial Proposal/reference_check.md`, which is kept out of git with the report until P0.4 is done.
