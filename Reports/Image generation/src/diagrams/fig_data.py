"""Data-driven figures in the approved style: one blue for every line, marker and fill; black text; transparent;
6.3 in wide with 9-10 pt text. Only train/val data and measured validation metrics are read; the frozen test years
are never touched.

Fig 1.1 station map, Fig 5.6 station graph, Fig 5.4 coverage, Fig 5.5 causal wavelet bands,
Fig 6.1 validation ladder, Fig 6.2 learning curves."""

import json
import sys
from math import asin, cos, radians, sin, sqrt
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.colors import LinearSegmentedColormap

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
ML = REPO / "ml"
OUT = HERE.parents[1] / "Final images"
sys.path.insert(0, str(ML))

BLUE, INK, SOFT = "#2F6EB5", "#1A1A1A", "#5E5E5E"
LIGHT = "#A9C3E3"          # light tint of the same blue, for secondary lines only
W = 6.3                    # full A4 text width, inches
plt.rcParams.update({
    "font.family": ["Segoe UI", "Arial"], "font.size": 9.5, "text.color": INK, "axes.edgecolor": BLUE, "axes.labelcolor": INK,
    "xtick.color": BLUE, "ytick.color": BLUE, "xtick.labelcolor": INK, "ytick.labelcolor": INK, "axes.linewidth": 0.9,
    "axes.spines.top": False, "axes.spines.right": False, "savefig.transparent": True, "figure.facecolor": "none",
    "axes.facecolor": "none", "legend.frameon": False, "lines.color": BLUE, "axes.titleweight": "bold",
})
VAL_RUNS = "20261114-{}-s0-e6b796e"
TEST_START = np.datetime64("2023-01-01")


def save(fig, name):
    fig.savefig(OUT / f"{name}.png", dpi=300, bbox_inches="tight", transparent=True)
    plt.close(fig)
    print("saved", name)


def india(ax):
    g = json.loads((HERE.parent / "data" / "india_geom.json").read_text())
    for poly in g["coordinates"]:
        ring = np.array(poly[0])
        if len(ring) < 40:
            continue
        ax.plot(ring[:, 0], ring[:, 1], color=BLUE, lw=0.9)
    ax.set_aspect(1 / cos(radians(22)))
    ax.set_xlim(67, 98)
    ax.set_ylim(6, 37.5)
    ax.axis("off")


def hav(a, b):
    la1, lo1, la2, lo2 = map(radians, (a[0], a[1], b[0], b[1]))
    h = sin((la2 - la1) / 2) ** 2 + cos(la1) * cos(la2) * sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371 * asin(sqrt(h))


def station_map():
    st = pd.read_csv(ML / "data" / "stations_v1.csv")
    cities = json.loads((REPO / "backend" / "app" / "data" / "cities.json").read_text(encoding="utf-8"))
    fig, ax = plt.subplots(figsize=(W, 6.6))
    india(ax)
    ax.scatter(st.longitude, st.latitude, s=16, color=BLUE, zorder=3, label=f"CPCB stations used ({len(st)})")
    reg = cities["source_regions"]
    ax.scatter([r["lon"] for r in reg], [r["lat"] for r in reg], s=50, marker="^", facecolor="none", edgecolor=BLUE, lw=1.2, zorder=3,
               label=f"upwind source regions ({len(reg)})")
    have = set(st.city)
    for c in cities["cities"]:
        if c["slug"] not in have:
            ax.scatter(c["lon"], c["lat"], s=40, facecolor="none", edgecolor=BLUE, lw=1.2, zorder=3)
    ax.scatter([], [], s=40, facecolor="none", edgecolor=BLUE, lw=1.2, label="cities without a station")
    for name in ("Delhi", "Mumbai", "Kolkata", "Chennai", "Bengaluru", "Hyderabad", "Ahmedabad", "Patna"):
        c = next((c for c in cities["cities"] if c["name"] == name), None)
        if c:
            off = {"Chennai": (8, -12), "Bengaluru": (-8, -14), "Mumbai": (-8, 6), "Hyderabad": (8, -12),
                   "Kolkata": (8, -10), "Patna": (-6, 9)}.get(name, (6, 4))
            ax.annotate(name, (c["lon"], c["lat"]), xytext=off, textcoords="offset points", fontsize=9.5, color=INK,
                        ha="right" if off[0] < 0 else "left")
    ax.legend(loc="upper center", fontsize=9.5, bbox_to_anchor=(0.5, 0.0), ncol=2)
    save(fig, "fig1_1_station_map")


def station_graph():
    nodes = pd.read_csv(ML / "data" / "nodes_v1.csv")
    pts = nodes[["lat", "lon"]].to_numpy()
    fig, ax = plt.subplots(figsize=(W, 6.6))
    india(ax)
    drawn = set()
    for i, p in enumerate(pts):
        dist = sorted(((hav(p, q), j) for j, q in enumerate(pts) if j != i))
        for dkm, j in dist[:8]:
            if dkm <= 600 and (j, i) not in drawn:
                drawn.add((i, j))
                ax.plot([p[1], pts[j][1]], [p[0], pts[j][0]], color=LIGHT, lw=0.6, zorder=1)
    k = nodes.kind
    ax.scatter(nodes.lon[k == "station"], nodes.lat[k == "station"], s=14, color=BLUE, zorder=3, label="station")
    ax.scatter(nodes.lon[k == "region"], nodes.lat[k == "region"], s=48, marker="^", facecolor="white", edgecolor=BLUE, lw=1.2, zorder=3, label="upwind region")
    ax.scatter(nodes.lon[k == "city"], nodes.lat[k == "city"], s=38, facecolor="white", edgecolor=BLUE, lw=1.2, zorder=3, label="city without station")
    ax.plot([], [], color=LIGHT, lw=1.2, label=f"edge: 8 nearest within 600 km ({len(drawn)})")
    ax.legend(loc="upper center", fontsize=9.5, bbox_to_anchor=(0.5, 0.0), ncol=2)
    save(fig, "fig5_6_station_graph")


def coverage():
    import xarray as xr
    ds = xr.open_zarr(ML / "data" / "processed" / "dataset_v1.zarr")
    stations = [str(n) for n, kd in zip(ds.node.values, ds.node_kind.values) if str(kd) == "station"]
    y = ds.y.sel(time=slice("2018-01-01", "2022-12-31"), node=stations)          # train + val only
    assert y.time.values.max() < TEST_START
    obs = (~np.isnan(y.load())).astype(float).resample(time="MS").mean()
    mat = obs.values.T
    order = np.argsort(-mat.mean(axis=1))
    fig, ax = plt.subplots(figsize=(W, 3.9))
    cmap = LinearSegmentedColormap.from_list("gaps", [BLUE, "#F3F6FA"])
    im = ax.imshow(mat[order], aspect="auto", cmap=cmap, vmin=0, vmax=1, interpolation="nearest")
    months = pd.DatetimeIndex(obs.time.values)
    ticks = [i for i, m in enumerate(months) if m.month == 1]
    ax.set_xticks(ticks, [str(months[i].year) for i in ticks])
    ax.set_yticks([])
    ax.set_ylabel(f"{len(stations)} stations, sorted by coverage")
    ax.axvline(ticks[-1] - 0.5, color=INK, lw=1.0, ls="--")
    ax.text(ticks[-1] + 0.4, -3, "val", fontsize=9.5, color=BLUE)
    ax.text(0.3, -3, "train", fontsize=9.5, color=BLUE)
    cb = fig.colorbar(im, ax=ax, fraction=0.035, pad=0.02)
    cb.set_label("share of hours with PM2.5 (blue = gaps)")
    cb.outline.set_edgecolor(BLUE)
    save(fig, "fig5_4_coverage_heatmap")


def wavelet():
    import torch
    import xarray as xr
    from aerofusion_ml.models.wavelet import CausalSWT
    ds = xr.open_zarr(ML / "data" / "processed" / "dataset_v1.zarr")
    delhi = [str(n) for n, c, kd in zip(ds.node.values, ds.node_city_slug.values, ds.node_kind.values) if str(c) == "delhi" and str(kd) == "station"]
    win = ds.y.sel(time=slice("2021-11-01T00", "2021-11-03T23"), node=delhi).load()   # train year
    assert win.time.values.max() < TEST_START
    s = win.mean("node").interpolate_na("time").values.astype("float32")             # plot only; the model never interpolates targets
    bands = CausalSWT(levels=3)(torch.from_numpy(s).view(1, -1, 1, 1)).view(-1, 4).numpy()
    names = ["detail d1", "detail d2", "detail d3", "approx. a3"]
    fig, axes = plt.subplots(5, 1, figsize=(W, 5.6), sharex=True, gridspec_kw={"height_ratios": [1.6, 1, 1, 1, 1.3]})
    h = np.arange(len(s)) - len(s)
    axes[0].plot(h, s, color=BLUE, lw=1.4)
    axes[0].set_ylabel("PM2.5\n(µg/m³)")
    for ax, b, n in zip(axes[1:], bands.T, names):
        ax.plot(h, b, color=BLUE, lw=1.1)
        if n.startswith("detail"):
            ax.axhline(0, color=LIGHT, lw=0.8)
        ax.set_ylabel(n)
    axes[-1].set_xlabel("hours before issue time t0 (Delhi city mean, Nov 2021)")
    fig.align_ylabels(axes)
    save(fig, "fig5_5_wavelet_bands")


def _val(name):
    m = json.loads((ML / "runs" / VAL_RUNS.format(name) / "metrics.json").read_text(encoding="utf-8"))
    assert m["status"] == "measured" and m["split"] == "val"
    return m


def ladder_val():
    rungs = [("M0", "m0_gru"), ("M1", "m1_static_graph"), ("M2", "m2_adaptive_graph"), ("M3", "m3_transformer"),
             ("M4", "m4_wavelet"), ("M5", "m5_convlstm"), ("M6", "m6_mwafn")]
    base = [("persistence", "persistence", (0, (1, 2))), ("climatology", "climatology", (0, (8, 3))),
            ("CAMS bias-corrected", "cams_bc", (0, (5, 2, 1, 2))), ("LightGBM (S-A)", "lgbm_sa", (0, (3, 1.5, 1, 1.5, 1, 1.5)))]
    fig, axes = plt.subplots(1, 3, figsize=(W, 3.2), layout="constrained")
    for ax, L in zip(axes, ("1", "24", "48")):
        v = [_val(r)["leads"][L]["station"]["rmse"] for _, r in rungs]
        ax.plot(range(7), v, color=BLUE, marker="o", ms=3.5, lw=1.6, label="ladder M0-M6")
        for lab, r, ls in base:
            ax.axhline(_val(r)["leads"][L]["station"]["rmse"], color=BLUE, lw=0.9, ls=ls, label=lab)
        ax.set_xticks(range(7), [n for n, _ in rungs], fontsize=8)
        ax.set_title(f"+{L} h", fontsize=10)
        ax.tick_params(labelsize=8)
    axes[0].set_ylabel("station RMSE (µg/m³)")
    h, l = axes[0].get_legend_handles_labels()
    fig.legend(h, l, fontsize=8.5, loc="outside lower center", ncol=3)
    save(fig, "fig6_1_ladder_validation")


def learning_curves():
    rungs = [("M0", "m0_gru", "-"), ("M2", "m2_adaptive_graph", "--"), ("M3", "m3_transformer", "-."), ("M5", "m5_convlstm", ":"), ("M6", "m6_mwafn", "-")]
    fig, ax = plt.subplots(figsize=(W, 3.1))
    for n, r, ls in rungs:
        log = _val(r)["training"]["log"]
        e = [x["epoch"] for x in log]
        v = [x["val_rmse_ugm3"] for x in log]
        ax.plot(e, v, color=BLUE if n in ("M0", "M6") else LIGHT, ls=ls, lw=2.0 if n == "M6" else 1.2,
                marker="o" if n == "M6" else None, ms=3, label=n)
        b = int(np.argmin(v))
        ax.plot(e[b], v[b], marker="o", ms=6, mfc="white", mec=BLUE, mew=1.2)
    ax.set_xlabel("epoch")
    ax.set_ylabel("validation RMSE (µg/m³)")
    ax.legend(fontsize=9, ncol=5, loc="upper center", bbox_to_anchor=(0.5, 1.15))
    save(fig, "fig6_2_learning_curves")


if __name__ == "__main__":
    station_map()
    station_graph()
    coverage()
    wavelet()
    ladder_val()
    learning_curves()
