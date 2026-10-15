"""MW-AeroFusion-Net and its ladder rungs M0..M6 (PROGRESS §5 P3) as config switches on one module.

Batch (PROGRESS §3.9, numpy loader -> torch): x_node [B,T,N,F] (normalised, NaN -> 0), m_node [B,T,N,F],
x_grid [B,Tg,C,H,W] (optional), wind_uv [B,N,2] (raw m/s, mean of the last 6 usable hours; for edge directions),
y [B,48,N], y_mask [B,48,N]. forward(batch) -> {"pred": [B,48,N] (normalised target), "gates": [B,N,G] | None,
"aux_loss": scalar}.

Order: (wavelet bands appended) -> per-group projection, mixed by gates (M6) or one linear projection -> temporal
encoder (GRU M0-M2 / Transformer M3+) -> + ConvLSTM grid context (M5+) -> graph diffusion with wind-aware static
adjacency (M1+) and adaptive adjacency (M2+) -> per-lead decoder.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import torch
from torch import nn

from .convlstm import GridContext
from .gating import GroupGate
from .graph import DiffusionConv, wind_alignment
from .temporal import GRUEncoder, TransformerEncoder
from .wavelet import CausalSWT

RUNGS = {
    "M0": dict(graph="none", temporal="gru", wavelet=False, convlstm=False, gating=False),
    "M1": dict(graph="static", temporal="gru", wavelet=False, convlstm=False, gating=False),
    "M2": dict(graph="adaptive", temporal="gru", wavelet=False, convlstm=False, gating=False),
    "M3": dict(graph="adaptive", temporal="transformer", wavelet=False, convlstm=False, gating=False),
    "M4": dict(graph="adaptive", temporal="transformer", wavelet=True, convlstm=False, gating=False),
    "M5": dict(graph="adaptive", temporal="transformer", wavelet=True, convlstm=True, gating=False),
    "M6": dict(graph="adaptive", temporal="transformer", wavelet=True, convlstm=True, gating=True),
}


@dataclass
class Config:
    n_feat: int
    n_nodes: int
    groups: list[str]  # feature group per feature (features_v1.yaml order)
    wavelet_feats: list[int] = field(default_factory=list)  # e.g. indices of pm25, pm10
    grid_channels: int = 8
    horizon: int = 48
    hidden: int = 64
    graph: str = "adaptive"  # none | static | adaptive
    temporal: str = "transformer"  # gru | transformer
    wavelet: bool = True
    convlstm: bool = True
    gating: bool = True
    wavelet_levels: int = 3
    grid_hidden: int = 16
    diffusion_k: int = 2
    entropy_weight: float = 0.01
    n_future: int = 0  # >0 for S-B (CAMS forecast per lead) or S-C (true future met, upper bound only): x_fut [B,48,N,n_future]

    @classmethod
    def rung(cls, name: str, **kw) -> "Config":
        return cls(**{**RUNGS[name], **kw})


class MWAFN(nn.Module):
    def __init__(self, cfg: Config, A_static: torch.Tensor | None = None, bearing: torch.Tensor | None = None, node_xy: torch.Tensor | None = None):
        super().__init__()
        self.cfg = cfg
        H = cfg.hidden
        self.wavelet = CausalSWT(levels=cfg.wavelet_levels) if cfg.wavelet and cfg.wavelet_feats else None
        n_wav = len(cfg.wavelet_feats) * (cfg.wavelet_levels + 1) if self.wavelet else 0
        # channel -> group: features, their masks (same group), wavelet bands (group of the source feature)
        self.chan_groups = list(cfg.groups) + list(cfg.groups) + [cfg.groups[i] for i in cfg.wavelet_feats for _ in range(cfg.wavelet_levels + 1)][:n_wav]
        self.group_names = sorted(set(self.chan_groups))
        n_in = 2 * cfg.n_feat + n_wav
        if cfg.gating:
            idx = {g: [i for i, cg in enumerate(self.chan_groups) if cg == g] for g in self.group_names}
            self.group_idx = idx  # plain int lists: index on any device
            self.proj = nn.ModuleDict({g: nn.Linear(len(v), H) for g, v in idx.items()})
            self.gate = GroupGate({g: 2 * len(v) for g, v in idx.items()}, hidden=H)
        else:
            self.inp = nn.Linear(n_in, H)
        self.encoder = GRUEncoder(H, H) if cfg.temporal == "gru" else TransformerEncoder(H, H)
        self.grid = GridContext(cfg.grid_channels, cfg.grid_hidden) if cfg.convlstm else None
        d = H + (cfg.grid_hidden if cfg.convlstm else 0)
        if cfg.graph != "none":
            if A_static is None or bearing is None:
                raise ValueError("graph rungs need A_static and bearing")
            self.register_buffer("A_static", A_static.float())
            self.register_buffer("bearing", bearing.float())  # [i, j]: bearing from sender j to receiver i
            self.gconv = nn.ModuleList([DiffusionConv(d, d, cfg.diffusion_k, cfg.graph == "adaptive", cfg.n_nodes) for _ in range(2)])
        if node_xy is not None:
            self.register_buffer("node_xy", node_xy.float())
        if cfg.n_future:
            self.fut = nn.Linear(cfg.n_future, d)
            self.dec = nn.Sequential(nn.Linear(d, 2 * H), nn.ELU(), nn.Linear(2 * H, 1))  # per-lead head on [node state + lead input]
        else:
            self.dec = nn.Sequential(nn.Linear(d, 2 * H), nn.ELU(), nn.Linear(2 * H, cfg.horizon))

    def forward(self, batch: dict) -> dict:
        x, m = batch["x_node"], batch["m_node"].to(batch["x_node"].dtype)
        chans = [torch.nan_to_num(x), m]
        if self.wavelet is not None:
            chans.append(self.wavelet(torch.nan_to_num(x[..., self.cfg.wavelet_feats])))
        z = torch.cat(chans, dim=-1)  # [B, T, N, Cin]
        gates, aux = None, z.new_zeros(())
        if self.cfg.gating:
            summ = {g: torch.cat([z[..., i].mean(1), z[:, -1, :, i]], dim=-1) for g, i in self.group_idx.items()}
            gates, ent = self.gate(summ)  # [B, N, G]
            aux = self.cfg.entropy_weight * ent
            # gate weight per node and group scales that group's projection at every time step (TFT-style selection)
            h = sum(gates[:, None, :, k, None] * self.proj[g](z[..., i]) for k, (g, i) in enumerate(self.group_idx.items()))
        else:
            h = self.inp(z)
        e = self.encoder(h)  # [B, N, H]
        if self.grid is not None:
            e = torch.cat([e, self.grid(torch.nan_to_num(batch["x_grid"]), self.node_xy)], dim=-1)
        if self.cfg.graph != "none":
            align = wind_alignment(batch["wind_uv"][..., 0], batch["wind_uv"][..., 1], self.bearing)
            A = self.A_static[None] * align
            for conv in self.gconv:
                e = e + torch.relu(conv(e, A))
        if self.cfg.n_future:
            pred = self.dec(e[:, None] + self.fut(torch.nan_to_num(batch["x_fut"]))).squeeze(-1)  # [B, 48, N]
        else:
            pred = self.dec(e).transpose(1, 2)  # [B, 48, N]
        return {"pred": pred, "gates": gates, "aux_loss": aux}


def masked_huber(pred: torch.Tensor, y: torch.Tensor, mask: torch.Tensor, delta: float = 1.0) -> torch.Tensor:
    """Huber on observed targets only (targets are never filled; §0 rule 3)."""
    mask = mask.to(pred.dtype)
    loss = nn.functional.huber_loss(pred, torch.nan_to_num(y), reduction="none", delta=delta)
    return (loss * mask).sum() / mask.sum().clamp(min=1.0)
