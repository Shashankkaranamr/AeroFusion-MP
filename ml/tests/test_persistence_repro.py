"""P2.4: an independent ~20-line recomputation of persistence RMSE must match evaluate.py's metrics.json to 1e-6.
Deliberately does not import evaluate.py or baselines.py."""

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ML = Path(__file__).resolve().parents[1]


def _latest_run():
    runs = sorted((ML / "runs").glob("*-persistence-s0-*/metrics.json"))
    if not runs or not (ML / "data/processed/dataset_v1.zarr").exists():
        pytest.skip("no persistence run / dataset yet")
    return json.loads(runs[-1].read_text(encoding="utf-8"))


@pytest.mark.parametrize("lead", [1, 24, 48])
def test_persistence_rmse_reproduces(lead):
    import xarray as xr

    m = _latest_run()
    ds = xr.open_zarr(ML / "data/processed/dataset_v1.zarr")
    st = ds.node_kind.values == "station"
    t = pd.DatetimeIndex(ds.time.values)
    y, x = ds.y.values[:, st].astype(float), ds.x_node.sel(feat="pm25").values[:, st].astype(float)
    stop = pd.Timestamp("2022-12-31 23:00")
    i0 = np.where((t >= "2022-01-01") & np.isin(t.hour, [0, 12]))[0]
    i0 = i0[t[i0] + pd.Timedelta(hours=48) <= stop]
    err = np.concatenate([x[i - 1] - y[i + lead] for i in i0])  # forecast = last usable value (t0 - 1 h)
    err = err[~np.isnan(err)]
    assert len(err) == m["leads"][str(lead)]["station"]["n"]
    assert abs(np.sqrt((err ** 2).mean()) - m["leads"][str(lead)]["station"]["rmse"]) < 1e-6
