"""P2.3 CAMS baselines on val: raw CAMS at matched lead, and CAMS + per-station linear bias correction (fit on train).

    python ml/scripts/build_cams_fc.py && python ml/scripts/run_cams_baselines.py
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
from aerofusion_ml.data import cams, torch_dataset as tds, windows  # noqa: E402
from aerofusion_ml.models.baselines import persistence  # noqa: E402
from aerofusion_ml.models.cams_baseline import LinearBC  # noqa: E402
from aerofusion_ml.runs import make_run_id  # noqa: E402


def main() -> None:
    sp = yaml.safe_load((ML / "configs" / "splits_v1.yaml").read_text(encoding="utf-8"))
    ds = xr.open_zarr(ML / "data/processed/dataset_v1.zarr")
    stop = pd.Timestamp(sp["splits"]["val"]["end"], tz="UTC") + pd.Timedelta(hours=23)
    times = pd.DatetimeIndex(ds.time.values).tz_localize("UTC")
    keep = times <= stop
    times = times[keep]
    st = ds.node_kind.values == "station"
    ids = np.array([str(v) for v in ds.node.values[st]])
    y = ds.y.values[keep][:, st]
    pm_in = ds.x_node.sel(feat="pm25").values[keep][:, st]
    fc = xr.open_zarr(ML / "data/processed/cams_fc_v1.zarr").sel(point=ids).load()

    def stack(t0s):
        F = np.stack([cams.forecast(fc, t0) for t0 in t0s])  # [S, 48, N]
        O = np.stack([y[windows.target_index(times, t0)] for t0 in t0s])
        return F, O

    t_tr = tds.issue_times(times, sp["splits"]["train"], sp["issue_hours_eval"], stop)
    t_va = tds.issue_times(times, sp["splits"]["val"], sp["issue_hours_eval"], stop)
    bc = LinearBC().fit(*stack(t_tr))
    Fv, Ov = stack(t_va)
    pers = np.stack([persistence(pm_in, times.get_loc(t0)) for t0 in t_va])
    city_of = dict(zip(np.array([str(v) for v in ds.node.values]), np.array([str(v) for v in ds.node_city_slug.values])))
    for name, P in [("cams_raw", Fv), ("cams_bc", bc.predict(Fv))]:
        S = len(t_va)
        df = pd.DataFrame({"t0": np.repeat(t_va, 48 * len(ids)), "lead": np.tile(np.repeat(np.arange(1, 49), len(ids)), S),
                           "node_id": np.tile(ids, S * 48), "pred": P.reshape(-1), "obs": Ov.reshape(-1), "ref_persistence": pers.reshape(-1)})
        run_id = make_run_id(name, 0)
        m = ev.evaluate(df, split="val", model=name, setting="S-B", run_id=run_id, city_of=city_of)
        m["cams_months"] = [cams.months_available()[0], cams.months_available()[-1]]
        run_dir = ML / "runs" / run_id
        ev.write(m, run_dir)
        df.to_parquet(run_dir / "preds_val.parquet", index=False)
        (run_dir / "config.yaml").write_text(yaml.safe_dump({"model": name, "setting": "S-B", "fit": "train (per station x lead)" if name == "cams_bc" else "none",
                                                              "cams_latency_h": windows.CAMS_LATENCY_H}), encoding="utf-8")
        print(f"{name}: {run_id}")


if __name__ == "__main__":
    main()
