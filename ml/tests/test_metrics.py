"""P2.1 evaluate.py on hand-checkable synthetic cases + the metrics.json schema."""

import numpy as np
import pandas as pd
import pytest

from aerofusion_ml import evaluate as ev


def test_scores_known_values():
    s = ev.scores([1, 2, 3, 4], [2, 2, 2, 6])
    assert s["n"] == 4 and s["bias"] == -0.5 and s["mae"] == 1.0
    assert s["rmse"] == pytest.approx(np.sqrt((1 + 0 + 1 + 4) / 4))
    assert s["r2"] == pytest.approx(1 - 6 / 12)


def test_nan_obs_or_pred_excluded():
    s = ev.scores([1, np.nan, 3], [1, 5, np.nan])
    assert s["n"] == 1 and s["rmse"] == 0.0


def test_skill():
    assert ev.skill(5.0, 10.0) == 0.5 and ev.skill(None, 3.0) is None and ev.skill(2.0, 0.0) is None


def test_episodes_contingency():
    e = ev.episodes([300, 300, 100, 100], [300, 100, 300, 100], 250)
    assert (e["hits"], e["false_alarms"], e["misses"]) == (1, 1, 1)
    assert e["csi"] == pytest.approx(1 / 3) and e["pod"] == 0.5 and e["far"] == 0.5


def test_aqi_classes_follow_cpcb_upper_bounds():
    b = [30, 60, 90, 120, 250]
    assert ev.aqi_class(np.array([0, 30, 30.5, 60, 61, 250, 251]), b).tolist() == [0, 0, 1, 1, 2, 4, 5]
    s = ev.aqi_scores([10, 70, 300], [20, 40, 300], b)
    assert s["accuracy"] == pytest.approx(2 / 3)


def _frame():
    t0 = pd.to_datetime(["2022-11-01 00:00", "2022-11-01 12:00"], utc=True)
    rows = []
    for t in t0:
        for lead in (1, 24, 48):
            for node, city, o in [("a", "delhi", 200.0), ("b", "delhi", 260.0), ("c", "bengaluru", 40.0)]:
                rows.append({"t0": t, "lead": lead, "node_id": node, "obs": o, "pred": o + 10, "ref_persistence": o + 20})
    rows.append({"t0": t0[0], "lead": 1, "node_id": "c", "obs": np.nan, "pred": 1e6, "ref_persistence": 0.0})
    return pd.DataFrame(rows), {"a": "delhi", "b": "delhi", "c": "bengaluru"}


def test_evaluate_schema_and_values():
    df, city_of = _frame()
    m = ev.evaluate(df, split="val", model="toy", setting="S-A", run_id="20260101-toy-s0-abcdef1", city_of=city_of)
    assert m["status"] == "measured" and set(m["leads"]) == {"1", "24", "48"}
    L = m["leads"]["24"]
    assert set(L) == {"station", "city", "by_season", "by_region", "by_city", "episodes", "aqi"}
    assert L["station"]["rmse"] == pytest.approx(10.0) and L["station"]["skill_vs_persistence"] == pytest.approx(0.5)
    assert L["station"]["n"] == 6  # the masked row (obs NaN, pred 1e6) is excluded
    assert set(L["by_region"]) == {"IGP", "rest"} and set(L["by_season"]) == {"postmonsoon_ON"}
    assert L["city"]["n"] == 4  # 2 cities x 2 issue times; Delhi = mean of its 2 stations


def test_frozen_splits_refused():
    df, city_of = _frame()
    with pytest.raises(PermissionError):
        ev.evaluate(df, split="test", model="toy", setting="S-A", run_id="x", city_of=city_of)
