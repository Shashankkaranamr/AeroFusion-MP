"""P0.8: the package imports, the split config matches the frozen plan (PROGRESS §3.3), run ids follow the convention."""

from datetime import date, datetime, timezone

import pytest
import yaml

from aerofusion_ml.runs import make_run_id
from conftest import ML


def _load(name):
    return yaml.safe_load((ML / "configs" / name).read_text(encoding="utf-8"))


def test_test_split_is_the_frozen_one():
    s = _load("splits_v1.yaml")["splits"]
    assert s["test"] == {"start": "2024-01-01", "end": "2026-03-31", "frozen": True}
    assert (s["train"]["start"], s["train"]["end"]) == ("2019-01-01", "2022-12-31")
    assert (s["val"]["start"], s["val"]["end"]) == ("2023-01-01", "2023-12-31")


@pytest.mark.parametrize("block", ["splits", "rolling_origin_fold"])
def test_splits_are_ordered_and_disjoint(block):
    s = _load("splits_v1.yaml")[block]
    spans = [(date.fromisoformat(s[k]["start"]), date.fromisoformat(s[k]["end"])) for k in ("train", "val", "test")]
    for (a0, a1), (b0, _) in zip(spans, spans[1:]):
        assert a0 <= a1 < b0


def test_feature_keys_unique():
    keys = [f["key"] for f in _load("features_v1.yaml")["features"]]
    assert len(keys) == len(set(keys))


def test_run_id_format():
    when = datetime(2026, 11, 2, tzinfo=timezone.utc)
    assert make_run_id("m0_gru", 3, when, "abc1234") == "20261102-m0_gru-s3-abc1234"
    with pytest.raises(ValueError):
        make_run_id("M0 GRU", 0, when, "abc1234")
