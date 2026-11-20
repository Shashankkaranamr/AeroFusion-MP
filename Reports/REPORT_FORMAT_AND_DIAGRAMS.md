# Major Project report: format, headings and diagram list

Extracted on 20 Nov 2026 from the two samples in `Reports/sample report/`:
- **Format reference:** `format reference/project_report_final_revised (1).pdf` (Group 55, 76 pages, MS Word).
  It is the template we copy.
- **SDG reference:** `SDG reference/mp (1).pdf` (MeMOTR, 60 pages, LaTeX). It has the same chapter order and is
  used here only for the style of §1.5 SDG Justification.

Our project: **MW-AeroFusion-Net + AeroFusion live platform** (BMSCE CSE, Group 40).

---

## 1. Page format (measured from the format reference)

| Item | Setting |
|---|---|
| Paper | A4 (595 × 842 pt) |
| Font | Times New Roman throughout |
| Body text | 12 pt, justified, 1.5 line spacing, first-line indent on paragraphs after the first in a section |
| Chapter heading | "Chapter N  Title", bold, about 18 pt, centred, at the top of a new page |
| Section heading (1.1) | bold, 14 pt, left-aligned |
| Sub-section (1.1.1, 1.1.1.1) | bold, 12 pt |
| Margins | left ≈ 1.5 in (binding side), right ≈ 1 in, top and bottom ≈ 1 in |
| Header (every body page) | project title in italics, left-aligned, with a rule under it |
| Footer (every body page) | "Dept. of CSE, BMSCE" in italics on the left, "Page N" on the right, with a rule above |
| Page numbers | front matter in roman numerals (i, ii, …); body restarts at 1 with Chapter 1 |
| Figures | centred; caption **below**, "Figure 4.1: …", numbered per chapter |
| Tables | caption **above**, "Table 3.2: …", numbered per chapter; full grid lines |
| Algorithms | "Algorithm 1: …" boxes, listed in the List of Figures |
| Equations | numbered on the right, (5.1), (5.2), … |
| Citations | IEEE numeric [1], [2], in order of first use; list titled **REFERENCES** |
| Appendix figures and tables | numbered A.1, B.1, E.1, … |

### Front matter, in this order
1. **Title page.** Title (bold, about 22 pt), BMSCE logo, "PROJECT REPORT", *Submitted by*, Group Number: 40,
   names with USNs in two columns, *in partial fulfillment for the award of the degree of*, BACHELOR OF ENGINEERING,
   in COMPUTER SCIENCE AND ENGINEERING, *Under the Guidance of* guide name and designation, VTU/BMSCE logo,
   B.M.S. COLLEGE OF ENGINEERING, (Autonomous Institution under VTU), BENGALURU - 560019, Academic Year - 2026–2027.
2. **Certificate.** A bonafide-work paragraph naming the course "Major Project (23CS7PWPP2)", then External Viva
   (Examiner 1 and 2) and signature blocks for the Guide, the HOD (CSE Cluster _) and the Principal.
3. **Abstract** (one page).
4. **Declaration.** Students' declaration with a candidate table (Sl. No. / Name / USN / Signature), place and date,
   then the guide's certification paragraph.
5. **Acknowledgment.** Chairperson BMSET, Principal, HOD, guide, faculty, then the student names with USNs.
6. **Contents**, **List of Figures**, **List of Tables**.

---

## 2. Chapter headings (sample structure, adapted to our project)

The numbered headings are the sample's. The sub-headings in *italics* are suggestions for our content.

**1 Introduction**
- 1.1 Background of the Study: *PM2.5 in Indian cities, CPCB network, operational CAMS forecasts*
- 1.2 Research Motivation: *why station-level 1–48 h forecasts, and why leakage-safe evaluation*
- 1.3 Objective
- 1.4 Scope: *116 stations and 28 cities for the model; 33 cities for the live platform; 2018–2024 plus the 2025 PM-only check*
- 1.5 SDG Justification: *SDG 3 (Good Health: 3.9 air-pollution deaths), SDG 11 (Sustainable Cities: 11.6 urban air quality),
  SDG 13 (Climate Action) as a secondary link. Follow the sample's wording: potential contribution, no measured impact claimed.*
- 1.6 Existing System: *table of existing approaches (CAMS, statistical/LightGBM, LSTM, GNN models) with their limitations*
- 1.7 Proposed System: *AeroFusion live platform plus MW-AeroFusion-Net*
- 1.8 Work Plan: *timeline table (proposal → data → feature freeze → ladder → model freeze → final eval → paper)*

**2 Literature Survey**
- 2.1 Overview
- 2.2 Detailed Survey (summary table), with sub-sections such as *2.2.1 Chemistry-transport forecasts (CAMS);
  2.2.2 Statistical and gradient-boosted models; 2.2.3 Recurrent and Transformer models; 2.2.4 Graph neural networks
  for air quality; 2.2.5 Wavelet decomposition; 2.2.6 Interpretability and attribution*
- 2.3 Research Gaps
- 2.4 Mapping of Project Objectives with Research Gaps (table)

**3 Requirement Analysis and Specification**
- 3.1 Stakeholders
- 3.2 Functional Requirements
- 3.3 Non-Functional Requirements
- 3.4 System Requirements: 3.4.1 Hardware (*RTX PRO 4500 Blackwell, 32 GB*), 3.4.2 Software, 3.4.3 Cost Estimation
- 3.5 Data Requirements: *XKDR/CPCB, ERA5, CAMS, FIRMS, Open-Meteo, with licences*
- 3.6 Constraints and Limitations
- 3.7 Assumptions
- 3.8 Risks and Challenges: *Copernicus queue, power loss and restart-safe training, data gaps*

**4 Designs**
- 4.1 System Architecture Overview
- 4.2 Module/Component Design (module ↔ file mapping table)
- 4.3 Detailed Design: 4.3.1 System Actors and Use Cases; 4.3.2 System Classes and Their Relationships;
  4.3.3 Interaction Sequence (*live refresh pipeline and training pipeline*)
- 4.4 Data Design: *dataset_v1 zarr layout, station panel, grid fields, run artifacts*
- 4.5 Implementation Structure (repository structure)

**5 Methodology**
- 5.1 Tools and Techniques
- 5.2 Data Set with Explanation: *5.2.1 CPCB stations; 5.2.2 Meteorology (ERA5, Open-Meteo); 5.2.3 CAMS forecasts;
  5.2.4 FIRMS fires; 5.2.5 Splits and SPLITS.lock*
- 5.3 Flowchart of Methodology from Start to End
- 5.4 Explanation of Methodology in Detail with Equations and Formulae: *5.4.1 QC and latency-safe features;
  5.4.2 Causal wavelet bands; 5.4.3 Wind-aware adaptive diffusion graph; 5.4.4 ConvLSTM grid context;
  5.4.5 Transformer encoder; 5.4.6 Source-group gating with entropy penalty; 5.4.7 Masked Huber loss; 5.4.8 Complexity*
- 5.5 Experimental Setup: *research questions, baselines, settings S-A/S-B/S-C, model ladder M0–M6, ablations, metrics and
  Diebold–Mariano test, seeds*
- 5.6 Software Testing and Validation: *pytest suite, leakage and split-hash tests*

**6 Results and Discussion**
- 6.1 Presentation of Results: *test results S-A/S-B; ladder; ablations; by season and region; case studies; attribution checks*
- 6.2 Limitations of the Study

**7 Conclusion** (the SDG reference uses "Conclusion and Future Work" with 6.1/6.2; either is fine)

**REFERENCES**

**Appendices**
- Appendix A: Snapshots
- Appendix B: Details of List of Publications (*the ICICC-2027 submission*)
- Appendix C: Details of Patent (write "Not applicable" if none)
- Appendix D: Details of Funding (write "Not applicable" if none)
- Appendix E: POs and PSOs Mapped (two tables: PO1–PO11 and PSOs, each with Level 1/2/3 and a justification)
- Appendix F: Similarity and AI-Generated Report

---

## 3. Diagrams we need

The format reference has 6 design diagrams, 1 flowchart, 2 algorithms, 2 result figures and 4 snapshots.
Our project has two parts (a live platform and a model), so we need more.

**Status:** ✅ already exists · 🛠 to draw now · 📊 generated from runs after `final_eval.py` (never drawn by hand).

### Chapter 1: Introduction
| # | Diagram | Status / source |
|---|---|---|
| 1.1 | Map of India with the 116 CPCB stations (28 cities) and the 17 upwind source regions | 🛠 plot from `stations_v1.csv` and `cities.json` |
| 1.2 | Proposed system overview: live platform and forecasting model side by side | 🛠 |
| 1.3 | Work-plan Gantt chart (optional; the sample uses a table) | 🛠 |

### Chapter 4: Designs (the core of what the sample shows)
| # | Diagram | Status / source |
|---|---|---|
| 4.1 | **High-level system architecture** (layered: data sources → ingest/QC → feature store → model → API → dashboard) | 🛠 |
| 4.2 | **Detailed MW-AeroFusion-Net architecture** (wavelet, graph, ConvLSTM, Transformer, gating, 48-step head) | ✅ TikZ in `docs/paper/main.tex`; redraw at full page width |
| 4.3 | **Use-case diagram** (actors: citizen, analyst/researcher, project team, external data APIs, LLM service) | 🛠 |
| 4.4 | **UML class diagram** (`ml/`: datasets, models, trainer, evaluator; `backend/`: sources, service, ai) | 🛠 |
| 4.5 | **Sequence diagram, live pipeline** (12 h refresh: fetch → fuse → tensor → API → dashboard → AI insight) | 🛠 |
| 4.6 | **Sequence diagram, training pipeline** (download → build → train → validate → freeze → final_eval) | 🛠 |
| 4.7 | **Deployment diagram** (Render API, Vercel frontend, GPU training machine, Copernicus/XKDR/FIRMS/Open-Meteo, Bedrock/Groq) | 🛠 |
| 4.8 | **Data-flow diagram**, level 0 and level 1 | 🛠 |
| 4.9 | Data design: dataset_v1 layout (station tensor, grid tensor, masks, splits) | 🛠 |
| 4.10 | Repository structure | 🛠 tree diagram |

### Chapter 5: Methodology
| # | Diagram | Status / source |
|---|---|---|
| 5.1 | **Flowchart of the methodology from start to end** | 🛠 |
| 5.2 | Timeline of the data splits (train 2018–21, val 2022, frozen test 2023–24, PM-only 2025-04..09) | 🛠 |
| 5.3 | Issue-time latency diagram: what each source makes available at t0 | 🛠 |
| 5.4 | Data coverage heatmap (station × month availability) | 🛠 from dataset_v1, train and val years only |
| 5.5 | Causal wavelet (SWT) decomposition of one PM2.5 window | 🛠 train data only |
| 5.6 | Station graph with wind-aware edges (example day) | 🛠 |
| 5.7 | Model ladder M0 → M6 (component added at each rung) | 🛠 |
| 5.8 | Restart-safe training and watchdog (optional, supports "Risks") | 🛠 |
| Alg. 1 | Spike QC and latency-safe window construction | 🛠 algorithm box |
| Alg. 2 | Training with early stopping and resume | 🛠 algorithm box |

### Chapter 6: Results (only from run artifacts)
| # | Diagram | Status / source |
|---|---|---|
| 6.1 | Validation ladder chart (M0–M6 and baselines) | 📊 `make_figures.py` → `ladder_val.png` (val runs exist) |
| 6.2 | Learning curves: val RMSE per epoch (shows early best-epoch behaviour) | 📊 from the run logs |
| 6.3 | Test RMSE / skill vs lead time (+1…+48 h) per model, S-A and S-B | 📊 after `final_eval.py` |
| 6.4 | Ablation bar chart with 5-seed error bars | 📊 after the final runs |
| 6.5 | Error by season and IGP vs non-IGP | 📊 |
| 6.6 | Case studies: Delhi stubble-burning and Diwali periods | 📊 `make_figures.py --cases` |
| 6.7 | Observed vs predicted scatter | 📊 |
| 6.8 | Source-group gate weights (city × season heatmap) and the attribution checks | 📊 `explain.py` |

### Appendix A: Snapshots (screenshots of the live platform)
Story page (`index.html`); dashboard views **Now**, **Map**, **City**, **History**, **Why** (AI insight), **Data**,
and **What-if** (caption it "illustrative heuristic, not a model result"); the `/health` endpoint or API docs;
a training-log or terminal screenshot.

### Count
About **25 diagrams** to draw now and **8 result figures** generated after the final evaluation, plus about 8 snapshots.
The most important for marks (the ones the sample shows) are 4.1, 4.2, 4.3, 4.4, 4.5/4.6, 4.10 and 5.1.

---

## 4. Tables to carry over (the sample has 25)
Existing approaches; work plan; literature summary; gaps ↔ objectives; stakeholders; NFRs; hardware; software; cost;
risks; module mapping; data records (station, grid, run artifact); tools; data sources and licences; baselines;
hyper-parameters; unit tests; results tables (from `make_tables.py`); PO and PSO mapping.

## Integrity reminders (CLAUDE.md)
- Every number in Chapter 6 and the Abstract comes from `ml/runs/*/metrics.json` via `make_tables.py`. No test numbers
  until `final_eval.py` has run.
- Write "learned attribution", never "causal" or "% source contribution". The What-if view is labelled a heuristic.
- The format reference's abstract quotes its results. Ours waits for the final evaluation.
