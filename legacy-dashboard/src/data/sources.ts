export type SourceStatus = "core" | "benchmark" | "optional" | "bootstrap";

export interface DataSource {
  id: string;
  name: string;
  provider: string;
  description: string;
  variables: string[];
  cadence: string;
  resolution: string;
  license: string;
  access: string;
  role: string;
  status: SourceStatus;
  color: string;
  url: string;
}

/**
 * Data sources used (or planned) by MW-AeroFusion-Net. Status is honest: "core" sources feed the
 * model; "benchmark" sources are used only for comparison; "optional" ones are stretch goals.
 */
export const SOURCES: DataSource[] = [
  {
    id: "cpcb",
    name: "CPCB CAAQMS",
    provider: "Central Pollution Control Board · via OpenAQ v3",
    description: "Hourly PM2.5, PM10 and AQI from India's continuous ambient air-quality monitoring stations — the forecasting target.",
    variables: ["PM2.5", "PM10", "AQI"],
    cadence: "Hourly",
    resolution: "Station points",
    license: "Govt. open data (GODL-India)",
    access: "OpenAQ API key (free) · S3 archive",
    role: "Target + lagged inputs",
    status: "core",
    color: "#10b981",
    url: "https://openaq.org",
  },
  {
    id: "met",
    name: "ERA5 / IMD meteorology",
    provider: "ECMWF ERA5 via Open-Meteo · IMD where available",
    description: "Temperature, humidity, wind (u/v), boundary-layer height and pressure — the dispersion drivers.",
    variables: ["Temp", "RH", "Wind u/v", "PBLH", "Pressure"],
    cadence: "Hourly",
    resolution: "≈ 0.25° grid",
    license: "Copernicus licence / CC BY 4.0 (Open-Meteo)",
    access: "No key needed",
    role: "Graph & ConvLSTM inputs",
    status: "core",
    color: "#0ea5e9",
    url: "https://open-meteo.com",
  },
  {
    id: "firms",
    name: "NASA FIRMS",
    provider: "VIIRS (S-NPP, NOAA-20) & MODIS active fires",
    description: "Satellite fire detections, binned into grid cells and summed upwind — the stubble-burning signal.",
    variables: ["Fire count", "FRP", "Confidence"],
    cadence: "≈ 3 h (NRT)",
    resolution: "375 m / 1 km",
    license: "NASA open data",
    access: "FIRMS MAP_KEY (free)",
    role: "Upwind-fire feature + raster",
    status: "core",
    color: "#f97316",
    url: "https://firms.modaps.eosdis.nasa.gov",
  },
  {
    id: "calendar",
    name: "Calendar & activity proxies",
    provider: "Hour-of-week, holidays, festivals (Diwali)",
    description: "No free India-wide traffic feed exists, so time-of-day / day-of-week / festival indicators act as documented proxies.",
    variables: ["Hour", "Weekday", "Holiday", "Festival"],
    cadence: "Hourly",
    resolution: "National",
    license: "Public calendars",
    access: "Generated",
    role: "Traffic & activity proxy",
    status: "core",
    color: "#a855f7",
    url: "https://www.india.gov.in/calendar",
  },
  {
    id: "static",
    name: "Static auxiliary layers",
    provider: "WorldPop · ESA WorldCover · OpenStreetMap · EDGAR",
    description: "Population, land use, road density and emission inventories per node — slow-changing context features.",
    variables: ["Population", "Land use", "Roads", "Industry"],
    cadence: "Yearly",
    resolution: "100 m – 0.1°",
    license: "CC BY 4.0 / ODbL",
    access: "Download once",
    role: "Static node features",
    status: "core",
    color: "#64748b",
    url: "https://www.worldpop.org",
  },
  {
    id: "cams",
    name: "CAMS global forecast",
    provider: "Copernicus Atmosphere Monitoring Service via Open-Meteo",
    description: "Modelled PM2.5 forecasts (~45 km). Used only as an external benchmark — never as ground truth.",
    variables: ["PM2.5 (modelled)"],
    cadence: "Hourly",
    resolution: "≈ 0.4°",
    license: "CAMS licence · attribution required",
    access: "No key (non-commercial)",
    role: "Benchmark only",
    status: "benchmark",
    color: "#3b82f6",
    url: "https://atmosphere.copernicus.eu",
  },
  {
    id: "aod",
    name: "Satellite AOD",
    provider: "MODIS MAIAC · Sentinel-5P",
    description: "Aerosol optical depth as a gridded proxy where stations are sparse. Stretch goal after the core model.",
    variables: ["AOD", "Aerosol index"],
    cadence: "Daily",
    resolution: "1 km",
    license: "NASA / Copernicus open data",
    access: "Earthdata login",
    role: "Optional raster channel",
    status: "optional",
    color: "#eab308",
    url: "https://modis.gsfc.nasa.gov",
  },
  {
    id: "kaggle",
    name: "Air Quality Data in India (2015–2020)",
    provider: "Kaggle · CPCB historical export",
    description: "Hourly station data for 26 cities used to bootstrap the pipeline and baselines before recent years are fetched.",
    variables: ["PM2.5", "PM10", "NO₂", "SO₂", "CO", "O₃"],
    cadence: "Hourly (historical)",
    resolution: "Station points",
    license: "See dataset page",
    access: "Kaggle account",
    role: "Pipeline bootstrap",
    status: "bootstrap",
    color: "#14b8a6",
    url: "https://www.kaggle.com/datasets/rohanrao/air-quality-data-in-india",
  },
];

export const STATUS_LABEL: Record<SourceStatus, string> = {
  core: "Core input",
  benchmark: "Benchmark only",
  optional: "Optional",
  bootstrap: "Bootstrap",
};
