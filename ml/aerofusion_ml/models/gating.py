"""Source-group attribution gating (PROGRESS §2, rung M6). A variable-selection softmax over feature groups, in the
spirit of TFT (Lim et al. 2021, docs/related_work.md #13). The weights are a *learned attribution*, not a causal
source apportionment; they are validated in P4.4 (faithfulness, sanity, stability, plausibility).

Each group (fire, met, dust, traffic_proxy, cams, history, calendar, ...) is embedded separately from its per-node
summary; a per-node softmax over groups gives the weights. The sparsity term returned for the loss is the mean
entropy of the weights: an L1 penalty (as first planned) is constant for softmax weights, which always sum to 1 (§9).
"""

from __future__ import annotations

import torch
from torch import nn


class GroupGate(nn.Module):
    def __init__(self, group_dims: dict[str, int], hidden: int = 64):
        super().__init__()
        self.groups = list(group_dims)
        self.embed = nn.ModuleDict({g: nn.Sequential(nn.Linear(d, hidden), nn.ELU(), nn.Linear(hidden, hidden)) for g, d in group_dims.items()})
        self.score = nn.Linear(hidden * len(self.groups), len(self.groups))

    def forward(self, parts: dict[str, torch.Tensor]) -> tuple[torch.Tensor, torch.Tensor]:
        """parts[g] [B, N, d_g] (per-node summaries) -> (gates [B, N, G], entropy penalty scalar)."""
        e = torch.stack([self.embed[g](parts[g]) for g in self.groups], dim=-2)  # [B, N, G, H]
        w = torch.softmax(self.score(e.flatten(-2)), dim=-1)  # [B, N, G]
        entropy = -(w * torch.log(w.clamp(min=1e-8))).sum(-1).mean()
        return w, entropy
