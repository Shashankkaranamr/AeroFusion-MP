@chapter Literature Survey

## Overview

The survey covers six areas that the project builds on: chemistry-transport forecasts and their evaluation over India, statistical and gradient-boosted models, recurrent and attention models, graph neural networks, wavelet and decomposition hybrids, and interpretability. Every reference in this chapter was checked against Crossref by DOI or against the arXiv API before it was cited. For the papers whose full text was openly available, we also recorded the region, the inputs, whether a graph or wavelet was used, whether CAMS was a baseline, whether the protocol was leakage-safe and whether the explanations were validated.

## Detailed Survey

### Chemistry-transport forecasts and CAMS

India has two operational systems run by national institutes. SAFAR provides forecasts for a few megacities with a chemistry-transport model, local emission inventories and observations [@Beig_2021]. The IITM Air Quality Early Warning System for Delhi runs WRF-Chem with chemical data assimilation [@Ghude_2020], and a 400 m version of the Delhi forecast has been evaluated against stations [@Jena_2021]. More recently, NCMRWF developed DM-Chem, a high-resolution model with chemistry and aerosols that issues real-time winter forecasts of visibility and PM2.5 for Delhi and its surroundings [@Jayakumar_2025]. These systems are strong for the cities they cover, but they do not cover most of the country and their forecasts are not openly archived.

CAMS issues global forecasts of aerosols and reactive gases. Its PM2.5 forecasts have been validated and calibrated with a random forest against stations in China and the United States [@Wu_2020], and model output statistics (MOS) have been applied to CAMS ozone forecasts in Europe [@Petetin_2022]. Machine learning has also been used to downscale the CAMS regional forecast to daily high-resolution PM2.5 over Europe [@Shetty_2025], and a convolutional network has been used to bias-correct hourly MERRA-2 reanalysis PM2.5 worldwide from 2000 to 2024 [@Gupta_2026]. Over the IGP, CAMS and its reanalysis [@Inness_2019] have been evaluated for carbonaceous aerosol [@Soni_2021], for aerosol optical properties against AERONET [@Ansari_2023] and for aerosol composition at global ground sites [@Amarillo_2024]. We did not find a study that scores CAMS global PM2.5 forecasts against CPCB stations at matched lead times. This gap is one reason CAMS is the main operational baseline in this project.

### Statistical and gradient-boosted models

Early data-driven systems combined station history with meteorology and weather forecasts. Zheng et al. forecast fine-grained air quality across Chinese cities with a mix of temporal, spatial and dynamic predictors [@Zheng_2015]. Gradient-boosted trees such as LightGBM are now a standard strong baseline: they handle missing values, train in minutes and use lagged features well. Recent Indian studies keep this line of work active. Ensemble stacking of machine-learning models has been applied to air-quality prediction in Hyderabad [@Ravindiran_2025]. For Delhi, studies have compared imputation methods together with forecasting models for PM2.5 [@Karnati_2025] and compared ARIMA with LSTM models across the city's stations [@Bahadur_2026]. In this project LightGBM serves both as a past-only baseline and as a MOS post-processor of CAMS, and TreeSHAP [@lundberg2017a] gives its attributions.

### Recurrent and attention models

Recurrent networks learn the temporal pattern of each station. DeepAir fuses station and meteorological features with a distributed fusion network [@Yi_2018]. GeoMAN uses multi-level attention over sensors and time [@Liang_2018], and AirFormer applies Transformers to nationwide air-quality prediction in China [@Liang_2023]. A CNN-LSTM hybrid has recently been applied to multi-horizon PM2.5 forecasting in Delhi [@Ranjan_2026]. The Transformer encoder [@vaswani2017attention] is the basis of the temporal block in this project. The Temporal Fusion Transformer separates known future inputs from observed inputs and adds variable-selection gates [@Lim_2021]. The source-group gating in MW-AeroFusion-Net follows the same idea, applied to groups of physically related inputs.

### Graph neural networks for air quality

Spatio-temporal graph models were developed for traffic. DCRNN models traffic as diffusion on a directed graph [@li2017diffusion], STGCN uses spectral graph convolution [@Yu_2018], built on graph convolutional networks [@kipf2016semisupervised], and Graph WaveNet learns an adaptive adjacency from node embeddings [@Wu_2019]. For PM2.5, PM2.5-GNN adds wind-direction edges and domain knowledge for 184 Chinese cities [@Wang_2020]. Its offline experiments use reanalysis weather for the future hours, which corresponds to the upper-bound setting S-C in this project rather than to a real forecast. Graph transformers and multi-scale dynamic graphs have been applied to Chinese stations [@Zhang_2022, Lu_2025b]. For India, a cluster-based hybrid GNN with GRUs has been applied to CPCB stations across several states [@Ejurothu_2022], and a spatially attentive cluster GNN to Delhi [@Mandal_2023].

Graph models for air quality are an active area in 2025 and 2026, and a systematic review of hybrid graph convolutional networks for air-quality prediction sets out their foundations and open problems [@Abbasi_2025]. A spatiotemporal graph attention network forecasts PM2.5 from multi-source data [@WuST_2025], an adaptive graph-generating jump network improves the graph convolution for air-quality prediction [@Zeng_2025], and a federated framework combines a predefined graph with an adaptive graph [@HuangFed_2025], which is close to the static plus adaptive design used here. For Delhi, a hybrid spatiotemporal graph attention network forecasts the AQI several days ahead [@Neerukonda_2026], DynLink-AQ learns adaptive connections between stations for multi-pollutant, multi-horizon forecasts [@Velraj_2026], and federated learning has been used for privacy-preserving multi-station PM2.5 and PM10 forecasts [@FedDelhi_2026]. None of these, as far as their titles and abstracts state, scores the forecasts against CAMS.

### Wavelet and decomposition hybrids

Wavelet or mode decompositions followed by neural regressors are common for PM2.5 [@Bai_2016, Qiao_2019, He_2025]. VMD-GAT-BiLSTM combines a variational mode decomposition with a graph attention network [@Wang_2024], and WTCrossformer places a wavelet-transform convolution inside an attention model [@Lu_2025]. Variational mode decomposition with deep learning continues to be used for PM2.5 [@Cheng_2026]. A 2026 study for Delhi first splits the daily PM2.5 series into six modes with VMD and then forecasts them with a Transformer and BiLSTM [@GK_2026]; when such a decomposition runs over the full series, the boundary problem described next applies. Quilty and Adamowski showed that applying a wavelet transform to the full series before splitting uses future samples at the boundary, so the reported accuracy cannot be reached in real use [@Quilty_2018]. A boundary-corrected maximal overlap transform avoids this problem [@Barzegar_2021]. Several of the papers we read do not state when the decomposition is applied relative to the split. MW-AeroFusion-Net computes the transform causally inside each input window, so a band value at hour t uses only samples at or before t.

### Interpretability and attribution

Attention weights do not explain a model's decision by default [@jain2019attention], and saliency methods can pass visual inspection while failing randomisation tests [@adebayo2018sanity]. Integrated Gradients [@sundararajan2017axiomatic] and SHAP [@lundberg2017a] give attributions with stated axioms. The project uses these results to design four checks for the gate weights: faithfulness by deletion, sanity by model and data randomisation, stability across seeds, and plausibility against known events such as stubble burning.

Table {tab:survey} summarises the papers most relevant to the design.

!table Summary of the surveyed works most relevant to MW-AeroFusion-Net | survey | 16,14,10,12,13,14,21
| Work | Region and data | Graph | Wavelet | CAMS baseline | Leakage safe | Note |
|---|---|---|---|---|---|---|
| PM2.5-GNN [@Wang_2020] | China, 184 cities | Yes | No | No | No for operational use | Future reanalysis weather as input |
| Graph WaveNet [@Wu_2019] | US traffic | Yes, adaptive | No | n/a | n/a | Source of the adaptive adjacency |
| AirFormer [@Liang_2023] | China, nationwide | No | No | No | Partly | Chronological split; attention checked only qualitatively |
| TDGTN [@Zhang_2022] | China, 2 stations | Yes | No | No | Partly | Validation drawn at random from training years |
| MSDGNN [@Lu_2025b] | China, 22 stations | Yes | No | No | Partly | No meteorology |
| VMD-GAT-BiLSTM [@Wang_2024] | Beijing | Yes | VMD | No | Not stated | Decomposition on the original series |
| He et al. [@He_2025] | Guangzhou | No | Yes | No | At risk | Min-max scaling over the raw sequence |
| WTCrossformer [@Lu_2025] | Beijing, 12 stations | No | Yes | No | Partly | Wavelet as a layer inside the network |
| Ejurothu et al. [@Ejurothu_2022] | India, CPCB | Yes | No | Not checked | Not checked | Cluster-based hybrid GNN |
| SA-GNN [@Mandal_2023] | Delhi, CPCB | Yes | No | Not checked | Not checked | Spatially attentive cluster GNN |
| Wu et al. [@Wu_2020] | China and US | No | No | It is CAMS | Not checked | Random-forest calibration of CAMS |
| Wu et al. 2025 [@WuST_2025] | Multi-source PM2.5 | Yes, attention | No | Not checked | Not checked | Spatiotemporal graph attention |
| Neerukonda et al. 2026 [@Neerukonda_2026] | Delhi | Yes, attention | No | Not checked | Not checked | Multi-day AQI forecasts |
| DynLink-AQ 2026 [@Velraj_2026] | Delhi | Yes, adaptive | No | Not checked | Not checked | Multi-pollutant, multi-horizon |
| GK and G 2026 [@GK_2026] | Delhi, CPCB, daily | No | VMD | Not checked | At risk | Series decomposed before modelling |

## Research Gaps

The survey points to four gaps.

1. Wavelet hybrids for PM2.5 rarely state that the transform is causal, and some apply it to the whole series. A leakage-safe wavelet inside a multi-station graph model was not found in our search.
2. Graph models for PM2.5 are often trained or tested with future reanalysis weather. Their skill as a real forecast, with only data published before the issue time, is seldom reported.
3. None of the papers we read in full compares against CAMS or another operational forecast at matched lead times, and no study we found scores CAMS PM2.5 forecasts against CPCB stations.
4. Gate and attention weights are reported as explanations without validation. None of the papers we read in full tests them by deletion or randomisation.

No single component of MW-AeroFusion-Net is new. Graph models, wavelet hybrids and variable-selection gates all exist. The contribution the project can defend is a leakage-safe multi-city Indian benchmark against CAMS, with a full component ladder and ablations, and with sanity-checked learned attribution. The search results above are not proof of absence; they are what we found in Crossref and web searches in October 2026, updated with 2025 and 2026 papers in November 2026.

## Mapping of Project Objectives with Research Gaps

!table Mapping of project objectives to the research gaps | mapping | 34,22,44
| Objective | Gap addressed | How it is addressed |
|---|---|---|
| O1 Live platform for 33 cities | Little public explanation of drivers | Fused live data, maps of fires and wind, LLM insight cards labelled as CAMS-based |
| O2 Leakage-safe dataset | Gaps 1 and 2 | Fixed panel, documented QC, real publication delays, splits locked by checksum |
| O3 MW-AeroFusion-Net | Gap 1 | Causal wavelet per input window inside a graph, grid and Transformer model |
| O4 Baselines, ladder and ablations | Gaps 2 and 3 | Raw and bias-corrected CAMS at matched leads; past-only setting S-A as the primary result |
| O5 Attribution checks | Gap 4 | Deletion, randomisation, seed stability and plausibility tests of the gate weights |
