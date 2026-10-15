"""Graph part (PROGRESS §3.2, rungs M1/M2).

Static edges: k = 8 nearest nodes within 600 km, distance weight exp(-d / sigma). Wind awareness (PM2.5-GNN style):
per sample, edge j -> i is scaled by max(0, cos(wind direction at j - bearing j->i)), using the source node's mean
wind over the last hours of the input window (past only). Adaptive adjacency (Graph WaveNet): softmax(relu(E1 E2ᵀ)).
Diffusion convolution (DCRNN): sum over k = 0..K of P_fᵏ X W and P_bᵏ X W.
"""

from __future__ import annotations

import math

import numpy as np
import torch
from torch import nn

R_KM = 6371.0


def distance_bearing(lat: np.ndarray, lon: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """[N, N] great-circle km and bearing (deg, from north) from node i to node j."""
    p = np.radians(lat)[:, None], np.radians(lat)[None, :]
    dl = np.radians(lon)[None, :] - np.radians(lon)[:, None]
    a = np.sin((p[1] - p[0]) / 2) ** 2 + np.cos(p[0]) * np.cos(p[1]) * np.sin(dl / 2) ** 2
    d = 2 * R_KM * np.arcsin(np.sqrt(np.clip(a, 0, 1)))
    b = np.degrees(np.arctan2(np.sin(dl) * np.cos(p[1]), np.cos(p[0]) * np.sin(p[1]) - np.sin(p[0]) * np.cos(p[1]) * np.cos(dl)))
    return d, (b + 360) % 360


def static_adjacency(lat: np.ndarray, lon: np.ndarray, k: int = 8, max_km: float = 600.0, sigma_km: float | None = None) -> np.ndarray:
    """A[i, j] = exp(-d_ij / sigma) for the k nearest j != i within max_km (row = receiver i, column = sender j)."""
    d, _ = distance_bearing(lat, lon)
    np.fill_diagonal(d, np.inf)
    A = np.zeros_like(d)
    order = np.argsort(d, axis=1)[:, :k]
    rows = np.arange(len(d))[:, None]
    near = d[rows, order]
    sigma = sigma_km or float(np.median(near[np.isfinite(near) & (near <= max_km)]))
    A[rows, order] = np.where(near <= max_km, np.exp(-near / sigma), 0.0)
    return A.astype(np.float32)


def wind_alignment(u: torch.Tensor, v: torch.Tensor, bearing_ji: torch.Tensor) -> torch.Tensor:
    """u, v [B, N] (wind at sender j, blowing TO direction); bearing_ji [N, N] deg from sender j to receiver i, indexed [i, j].
    Returns [B, N, N] = max(0, cos(direction wind blows to at j - bearing j->i))."""
    to_dir = torch.atan2(u, v) * (180.0 / math.pi) % 360  # direction the air moves towards (no rad2deg: not in ONNX)
    diff = (to_dir[:, None, :] - bearing_ji[None]) * (math.pi / 180.0)
    return torch.clamp(torch.cos(diff), min=0.0)


class DiffusionConv(nn.Module):
    def __init__(self, d_in: int, d_out: int, K: int = 2, adaptive: bool = False, n_nodes: int | None = None, emb: int = 10):
        super().__init__()
        self.K = K
        n_sup = 2 + (1 if adaptive else 0)
        self.lin = nn.Linear(d_in * (1 + K * n_sup), d_out)
        self.adaptive = adaptive
        if adaptive:
            self.E1 = nn.Parameter(torch.randn(n_nodes, emb) * 0.1)
            self.E2 = nn.Parameter(torch.randn(n_nodes, emb) * 0.1)

    @staticmethod
    def _rw(A: torch.Tensor) -> torch.Tensor:
        return A / A.sum(-1, keepdim=True).clamp(min=1e-6)

    def forward(self, x: torch.Tensor, A: torch.Tensor) -> torch.Tensor:
        """x [B, N, D]; A [B, N, N] (receiver row, sender column)."""
        sup = [self._rw(A), self._rw(A.transpose(-1, -2))]
        if self.adaptive:
            sup.append(torch.softmax(torch.relu(self.E1 @ self.E2.T), dim=-1).expand_as(A))
        out = [x]
        for P in sup:
            h = x
            for _ in range(self.K):
                h = P @ h
                out.append(h)
        return self.lin(torch.cat(out, dim=-1))
