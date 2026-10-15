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
