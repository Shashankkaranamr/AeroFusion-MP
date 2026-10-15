"""Run identity: run_id = <date>-<exp>-<seed>-<git7> (CLAUDE.md conventions)."""

from __future__ import annotations

import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def git_sha7() -> str:
    """Short commit of the repo, with a '+dirty' marker; 'nogit' if this checkout has no git (see PROGRESS P0.5)."""
    try:
        sha = subprocess.run(["git", "rev-parse", "--short=7", "HEAD"], cwd=REPO, capture_output=True, text=True, check=True).stdout.strip()
        dirty = subprocess.run(["git", "status", "--porcelain"], cwd=REPO, capture_output=True, text=True, check=True).stdout.strip()
        return sha + ("+dirty" if dirty else "")
    except (OSError, subprocess.CalledProcessError):
        return "nogit"


def make_run_id(exp: str, seed: int, when: datetime | None = None, sha: str | None = None) -> str:
    if not re.fullmatch(r"[a-z0-9_]+", exp):
        raise ValueError(f"experiment name must be [a-z0-9_]+, got {exp!r}")
    day = (when or datetime.now(timezone.utc)).strftime("%Y%m%d")
    return f"{day}-{exp}-s{seed}-{sha or git_sha7()}"
