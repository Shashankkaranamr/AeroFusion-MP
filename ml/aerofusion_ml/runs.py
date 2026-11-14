"""Run identity: run_id = <date>-<exp>-<seed>-<git7> (CLAUDE.md conventions)."""

from __future__ import annotations

import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


ML_SCOPE = ["--", "ml", ":(exclude)ml/runs"]  # what a training run depends on: ml/ code, configs, frozen data files


def git_sha7() -> str:
    """Short id of the last commit that changed ml/ (outside ml/runs), with a '+dirty' marker if ml/ has uncommitted
    changes; 'nogit' if this checkout has no git (see PROGRESS P0.5).

    Scoped to ml/ (2026-11-14) so that committing PROGRESS.md, the paper or the platform while runs are going does not
    change the run ids of a running ladder and resume still finds unfinished runs. Checking out that commit gives the
    exact ml/ tree the run used.
    """
    try:
        sha = subprocess.run(["git", "log", "-1", "--format=%h", "--abbrev=7", *ML_SCOPE], cwd=REPO, capture_output=True,
                             text=True, check=True).stdout.strip()[:7]
        dirty = subprocess.run(["git", "status", "--porcelain", *ML_SCOPE], cwd=REPO, capture_output=True, text=True, check=True).stdout.strip()
        return (sha or "nogit") + ("+dirty" if dirty else "")
    except (OSError, subprocess.CalledProcessError):
        return "nogit"


def make_run_id(exp: str, seed: int, when: datetime | None = None, sha: str | None = None) -> str:
    if not re.fullmatch(r"[a-z0-9_]+", exp):
        raise ValueError(f"experiment name must be [a-z0-9_]+, got {exp!r}")
    day = (when or datetime.now(timezone.utc)).strftime("%Y%m%d")
    return f"{day}-{exp}-s{seed}-{sha or git_sha7()}"
