"""P2.3: no-training tier-1 baselines on the VALIDATION split (never test).

    python ml/scripts/run_baselines.py

For each of persistence, same_hour_yesterday and climatology: build predictions at the evaluation issue times
(00 and 12 UTC, §3.3), score them with evaluate.py (skill vs persistence included), and write
ml/runs/<run_id>/{config.yaml, metrics.json, preds_val.parquet}. CAMS-based, LightGBM and LSTM baselines follow
when CAMS (P1.7) is in and the training machine is available.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr
import yaml

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML))
from aerofusion_ml import evaluate as ev  # noqa: E402
from aerofusion_ml.models import baselines as bl  # noqa: E402
from aerofusion_ml.runs import make_run_id  # noqa: E402

ZARR = ML / "data" / "processed" / "dataset_v1.zarr"


def main() -> None:
    splits = yaml.safe_load((ML / "configs" / "splits_v1.yaml").read_text(encoding="utf-8"))
    val, train = splits["splits"]["val"], splits["splits"]["train"]
    ds = xr.open_zarr(ZARR)
    stations = ds.node_kind.values == "station"
    node_ids = [str(n) for n in ds.node.values[stations]]
    times = pd.DatetimeIndex(ds.time.values).tz_localize("UTC")
    y = ds.y.values[:, stations]
    pm_in = ds.x_node.sel(feat="pm25").values[:, stations]
    city_of = dict(zip(node_ids, [str(c) for c in ds.node_city_slug.values[stations]]))
    # never touch the frozen split: cut every array at the end of val + the 48 h horizon
    stop = pd.Timestamp(val["end"], tz="UTC") + pd.Timedelta(hours=23)
    keep = times <= stop
    times, y, pm_in = times[keep], y[keep], pm_in[keep]
    t0s = times[(times >= pd.Timestamp(val["start"], tz="UTC")) & (times.hour.isin(splits["issue_hours_eval"]))]
    t0s = t0s[t0s + pd.Timedelta(hours=48) <= times[-1]]

    clim = bl.Climatology(times, y, train)
    models = {
        "persistence": lambda pos0, t0: bl.persistence(pm_in, pos0),
        "same_hour_yesterday": lambda pos0, t0: bl.same_hour_yesterday(pm_in, pos0),
        "climatology": lambda pos0, t0: clim.predict(t0 + pd.to_timedelta(bl.LEADS, unit="h")),
    }
    ref = bl.frame(times, y, node_ids, t0s, models["persistence"])["pred"].to_numpy()
    for name, fn in models.items():
        df = bl.frame(times, y, node_ids, t0s, fn)
        df["ref_persistence"] = ref
        run_id = make_run_id(name, 0)
        run_dir = ML / "runs" / run_id
        m = ev.evaluate(df, split="val", model=name, setting="S-A", run_id=run_id, city_of=city_of)
        m["dataset"] = {"path": "ml/data/processed/dataset_v1.zarr", "created": ds.attrs.get("created"), "status": ds.attrs.get("status")}
        ev.write(m, run_dir)
        (run_dir / "config.yaml").write_text(yaml.safe_dump({"model": name, "setting": "S-A", "split": "val", "seed": 0,
                                                              "issue_hours": splits["issue_hours_eval"], "fit": "train" if name == "climatology" else "none"}), encoding="utf-8")
        df.to_parquet(run_dir / "preds_val.parquet", index=False)
        print(f"{name}: {run_id} ({len(t0s)} issue times)")


if __name__ == "__main__":
    main()
