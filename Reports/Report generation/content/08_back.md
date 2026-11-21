@references

@appendix A | Snapshots

The snapshots below were taken on 20 November 2026 from the current dashboard build connected to the deployed API, in the dark theme. The PM2.5 values on the platform are CAMS model output, not measurements.


!fig ../../Report generation/snapshots/dark/app_now.png | Now view: national average, cities above the limit, people exposed and fires seen today | snap-now

!fig ../../Report generation/snapshots/dark/app_map.png | Map view: city PM2.5, NASA FIRMS fires, transport arrows with shares and the time scrubber | snap-map

!fig ../../Report generation/snapshots/dark/app_city_delhi.png | City view for Delhi: PM2.5, AQI, advice and the four-day outlook | snap-city

!fig ../../Report generation/snapshots/dark/app_why.png | Why view: AI insight cards and the drivers across cities | snap-why

!fig ../../Report generation/snapshots/dark/app_what-if.png | What-if view, an illustrative heuristic on the CAMS forecast (not a model result) | snap-whatif

!fig ../../Report generation/snapshots/dark/app_history.png | History view: monthly CPCB history and the calendar heatmap | snap-history

!fig ../../Report generation/snapshots/dark/app_data.png | Behind-the-data view: the pipeline, source health and the live tensor | snap-data

@appendix B | Details of List of Publications

A conference paper, "MW-AeroFusion-Net: A Leakage-Safe Multi-City Benchmark for Station-Level PM2.5 Forecasting in India against CAMS", has been drafted in IEEE format. Its results sections wait for the final evaluation on the test years. The venue will be chosen by the team with the guide from the IEEE conferences open at the time of submission (candidates: INDICON, CONECCT and ICCCNT), after checking their indexing. The paper has not been submitted.

@appendix C | Details of Patent

Not applicable.

@appendix D | Details of Funding

Not applicable. The project used open data, open-source software, existing computing hardware and the free hosting tiers described in Chapter 3.

@appendix E | POs and PSOs Mapped

!table Mapping of the project to the Programme Outcomes | po | 22,10,68
| Programme Outcome | Level | Justification |
|---|---|---|
| PO1 Engineering knowledge | 3 | Applies signal processing (wavelets), graph theory, deep learning and statistics to a real forecasting problem |
| PO2 Problem analysis | 3 | Analyses the literature, finds leakage and missing operational baselines, and frames research questions |
| PO3 Design and development of solutions | 3 | Designs a five-component model, a data pipeline and a deployed platform for 33 cities |
| PO4 Conduct investigations of complex problems | 3 | Model ladder, ablations, three input settings, twelve baselines and significance tests |
| PO5 Engineering tool usage | 3 | PyTorch, LightGBM, xarray and zarr, Copernicus APIs, FastAPI, React, cloud hosting, GPU training |
| PO6 The engineer and the world | 2 | Public-health relevance of PM2.5 forecasts; links to SDGs 3, 11 and 13 |
| PO7 Ethics | 3 | No invented results, frozen test split, licence compliance, honest labelling of model output |
| PO8 Individual and collaborative team work | 3 | Work divided across data, models, platform and report, with shared decision points |
| PO9 Communication | 2 | Report, paper draft, dashboard explanations and the story page |
| PO10 Project management and finance | 2 | Phased plan, cut order, risk handling and a zero-cost data and software stack |
| PO11 Life-long learning | 3 | New areas learned during the project: atmospheric data, reanalysis, graph models and MLOps |

!table Mapping of the project to the Programme Specific Outcomes | pso | 22,10,68
| Programme Specific Outcome | Level | Justification |
|---|---|---|
| PSO1 [department PSO statement] | 3 | Design and implementation of machine-learning models and data pipelines |
| PSO2 [department PSO statement] | 3 | Full-stack web development and cloud deployment of the live platform |
| PSO3 [department PSO statement] | 2 | Research methods: literature review, reproducible experiments and a paper draft |

@appendix F | Similarity and AI-Generated Report

The similarity report is attached separately. Similarity index: [to be filled from the plagiarism-check report].

AI assistance was used in this project. An AI coding assistant (Claude, by Anthropic) helped write and test parts of the code, the figure scripts, and drafts of the documentation and this report. The team reviewed, ran and checked this work, and the team takes responsibility for it. No result was produced by the assistant: every number comes from the project's own run files. The live platform's LLM analyst (Amazon Nova Micro, Groq models) generates the insight cards shown on the dashboard, and these are labelled as AI-generated.
