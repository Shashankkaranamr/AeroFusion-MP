"""P1.7 -> processed/cams_fc_v1.zarr: CAMS forecasts at every node, dims (run, lead, point=node), vars pm2p5 (µg/m³),
aod550, duaod550. Used by S-B models and the CAMS baselines through data/cams.forecast (latency-checked).

    python ml/scripts/build_cams_fc.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import xarray as xr

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML))
from aerofusion_ml.data import cams  # noqa: E402


def main() -> None:
    nodes = pd.read_csv(ML / "data" / "nodes_v1.csv")
    parts = [cams.at_points(cams.open_month(m), nodes["lat"].to_numpy(), nodes["lon"].to_numpy()) for m in cams.months_available()]
    if not parts:
        raise SystemExit("no CAMS months downloaded yet")
    fc = xr.concat(parts, dim="run").assign_coords(point=nodes["node_id"].to_numpy()).drop_vars(["latitude", "longitude"], errors="ignore")
    out = ML / "data" / "processed" / "cams_fc_v1.zarr"
    fc.astype("float32").to_zarr(out, mode="w")
    print(f"wrote {out}: {dict(fc.sizes)}; months {cams.months_available()[0]}..{cams.months_available()[-1]}")


if __name__ == "__main__":
    main()
