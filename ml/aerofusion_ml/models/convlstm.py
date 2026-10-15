"""ConvLSTM regional-context branch (PROGRESS §2, rung M5; Shi et al. 2015, docs/related_work.md #12).

Runs over the gridded exogenous fields x_grid [B, Tg, C, H, W] (ERA5 wind/BLH/T, FIRMS FRP, CAMS), and samples the
final hidden map at each node's location (bilinear) -> per-node context [B, N, hidden].
"""

from __future__ import annotations

import torch
import torch.nn.functional as F
from torch import nn


class ConvLSTMCell(nn.Module):
    def __init__(self, c_in: int, hidden: int, k: int = 3):
        super().__init__()
        self.hidden = hidden
        self.conv = nn.Conv2d(c_in + hidden, 4 * hidden, k, padding=k // 2)

    def forward(self, x, state):
        h, c = state
        i, f, o, g = torch.chunk(self.conv(torch.cat([x, h], 1)), 4, dim=1)
        c = torch.sigmoid(f) * c + torch.sigmoid(i) * torch.tanh(g)
        h = torch.sigmoid(o) * torch.tanh(c)
        return h, c


class GridContext(nn.Module):
    def __init__(self, c_in: int, hidden: int = 16, k: int = 3):
        super().__init__()
        self.cell = ConvLSTMCell(c_in, hidden, k)

    def forward(self, x_grid: torch.Tensor, node_xy: torch.Tensor) -> torch.Tensor:
        """x_grid [B, T, C, H, W] (NaN already masked to 0); node_xy [N, 2] in [-1, 1] (x = lon, y = lat; grid_sample order)."""
        B, T, C, H, W = x_grid.shape
        h = x_grid.new_zeros(B, self.cell.hidden, H, W)
        c = torch.zeros_like(h)
        for t in range(T):
            h, c = self.cell(x_grid[:, t], (h, c))
        grid = node_xy.view(1, 1, -1, 2).expand(B, 1, -1, 2)
        return F.grid_sample(h, grid, align_corners=True).squeeze(2).transpose(1, 2)  # [B, N, hidden]


def node_xy(lat, lon, lat_grid, lon_grid) -> torch.Tensor:
    """Normalised grid_sample coordinates for nodes on a regular grid with ascending lat/lon centres."""
    lat, lon = torch.as_tensor(lat, dtype=torch.float32), torch.as_tensor(lon, dtype=torch.float32)
    x = 2 * (lon - lon_grid[0]) / (lon_grid[-1] - lon_grid[0]) - 1
    y = 2 * (lat - lat_grid[0]) / (lat_grid[-1] - lat_grid[0]) - 1
    return torch.stack([x, y], dim=-1)
