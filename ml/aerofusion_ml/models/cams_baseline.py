"""CAMS baselines (PROGRESS P2.3): raw CAMS at the matched lead, and CAMS + linear bias correction per station.

Raw: pred = CAMS PM2.5 forecast usable at t0 (data/cams.forecast). Bias-corrected: per station and lead,
obs = a + b * cams fitted by least squares on the train split only; falls back to the raw forecast where a station has
too few train pairs (< 50).
"""

from __future__ import annotations

import numpy as np


class LinearBC:
    def __init__(self, min_pairs: int = 50):
        self.min_pairs = min_pairs
        self.coef = None  # [48, N, 2]

    def fit(self, cams_fc: np.ndarray, obs: np.ndarray) -> "LinearBC":
        """cams_fc, obs: [S, 48, N] over train issue times."""
        S, H, N = cams_fc.shape
        coef = np.tile(np.array([0.0, 1.0]), (H, N, 1))
        for h in range(H):
            for n in range(N):
                x, y = cams_fc[:, h, n], obs[:, h, n]
                ok = ~(np.isnan(x) | np.isnan(y))
                if ok.sum() >= self.min_pairs and np.var(x[ok]) > 0:
                    b, a = np.polyfit(x[ok], y[ok], 1)
                    coef[h, n] = (a, b)
        self.coef = coef
        return self

    def predict(self, cams_fc: np.ndarray) -> np.ndarray:
        """[48, N] or [S, 48, N] -> same shape."""
        return self.coef[..., 0] + self.coef[..., 1] * cams_fc
