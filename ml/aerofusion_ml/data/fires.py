"""Per-node hourly fire features from FIRMS (PROGRESS §3.6 fire group, P1.8).

Detections kept: type 0 (presumed vegetation fire; static industrial sources, offshore and volcanoes dropped) and
confidence not low (VIIRS 'l' dropped; MODIS < 30 dropped). Each detection is stamped with `windows.fire_slot`
(slot t holds acquisitions in (t, t+1h]); the issue-time lag (latency + 1 h) is applied by `windows.window_index`.

Per node and slot:
  fires_300km         detections within 300 km
  frp_300km           summed FRP (MW) within 300 km
  fires_upwind_500km  detections within 500 km whose bearing node->fire is within ±45° of the node's wind-FROM
                      direction in that hour (smoke is carried from there towards the node)
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from . import firms, windows

R_KM = 6371.0
NEAR_KM, UPWIND_KM, UPWIND_HALF_DEG = 300.0, 500.0, 45.0
COLS = ["fires_300km", "frp_300km", "fires_upwind_500km"]


def load_detections(files: list[Path]) -> pd.DataFrame:
    parts = []
    for f in files:
        d = pd.read_csv(f, usecols=["latitude", "longitude", "acq_date", "acq_time", "confidence", "frp", "type", "instrument"],
                        dtype={"acq_time": str, "confidence": str})
        conf = d["confidence"].astype(str)
        low = conf.eq("l") if (d["instrument"] == "VIIRS").all() else pd.to_numeric(conf, errors="coerce").lt(30)
        d = d[(d["type"] == 0) & ~low]
        acq = pd.to_datetime(d["acq_date"] + d["acq_time"].str.zfill(4), format="%Y-%m-%d%H%M", utc=True)
        parts.append(pd.DataFrame({"lat": d["latitude"].to_numpy(), "lon": d["longitude"].to_numpy(),
                                   "frp": d["frp"].to_numpy(dtype=float), "slot": windows.fire_slot(acq).to_numpy(),
                                   "sensor": d["instrument"].to_numpy()}))
    return pd.concat(parts, ignore_index=True)


def dist_bearing(lat1, lon1, lat2, lon2):
    """Great-circle distance (km) and initial bearing (deg from north) from points 1 to points 2 (broadcasting)."""
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dl = np.radians(lon2 - lon1)
    a = np.sin((p2 - p1) / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    d = 2 * R_KM * np.arcsin(np.sqrt(np.clip(a, 0, 1)))
    b = np.degrees(np.arctan2(np.sin(dl) * np.cos(p2), np.cos(p1) * np.sin(p2) - np.sin(p1) * np.cos(p2) * np.cos(dl)))
    return d, (b + 360) % 360


def node_features(det: pd.DataFrame, nodes: pd.DataFrame, wind_from: pd.DataFrame) -> pd.DataFrame:
    """det: lat, lon, frp, slot. nodes: node_id, lat, lon. wind_from: index = slot (UTC hour), columns = node_id, deg.
    Returns long rows (slot, node_id, *COLS) for slots with any detection; absent rows mean zero."""
    nl, no = nodes["lat"].to_numpy()[:, None], nodes["lon"].to_numpy()[:, None]
    ids = nodes["node_id"].to_numpy()
    out = []
    for slot, g in det.groupby("slot", sort=True):
        d, b = dist_bearing(nl, no, g["lat"].to_numpy()[None, :], g["lon"].to_numpy()[None, :])
        near = d <= NEAR_KM
        wf = wind_from.loc[slot].reindex(ids).to_numpy()[:, None] if slot in wind_from.index else np.full((len(ids), 1), np.nan)
        diff = np.abs((b - wf + 180) % 360 - 180)
        up = (d <= UPWIND_KM) & (diff <= UPWIND_HALF_DEG)
        frame = pd.DataFrame({"slot": slot, "node_id": ids, "fires_300km": near.sum(1),
                              "frp_300km": (near * g["frp"].to_numpy()[None, :]).sum(1),
                              "fires_upwind_500km": np.where(np.isnan(wf[:, 0]), np.nan, up.sum(1))})
        out.append(frame[(frame[COLS].fillna(0) > 0).any(axis=1)])
    return pd.concat(out, ignore_index=True) if out else pd.DataFrame(columns=["slot", "node_id", *COLS])


def files(sensors=firms.SENSORS, years=firms.YEARS, countries=firms.COUNTRIES) -> list[Path]:
    return [p for s in sensors for y in years for c in countries
            if (p := firms.RAW / s / str(y) / f"{s}_{y}_{c}.csv").exists()]
