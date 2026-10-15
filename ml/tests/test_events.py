"""P1.9: calendar/event features use IST days and the frozen event list."""

import holidays
import numpy as np
import pandas as pd
import pytest

from aerofusion_ml.data import events


def feats(*utc):
    return events.calendar_features(pd.DatetimeIndex(pd.to_datetime(list(utc)), tz="UTC"))


def test_diwali_dates_match_pinned_package():
    cfg = events.load()
    pkg = sorted(str(d) for d, n in holidays.India(years=range(2018, 2028)).items() if n.startswith("Diwali"))
    assert cfg["diwali"]["dates"] == pkg, "holidays package changed Diwali dates; keep events.yaml frozen (v1) and note it"


def test_diwali_window_uses_ist_day():
    # Diwali 2024-10-31. 2024-10-29 18:29 UTC = 23:59 IST Oct 29 (outside); 18:30 UTC = 00:00 IST Oct 30 (D-1, inside)
    f = feats("2024-10-29 18:29", "2024-10-29 18:30", "2024-11-01 18:29", "2024-11-01 18:30")
    assert f["diwali_window"].tolist() == [0, 1, 1, 0]


def test_stubble_and_lockdown_bounds():
    f = feats("2023-09-30 12:00", "2023-10-01 12:00", "2023-11-30 12:00", "2023-12-01 12:00")
    assert f["stubble_season"].tolist() == [0, 1, 1, 0]
    f = feats("2020-03-24 12:00", "2020-03-25 12:00", "2020-05-31 12:00", "2020-06-01 12:00")
    assert f["lockdown"].tolist() == [0, 1, 1, 0]


def test_hour_encoding_is_local_time():
    f = feats("2023-01-01 06:30")  # 12:00 IST
    assert np.isclose(f["hour_sin"].iloc[0], 0, atol=1e-6) and np.isclose(f["hour_cos"].iloc[0], -1)


def test_republic_day_is_a_holiday_and_weekday_is_local():
    f = feats("2024-01-25 18:30", "2024-01-25 18:29")  # 00:00 IST Jan 26 (Fri) / 23:59 IST Jan 25 (Thu)
    assert f["holiday"].tolist() == [1, 0] and f["weekday"].tolist() == [4, 3]


def test_rejects_naive_times():
    with pytest.raises(ValueError):
        events.calendar_features(pd.DatetimeIndex(pd.to_datetime(["2024-01-01"])))
