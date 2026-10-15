"""P1.2: XKDR IST labels -> UTC hours, on a known station-day (values from the API, 2026-10-15)."""

import pandas as pd

from aerofusion_ml.data.xkdr import to_utc_hour

# site_103 CRRI Mathura Road, Delhi, PM2.5, agg=raw, start=end=2023-11-01 (IST): 24 rows labelled 00:00..23:00.
KNOWN_DAY = {"2023-11-01T00:00:00": 146.14, "2023-11-01T01:00:00": 147.7275, "2023-11-01T02:00:00": 140.4925}


def test_cpcb_ist_hour_maps_to_utc_centre_hour():
    t = to_utc_hour(pd.Series(pd.to_datetime(list(KNOWN_DAY))))
    # 00:00-01:00 IST = 18:30-19:30 UTC on Oct 31 -> stamped 19:00 UTC
    assert t.tolist() == [pd.Timestamp(f"2023-10-31 {h}:00", tz="UTC") for h in (19, 20, 21)]


def test_full_ist_day_gives_24_distinct_consecutive_utc_hours():
    labels = pd.Series(pd.date_range("2023-11-01", periods=24, freq="h"))
    t = to_utc_hour(labels)
    assert t.is_unique and (t.diff().dropna() == pd.Timedelta(hours=1)).all()
    assert t.iloc[0] == pd.Timestamp("2023-10-31 19:00", tz="UTC") and t.iloc[-1] == pd.Timestamp("2023-11-01 18:00", tz="UTC")


def test_us_embassy_half_hour_labels_map_to_their_utc_start_hour():
    # stored at IST :30 = UTC :00, covering [h, h+1) UTC
    t = to_utc_hour(pd.Series(pd.to_datetime(["2024-11-01 05:30:00"])))
    assert t.iloc[0] == pd.Timestamp("2024-11-01 00:00", tz="UTC")


def test_value_at_t_never_ends_after_t_plus_1h():
    labels = pd.Series(pd.to_datetime(["2023-11-01 00:00", "2024-11-01 05:30", "2024-02-29 23:00"]))
    end_utc = (labels - pd.Timedelta(hours=5, minutes=30) + pd.Timedelta(hours=1)).dt.tz_localize("UTC")
    t = to_utc_hour(labels)
    assert ((end_utc > t) & (end_utc <= t + pd.Timedelta(hours=1))).all()
