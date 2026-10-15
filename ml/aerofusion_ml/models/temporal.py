"""Per-node temporal encoders (rungs M0 GRU, M3 Transformer). Input [B, T, N, D] -> [B, N, H] (last state / pooled)."""

from __future__ import annotations

import math

import torch
from torch import nn


class GRUEncoder(nn.Module):
    def __init__(self, d_in: int, hidden: int = 64, layers: int = 1):
        super().__init__()
        self.gru = nn.GRU(d_in, hidden, num_layers=layers, batch_first=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, T, N, D = x.shape
        _, h = self.gru(x.permute(0, 2, 1, 3).reshape(B * N, T, D))
        return h[-1].view(B, N, -1)


class TransformerEncoder(nn.Module):
    """Causal self-attention over the window (each step attends to itself and the past); returns the last step."""

    def __init__(self, d_in: int, hidden: int = 64, heads: int = 4, layers: int = 2, max_len: int = 168, dropout: float = 0.1):
        super().__init__()
        self.inp = nn.Linear(d_in, hidden)
        pe = torch.zeros(max_len, hidden)
        pos = torch.arange(max_len)[:, None]
        div = torch.exp(torch.arange(0, hidden, 2) * (-math.log(10000.0) / hidden))
        pe[:, 0::2], pe[:, 1::2] = torch.sin(pos * div), torch.cos(pos * div)
        self.register_buffer("pe", pe)
        layer = nn.TransformerEncoderLayer(hidden, heads, 2 * hidden, dropout, batch_first=True)
        self.enc = nn.TransformerEncoder(layer, layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, T, N, D = x.shape
        h = self.inp(x.permute(0, 2, 1, 3).reshape(B * N, T, D)) + self.pe[:T]
        mask = torch.triu(torch.full((T, T), float("-inf"), device=x.device), diagonal=1)
        return self.enc(h, mask=mask)[:, -1].view(B, N, -1)
