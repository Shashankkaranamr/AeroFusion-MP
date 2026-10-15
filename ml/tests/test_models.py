"""P3 model components: shapes, every ladder rung runs forward/backward, graph geometry, gating, masked loss."""

import numpy as np
import pytest
import torch

from aerofusion_ml.models import graph as gr
from aerofusion_ml.models.convlstm import node_xy
from aerofusion_ml.models.mwafn import MWAFN, RUNGS, Config, masked_huber

B, T, N, F, TG, C = 2, 72, 6, 7, 24, 8
GROUPS = ["history", "history", "met", "met", "fire", "cams", "calendar"]
LAT = np.array([28.6, 28.7, 30.7, 26.8, 22.6, 19.1])
LON = np.array([77.2, 77.1, 76.8, 80.9, 88.4, 72.9])


def _batch():
    torch.manual_seed(0)
    x = torch.randn(B, T, N, F)
    x[0, :5, 0, 0] = float("nan")
    y = torch.randn(B, 48, N)
    return {"x_node": x, "m_node": (~torch.isnan(x)).to(torch.uint8), "x_grid": torch.randn(B, TG, C, 44, 43),
            "wind_uv": torch.randn(B, N, 2), "y": y, "y_mask": torch.ones(B, 48, N, dtype=torch.uint8)}


def _model(rung):
    A = torch.from_numpy(gr.static_adjacency(LAT, LON, k=3))
    _, bearing = gr.distance_bearing(LAT, LON)
    xy = node_xy(LAT, LON, torch.tensor([5.25, 37.5]), torch.tensor([66.25, 97.75]))
    cfg = Config.rung(rung, n_feat=F, n_nodes=N, groups=GROUPS, wavelet_feats=[0, 1], grid_channels=C, hidden=16)
    return MWAFN(cfg, A, torch.from_numpy(bearing.T.copy()), xy)


@pytest.mark.parametrize("rung", list(RUNGS))
def test_every_rung_runs_and_learns_a_step(rung):
    m, b = _model(rung), _batch()
    out = m(b)
    assert out["pred"].shape == (B, 48, N) and torch.isfinite(out["pred"]).all()
    assert (out["gates"] is not None) == (rung == "M6")
    loss = masked_huber(out["pred"], b["y"], b["y_mask"]) + out["aux_loss"]
    loss.backward()
    no_grad = [n for n, p in m.named_parameters() if p.requires_grad and p.grad is None]
    assert not no_grad, no_grad


def test_gates_are_a_distribution_over_groups():
    out = _model("M6")(_batch())
    g = out["gates"]
    assert g.shape[-1] == len(set(GROUPS)) and torch.allclose(g.sum(-1), torch.ones(B, N), atol=1e-5)


def test_static_adjacency_knn_and_range():
    A = gr.static_adjacency(LAT, LON, k=3, max_km=600)
    assert (np.diag(A) == 0).all() and ((A > 0).sum(1) <= 3).all()
    assert A[0, 1] > 0 and A[0, 4] == 0  # Delhi-Delhi near, Delhi-Kolkata > 600 km


def test_wind_alignment_upwind_edge_positive_only():
    _, bear = gr.distance_bearing(np.array([30.0, 28.0]), np.array([77.0, 77.0]))  # node 0 north of node 1
    bearing_ij = torch.from_numpy(bear.T.copy()).float()  # [i, j] = bearing from sender j to receiver i
    u, v = torch.tensor([[0.0, 0.0]]), torch.tensor([[-3.0, -3.0]])  # northerly wind: air moves south
    a = gr.wind_alignment(u, v, bearing_ij)[0]
    assert a[1, 0] > 0.99 and a[0, 1] == 0  # sender 0 (north) feeds receiver 1 (south), not the reverse


def test_masked_huber_ignores_masked_targets():
    p, y = torch.zeros(1, 2, 1), torch.tensor([[[1.0], [float("nan")]]])
    mask = torch.tensor([[[1], [0]]])
    assert masked_huber(p, y, mask).item() == pytest.approx(0.5)


@pytest.mark.parametrize("name", ["lstm", "cnn_lstm", "convlstm_base", "pm25gnn", "graph_wavenet"])
def test_neural_baselines_forward_backward(name):
    from aerofusion_ml.models.neural_baselines import REGISTRY

    A = torch.from_numpy(gr.static_adjacency(LAT, LON, k=3))
    _, bearing = gr.distance_bearing(LAT, LON)
    xy = node_xy(LAT, LON, torch.tensor([5.25, 37.5]), torch.tensor([66.25, 97.75]))
    m = REGISTRY[name](n_feat=F, hidden=16, n_nodes=N, grid_channels=C, node_xy=xy, A_static=A, bearing=torch.from_numpy(bearing.T.copy()))
    b = _batch()
    out = m(b)
    assert out["pred"].shape == (B, 48, N) and out["gates"] is None and torch.isfinite(out["pred"]).all()
    masked_huber(out["pred"], b["y"], b["y_mask"]).backward()
    assert not [n for n, p in m.named_parameters() if p.grad is None]


def test_cnn_lstm_conv_is_causal_within_window():
    from aerofusion_ml.models.neural_baselines import CNNLSTM

    m = CNNLSTM(n_feat=F, hidden=8)
    z = torch.randn(1, 2 * F, 72)
    z2 = z.clone(); z2[..., 40:] += 50
    torch.testing.assert_close(m.conv(z)[..., :40], m.conv(z2)[..., :40])
