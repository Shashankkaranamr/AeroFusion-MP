"""M4: the wavelet bands at hour t must not depend on any sample after t (PROGRESS §0 rule 3)."""

import torch

from aerofusion_ml.models.wavelet import CausalSWT


def test_shape():
    w = CausalSWT(levels=3)
    assert w(torch.randn(2, 72, 5, 2)).shape == (2, 72, 5, 8)


def test_bands_are_causal():
    torch.manual_seed(0)
    w = CausalSWT(levels=3)
    x = torch.randn(1, 72, 3, 1)
    for t in [0, 10, 40, 70]:
        y = x.clone()
        y[:, t + 1:] += 100.0 * torch.randn_like(y[:, t + 1:])
        torch.testing.assert_close(w(x)[:, : t + 1], w(y)[:, : t + 1])


def test_constant_signal_has_zero_details_and_keeps_level():
    w = CausalSWT(levels=3)
    b = w(torch.full((1, 72, 1, 1), 7.0))[0, :, 0]  # (d1, d2, d3, a3)
    torch.testing.assert_close(b[:, :3], torch.zeros(72, 3), atol=1e-4, rtol=0)
    torch.testing.assert_close(b[:, 3], torch.full((72,), 7.0), atol=1e-4, rtol=0)
