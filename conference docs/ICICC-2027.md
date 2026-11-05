# ICICC-2027: International Conference on Innovative Computing and Communication

- **Site:** https://www.icicc-conf.com/
- **Submission (CMT):** https://cmt3.research.microsoft.com/ICICC2027
- **Venue:** Shaheed Sukhdev College of Business Studies, University of Delhi, Rohini, Delhi. Held 5–6 Feb 2027, hybrid.
- **Publisher:** proceedings in the **Springer LNNS** series (the site states "Approved"; LNNS is Scopus-indexed).
  Extended versions of selected papers are invited to journal special issues.
- **Theme:** "Technology-Driven Innovations for Society, Industry & Sustainable Futures".

## Important dates
| Step | Date |
|---|---|
| Paper submission deadline | **25 Nov 2026** |
| Notification of first review | 10 Dec 2026 |
| Revised manuscript | 20 Dec 2026 |
| Acceptance / rejection | **25 Dec 2026** |
| Registration deadline | 30 Dec 2026 |
| Final (camera-ready) manuscript | 10 Jan 2027 |

**Fee (Springer track, research scholar/student):** ₹12,000 before 25 Nov, ₹13,000 after. At least one author must
register for the paper to appear.

## Submission process
1. Create a Microsoft CMT account and select *International Conference on Innovative Computing and Communication (ICICC-2027)*.
2. Under **Create New Submission**, enter the title, abstract and keywords (below) and upload the PDF.
3. Review is **double-blind**: no names, affiliations, emails, acknowledgment or self-identifying repository URL in the PDF.
4. Camera-ready: PDF **and** source (LaTeX), plus the signed Springer copyright form (CTP) from the organisers.

## Format
- Springer LNNS template, A4, **not more than 10 pages**. Extra pages may be charged.
- Springer LNNS referencing style.
- No plagiarism or self-plagiarism, and permission is needed for any copyrighted figure.

## Tailored title
**MW-AeroFusion-Net: Fusing Satellite, Reanalysis and Ground-Station Data for Leakage-Safe 48-Hour PM2.5 Forecasting in Indian Cities**

*Why this angle:* ICICC is a broad "innovative computing for society and sustainable futures" venue. The title leads
with the computing contribution (multi-source data fusion) and the societal use (city-level health advisories).

## Abstract (≈ 200 words; Springer asks for 150–250)
> Fine particulate matter (PM2.5) is the dominant air-quality risk in Indian cities, and health advisories need
> station-level forecasts one to two days ahead. We present MW-AeroFusion-Net, a forecasting system that fuses hourly
> ground-station measurements from 116 Central Pollution Control Board stations in 28 cities with reanalysis
> meteorology, satellite fire detections and Copernicus Atmosphere Monitoring Service (CAMS) forecasts. The model
> combines causal wavelet bands, a wind-aware adaptive diffusion graph over stations and upwind source regions, a
> ConvLSTM over gridded fields, a Transformer temporal encoder and source-group attribution gating. Every input respects
> its real publication latency at issue time, normalisation is fitted on training data only, and the 2023–2024 test
> years are read once, after the model is frozen. We compare the system with persistence, climatology, raw and
> bias-corrected CAMS forecasts, LightGBM and five neural baselines at +1, +24 and +48 h.
> [RESULTS: one or two sentences from `tables/test_sa_station` and `test_sb_station`: error and skill versus
> persistence and bias-corrected CAMS at +24/+48 h.] A component-by-component ablation [RESULTS: which components
> helped], and the learned attribution is checked with deletion, randomisation and plausibility tests. Code,
> configurations and the station panel are released.

**Keywords:** PM2.5 forecasting, multi-source data fusion, graph neural networks, wavelet, ConvLSTM, air quality, India

## Changes needed from our IEEE draft
- Port `docs/paper/main.tex` to the Springer LNNS LaTeX class (`llncs`-style). Our 6 IEEE pages come to about
  10 LNNS pages, so check the 10-page cap after the tables are in. Trim Related Work first if over.
- Anonymise: remove the author block, the acknowledgment and the repository URL footnote (say "released on acceptance").
- Convert the bibliography to Springer style (`splncs04`).
