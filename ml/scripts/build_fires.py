"""P1.8: FIRMS detections -> per-node hourly fire features (ml/data/processed/fires_v1.parquet).

    python ml/scripts/build_fires.py

Wind for the upwind count is the node's own hourly Open-Meteo ERA5 wind direction (P1.5). Rows are only written for
(slot, node) pairs with a nearby detection; every other hour is zero.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML))
from aerofusion_ml.data import fires, openmeteo  # noqa: E402

DATA = ML / "data"
T0, T1 = pd.Timestamp("2017-12-01", tz="UTC"), pd.Timestamp("2025-09-30 23:00", tz="UTC")


def wind_from(nodes: pd.DataFrame) -> pd.DataFrame:
    cols = {}
    for cell, g in nodes.groupby("cell"):
        met = pd.concat(pd.read_parquet(f, columns=["time", "wind_direction_10m"]) for f in sorted((openmeteo.RAW / cell).glob("*.parquet")))
        s = met.set_index("time")["wind_direction_10m"].astype(float)
        for nid in g["node_id"]:
            cols[nid] = s
    return pd.DataFrame(cols)


def main() -> None:
    nodes = pd.read_csv(DATA / "nodes_v1.csv")
    det = fires.load_detections(fires.files())
    det = det[(det["slot"] >= T0) & (det["slot"] <= T1)]
    print(f"detections kept: {len(det):,} ({det['sensor'].value_counts().to_dict()})", flush=True)
    wf = wind_from(nodes)
    parts = []
    for year, d in det.groupby(det["slot"].dt.year):
        parts.append(fires.node_features(d, nodes, wf))
        print(f"  {year}: {len(d):,} detections -> {len(parts[-1]):,} node-hours with fire", flush=True)
    out = pd.concat(parts, ignore_index=True)
    dest = DATA / "processed" / "fires_v1.parquet"
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.to_parquet(dest, index=False)
    print(f"wrote {dest} ({len(out):,} rows)")


if __name__ == "__main__":
    main()
