"""P1.10: build ml/data/processed/dataset_v1.zarr (node part of the §3.9 contract) and ml/data/SPLITS.lock.

    python ml/scripts/build_v1.py

x_node[time,node,feat] float32 (feature order = configs/features_v1.yaml), m_node uint8 (1 = value present: observed,
or carried forward <= 3 h for inputs), y[time,node] float32 (QC'd PM2.5, never filled; NaN for region/city nodes).
Time axis 2017-12-01 .. 2025-09-30 23:00 UTC (December 2017 is the 72 h warm-up before train).

Not yet included (written as NaN, mask 0, and listed in attrs["pending"]): CAMS analyses (P1.7 still downloading;
their issue-time latency rule is designed when the data lands) and the BLH fill for 2024-01..06 from the CDS ERA5
grid when those months are not downloaded yet. The grid dataset and cams_fc follow in their own steps.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx
import numpy as np
import pandas as pd
import xarray as xr
import yaml

ML = Path(__file__).resolve().parents[1]
REPO = ML.parent
sys.path.insert(0, str(ML))
from aerofusion_ml.data import cams, cpcb, events, fires as firemod, manifest, openmeteo, qc, stations as st  # noqa: E402

DATA = ML / "data"
OUT = DATA / "processed" / "dataset_v1.zarr"
T0, T1 = "2017-12-01 00:00", "2025-09-30 23:00"
BLH_GAP = ("2024-01-01", "2024-06-30 23:00")


def node_table() -> pd.DataFrame:
    nodes = pd.read_csv(DATA / "nodes_v1.csv")
    panel = pd.read_csv(DATA / "stations_v1.csv").set_index("station_id")
    cities = json.loads(st.CITIES.read_text(encoding="utf-8"))["cities"]
    cmeta = {c["slug"]: c for c in cities}
    nodes["city_slug"] = [panel["city"].get(n) if k == "station" else (n[5:] if k == "city" else "") for n, k in zip(nodes["node_id"], nodes["kind"])]
    regions = sorted({c["region"] for c in cities})
    nodes["region"] = [regions.index(cmeta[c]["region"]) if c in cmeta else -1 for c in nodes["city_slug"]]
    nodes["coastal"] = [float(cmeta[c]["coastal"]) if c in cmeta else 0.0 for c in nodes["city_slug"]]
    nodes["city_population"] = [float(cmeta[c]["pop"]) if c in cmeta else 0.0 for c in nodes["city_slug"]]
    nodes["elevation"] = elevations(nodes)
    return nodes


def elevations(nodes: pd.DataFrame) -> list[float]:
    cache = DATA / "processed" / "node_elevation.csv"
    if cache.exists():
        e = pd.read_csv(cache).set_index("node_id")["elevation"]
        if set(nodes["node_id"]) <= set(e.index):
            return [float(e[n]) for n in nodes["node_id"]]
    out = []
    with httpx.Client(timeout=60) as c:
        for i in range(0, len(nodes), 100):
            chunk = nodes.iloc[i:i + 100]
            r = c.get("https://api.open-meteo.com/v1/elevation", params={"latitude": ",".join(map(str, chunk["lat"])), "longitude": ",".join(map(str, chunk["lon"]))})
            r.raise_for_status()
            out += r.json()["elevation"]
    cache.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame({"node_id": nodes["node_id"], "elevation": out}).to_csv(cache, index=False)
    return out


def met_frames(nodes: pd.DataFrame, times: pd.DatetimeIndex) -> dict[str, pd.DataFrame]:
    per_cell = {}
    for cell in nodes["cell"].unique():
        m = pd.concat(pd.read_parquet(f) for f in sorted((openmeteo.RAW / cell).glob("*.parquet"))).set_index("time")
        per_cell[cell] = m[~m.index.duplicated()].reindex(times)
    cols = {"t2m": "temperature_2m", "rh": "relative_humidity_2m", "u10": "u10", "v10": "v10", "wind_speed": "wind_speed_10m",
            "pressure": "surface_pressure", "precip": "precipitation", "blh": "boundary_layer_height"}
    out = {k: pd.DataFrame({n: per_cell[c][v].to_numpy(dtype=float) for n, c in zip(nodes["node_id"], nodes["cell"])}, index=times) for k, v in cols.items()}
    return out


def fill_blh_from_era5(blh: pd.DataFrame, nodes: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Open-Meteo has no BLH for 2024-01..06 (§9); take the same ERA5 field from the CDS grid (3-hourly), interpolated
    bilinearly at each node and held for the 2 following hours (causal: a 3-hourly value is only reused later)."""
    missing = []
    for month in pd.period_range(BLH_GAP[0][:7], BLH_GAP[1][:7], freq="M"):
        f = manifest.RAW / "era5_grid" / "v1" / f"{month}.nc"
        if not f.exists():
            missing.append(str(month))
            continue
        ds = xr.open_dataset(f)
        pts = ds["blh"].interp(latitude=xr.DataArray(nodes["lat"].to_numpy(), dims="node"),
                               longitude=xr.DataArray(nodes["lon"].to_numpy(), dims="node"))
        v = pd.DataFrame(pts.values, index=pd.DatetimeIndex(pts["valid_time"].values).tz_localize("UTC"), columns=nodes["node_id"])
        v = v.reindex(pd.date_range(v.index[0], v.index[-1] + pd.Timedelta(hours=2), freq="h")).ffill(limit=2)
        idx = blh.index.intersection(v.index)
        blh.loc[idx] = blh.loc[idx].fillna(v.loc[idx])
    return blh, missing


def fire_frames(nodes: pd.DataFrame, times: pd.DatetimeIndex) -> dict[str, pd.DataFrame]:
    f = pd.read_parquet(DATA / "processed" / "fires_v1.parquet")
    out = {}
    for col in firemod.COLS:
        w = f.pivot_table(index="slot", columns="node_id", values=col, aggfunc="sum").reindex(index=times, columns=nodes["node_id"])
        out[col] = w.fillna(0.0)
    return out


def sha(a: np.ndarray) -> str:
    return hashlib.sha256(np.ascontiguousarray(a).tobytes()).hexdigest()


def main() -> None:
    feats = yaml.safe_load((ML / "configs" / "features_v1.yaml").read_text(encoding="utf-8"))
    keys = [f["key"] for f in feats["features"]]
    splits = yaml.safe_load((ML / "configs" / "splits_v1.yaml").read_text(encoding="utf-8"))["splits"]
    times = pd.date_range(pd.Timestamp(T0, tz="UTC"), pd.Timestamp(T1, tz="UTC"), freq="h")
    nodes = node_table()
    ids = nodes["node_id"].tolist()
    T, N, F = len(times), len(ids), len(keys)
    x = np.full((T, N, F), np.nan, dtype=np.float32)
    y = np.full((T, N), np.nan, dtype=np.float32)
    pending, sources = [], {}

    def put(key: str, frame: pd.DataFrame) -> None:
        x[:, :, keys.index(key)] = frame.reindex(index=times, columns=ids).to_numpy(dtype=np.float32)

    # pollutants (stations only): QC -> y (never filled) and causal-filled inputs
    sids = nodes.loc[nodes["kind"] == "station", "node_id"].tolist()
    city_of = dict(zip(nodes["node_id"], nodes["city_slug"]))
    for p in ["pm25", "pm10", "no2", "co", "o3"]:
        w, _ = cpcb.wide_streamed(p, sids, T0, T1)
        clean, stats = qc.run_qc(w.astype(float), p, city_of)
        if p == "pm25":
            y[:, [ids.index(s) for s in sids]] = clean.to_numpy(dtype=np.float32)
        put(p, qc.fill_short_gaps(clean))
        print(f"  {p}: remaining {stats['remaining']:,}", flush=True)
        del w, clean

    met = met_frames(nodes, times)
    met["blh"], missing = fill_blh_from_era5(met["blh"], nodes)
    if missing:
        pending.append(f"blh 2024 gap months without ERA5 grid yet: {missing}")
    sources["blh"] = "Open-Meteo ERA5; 2024-01..06 from CDS ERA5 grid (bilinear, 3-hourly held 2 h)"
    met["ventilation"] = met["wind_speed"] * met["blh"]
    for k, frame in met.items():
        put(k, frame)

    for k, frame in fire_frames(nodes, times).items():
        put(k, frame)

    have = cams.months_available()
    want = sorted(set(times.strftime("%Y-%m")))
    for month in have:
        ds = cams.at_points(cams.open_month(month), nodes["lat"].to_numpy(), nodes["lon"].to_numpy())
        # hours fed by this month's runs: R + 9 h .. next month's first run + 8 h
        r = cams.run_for(times)
        sel = (r.strftime("%Y-%m") == month)
        if sel.any():
            for k, v in cams.series(ds, times[sel]).items():
                x[np.where(sel)[0], :, keys.index(k)] = v
    missing_cams = [m for m in want if m not in have]
    if missing_cams:
        pending.append(f"CAMS months not downloaded yet: {len(missing_cams)} ({missing_cams[0]}..{missing_cams[-1]})")
    sources["cams"] = "CAMS global forecast, run R <= t-9h at lead t-R (9..20 h), bilinear at node (data/cams.py)"

    cal = events.calendar_features(times)
    for k in cal.columns:
        x[:, :, keys.index(k)] = cal[k].to_numpy(dtype=np.float32)[:, None]

    m = (~np.isnan(x)).astype(np.uint8)
    missing_keys = [k for k in keys if not m[:, :, keys.index(k)].any()]
    print("features with no data yet:", missing_keys, flush=True)

    git = subprocess.run(["git", "-C", str(REPO), "rev-parse", "--short=7", "HEAD"], capture_output=True, text=True).stdout.strip()
    attrs = {"version": "v1", "created": datetime.now(timezone.utc).isoformat(timespec="seconds"), "git_sha": git,
             "manifest_sha256": hashlib.sha256(manifest.MANIFEST.read_bytes()).hexdigest(), "splits": json.dumps(splits),
             "pending": json.dumps(pending), "sources": json.dumps(sources), "status": "partial" if pending else "complete"}
    ds = xr.Dataset(
        {"x_node": (("time", "node", "feat"), x), "m_node": (("time", "node", "feat"), m), "y": (("time", "node"), y)},
        coords={"time": times.tz_convert(None), "node": ids, "feat": keys,
                **{f"node_{c}": ("node", nodes[c].to_numpy()) for c in ["kind", "city_slug", "lat", "lon", "elevation", "coastal", "region", "city_population"]}},
        attrs=attrs,
    )
    enc = {"x_node": {"chunks": (24 * 30, N, F)}, "m_node": {"chunks": (24 * 30, N, F)}, "y": {"chunks": (24 * 30, N)}}
    ds.to_zarr(OUT, mode="w", encoding=enc, consolidated=True)
    print(f"wrote {OUT}: time {T}, node {N}, feat {F}", flush=True)

    lock = {"version": "v1", "created": attrs["created"], "dataset_status": attrs["status"], "splits": {}}
    for name, s in splits.items():
        if "start" not in s or pd.Timestamp(s["start"], tz="UTC") > times[-1]:
            continue
        sel = (times >= pd.Timestamp(s["start"], tz="UTC")) & (times <= pd.Timestamp(s["end"], tz="UTC") + pd.Timedelta(hours=23))
        lock["splits"][name] = {"start": s["start"], "end": s["end"], "hours": int(sel.sum()),
                                "sha256_y": sha(y[sel]), "sha256_x": sha(x[sel]), "frozen": bool(s.get("frozen", False))}
    (DATA / "SPLITS.lock").write_text(json.dumps(lock, indent=1), encoding="utf-8")
    print("wrote SPLITS.lock; pending:", pending)


if __name__ == "__main__":
    main()
