"""P5.1: every rung exports to ONNX and onnxruntime reproduces torch (untrained toy weights)."""

import pytest
import torch

from aerofusion_ml.export_onnx import export
from aerofusion_ml.models import graph as gr
from aerofusion_ml.models.convlstm import node_xy
from aerofusion_ml.models.mwafn import MWAFN, Config
from test_models import GROUPS, LAT, LON, N, F, C


@pytest.mark.parametrize("rung,n_future", [("M0", 0), ("M6", 0), ("M6", 1)])
def test_onnx_matches_torch(tmp_path, rung, n_future):
    torch.manual_seed(0)
    A = torch.from_numpy(gr.static_adjacency(LAT, LON, k=3))
    _, bearing = gr.distance_bearing(LAT, LON)
    xy = node_xy(LAT, LON, torch.tensor([5.25, 37.5]), torch.tensor([66.25, 97.75]))
    cfg = Config.rung(rung, n_feat=F, n_nodes=N, groups=GROUPS, wavelet_feats=[0, 1], grid_channels=C, hidden=8, n_future=n_future)
    m = MWAFN(cfg, A, torch.from_numpy(bearing.T.copy()), xy)
    ex = {"x_node": torch.randn(1, 72, N, F), "m_node": torch.ones(1, 72, N, F), "wind_uv": torch.randn(1, N, 2)}
    if cfg.convlstm:
        ex["x_grid"] = torch.randn(1, 24, C, 44, 43)
    if n_future:
        ex["x_fut"] = torch.randn(1, 48, N, n_future)
    assert export(m, ex, tmp_path / "m.onnx") < 1e-3
