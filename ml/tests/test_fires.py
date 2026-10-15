"""P1.8 fire features on synthetic detections."""

import numpy as np
import pandas as pd

from aerofusion_ml.data import fires


def test_distance_and_bearing():
    d, b = fires.dist_bearing(np.array(28.0), np.array(77.0), np.array(29.0), np.array(77.0))
    assert abs(float(d) - 111.2) < 0.5 and abs(float(b) - 0.0) < 1e-6  # 1° north
    _, b = fires.dist_bearing(np.array(28.0), np.array(77.0), np.array(28.0), np.array(76.0))
    assert abs(float(b) - 270) < 1  # due west


def test_counts_frp_and_upwind():
    slot = pd.Timestamp("2019-11-01 05:00", tz="UTC")
    nodes = pd.DataFrame({"node_id": ["delhi"], "lat": [28.6], "lon": [77.2]})
    det = pd.DataFrame({
        "lat": [30.6, 28.6, 25.0, 28.6],      # ~222 km N (Punjab side); 0 km; ~400 km S; ~390 km E
        "lon": [77.2, 77.2, 77.2, 81.2],
        "frp": [10.0, 5.0, 7.0, 3.0],
        "slot": [slot] * 4,
    })
    wind_from_nw = pd.DataFrame({"delhi": [315.0]}, index=[slot])  # NW wind: fires to the N/NW are upwind
    f = fires.node_features(det, nodes, wind_from_nw).iloc[0]
    assert f["fires_300km"] == 2 and f["frp_300km"] == 15.0
    # N fire (bearing 0) is within 45° of 315 -> upwind; the co-located fire has bearing 0 too (d=0) and is counted;
    # S (180) and E (90) are not
    assert f["fires_upwind_500km"] == 2


def test_missing_wind_gives_nan_upwind_not_zero():
    slot = pd.Timestamp("2019-11-01 05:00", tz="UTC")
    nodes = pd.DataFrame({"node_id": ["a"], "lat": [28.6], "lon": [77.2]})
    det = pd.DataFrame({"lat": [28.7], "lon": [77.2], "frp": [1.0], "slot": [slot]})
    f = fires.node_features(det, nodes, pd.DataFrame(columns=["a"], dtype=float)).iloc[0]
    assert f["fires_300km"] == 1 and np.isnan(f["fires_upwind_500km"])
