"""Live MW-AeroFusion-Net forecasts (PROGRESS P5.2). numpy + onnxruntime only; no torch, pandas or xarray on the server.

Serving model (ml/MODEL_FREEZE.json "serving_model"): the variant without source-group gating, as the mean of its five
seeds' forecasts. Each seed is an ONNX file exported by ml/aerofusion_ml/export_onnx.py with its train-fitted
normalisation (backend/app/ml/serving/seed*/).

Inputs are rebuilt here with the training contract (ml/aerofusion_ml/data/loader.py, torch_dataset.py):
  x_node [1, 72, 138, 29]  hours t0-72h .. t0-1h; z-scored with the train mean/std; missing -> 0 (the train mean)
  m_node [1, 72, 138, 29]  1 = value present
  x_grid [1, 24, 8, 44, 43] 3-hourly steps ending at or before t0-1h; z-scored; missing -> 0
  wind_uv [1, 138, 2]       mean raw u10/v10 of the last 6 hours
Live sources and the gaps against training (shown to users, see NOTES):
  weather   Open-Meteo forecast API (best-match models), hourly, past days  - training used ERA5 reanalysis
  CAMS      Open-Meteo air-quality API (CAMS global)                          - same model family as training
  fires     NASA FIRMS NRT 7-day CSV (MODIS + VIIRS S-NPP), 4 h latency rule  - as training
  calendar  computed                                                         - as training
  stations  NOT AVAILABLE live (CPCB data reaches public APIs days later)     - all station pollutants missing
  dust AOD  NOT AVAILABLE from the live CAMS source                           - missing
  grid      weather and CAMS fields interpolated from the 138 nodes (inverse distance); FIRMS FRP gridded directly
"""

from __future__ import annotations

import asyncio
import csv
import io
import json
import math
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import httpx
import numpy as np

from ..live.sources import redact

HERE = Path(__file__).resolve().parent
SERVING = HERE / "serving"
WINDOW, HORIZON, GRID_STEPS = 72, 48, 24
FIRE_LAG_H = 4          # windows.LAG_H["fire"] = FIRMS latency 3 h + 1
FRP_HIDE_H = 6          # torch_dataset.FRP_HIDE_H = FIRMS latency + 3
NEAR_KM, UPWIND_KM, UPWIND_HALF_DEG = 300.0, 500.0, 45.0
FIRMS = {
    "MODIS": "https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_South_Asia_7d.csv",
    "VIIRS": "https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_Asia_7d.csv",
}
MET_VARS = ["temperature_2m", "relative_humidity_2m", "wind_speed_10m", "wind_direction_10m", "surface_pressure",
            "precipitation", "boundary_layer_height"]
NOTES = [
    "Live station readings are not available to the server (CPCB data reaches public sources days later), so the model "
    "forecasts without recent measured PM2.5. Its live accuracy is therefore lower than the scores it earned in testing.",
    "Weather comes from Open-Meteo forecasts instead of the ERA5 reanalysis used in training; dust optical depth is not "
    "available live and is left out.",
    "Gridded weather and CAMS maps are interpolated from the model's 138 locations.",
]


def _contract() -> dict:
    return json.loads((SERVING / "contract.json").read_text(encoding="utf-8"))


class Ensemble:
    """The five ONNX seeds with their normalisation."""

    def __init__(self, root: Path = SERVING):
        self.members = []
        for d in sorted(root.glob("seed*")):
            if (d / "model.onnx").exists():
                self.members.append({"dir": d, "run_id": (d / "run_id.txt").read_text().strip(),
                                     "norm": json.loads((d / "norm_stats.json").read_text(encoding="utf-8")),
                                     "grid": json.loads((d / "grid_stats.json").read_text(encoding="utf-8")), "sess": None})

    def __len__(self):
        return len(self.members)

    def predict(self, raw: dict) -> np.ndarray:
        """raw: un-normalised x_node [72,N,F] (NaN = missing), x_grid [24,C,H,W], wind_uv [N,2]. Returns µg/m³ [48, N]."""
        import onnxruntime as ort

        preds = []
        wind = np.nan_to_num(raw["wind_uv"]).astype(np.float32)
        calm = np.hypot(wind[:, 0], wind[:, 1]) < 1e-2  # the wind-aligned graph divides by wind speed: 0 m/s gives NaN
        wind[calm] = [1e-2, 0.0]
        raw = {**raw, "wind_uv": wind}
        for m in self.members:
            if m["sess"] is None:
                m["sess"] = ort.InferenceSession(str(m["dir"] / "model.onnx"), providers=["CPUExecutionProvider"])
            nm = m["norm"]
            x = (raw["x_node"] - np.asarray(nm["x_mean"], np.float32)) / np.asarray(nm["x_std"], np.float32)
            g = (raw["x_grid"] - np.asarray(m["grid"]["mean"], np.float32)[None, :, None, None]) / np.asarray(m["grid"]["std"], np.float32)[None, :, None, None]
            feed = {"x_node": np.nan_to_num(x)[None].astype(np.float32), "m_node": np.isfinite(raw["x_node"])[None].astype(np.float32),
                    "x_grid": np.nan_to_num(g)[None].astype(np.float32), "wind_uv": np.nan_to_num(raw["wind_uv"])[None].astype(np.float32)}
            used = {i.name for i in m["sess"].get_inputs()}
            z = m["sess"].run(["pred"], {k: v for k, v in feed.items() if k in used})[0][0]  # [48, N]
            v = z * nm["y_std"] + nm["y_mean"]
            preds.append(np.expm1(v) if nm["log_target"] else v)
        return np.mean(preds, axis=0)


# ───────────────────────── input builders ─────────────────────────

def issue_time(now: datetime) -> datetime:
    """Newest 00/12 UTC issue time at or before now."""
    t = now.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
    return t - timedelta(hours=t.hour % 12)


def hours(t0: datetime) -> list[datetime]:
    return [t0 - timedelta(hours=WINDOW - i) for i in range(WINDOW)]  # t0-72h .. t0-1h


def calendar(times: list[datetime], cal: dict) -> np.ndarray:
    """[T, 9] in the features_v1 order weekday, holiday, hour_sin, hour_cos, doy_sin, doy_cos, diwali, stubble, lockdown."""
    hol = set(cal["holidays"])
    lo, hi = cal["diwali_window_days"]
    win = {date.fromisoformat(d) + timedelta(days=k) for d in cal["diwali"] for k in range(lo, hi + 1)}
    s, e = cal["stubble_season"]["start"], cal["stubble_season"]["end"]
    ls, le = date.fromisoformat(cal["lockdown"]["start"]), date.fromisoformat(cal["lockdown"]["end"])
    out = []
    for t in times:
        loc = t.replace(tzinfo=None) + timedelta(hours=5, minutes=30)
        d = loc.date()
        hr = loc.hour + loc.minute / 60
        ndays = 366 if (d.year % 4 == 0 and (d.year % 100 != 0 or d.year % 400 == 0)) else 365
        doy = d.timetuple().tm_yday - 1
        mmdd = d.strftime("%m-%d")
        out.append([d.weekday(), float(d.isoformat() in hol), math.sin(2 * math.pi * hr / 24), math.cos(2 * math.pi * hr / 24),
                    math.sin(2 * math.pi * doy / ndays), math.cos(2 * math.pi * doy / ndays), float(d in win),
                    float(s <= mmdd <= e), float(ls <= d <= le)])
    return np.asarray(out, np.float32)


def _om_frame(js, times: list[datetime], keys: list[str]) -> np.ndarray:
    """Open-Meteo multi-location JSON -> [T, L, K] on our hour axis (NaN where absent)."""
    js = js if isinstance(js, list) else [js]
    idx = {t.strftime("%Y-%m-%dT%H:%M"): i for i, t in enumerate(times)}
    out = np.full((len(times), len(js), len(keys)), np.nan, np.float32)
    for li, loc in enumerate(js):
        h = loc.get("hourly", {})
        for ti, ts in enumerate(h.get("time", [])):
            i = idx.get(ts)
            if i is None:
                continue
            for k, key in enumerate(keys):
                v = h.get(key, [None] * (ti + 1))[ti]
                if v is not None:
                    out[i, li, k] = v
    return out


async def _om(client, om_get, target: str, lats, lons, keys: list[str], times: list[datetime], chunk: int = 100) -> np.ndarray:
    parts = []
    for i in range(0, len(lats), chunk):
        params = {"latitude": ",".join(f"{v:.4f}" for v in lats[i:i + chunk]), "longitude": ",".join(f"{v:.4f}" for v in lons[i:i + chunk]),
                  "hourly": ",".join(keys), "timezone": "GMT", "past_days": 4, "forecast_days": 1}
        if target == "forecast":
            params["wind_speed_unit"] = "ms"
        r = await om_get(client, target, params)
        r.raise_for_status()
        parts.append(_om_frame(r.json(), times, keys))
    return np.concatenate(parts, axis=1)


def _dist_bearing(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dl = np.radians(lon2 - lon1)
    a = np.sin((p2 - p1) / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    d = 2 * 6371.0 * np.arcsin(np.sqrt(np.clip(a, 0, 1)))
    b = np.degrees(np.arctan2(np.sin(dl) * np.cos(p2), np.cos(p1) * np.sin(p2) - np.sin(p1) * np.cos(p2) * np.cos(dl)))
    return d, (b + 360) % 360


async def fetch_fires(client: httpx.AsyncClient) -> list[tuple[float, float, float, datetime]]:
    """(lat, lon, frp, acquisition time UTC) of vegetation-fire detections, low confidence dropped (as fires.py)."""
    det = []
    for sensor, url in FIRMS.items():
        r = await client.get(url, timeout=60)
        r.raise_for_status()
        for row in csv.DictReader(io.StringIO(r.text)):
            conf = row.get("confidence", "")
            if (sensor == "VIIRS" and conf == "l") or (sensor == "MODIS" and conf.isdigit() and int(conf) < 30):
                continue
            if row.get("type") not in (None, "", "0"):
                continue
            acq = datetime.strptime(row["acq_date"] + row["acq_time"].zfill(4), "%Y-%m-%d%H%M").replace(tzinfo=timezone.utc)
            det.append((float(row["latitude"]), float(row["longitude"]), float(row.get("frp") or 0), acq))
    return det


def fire_slot(acq: datetime) -> datetime:
    """Slot t holds acquisitions in (t, t+1h] (windows.fire_slot)."""
    c = acq.replace(minute=0, second=0, microsecond=0)
    if acq > c:
        c += timedelta(hours=1)
    return c - timedelta(hours=1)


def fire_features(det, times, lat, lon, wind_from) -> np.ndarray:
    """[T, N, 3] fires_300km, frp_300km, fires_upwind_500km per hourly slot (fires.node_features); zero when no fire."""
    T, N = len(times), len(lat)
    out = np.zeros((T, N, 3), np.float32)
    pos = {t: i for i, t in enumerate(times)}
    by_slot: dict[int, list] = {}
    for la, lo, frp, acq in det:
        i = pos.get(fire_slot(acq))
        if i is not None:
            by_slot.setdefault(i, []).append((la, lo, frp))
    for i, rows in by_slot.items():
        a = np.asarray(rows)
        d, b = _dist_bearing(lat[:, None], lon[:, None], a[None, :, 0], a[None, :, 1])
        near = d <= NEAR_KM
        wf = wind_from[i][:, None]
        diff = np.abs((b - wf + 180) % 360 - 180)
        up = (d <= UPWIND_KM) & (diff <= UPWIND_HALF_DEG)
        out[i, :, 0] = near.sum(1)
        out[i, :, 1] = (near * a[None, :, 2]).sum(1)
        out[i, :, 2] = np.where(np.isnan(wind_from[i]), np.nan, up.sum(1))
    return out


def idw_grid(vals: np.ndarray, lat: np.ndarray, lon: np.ndarray, glat: np.ndarray, glon: np.ndarray, k: int = 4) -> np.ndarray:
    """vals [S, N] at nodes -> [S, H, W] by inverse-distance weighting of the k nearest nodes with data."""
    G = np.stack(np.meshgrid(glat, glon, indexing="ij"), -1).reshape(-1, 2)
    d, _ = _dist_bearing(G[:, :1], G[:, 1:2], lat[None, :], lon[None, :])  # [HW, N]
    out = np.full((vals.shape[0], len(G)), np.nan, np.float32)
    for s in range(vals.shape[0]):
        ok = np.isfinite(vals[s])
        if ok.sum() == 0:
            continue
        dd = d[:, ok]
        nn = np.argsort(dd, axis=1)[:, :k]
        w = 1.0 / np.maximum(np.take_along_axis(dd, nn, 1), 1.0) ** 2
        out[s] = (w * vals[s][ok][nn]).sum(1) / w.sum(1)
    return out.reshape(vals.shape[0], len(glat), len(glon))


async def build_inputs(t0: datetime, om_get, client: httpx.AsyncClient) -> tuple[dict, dict]:
    c = _contract()
    feats = c["feats"]
    nd = c["nodes"]
    lat, lon = np.asarray(nd["lat"]), np.asarray(nd["lon"])
    N, F = len(lat), len(feats)
    times = hours(t0)
    x = np.full((WINDOW, N, F), np.nan, np.float32)
    have = {}
    fi = {k: feats.index(k) for k in feats}

    met = None
    try:
        met = await _om(client, om_get, "forecast", lat, lon, MET_VARS, times)  # [T, N, 7]
        t2m, rh, ws, wd, ps, pr, blh = (met[..., k] for k in range(7))
        rad = np.deg2rad(wd)
        vals = {"t2m": t2m, "rh": rh, "u10": -ws * np.sin(rad), "v10": -ws * np.cos(rad), "wind_speed": ws, "pressure": ps,
                "precip": pr, "blh": blh, "ventilation": ws * blh}
        for k, v in vals.items():
            x[:, :, fi[k]] = v
        have["weather"] = float(np.isfinite(t2m).mean())
    except Exception as e:  # noqa: BLE001
        have["weather"] = f"failed: {type(e).__name__}"

    try:
        aq = await _om(client, om_get, "air", lat, lon, ["pm2_5", "aerosol_optical_depth"], times)
        x[:, :, fi["cams_pm25"]] = aq[..., 0]
        x[:, :, fi["cams_aod550"]] = aq[..., 1]
        have["cams"] = float(np.isfinite(aq[..., 0]).mean())
    except Exception as e:  # noqa: BLE001
        have["cams"] = f"failed: {type(e).__name__}"

    det = []
    try:
        det = await fetch_fires(client)
        wind_from = (met[..., 3] if met is not None else np.full((WINDOW, N), np.nan))
        ff = fire_features(det, times, lat, lon, wind_from)
        for k, j in zip(["fires_300km", "frp_300km", "fires_upwind_500km"], range(3)):
            x[:, :, fi[k]] = ff[..., j]
        hide = [i for i, t in enumerate(times) if t > t0 - timedelta(hours=FIRE_LAG_H)]
        for k in ["fires_300km", "frp_300km", "fires_upwind_500km"]:
            x[hide, :, fi[k]] = np.nan
        have["fires"] = len(det)
    except Exception as e:  # noqa: BLE001
        have["fires"] = f"failed: {type(e).__name__}"

    cal = calendar(times, c["calendar"])
    for j, k in enumerate(["weekday", "holiday", "hour_sin", "hour_cos", "doy_sin", "doy_cos", "diwali_window", "stubble_season", "lockdown"]):
        x[:, :, fi[k]] = cal[:, j][:, None]
    have["stations"] = "not available live"

    # grid: 24 three-hourly steps ending at the last 00/03/.. hour <= t0-1h
    g = c["grid"]
    glat = g["lat0"] + g["step"] * np.arange(g["nlat"])
    glon = g["lon0"] + g["step"] * np.arange(g["nlon"])
    last = t0 - timedelta(hours=1)
    last = last - timedelta(hours=last.hour % 3)
    gsteps = [last - timedelta(hours=3 * (GRID_STEPS - 1 - i)) for i in range(GRID_STEPS)]
    tpos = {t: i for i, t in enumerate(times)}
    sel = [tpos.get(t) for t in gsteps]
    xg = np.full((GRID_STEPS, 8, g["nlat"], g["nlon"]), np.nan, np.float32)
    for ch, key, add in [(0, "u10", 0), (1, "v10", 0), (2, "blh", 0), (3, "t2m", 273.15), (5, "cams_pm25", 0), (6, "cams_aod550", 0)]:
        v = np.full((GRID_STEPS, N), np.nan, np.float32)
        for s, i in enumerate(sel):
            if i is not None:
                v[s] = x[i, :, fi[key]] + add
        xg[:, ch] = idw_grid(v, lat, lon, glat, glon)
    frp = np.zeros((GRID_STEPS, g["nlat"], g["nlon"]), np.float32)
    gpos = {t: i for i, t in enumerate(gsteps)}
    for la, lo, f, acq in det:
        slot = fire_slot(acq)
        step = slot - timedelta(hours=slot.hour % 3)
        k = gpos.get(step)
        i = int(math.floor((la - (g["lat0"] - g["step"] / 2)) / g["step"]))
        j = int(math.floor((lo - (g["lon0"] - g["step"] / 2)) / g["step"]))
        if k is not None and 0 <= i < g["nlat"] and 0 <= j < g["nlon"]:
            frp[k, i, j] += f
    for s, t in enumerate(gsteps):
        if t > t0 - timedelta(hours=FRP_HIDE_H):
            frp[s] = np.nan
    xg[:, 4] = frp

    wind = np.nanmean(x[-6:, :, [fi["u10"], fi["v10"]]], axis=0) if met is not None else np.zeros((N, 2), np.float32)
    return {"x_node": x, "x_grid": xg, "wind_uv": np.nan_to_num(wind)}, have


class LiveForecaster:
    """Builds inputs and runs the ensemble once per issue time (00/12 UTC); results are cached in memory and on disk."""

    def __init__(self, cache_dir: Path | None = None):
        self.ens = Ensemble()
        self.cache_dir = cache_dir
        self.result: dict | None = None
        self.lock = asyncio.Lock()
        self.error: str | None = None
        if cache_dir and (cache_dir / "model_forecast.json").exists():
            try:
                self.result = json.loads((cache_dir / "model_forecast.json").read_text(encoding="utf-8"))
            except Exception:  # noqa: BLE001
                self.result = None

    @property
    def ready(self) -> bool:
        return len(self.ens) > 0

    async def ensure(self, om_get, now: datetime | None = None) -> dict | None:
        t0 = issue_time(now or datetime.now(timezone.utc))
        if self.result and self.result.get("issued_at") == t0.isoformat():
            return self.result
        async with self.lock:
            if self.result and self.result.get("issued_at") == t0.isoformat():
                return self.result
            try:
                async with httpx.AsyncClient(timeout=90) as client:
                    raw, have = await build_inputs(t0, om_get, client)
                pred = await asyncio.to_thread(self.ens.predict, raw)  # [48, N]
                self.result = self._package(t0, pred, have)
                self.error = None
                if self.cache_dir:
                    self.cache_dir.mkdir(parents=True, exist_ok=True)
                    (self.cache_dir / "model_forecast.json").write_text(json.dumps(self.result), encoding="utf-8")
            except Exception as e:  # noqa: BLE001
                self.error = redact(f"{type(e).__name__}: {e}")
        return self.result

    def _package(self, t0: datetime, pred: np.ndarray, have: dict) -> dict:
        nd = _contract()["nodes"]
        cities: dict[str, list[int]] = {}
        for i, (k, cs) in enumerate(zip(nd["kind"], nd["city_slug"])):
            if k == "station" and cs:
                cities.setdefault(cs, []).append(i)
        out = {}
        for cs, idx in cities.items():
            out[cs] = {"stations": len(idx), "pm25": [round(float(v), 1) for v in np.nanmean(pred[:, idx], axis=1)]}
        return {"issued_at": t0.isoformat(), "valid_times": [(t0 + timedelta(hours=h)).isoformat() for h in range(1, HORIZON + 1)],
                "model": "MW-AeroFusion-Net without source-group gating, mean of 5 seeds", "run_ids": [m["run_id"] for m in self.ens.members],
                "inputs": have, "notes": NOTES, "cities": out,
                "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
