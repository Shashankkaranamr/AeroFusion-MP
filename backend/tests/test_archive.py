"""P0.2: each fusion writes a timestamped frame + raw forecasts to the archive (no network)."""

import gzip
import json

import numpy as np

from app.live import sources as S
from app.live.service import FEATURE_KEYS, LiveService
from app.sim.core import CITIES


def _service(tmp_path, monkeypatch):
    monkeypatch.setenv("AEROFUSION_ARCHIVE_DIR", str(tmp_path / "archive"))
    svc = LiveService(data_dir=tmp_path / "processed")
    cams = {c.slug: {"pm2_5": 80.0, "hourly_time": ["2026-10-15T00:00"], "hourly_pm2_5": [80.0]} for c in CITIES}
    svc.results = {
        "cams": S.SourceResult(id="cams", ok=True, records=len(cams), fetched_at="2026-10-15T00:05:00Z", data=cams),
        "weather": S.SourceResult(id="weather", ok=False, error="timeout"),
    }
    return svc


def test_fuse_writes_archive(tmp_path, monkeypatch):
    svc = _service(tmp_path, monkeypatch)
    snap = svc._fuse(0)
    name = snap["updated_at"].replace(":", "-")
    arch = tmp_path / "archive"

    d = np.load(arch / f"live_{name}.npz")
    assert d["X"].shape == (1, len(CITIES), len(FEATURE_KEYS))
    assert list(d["timestamps"]) == [snap["updated_at"]]
    assert np.allclose(d["X"][0, :, FEATURE_KEYS.index("pm25")], 80.0)

    with gzip.open(arch / f"forecasts_{name}.json.gz", "rt", encoding="utf-8") as f:
        raw = json.load(f)
    assert raw["updated_at"] == snap["updated_at"]
    assert raw["cams"]["ok"] and raw["cams"]["data"][CITIES[0].slug]["hourly_pm2_5"] == [80.0]
    assert raw["weather"] == {"ok": False, "error": "timeout", "fetched_at": "", "data": None}
    assert (tmp_path / "processed" / "live_tensor.npz").exists()  # "latest" file is kept


def test_archive_failure_does_not_break_refresh(tmp_path, monkeypatch):
    svc = _service(tmp_path, monkeypatch)
    (tmp_path / "archive").write_text("not a directory")
    assert svc._fuse(0)["cities"]
