"""P1.3: apply the §3.2 station rule, write ml/data/stations_v1.csv (frozen panel) + candidates, plot stations per city per year.

    python ml/scripts/build_station_panel.py            # refuses to overwrite an existing stations_v1.csv
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML))
from aerofusion_ml.data import manifest, stations as st  # noqa: E402

OUT = ML / "data"
FIG = ML / "figures"


def main() -> None:
    dest = OUT / "stations_v1.csv"
    if dest.exists() and "--force" not in sys.argv:
        raise SystemExit(f"{dest} exists and is frozen; a change means stations_v2 (PROGRESS §0)")
    meta = pd.read_parquet(manifest.RAW / "xkdr" / "v1" / "stations.parquet")
    meta = st.nearest_city(meta, st.load_cities())
    hours = st.pm25_hours(st.month_files())
    cand = st.panel(hours, meta)
    cols = ["station_id", "station_name", "city", "city_name", "state_name", "source", "latitude", "longitude",
            "dist_km", "pm25_start", "pm25_last", "n_hours", "completeness", "keep", "reason"]
    cand = cand[cols].sort_values(["city", "station_id"])
    cand.to_csv(OUT / "stations_v1_candidates.csv", index=False)
    keep = cand[cand["keep"]].drop(columns=["keep", "reason"])
    keep.to_csv(dest, index=False)

    # Stations per city per year: candidates reporting >= 50 % of that year's hours vs. the frozen panel.
    h = hours[hours["station_id"].isin(cand["station_id"])].copy()
    h["year"] = h["t"].dt.year
    h = h[(h["year"] >= 2018) & (h["year"] <= 2024)]
    per = h.groupby(["station_id", "year"]).size().rename("n").reset_index()
    per["hours_in_year"] = per["year"].map(lambda y: 8784 if y % 4 == 0 else 8760)
    per = per[per["n"] >= 0.5 * per["hours_in_year"]].merge(cand[["station_id", "city", "keep"]], on="station_id")
    allc = per.groupby(["city", "year"]).size().unstack(fill_value=0)
    panc = per[per["keep"]].groupby(["city", "year"]).size().unstack(fill_value=0).reindex(index=allc.index, columns=allc.columns, fill_value=0)
    counts = pd.concat({"all_candidates": allc, "panel": panc}, axis=1)
    counts.to_csv(OUT / "stations_v1_counts_by_city_year.csv")

    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    FIG.mkdir(exist_ok=True)
    fig, axes = plt.subplots(1, 2, figsize=(11, 0.28 * len(allc) + 1.6), sharey=True)
    for ax, (title, m) in zip(axes, [("All stations within 25 km", allc), ("Frozen panel (stations_v1)", panc)]):
        im = ax.imshow(m.to_numpy(), aspect="auto", cmap="viridis", vmin=0, vmax=max(1, allc.to_numpy().max()))
        for (i, j), v in pd.DataFrame(m.to_numpy()).stack().items():
            ax.text(j, i, str(v), ha="center", va="center", fontsize=7, color="w" if v < allc.to_numpy().max() * 0.6 else "k")
        ax.set_xticks(range(len(m.columns)), m.columns)
        ax.set_title(title, fontsize=10)
    axes[0].set_yticks(range(len(allc.index)), allc.index, fontsize=8)
    fig.suptitle("PM2.5 stations reporting >= 50 % of hours, per city and year (XKDR/CPCB)", fontsize=10)
    fig.colorbar(im, ax=axes, shrink=0.6, label="stations")
    fig.savefig(FIG / "stations_per_city_year.png", dpi=150, bbox_inches="tight")

    print(f"candidates within 25 km: {len(cand)}; kept: {len(keep)} in {keep['city'].nunique()}/33 cities")
    print(cand["reason"].value_counts().to_string())
    missing = sorted(set(st.load_cities()["slug"]) - set(keep["city"]))
    print(f"cities with no panel station: {missing}")
    print(keep.groupby("city").size().sort_values(ascending=False).to_string())


if __name__ == "__main__":
    main()
