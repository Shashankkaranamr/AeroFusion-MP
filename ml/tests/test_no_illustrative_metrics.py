"""Hard rule 1 (PROGRESS §0): no placeholder metrics anywhere. First half of P2.5; the
docs/paper/tables/*.tex run_id check is added in P2.5."""

import json
from pathlib import Path

from conftest import ML

REPO = ML.parent
SCAN = ["backend/app", "frontend/src", "frontend/public", "ml"]


def test_placeholder_metrics_file_is_gone():
    assert not (REPO / "backend/app/data/metrics_illustrative.json").exists()


def test_no_json_with_illustrative_status():
    bad = []
    for root in SCAN:
        for f in (REPO / root).rglob("*.json"):
            if "node_modules" in f.parts:
                continue
            try:
                obj = json.loads(f.read_text(encoding="utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                continue
            if isinstance(obj, dict) and str(obj.get("status", "")).lower() == "illustrative":
                bad.append(str(f.relative_to(REPO)))
    assert not bad, f"placeholder metrics found: {bad}"
