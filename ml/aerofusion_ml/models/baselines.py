"""Tier-1 baselines that need no training (PROGRESS P2.3): persistence, same-hour-yesterday, climatology.

All use only data usable at t0 (§3.4): the PM2.5 *input* series (QC'd, forward-filled <= 3 h) at hours <= t0 - 1 h.
Climatology is fitted on the train split only (station x month x hour-of-day mean of the target).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from ..data import windows

LEADS = np.arange(1, windows.HORIZON_H + 1)


def persistence(pm_in: np.ndarray, pos0: int) -> np.ndarray:
    """pm_in [T, N]; pos0 = index of t0. Predict the last usable value (hour t0-1h) for every lead -> [48, N]."""
    return np.repeat(pm_in[pos0 - 1][None, :], len(LEADS), axis=0)


def same_hour_yesterday(pm_in: np.ndarray, pos0: int) -> np.ndarray:
    """Value at the same hour of day, going back in whole days until it is usable (<= t0-1h)."""
    back = np.ceil((LEADS + 1) / 24).astype(int) * 24  # lead 1..23 -> 24 h back, 24..47 -> 48 h, 48 -> 72 h
    return pm_in[pos0 + LEADS - back]


class Climatology:
    def __init__(self, times: pd.DatetimeIndex, y: np.ndarray, train: dict):
        sel = (times >= pd.Timestamp(train["start"], tz="UTC")) & (times <= pd.Timestamp(train["end"], tz="UTC") + pd.Timedelta(hours=23))
        if not sel.any():
            raise ValueError("no train rows")
        t = times[sel]
        df = pd.DataFrame(y[sel])
        df["month"], df["hour"] = t.month, t.hour
        self.table = df.groupby(["month", "hour"]).mean()  # [(12*24), N], NaN where a station never reported

    def predict(self, valid: pd.DatetimeIndex) -> np.ndarray:
        key = pd.MultiIndex.from_arrays([valid.month, valid.hour])
        return self.table.reindex(key).to_numpy()


def frame(times: pd.DatetimeIndex, y: np.ndarray, node_ids: list[str], t0s: pd.DatetimeIndex, predict) -> pd.DataFrame:
    """Long evaluation frame (t0, lead, node_id, pred, obs) for issue times t0s; predict(pos0, t0) -> [48, N]."""
    rows = []
    for t0 in t0s:
        pos0 = times.get_loc(t0)
        tgt = windows.target_index(times, t0)
        p = predict(pos0, t0)
        o = y[tgt]
        n = len(node_ids)
        rows.append(pd.DataFrame({"t0": t0, "lead": np.repeat(LEADS, n), "node_id": np.tile(node_ids, len(LEADS)),
                                  "pred": p.reshape(-1), "obs": o.reshape(-1)}))
    return pd.concat(rows, ignore_index=True)
