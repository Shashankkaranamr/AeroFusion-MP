"""P1.6/P1.7 request builders (offline; no portal calls)."""

from aerofusion_ml.data import copernicus as cp


def test_months_span_years_inclusive():
    m = cp.months("2017-12", "2025-09")
    assert m[0] == "2017-12" and m[1] == "2018-01" and m[-1] == "2025-09" and len(m) == 94 and len(set(m)) == 94


def test_cams_request_covers_whole_month_both_runs_and_leads_0_72():
    r = cp.cams_fc_request("2024-02")
    assert r["date"] == ["2024-02-01/2024-02-29"] and r["time"] == ["00:00", "12:00"]
    assert r["leadtime_hour"][0] == "0" and r["leadtime_hour"][-1] == "72" and len(r["leadtime_hour"]) == 25
    assert r["area"] == [38, 66, 5, 98] and "particulate_matter_2.5um" in r["variable"]


def test_era5_request_is_3_hourly_and_has_blh():
    r = cp.era5_request("2023-02")
    assert r["day"][-1] == "28" and len(r["time"]) == 8 and r["time"][1] == "03:00"
    assert "boundary_layer_height" in r["variable"] and r["area"] == cp.AREA


def test_expired_job_is_resubmitted(tmp_path, monkeypatch):
    """After a long pause the portal answers 404 for old job ids; run() must drop the id and submit again."""
    import json

    from aerofusion_ml.data import manifest

    monkeypatch.setattr(manifest, "RAW", tmp_path)
    recorded = {}
    monkeypatch.setattr(manifest, "load", lambda *a, **k: dict(recorded))
    monkeypatch.setattr(manifest, "record", lambda path, url, **k: recorded.setdefault(str(path), url))
    out = tmp_path / "cams_fc" / "v1"
    out.mkdir(parents=True)
    (out / "jobs.json").write_text(json.dumps({"2019-01": "old-id"}))
    submitted = []

    class Remote:
        def __init__(self, rid):
            self.request_id, self.status = rid, "successful"

        def download(self, target):
            open(target, "wb").write(b"x")

    class Client:
        def submit(self, coll, req):
            submitted.append(req["date"][0])
            return Remote("new-id")

        def get_remote(self, rid):
            if rid == "old-id":
                raise RuntimeError("404 Client Error: Not Found")
            return Remote(rid)

    monkeypatch.setattr(cp, "client", lambda portal: Client())
    cp.run("cams_fc", ["2019-01"], poll_s=0, log=lambda m: None)
    assert submitted == ["2019-01-01/2019-01-31"] and (out / "2019-01.zip").exists()


def test_both_queue_limit_wordings_are_requeued_not_failed():
    """2026-11-03: ADS answered 'Maximum number queued requests for this dataset has been reached', which the old
    single-string check missed, so months were given up after two rejections (§9)."""
    assert cp.is_queue_limit("Number queued requests for this dataset is temporarily limited")
    assert cp.is_queue_limit("Maximum number queued requests for this dataset has been reached. Please configure your scripts")
    assert not cp.is_queue_limit("Request too large. Cost 631104 over 121000 limit")


def test_units_keep_submitted_jobs_and_pair_consecutive_months():
    todo = cp.months("2019-02", "2019-08")
    u = cp.units(todo, {"2019-02": "a", "2019-03": "b"}, 2)
    assert u == ["2019-02", "2019-03", "2019-04_2019-05", "2019-06_2019-07", "2019-08"]
    assert cp.units(["2019-01", "2019-03"], {}, 2) == ["2019-01", "2019-03"]  # never spans a gap
    assert cp.units(cp.months("2019-11", "2020-02"), {}, 2) == ["2019-11_2019-12", "2020-01_2020-02"]
    assert sum(len(cp.unit_months(x)) for x in cp.units(cp.months("2017-12", "2025-09"), {}, 2)) == 94


def test_span_request_covers_both_months():
    assert cp.cams_fc_request("2024-01_2024-02")["date"] == ["2024-01-01/2024-02-29"]


def test_split_cams_zip_round_trips_values(tmp_path):
    import zipfile

    import numpy as np
    import pandas as pd
    import xarray as xr

    runs = pd.date_range("2019-04-01", "2019-05-31 12:00", freq="12h")
    lead = pd.to_timedelta(np.arange(0, 73, 3), "h")
    rng = np.random.default_rng(0)
    shape = (len(lead), len(runs), 3, 2)
    ds = xr.Dataset({v: (("forecast_period", "forecast_reference_time", "latitude", "longitude"), rng.random(shape, dtype=np.float32))
                     for v in ("pm2p5", "aod550", "duaod550")},
                    coords={"forecast_period": lead, "forecast_reference_time": runs, "latitude": [38.0, 37.6, 37.2], "longitude": [66.0, 66.4]})
    nc = tmp_path / "data_sfc.nc"
    ds.to_netcdf(nc)
    span = tmp_path / "2019-04_2019-05.zip"
    with zipfile.ZipFile(span, "w") as z:
        z.write(nc, "data_sfc.nc")
    out = tmp_path / "v1"
    out.mkdir()
    files = cp.split_cams_zip(span, out)
    assert [f.name for f in files] == ["2019-04.zip", "2019-05.zip"]
    for f, month in zip(files, ["2019-04", "2019-05"]):
        with zipfile.ZipFile(f) as z:
            assert z.namelist() == ["data_sfc.nc"]
            z.extractall(tmp_path / month)
        with xr.open_dataset(tmp_path / month / "data_sfc.nc") as got:
            want = ds.sel(forecast_reference_time=month)
            assert got.sizes == want.sizes
            for v in ("pm2p5", "aod550", "duaod550"):
                np.testing.assert_array_equal(got[v].values, want[v].values)
