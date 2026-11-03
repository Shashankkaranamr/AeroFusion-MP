# Draft letter: request for GPU computing resources

> Fill in everything in `[square brackets]` before sending, and get the guide's signature first.
> Every figure in this letter is either a measurement made on our code or a planning estimate labelled as one.
> **Don't add accuracy or result numbers.** The model has not been trained yet, and the project's integrity rules
> forbid quoting results that don't exist.

---

**From**
[Student 1 name] ([USN])
[Student 2 name] ([USN])
[Student 3 name] ([USN])
[Student 4 name] ([USN])
B.E. Computer Science and Engineering, [semester] semester, Major Project Group 40
B.M.S. College of Engineering, Bengaluru

**To**
The Head of the Department
Department of Computer Science and Engineering
B.M.S. College of Engineering, Bengaluru

**Through**
[Guide name], [designation], Project Guide

**Date:** [dd Month 2026]

**Subject:** Request for access to a GPU computing system for training the MW-AeroFusion-Net air-quality forecasting model (Major Project, Group 40)

Respected Sir/Madam,

We are the students of Major Project Group 40, working under the guidance of [Guide name] on **"AeroFusion /
MW-AeroFusion-Net: multi-source deep learning for PM2.5 forecasting over Indian cities."** We are writing to ask for
access to a GPU-equipped system in the department for the model-training phase of our project, from
**[7 December 2026] to [24 January 2027]**.

**1. About the project**

The project has two parts:

- **AeroFusion**, a live air-quality monitoring platform that is already built and deployed. It tracks PM2.5 for 33
  Indian cities. Every 12 hours it combines CAMS atmospheric-composition data, weather, NASA FIRMS satellite fire
  detections and CPCB station data, and shows them in a public web dashboard.
- **MW-AeroFusion-Net**, the forecasting model we proposed. It combines wavelet decomposition, an adaptive diffusion
  graph between cities, a ConvLSTM over gridded satellite and weather fields, a Transformer temporal encoder, and
  source-group attribution gating. It forecasts PM2.5 1, 24 and 48 hours ahead at 116 CPCB monitoring stations.

The data pipeline, the evaluation framework and the code for every model component are written and pass automated
tests. We have built a station dataset covering December 2017 to September 2025 (116 stations, 138 graph nodes,
29 features per node per hour). We also plan to submit an IEEE conference paper with BMS College of Engineering as the
affiliation, and to release the code and benchmark publicly.

**2. Why our present computers are not enough**

We have tried to run the work on our own laptops. A typical one has 16 GB RAM and a 4 GB laptop GPU. We ran into the
following problems:

- **Training speed.** We timed one training step of the full model (batch of 32 samples) on a laptop CPU at about
  **24 seconds**. One pass over the training data would take many hours, and the project needs many such passes for
  every experiment.
- **Memory.** Downloading the satellite and reanalysis data and building the dataset repeatedly ran the laptop out of
  memory, and the jobs were killed. We had to pause the data download in October 2026 for this reason.
- **GPU memory.** The ConvLSTM branch processes a 44 × 43 grid over India. We estimate it needs about 6–12 GB of GPU
  memory at batch 32, more than a 4 GB laptop GPU provides.
- **Length of runs.** Training jobs run for hours and must not be interrupted. A personal laptop that is also used
  for classes cannot run overnight reliably.

**3. Why so many training runs are needed**

A credible evaluation means comparing against strong baselines and showing what each component contributes. Our
experiment plan has:

- 7 incremental model versions, adding one component at a time;
- 5 published neural baselines (LSTM, CNN-LSTM, ConvLSTM, PM2.5-GNN, Graph WaveNet), plus LightGBM and CAMS
  bias-correction baselines;
- 6 ablation studies, removing one component at a time;
- 3 input settings, each repeated with 5 random seeds for statistical significance tests.

Our planning estimate is **80–150 training runs, about 150–300 GPU-hours on a T4-class GPU, or about 50–100 hours
on an RTX 4090-class GPU.** Most of it falls between December 2026 and January 2027.

**4. What we are requesting (in order of preference)**

1. **SSH access to an existing department GPU server** with at least 16 GB of GPU memory. We would need about
   **15 hours per week** reserved between [7 December 2026] and [24 January 2027], with permission to run jobs
   overnight. Access for 4 user accounts.
2. If no shared server is available, **a workstation in the lab** with:
   - GPU: 1 × NVIDIA RTX 4090 24 GB (or RTX 3090 / RTX A5000 24 GB; at least 16 GB, such as an RTX 4080 or A4000)
   - CPU and memory: 12–16 cores, 64 GB RAM (at least 32 GB)
   - Storage: about 150 GB of free SSD/NVMe space (a 2 TB NVMe if a new system is configured)
   - Software: Ubuntu 22.04 or 24.04 with NVIDIA CUDA 12.x drivers
   - Network: outbound internet access to Copernicus, NASA, GitHub and Python package servers

**5. Our commitments**

- We will use the system only for this project. All software we install stays in our own user directory; we need no
  administrator rights after the NVIDIA driver is set up.
- We will follow lab rules and the booking schedule, and release the GPU as soon as our jobs finish.
- Everything we use is open data (CPCB via XKDR Forum, ECMWF ERA5, Copernicus CAMS, NASA FIRMS) and open-source
  software. No licensed software is required.
- We will acknowledge the department's computing support in the paper and the project report.
- We will keep a log of GPU-hours used and share it with the department at the end of the project.

Without GPU access we would have to fall back on free online notebooks (Kaggle, about 30 GPU-hours per person per
week, with session limits). That would force us to cut the evaluation down, coarsening the grid and using fewer seeds,
and would weaken both the project and the paper.

We would be grateful if the department could consider this request. We are happy to meet the lab in-charge to
discuss scheduling or any technical details.

Thanking you,

Yours sincerely,

| Name | USN | Signature |
|---|---|---|
| [Student 1] | [USN] | |
| [Student 2] | [USN] | |
| [Student 3] | [USN] | |
| [Student 4] | [USN] | |

**Recommended and forwarded by**

[Guide name]
[Designation], Department of CSE, BMSCE
Signature: ____________________  Date: __________

---

### Before sending
- [ ] Names, USNs, semester, guide name and designation filled in
- [ ] Dates checked against the college calendar (exams, reviews), and the window moved if exams overlap
- [ ] Guide has read it and signed
- [ ] Ask the lab in-charge in person which servers exist, so you can name the specific machine in point 4.1
- [ ] Optional attachment: one page with the platform URL and a screenshot of the live dashboard
- [ ] Keep a signed copy and note the date it was submitted in `PROGRESS.md` §9
