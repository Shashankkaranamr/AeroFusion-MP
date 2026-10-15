# Data sources: licences and attribution (PROGRESS P6.2)

Checked 2026-10-15. Release plan: publish **code, configs, download scripts, `stations_v1.csv`, `SPLITS.lock` and
checkpoints**. Do **not** publish raw or processed data from OpenAQ or the CAMS/ERA5 files themselves unless the row
below says it is allowed; the scripts let anyone rebuild the dataset.

| Source | Licence / terms (as checked) | Attribution to include | Redistribute processed data? |
|---|---|---|---|
| CPCB CAAQM + US State Dept (AirNow) via **XKDR India Air Quality Database** | "The compilation is released under Creative Commons Attribution 4.0"; "use it for anything, including commercial work" (airquality.xkdr.org) | "India Air Quality Database, XKDR Forum", together with CPCB CAAQM and US Department of State / AirNow | Yes under CC BY 4.0, with attribution |
| **CAMS** global atmospheric composition forecasts and EAC4 (Copernicus ADS) | CC-BY-4.0 (`license` link in the ADS catalogue entries, verified via API) | "Contains modified Copernicus Atmosphere Monitoring Service information [year]" + Inness et al. 2019 for EAC4 | Yes under CC BY 4.0; keep the Copernicus notice |
| **ERA5** single levels (Copernicus CDS) and ERA5 via Open-Meteo | CC-BY-4.0 (CDS catalogue, verified via API); Open-Meteo states CC BY 4.0 (**not re-checked here; confirm on open-meteo.com before release**) | "Contains modified Copernicus Climate Change Service information [year]" + Hersbach et al. 2020; credit Open-Meteo for the node series | Yes, with attribution |
| **NASA FIRMS** (MODIS, VIIRS S-NPP) | NASA open data; NASA asks for an acknowledgement when FIRMS data is redistributed, used for derived products or referenced in presentations, and that third parties receive the disclaimer | NASA's acknowledgement text from the Earthdata FIRMS page ("We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (FIRMS)…", with its LANCE/ESDIS attribution). Copy the exact current wording from that page into the paper | Derived per-node fire features: yes, with the acknowledgement |
| **OpenAQ** (CPCB stations, S8 prospective test) | API key required and not transferable; scraping forbidden; "Attribution to OpenAQ as the source data is also required"; users must comply with providers' own terms (docs.openaq.org/about/terms) | "OpenAQ" + the original provider (CPCB) | **No bulk redistribution**; publish scores and the collection script only |
| Calendar / Diwali dates | python-holidays 0.106 (MIT) | — | Yes |

Paper/report: add a Data Availability statement listing the scripts (`ml/scripts/download_all.py`,
`collect_openaq.py`, `build_v1.py`) and these attributions.

Sources checked: [XKDR India Air Quality API](https://airquality.xkdr.org), ADS/CDS catalogue API (licence links),
[OpenAQ terms](https://docs.openaq.org/about/terms), [NASA Earthdata FIRMS](https://www.earthdata.nasa.gov/data/tools/firms).
