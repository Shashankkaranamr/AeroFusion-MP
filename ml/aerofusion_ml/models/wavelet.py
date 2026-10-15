"""Causal stationary wavelet bands (PROGRESS §2, rung M4).

À-trous (undecimated) db4 decomposition computed inside each input window with causal filtering: the band value at
hour t depends only on samples <= t (left padding by edge replication). A full-series DWT/SWT would mix in future
samples (Quilty & Adamowski 2018, docs/related_work.md #24), which is why the centred/zero-phase variant is not used.
"""

from __future__ import annotations

import numpy as np
import pywt
import torch
import torch.nn.functional as F
from torch import nn


class CausalSWT(nn.Module):
    """x [B, T, N, C] -> bands [B, T, N, C*(levels+1)] ordered (d1..dL, aL) per channel."""

    def __init__(self, wavelet: str = "db4", levels: int = 3):
        super().__init__()
        w = pywt.Wavelet(wavelet)
        # analysis filters, normalised for the undecimated transform (sum of lowpass = 1)
        lo = np.asarray(w.dec_lo, dtype=np.float32) / np.sqrt(2)
        hi = np.asarray(w.dec_hi, dtype=np.float32) / np.sqrt(2)
        self.levels = levels
        for j in range(levels):
            step = 2 ** j
            up_lo = np.zeros((len(lo) - 1) * step + 1, np.float32)
            up_hi = np.zeros_like(up_lo)
            up_lo[::step], up_hi[::step] = lo, hi
            # conv1d is cross-correlation: flip so out[t] = sum_k f[k] x[t-k] (strictly causal with left padding)
            self.register_buffer(f"lo{j}", torch.from_numpy(up_lo[::-1].copy()).view(1, 1, -1))
            self.register_buffer(f"hi{j}", torch.from_numpy(up_hi[::-1].copy()).view(1, 1, -1))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, T, N, C = x.shape
        a = x.permute(0, 2, 3, 1).reshape(B * N * C, 1, T)
        bands = []
        for j in range(self.levels):
            lo, hi = getattr(self, f"lo{j}"), getattr(self, f"hi{j}")
            pad = lo.shape[-1] - 1
            ap = F.pad(a, (pad, 0), mode="replicate")
            bands.append(F.conv1d(ap, hi))
            a = F.conv1d(ap, lo)
        bands.append(a)
        out = torch.cat(bands, dim=1)  # [B*N*C, L+1, T]
        return out.view(B, N, C, self.levels + 1, T).permute(0, 4, 1, 2, 3).reshape(B, T, N, C * (self.levels + 1))
