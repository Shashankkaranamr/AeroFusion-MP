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


def test_every_table_row_with_numbers_names_its_run():
    """P2.5: each LaTeX table row that contains a number must end with a `% run_id:` comment (make_tables.py)."""
    import re

    bad = []
    for f in (REPO / "docs" / "paper" / "tables").glob("*.tex"):
        for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            body = line.split("%", 1)[0]
            if "\\\\" in body and re.search(r"\d+\.\d+", body) and not re.search(r"%\s*run_id:\s*\d{8}-[a-z0-9_]+-s\d+-\w+", line):
                bad.append(f"{f.name}:{i}")
    assert not bad, f"table rows without a run_id: {bad}"


def test_every_cited_run_exists():
    import re

    missing = []
    for f in (REPO / "docs" / "paper" / "tables").glob("*.tex"):
        for rid in re.findall(r"run_id:\s*(\S+)", f.read_text(encoding="utf-8")):
            if not (ML / "runs" / rid / "metrics.json").exists():
                missing.append(rid)
    assert not missing, f"tables cite runs with no metrics.json: {missing}"


def test_paper_cites_only_verified_references():
    """Every \cite key in docs/paper/main.tex must exist in refs.bib (generated from docs/related_work.md DOIs/arXiv)."""
    import re

    tex = (REPO / "docs" / "paper" / "main.tex").read_text(encoding="utf-8")
    bib = (REPO / "docs" / "paper" / "refs.bib").read_text(encoding="utf-8")
    keys = {k.strip() for grp in re.findall(r"\\cite\{([^}]*)\}", tex) for k in grp.split(",")}
    have = set(re.findall(r"@\w+\{([^,]+),", bib))
    assert not keys - have, f"cited but not in refs.bib: {sorted(keys - have)}"


def test_paper_has_no_hand_typed_results():
    """Outside the Data section's facts, main.tex must not contain metric-like numbers (results come from tables)."""
    import re

    tex = (REPO / "docs" / "paper" / "main.tex").read_text(encoding="utf-8")
    body = tex.split(r"\section{Results}", 1)[1].split(r"\section{Limitations}", 1)[0]
    assert not re.search(r"\d+\.\d+\s*(\\,)?(\\mu|µ|%|\\%)", body), "metric-like number typed into Results/Attribution"
