"""P1.6/P1.7 request builders (offline; no portal calls)."""

from aerofusion_ml.data import copernicus as cp


def test_months_span_years_inclusive():
    m = cp.months("2017-12", "2025-09")
    assert m[0] == "2017-12" and m[1] == "2018-01" and m[-1] == "2025-09" and len(m) == 94 and len(set(m)) == 94


def test_cams_request_covers_whole_month_both_runs_and_leads_0_48():
    r = cp.cams_fc_request("2024-02")
    assert r["date"] == ["2024-02-01/2024-02-29"] and r["time"] == ["00:00", "12:00"]
    assert r["leadtime_hour"][0] == "0" and r["leadtime_hour"][-1] == "48" and len(r["leadtime_hour"]) == 17
    assert r["area"] == [38, 66, 5, 98] and "particulate_matter_2.5um" in r["variable"]


def test_era5_request_is_3_hourly_and_has_blh():
    r = cp.era5_request("2023-02")
    assert r["day"][-1] == "28" and len(r["time"]) == 8 and r["time"][1] == "03:00"
    assert "boundary_layer_height" in r["variable"] and r["area"] == cp.AREA
