"""S8 OpenAQ hour mapping (offline): t = datetimeFrom + 30 min for :30-aligned hourly periods only."""

import pandas as pd

from aerofusion_ml.data.openaq import hours_frame


def _r(frm, to, v):
    return {"period": {"datetimeFrom": {"utc": frm}, "datetimeTo": {"utc": to}}, "value": v}


def test_hour_mapping_matches_xkdr_convention():
    df = hours_frame([_r("2026-10-13T17:30:00Z", "2026-10-13T18:30:00Z", 80.0),   # IST 23:00 label -> UTC slot 18:00
                      _r("2026-10-13T18:00:00Z", "2026-10-13T19:00:00Z", 99.0),   # not :30-aligned -> dropped
                      _r("2026-10-13T18:30:00Z", "2026-10-13T18:45:00Z", 5.0)])   # not hourly -> dropped
    assert df["t"].tolist() == [pd.Timestamp("2026-10-13 18:00", tz="UTC")] and df["value"].tolist() == [80.0]


def test_empty():
    assert hours_frame([]).empty
