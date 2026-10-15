"""P1.3 station-panel rule (§3.2) on synthetic stations."""

import pandas as pd

from aerofusion_ml.data import stations as st


def _hours(sid, start, end, every=1):
    return pd.DataFrame({"station_id": sid, "t": pd.date_range(start, end, freq=f"{every}h", tz="UTC")})


def test_nearest_city_within_25_km_only():
    cities = pd.DataFrame({"slug": ["delhi"], "name": ["Delhi"], "lat": [28.6139], "lon": [77.209]})
    s = pd.DataFrame({"station_id": ["a", "b"], "latitude": [28.70, 29.10], "longitude": [77.10, 77.209]})
    out = st.nearest_city(s, cities)
    assert out["city"].tolist()[0] == "delhi" and pd.isna(out["city"].iloc[1])  # b is ~54 km away


def test_panel_rule_start_and_completeness():
    stations = pd.DataFrame({"station_id": ["full", "late", "sparse", "none"], "city": ["delhi"] * 4})
    hours = pd.concat([
        _hours("full", "2018-01-01", "2024-12-31 23:00"),
        _hours("late", "2020-06-01", "2024-12-31 23:00"),
        _hours("sparse", "2018-01-01", "2024-12-31 23:00", every=2),  # 50 %
    ])
    p = st.panel(hours, stations).set_index("station_id")
    assert p.loc["full", "keep"] and p.loc["full", "completeness"] == 1.0
    assert p.loc["late", "reason"] == "starts after 2020-01-01"
    assert p.loc["sparse", "reason"] == "completeness < 60 %"
    assert p.loc["none", "reason"] == "no PM2.5 in window" and not p.loc["none", "keep"]


def test_completeness_counts_from_window_start_not_first_ever_reading():
    stations = pd.DataFrame({"station_id": ["old"], "city": ["delhi"]})
    hours = pd.concat([_hours("old", "2012-01-01", "2012-12-31"), _hours("old", "2017-12-01", "2024-12-31 23:00")])
    p = st.panel(hours, stations).iloc[0]
    assert p["keep"] and p["pm25_start"] == st.WINDOW_START
