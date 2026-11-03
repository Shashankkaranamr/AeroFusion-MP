"""ml/data/raw/MANIFEST.json: one entry per downloaded file (url, date, sha256, bytes). PROGRESS §3.8."""

from __future__ import annotations

import hashlib
import json
import os
import time
from contextlib import contextmanager
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


@contextmanager
def _file_lock(manifest: Path, timeout_s: float = 300.0):
    """Cross-process lock (several download_all.py processes share one manifest). O_EXCL lock file; a lock older
    than `timeout_s` is treated as left over from a killed process and taken over."""
    lock = manifest.with_suffix(".lock")
    t0 = time.monotonic()
    while True:
        try:
            fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.close(fd)
            break
        except FileExistsError:
            try:
                if time.time() - lock.stat().st_mtime > timeout_s:
                    lock.unlink(missing_ok=True)
                    continue
            except FileNotFoundError:
                continue
            if time.monotonic() - t0 > 2 * timeout_s:
                raise TimeoutError(f"manifest lock {lock} held too long")
            time.sleep(0.05)
    try:
        yield
    finally:
        lock.unlink(missing_ok=True)


def _replace(tmp: Path, dest: Path, tries: int = 50) -> None:
    """os.replace with retries: on Windows it fails while another process has `dest` open for reading."""
    for i in range(tries):
        try:
            tmp.replace(dest)
            return
        except PermissionError:
            time.sleep(0.1 * (i + 1))
        except OSError as e:
            if getattr(e, "winerror", None) not in (5, 32) and e.errno != 22:
                raise
            time.sleep(0.1 * (i + 1))
    tmp.replace(dest)


def record(path: Path, url: str, manifest: Path = MANIFEST, **extra) -> dict:
    """Add/refresh the entry for `path` (keyed by its path relative to the manifest folder). Safe across processes:
    the read-modify-write happens under a lock file, so concurrent downloaders don't drop each other's entries."""
    key = path.resolve().relative_to(manifest.parent.resolve()).as_posix()
    entry = {"url": url, "downloaded_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "sha256": sha256(path), "bytes": path.stat().st_size, **extra}
    manifest.parent.mkdir(parents=True, exist_ok=True)
    with _file_lock(manifest):
        m = load(manifest)
        m[key] = entry
        tmp = manifest.with_name(f"{manifest.stem}.{os.getpid()}.tmp")
        tmp.write_text(json.dumps(dict(sorted(m.items())), indent=1), encoding="utf-8")
        _replace(tmp, manifest)
    return entry
