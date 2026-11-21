@chapter Introduction

## Background of the Study

PM2.5 is the mass of airborne particles with a diameter of 2.5 micrometres or less. These particles reach deep into the lungs and the bloodstream, and long exposure to them is linked to heart and lung disease. In most large Indian cities the annual mean PM2.5 is well above the national standard, and the winter months bring episodes in which hourly values pass 250 µg/m³ for days at a time. The causes differ by city and by season. In the Indo-Gangetic Plain (IGP), crop-residue burning in Punjab and Haryana adds smoke to the regional haze in October and November [@Cusworth_2018, Ambulkar_2025], although a 2025 study finds only a weak coupling between observed surface PM2.5 in Delhi-NCR and rice-residue burning [@Mangaraj_2025], while a shallow boundary layer and low winds trap local emissions from traffic, industry and household fuel. Coastal and southern cities see lower levels, but they still have short episodes linked to calm weather and local sources.

India measures PM2.5 through the Continuous Ambient Air Quality Monitoring (CAAQM) network of the Central Pollution Control Board (CPCB). The network has grown quickly, and many cities now have several stations reporting every 15 minutes. The XKDR Forum publishes a cleaned hourly archive of this network under an open licence [@xkdr], which makes multi-year studies possible without scraping the CPCB portal.

Forecasts come mainly from chemistry-transport models. The SAFAR system runs city forecasts for a few megacities [@Beig_2021], the IITM Air Quality Early Warning System covers Delhi with WRF-Chem and data assimilation [@Ghude_2020, Jena_2021], NCMRWF runs a high-resolution chemistry model for Delhi's winter visibility and PM2.5 [@Jayakumar_2025], and the Copernicus Atmosphere Monitoring Service (CAMS) issues global forecasts twice a day at about 40 km resolution. CAMS is free and covers every Indian city, but it is not corrected to local monitors, and its errors over the IGP are large. Machine-learning models trained on station data can correct some of this error, because they learn the local diurnal cycle, the station's own bias and the link between weather and pollution at that site.

## Research Motivation

Three observations motivated the project. First, people need forecasts at the place where they live, for the next one or two days. A 40 km grid cell averages a whole city together with its rural surroundings. A station-level forecast for +1 to +48 hours can feed alerts, school and hospital planning, and personal decisions such as when to exercise outdoors.

Second, many published deep-learning results for PM2.5 are hard to compare and some are optimistic. Decomposition methods applied to the whole series before the train and test split let future values leak into the inputs [@Quilty_2018]. Studies often feed reanalysis weather for the future hours, which a real forecaster never has [@Wang_2020]. Of the seven related papers we read in full text (Chapter 2), none compared against CAMS or another operational forecast. A model that only beats an LSTM tells a reader little about whether it is useful.

Third, forecasts are more useful when they come with an explanation of what is driving pollution. Attention weights and gates are often read as source contributions, but they are learned associations and need to be tested before anyone relies on them [@jain2019attention, adebayo2018sanity].

The project therefore aims for a forecaster that is checked against operational baselines under the same information limits a real system faces, with every result produced by code and stored with the run that made it.

## Objective

The objectives of the project are:

1. To build and deploy a live monitoring platform for 33 Indian cities that fuses CAMS forecasts, weather, fire detections, satellite imagery and the CPCB archive, and explains current conditions in plain language.
2. To assemble a leakage-safe multi-city dataset of hourly PM2.5 and its drivers for 2018 to 2024, with a fixed station panel, documented quality control and a test split locked before modelling.
3. To design and implement MW-AeroFusion-Net, a station-level 1 to 48 hour PM2.5 forecaster that combines causal wavelet bands, a wind-aware adaptive diffusion graph, ConvLSTM grid context, a Transformer encoder and source-group attribution gating.
4. To compare the model with operational and published baselines (persistence, climatology, CAMS, CAMS with bias correction, LightGBM, LSTM, CNN-LSTM, ConvLSTM, PM2.5-GNN and Graph WaveNet) and to measure the value of each component through a model ladder and leave-one-out ablations.
5. To test whether the learned gate weights behave like plausible attributions, using deletion, randomisation, stability and plausibility checks.

## Scope

The forecasting model covers 116 CPCB stations in 28 of the 33 platform cities. Five platform cities (Bhubaneswar, Dehradun, Pune, Raipur and Srinagar) have no station with a long enough record, so they stay in the graph as nodes without a target. Seventeen upwind regions in India and neighbouring countries are added as context nodes to carry fire and weather information. The study period runs from December 2017, which provides the first input windows, to December 2024. An extra test from April to September 2025 uses PM2.5 only, and a prospective test on the winter of 2026 to 2027 is being collected from live data.

The model forecasts hourly PM2.5 at leads from +1 to +48 hours and is scored at +1, +24 and +48 hours. AQI classes and hotspots are derived from the forecast with the CPCB breakpoints. The live platform covers all 33 cities and shows CAMS values, clearly labelled as model output. Once the trained model is frozen and evaluated, it will be served through ONNX from the same backend.

The project does not perform source apportionment. The gate weights describe what the model relies on, and the report calls them learned attribution. Traffic data is not available, so a traffic proxy (NO2, CO, weekday and holiday flags) is used in its place.

!fig fig1_1_station_map_real.png | CPCB stations used in the panel (116), upwind source regions (17) and platform cities without a station, over NASA Blue Marble imagery | station-map

## SDG Justification

The project relates to three of the United Nations Sustainable Development Goals. The links below describe a possible contribution; the project has not measured any health or policy outcome.

**SDG 3, Good Health and Well-being.** Target 3.9 asks for a large reduction in deaths and illnesses from air pollution. Reliable short-range forecasts allow people with asthma or heart disease, and the hospitals that treat them, to prepare for high-pollution days. The platform's plain-language advice and AQI categories make the forecast usable by people without a technical background.

**SDG 11, Sustainable Cities and Communities.** Target 11.6 concerns the environmental impact of cities, with explicit attention to air quality. City agencies can use station-level forecasts and the upwind fire information to time temporary measures, such as restrictions on construction or traffic, before an episode rather than after it.

**SDG 13, Climate Action.** Crop-residue burning and fossil-fuel combustion are sources of both PM2.5 and greenhouse gases. Showing the link between upwind fires and city pollution supports public understanding of these shared sources. This is a secondary link, and the project does not model climate quantities.

## Existing System

Table {tab:existing} summarises the forecasting approaches available for Indian cities today and their limits for station-level use.

!table Existing approaches to PM2.5 forecasting for Indian cities | existing | 24,38,38
| Approach | Strength | Limitation for station-level forecasts |
|---|---|---|
| CAMS global forecasts | Free, covers all of India, 5-day horizon, twice daily | About 40 km grid, not corrected to CPCB stations, large errors in the IGP winter |
| SAFAR and IITM AQEWS | City-scale chemistry-transport models with local emission inventories and data assimilation [@Beig_2021, Ghude_2020] | Only a few cities; forecasts are not openly archived for independent scoring |
| Persistence and climatology | Simple, always available | Persistence decays quickly after a few hours; climatology ignores the current weather |
| Statistical and gradient-boosted models | Fast, strong with lagged features | One model per lead or station; no explicit spatial transport |
| LSTM and CNN-LSTM | Learn temporal patterns from station history | Treat stations independently; ignore wind-driven transport |
| Graph neural networks (PM2.5-GNN, Graph WaveNet) | Model transport between stations [@Wang_2020, Wu_2019] | Often trained with future reanalysis weather; rarely compared with CAMS |
| Public dashboards (CPCB, private apps) | Current readings and AQI | Little or no forecast; no explanation of drivers |

The common gap is that no open system combines station-level forecasts for many Indian cities, an honest comparison with CAMS at matched lead times, and a tested explanation of what drives the forecast.

## Proposed System

The proposed system has two parts that share data sources and the city list (Figure {fig:overview}).

**AeroFusion live platform.** A FastAPI backend fetches CAMS forecasts and weather from Open-Meteo, active fires from NASA FIRMS, satellite layers from NASA GIBS and measured history from the XKDR CPCB archive. Every 12 hours it fuses these into a tensor of up to 72 hours by 33 cities by 20 features and serves it through a REST API. A React 19 dashboard shows the national picture, a map with fires and wind, city detail, driver analysis, a what-if view, history and the data pipeline. An LLM analyst, Amazon Nova Micro on Bedrock with Groq as fallback, writes short insight cards and answers questions about the current data. A scroll-driven story page introduces the topic and hands the visitor to the dashboard.

!fig ../../Report generation/snapshots/dark/web_map.png | The AeroFusion live map: 33 cities coloured by PM2.5 class and the NASA FIRMS fires of the last 24 hours | web-map-intro

**MW-AeroFusion-Net.** The forecaster is trained offline on the GPU workstation from the leakage-safe dataset. It takes 72 hours of station inputs and gridded fields and predicts PM2.5 for each of the next 48 hours at every station. The model is built up in seven rungs, M0 to M6, so that the value of each component is measured. After the team freezes the model, it is evaluated once on the locked test years and exported to ONNX for the live backend.

!fig fig1_2_system_overview.png | Proposed system: public data sources, the live platform and the forecasting model, and their users | overview

## Work Plan

The project ran from the proposal review to the final submission on 21 November 2026. Table {tab:plan} lists the phases and Figure {fig:gantt} compares the plan with the actual progress. The Copernicus download queue and a move to a dedicated training machine in early November were the main causes of delay.

!table Work plan and status (as of 20 November 2026) | plan | 12,34,30,24
| Phase | Work | Output | Status |
|---|---|---|---|
| P0 | Proposal review, reference check, related-work matrix, data licences | Verified references, traceability table | Done |
| Platform | Live backend, dashboard, story page, LLM analyst | Deployed platform for 33 cities | Done |
| P1 | Downloads, station panel, QC, splits and lock file, dataset build | `dataset_v1`, data card, `SPLITS.lock` | Done |
| P2 | Baselines: persistence, climatology, CAMS, LightGBM, neural baselines | Validation runs with `metrics.json` | Done |
| P3 | Model ladder M0 to M6, settings S-A, S-B, S-C | Validation runs | Done (seed 0) |
| P4 | Five-seed final runs, ablations, model freeze, final evaluation on test | Test tables, attribution checks | In progress |
| P5 | ONNX export and serving in the live backend | Model forecasts on the platform | After P4 |
| P6 | Paper, report, viva preparation | IEEE paper draft, this report | In progress |

!fig fig1_3_work_plan_gantt.png | Work plan: planned phases (dashed) and actual progress (solid) | gantt
