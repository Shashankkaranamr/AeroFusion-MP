"""P1.5 Open-Meteo helpers (offline)."""

import numpy as np
import pandas as pd

from aerofusion_ml.data import openmeteo as om


def test_cell_id_snaps_to_quarter_degree():
    assert om.cell_id(28.6139, 77.209) == "28.50_77.25"
    assert om.cell_id(28.70, 77.10) == "28.75_77.00"


def test_wind_components_follow_from_direction_convention():
    j = {"hourly": {"time": ["2019-11-01T00:00", "2019-11-01T01:00"], **{k: [0.0, 0.0] for k in om.HOURLY}}}
    j["hourly"]["wind_speed_10m"] = [2.0, 3.0]
    j["hourly"]["wind_direction_10m"] = [0.0, 270.0]  # from north -> blows south (v<0); from west -> blows east (u>0)
    df = om.to_frame(j)
    assert df["time"].dt.tz is not None and str(df["time"].iloc[0]) == "2019-11-01 00:00:00+00:00"
    assert np.allclose(df[["u10", "v10"]].to_numpy(), [[0, -2], [3, 0]], atol=1e-9)


def test_year_chunks_cover_window_exactly():
    c = om.year_chunks()
    assert c[0] == ("2017", "2017-12-01", "2017-12-31") and c[-1] == ("2025", "2025-01-01", "2025-09-30") and len(c) == 9


def test_nodes_include_regions_and_unlabelled_cities(tmp_path):
    s = pd.DataFrame({"station_id": ["site_1"], "city": ["delhi"], "latitude": [28.6], "longitude": [77.2]})
    s.to_csv(tmp_path / "s.csv", index=False)
    n = om.nodes(tmp_path / "s.csv")
    assert (n["kind"] == "region").sum() == 17 and (n["kind"] == "city").sum() == 32 and "city_delhi" not in set(n["node_id"])
