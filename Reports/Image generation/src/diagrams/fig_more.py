"""Additional report figures (Nov 2026 revision).

Maps: the CPCB panel and the model graph drawn over NASA Blue Marble imagery (GIBS WMS, public domain), so the reader
sees the real terrain the stations sit in. Graphs: validation-year (2022) breakdowns read from ml/runs/*/metrics.json
(status "measured", split "val"). No test-year data is read anywhere.

    python -I "Reports/Image generation/src/diagrams/fig_more.py"
"""
import json
from math import asin, cos, radians, sin, sqrt
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from PIL import Image

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
ML = REPO / "ml"
OUT = HERE.parents[1] / "Final images"
DATA = HERE.parent / "data"
EXTENT = (67.0, 98.0, 6.0, 37.5)          # lon0, lon1, lat0, lat1 of the GIBS request

BLUE, INK, SOFT = "#2F6EB5", "#1A1A1A", "#5E5E5E"
SHADES = ["#0F3B6E", "#2F6EB5", "#6E9BD3", "#A9C3E3", "#D5E2F2"]
ORANGE = "#E07B39"
W = 6.3
plt.rcParams.update({
    "font.family": ["Segoe UI", "Arial"], "font.size": 9.5, "text.color": INK, "axes.edgecolor": BLUE, "axes.labelcolor": INK,
    "xtick.color": BLUE, "ytick.color": BLUE, "xtick.labelcolor": INK, "ytick.labelcolor": INK, "axes.linewidth": 0.9,
    "axes.spines.top": False, "axes.spines.right": False, "figure.facecolor": "white", "axes.facecolor": "white",
    "legend.frameon": False, "axes.titleweight": "bold",
})


def save(fig, name):
    fig.savefig(OUT / f"{name}.png", dpi=300, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print("saved", name)


def hav(a, b):
    la1, lo1, la2, lo2 = map(radians, (a[0], a[1], b[0], b[1]))
    h = sin((la2 - la1) / 2) ** 2 + cos(la1) * cos(la2) * sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371 * asin(sqrt(h))


# ------------------------------------------------------------------------------------------------ maps on real imagery
def basemap(ax):
    img = np.asarray(Image.open(DATA / "BlueMarble_ShadedRelief_Bathymetry.jpg"))
    ax.imshow(img, extent=EXTENT, origin="upper", zorder=0)
    g = json.loads((DATA / "india_geom.json").read_text())
    for poly in g["coordinates"]:
        ring = np.array(poly[0])
        if len(ring) >= 40:
            ax.plot(ring[:, 0], ring[:, 1], color="white", lw=0.7, alpha=0.85, zorder=1)
    ax.set_aspect(1 / cos(radians(22)))
    ax.set_xlim(EXTENT[0], EXTENT[1])
    ax.set_ylim(EXTENT[2], EXTENT[3])
    ax.set_xticks([70, 75, 80, 85, 90, 95], [f"{x}°E" for x in (70, 75, 80, 85, 90, 95)], fontsize=8)
    ax.set_yticks([10, 15, 20, 25, 30, 35], [f"{y}°N" for y in (10, 15, 20, 25, 30, 35)], fontsize=8)
    for s in ax.spines.values():
        s.set_visible(True)
        s.set_edgecolor("#888888")


def station_map_real():
    st = pd.read_csv(ML / "data" / "stations_v1.csv")
    cities = json.loads((REPO / "backend" / "app" / "data" / "cities.json").read_text(encoding="utf-8"))
    fig, ax = plt.subplots(figsize=(W, 6.4))
    basemap(ax)
    ax.scatter(st.longitude, st.latitude, s=18, color="#FFD23F", edgecolor="#1A1A1A", lw=0.4, zorder=3, label=f"CPCB stations used ({len(st)})")
    reg = cities["source_regions"]
    ax.scatter([r["lon"] for r in reg], [r["lat"] for r in reg], s=58, marker="^", facecolor="none", edgecolor="#FF5A36", lw=1.5, zorder=3,
               label=f"upwind source regions ({len(reg)})")
    have = set(st.city)
    miss = [c for c in cities["cities"] if c["slug"] not in have]
    ax.scatter([c["lon"] for c in miss], [c["lat"] for c in miss], s=48, facecolor="none", edgecolor="white", lw=1.5, zorder=3)
    ax.scatter([], [], s=48, facecolor="none", edgecolor="#555555", lw=1.5, label="platform cities without a station")
    for name in ("Delhi", "Mumbai", "Kolkata", "Chennai", "Bengaluru", "Hyderabad", "Ahmedabad", "Patna"):
        c = next((c for c in cities["cities"] if c["name"] == name), None)
        if c:
            off = {"Chennai": (8, -12), "Bengaluru": (-8, -14), "Mumbai": (-8, 6), "Hyderabad": (8, -12),
                   "Kolkata": (8, -10), "Patna": (-6, 9)}.get(name, (6, 4))
            t = ax.annotate(name, (c["lon"], c["lat"]), xytext=off, textcoords="offset points", fontsize=9, color="white",
                            fontweight="bold", ha="right" if off[0] < 0 else "left", zorder=4)
            t.set_path_effects([matplotlib.patheffects.withStroke(linewidth=2.2, foreground="#1A1A1A")])
    ax.legend(loc="upper center", fontsize=9, bbox_to_anchor=(0.5, -0.06), ncol=2)
    ax.text(0.99, 0.01, "Imagery: NASA Blue Marble (GIBS)", transform=ax.transAxes, ha="right", va="bottom", fontsize=7, color="white")
    save(fig, "fig1_1_station_map_real")


def station_graph_real():
    nodes = pd.read_csv(ML / "data" / "nodes_v1.csv")
    pts = nodes[["lat", "lon"]].to_numpy()
    fig, ax = plt.subplots(figsize=(W, 6.4))
    basemap(ax)
    drawn = set()
    for i, p in enumerate(pts):
        dist = sorted(((hav(p, q), j) for j, q in enumerate(pts) if j != i))
        for dkm, j in dist[:8]:
            if dkm <= 600 and (j, i) not in drawn:
                drawn.add((i, j))
                ax.plot([p[1], pts[j][1]], [p[0], pts[j][0]], color="#BFE3FF", lw=0.55, alpha=0.8, zorder=1)
    k = nodes.kind
    ax.scatter(nodes.lon[k == "station"], nodes.lat[k == "station"], s=16, color="#FFD23F", edgecolor="#1A1A1A", lw=0.4, zorder=3, label="station")
    ax.scatter(nodes.lon[k == "region"], nodes.lat[k == "region"], s=54, marker="^", facecolor="none", edgecolor="#FF5A36", lw=1.5, zorder=3, label="upwind region")
    ax.scatter(nodes.lon[k == "city"], nodes.lat[k == "city"], s=44, facecolor="none", edgecolor="white", lw=1.5, zorder=3)
    ax.scatter([], [], s=44, facecolor="none", edgecolor="#555555", lw=1.5, label="city without station")
    ax.plot([], [], color="#7FB8E6", lw=1.4, label=f"edge: 8 nearest within 600 km ({len(drawn)})")
    ax.legend(loc="upper center", fontsize=9, bbox_to_anchor=(0.5, -0.06), ncol=2)
    ax.text(0.99, 0.01, "Imagery: NASA Blue Marble (GIBS)", transform=ax.transAxes, ha="right", va="bottom", fontsize=7, color="white")
    save(fig, "fig4_7_station_graph_real")


# ------------------------------------------------------------------------------------------------ validation graphs
RUN = "20261114-{}-s0-e6b796e"


def met(run_dir):
    m = json.loads((ML / "runs" / run_dir / "metrics.json").read_text(encoding="utf-8"))
    assert m["status"] == "measured" and m["split"] == "val", run_dir
    return m


def val(name):
    return met(RUN.format(name))


MODELS = [("Persistence", "persistence"), ("LightGBM (S-A)", "lgbm_sa"), ("LSTM", "base_lstm"), ("M0 GRU", "m0_gru"),
          ("M4 + wavelet", "m4_wavelet"), ("M6 MW-AeroFusion-Net", "m6_mwafn")]


def season_rmse():
    seasons = [("winter_DJF", "Winter\n(Dec-Feb)"), ("premonsoon_MAM", "Pre-monsoon\n(Mar-May)"),
               ("monsoon_JJAS", "Monsoon\n(Jun-Sep)"), ("postmonsoon_ON", "Post-monsoon\n(Oct-Nov)")]
    fig, ax = plt.subplots(figsize=(W, 3.3))
    w = 0.13
    cols = ["#BBBBBB"] + SHADES
    for k, (lab, r) in enumerate(MODELS):
        v = [val(r)["leads"]["24"]["by_season"][s]["rmse"] for s, _ in seasons]
        ax.bar(np.arange(4) + (k - 2.5) * w, v, w, color=cols[k], edgecolor="white", lw=0.4, label=lab)
    ax.set_xticks(range(4), [n for _, n in seasons])
    ax.set_ylabel("station RMSE at +24 h (µg/m³)")
    ax.legend(fontsize=8, ncol=3, loc="upper center", bbox_to_anchor=(0.5, 1.22))
    save(fig, "fig5_3_season_rmse")


def city_rmse():
    m0, lg, pe = val("m0_gru"), val("lgbm_sa"), val("persistence")
    cities = sorted(m0["leads"]["24"]["by_city"], key=lambda c: m0["leads"]["24"]["by_city"][c]["rmse"])
    fig, ax = plt.subplots(figsize=(W, 6.0))
    y = np.arange(len(cities))
    get = lambda m, c: m["leads"]["24"]["by_city"][c]["rmse"]
    ax.barh(y, [get(pe, c) for c in cities], 0.8, color="#E3E3E3", label="Persistence")
    ax.scatter([get(lg, c) for c in cities], y, s=22, marker="D", color=ORANGE, zorder=3, label="LightGBM (S-A)")
    ax.scatter([get(m0, c) for c in cities], y, s=26, color=BLUE, zorder=4, label="M0 GRU")
    ax.set_yticks(y, [c.replace("thiruvananthapuram", "Thiruvananthapuram").title() for c in cities], fontsize=8)
    ax.set_xlabel("station RMSE at +24 h (µg/m³), validation 2022")
    ax.legend(fontsize=8.5, ncol=3, loc="lower right")
    ax.invert_yaxis()
    save(fig, "fig5_4_city_rmse")


def seed_spread():
    fig, axes = plt.subplots(1, 3, figsize=(W, 2.9), layout="constrained")
    groups = [("M6 (S-A)", "m6_mwafn", BLUE), ("M6 (S-B)", "m6_mwafn_sb", ORANGE)]
    for ax, L in zip(axes, ("1", "24", "48")):
        for x, (lab, r, col) in enumerate(groups):
            v = [met(f"20261114-{r}-s0-e6b796e")["leads"][L]["station"]["rmse"]] + \
                [met(f"20261120-{r}-s{s}-e6b796e")["leads"][L]["station"]["rmse"] for s in (1, 2, 3, 4)]
            ax.scatter(np.full(5, x) + np.linspace(-0.12, 0.12, 5), v, s=20, color=col, zorder=3)
            ax.hlines(np.mean(v), x - 0.25, x + 0.25, color=INK, lw=1.4)
        ax.axhline(val("m0_gru")["leads"][L]["station"]["rmse"], color=SOFT, ls="--", lw=1, label="M0 GRU (seed 0)")
        ax.axhline(val("lgbm_sa")["leads"][L]["station"]["rmse"], color=SOFT, ls=":", lw=1.2, label="LightGBM (S-A)")
        ax.set_xticks([0, 1], [g[0] for g in groups], fontsize=8)
        ax.set_xlim(-0.6, 1.6)
        ax.set_title(f"+{L} h", fontsize=10)
        ax.tick_params(labelsize=8)
    axes[0].set_ylabel("station RMSE (µg/m³)")
    h, l = axes[0].get_legend_handles_labels()
    fig.legend(h, l, fontsize=8.5, loc="outside lower center", ncol=2)
    save(fig, "fig5_5_seed_spread")


def episodes():
    names = [("Persistence", "persistence"), ("LightGBM (S-A)", "lgbm_sa"), ("LightGBM MOS (S-B)", "lgbm_mos_sb"),
             ("M0 GRU", "m0_gru"), ("M4 + wavelet", "m4_wavelet"), ("M6", "m6_mwafn")]
    keys = [("pod", "hit rate (POD)"), ("far", "false-alarm rate (FAR)"), ("csi", "critical success index (CSI)")]
    fig, axes = plt.subplots(1, 3, figsize=(W, 3.0), layout="constrained", sharey=True)
    y = np.arange(len(names))
    for ax, (k, lab) in zip(axes, keys):
        v = [val(r)["leads"]["24"]["episodes"][k] for _, r in names]
        ax.barh(y, v, 0.65, color=[BLUE if r.startswith("m") else "#A9C3E3" for _, r in names])
        ax.set_title(lab, fontsize=9)
        ax.set_xlim(0, 1)
        ax.tick_params(labelsize=8)
    axes[0].set_yticks(y, [n for n, _ in names])
    axes[0].invert_yaxis()
    save(fig, "fig5_6_episodes")


def r2_by_lead():
    names = [("Climatology", "climatology"), ("CAMS (raw)", "cams_raw"), ("Persistence", "persistence"), ("LightGBM (S-A)", "lgbm_sa"),
             ("LightGBM MOS (S-B)", "lgbm_mos_sb"), ("LSTM", "base_lstm"), ("PM2.5-GNN", "base_pm25gnn"), ("M0 GRU", "m0_gru"),
             ("M4 + wavelet", "m4_wavelet"), ("M5 + ConvLSTM", "m5_convlstm"), ("M6", "m6_mwafn")]
    fig, ax = plt.subplots(figsize=(W, 3.6))
    y = np.arange(len(names))
    for L, mk, col in (("1", "o", SHADES[0]), ("24", "s", SHADES[1]), ("48", "^", SHADES[2])):
        ax.scatter([val(r)["leads"][L]["station"]["r2"] for _, r in names], y, marker=mk, s=30, color=col, zorder=3, label=f"+{L} h")
    for i in y:
        ax.axhline(i, color="#EEEEEE", lw=0.6, zorder=0)
    ax.set_yticks(y, [n for n, _ in names], fontsize=8.5)
    ax.invert_yaxis()
    ax.set_xlabel("R² at the station level, validation 2022")
    ax.legend(fontsize=8.5, ncol=3, loc="lower left")
    save(fig, "fig5_7_r2_by_lead")


def region_rmse():
    names = [("Persistence", "persistence"), ("CAMS (raw)", "cams_raw"), ("LightGBM (S-A)", "lgbm_sa"), ("M0 GRU", "m0_gru"), ("M6", "m6_mwafn")]
    fig, ax = plt.subplots(figsize=(W, 2.8))
    x = np.arange(len(names))
    igp = [val(r)["leads"]["24"]["by_region"]["IGP"]["rmse"] for _, r in names]
    rest = [val(r)["leads"]["24"]["by_region"]["rest"]["rmse"] for _, r in names]
    ax.bar(x - 0.18, igp, 0.36, color=BLUE, label="Indo-Gangetic Plain")
    ax.bar(x + 0.18, rest, 0.36, color="#A9C3E3", label="rest of the panel")
    ax.set_xticks(x, [n for n, _ in names], fontsize=8.5)
    ax.set_ylabel("RMSE at +24 h (µg/m³)")
    ax.legend(fontsize=8.5, ncol=2, loc="upper right")
    save(fig, "fig5_8_region_rmse")


if __name__ == "__main__":
    import matplotlib.patheffects  # noqa: F401  (used in station_map_real)
    station_map_real()
    station_graph_real()
    season_rmse()
    city_rmse()
    seed_spread()
    episodes()
    r2_by_lead()
    region_rmse()
