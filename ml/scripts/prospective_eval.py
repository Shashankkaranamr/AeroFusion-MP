"""Prospective winter 2026-27 test (PROGRESS §3.3, S8/S9): live CAMS forecasts archived at issue time vs CPCB via OpenAQ.

    python ml/scripts/prospective_eval.py --snapshots <dir with snapshot_*.json.gz> --final

Like the frozen test split, the prospective period is scored once, after model freeze (--final also requires
ml/MODEL_FREEZE.json). Without --final the script only reports how many issue times and observation hours are
available, never a score.

Forecasts: each archived snapshot (every ~12 h, data-archive branch) holds the CAMS hourly PM2.5 series per city as it
was published at `updated_at`, so issue time t0 = updated_at floored to the hour and nothing after t0 leaks in. CAMS is
instantaneous at the hour, observations are slot means over (t, t+1h], so the forecast for slot t is the mean of the
CAMS values at t and t+1. Observations: city mean of the panel stations (OpenAQ, collect_openaq.py). Persistence: the
city mean in slot t0-1h. The model's own prospective forecasts are added at P5.5 from the backend's forecast log.
"""

from __future__ import annotations

import argparse
import gzip
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML))
from aerofusion_ml import evaluate as ev  # noqa: E402
from aerofusion_ml.data import openaq  # noqa: E402

LEADS = np.arange(1, 49)


def load_snapshots(folder: Path) -> list[dict]:
    snaps = {}
    for f in sorted(folder.glob("snapshot_*.json.gz")):
        j = json.load(gzip.open(f, "rt", encoding="utf-8"))
        snaps[j["updated_at"]] = j
    return [snaps[k] for k in sorted(snaps)]


def cams_forecasts(snaps: list[dict]) -> pd.DataFrame:
    """(t0, lead, city, pred) from the CAMS series published in each snapshot."""
    rows = []
    for j in snaps:
        t0 = pd.Timestamp(j["updated_at"]).floor("h")
        for c in j["cities"]:
            s = c.get("series") or {}
            if not s.get("time"):
                continue
            v = pd.Series(s["pm25"], index=pd.to_datetime(s["time"], utc=True), dtype=float)
            slot_mean = (v + v.shift(-1)) / 2  # slot t covers (t, t+1h]
            valid = t0 + pd.to_timedelta(LEADS, unit="h")
            rows.append(pd.DataFrame({"t0": t0, "lead": LEADS, "city": c["slug"], "pred": slot_mean.reindex(valid).to_numpy()}))
    return pd.concat(rows, ignore_index=True) if rows else pd.DataFrame(columns=["t0", "lead", "city", "pred"])


def city_obs(match: pd.DataFrame, panel: pd.DataFrame, raw: Path = openaq.RAW) -> pd.DataFrame:
    """Hourly city means of panel-station observations: index slot t (UTC), columns city."""
    city_of = dict(zip(panel["station_id"], panel["city"]))
    parts = []
    for sid in match.dropna(subset=["pm25_sensor"])["station_id"]:
        for f in sorted((raw / sid).glob("*.parquet")):
            d = pd.read_parquet(f)
            parts.append(pd.DataFrame({"t": d["t"], "city": city_of[sid], "sid": sid, "v": d["value"]}))
    if not parts:
        return pd.DataFrame()
    d = pd.concat(parts)
    d = d[(d["v"] >= 0) & (d["v"] <= 1500)]
    return d.groupby(["t", "city"])["v"].mean().unstack("city")


def frame(fc: pd.DataFrame, obs: pd.DataFrame) -> pd.DataFrame:
    valid = fc["t0"] + pd.to_timedelta(fc["lead"], unit="h")
    o = obs.stack()
    o.index.names = ["t", "city"]
    fc = fc.assign(obs=o.reindex(list(zip(valid, fc["city"]))).to_numpy())
    pers = o.reindex(list(zip(fc["t0"] - pd.Timedelta(hours=1), fc["city"]))).to_numpy()
    return fc.assign(ref_persistence=pers, node_id=fc["city"])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--snapshots", required=True)
    ap.add_argument("--final", action="store_true")
    a = ap.parse_args()
    snaps = load_snapshots(Path(a.snapshots))
    fc = cams_forecasts(snaps)
    obs = city_obs(pd.read_csv(ML / "data/openaq_match_v1.csv"), pd.read_csv(ML / "data/stations_v1.csv"))
    print(f"{len(snaps)} snapshots ({snaps[0]['updated_at'] if snaps else '-'} .. {snaps[-1]['updated_at'] if snaps else '-'}), "
          f"{0 if obs.empty else obs.notna().sum().sum():,} city-hours observed")
    if not a.final:
        print("availability only; scores are computed once with --final after model freeze")
        return
    if not (ML / "MODEL_FREEZE.json").exists():
        raise PermissionError("prospective scores are computed after model freeze (ml/MODEL_FREEZE.json)")
    df = frame(fc, obs)
    m = ev.evaluate(df, split="prospective", model="cams_live", setting="S-B", run_id="prospective-cams_live",
                    city_of={c: c for c in df["city"].unique()}, allow_test=True)
    rd = ML / "runs" / "prospective-cams_live"
    ev.write(m, rd)
    print(f"wrote {rd / 'metrics.json'}")


if __name__ == "__main__":
    main()
