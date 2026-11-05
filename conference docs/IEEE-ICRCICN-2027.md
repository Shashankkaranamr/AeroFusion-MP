# IEEE ICRCICN 2027: 8th IEEE International Conference on Research in Computational Intelligence and Communication Networks

- **Site:** https://icrcicn.in/
  - Call for papers: https://icrcicn.in/call-for-papers.html
  - Submission: https://icrcicn.in/submission.html
  - Registration: https://icrcicn.in/registration.html
- **Venue:** Kalyani Government Engineering College, Kalyani, West Bengal. Held 27–28 Feb 2027, hybrid.
- **Publisher:** IEEE conference record **#73691**. Accepted *and presented* papers go to IEEE CPP for IEEE Xplore
  (normally Scopus-indexed). Selected extended papers may go to SCI journal special issues.

## Important dates
| Step | Date |
|---|---|
| **Full paper submission** | **30 Nov 2026** |
| Notification of acceptance | 1 Feb 2027 |
| Final paper | 14 Feb 2027 |
| Early-bird registration and payment | 14 Feb 2027 |

**Fee (student author, Indian):** early ₹8,000 (IEEE member) / ₹8,500 (non-member); late ₹9,500 / ₹10,000.
Pages beyond 6 (max 2 more) cost ₹1,000 each. There are no refunds, and an accepted, registered paper can't be withdrawn.
The site says payment goes to "Acuminous Research Foundation"; confirm the account with the organisers before paying.

## Submission process
1. Microsoft CMT (link on the submission page), **PDF**.
2. The manuscript **must include the title, abstract, keywords, authors and affiliations with emails**, so review is
   not blind.
3. **Plagiarism:** check with licensed software (e.g. Turnitin) before submission. Overall similarity must be
   **≤ 10 %**, and no single source above 1 %.
4. Papers must follow the template exactly or they are not processed. Do not prefix author names with titles (Dr., Prof., etc.).
5. On acceptance: make the reviewers' corrections, submit the camera-ready version and the IEEE copyright form, then register.

## Format
- **Maximum 6 pages**, standard IEEE conference template (double column, 10 pt; Word US Letter or LaTeX).
  Our draft already uses `IEEEtran` conference mode.

## Topic to choose
*Computational Intelligence* (primary). *Remote Sensing and Geographical Information Systems* and
*IoT and Big Data Analytics* are also listed and fit our data sources.

## Tailored title
**A Computational-Intelligence Benchmark for PM2.5 Forecasting in India: Wavelet–Graph–ConvLSTM Fusion Evaluated against CAMS Forecasts**

*Why this angle:* ICRCICN's core scope is computational intelligence. The title presents the model as a
computational-intelligence method and keeps our main evaluation claim (a fair test against the operational CAMS
forecast) up front. It is closest to the current draft title, so almost no rewriting is needed.

## Abstract (≈ 200 words; IEEE limit 250)
> Station-level forecasts of fine particulate matter (PM2.5) one to two days ahead support public-health advisories in
> Indian cities, yet learned models are rarely compared with an operational chemistry-transport forecast under inputs
> that would be available at issue time. We present a leakage-safe benchmark over 116 Central Pollution Control Board
> stations in 28 cities, in which every input respects its publication latency and the 2023–2024 test years are read
> once, after model freeze. On it we evaluate MW-AeroFusion-Net, a computational-intelligence model that combines
> causal wavelet bands, a wind-aware adaptive diffusion graph over stations and upwind source regions, a ConvLSTM over
> gridded meteorology, fire and CAMS fields, a Transformer encoder and source-group attribution gating. We compare it
> with persistence, climatology, raw and bias-corrected CAMS global forecasts, LightGBM and five neural baselines at +1,
> +24 and +48 h, in a past-only and a CAMS-informed setting. [RESULTS: headline error and skill versus persistence and
> bias-corrected CAMS at +24/+48 h, with Diebold–Mariano significance.] A component ladder and leave-one-out ablations
> show [RESULTS: which components helped], and the learned attribution [RESULTS: passed/failed] faithfulness,
> randomisation and plausibility checks.

**Index Terms:** PM2.5 forecasting, computational intelligence, graph neural networks, wavelet, ConvLSTM, CAMS, air quality, India

## Changes needed from our IEEE draft
- Change the title. Keep the author block (not blind) and fill in names, affiliations and emails.
- Keep within 6 pages once the generated tables are in. Up to 2 extra pages are allowed at ₹1,000 each.
- Run a Turnitin check (the library or the guide can arrange it) and keep it under 10 % overall.
- Use US Letter, as the IEEE template page says, unless the CMT instructions specify A4.
