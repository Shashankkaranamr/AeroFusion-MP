"""Forecast comparison tests (PROGRESS P2.2).

Diebold & Mariano (1995, doi:10.1080/07350015.1995.10524599) with squared-error loss and the Harvey–Leybourne–Newbold
(1997) small-sample correction; the long-run variance uses autocovariances up to lag h-1 for an h-step forecast.
Paired moving-block bootstrap (block = 24 h by default) for the RMSE difference.

Inputs are two error series aligned on the same issue times (one value per issue time, e.g. a station or city mean at
a given lead), ordered in time.
"""

from __future__ import annotations

import numpy as np
from scipy import stats


def diebold_mariano(e1: np.ndarray, e2: np.ndarray, h: int = 1) -> dict:
    """H0: equal expected squared error. d = e1² - e2²; stat < 0 means model 1 is more accurate. Two-sided p from t(T-1)."""
    e1, e2 = np.asarray(e1, float), np.asarray(e2, float)
    ok = ~(np.isnan(e1) | np.isnan(e2))
    d = e1[ok] ** 2 - e2[ok] ** 2
    T = len(d)
    if T < 3:
        return {"n": T, "dm": None, "p": None}
    dbar = d.mean()
    dc = d - dbar
    gamma = [float((dc[k:] * dc[: T - k]).sum() / T) for k in range(max(h, 1))]
    var = (gamma[0] + 2 * sum(gamma[1:])) / T
    if var <= 0:
        return {"n": T, "dm": 0.0 if dbar == 0 else None, "p": 1.0 if dbar == 0 else None}
    dm = dbar / np.sqrt(var)
    hln = np.sqrt((T + 1 - 2 * h + h * (h - 1) / T) / T)
    stat = float(dm * hln)
    return {"n": T, "dm": stat, "p": float(2 * stats.t.sf(abs(stat), df=T - 1)), "mean_loss_diff": float(dbar)}


def block_bootstrap_rmse_diff(e1: np.ndarray, e2: np.ndarray, block: int = 24, n_boot: int = 2000, seed: int = 0) -> dict:
    """Paired moving-block bootstrap of RMSE(e1) - RMSE(e2); returns the point estimate and a 95 % interval."""
    e1, e2 = np.asarray(e1, float), np.asarray(e2, float)
    ok = ~(np.isnan(e1) | np.isnan(e2))
    e1, e2 = e1[ok], e2[ok]
    T = len(e1)
    if T < block:
        return {"n": T, "diff": None, "ci95": None}
    rng = np.random.default_rng(seed)
    nb = int(np.ceil(T / block))
    starts = rng.integers(0, T - block + 1, size=(n_boot, nb))
    idx = (starts[:, :, None] + np.arange(block)[None, None, :]).reshape(n_boot, -1)[:, :T]
    rm = lambda e: np.sqrt((e ** 2).mean(axis=-1))  # noqa: E731
    diffs = rm(e1[idx]) - rm(e2[idx])
    point = float(np.sqrt((e1 ** 2).mean()) - np.sqrt((e2 ** 2).mean()))
    lo, hi = np.percentile(diffs, [2.5, 97.5])
    return {"n": T, "diff": point, "ci95": [float(lo), float(hi)], "p_le_0": float((diffs >= 0).mean())}
