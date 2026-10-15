"""Trainable baselines on the same batch contract as MW-AeroFusion-Net (PROGRESS P2.3 LSTM, P3.8 tier 2).

All implement forward(batch) -> {"pred": [B, 48, N], "gates": None, "aux_loss": 0}. Compact re-implementations,
adapted to our inputs; the paper must say "adapted" and list the differences:
  lstm           per-node LSTM over the 72 h window (proposal baseline)
  cnn_lstm       per-node temporal Conv1d stack -> LSTM (proposal baseline)
  convlstm_base  ConvLSTM over the grid sampled at nodes + per-node linear history summary (proposal baseline)
  pm25gnn        PM2.5-GNN-style GRU cell with wind-aware graph messages at every input step (Wang et al. 2020,
                 doi:10.1145/3397536.3422208); **past-only met** here, whereas the original also feeds future met
                 (that variant = our S-C setting, run separately)
  graph_wavenet  gated dilated causal TCN + diffusion GCN with adaptive adjacency (Wu et al. 2019, IJCAI)
"""

from __future__ import annotations

import torch
import torch.nn.functional as F
from torch import nn

from .convlstm import GridContext
from .graph import DiffusionConv, wind_alignment


def _inputs(batch):
    x, m = batch["x_node"], batch["m_node"].to(batch["x_node"].dtype)
    return torch.cat([torch.nan_to_num(x), m], dim=-1)  # [B, T, N, 2F]


def _per_node(z):
    B, T, N, D = z.shape
    return z.permute(0, 2, 1, 3).reshape(B * N, T, D), (B, N)


class _Head(nn.Module):
    def __init__(self, d, horizon=48):
        super().__init__()
        self.mlp = nn.Sequential(nn.Linear(d, 2 * d), nn.ELU(), nn.Linear(2 * d, horizon))

    def forward(self, e):  # [B, N, d] -> [B, 48, N]
        return self.mlp(e).transpose(1, 2)


def _out(pred):
    return {"pred": pred, "gates": None, "aux_loss": pred.new_zeros(())}


class LSTMBaseline(nn.Module):
    def __init__(self, n_feat, hidden=64, horizon=48, **_):
        super().__init__()
        self.lstm = nn.LSTM(2 * n_feat, hidden, batch_first=True)
        self.head = _Head(hidden, horizon)

    def forward(self, batch):
        z, (B, N) = _per_node(_inputs(batch))
        _, (h, _) = self.lstm(z)
        return _out(self.head(h[-1].view(B, N, -1)))


class CNNLSTM(nn.Module):
    def __init__(self, n_feat, hidden=64, horizon=48, **_):
        super().__init__()
        self.conv = nn.Sequential(nn.Conv1d(2 * n_feat, hidden, 3, padding=2), nn.ReLU(), nn.Conv1d(hidden, hidden, 3, padding=2), nn.ReLU())
        self.lstm = nn.LSTM(hidden, hidden, batch_first=True)
        self.head = _Head(hidden, horizon)

    def forward(self, batch):
        z, (B, N) = _per_node(_inputs(batch))
        T = z.shape[1]
        c = self.conv(z.transpose(1, 2))[..., :T]  # left part only: padding=2 on both sides, keep the causal outputs
        _, (h, _) = self.lstm(c.transpose(1, 2))
        return _out(self.head(h[-1].view(B, N, -1)))


class ConvLSTMBaseline(nn.Module):
    def __init__(self, n_feat, hidden=64, horizon=48, grid_channels=8, node_xy=None, **_):
        super().__init__()
        self.grid = GridContext(grid_channels, 16)
        self.hist = nn.Linear(2 * n_feat, hidden)
        self.register_buffer("node_xy", node_xy.float())
        self.head = _Head(hidden + 16, horizon)

    def forward(self, batch):
        z = _inputs(batch)
        h = torch.relu(self.hist(z[:, -24:].mean(1)))  # [B, N, H] summary of the last day
        g = self.grid(torch.nan_to_num(batch["x_grid"]), self.node_xy)
        return _out(self.head(torch.cat([h, g], -1)))


class PM25GNN(nn.Module):
    def __init__(self, n_feat, hidden=64, horizon=48, A_static=None, bearing=None, **_):
        super().__init__()
        self.register_buffer("A_static", A_static.float())
        self.register_buffer("bearing", bearing.float())
        self.inp = nn.Linear(2 * n_feat, hidden)
        self.cell = nn.GRUCell(2 * hidden, hidden)
        self.head = _Head(hidden, horizon)

    def forward(self, batch):
        z = self.inp(_inputs(batch))  # [B, T, N, H]
        B, T, N, H = z.shape
        A = self.A_static[None] * wind_alignment(batch["wind_uv"][..., 0], batch["wind_uv"][..., 1], self.bearing)  # [B, N, N]
        h = z.new_zeros(B, N, H)
        for t in range(T):
            m = A @ h  # wind-weighted transport from upwind neighbours
            h = self.cell(torch.cat([z[:, t], m], -1).reshape(B * N, 2 * H), h.reshape(B * N, H)).view(B, N, H)
        return _out(self.head(h))


class GraphWaveNet(nn.Module):
    def __init__(self, n_feat, hidden=32, horizon=48, n_nodes=None, A_static=None, layers=4, **_):
        super().__init__()
        self.register_buffer("A_static", A_static.float())
        self.inp = nn.Linear(2 * n_feat, hidden)
        self.filt = nn.ModuleList([nn.Conv1d(hidden, hidden, 2, dilation=2 ** i) for i in range(layers)])
        self.gate = nn.ModuleList([nn.Conv1d(hidden, hidden, 2, dilation=2 ** i) for i in range(layers)])
        self.gcn = nn.ModuleList([DiffusionConv(hidden, hidden, 2, adaptive=True, n_nodes=n_nodes) for _ in range(layers)])
        self.head = _Head(hidden, horizon)

    def forward(self, batch):
        z = self.inp(_inputs(batch))  # [B, T, N, H]
        B, T, N, H = z.shape
        x = z.permute(0, 2, 3, 1).reshape(B * N, H, T)
        A = self.A_static[None].expand(B, N, N)
        skip = 0
        for i, (f, g, gc) in enumerate(zip(self.filt, self.gate, self.gcn)):
            d = 2 ** i
            xp = F.pad(x, (d, 0))  # causal dilation
            y = torch.tanh(f(xp)) * torch.sigmoid(g(xp))  # [B*N, H, T]
            yl = y[..., -1].view(B, N, H)
            yl = gc(yl, A)
            skip = skip + yl
            x = x + y
        return _out(self.head(torch.relu(skip)))


REGISTRY = {"lstm": LSTMBaseline, "cnn_lstm": CNNLSTM, "convlstm_base": ConvLSTMBaseline, "pm25gnn": PM25GNN, "graph_wavenet": GraphWaveNet}
