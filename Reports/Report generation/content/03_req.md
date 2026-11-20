@chapter Requirement Analysis and Specification

## Stakeholders

!table Stakeholders and their needs | stakeholders | 26,74
| Stakeholder | Needs from the system |
|---|---|
| Citizens and vulnerable groups | Current PM2.5 and AQI for their city, a short-range outlook, plain advice, and a simple explanation of why the air is bad today |
| City agencies and health services | Station-level forecasts at +24 and +48 hours to plan measures before an episode; upwind fire information during the stubble season |
| Researchers and reviewers | A reproducible benchmark with locked splits, documented data, baselines including CAMS, and results traceable to run files |
| Project team | A training pipeline that runs unchanged on a laptop, Kaggle and the GPU workstation, survives power loss, and never touches the test years before model freeze |
| Data providers (CPCB via XKDR, Copernicus, NASA, Open-Meteo) | Use within the licence terms, with attribution and no bulk redistribution where not allowed |

## Functional Requirements

**Live platform**

- FR1. Fetch CAMS PM2.5, PM10, aerosol optical depth, dust, NO2 and CO, together with weather, for 33 cities every 12 hours and on demand.
- FR2. Fetch NASA FIRMS active fires for the last 24 hours and count fires upwind of each city.
- FR3. Fuse the sources into a tensor of at most 72 hours by 33 cities by 20 features and keep the last good copy if a source fails.
- FR4. Serve status, snapshot, history, archive, tensor, model status and AI endpoints through a REST API.
- FR5. Show a national view, a map with fires, wind and satellite layers, a city view with a four-day outlook, driver analysis, a what-if view, monthly history from the CPCB archive, and the data pipeline.
- FR6. Generate short insight cards and answer free-text questions with an LLM, falling back from Bedrock to Groq if the first provider fails.
- FR7. Label every CAMS value as model output, and label the what-if view as an illustrative heuristic.

**Forecasting model**

- FR8. Download and checksum all raw data with resumable scripts, and record each file in a manifest.
- FR9. Build a fixed panel of stations, apply quality control, convert all times to UTC and build the dataset for train, validation and test.
- FR10. Lock the test split by checksum and allow only the final evaluation script to read it.
- FR11. Train every model from one YAML configuration, save the configuration, metrics, predictions and environment under a unique run identifier, and resume an interrupted run from its last epoch.
- FR12. Forecast PM2.5 at +1 to +48 hours for every station and return the source-group gate weights with each forecast.
- FR13. Score every model at +1, +24 and +48 hours with RMSE, MAE, R², bias, skill, episode scores and AQI-class F1, and test differences for significance.
- FR14. Generate every report and paper table from run files.

## Non-Functional Requirements

!table Non-functional requirements | nfr | 22,78
| Quality | Requirement |
|---|---|
| Integrity | No metric is typed by hand; every reported number traces to a `metrics.json` file and its run identifier |
| No leakage | Inputs use only data published before the issue time; wavelets are causal; normalisation uses training years only; targets are never interpolated |
| Reproducibility | Fixed seeds, versioned configurations, a git hash in every run identifier, data manifests with SHA-256 checksums |
| Portability | The same code runs on CPU, Kaggle and a CUDA GPU; the device comes from the configuration |
| Reliability | Training survives power loss through atomic checkpoints; the live backend falls back to the last good data when a source times out |
| Performance | The live refresh finishes within the 12-hour cycle; dashboard views load from cached API responses |
| Security | API keys live only in untracked environment files and in the hosting provider's secret store; keys are never logged |
| Cost | LLM calls are cached and limited to the refresh cycle and user questions; no LLM calls in tests |
| Usability | Reduced-motion support, light and dark themes, plain-language advice next to every number |

## System Requirements

### Hardware Requirements

!table Hardware used for development, training and hosting | hardware | 26,74
| Item | Specification |
|---|---|
| Training workstation | NVIDIA RTX PRO 4500 (Blackwell) with 32 GB VRAM; Intel Xeon, 12 cores and 24 threads; 63 GB RAM; 852 GB free on the system drive and 1.86 TB on a data drive |
| Development laptops | Any recent laptop with 16 GB RAM; used for data scripts, the platform and the test suite on CPU |
| Backend hosting | Render web service (Python runtime, free plan, Singapore region) |
| Frontend hosting | Vercel static hosting with automatic deployment from the main branch |

The model is small (under 250,000 parameters for the full M6), so GPU memory is not the limit. The cost of training lies in the number of runs: baselines, seven ladder rungs, three settings, six ablations and five seeds each. A GPU that can be used for long uninterrupted runs matters more than raw speed.

### Software Requirements

!table Software stack | software | 24,76
| Layer | Software |
|---|---|
| Operating system | Windows 11 (training workstation), any OS for development |
| Language and runtime | Python 3.12, Node.js 22 |
| Deep learning | PyTorch 2.11 with CUDA 12.8 (needed for Blackwell GPUs), PyTorch Geometric |
| Data | NumPy, pandas, PyArrow, xarray, zarr, h5netcdf, netCDF4, SciPy, PyWavelets |
| Classical models and explanations | LightGBM 4.7, SHAP, Captum |
| Data access | cdsapi and the ECMWF data-stores client for Copernicus, httpx for REST sources |
| Experiment tracking and export | run folders with `metrics.json`, MLflow, ONNX and ONNX Runtime |
| Testing | pytest (146 tests) |
| Backend | FastAPI, Uvicorn, httpx, python-dotenv |
| Frontend | Vite 6, React 19, Tailwind CSS 4, Recharts 3, MapLibre GL 6, Three.js, GSAP |
| AI services | Amazon Bedrock (Nova Micro), Groq (gpt-oss models), optional local Ollama |

### Cost Estimation

The project has no direct spending on data or software. All data sources are open, and all libraries are open source. Table {tab:cost} lists the cost items.

!table Cost items | cost | 30,70
| Item | Cost to the team |
|---|---|
| Data (XKDR, CAMS, ERA5, FIRMS, Open-Meteo, GIBS) | No charge under open licences; Copernicus requires free accounts and licence acceptance |
| Training hardware | Existing GPU workstation; no purchase |
| Backend and frontend hosting | Render free plan and Vercel hosting |
| LLM usage | Pay per token on Bedrock, with Groq as fallback; kept small by caching insights per refresh |
| Software | Open-source libraries only |

## Data Requirements

!table Data sources, use and licence | data-sources | 22,30,20,28
| Source | Used for | Resolution | Licence |
|---|---|---|---|
| CPCB CAAQM via the XKDR India Air Quality Database [@xkdr] | Targets and pollutant history (PM2.5, PM10, NO2, CO, O3) | Hourly, station | CC BY 4.0 |
| ERA5 reanalysis [@Hersbach_2020] | Node meteorology and the gridded fields | Hourly, 0.25° regridded to 0.75° | CC BY 4.0 |
| CAMS global forecasts | Baseline, inputs in S-B, gridded aerosol fields | 3-hourly leads, about 40 km | CC BY 4.0 |
| CAMS reanalysis (EAC4) [@Inness_2019] | Plausibility checks of the gate weights only | 3-hourly | CC BY 4.0 |
| NASA FIRMS (MODIS, VIIRS) [@firms] | Fire counts and radiative power near and upwind of nodes | Per detection | NASA open data with acknowledgement |
| Open-Meteo | Live weather and node meteorology series | Hourly | CC BY 4.0 |
| OpenAQ [@openaq] | Prospective winter test | Hourly | Attribution; no bulk redistribution |
| python-holidays | Holiday and Diwali flags | Daily | MIT |

## Constraints and Limitations

- The public CPCB archive has few stations after December 2024 and none with NO2, CO or O3 in 2025. The test years were therefore set to 2023 to 2024, with a PM2.5-only check for April to September 2025.
- The Copernicus data stores queue requests. A month of CAMS forecasts took close to three hours in the queue, so downloads, not training, set the pace of the project.
- India Meteorological Department data is not openly available at hourly resolution; ERA5 is used instead.
- No traffic counts exist for the study cities; traffic enters only through a proxy.
- The live platform's PM2.5 values are CAMS model output, not measurements, until the trained model is served.
- The backend runs on a free hosting plan, which sleeps after idle periods and limits memory; it must not load PyTorch.

## Assumptions

- CPCB station readings after quality control represent the true PM2.5 at the station.
- The publication delays measured in 2026 (station data one hour, fires three hours, CAMS ten hours after the run starts) also held during 2018 to 2024.
- The 116-station panel is stable enough over 2018 to 2024 that city-level comparisons across years are meaningful.
- The team, not the code, decides when features and the model are frozen.

## Risks and Challenges

!table Risks and mitigations | risks | 30,70
| Risk | Mitigation |
|---|---|
| Copernicus queue delays | Downloads started first, two jobs at a time, resumable and idempotent; partial dataset builds used for smoke tests meanwhile |
| Power loss during training | Atomic checkpoint after every epoch (`last.pt`), automatic resume with the same run identifier, and a watchdog that restarts unfinished lanes (Figure {fig:restart}) |
| Test-set leakage | Test split locked by SHA-256 checksum; only `final_eval.py` may read it; tests fail if any other code path loads it |
| Future-information leakage | Unit tests perturb every value after the issue time and check that the inputs do not change |
| Unverified references in the original proposal | All references checked against Crossref and arXiv; eight that could not be found were removed |
| Model underperforms simple baselines | Ladder and ablations show which component helps; all results are reported, including negative ones |
| Exposure of API keys | Keys only in untracked files and the host's secret store; never printed or committed |

!fig fig5_8_restart_safe_training.png | Restart-safe training after a power cut: atomic checkpoints and automatic resume | restart
