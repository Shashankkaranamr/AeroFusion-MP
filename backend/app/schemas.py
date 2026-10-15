"""API contract (Pydantic models). The frontend's typed client mirrors these shapes.

Every response that carries values includes ``data_mode`` so the UI can label provenance:
``"demo"`` = deterministic simulator, ``"model"`` = outputs of a logged MW-AeroFusion-Net run.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

DataMode = Literal["demo", "model"]


class Health(BaseModel):
    status: Literal["ok"] = "ok"
    data_mode: DataMode
    model: str = "MW-AeroFusion-Net"
    run_id: str | None = None
    version: str


class Station(BaseModel):
    slug: str
    name: str
    state: str
    lat: float
    lon: float
    region: str
    population_m: float
    stations: int


class Category(BaseModel):
    key: str
    label: str


class Weather(BaseModel):
    temp: float = Field(description="°C")
    rh: float = Field(description="% relative humidity")
    wind: float = Field(description="m/s")
    wind_dir: float = Field(description="degrees the wind blows FROM")
    pblh: float = Field(description="boundary-layer height, m")


class CityNow(BaseModel):
    slug: str
    name: str
    pm25: float
    aqi: int
    category: Category
    change_24h_pct: float
    peak_24h: float
    peak_lead_h: int
    weather: Weather


class Snapshot(BaseModel):
    data_mode: DataMode
    time_utc: str
    national_avg_pm25: float
    above_naaqs: int
    cities: list[CityNow]


class ForecastPoint(BaseModel):
    time_utc: str
    lead_h: int
    observed: float | None
    p10: float
    p50: float
    p90: float
    cams: float | None = Field(default=None, description="External CAMS benchmark — never ground truth")
    temp: float
    rh: float
    wind: float


class Forecast(BaseModel):
    data_mode: DataMode
    model: str
    run_id: str | None
    city: str
    issued_utc: str
    horizon_h: int
    points: list[ForecastPoint]


class Contribution(BaseModel):
    feature: str
    label: str
    value: float = Field(description="µg/m³ added to the base value")


class AttentionRow(BaseModel):
    feature: str
    label: str
    weights: list[float]


class SourceRegion(BaseModel):
    id: str
    name: str
    lat: float
    lon: float
    distance_km: float
    contribution: float = Field(description="% of the prediction")


class Explanation(BaseModel):
    data_mode: DataMode
    method: Literal["attention_gate", "shap", "simulated"]
    city: str
    time_utc: str
    base_value: float
    prediction: float
    contributions: list[Contribution]
    attention_lags_h: list[int]
    attention: list[AttentionRow]
    sources: list[SourceRegion]


class Edge(BaseModel):
    source: str
    target: str
    weight: float
    distance_km: float
    flux: float


class Graph(BaseModel):
    data_mode: DataMode
    time_utc: str
    edges: list[Edge]


class Hotspot(BaseModel):
    id: str
    lat: float
    lon: float
    frp: float
    confidence: Literal["high", "nominal", "low"]
    region: str


class Hotspots(BaseModel):
    data_mode: DataMode
    date_ist: str
    total: int
    points: list[Hotspot]


class WhatIfRequest(BaseModel):
    city: str = "delhi"
    horizon_h: int = Field(default=48, ge=1, le=72)
    vehicles: float = Field(default=0, ge=-100, le=100, description="% change")
    industry: float = Field(default=0, ge=-100, le=100)
    construction: float = Field(default=0, ge=-100, le=100)
    cropBurning: float = Field(default=0, ge=-100, le=100)
    wind: float = Field(default=0, ge=-5, le=5, description="Δ m/s")
    temperature: float = Field(default=0, ge=-10, le=10, description="Δ °C")
    humidity: float = Field(default=0, ge=-50, le=50, description="Δ %RH")


class WhatIfPoint(BaseModel):
    time_utc: str
    lead_h: int
    baseline: float
    baseline_p10: float
    baseline_p90: float
    scenario: float
    scenario_p10: float
    scenario_p90: float


class WhatIfResult(BaseModel):
    data_mode: DataMode
    engine: Literal["surrogate", "model"]
    city: str
    points: list[WhatIfPoint]
    summary: dict[str, float]


class HorizonMetrics(BaseModel):
    mae: float
    rmse: float
    r2: float


class LadderRow(BaseModel):
    rung: str
    model: str
    adds: str
    metrics: dict[str, HorizonMetrics]
    run_id: str | None = None
    ours: bool = False


class Metrics(BaseModel):
    status: Literal["pending", "measured"]  # measured = loaded from ml/runs/<run_id>/metrics.json
    note: str
    ladder: list[LadderRow]
