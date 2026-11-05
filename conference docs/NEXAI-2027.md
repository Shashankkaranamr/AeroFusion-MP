# NEXAI 2027: International Conference on Next-Generation AI & Agentic Intelligence

- **Site:** https://nexai2027.ncuindia.edu/
- **Submission (CMT):** https://cmt3.research.microsoft.com/NEXAI2027
- **Contact:** nexai2027@ncuindia.edu
- **Venue:** The NorthCap University, Sector 23-A, Gurugram, Haryana. Held 4–5 Mar 2027, hybrid.
- **Publisher:** **Springer LNNS** (proceedings proposal approved; LNNS is Scopus-indexed), subject to Springer's quality checks.

## Important dates (all 23:59 IST)
| Step | Date |
|---|---|
| Submission portal opens | 12 Oct 2026 |
| **Full paper deadline** | **22 Nov 2026** |
| Acceptance notification | by **1 Jan 2027** (rolling, so it can arrive in December) |
| Camera-ready | 25 Jan 2027 |
| Registration closes | 31 Jan 2027 |

**Fee (student / research scholar, incl. GST):** ₹7,500 early bird (to 25 Jan), ₹8,500 regular. Extra page ₹1,000.
There are no refunds. One registration form per accepted paper, with the Paper ID, payment proof and student ID.

## Submission process
1. Microsoft CMT only, **PDF only**.
2. Enter the title, abstract and keywords, choose the track (below) and upload the anonymised PDF.
3. Review is **double-blind**: no author names, affiliations, emails or identifying acknowledgments in the PDF.
   At least two reviewers judge originality, technical soundness and relevance. Plagiarism is checked.
4. There is **no abstract-only or extended-abstract route**: papers under 4 pages are not considered.

## Format
- **10–12 pages** including figures, tables and references, in the **LNNS single-column** layout.
- Use the conference templates from the site: `NEXAI_LNNS_LaTex_Template-1.zip` (LaTeX) or the Word version, plus
  `NEXAI2027_Manuscript_Preparation_Guidelines.pdf`.

## Track to choose
- **Primary:** *01 Advances in AI, ML & Deep Learning*. It lists deep learning architectures, graph neural networks
  and geometric deep learning, and explainable and interpretable AI, which together match our model.
- **Alternative:** *07 AI Applications for Society and Industry*, under "climate, environment and sustainability".

## Tailored title
**Interpretable Wavelet–Graph Deep Learning for PM2.5 Forecasting: Validated Source-Group Attribution over 116 Indian Stations**

*Why this angle:* NEXAI is an AI-methods venue with explicit GNN and explainable-AI topics. The title leads with the
architecture and with the part reviewers there will care about most: an attribution mechanism whose explanations are
*tested*, not just shown.

## Abstract (≈ 210 words)
> Deep spatio-temporal models are increasingly used for air-quality forecasting, but their explanations are rarely
> tested and their gains are seldom measured against operational forecasts under realistic inputs. We present
> MW-AeroFusion-Net, a hybrid deep architecture for 48-hour station-level PM2.5 forecasting that combines causal
> wavelet bands, a wind-aware adaptive diffusion graph over stations and upwind source regions, a ConvLSTM over gridded
> meteorology, fire and CAMS fields, a Transformer temporal encoder, and a source-group attribution gate with an
> entropy penalty that weights seven input groups per station (pollutant history, traffic proxy, meteorology, fire,
> CAMS, dust and calendar). The model is
> built rung by rung, so each component's contribution is measured, with leave-one-out ablations over five seeds. We
> evaluate the gate's learned attribution with deletion tests, weight randomisation, seed stability and physical
> plausibility, and report whether each check passes. Experiments use 116 CPCB stations in 28 Indian cities under a
> leakage-safe protocol: every input respects its publication latency, and the 2023–2024 test years are opened once
> after model freeze. Baselines include persistence, climatology, raw and bias-corrected CAMS forecasts, LightGBM and
> five neural models. [RESULTS: headline error/skill at +24 and +48 h from `tables/test_sa_station`; which
> components helped; whether the attribution checks passed.]

**Keywords:** graph neural networks, explainable AI, wavelet transform, ConvLSTM, Transformer, PM2.5 forecasting, air quality

## Changes needed from our IEEE draft
- Port to the NEXAI LNNS LaTeX template. Aim for 11–12 pages, since the single column gives room to expand the
  Method and Attribution Validation sections, which this venue cares about most.
- Move the attribution-validation section earlier or give it more space, and add a gate-weight figure
  (`make_figures.py`). Lead the Introduction with the explainability question, not the CAMS benchmark.
- Anonymise: no authors, no acknowledgment, no repository URL in the review copy.
- The seven gate groups above match `docs/paper/main.tex` §Method and `ml/configs/features_v1.yaml`. Re-check them
  if the feature set changes at feature freeze.
