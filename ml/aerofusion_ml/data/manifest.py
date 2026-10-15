"""ml/data/raw/MANIFEST.json: one entry per downloaded file (url, date, sha256, bytes). PROGRESS §3.8."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

RAW = Path(__file__).resolve().parents[2] / "data" / "raw"
MANIFEST = RAW / "MANIFEST.json"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load(manifest: Path = MANIFEST) -> dict[str, dict]:
    return json.loads(manifest.read_text(encoding="utf-8")) if manifest.exists() else {}


def record(path: Path, url: str, manifest: Path = MANIFEST, **extra) -> dict:
    """Add/refresh the entry for `path` (keyed by its path relative to the manifest folder)."""
    m = load(manifest)
    key = path.resolve().relative_to(manifest.parent.resolve()).as_posix()
    m[key] = {"url": url, "downloaded_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "sha256": sha256(path), "bytes": path.stat().st_size, **extra}
    manifest.parent.mkdir(parents=True, exist_ok=True)
    tmp = manifest.with_suffix(".tmp")
    tmp.write_text(json.dumps(dict(sorted(m.items())), indent=1), encoding="utf-8")
    tmp.replace(manifest)
    return m[key]
