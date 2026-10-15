"""Attribution validation for source-group gating (PROGRESS P4.4). Every check returns numbers + a pass flag, and a
failed check is reported as failed (no re-running until it passes).

(a) faithfulness  deletion: zero one group's input channels and measure the error increase; groups ranked by gate
                  weight should hurt more than random groups and about as much as groups ranked by Integrated Gradients
(b) sanity        Adebayo et al. 2018: randomise weights layer by layer from the top; gates must change (low rank
                  correlation with the trained model's gates)
(c) stability     Spearman correlation of mean group weights across seeds
(d) plausibility  e.g. fire-group weight vs FIRMS upwind counts for IGP stations in Oct-Nov (Spearman)
(e) SHAP          for the LightGBM baseline, LightGBM's own TreeSHAP (pred_contrib=True), grouped like the gates
Integrated Gradients is implemented directly (Riemann sum from a zero baseline) to avoid another dependency.
"""

from __future__ import annotations

import copy

import numpy as np
import torch
from scipy import stats


def _group_channels(model, group: str) -> list[int]:
    """Feature indices (in x_node) belonging to a group."""
    return [i for i, g in enumerate(model.cfg.groups) if g == group]


def _masked(batch: dict, idx: list[int]) -> dict:
    b = dict(batch)
    b["x_node"] = batch["x_node"].clone()
    b["m_node"] = batch["m_node"].clone()
    b["x_node"][..., idx] = 0.0
    b["m_node"][..., idx] = 0
    return b


@torch.no_grad()
def _err(model, batch) -> float:
    p = model(batch)["pred"]
    m = batch["y_mask"].float()
    return float((((p - torch.nan_to_num(batch["y"])) ** 2) * m).sum() / m.sum().clamp(min=1))


def integrated_gradients(model, batch: dict, steps: int = 16) -> torch.Tensor:
    """|IG| summed over time and nodes per x_node feature -> [F]."""
    x = batch["x_node"]
    total = torch.zeros_like(x)
    for a in torch.linspace(1.0 / steps, 1.0, steps):
        b = dict(batch)
        xi = (a * x).detach().requires_grad_(True)
        b["x_node"] = xi
        model(b)["pred"].sum().backward()
        total += xi.grad
    return (x * total / steps).abs().sum(dim=(0, 1, 2))


def faithfulness(model, batch: dict, k: int = 2, n_random: int = 20, seed: int = 0) -> dict:
    model.eval()
    groups = model.group_names
    gates = model(batch)["gates"].mean(dim=(0, 1)).detach().numpy()
    ig = integrated_gradients(model, batch).detach().numpy()
    ig_g = np.array([ig[_group_channels(model, g)].sum() for g in groups])
    base = _err(model, batch)

    def drop(gs):
        idx = sorted({i for g in gs for i in _group_channels(model, g)})
        return _err(model, _masked(batch, idx)) - base

    top_gate = [groups[i] for i in np.argsort(-gates)[:k]]
    top_ig = [groups[i] for i in np.argsort(-ig_g)[:k]]
    rng = np.random.default_rng(seed)
    rand = [drop(list(rng.choice(groups, k, replace=False))) for _ in range(n_random)]
    d_gate, d_ig = drop(top_gate), drop(top_ig)
    return {"k": k, "base_mse": base, "delta_top_gate": d_gate, "delta_top_ig": d_ig, "delta_random_mean": float(np.mean(rand)),
            "top_gate_groups": top_gate, "top_ig_groups": top_ig, "gate_vs_ig_spearman": float(stats.spearmanr(gates, ig_g)[0]),
            "pass": bool(d_gate > np.mean(rand))}


def sanity_randomisation(model, batch: dict, threshold: float = 0.5) -> dict:
    """Cascading randomisation from the output layer down; returns Spearman(trained gates, randomised gates) per step."""
    model.eval()
    ref = model(batch)["gates"].detach().reshape(-1).numpy()
    m = copy.deepcopy(model)
    names = [n for n, _ in m.named_modules() if any(True for _ in _.parameters(recurse=False))][::-1]
    out = []
    torch.manual_seed(0)
    for n in names:
        mod = dict(m.named_modules())[n]
        for p in mod.parameters(recurse=False):
            torch.nn.init.normal_(p, std=0.1)
        g = m(batch)["gates"].detach().reshape(-1).numpy()
        out.append({"layer": n, "spearman": float(stats.spearmanr(ref, g)[0])})
    final = out[-1]["spearman"] if out else 1.0
    return {"steps": out, "final_spearman": final, "pass": bool(abs(final) < threshold)}


def stability(mean_gates_per_seed: list[np.ndarray]) -> dict:
    """mean_gates_per_seed: list of [G] vectors (same group order). Mean pairwise Spearman."""
    rs = [stats.spearmanr(a, b)[0] for i, a in enumerate(mean_gates_per_seed) for b in mean_gates_per_seed[i + 1:]]
    return {"pairs": len(rs), "mean_spearman": float(np.mean(rs)) if rs else None, "pass": bool(rs and np.mean(rs) > 0.6)}


def plausibility(weights: np.ndarray, reference: np.ndarray, min_rho: float = 0.2) -> dict:
    """e.g. fire-group weight per (station, day) vs FIRMS upwind count; one-sided expectation rho > 0."""
    ok = ~(np.isnan(weights) | np.isnan(reference))
    rho, p = stats.spearmanr(weights[ok], reference[ok])
    return {"n": int(ok.sum()), "spearman": float(rho), "p": float(p), "pass": bool(rho > min_rho and p < 0.05)}


def lgbm_shap_by_group(booster, X, col_groups: dict[str, str]) -> dict[str, float]:
    """Mean |TreeSHAP| per group for the LightGBM baseline (P4.4 e)."""
    contrib = booster.predict(X, pred_contrib=True)[:, :-1]  # last column = expected value
    out: dict[str, float] = {}
    for j, c in enumerate(X.columns):
        g = col_groups.get(c, "other")
        out[g] = out.get(g, 0.0) + float(np.abs(contrib[:, j]).mean())
    return out
