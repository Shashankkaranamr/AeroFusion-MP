@front Abstract

Fine particulate matter (PM2.5) is the air pollutant with the largest health burden in India, and city residents, hospitals and local agencies need forecasts for the next one to two days at the stations where people live. Global chemistry-transport forecasts such as the Copernicus Atmosphere Monitoring Service (CAMS) cover the whole country, but at about 40 km resolution and without correction to the Central Pollution Control Board (CPCB) monitors. This project has two parts. The first is AeroFusion, a live monitoring platform for 33 Indian cities. A FastAPI backend fuses CAMS forecasts, Open-Meteo weather, NASA FIRMS fire detections, NASA GIBS imagery and the CPCB archive every 12 hours, and a React dashboard shows the result on a map, per city and over time. A language-model analyst (Amazon Nova Micro, with Groq as fallback) explains the current drivers in plain words. The platform is deployed and in use.

The second part is MW-AeroFusion-Net, a station-level PM2.5 forecaster for 1 to 48 hours ahead. It combines a causal stationary wavelet transform computed inside each 72-hour input window, source-group attribution gating over seven input groups, a causal Transformer encoder, a ConvLSTM over gridded meteorology, fire and CAMS fields, and a wind-aware adaptive diffusion graph over 116 CPCB stations in 28 cities and 17 upwind regions. The evaluation protocol was fixed before any model was trained. Training covers 2018 to 2021 and validation 2022. The 2023 to 2024 test years are locked by checksum and read once, by one script, after the team freezes the model. Every input respects its real publication delay, and every result is read from run files rather than typed by hand.

On the 2022 validation year, gradient boosting and simple recurrent models are hard to beat. The full MW-AeroFusion-Net has a higher error than its own smaller rungs at every lead, most clearly at one hour ahead, and the five-seed ablation runs that separate the cause are in progress. The report states these validation results as measured, describes the full system design, and leaves the test-set results for the final evaluation after model freeze.

**Keywords:** PM2.5 forecasting, graph neural networks, wavelet transform, ConvLSTM, CAMS, air-quality monitoring, India

@front Acknowledgment

We thank the Chairperson of the B.M.S. Educational Trust and Dr. Bheemsha Arya, Principal, B.M.S. College of Engineering, for the facilities that made this project possible. We thank Dr. Shubha Rao V, Professor and Head of the Department of Computer Science and Engineering, for support and encouragement throughout the project.

We are grateful to our guide, Pallavi C V, Assistant Professor, Department of CSE, for guidance and regular reviews throughout the project. We also thank the faculty and laboratory staff of the department, and everyone who gave us access to the GPU workstation used for the training runs.

The project uses open data from several organisations. We acknowledge the India Air Quality Database of the XKDR Forum (CPCB CAAQM and US Department of State monitors, CC BY 4.0), the Copernicus Atmosphere Monitoring Service and the Copernicus Climate Change Service (this report contains modified Copernicus information, 2026), Open-Meteo, and NASA's Fire Information for Resource Management System (FIRMS) and GIBS imagery services.

Shashank Ravindra (1BM23CS312)

Sohan R (1BM23CS336)

Srinidhi B V (1BM23CS339)

Srujan K R (1BM23CS340)
