"""Credentials: ml/.env, then backend/.env for keys it lacks (e.g. XKDR_API_KEY), then the process environment wins.
Values are never logged."""

from __future__ import annotations

import os
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def _parse(path: Path) -> dict[str, str]:
    out = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                v = v.strip().strip("'\"")
                if v:
                    out[k.strip()] = v
    return out


def load_env() -> dict[str, str]:
    env = {**_parse(REPO / "backend" / ".env"), **_parse(REPO / "ml" / ".env")}
    return {**env, **{k: os.environ[k] for k in env.keys() | {"XKDR_API_KEY", "FIRMS_MAP_KEY", "OPENAQ_API_KEY", "DATAGOVIN_KEY"} if os.environ.get(k)}}


def need(key: str) -> str:
    v = load_env().get(key)
    if not v or v.endswith("_here"):
        raise SystemExit(f"{key} is not set: add it to ml/.env (see ml/.env.example)")
    return v
