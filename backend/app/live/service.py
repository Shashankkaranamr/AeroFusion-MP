"""Live ingestion service: periodic multi-source fetch → fusion → unified spatio-temporal tensor."""

from __future__ import annotations

import asyncio
import gzip
import json
import math
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
import numpy as np

from ..sim.core import CITIES
from . import sources as S

FEATURES = [
    ("pm25", "PM2.5 (CAMS)", "µg/m³", "cams"),
    ("pm10", "PM10 (CAMS)", "µg/m³", "cams"),
    ("aod", "Aerosol optical depth", "", "cams"),
    ("dust", "Dust", "µg/m³", "cams"),
    ("no2", "NO₂", "µg/m³", "cams"),
    ("co", "CO", "µg/m³", "cams"),
    ("temp", "Temperature", "°C", "weather"),
    ("rh", "Relative humidity", "%", "weather"),
    ("wind", "Wind speed", "m/s", "weather"),
    ("wind_u", "Wind u", "m/s", "weather"),
    ("wind_v", "Wind v", "m/s", "weather"),
    ("pressure", "Surface pressure", "hPa", "weather"),
    ("precip", "Precipitation", "mm", "weather"),
    ("pblh", "Boundary-layer height", "m", "weather"),
    ("fires_300km", "Fires ≤ 300 km", "count", "firms"),
    ("frp_300km", "Fire radiative power ≤ 300 km", "MW", "firms"),
    ("fires_upwind", "Upwind fires ≤ 500 km", "count", "firms"),
    ("cpcb_baseline", "CPCB same-month PM2.5 baseline", "µg/m³", "cpcb"),
    ("hour_sin", "Hour (sin)", "", "calendar"),
    ("hour_cos", "Hour (cos)", "", "calendar"),
]
FEATURE_KEYS = [f[0] for f in FEATURES]

SOURCE_META = {
    "cams": {"name": "CAMS air quality", "provider": "Copernicus via Open-Meteo", "kind": "Modelled PM2.5, PM10, AOD, dust, NO₂, CO", "key": False},
    "weather": {"name": "Open-Meteo weather", "provider": "ECMWF / GFS blend", "kind": "Temperature, humidity, wind, pressure, rain, PBLH", "key": False},
    "firms": {"name": "NASA FIRMS", "provider": "VIIRS NOAA-20 + S-NPP, last 24 h", "kind": "Active fires · FRP · confidence", "key": False},
    "gibs": {"name": "NASA GIBS", "provider": "Worldview imagery (WMS)", "kind": "True colour, thermal anomalies, aerosol", "key": False},
    "cpcb": {"name": "CPCB CAAQMS archive", "provider": "XKDR India Air Quality API", "kind": "Measured station PM2.5 (historical baseline)", "key": True},
    "calendar": {"name": "Calendar", "provider": "Local clock (IST)", "kind": "Hour-of-day encoding", "key": False},
}

HISTORY_MAX = 72  # time steps kept in the rolling tensor


def _window(times: list[str], vals: list, now: datetime, h0: int, h1: int) -> list:
    """Values whose hourly UTC timestamp lies within [now+h0, now+h1] hours."""
    out = []
    for t, v in zip(times, vals):
        try:
            dt = datetime.fromisoformat(t).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        d = (dt - now).total_seconds() / 3600
        if h0 <= d <= h1:
            out.append(v)
    return out


def _series(a: dict, w: dict) -> dict:
    """Hourly CAMS + weather aligned on the CAMS timestamps (UTC)."""
    times = a.get("hourly_time", [])
    wh = w.get("hourly", {}) or {}
    widx = {t: i for i, t in enumerate(wh.get("time", []))}

    def wcol(k):
        col = wh.get(k, [])
        return [col[widx[t]] if t in widx and widx[t] < len(col) else None for t in times]

    return {
        "time": [t + "Z" for t in times],
        "pm25": a.get("hourly_pm2_5", []),
        "pm10": a.get("hourly_pm10", []),
        "aod": a.get("hourly_aod", []),
        "temp": wcol("temperature_2m"),
        "rh": wcol("relative_humidity_2m"),
        "wind": wcol("wind_speed_10m"),
        "wind_dir": wcol("wind_direction_10m"),
        "pblh": wcol("boundary_layer_height"),
    }


class LiveService:
    def __init__(self, interval_s: int = 600, data_dir: Path | None = None):
        self.interval_s = interval_s
        self.data_dir = data_dir or Path(__file__).resolve().parents[2] / "data" / "processed"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        # Prospective-test archive: one frame + raw forecasts per refresh. Render's disk is ephemeral, so a cron
        # (.github/workflows/archive-snapshot.yml) also copies /api/live/snapshot to durable storage.
        self.archive_dir = Path(os.getenv("AEROFUSION_ARCHIVE_DIR") or self.data_dir.parent / "archive")
        self.api_key = os.getenv("XKDR_API_KEY")
        self.lock = asyncio.Lock()
        self.results: dict[str, S.SourceResult] = {}
        self.cpcb_cache: S.SourceResult | None = None
        self.cpcb_cached_at = 0.0
        self.snapshot: dict | None = None
        self.last_good: dict = {}
        self.last_good_at: dict[str, float] = {}
        self.wx_fetched_at = 0.0
        self.last_refresh: float | None = None
        self.refresh_count = 0
        self.history_x: list[np.ndarray] = []
        self.history_t: list[str] = []
        self._task: asyncio.Task | None = None

    # ── lifecycle ──
    def start(self):
        self._task = asyncio.create_task(self._loop())

    async def stop(self):
        if self._task:
            self._task.cancel()

    async def _loop(self):
        while True:
            try:
                await self.refresh()
            except Exception as e:  # noqa: BLE001
                print("live refresh failed:", e)
            await asyncio.sleep(self.interval_s)

    def next_refresh_in(self) -> int:
        if self.last_refresh is None:
            return 0
        return max(0, int(self.last_refresh + self.interval_s - time.time()))

    # ── refresh ──
    async def refresh(self) -> dict:
        async with self.lock:
            t0 = time.perf_counter()
            async with httpx.AsyncClient(timeout=45, headers={"User-Agent": "AeroFusion/0.1 (research dashboard)"}, follow_redirects=True) as client:
                # Weather changes slowly and the free API is rate-limited per IP: fetch it at most every 30 min.
                wx_prev = self.results.get("weather")
                need_wx = wx_prev is None or not wx_prev.ok or time.time() - self.wx_fetched_at > float(os.getenv("WEATHER_REFRESH_SECONDS", "1800"))
                tasks = [S.fetch_air_quality(client), S.fetch_fires(client), S.fetch_gibs(client)]
                if need_wx:
                    tasks.append(S.fetch_weather(client))
                # The CPCB archive changes monthly — refresh it at most every 12 h.
                need_cpcb = self.cpcb_cache is None or not self.cpcb_cache.ok or time.time() - self.cpcb_cached_at > 12 * 3600
                if need_cpcb:
                    tasks.append(S.fetch_cpcb_baseline(client, self.api_key))
                res = await asyncio.gather(*tasks)
            for r in res:
                prev = self.last_good.get(r.id)
                if r.ok:
                    self.last_good[r.id] = r
                    if r.id == "weather":
                        self.wx_fetched_at = time.time()
                elif prev is not None and time.time() - self.last_good_at.get(r.id, 0) < 6 * 3600:
                    # keep serving the last good data (marked stale) instead of dropping the source
                    r = S.SourceResult(id=prev.id, ok=True, records=prev.records, latency_ms=r.latency_ms, error=f"stale (last update failed: {(r.error or '')[:80]})", fetched_at=prev.fetched_at, data=prev.data)
                if r.ok and not (r.error or "").startswith("stale"):
                    self.last_good_at[r.id] = time.time()
                self.results[r.id] = r
            if need_cpcb:
                self.cpcb_cache = self.results["cpcb"]
                self.cpcb_cached_at = time.time()
            else:
                self.results["cpcb"] = self.cpcb_cache  # type: ignore[assignment]
            self.snapshot = self._fuse(int((time.perf_counter() - t0) * 1000))
            self.last_refresh = time.time()
            self.refresh_count += 1
            return self.snapshot

    # ── fusion ──
    def _fuse(self, took_ms: int) -> dict:
        aq = (self.results.get("cams").data if self.results.get("cams") and self.results["cams"].ok else {}) or {}
        wx = (self.results.get("weather").data if self.results.get("weather") and self.results["weather"].ok else {}) or {}
        fires = (self.results.get("firms").data if self.results.get("firms") and self.results["firms"].ok else []) or []
        base = (self.results.get("cpcb").data if self.results.get("cpcb") and self.results["cpcb"].ok else {}) or {}
        now = datetime.now(timezone.utc)
        ist_h = (now.hour + now.minute / 60 + 5.5) % 24

        rows = []
        X = np.full((len(CITIES), len(FEATURES)), np.nan, dtype=np.float32)
        for i, c in enumerate(CITIES):
            a = aq.get(c.slug, {})
            w = wx.get(c.slug, {})
            wd = w.get("wind_direction_10m")
            ws = w.get("wind_speed_10m")
            ff = S.fire_features(c, fires, wd)
            u = v = None
            if ws is not None and wd is not None:
                u = -ws * math.sin(math.radians(wd))
                v = -ws * math.cos(math.radians(wd))
            vals = {
                "pm25": a.get("pm2_5"),
                "pm10": a.get("pm10"),
                "aod": a.get("aerosol_optical_depth"),
                "dust": a.get("dust"),
                "no2": a.get("nitrogen_dioxide"),
                "co": a.get("carbon_monoxide"),
                "temp": w.get("temperature_2m"),
                "rh": w.get("relative_humidity_2m"),
                "wind": ws,
                "wind_u": u,
                "wind_v": v,
                "pressure": w.get("surface_pressure"),
                "precip": w.get("precipitation"),
                "pblh": w.get("boundary_layer_height"),
                **ff,
                "cpcb_baseline": base.get(c.slug, {}).get("pm25_mean"),
                "hour_sin": math.sin(2 * math.pi * ist_h / 24),
                "hour_cos": math.cos(2 * math.pi * ist_h / 24),
            }
            for j, k in enumerate(FEATURE_KEYS):
                if vals.get(k) is not None:
                    X[i, j] = float(vals[k])
            rows.append(
                {
                    "slug": c.slug,
                    "name": c.name,
                    "state": c.state,
                    "lat": c.lat,
                    "lon": c.lon,
                    **{k: (None if vals.get(k) is None else round(float(vals[k]), 3)) for k in FEATURE_KEYS},
                    "us_aqi": a.get("us_aqi"),
                    "wind_dir": wd,
                    "pm25_24h": _window(a.get("hourly_time", []), a.get("hourly_pm2_5", []), now, -24, 0),
                    "series": _series(a, w),
                    "cpcb": base.get(c.slug),
                    "observed_at": a.get("time"),
                }
            )

        # rolling (T, N, F) tensor, persisted for the model
        stamp = now.isoformat(timespec="seconds").replace("+00:00", "Z")
        self.history_x.append(X)
        self.history_t.append(stamp)
        self.history_x = self.history_x[-HISTORY_MAX:]
        self.history_t = self.history_t[-HISTORY_MAX:]
        T = np.stack(self.history_x)
        np.savez_compressed(
            self.data_dir / "live_tensor.npz",
            X=T,
            timestamps=np.array(self.history_t),
            cities=np.array([c.slug for c in CITIES]),
            features=np.array(FEATURE_KEYS),
        )
        self._archive(stamp, X)

        # z-scored view for the heatmap
        mu = np.nanmean(X, axis=0)
        sd = np.nanstd(X, axis=0)
        sd[sd == 0] = 1
        Z = np.clip((X - mu) / sd, -3, 3)
        coverage = float(np.isfinite(X).mean())

        return {
            "updated_at": stamp,
            "took_ms": took_ms,
            "interval_s": self.interval_s,
            "refresh_count": self.refresh_count + 1,
            "sources": self.sources_status(),
            "cities": rows,
            "fires": {"total": len(fires), "points": fires[:1500], "regions": S.fire_regions(fires)},
            "gibs": self.results["gibs"].data if self.results.get("gibs") and self.results["gibs"].ok else None,
            "tensor": {
                "shape": list(T.shape),
                "dims": ["time", "city", "feature"],
                "features": [{"key": k, "label": l, "unit": u, "source": s} for k, l, u, s in FEATURES],
                "cities": [c.slug for c in CITIES],
                "z": [[None if not np.isfinite(x) else round(float(x), 2) for x in row] for row in Z],
                "coverage": round(coverage, 4),
                "file": "backend/data/processed/live_tensor.npz",
            },
        }

    def _archive(self, stamp: str, X: np.ndarray) -> None:
        """Write live_<stamp>.npz (this refresh's frame) and forecasts_<stamp>.json.gz (raw CAMS + weather series)."""
        try:
            self.archive_dir.mkdir(parents=True, exist_ok=True)
            name = stamp.replace(":", "-")  # Windows-safe
            np.savez_compressed(
                self.archive_dir / f"live_{name}.npz",
                X=X[None],
                timestamps=np.array([stamp]),
                cities=np.array([c.slug for c in CITIES]),
                features=np.array(FEATURE_KEYS),
            )
            raw = {}
            for sid in ("cams", "weather"):
                r = self.results.get(sid)
                raw[sid] = {"ok": bool(r and r.ok), "error": r.error if r else "not fetched", "fetched_at": r.fetched_at if r else None, "data": r.data if r and r.ok else None}
            with gzip.open(self.archive_dir / f"forecasts_{name}.json.gz", "wt", encoding="utf-8") as f:
                json.dump({"updated_at": stamp, **raw}, f, default=str)
        except Exception as e:  # noqa: BLE001  archiving must never break the live refresh
            print("live archive failed:", e)

    def sources_status(self) -> list[dict]:
        out = []
        for sid, meta in SOURCE_META.items():
            r = self.results.get(sid)
            if sid == "calendar":
                out.append({"id": sid, **meta, "ok": True, "records": 2, "latency_ms": 0, "error": None, "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds")})
                continue
            out.append(
                {
                    "id": sid,
                    **meta,
                    "ok": bool(r and r.ok),
                    "records": r.records if r else 0,
                    "latency_ms": r.latency_ms if r else 0,
                    "error": r.error if r else "not fetched yet",
                    "fetched_at": r.fetched_at if r else None,
                }
            )
        return out
