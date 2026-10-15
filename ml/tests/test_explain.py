"""P4.4 checks run on a toy M6 (untrained); they must produce numbers and pass/fail flags, not crash."""

import numpy as np
import torch

from aerofusion_ml import explain
from aerofusion_ml.models import graph as gr
from aerofusion_ml.models.convlstm import node_xy
from aerofusion_ml.models.mwafn import MWAFN, Config
from test_models import GROUPS, LAT, LON, B, N, F, C, _batch


def _m6():
    torch.manual_seed(0)
    A = torch.from_numpy(gr.static_adjacency(LAT, LON, k=3))
    _, bearing = gr.distance_bearing(LAT, LON)
    xy = node_xy(LAT, LON, torch.tensor([5.25, 37.5]), torch.tensor([66.25, 97.75]))
    return MWAFN(Config.rung("M6", n_feat=F, n_nodes=N, groups=GROUPS, wavelet_feats=[0, 1], grid_channels=C, hidden=8), A, torch.from_numpy(bearing.T.copy()), xy)


def test_faithfulness_and_ig():
    r = explain.faithfulness(_m6(), _batch(), k=2, n_random=5)
    assert {"delta_top_gate", "delta_top_ig", "delta_random_mean", "pass"} <= set(r) and len(r["top_gate_groups"]) == 2


def test_sanity_randomisation_changes_gates():
    r = explain.sanity_randomisation(_m6(), _batch())
    assert r["steps"] and isinstance(r["pass"], bool) and abs(r["final_spearman"]) < 0.99


def test_stability_and_plausibility():
    g = [np.array([0.5, 0.3, 0.2]), np.array([0.45, 0.35, 0.2]), np.array([0.2, 0.3, 0.5])]
    s = explain.stability(g)
    assert s["pairs"] == 3 and s["mean_spearman"] < 1
    rng = np.random.default_rng(0)
    ref = rng.poisson(5, 500).astype(float)
    assert explain.plausibility(ref + rng.normal(0, 1, 500), ref)["pass"]
    assert not explain.plausibility(rng.normal(size=500), ref)["pass"]
